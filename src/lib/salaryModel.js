function monthKey(value) {
  return String(value || '').slice(0, 7)
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
  const actual = (slips || []).find(item => salaryPeriodKey(item) === periodKey && item?.status !== 'estimated')
  if (actual) {
    return {
      amount: Number(actual.netAmount ?? actual.net_amount ?? 0),
      mode: 'actual',
      periodKey,
      cashMonthKey,
      slip: actual,
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
