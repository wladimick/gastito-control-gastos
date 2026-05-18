-- ─────────────────────────────────────────────────────────────────
-- GASTITO — installments-backfill.sql
-- Crea registros en installments para gastos con installments_count >= 2
-- que no tienen un registro asociado.
-- Idempotente: usa NOT EXISTS para no duplicar.
-- Ejecutar como superusuario desde el SQL editor de Supabase.
-- ─────────────────────────────────────────────────────────────────

INSERT INTO installments (
  user_id,
  name,
  total_amount,
  installment_amount,
  total_installments,
  paid_installments,
  due_day,
  start_date,
  auto_pay,
  bank_id,
  category_id
)
SELECT DISTINCT ON (e.user_id, e.description, e.amount, e.installments_count)
  e.user_id,
  e.description,
  e.amount,
  -- monthly_amount redondeado
  ROUND(e.amount::numeric / e.installments_count)::integer,
  e.installments_count,
  0,                         -- paid_installments = 0 (no se sabe cuántas se pagaron)
  5,                         -- due_day = día 5 (valor por defecto)
  -- start_date: mes siguiente al gasto en hora Chile (fallback simple)
  (DATE_TRUNC('month',
    e.expense_date AT TIME ZONE 'America/Santiago'
  ) + INTERVAL '1 month')::date,
  false,
  e.bank_id,
  e.category_id
FROM expenses e
WHERE
  e.installments_count >= 2
  AND NOT EXISTS (
    SELECT 1
    FROM installments i
    WHERE i.user_id         = e.user_id
      AND i.name            = e.description
      AND i.total_amount    = e.amount
      AND i.total_installments = e.installments_count
  );

-- Verificación: muestra cuántos registros quedaron pendientes (debe ser 0)
SELECT COUNT(*)  AS pendientes_sin_cuota
FROM expenses e
WHERE e.installments_count >= 2
  AND NOT EXISTS (
    SELECT 1 FROM installments i
    WHERE i.user_id            = e.user_id
      AND i.name               = e.description
      AND i.total_amount       = e.amount
      AND i.total_installments = e.installments_count
  );
