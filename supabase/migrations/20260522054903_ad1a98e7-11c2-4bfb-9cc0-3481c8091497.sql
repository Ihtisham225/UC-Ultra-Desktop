create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  user_id uuid not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_shop_id on public.subscriptions(shop_id);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_paddle_id on public.subscriptions(paddle_subscription_id);

alter table public.subscriptions enable row level security;

create policy "Members view shop subscriptions"
  on public.subscriptions for select
  using (public.is_shop_member(auth.uid(), shop_id));

create policy "Service role manages subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create trigger update_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at_column();

-- Webhook helper: extend pro_until from a given start date by the plan duration.
create or replace function public.activate_pro_from_paddle(
  _shop_id uuid,
  _price_id text,
  _period_end timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shops
     set is_pro = true,
         pro_until = greatest(coalesce(pro_until, now()), coalesce(_period_end, now())),
         updated_at = now()
   where id = _shop_id;
end;
$$;