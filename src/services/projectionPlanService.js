const DAY_MS = 86400000

export function dateOnly(value) {
  return value ? String(value).slice(0, 10) : ''
}

export function currentMonthKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'America/Santiago',
  }).formatToParts(now)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  return year && month ? `${year}-${month}` : now.toISOString().slice(0, 7)
}

export function addMonthsKey(key, offset) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return ''
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key, short = false) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return key || 'Sin mes'
  const text = new Intl.DateTimeFormat('es-CL', {
    month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function chileParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Santiago',
  }).formatToParts(now)
  return {
    year: Number(parts.find(part => part.type === 'year')?.value),
    month: Number(parts.find(part => part.type === 'month')?.value),
    day: Number(parts.find(part => part.type === 'day')?.value),
  }
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(value) {
  return new Set(normalizeText(value).split(' ').filter(token => token.length > 2))
}

function textSimilarity(left, right) {
  const a = tokens(left)
  const b = tokens(right)
  if (!a.size || !b.size) return 0
  const shared = [...a].filter(token => b.has(token)).length
  return shared / Math.max(a.size, b.size)
}

function isActiveInMonth(item, key) {
  if (item?.active === false) return false
  if (item?.startDate && String(item.startDate).slice(0, 7) > key) return false
  if (item?.endDate && String(item.endDate).slice(0, 7) < key) return false
  return true
}

function isRecurringMatch(expense, recurringItems) {
  return (recurringItems || []).some(item => {
    if (item.active === false || item.kind !== 'expense') return false
    const similarity = textSimilarity(expense.description, item.name)
    if (similarity < 0.45) return false
    const reference = Math.max(1, Number(item.amount || 0))
    return Math.abs(Number(expense.amount || 0) - reference) <= Math.max(5000, reference * 0.35)
  })
}

function historicalVariableAverages(expenses, recurringItems, now) {
  const current = currentMonthKey(now)
  const monthKeys = [1, 2, 3].map(offset => addMonthsKey(current, -offset))
  const byMonth = new Map(monthKeys.map(key => [key, { credit: 0, direct: 0, count: 0 }]))

  ;(expenses || []).forEach(expense => {
    const key = dateOnly(expense.date).slice(0, 7)
    if (!byMonth.has(key)) return
    if (Number(expense.amount || 0) <= 0) return
    if (expense.status === 'pendiente') return
    if (Number(expense.installmentTotal || expense.installments || 1) > 1) return
    if (expense.movementType === 'installment') return
    if (['commission', 'tax', 'interest', 'payment', 'credit'].includes(expense.movementType)) return
    if (isRecurringMatch(expense, recurringItems)) return

    const bucket = byMonth.get(key)
    if (expense.type === 'credito') bucket.credit += Number(expense.amount || 0)
    else bucket.direct += Number(expense.amount || 0)
    bucket.count += 1
  })

  const usable = [...byMonth.entries()].filter(([, value]) => value.count > 0)
  const divisor = Math.max(1, usable.length)
  return {
    credit: Math.round(usable.reduce((sum, [, value]) => sum + value.credit, 0) / divisor),
    direct: Math.round(usable.reduce((sum, [, value]) => sum + value.direct, 0) / divisor),
    monthsUsed: usable.map(([key]) => key),
  }
}

function cycleExpenseTotal(cycle) {
  return (cycle.transactions || [])
    .filter(item => item.affectsCycleTotal)
    .filter(item => !item.isPending)
    .filter(item => Number(item.amount || 0) > 0)
    .filter(item => !['payment', 'credit'].includes(item.movementType))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
}

function cycleAmount(cycle) {
  const reported = Number(cycle.reportedAmount || 0)
  const estimated = Number(cycle.estimatedAmount || 0)
  const calculated = cycleExpenseTotal(cycle)
  if (cycle.reportedAmountIsFinal && reported > 0) return reported
  return Math.max(reported, estimated, calculated)
}

function cyclesByDueMonth(cycles) {
  const map = new Map()
  ;(cycles || []).forEach(cycle => {
    if (cycle.status === 'paid') return
    const key = dateOnly(cycle.dueDate).slice(0, 7) || cycle.cycleKey
    if (!key) return
    const detail = {
      id: cycle.id,
      cardId: cycle.cardId,
      dueDate: cycle.dueDate,
      status: cycle.status,
      reconciliationStatus: cycle.reconciliationStatus,
      amount: cycleAmount(cycle),
      final: Boolean(cycle.reportedAmountIsFinal),
      cycleKey: cycle.cycleKey,
    }
    const current = map.get(key) || []
    current.push(detail)
    map.set(key, current)
  })
  return map
}

function installmentOccurrencesByMonth(plans) {
  const map = new Map()
  ;(plans || []).forEach(plan => {
    ;(plan.occurrences || []).forEach(occurrence => {
      if (!occurrence.monthKey || Number(occurrence.amount || 0) <= 0) return
      const current = map.get(occurrence.monthKey) || []
      current.push({
        id: occurrence.id,
        description: occurrence.description || plan.description,
        amount: Number(occurrence.amount || plan.monthlyAmount || 0),
        installmentCurrent: occurrence.installmentCurrent,
        installmentTotal: occurrence.installmentTotal,
        bankLabel: occurrence.cardLabel || occurrence.bankLabel || plan.cardLabel || plan.bank,
        projected: Boolean(occurrence.projected),
        sharedWithNicol: Boolean(occurrence.sharedWithNicol || plan.sharedWithNicol),
      })
      map.set(occurrence.monthKey, current)
    })
  })
  return map
}

function scheduleOneOff(items, firstKey, horizonKeys, include) {
  const map = new Map()
  if (!include) return map
  ;(items || []).filter(item => item.status !== 'paid').forEach(item => {
    const dueKey = dateOnly(item.dueDate).slice(0, 7)
    const target = dueKey && dueKey >= firstKey && horizonKeys.includes(dueKey) ? dueKey : firstKey
    const current = map.get(target) || []
    current.push(item)
    map.set(target, current)
  })
  return map
}

function simulationRowsForMonth(simulations, key) {
  return (simulations || []).filter(item => item.active !== false).map(item => {
    const start = dateOnly(item.date).slice(0, 7)
    if (!start) return null
    const installments = Math.max(1, Number(item.installments || 1))
    const [sy, sm] = start.split('-').map(Number)
    const [ky, km] = key.split('-').map(Number)
    const elapsed = (ky - sy) * 12 + (km - sm)
    if (elapsed < 0 || elapsed >= installments) return null
    return {
      ...item,
      amountThisMonth: installments > 1
        ? Math.round(Number(item.amount || 0) / installments)
        : Number(item.amount || 0),
      installmentCurrent: elapsed + 1,
      installmentTotal: installments,
    }
  }).filter(Boolean)
}

function riskFor(balance, income) {
  if (balance < 0) return 'danger'
  if (balance < Math.max(100000, income * 0.1)) return 'warning'
  return 'healthy'
}

export function buildProjectionPlan({
  accounts = [],
  recurringList = [],
  incomeList = [],
  receivables = [],
  payables = [],
  installmentDebts = [],
  expenses = [],
  billingCycles = [],
  simulations = [],
  scenario = 'realistic',
  includeSavings = false,
  includeReceivables = false,
  includePayables = true,
  variableOverride = null,
  horizonMonths = 6,
  now = new Date(),
} = {}) {
  const firstKey = currentMonthKey(now)
  const monthKeys = Array.from({ length: horizonMonths }, (_, index) => addMonthsKey(firstKey, index))
  const today = chileParts(now)
  const activeAccounts = (accounts || []).filter(account => account.active)
  const operatingBalance = activeAccounts
    .filter(account => account.type !== 'ahorro')
    .reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const savingsBalance = activeAccounts
    .filter(account => account.type === 'ahorro')
    .reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const startBalance = operatingBalance + (includeSavings ? savingsBalance : 0)

  const variableAverages = historicalVariableAverages(expenses, recurringList, now)
  const variableTotalAuto = variableAverages.credit + variableAverages.direct
  const variableTotal = variableOverride == null ? variableTotalAuto : Math.max(0, Number(variableOverride || 0))
  const autoRatio = variableTotalAuto > 0 ? variableAverages.credit / variableTotalAuto : 0.5
  const variableCredit = Math.round(variableTotal * autoRatio)
  const variableDirect = variableTotal - variableCredit

  const cycleMap = cyclesByDueMonth(billingCycles)
  const occurrenceMap = installmentOccurrencesByMonth(installmentDebts)
  const receivablesToInclude = (receivables || []).filter(item => item.reimbursement || includeReceivables)
  const receivableMap = scheduleOneOff(receivablesToInclude, firstKey, monthKeys, true)
  const payableMap = scheduleOneOff(payables, firstKey, monthKeys, includePayables)

  let balance = startBalance
  const months = monthKeys.map((key, index) => {
    const isCurrent = index === 0
    const daysInMonth = new Date(today.year, today.month, 0).getDate()
    const remainingRatio = isCurrent ? Math.max(0, daysInMonth - today.day + 1) / daysInMonth : 1

    const incomeDetail = (incomeList || []).filter(item => {
      if (!isActiveInMonth(item, key)) return false
      if (!isCurrent) return true
      return Number(item.dayOfMonth || 1) >= today.day
    })
    const income = incomeDetail.reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const directRecurringDetail = (recurringList || []).filter(item => {
      if (item.kind !== 'expense' || !isActiveInMonth(item, key)) return false
      if (item.comisionBancaria || item.type === 'credito') return false
      if (!isCurrent) return true
      return Number(item.dayOfMonth || 1) >= today.day
    })
    const directRecurring = directRecurringDetail.reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const creditRecurringDetail = (recurringList || []).filter(item =>
      item.kind === 'expense' && isActiveInMonth(item, key) && (item.type === 'credito' || item.comisionBancaria)
    )
    const creditRecurring = creditRecurringDetail.reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const knownCycles = cycleMap.get(key) || []
    const knownCardAmount = knownCycles.reduce((sum, item) => sum + item.amount, 0)
    const installmentDetail = occurrenceMap.get(key) || []
    const installmentAmount = installmentDetail.reduce((sum, item) => sum + item.amount, 0)
    const hasKnownBill = knownCycles.length > 0
    const useVariable = scenario !== 'committed'
    const estimatedCreditVariable = useVariable ? Math.round(variableCredit * remainingRatio) : 0
    const cardAmount = hasKnownBill
      ? knownCardAmount
      : installmentAmount + creditRecurring + estimatedCreditVariable

    const estimatedDirectVariable = useVariable ? Math.round(variableDirect * remainingRatio) : 0
    const receivableDetail = receivableMap.get(key) || []
    const receivableAmount = receivableDetail.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const payableDetail = payableMap.get(key) || []
    const payableAmount = payableDetail.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const simulationDetail = scenario === 'simulated' ? simulationRowsForMonth(simulations, key) : []
    const simulationAmount = simulationDetail.reduce((sum, item) => sum + item.amountThisMonth, 0)

    const outflow = directRecurring + cardAmount + estimatedDirectVariable + payableAmount + simulationAmount
    const net = income + receivableAmount - outflow
    const openingBalance = balance
    balance += net

    const cardConfidence = hasKnownBill
      ? knownCycles.every(item => item.final) ? 'confirmed' : 'in_progress'
      : 'projected'

    return {
      key,
      label: monthLabel(key),
      openingBalance,
      income,
      incomeDetail,
      receivableAmount,
      receivableDetail,
      directRecurring,
      directRecurringDetail,
      creditRecurring,
      creditRecurringDetail,
      cardAmount,
      knownCardAmount,
      knownCycles,
      installmentAmount,
      installmentDetail,
      estimatedCreditVariable,
      estimatedDirectVariable,
      payableAmount,
      payableDetail,
      simulationAmount,
      simulationDetail,
      outflow,
      net,
      closingBalance: balance,
      cardConfidence,
      risk: riskFor(balance, income),
      isCurrent,
    }
  })

  const lowestMonth = months.reduce((lowest, month) =>
    !lowest || month.closingBalance < lowest.closingBalance ? month : lowest
  , null)
  const firstMonth = months[0] || null
  const overdueReceivables = (receivables || []).filter(item =>
    !item.reimbursement
      && item.status !== 'paid'
      && (!item.dueDate || dateOnly(item.dueDate) < dateOnly(now.toISOString()))
  )
  const overdueReceivableAmount = overdueReceivables.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const knownCycleMonths = months.filter(month => month.knownCycles.length > 0).length

  return {
    startBalance,
    operatingBalance,
    savingsBalance,
    months,
    firstMonth,
    lowestMonth,
    finalBalance: months[months.length - 1]?.closingBalance ?? startBalance,
    variableAverages,
    variableTotal,
    variableTotalAuto,
    variableCredit,
    variableDirect,
    overdueReceivables,
    overdueReceivableAmount,
    knownCycleMonths,
    projectedCycleMonths: Math.max(0, months.length - knownCycleMonths),
  }
}
