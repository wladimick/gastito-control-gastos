-- ─────────────────────────────────────────────────────────────────
-- GASTITO — banks-branding-projection.sql
-- Extiende la tabla banks con columnas de branding y activa RLS.
-- Idempotente: seguro ejecutar múltiples veces.
-- ─────────────────────────────────────────────────────────────────

-- 1. Agregar columnas (si no existen)
ALTER TABLE banks
  ADD COLUMN IF NOT EXISTS color      text,
  ADD COLUMN IF NOT EXISTS logo_url   text,
  ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer  DEFAULT 100;

-- 2. Colores por defecto para bancos chilenos principales
UPDATE banks SET color = '#00A650', sort_order =  1 WHERE id = 'falabella'   AND color IS NULL;
UPDATE banks SET color = '#003087', sort_order =  2 WHERE id = 'bchile'      AND color IS NULL;
UPDATE banks SET color = '#FF6B35', sort_order =  3 WHERE id = 'bestado'     AND color IS NULL;
UPDATE banks SET color = '#EC0000', sort_order =  4 WHERE id = 'santander'   AND color IS NULL;
UPDATE banks SET color = '#1E3C6E', sort_order =  5 WHERE id = 'bci'         AND color IS NULL;
UPDATE banks SET color = '#F4821F', sort_order =  6 WHERE id = 'itau'        AND color IS NULL;
UPDATE banks SET color = '#CF202E', sort_order =  7 WHERE id = 'scotiabank'  AND color IS NULL;
UPDATE banks SET color = '#0077C8', sort_order =  8 WHERE id = 'security'    AND color IS NULL;
UPDATE banks SET color = '#7B2D8B', sort_order =  9 WHERE id = 'ripley'      AND color IS NULL;
UPDATE banks SET color = '#E31837', sort_order = 10 WHERE id = 'consorcio'   AND color IS NULL;
UPDATE banks SET color = '#004A97', sort_order = 11 WHERE id = 'bice'        AND color IS NULL;
UPDATE banks SET color = '#00A650', sort_order = 12 WHERE id = 'fpay'        AND color IS NULL;
UPDATE banks SET color = '#1565C0', sort_order = 13 WHERE id = 'mach'        AND color IS NULL;
UPDATE banks SET color = '#6A1B9A', sort_order = 14 WHERE id = 'tenpo'       AND color IS NULL;
UPDATE banks SET color = '#009EE3', sort_order = 15 WHERE id = 'mercadopago' AND color IS NULL;
UPDATE banks SET color = '#2196F3', sort_order = 16 WHERE id = 'chek'        AND color IS NULL;
UPDATE banks SET color = '#43A047', sort_order = 17 WHERE id = 'global66'    AND color IS NULL;
UPDATE banks SET color = '#F57F17', sort_order = 18 WHERE id = 'tapp'        AND color IS NULL;
UPDATE banks SET color = '#546E7A', sort_order = 19 WHERE id = 'losheroes'   AND color IS NULL;
UPDATE banks SET color = '#0D47A1', sort_order = 20 WHERE id = 'khipu'       AND color IS NULL;
UPDATE banks SET color = '#37474F', sort_order = 21 WHERE id = 'internacional' AND color IS NULL;

-- 3. Activar RLS
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;

-- 4. Política: todos los usuarios autenticados pueden leer bancos activos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'banks' AND policyname = 'banks_read_authenticated'
  ) THEN
    CREATE POLICY banks_read_authenticated ON banks
      FOR SELECT TO authenticated
      USING (is_active = true OR is_active IS NULL);
  END IF;
END $$;

-- 5. Política: super_admin puede actualizar bancos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'banks' AND policyname = 'banks_update_super_admin'
  ) THEN
    CREATE POLICY banks_update_super_admin ON banks
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role = 'super_admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role = 'super_admin'
        )
      );
  END IF;
END $$;

-- Verificación
SELECT id, label, color, sort_order, is_active FROM banks ORDER BY sort_order, label;
