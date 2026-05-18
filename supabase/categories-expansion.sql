-- ─────────────────────────────────────────────────────────────────
-- GASTITO — categories-expansion.sql
-- Expansión de categorías globales para gastos personales en Chile
-- Idempotente: seguro ejecutar múltiples veces
-- Requiere: schema.sql + seed.sql ejecutados previamente
-- ─────────────────────────────────────────────────────────────────

-- 1. Asegurar índice único parcial para categorías globales
--    (ya existe si se ejecutó income-receivables-categories.sql)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'categories_global_label_unique'
  ) THEN
    CREATE UNIQUE INDEX categories_global_label_unique
      ON categories (lower(label)) WHERE user_id IS NULL;
  END IF;
END $$;


-- 2. Insertar categorías globales (user_id = NULL por defecto)
--    ON CONFLICT DO NOTHING → no toca las existentes, no duplica
INSERT INTO categories (label, icon, color, sort_order) VALUES

  -- ── Alimentación ──────────────────────────────────────────────
  ('Supermercado',    '🛒', '#81B29A',  2),
  ('Comida',          '🍽',  '#F2CC8F',  3),
  ('Panadería',       '🥖', '#D4A574', 26),

  -- ── Movilidad ─────────────────────────────────────────────────
  ('Bencina',         '⛽', '#E07A5F',  1),
  ('Transporte',      '🚇', '#6D9DC5',  5),
  ('Vehículo',        '🚗', '#607D8B', 45),
  ('Estacionamiento', '🅿', '#9E9E9E', 46),
  ('TAG / Peajes',    '🛣', '#FF9800', 47),

  -- ── Hogar y suministros ───────────────────────────────────────
  ('Hogar',           '🏠', '#B07156',  7),
  ('Arriendo',        '🏡', '#8BC34A', 19),
  ('Dividendo',       '🏦', '#3F51B5', 48),
  ('Internet',        '📡', '#00BCD4', 49),
  ('Luz',             '💡', '#FFC107', 50),
  ('Agua',            '💧', '#03A9F4', 51),
  ('Gas',             '🔥', '#FF5722', 52),
  ('Aseo / Limpieza', '🧹', '#4DD0E1', 53),

  -- ── Salud ─────────────────────────────────────────────────────
  ('Farmacia',        '💊', '#9B89B3',  4),
  ('Salud',           '🩺', '#00BCD4', 15),

  -- ── Ropa y estilo ─────────────────────────────────────────────
  ('Ropa',            '👕', '#9C27B0', 54),

  -- ── Entretenimiento y social ──────────────────────────────────
  ('Suscripciones',   '📺', '#C77DFF',  6),
  ('Salidas',         '🎉', '#9B59B6', 55),
  ('Regalos',         '🎁', '#E91E63', 56),

  -- ── Familia y personas ────────────────────────────────────────
  ('Familia',         '👨‍👩‍👧', '#2196F3', 13),
  ('Mascotas',        '🐾', '#795548', 57),

  -- ── Educación ─────────────────────────────────────────────────
  ('Educación',       '📚', '#3F51B5', 17),

  -- ── Servicios y finanzas ──────────────────────────────────────
  ('Servicios',       '⚡', '#FF5722', 18),
  ('Préstamos',       '🤝', '#F39C12', 58),
  ('Transferencias',  '💱', '#607D8B', 59),
  ('Deuda',           '📋', '#F44336', 20),
  ('Por cobrar',      '💵', '#4CAF50', 21),
  ('Por pagar',       '💸', '#FF9800', 22),
  ('Ahorro',          '🐷', '#81B29A', 11),
  ('Caja chica',      '💴', '#4CAF50', 60),

  -- ── Varios ────────────────────────────────────────────────────
  ('Imprevistos',     '⚠',  '#9E9E9E', 24),
  ('Otros',           '•',  '#888880',  8)

ON CONFLICT DO NOTHING;
