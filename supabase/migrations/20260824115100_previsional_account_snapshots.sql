alter table public.previsional_accounts
  add column if not exists account_name text,
  add column if not exists fund_code text,
  add column if not exists fund_allocation_percent numeric(6,2),
  add column if not exists fund_units numeric(18,4),
  add column if not exists source_reference text;

create table if not exists public.previsional_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  previsional_account_id uuid not null references public.previsional_accounts(id) on delete cascade,
  snapshot_date date not null,
  balance numeric(14,2) not null,
  fund_code text,
  fund_allocation_percent numeric(6,2),
  fund_units numeric(18,4),
  source_type text not null default 'manual',
  source_reference text,
  notes text,
  created_at timestamptz not null default now(),
  unique (previsional_account_id, snapshot_date, balance, fund_units)
);

alter table public.previsional_account_snapshots enable row level security;

drop policy if exists "Users can read own previsional snapshots" on public.previsional_account_snapshots;
create policy "Users can read own previsional snapshots"
  on public.previsional_account_snapshots for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own previsional snapshots" on public.previsional_account_snapshots;
create policy "Users can insert own previsional snapshots"
  on public.previsional_account_snapshots for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own previsional snapshots" on public.previsional_account_snapshots;
create policy "Users can update own previsional snapshots"
  on public.previsional_account_snapshots for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own previsional snapshots" on public.previsional_account_snapshots;
create policy "Users can delete own previsional snapshots"
  on public.previsional_account_snapshots for delete using (auth.uid() = user_id);
