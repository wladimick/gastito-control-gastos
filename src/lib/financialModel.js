import { addSalaryMonths, salaryForCashMonth } from './salaryModel.js'

export function isSalaryIncome(item) {
  const text = `${item?.name || ''} ${item?.notes || ''}`.toLowerCase()
  return text.includes('sueldo') || text.includes('liquidación') || text.includes('liquidacion')
}

export function isReservePayable(item) {
  const text = `${item?.name || ''} ${item?.personName || item?.person_name || ''} ${item?.notes || ''}`.toLowerCase()
  return text.includes('reserva') || text.includes('papá') || text.includes('papa')
}

export function isMercadoPagoAccount(item) {
  const text = `${item?.name || ''} ${item?.bankId || item?.bank_id || ''}`.toLowerCase()
  return text.includes('mercado pago') || text.includes('mercadopago')
}

export function salaryIncomeRows(slips = [], firstCashMonth = '', horizonMonths = 12, dayOfMonth = 5) {
  if (!firstCashMonth) return []
  return Array.from({ length: Math.max(1, horizonMonths) }, (_, index) => {
    const cashMonthKey = addSalaryMonths(firstCashMonth, index)
    const salary = salaryForCashMonth(slips, cashMonthKey)
    if (!salary.amount) return null
    return {
      id: `salary:${cashMonthKey}`,
      kind: 'income',
      name: salary.mode === 'actual'
        ? `Sueldo real · ${salary.periodKey}`
        : `Sueldo estimado · ${salary.periodKey}`,
      amount: salary.amount,
      dayOfMonth,
      active: true,
      autoRegister: false,
      startDate: `${cashMonthKey}-01`,
      endDate: `${cashMonthKey}-28`,
      salaryMode: salary.mode,
      salaryPeriodKey: salary.periodKey,
      salarySourceMonths: salary.sourceMonths,
      notes: salary.mode === 'actual'
        ? 'Líquido real tomado desde la liquidación de sueldo.'
        : `Estimación móvil basada en ${salary.sourceCount} liquidaciones reales.`,
    }
  }).filter(Boolean)
}

export function withVariableSalary(incomeList = [], slips = [], firstCashMonth = '', horizonMonths = 12, dayOfMonth = 5) {
  if (!slips.length) return incomeList
  const otherIncome = (incomeList || []).filter(item => !isSalaryIncome(item))
  return [...otherIncome, ...salaryIncomeRows(slips, firstCashMonth, horizonMonths, dayOfMonth)]
}

export function withMercadoPagoFreeBalance(accounts = [], mpStatus = null) {
  if (mpStatus?.last_balance == null) return accounts
  const free = Number(mpStatus.last_balance || 0)
  return (accounts || []).map(account => isMercadoPagoAccount(account)
    ? { ...account, balance: free, auditedBalanceSource: 'mercadopago_available' }
    : account)
}

export function coverReservePayables(payables = [], reserveAmount = 0) {
  let remainingCoverage = Math.max(0, Number(reserveAmount || 0))
  return (payables || []).map(item => {
    if (item.status === 'paid' || !isReservePayable(item) || remainingCoverage <= 0) return item
    const amount = Math.max(0, Number(item.amount || 0))
    const covered = Math.min(amount, remainingCoverage)
    remainingCoverage -= covered
    return {
      ...item,
      amount: amount - covered,
      reserveCoveredAmount: covered,
      reserveFunded: covered > 0,
    }
  }).filter(item => item.status === 'paid' || Number(item.amount || 0) > 0)
}

export function dashboardReservePayables(payables = [], mpStatus = null) {
  if (mpStatus?.reserved_partition_balance == null) return payables
  const reserve = Number(mpStatus.reserved_partition_balance || 0)
  const labels = (payables || [])
    .filter(item => item.status !== 'paid' && isReservePayable(item))
    .map(item => item.personName || item.person_name || item.name)
    .filter(Boolean)
  const withoutReserveLiabilities = (payables || []).map(item =>
    item.status !== 'paid' && isReservePayable(item) ? { ...item, status: 'paid' } : item)
  return [
    ...withoutReserveLiabilities,
    {
      id: 'dashboard:mercadopago-reserve',
      kind: 'payable',
      name: 'Reserva Mercado Pago',
      personName: labels.join(', ') || 'Reserva',
      amount: reserve,
      status: 'pending',
      active: true,
      notes: 'Reserva sincronizada en Mercado Pago. No es dinero libre.',
    },
  ]
}
