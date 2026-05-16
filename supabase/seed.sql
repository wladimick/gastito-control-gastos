-- ============================================================
-- GASTITO — Seed Data
-- Datos iniciales globales (no dependen de user_id)
-- Pegar DESPUÉS de schema.sql
-- ============================================================

-- ─── Métodos de pago ────────────────────────────────────────
insert into payment_methods (id, label) values
  ('tarjeta',  'Tarjeta'),
  ('efectivo', 'Efectivo'),
  ('transfer', 'Transferencia')
on conflict (id) do nothing;


-- ─── Bancos ─────────────────────────────────────────────────
insert into banks (id, label) values
  ('bchile',    'Banco Chile'),
  ('bestado',   'Banco Estado'),
  ('santander', 'Santander'),
  ('bci',       'BCI'),
  ('itau',      'Itaú'),
  ('efectivo',  'Efectivo')
on conflict (id) do nothing;


-- ─── Categorías globales (user_id = null) ───────────────────
-- Estas categorías son visibles para todos los usuarios.
-- Los usuarios pueden añadir categorías propias pero no modificar estas.
insert into categories (id, user_id, label, icon, color, sort_order) values
  (gen_random_uuid(), null, 'Bencina',       '⛽', '#E07A5F', 1),
  (gen_random_uuid(), null, 'Supermercado',  '🛒', '#81B29A', 2),
  (gen_random_uuid(), null, 'Comida',        '🍽',  '#F2CC8F', 3),
  (gen_random_uuid(), null, 'Farmacia',      '💊', '#9B89B3', 4),
  (gen_random_uuid(), null, 'Transporte',    '🚇', '#6D9DC5', 5),
  (gen_random_uuid(), null, 'Suscripciones', '📺', '#C77DFF', 6),
  (gen_random_uuid(), null, 'Hogar',         '🏠', '#B07156', 7),
  (gen_random_uuid(), null, 'Otros',         '•',  '#888880', 8)
on conflict do nothing;
