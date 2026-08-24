function monthKey(value) {
  return String(value || '').slice(0, 7)
}

function actualPaymentDate(item) {
  return item?.actualPaymentDate || item?.actual_payment_date || ''
}

export function addSalaryMonths(key, offset) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return ''
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function salaryPeriodKey(slip) {
  return monthKey(slip?.periodMonth || slip?.period_month)
}

export function salaryCashMonthKey(slip) {
  const paid = actualPaymentDate(slip)
  if (paid) return monthKey(paid)
  return monthKey(slip?.scheduledPaymentDate || slip?.scheduled_payment_date)
    || addSalaryMonths(salaryPeriodKey(slip), 1)
}

export function salaryForecast(slips = [], targetPeriodKey = '', count = 3) {
  const actual = (slips || [])
    .filter(item => item?.status !== 'estimated')
    .filter(item => Number(item?.netAmount ?? item?.net_amount ?? 0) > 0)
    .filter(item => !targetPeriodKey || salaryPeriodKey(item) <= targetPeriodKey)
    .sort((a, b) => salaryPeriodKey(b).localeCompare(salaryPeriodKey(a)))
    .slice(0, count)

  if (!actual.length) return { amount: 0, sourceCount: 0, sourceMonths: [] }
  const amount = Math.round(actual.reduce((sum, item) => sum + Number(item.netAmount ?? item.net_amount ?? 0), 0) / actual.length)
  return { amount, sourceCount: actual.length, sourceMonths: actual.map(salaryPeriodKey) }
}

export function salaryForCashMonth(slips = [], cashMonthKey = '') {
  const periodKey = addSalaryMonths(cashMonthKey, -1)

  const paidActual = (slips || []).find(item =>
    item?.status !== 'estimated'
    && actualPaymentDate(item)
    && salaryCashMonthKey(item) === cashMonthKey
  )

  if (paidActual) {
    const paidPeriodKey = salaryPeriodKey(paidActual)
    return {
      amount: Number(paidActual.netAmount ?? paidActual.net_amount ?? 0),
      mode: 'actual',
      periodKey: paidPeriodKey,
      cashMonthKey,
      slip: paidActual,
      sourceCount: 1,
      sourceMonths: [paidPeriodKey],
    }
  }

  const periodSlip = (slips || []).find(item =>
    salaryPeriodKey(item) === periodKey && item?.status !== 'estimated'
  )

  if (periodSlip) {
    if (actualPaymentDate(periodSlip)) {
      return {
        amount: 0,
        mode: 'no_payment',
        periodKey,
        cashMonthKey,
        slip: periodSlip,
        sourceCount: 0,
        sourceMonths: [],
      }
    }

    return {
      amount: Number(periodSlip.netAmount ?? periodSlip.net_amount ?? 0),
      mode: 'actual',
      periodKey,
      cashMonthKey,
      slip: periodSlip,
      sourceCount: 1,
      sourceMonths: [periodKey],
    }
  }

  const forecast = salaryForecast(slips, periodKey, 3)
  return {
    amount: forecast.amount,
    mode: forecast.amount > 0 ? 'estimated' : 'missing',
    periodKey,
    cashMonthKey,
    slip: null,
    sourceCount: forecast.sourceCount,
    sourceMonths: forecast.sourceMonths,
  }
}

export function salaryStats(slips = []) {
  const actual = (slips || [])
    .filter(item => item?.status !== 'estimated')
    .filter(item => Number(item?.netAmount ?? item?.net_amount ?? 0) > 0)
    .sort((a, b) => salaryPeriodKey(a).localeCompare(salaryPeriodKey(b)))
  const amounts = actual.map(item => Number(item.netAmount ?? item.net_amount ?? 0))
  const average = amounts.length ? Math.round(amounts.reduce((sum, value) => sum + value, 0) / amounts.length) : 0
  return {
    count: actual.length,
    average,
    minimum: amounts.length ? Math.min(...amounts) : 0,
    maximum: amounts.length ? Math.max(...amounts) : 0,
    latest: actual[actual.length - 1] || null,
  }
}


export function salaryContributionStats(slips = []) {
  const actual = (slips || [])
    .filter(item => item?.status !== 'estimated')
    .filter(item => Number(item?.pensionHealthBase ?? item?.pension_health_base ?? item?.grossAmount ?? item?.gross_amount ?? 0) > 0)

  return actual.reduce((acc, item) => {
    const pensionBase = Number(item?.pensionHealthBase ?? item?.pension_health_base ?? item?.grossAmount ?? item?.gross_amount ?? 0)
    const unemploymentBase = Number(item?.unemploymentBase ?? item?.unemployment_base ?? pensionBase)
    const pensionDeduction = Number(item?.pensionAmount ?? item?.pension_amount ?? 0)
    const health = Number(item?.healthAmount ?? item?.health_amount ?? 0)
    const afcWorker = Number(item?.unemploymentAmount ?? item?.unemployment_amount ?? 0)

    const afpWorkerSavings = Math.round(pensionBase * 0.10)
    const afpCommission = Math.max(pensionDeduction - afpWorkerSavings, 0)
    const afcEmployerCic = Math.round(unemploymentBase * 0.016)
    const afcEmployerFcs = Math.round(unemploymentBase * 0.008)

    acc.months += 1
    acc.pensionBase += pensionBase
    acc.afpDeducted += pensionDeduction
    acc.afpWorkerSavings += afpWorkerSavings
    acc.afpCommission += afpCommission
    acc.health += health
    acc.afcWorker += afcWorker
    acc.afcEmployerCic += afcEmployerCic
    acc.afcExpectedCic += afcWorker + afcEmployerCic
    acc.afcEmployerFcs += afcEmployerFcs
    return acc
  }, {
    months: 0,
    pensionBase: 0,
    afpDeducted: 0,
    afpWorkerSavings: 0,
    afpCommission: 0,
    health: 0,
    afcWorker: 0,
    afcEmployerCic: 0,
    afcExpectedCic: 0,
    afcEmployerFcs: 0,
  })
}
