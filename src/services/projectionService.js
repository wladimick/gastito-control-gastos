/**
 * Proyección financiera a N meses.
 * No hace llamadas a Supabase — trabaja con los datos ya cargados en App.
 */

export function buildMonthlyProjection({
  accounts              = [],
  installmentDebts      = [],
  recurringList         = [],
  incomeList            = [],
  expenses              = [],
  horizonMonths         = 6,
  withHistoricalAvg     = false,   // legacy: promedio crédito contado
  includeSavingsBalance = false,
  varExpensesAmount     = 0,       // gasto variable manual mensual
  useHistoricalVar      = false,   // calcula promedio histórico de gastos variables
  contadoCMR            = 0,       // pago contado CMR mensual (tarjeta crédito, no cuotas)
} = {}) {
  const today = new Date()

  const initialBalance = accounts
    .filter(a => a.active && a.type !== 'ahorro')
    .reduce((s, a) => s + (a.balance || 0), 0)

  const savingsBalance = accounts
    .filter(a => a.active && a.type === 'ahorro')
    .reduce((s, a) => s + (a.balance || 0), 0)

  const monthlyIncome = incomeList
    .filter(r => r.active !== false)
    .reduce((s, r) => s + (r.amount || 0), 0)

  // Excluye recurrentes pagados con tarjeta de crédito (ya incluidos en contado CMR)
  // y comisiones bancarias (solo referencia visual, nunca suma al egreso)
  const monthlyRecurring = recurringList
    .filter(r => r.kind === 'expense' && r.active !== false && r.type !== 'credito' && !r.comisionBancaria)
    .reduce((s, r) => s + (r.amount || 0), 0)

  // Legacy: promedio de crédito contado (no cuotas)
  const avgCreditContado = withHistoricalAvg
    ? _avgCreditContado(expenses, today)
    : 0

  // CMR efectivo: usa el explícito si se pasó, si no cae al promedio histórico
  const effectiveCMR = contadoCMR > 0 ? contadoCMR : avgCreditContado

  // Nuevo: promedio de todos los gastos variables (excluye cuotas)
  const monthlyVar = useHistoricalVar
    ? _avgVarExpenses(expenses, today)
    : Math.round(Number(varExpensesAmount) || 0)

  const activeDebts = installmentDebts.filter(d => d.status === 'active')

  let balance          = includeSavingsBalance ? initialBalance + savingsBalance : initialBalance
  let balanceCommitted = balance  // tracks balance without variable expenses

  const months = []

  for (let i = 0; i < horizonMonths; i++) {
    const d   = new Date(today.getFullYear(), today.getMonth() + i + 1, 1)
    const y   = d.getFullYear()
    const m   = d.getMonth()
    const key = `${y}-${String(m + 1).padStart(2, '0')}`

    const byBank             = _monthInstallmentsByBank(activeDebts, key)
    const cuotas             = Object.values(byBank).reduce((s, v) => s + v, 0)
    const totalOutCommitted  = monthlyRecurring + cuotas + effectiveCMR
    const totalOut           = totalOutCommitted + monthlyVar
    const netCommitted       = monthlyIncome - totalOutCommitted
    const net                = monthlyIncome - totalOut

    months.push({
      key, y, m,
      balanceStart:        balance,
      income:              monthlyIncome,
      installments:        cuotas,
      byBank,
      recurring:           monthlyRecurring,
      creditContado:       effectiveCMR,
      contadoCMR:          effectiveCMR,
      varExpenses:         monthlyVar,
      totalOutCommitted,
      totalOut,
      netCommitted,
      net,
      balanceEndCommitted: balanceCommitted + netCommitted,
      balanceEnd:          balance + net,
    })

    balance          += net
    balanceCommitted += netCommitted
  }

  const totalCommitted = months.reduce((s, mo) => s + mo.totalOutCommitted, 0)
  const heaviestMonth  = months.reduce(
    (a, b) => b.totalOut > a.totalOut ? b : a,
    months[0] ?? { totalOut: 0, key: '' }
  )
  const totalNet          = months.reduce((s, mo) => s + mo.net, 0)
  const totalNetCommitted = months.reduce((s, mo) => s + mo.netCommitted, 0)

  return {
    months,
    initialBalance,
    savingsBalance,
    monthlyIncome,
    monthlyRecurring,
    monthlyCMR:            effectiveCMR,
    monthlyVarExpenses:   monthlyVar,
    totalCommitted,
    heaviestMonth,
    finalBalance:          balance,
    finalBalanceCommitted: balanceCommitted,
    totalNet,
    totalNetCommitted,
  }
}

// Installment amounts keyed by bankId for a given month
function _monthInstallmentsByBank(activeDebts, monthKey) {
  const byBank = {}
  for (const d of activeDebts) {
    if (!d.startMonth) continue
    const [sy, sm] = d.startMonth.split('-').map(Number)
    const [ey, em] = monthKey.split('-').map(Number)
    const elapsed  = (ey - sy) * 12 + (em - sm)
    if (elapsed >= 0 && elapsed < d.installments) {
      const bid = d.bank || '__otros__'
      byBank[bid] = (byBank[bid] || 0) + (d.monthlyAmount || 0)
    }
  }
  return byBank
}

// Promedio de compras contado con tarjeta de crédito (últimos 3 meses) — legacy
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

// Promedio de todos los gastos variables (excluye cuotas) — últimos 3 meses
function _avgVarExpenses(expenses, today) {
  let total = 0, count = 0
  for (let i = 1; i <= 3; i++) {
    const d   = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const y   = d.getFullYear()
    const m   = d.getMonth()
    const amt = expenses
      .filter(e => {
        const ed = new Date(e.date)
        return ed.getMonth() === m && ed.getFullYear() === y &&
               (e.installments ?? 1) <= 1
      })
      .reduce((s, e) => s + (e.amount || 0), 0)
    if (amt > 0) { total += amt; count++ }
  }
  return count > 0 ? Math.round(total / count) : 0
}
