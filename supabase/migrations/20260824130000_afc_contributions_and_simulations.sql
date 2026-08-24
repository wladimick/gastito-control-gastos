create table if not exists public.previsional_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  system text not null,
  provider text not null,
  period_month date not null,
  employer text,
  employer_rut text,
  taxable_income bigint,
  worker_contribution bigint not null default 0,
  employer_personal_contribution bigint not null default 0,
  payment_date date,
  source_type text not null default 'certificate',
  source_reference text,
  verified boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, system, provider, period_month, employer_rut)
);

alter table public.previsional_contributions enable row level security;

drop policy if exists "Users can read own previsional contributions" on public.previsional_contributions;
create policy "Users can read own previsional contributions"
  on public.previsional_contributions for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own previsional contributions" on public.previsional_contributions;
create policy "Users can insert own previsional contributions"
  on public.previsional_contributions for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own previsional contributions" on public.previsional_contributions;
create policy "Users can update own previsional contributions"
  on public.previsional_contributions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.unemployment_insurance_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  simulation_date date not null,
  termination_date date,
  termination_cause text,
  employer text,
  funding_type text not null check (funding_type in ('FCS','CIC')),
  average_remuneration bigint,
  total_benefit bigint,
  total_afp_contribution bigint,
  max_payments integer,
  source_reference text,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, simulation_date, funding_type, termination_date)
);

alter table public.unemployment_insurance_simulations enable row level security;

drop policy if exists "Users can read own unemployment simulations" on public.unemployment_insurance_simulations;
create policy "Users can read own unemployment simulations"
  on public.unemployment_insurance_simulations for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own unemployment simulations" on public.unemployment_insurance_simulations;
create policy "Users can insert own unemployment simulations"
  on public.unemployment_insurance_simulations for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own unemployment simulations" on public.unemployment_insurance_simulations;
create policy "Users can update own unemployment simulations"
  on public.unemployment_insurance_simulations for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.unemployment_insurance_simulation_payments (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.unemployment_insurance_simulations(id) on delete cascade,
  payment_number integer not null,
  payment_date date,
  remuneration_percent numeric(6,2),
  amount bigint not null,
  afp_amount bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (simulation_id, payment_number)
);
