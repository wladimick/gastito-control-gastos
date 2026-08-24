create table if not exists public.billing_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null,
  cash_month text not null check (cash_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount bigint not null check (amount >= 0),
  confidence text not null default 'statement_schedule'
    check (confidence in ('statement_schedule','derived','manual')),
  source_file text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_forecasts_card_owner_fk foreign key (credit_card_id, user_id)
    references public.credit_cards(id, user_id) on delete cascade,
  constraint billing_forecasts_user_card_month_unique unique (user_id, credit_card_id, cash_month)
);

alter table public.billing_forecasts enable row level security;

drop policy if exists billing_forecasts_select_own on public.billing_forecasts;
create policy billing_forecasts_select_own on public.billing_forecasts
  for select using (auth.uid() = user_id);

drop policy if exists billing_forecasts_insert_own on public.billing_forecasts;
create policy billing_forecasts_insert_own on public.billing_forecasts
  for insert with check (auth.uid() = user_id);

drop policy if exists billing_forecasts_update_own on public.billing_forecasts;
create policy billing_forecasts_update_own on public.billing_forecasts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists billing_forecasts_delete_own on public.billing_forecasts;
create policy billing_forecasts_delete_own on public.billing_forecasts
  for delete using (auth.uid() = user_id);

create index if not exists billing_forecasts_user_month_idx
  on public.billing_forecasts(user_id, cash_month);
