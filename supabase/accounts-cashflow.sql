-- Cuentas y flujo de caja
-- Nota: credit_cards ya existe en schema.sql. Este script solo crea accounts.
-- Ejecutar en Supabase → SQL Editor

-- ── Cuentas (débito, billetera, efectivo, ahorro) ─────────────────────────────

create table if not exists public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  type       text not null default 'debito'
             check (type in ('debito', 'billetera', 'efectivo', 'ahorro')),
  bank_id    text,
  balance    numeric(14,2) not null default 0,
  active     boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Triggers updated_at ───────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists accounts_updated_at on public.accounts;
create trigger accounts_updated_at
  before update on public.accounts
  for each row execute function public.touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.accounts enable row level security;

create policy "accounts_select" on public.accounts
  for select using (auth.uid() = user_id);
create policy "accounts_insert" on public.accounts
  for insert with check (auth.uid() = user_id);
create policy "accounts_update" on public.accounts
  for update using (auth.uid() = user_id);
create policy "accounts_delete" on public.accounts
  for delete using (auth.uid() = user_id);

-- ── Índice ────────────────────────────────────────────────────────────────────

create index if not exists accounts_user_id_idx on public.accounts(user_id);
