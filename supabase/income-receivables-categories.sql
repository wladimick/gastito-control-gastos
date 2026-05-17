-- ============================================================
-- GASTITO — Income, Receivables, Payables & Categories
-- Incremental — safe to run on existing schema
-- ============================================================

-- ─── 1. Extend recurring_expenses for all kinds ──────────────
-- Allow NULL on day_of_month (not needed for receivables/payables)
ALTER TABLE recurring_expenses ALTER COLUMN day_of_month DROP NOT NULL;

-- Drop old check to replace with nullable-aware one
ALTER TABLE recurring_expenses DROP CONSTRAINT IF EXISTS recurring_expenses_day_of_month_check;
ALTER TABLE recurring_expenses
  ADD CONSTRAINT recurring_expenses_day_of_month_check
  CHECK (day_of_month BETWEEN 1 AND 31 OR day_of_month IS NULL);

-- New columns
ALTER TABLE recurring_expenses
  ADD COLUMN IF NOT EXISTS kind        text NOT NULL DEFAULT 'expense',
  ADD COLUMN IF NOT EXISTS person_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS due_date    date,
  ADD COLUMN IF NOT EXISTS status      text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paid_at     timestamptz,
  ADD COLUMN IF NOT EXISTS notes       text;

-- Constraints
ALTER TABLE recurring_expenses DROP CONSTRAINT IF EXISTS recurring_kind_check;
ALTER TABLE recurring_expenses
  ADD CONSTRAINT recurring_kind_check
  CHECK (kind IN ('expense', 'income', 'receivable', 'payable'));

ALTER TABLE recurring_expenses DROP CONSTRAINT IF EXISTS recurring_status_check;
ALTER TABLE recurring_expenses
  ADD CONSTRAINT recurring_status_check
  CHECK (status IN ('pending', 'paid', 'overdue') OR status IS NULL);

-- Indices for new columns
CREATE INDEX IF NOT EXISTS idx_recurring_kind   ON recurring_expenses (kind);
CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_expenses (status);
CREATE INDEX IF NOT EXISTS idx_recurring_due    ON recurring_expenses (due_date);


-- ─── 2. New global categories ────────────────────────────────
-- Unique index so we can use ON CONFLICT safely
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'categories_global_label_unique'
  ) THEN
    CREATE UNIQUE INDEX categories_global_label_unique
      ON categories (lower(label)) WHERE user_id IS NULL;
  END IF;
END $$;

-- Insert new global categories (idempotent via ON CONFLICT)
INSERT INTO categories (label, icon, color, sort_order) VALUES
  ('Sueldo',      '💰', '#27AE60', 10),
  ('Ahorro',      '💾', '#2196F3', 11),
  ('Préstamo',    '🤝', '#FF9800', 12),
  ('Familia',     '👨‍👩‍👧', '#E91E63', 13),
  ('Mascota',     '🐾', '#795548', 14),
  ('Salud',       '🩺', '#00BCD4', 15),
  ('Auto',        '🚗', '#607D8B', 16),
  ('Educación',   '📚', '#3F51B5', 17),
  ('Servicios',   '⚡', '#FF5722', 18),
  ('Arriendo',    '🏡', '#8BC34A', 19),
  ('Deuda',       '📋', '#F44336', 20),
  ('Por cobrar',  '💵', '#4CAF50', 21),
  ('Por pagar',   '💸', '#FF9800', 22),
  ('Regalo',      '🎁', '#E91E63', 23),
  ('Imprevistos', '⚠️', '#9E9E9E', 24)
ON CONFLICT DO NOTHING;


-- ─── 3. user_settings: index for quick lookup ────────────────
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings (user_id);


-- ─── NOTA sobre acceso admin ─────────────────────────────────
-- Los recurrentes (income, receivable, payable) están en recurring_expenses.
-- La RLS existente (auth.uid() = user_id) aplica a todos los kind.
-- El super_admin NO puede ver datos de otros usuarios por defecto.
