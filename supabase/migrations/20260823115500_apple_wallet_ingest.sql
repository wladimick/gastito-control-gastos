create table if not exists public.wallet_ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Apple Wallet',
  token_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists wallet_ingest_tokens_user_idx
  on public.wallet_ingest_tokens(user_id, active);

alter table public.wallet_ingest_tokens enable row level security;

create table if not exists public.wallet_ingest_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_id uuid references public.wallet_ingest_tokens(id) on delete set null,
  credit_card_id uuid references public.credit_cards(id) on delete set null,
  bank_id text references public.banks(id) on delete set null,
  card_hint text,
  merchant text not null,
  merchant_key text not null,
  wallet_name text,
  amount integer not null check (amount > 0),
  currency text not null default 'CLP',
  occurred_at timestamptz not null default now(),
  fingerprint text not null unique,
  category_id uuid references public.categories(id) on delete set null,
  expense_id uuid references public.expenses(id) on delete set null,
  status text not null default 'accepted' check (status in ('accepted','review','duplicate','error')),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_ingest_events_user_date_idx
  on public.wallet_ingest_events(user_id, occurred_at desc);
create index if not exists wallet_ingest_events_dedupe_idx
  on public.wallet_ingest_events(user_id, credit_card_id, merchant_key, amount, occurred_at desc);

alter table public.wallet_ingest_events enable row level security;

drop policy if exists "Users can view own wallet events" on public.wallet_ingest_events;
create policy "Users can view own wallet events"
  on public.wallet_ingest_events
  for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.wallet_ingest_events to authenticated;

comment on table public.wallet_ingest_tokens is 'API tokens hashed for Apple Wallet / Shortcuts ingestion.';
comment on table public.wallet_ingest_events is 'Raw Apple Wallet transaction events received through iOS Shortcuts before/while creating Gastito expenses.';
