/**
 * Proyección financiera a N meses.
 * Calcula el flujo mensual a partir de ingresos, cuotas, recurrentes y saldo inicial.
 * No hace llamadas a Supabase — trabaja con los datos ya cargados en App.
 */

/**
 * @param {Object} opts
 * @param {Array}  opts.accounts         - cuentas (con type, active, balance)
 * @param {Array}  opts.installmentDebts - deudas en cuotas (con startMonth, installments, paid, monthlyAmount)
 * @param {Array}  opts.recurringList    - gastos recurrentes (con kind, active, amount)
 * @param {Array}  opts.incomeList       - ingresos recurrentes (con active, amount)
 * @param {Array}  opts.expenses         - historial de gastos (para calcular promedio crédito contado)
 * @param {number} opts.horizonMonths    - número de meses a proyectar (6 o 12)
 * @param {boolean} opts.withHistoricalAvg - incluir promedio histórico de crédito contado
 */
export function buildMonthlyProjection({
  accounts        = [],
  installmentDebts = [],
  recurringList   = [],
  incomeList      = [],
  expenses        = [],
  horizonMonths   = 6,
  withHistoricalAvg = false,
} = {}) {
  const today = new Date()

  // Saldo inicial: cuentas activas no-ahorro
  const initialBalance = accounts
    .filter(a => a.active && a.type !== 'ahorro')
    .reduce((s, a) => s + (a.balance || 0), 0)

  const savingsBalance = accounts
    .filter(a => a.active && a.type === 'ahorro')
    .reduce((s, a) => s + (a.balance || 0), 0)

  // Ingresos mensuales fijos (sueldo u otros ingresos recurrentes activos)
  const monthlyIncome = incomeList
    .filter(r => r.active !== false)
    .reduce((s, r) => s + (r.amount || 0), 0)

  // Gastos recurrentes mensuales activos
  const monthlyRecurring = recurringList
    .filter(r => r.kind === 'expense' && r.active !== false)
    .reduce((s, r) => s + (r.amount || 0), 0)

  // Promedio mensual de crédito contado (últimos 3 meses) — solo si escenario lo pide
  const avgCreditContado = withHistoricalAvg
    ? _avgCreditContado(expenses, today)
    : 0

  const activeDebts = installmentDebts.filter(d => d.status === 'active')

  let balance = initialBalance
  const months = []

  for (let i = 0; i < horizonMonths; i++) {
    const d  = new Date(today.getFullYear(), today.getMonth() + i + 1, 1)
    const y  = d.getFullYear()
    const m  = d.getMonth()
    const key = `${y}-${String(m + 1).padStart(2, '0')}`

    const cuotas   = _monthInstallments(activeDebts, key)
    const totalOut = monthlyRecurring + cuotas + avgCreditContado
    const net      = monthlyIncome - totalOut

    months.push({
      key,
      y,
      m,
      balanceStart:  balance,
      income:        monthlyIncome,
      installments:  cuotas,
      recurring:     monthlyRecurring,
      creditContado: avgCreditContado,
      totalOut,
      net,
      balanceEnd:    balance + net,
    })

    balance += net
  }

  const totalCommitted = months.reduce((s, mo) => s + mo.totalOut, 0)
  const heaviestMonth  = months.reduce(
    (a, b) => b.totalOut > a.totalOut ? b : a,
    months[0] ?? { totalOut: 0, key: '' }
  )
  const totalNet = months.reduce((s, mo) => s + mo.net, 0)

  return {
    months,
    initialBalance,
    savingsBalance,
    monthlyIncome,
    monthlyRecurring,
    totalCommitted,
    heaviestMonth,
    finalBalance: balance,
    totalNet,
  }
}

// Cuotas que corresponden al mes indicado (monthKey = 'YYYY-MM')
function _monthInstallments(activeDebts, monthKey) {
  return activeDebts.reduce((s, d) => {
    if (!d.startMonth) return s
    const [sy, sm] = d.startMonth.split('-').map(Number)
    const [ey, em] = monthKey.split('-').map(Number)
    const elapsed  = (ey - sy) * 12 + (em - sm)
    return elapsed >= 0 && elapsed < d.installments
      ? s + (d.monthlyAmount || 0)
      : s
  }, 0)
}

// Promedio mensual de compras con tarjeta de crédito contado (últimos 3 meses)
function _avgCreditContado(expenses, today) {
  let total = 0, count = 0
  for (let i = 1; i <= 3; i++) {
    const d   = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const y   = d.getFullYear()
    const m   = d.getMonth()
    const amt = expenses
      .filter(e => {
        const ed = new Date(e.date)
        return ed.getMonth() === m && ed.getFullYear() === y &&
               e.type === 'credito' && (e.installments ?? 1) <= 1
      })
      .reduce((s, e) => s + (e.amount || 0), 0)
    if (amt > 0) { total += amt; count++ }
  }
  return count > 0 ? Math.round(total / count) : 0
}
