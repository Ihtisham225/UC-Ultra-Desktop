-- Ensure app_role enum has the values this migration needs
do $$ begin
  alter type public.app_role add value if not exists 'vendor';
exception when others then null; end $$;
do $$ begin
  alter type public.app_role add value if not exists 'customer';
exception when others then null; end $$;

-- ---------- 2. Vendors & applications ----------
create table if not exists public.vendor_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  requested_slug text not null,
  contact_email text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.vendor_applications enable row level security;

drop policy if exists "applicant reads own" on public.vendor_applications;
create policy "applicant reads own" on public.vendor_applications
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));
drop policy if exists "applicant inserts own" on public.vendor_applications;
create policy "applicant inserts own" on public.vendor_applications
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "admin updates applications" on public.vendor_applications;
create policy "admin updates applications" on public.vendor_applications
  for update to authenticated using (public.has_role(auth.uid(), 'super_admin'));

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique,
  business_name text not null,
  logo_url text,
  currency text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.vendors enable row level security;

drop policy if exists "public reads active vendors" on public.vendors;
create policy "public reads active vendors" on public.vendors
  for select to anon, authenticated using (is_active = true);
drop policy if exists "owner updates own vendor" on public.vendors;
create policy "owner updates own vendor" on public.vendors
  for update to authenticated using (owner_id = auth.uid());
drop policy if exists "admin manages vendors" on public.vendors;
create policy "admin manages vendors" on public.vendors
  for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));

create or replace function public.current_vendor_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.vendors where owner_id = auth.uid() limit 1;
$$;

-- ---------- 3. Catalog tables ----------
create table if not exists public.web_categories (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (vendor_id, slug)
);

create table if not exists public.web_collections (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (vendor_id, slug)
);

create table if not exists public.web_products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  category_id uuid references public.web_categories(id) on delete set null,
  collection_id uuid references public.web_collections(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'USD',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, slug)
);

create table if not exists public.web_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.web_products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  sku text,
  name text not null,
  price_cents integer not null default 0,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.web_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.web_products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  url text not null,
  alt text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- 4. Per-vendor customer profiles ----------
create table if not exists public.web_customers (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  default_shipping_address jsonb,
  created_at timestamptz not null default now(),
  unique (vendor_id, user_id)
);
alter table public.web_customers enable row level security;

drop policy if exists "customer reads own profile" on public.web_customers;
create policy "customer reads own profile" on public.web_customers
  for select to authenticated using (user_id = auth.uid() or vendor_id = public.current_vendor_id() or public.has_role(auth.uid(), 'super_admin'));
drop policy if exists "customer manages own profile" on public.web_customers;
create policy "customer manages own profile" on public.web_customers
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_web_customers_vendor on public.web_customers(vendor_id);
create index if not exists idx_web_customers_user on public.web_customers(user_id);

-- ---------- 5. Carts & orders ----------
create table if not exists public.web_carts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or session_id is not null)
);

create table if not exists public.web_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.web_carts(id) on delete cascade,
  product_id uuid not null references public.web_products(id) on delete cascade,
  variant_id uuid references public.web_product_variants(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.web_orders (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  customer_user_id uuid references auth.users(id) on delete set null,
  customer_email text not null,
  customer_name text not null,
  shipping_address jsonb not null,
  subtotal_cents integer not null,
  total_cents integer not null,
  currency text not null default 'USD',
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','shipped','delivered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.web_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.web_orders(id) on delete cascade,
  product_id uuid not null references public.web_products(id) on delete restrict,
  variant_id uuid references public.web_product_variants(id) on delete set null,
  product_name text not null,
  variant_name text,
  quantity integer not null,
  unit_price_cents integer not null
);

create index if not exists idx_web_products_vendor on public.web_products(vendor_id);
create index if not exists idx_web_products_published on public.web_products(vendor_id, is_published);
create index if not exists idx_web_variants_product on public.web_product_variants(product_id);
create index if not exists idx_web_images_product on public.web_product_images(product_id);
create index if not exists idx_web_categories_vendor on public.web_categories(vendor_id);
create index if not exists idx_web_collections_vendor on public.web_collections(vendor_id);
create index if not exists idx_web_carts_user on public.web_carts(user_id);
create index if not exists idx_web_carts_session on public.web_carts(session_id);
create index if not exists idx_web_orders_vendor on public.web_orders(vendor_id);
create index if not exists idx_web_orders_customer on public.web_orders(customer_user_id);

alter table public.web_categories       enable row level security;
alter table public.web_collections      enable row level security;
alter table public.web_products         enable row level security;
alter table public.web_product_variants enable row level security;
alter table public.web_product_images   enable row level security;
alter table public.web_carts            enable row level security;
alter table public.web_cart_items       enable row level security;
alter table public.web_orders           enable row level security;
alter table public.web_order_items      enable row level security;

drop policy if exists "public reads published products" on public.web_products;
create policy "public reads published products" on public.web_products
  for select to anon, authenticated using (is_published = true);

drop policy if exists "public reads variants of published" on public.web_product_variants;
create policy "public reads variants of published" on public.web_product_variants
  for select to anon, authenticated using (
    exists (select 1 from public.web_products p where p.id = product_id and p.is_published = true)
  );

drop policy if exists "public reads images of published" on public.web_product_images;
create policy "public reads images of published" on public.web_product_images
  for select to anon, authenticated using (
    exists (select 1 from public.web_products p where p.id = product_id and p.is_published = true)
  );

drop policy if exists "public reads categories" on public.web_categories;
create policy "public reads categories" on public.web_categories
  for select to anon, authenticated using (true);

drop policy if exists "public reads collections" on public.web_collections;
create policy "public reads collections" on public.web_collections
  for select to anon, authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array[
    'web_products','web_product_variants','web_product_images',
    'web_categories','web_collections'
  ] loop
    execute format('drop policy if exists "vendor manages own %1$s" on public.%1$s', t);
    execute format($f$
      create policy "vendor manages own %1$s" on public.%1$s
        for all to authenticated
        using (vendor_id = public.current_vendor_id())
        with check (vendor_id = public.current_vendor_id())
    $f$, t);

    execute format('drop policy if exists "admin all %1$s" on public.%1$s', t);
    execute format($f$
      create policy "admin all %1$s" on public.%1$s
        for all to authenticated
        using (public.has_role(auth.uid(), 'super_admin'))
        with check (public.has_role(auth.uid(), 'super_admin'))
    $f$, t);
  end loop;
end $$;

drop policy if exists "user manages own cart" on public.web_carts;
create policy "user manages own cart" on public.web_carts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user manages own cart items" on public.web_cart_items;
create policy "user manages own cart items" on public.web_cart_items
  for all to authenticated
  using (exists (select 1 from public.web_carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.web_carts c where c.id = cart_id and c.user_id = auth.uid()));

drop policy if exists "customer reads own orders" on public.web_orders;
create policy "customer reads own orders" on public.web_orders
  for select to authenticated using (customer_user_id = auth.uid());
drop policy if exists "vendor reads own orders" on public.web_orders;
create policy "vendor reads own orders" on public.web_orders
  for select to authenticated using (vendor_id = public.current_vendor_id());
drop policy if exists "vendor updates own order status" on public.web_orders;
create policy "vendor updates own order status" on public.web_orders
  for update to authenticated using (vendor_id = public.current_vendor_id());
drop policy if exists "admin all orders" on public.web_orders;
create policy "admin all orders" on public.web_orders
  for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "read order items via order" on public.web_order_items;
create policy "read order items via order" on public.web_order_items
  for select to authenticated using (
    exists (
      select 1 from public.web_orders o
      where o.id = order_id and (
        o.customer_user_id = auth.uid()
        or o.vendor_id = public.current_vendor_id()
        or public.has_role(auth.uid(), 'super_admin')
      )
    )
  );

insert into storage.buckets (id, name, public)
values ('web-product-images', 'web-product-images', true)
on conflict (id) do nothing;

drop policy if exists "vendor uploads own product images" on storage.objects;
create policy "vendor uploads own product images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'web-product-images'
    and (storage.foldername(name))[1] = public.current_vendor_id()::text
  );

drop policy if exists "vendor updates own product images" on storage.objects;
create policy "vendor updates own product images" on storage.objects
  for update to authenticated using (
    bucket_id = 'web-product-images'
    and (storage.foldername(name))[1] = public.current_vendor_id()::text
  );

drop policy if exists "vendor deletes own product images" on storage.objects;
create policy "vendor deletes own product images" on storage.objects
  for delete to authenticated using (
    bucket_id = 'web-product-images'
    and (storage.foldername(name))[1] = public.current_vendor_id()::text
  );

drop policy if exists "public reads product images" on storage.objects;
create policy "public reads product images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'web-product-images');