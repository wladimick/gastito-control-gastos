-- ── savings_goals ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS savings_goals (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  target_amount  numeric     NOT NULL CHECK (target_amount > 0),
  current_amount numeric     NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date    date,
  status         text        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','completed','paused')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── savings_movements ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS savings_movements (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id    uuid        NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount     numeric     NOT NULL CHECK (amount > 0),
  type       text        NOT NULL CHECK (type IN ('deposit','withdrawal')),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id  ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_status   ON savings_goals(status);
CREATE INDEX IF NOT EXISTS idx_savings_mov_goal_id    ON savings_movements(goal_id);
CREATE INDEX IF NOT EXISTS idx_savings_mov_user_id    ON savings_movements(user_id);

-- ── Trigger updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_savings_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS savings_goals_updated_at ON savings_goals;
CREATE TRIGGER savings_goals_updated_at
  BEFORE UPDATE ON savings_goals
  FOR EACH ROW EXECUTE FUNCTION update_savings_goals_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE savings_goals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_movements ENABLE ROW LEVEL SECURITY;

-- savings_goals policies
DROP POLICY IF EXISTS "sg_select" ON savings_goals;
CREATE POLICY "sg_select" ON savings_goals FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sg_insert" ON savings_goals;
CREATE POLICY "sg_insert" ON savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sg_update" ON savings_goals;
CREATE POLICY "sg_update" ON savings_goals FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sg_delete" ON savings_goals;
CREATE POLICY "sg_delete" ON savings_goals FOR DELETE USING (auth.uid() = user_id);

-- savings_movements policies
DROP POLICY IF EXISTS "sm_select" ON savings_movements;
CREATE POLICY "sm_select" ON savings_movements FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sm_insert" ON savings_movements;
CREATE POLICY "sm_insert" ON savings_movements FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sm_delete" ON savings_movements;
CREATE POLICY "sm_delete" ON savings_movements FOR DELETE USING (auth.uid() = user_id);
