alter table public.salary_slips
  add column if not exists contract_type text,
  add column if not exists contract_start_date date,
  add column if not exists pension_provider text,
  add column if not exists pension_rate_percent numeric(6,3),
  add column if not exists health_provider text,
  add column if not exists health_rate_percent numeric(6,3),
  add column if not exists uf_value numeric(12,2),
  add column if not exists taxable_earnings bigint,
  add column if not exists non_taxable_earnings bigint,
  add column if not exists pension_health_base bigint,
  add column if not exists unemployment_base bigint,
  add column if not exists total_earnings bigint,
  add column if not exists total_deductions bigint,
  add column if not exists source_details_verified boolean not null default false;

create table if not exists public.previsional_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('afp_mandatory','afc_cic')),
  provider text not null,
  balance numeric(14,2) not null default 0,
  as_of_date date,
  source_type text not null default 'manual',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_type, provider)
);

alter table public.previsional_accounts enable row level security;

drop policy if exists "Users can read own previsional accounts" on public.previsional_accounts;
create policy "Users can read own previsional accounts"
  on public.previsional_accounts for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own previsional accounts" on public.previsional_accounts;
create policy "Users can insert own previsional accounts"
  on public.previsional_accounts for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own previsional accounts" on public.previsional_accounts;
create policy "Users can update own previsional accounts"
  on public.previsional_accounts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own previsional accounts" on public.previsional_accounts;
create policy "Users can delete own previsional accounts"
  on public.previsional_accounts for delete using (auth.uid() = user_id);

create or replace view public.salary_previsional_metrics
with (security_invoker = true)
as
select
  s.id, s.user_id, s.period_month, s.pension_provider, s.health_provider, s.contract_type,
  s.pension_health_base, s.unemployment_base, s.pension_amount, s.health_amount, s.unemployment_amount,
  round(coalesce(s.pension_health_base, 0) * 0.10)::bigint as afp_worker_savings_estimated,
  greatest(coalesce(s.pension_amount, 0) - round(coalesce(s.pension_health_base, 0) * 0.10)::bigint, 0)
    as afp_commission_estimated,
  round(coalesce(s.unemployment_base, 0) * 0.016)::bigint as afc_employer_cic_estimated,
  (coalesce(s.unemployment_amount, 0) + round(coalesce(s.unemployment_base, 0) * 0.016)::bigint)
    as afc_cic_expected_contribution,
  round(coalesce(s.unemployment_base, 0) * 0.008)::bigint as afc_employer_fcs_estimated
from public.salary_slips s;
