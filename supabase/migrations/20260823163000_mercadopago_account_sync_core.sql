alter table public.expenses drop constraint if exists expenses_source_check;
alter table public.expenses add constraint expenses_source_check
  check (source = any (array['manual'::text,'telegram'::text,'recurring'::text,'apple_wallet'::text,'mercadopago'::text]));

create table if not exists public.mercadopago_sync_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  enabled boolean not null default false,
  credential_state text not null default 'missing' check (credential_state in ('missing','configured','invalid')),
  status text not null default 'credentials_missing' check (status in ('credentials_missing','idle','syncing','ok','error')),
  mp_user_id text,
  lookback_days integer not null default 4 check (lookback_days between 1 and 31),
  last_requested_at timestamptz,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  last_report_task_id text,
  last_report_file text,
  last_balance numeric(18,2),
  last_balance_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mercadopago_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  movement_key text not null,
  source_id text,
  external_reference text,
  occurred_at timestamptz not null,
  record_type text,
  description text,
  merchant text,
  net_credit_amount numeric(18,2) not null default 0,
  net_debit_amount numeric(18,2) not null default 0,
  gross_amount numeric(18,2),
  mp_fee_amount numeric(18,2),
  taxes_amount numeric(18,2),
  balance_amount numeric(18,2),
  currency text default 'CLP',
  payment_method text,
  installments integer,
  classification text not null default 'other' check (classification in ('expense','income','transfer_in','transfer_out','refund','fee','other')),
  category_id uuid references public.categories(id) on delete set null,
  expense_id uuid references public.expenses(id) on delete set null,
  review_status text not null default 'verified' check (review_status in ('verified','review_required','ignored')),
  report_file text,
  raw_data jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, movement_key)
);

create index if not exists mercadopago_movements_user_date_idx
  on public.mercadopago_movements(user_id, occurred_at desc);
create index if not exists mercadopago_movements_source_idx
  on public.mercadopago_movements(user_id, source_id) where source_id is not null;
create index if not exists mercadopago_movements_review_idx
  on public.mercadopago_movements(user_id, review_status, occurred_at desc);

create table if not exists public.mercadopago_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_source text not null default 'cron' check (trigger_source in ('cron','manual','setup')),
  status text not null default 'running' check (status in ('running','ok','error','skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  report_task_id text,
  report_file text,
  rows_seen integer not null default 0,
  rows_inserted integer not null default 0,
  expenses_created integer not null default 0,
  balance numeric(18,2),
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists mercadopago_sync_runs_user_date_idx
  on public.mercadopago_sync_runs(user_id, started_at desc);

create table if not exists public.mercadopago_sync_auth (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cron_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mercadopago_sync_config enable row level security;
alter table public.mercadopago_movements enable row level security;
alter table public.mercadopago_sync_runs enable row level security;
alter table public.mercadopago_sync_auth enable row level security;

create policy "mercadopago config select own" on public.mercadopago_sync_config
  for select to authenticated using (auth.uid() = user_id);
create policy "mercadopago config update own" on public.mercadopago_sync_config
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "mercadopago movements select own" on public.mercadopago_movements
  for select to authenticated using (auth.uid() = user_id);
create policy "mercadopago movements review own" on public.mercadopago_movements
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "mercadopago runs select own" on public.mercadopago_sync_runs
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.mercadopago_sync_auth from anon, authenticated;

grant select, update on public.mercadopago_sync_config to authenticated;
grant select, update on public.mercadopago_movements to authenticated;
grant select on public.mercadopago_sync_runs to authenticated;

comment on table public.mercadopago_movements is 'Movimientos importados desde Mercado Pago Reporte de Liberaciones; no todos son gastos.';
comment on column public.mercadopago_movements.movement_key is 'Clave idempotente calculada a partir de los campos contables del reporte.';
comment on column public.mercadopago_movements.classification is 'Clasificación contable Gastito: gasto, ingreso, transferencia, devolución, costo financiero u otro.';
