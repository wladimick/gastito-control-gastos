/**
 * Proyección financiera a N meses.
 * No hace llamadas a Supabase — trabaja con los datos ya cargados en App.
 */

export function buildMonthlyProjection({
  accounts             = [],
  installmentDebts     = [],
  recurringList        = [],
  incomeList           = [],
  expenses             = [],
  horizonMonths        = 6,
  withHistoricalAvg    = false,
  includeSavingsBalance = false,
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

  const monthlyRecurring = recurringList
    .filter(r => r.kind === 'expense' && r.active !== false)
    .reduce((s, r) => s + (r.amount || 0), 0)

  const avgCreditContado = withHistoricalAvg
    ? _avgCreditContado(expenses, today)
    : 0

  const activeDebts = installmentDebts.filter(d => d.status === 'active')

  let balance = includeSavingsBalance
    ? initialBalance + savingsBalance
    : initialBalance

  const months = []

  for (let i = 0; i < horizonMonths; i++) {
    const d   = new Date(today.getFullYear(), today.getMonth() + i + 1, 1)
    const y   = d.getFullYear()
    const m   = d.getMonth()
    const key = `${y}-${String(m + 1).padStart(2, '0')}`

    const byBank  = _monthInstallmentsByBank(activeDebts, key)
    const cuotas  = Object.values(byBank).reduce((s, v) => s + v, 0)
    const totalOut = monthlyRecurring + cuotas + avgCreditContado
    const net      = monthlyIncome - totalOut

    months.push({
      key, y, m,
      balanceStart:  balance,
      income:        monthlyIncome,
      installments:  cuotas,
      byBank,
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

// Returns installment amounts keyed by bankId for a given month
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
