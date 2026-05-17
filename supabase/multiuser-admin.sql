-- ============================================================
-- GASTITO — Multiuser & Admin Extension
-- Incremental — safe to run on an existing schema
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── 1. Extend profiles table ───────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email        text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS role         text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS support_notes text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('user', 'admin', 'super_admin'));
  END IF;
END $$;


-- ─── 2. Security helper functions ───────────────────────────
-- Use these in RLS policies — security definer avoids recursion
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION is_admin_or_super_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE id = auth.uid()),
    'user'
  )
$$;


-- ─── 3. Admin user list RPC ──────────────────────────────────
-- Exposes auth.users emails only to super_admin. Never use service_role in frontend.
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (
  id            uuid,
  email         text,
  display_name  text,
  role          text,
  is_active     boolean,
  support_notes text,
  created_at    timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, u.email, p.display_name, p.role, p.is_active, p.support_notes, p.created_at
  FROM   profiles p
  JOIN   auth.users u ON u.id = p.id
  WHERE  is_super_admin()
  ORDER  BY p.created_at
$$;


-- ─── 4. Update profiles RLS to include super_admin access ───
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_super_admin());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id OR is_super_admin());


-- ─── 5. user_settings table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  currency           text        NOT NULL DEFAULT 'CLP',
  timezone           text        NOT NULL DEFAULT 'America/Santiago',
  salary_payment_day integer     CHECK (salary_payment_day BETWEEN 1 AND 31),
  month_start_day    integer     NOT NULL DEFAULT 1 CHECK (month_start_day BETWEEN 1 AND 28),
  preferred_bot_mode text        NOT NULL DEFAULT 'shared',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_user_settings_updated_at
      BEFORE UPDATE ON user_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_settings_select" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update" ON user_settings;

CREATE POLICY "user_settings_select" ON user_settings
  FOR SELECT USING (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "user_settings_insert" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_update" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id OR is_super_admin());


-- ─── 6. credit_cards table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_cards (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text    NOT NULL,
  bank_id         text    REFERENCES banks(id),
  last_four       text    CHECK (last_four ~ '^[0-9]{4}$' OR last_four IS NULL),
  billing_day     integer CHECK (billing_day BETWEEN 1 AND 31),
  payment_due_day integer CHECK (payment_due_day BETWEEN 1 AND 31),
  credit_limit    numeric CHECK (credit_limit > 0),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_credit_cards_updated_at'
  ) THEN
    CREATE TRIGGER trg_credit_cards_updated_at
      BEFORE UPDATE ON credit_cards
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards (user_id);

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_cards_select" ON credit_cards;
DROP POLICY IF EXISTS "credit_cards_insert" ON credit_cards;
DROP POLICY IF EXISTS "credit_cards_update" ON credit_cards;
DROP POLICY IF EXISTS "credit_cards_delete" ON credit_cards;

-- super_admin can insert cards for any user (support use case)
CREATE POLICY "credit_cards_select" ON credit_cards
  FOR SELECT USING (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "credit_cards_insert" ON credit_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "credit_cards_update" ON credit_cards
  FOR UPDATE USING (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "credit_cards_delete" ON credit_cards
  FOR DELETE USING (auth.uid() = user_id OR is_super_admin());


-- ─── 7. telegram_accounts: enforce one account per user ──────
-- Each Telegram user_id already has a UNIQUE constraint.
-- Add UNIQUE on user_id so one user can't link multiple accounts.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_accounts_user_id_unique'
  ) THEN
    ALTER TABLE telegram_accounts
      ADD CONSTRAINT telegram_accounts_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- Allow super_admin to read all telegram_accounts for support
DROP POLICY IF EXISTS "telegram_accounts_select" ON telegram_accounts;
CREATE POLICY "telegram_accounts_select" ON telegram_accounts
  FOR SELECT USING (auth.uid() = user_id OR is_super_admin());


-- ─── 8. audit_logs: add admin_user_id column ─────────────────
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Allow super_admin to read all audit logs
DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id OR is_super_admin());

-- Allow super_admin to insert admin-action audit entries
DROP POLICY IF EXISTS "audit_logs_insert_admin" ON audit_logs;
CREATE POLICY "audit_logs_insert_admin" ON audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR (is_super_admin() AND auth.uid() = admin_user_id)
  );


-- ─── 9. Update handle_new_user trigger ───────────────────────
-- Auto-populates email, display_name, role, and creates user_settings
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role text := 'user';
BEGIN
  IF new.email = 'wladimickdiaz@gmail.com' THEN
    v_role := 'super_admin';
  END IF;

  INSERT INTO profiles (id, email, display_name, role)
    VALUES (new.id, new.email, split_part(new.email, '@', 1), v_role)
    ON CONFLICT (id) DO UPDATE
      SET email        = EXCLUDED.email,
          display_name = COALESCE(profiles.display_name, EXCLUDED.display_name),
          role         = CASE
                           WHEN EXCLUDED.role != 'user' THEN EXCLUDED.role
                           ELSE profiles.role
                         END;

  INSERT INTO app_settings (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO user_settings (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;


-- ─── 10. Backfill existing users ─────────────────────────────
-- Safe to run multiple times (idempotent)

-- Populate email and display_name for profiles created before this migration
UPDATE profiles p
SET
  email        = u.email,
  display_name = COALESCE(p.display_name, split_part(u.email, '@', 1))
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Assign super_admin to the designated owner (if already registered)
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'wladimickdiaz@gmail.com';

-- Create user_settings for existing users who don't have them yet
INSERT INTO user_settings (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_settings)
ON CONFLICT (user_id) DO NOTHING;


-- ─── NOTA sobre gastos privados ──────────────────────────────
-- El super_admin NO tiene acceso a expenses, budgets, recurring_expenses,
-- ni installments de otros usuarios. Las políticas RLS de esas tablas
-- permanecen sin cambios (solo auth.uid() = user_id).
-- Si en el futuro se necesita acceso de soporte a gastos, crear una
-- Edge Function con service_role y documentar el flujo de autorización.
