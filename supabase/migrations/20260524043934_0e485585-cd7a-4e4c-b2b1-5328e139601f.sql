drop table if exists public.subscriptions cascade;
drop function if exists public.activate_pro_from_paddle(uuid, text, timestamptz);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  user_id uuid not null,
  tracker text not null unique,
  order_id text not null,
  plan_code text not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  status text not null default 'pending',
  environment text not null default 'sandbox',
  paid_at timestamptz,
  raw_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payments_shop on public.payments(shop_id);
create index idx_payments_user on public.payments(user_id);
create index idx_payments_status on public.payments(status);

alter table public.payments enable row level security;

create policy "Members view shop payments"
  on public.payments for select
  using (public.is_shop_member(auth.uid(), shop_id));

create policy "Service role manages payments"
  on public.payments for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create trigger update_payments_updated_at
  before update on public.payments
  for each row execute function public.update_updated_at_column();

create or replace function public.activate_pro_for_shop(
  _shop_id uuid,
  _duration_days integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shops
     set is_pro = true,
         pro_until = greatest(coalesce(pro_until, now()), now()) + (_duration_days || ' days')::interval,
         updated_at = now()
   where id = _shop_id;
end;
$$;

revoke execute on function public.activate_pro_for_shop(uuid, integer) from public, anon, authenticated;
grant execute on function public.activate_pro_for_shop(uuid, integer) to service_role;