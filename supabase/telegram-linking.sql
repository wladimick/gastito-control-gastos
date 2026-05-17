-- ============================================================
-- GASTITO — Telegram linking codes
-- Pegar en Supabase SQL Editor ANTES de desplegar la Edge Function
-- ============================================================

-- Códigos temporales para vincular cuenta Telegram ↔ user_id
create table if not exists linking_codes (
  code       text primary key,
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists idx_linking_codes_expires on linking_codes (expires_at);

alter table linking_codes enable row level security;

-- El usuario puede gestionar solo su propio código
create policy "lc_select" on linking_codes for select using (auth.uid() = user_id);
create policy "lc_insert" on linking_codes for insert with check (auth.uid() = user_id);
create policy "lc_delete" on linking_codes for delete using (auth.uid() = user_id);

-- Limpieza automática de códigos expirados (opcional, requiere pg_cron)
-- select cron.schedule('limpieza-linking-codes', '*/30 * * * *',
--   $$ delete from linking_codes where expires_at < now() $$);
