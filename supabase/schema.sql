-- ============================================================
-- GASTITO — Supabase Schema
-- Pegar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── Extensiones ────────────────────────────────────────────
create extension if not exists "pgcrypto";


-- ─── Función: auto-actualizar updated_at ────────────────────
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- TABLAS DE REFERENCIA GLOBAL (sin user_id, sin RLS de usuario)
-- ============================================================

-- ─── 1. payment_methods ─────────────────────────────────────
create table if not exists payment_methods (
  id    text primary key,   -- 'tarjeta' | 'efectivo' | 'transfer'
  label text not null
);

alter table payment_methods enable row level security;
create policy "pm_public_read" on payment_methods
  for select using (true);


-- ─── 2. banks ───────────────────────────────────────────────
create table if not exists banks (
  id    text primary key,   -- 'bchile' | 'bestado' | etc.
  label text not null
);

alter table banks enable row level security;
create policy "banks_public_read" on banks
  for select using (true);


-- ============================================================
-- TABLAS DE USUARIO (con RLS)
-- ============================================================

-- ─── 3. profiles ────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();

alter table profiles enable row level security;
create policy "profiles_select" on profiles for select using (auth.uid() = id);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);


-- ─── 4. categories ──────────────────────────────────────────
-- user_id IS NULL  → categoría global del sistema (seed.sql)
-- user_id SET      → categoría personalizada del usuario
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  label      text not null,
  icon       text,
  color      text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_categories_updated_at
  before update on categories
  for each row execute function update_updated_at_column();

create index idx_categories_user_id on categories (user_id);

alter table categories enable row level security;
-- Puede leer: categorías globales (null) + las propias
create policy "categories_select" on categories
  for select using (user_id is null or user_id = auth.uid());
-- Solo puede crear/editar/borrar las propias
create policy "categories_insert" on categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update" on categories
  for update using (auth.uid() = user_id);
create policy "categories_delete" on categories
  for delete using (auth.uid() = user_id);


-- ─── 5. expenses ────────────────────────────────────────────
create table if not exists expenses (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  amount              integer not null check (amount > 0),
  description         text not null,
  category_id         uuid references categories(id) on delete set null,
  bank_id             text references banks(id),
  payment_method_id   text references payment_methods(id),
  card_type           text check (card_type in ('debito', 'credito')),
  installments_count  integer not null default 1 check (installments_count >= 1),
  status              text not null default 'ok' check (status in ('ok', 'revisar')),
  expense_date        timestamptz not null,
  notes               text,
  -- origen del gasto: manual (UI), telegram (bot), recurring (auto-cargo)
  source              text not null default 'manual'
                        check (source in ('manual', 'telegram', 'recurring')),
  telegram_message_id uuid,   -- FK añadida después de crear telegram_messages
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_expenses_updated_at
  before update on expenses
  for each row execute function update_updated_at_column();

create index idx_expenses_user_id   on expenses (user_id);
create index idx_expenses_date      on expenses (expense_date desc);
create index idx_expenses_category  on expenses (category_id);
create index idx_expenses_status    on expenses (status);
create index idx_expenses_source    on expenses (source);

alter table expenses enable row level security;
create policy "expenses_select" on expenses for select using (auth.uid() = user_id);
create policy "expenses_insert" on expenses for insert with check (auth.uid() = user_id);
create policy "expenses_update" on expenses for update using (auth.uid() = user_id);
create policy "expenses_delete" on expenses for delete using (auth.uid() = user_id);


-- ─── 6. budgets ─────────────────────────────────────────────
-- month = 'YYYY-MM' para presupuesto mensual, NULL para presupuesto permanente
create table if not exists budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  amount      integer not null default 0 check (amount >= 0),
  month       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create trigger trg_budgets_updated_at
  before update on budgets
  for each row execute function update_updated_at_column();

create index idx_budgets_user_id on budgets (user_id);
create index idx_budgets_month   on budgets (month);

alter table budgets enable row level security;
create policy "budgets_select" on budgets for select using (auth.uid() = user_id);
create policy "budgets_insert" on budgets for insert with check (auth.uid() = user_id);
create policy "budgets_update" on budgets for update using (auth.uid() = user_id);
create policy "budgets_delete" on budgets for delete using (auth.uid() = user_id);


-- ─── 7. recurring_expenses ──────────────────────────────────
create table if not exists recurring_expenses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  amount             integer not null check (amount > 0),
  category_id        uuid references categories(id) on delete set null,
  bank_id            text references banks(id),
  payment_method_id  text references payment_methods(id),
  card_type          text check (card_type in ('debito', 'credito')),
  day_of_month       integer not null check (day_of_month between 1 and 31),
  active             boolean not null default true,
  auto_register      boolean not null default false,
  last_charged_month text,   -- 'YYYY-MM'
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_recurring_updated_at
  before update on recurring_expenses
  for each row execute function update_updated_at_column();

create index idx_recurring_user_id on recurring_expenses (user_id);
create index idx_recurring_active  on recurring_expenses (active);

alter table recurring_expenses enable row level security;
create policy "recurring_select" on recurring_expenses for select using (auth.uid() = user_id);
create policy "recurring_insert" on recurring_expenses for insert with check (auth.uid() = user_id);
create policy "recurring_update" on recurring_expenses for update using (auth.uid() = user_id);
create policy "recurring_delete" on recurring_expenses for delete using (auth.uid() = user_id);


-- ─── 8. installments ────────────────────────────────────────
-- Cuotas/deudas con seguimiento de pago mensual
create table if not exists installments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  total_amount        integer not null check (total_amount > 0),
  installment_amount  integer not null check (installment_amount > 0),
  total_installments  integer not null check (total_installments >= 1),
  paid_installments   integer not null default 0 check (paid_installments >= 0),
  bank_id             text references banks(id),
  category_id         uuid references categories(id) on delete set null,
  due_day             integer check (due_day between 1 and 31),
  start_date          date,
  auto_pay            boolean not null default false,
  last_paid_month     text,   -- 'YYYY-MM'
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint paid_lte_total check (paid_installments <= total_installments)
);

create trigger trg_installments_updated_at
  before update on installments
  for each row execute function update_updated_at_column();

create index idx_installments_user_id on installments (user_id);

alter table installments enable row level security;
create policy "installments_select" on installments for select using (auth.uid() = user_id);
create policy "installments_insert" on installments for insert with check (auth.uid() = user_id);
create policy "installments_update" on installments for update using (auth.uid() = user_id);
create policy "installments_delete" on installments for delete using (auth.uid() = user_id);


-- ─── 9. telegram_accounts ───────────────────────────────────
create table if not exists telegram_accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  telegram_user_id  bigint not null unique,
  telegram_username text,
  chat_id           bigint not null,
  is_active         boolean not null default true,
  webhook_token     text,   -- token secreto para validar requests del bot
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_telegram_accounts_updated_at
  before update on telegram_accounts
  for each row execute function update_updated_at_column();

create index idx_telegram_accounts_user_id         on telegram_accounts (user_id);
create index idx_telegram_accounts_telegram_user_id on telegram_accounts (telegram_user_id);

alter table telegram_accounts enable row level security;
create policy "telegram_accounts_select" on telegram_accounts for select using (auth.uid() = user_id);
create policy "telegram_accounts_insert" on telegram_accounts for insert with check (auth.uid() = user_id);
create policy "telegram_accounts_update" on telegram_accounts for update using (auth.uid() = user_id);
create policy "telegram_accounts_delete" on telegram_accounts for delete using (auth.uid() = user_id);


-- ─── 10. telegram_messages ──────────────────────────────────
-- Guardados por el backend (service_role). El usuario solo puede leer los suyos.
create table if not exists telegram_messages (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete set null,
  telegram_account_id uuid references telegram_accounts(id) on delete set null,
  telegram_message_id bigint,
  chat_id             bigint,
  text                text not null,
  received_at         timestamptz not null,
  parsed              boolean not null default false,
  parse_error         text,
  expense_id          uuid references expenses(id) on delete set null,
  raw_json            jsonb,
  created_at          timestamptz not null default now()
  -- sin updated_at: los mensajes no se editan
);

create index idx_tg_messages_user_id   on telegram_messages (user_id);
create index idx_tg_messages_received  on telegram_messages (received_at desc);
create index idx_tg_messages_parsed    on telegram_messages (parsed);

alter table telegram_messages enable row level security;
-- Solo lectura desde el cliente; escritura exclusiva del backend (service_role)
create policy "tg_messages_select" on telegram_messages
  for select using (auth.uid() = user_id);


-- ─── FK circular: expenses → telegram_messages ──────────────
alter table expenses
  add constraint fk_expense_telegram_message
  foreign key (telegram_message_id)
  references telegram_messages(id)
  on delete set null;


-- ─── 11. audit_logs ─────────────────────────────────────────
-- Escritura exclusiva del backend/triggers. El cliente solo puede leer.
create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  actor       text not null check (actor in ('user', 'bot', 'system')),
  action      text not null,
  target_id   text,
  target_type text,
  summary     text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index idx_audit_user_id    on audit_logs (user_id);
create index idx_audit_created_at on audit_logs (created_at desc);
create index idx_audit_action     on audit_logs (action);

alter table audit_logs enable row level security;
create policy "audit_logs_select" on audit_logs
  for select using (auth.uid() = user_id);


-- ─── 12. app_settings ───────────────────────────────────────
create table if not exists app_settings (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references auth.users(id) on delete cascade,
  currency             text not null default 'CLP',
  timezone             text not null default 'America/Santiago',
  telegram_bot_token   text,   -- guardar solo en backend con service_role
  telegram_webhook_url text,
  bot_active           boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_app_settings_updated_at
  before update on app_settings
  for each row execute function update_updated_at_column();

alter table app_settings enable row level security;
create policy "app_settings_select" on app_settings for select using (auth.uid() = user_id);
create policy "app_settings_insert" on app_settings for insert with check (auth.uid() = user_id);
create policy "app_settings_update" on app_settings for update using (auth.uid() = user_id);


-- ============================================================
-- AUTO-INICIALIZACIÓN AL REGISTRAR USUARIO
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id)
    values (new.id)
    on conflict (id) do nothing;

  insert into app_settings (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
