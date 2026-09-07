export const BILLING_BANK_STYLES = {
  bchile: { label: 'Banco Chile', color: '#2563EB' },
  falabella: { label: 'Banco Falabella', color: '#2EAE45' },
}

const FALLBACK_COLORS = ['#7C3AED', '#EA580C', '#0891B2', '#64748B']

function validCycleKey(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ''))
}

export function addMonthsToCycleKey(key, offset) {
  if (!validCycleKey(key)) return ''
  const [year, month] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + Number(offset || 0), 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function billingMonthLabel(key, short = false) {
  if (!validCycleKey(key)) return 'Sin mes'
  const [year, month] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, 1))
  const label = new Intl.DateTimeFormat('es-CL', {
    month: short ? 'short' : 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '')
}

export function billingCycleAmount(cycle) {
  if (!cycle) return 0
  const reported = Number(cycle.reportedAmount || 0)
  const estimated = Number(cycle.estimatedAmount || 0)
  const calculated = Number(cycle.calculatedAmount || 0)

  if (cycle.reportedAmountIsFinal || cycle.reconciliationStatus === 'reconciled') {
    return Math.max(0, reported)
  }
  if (estimated > 0) return Math.max(0, estimated)
  if (calculated !== 0) return Math.max(0, calculated)
  return Math.max(0, reported)
}

export function billingCycleAmountMode(cycle) {
  if (!cycle) return 'sin datos'
  if (cycle.reportedAmountIsFinal || cycle.reconciliationStatus === 'reconciled') return 'informado'
  if (Number(cycle.estimatedAmount || 0) > 0) return 'estimado'
  if (Number(cycle.calculatedAmount || 0) !== 0) return 'detalle conocido'
  if (Number(cycle.reportedAmount || 0) > 0) return 'informado parcial'
  return 'sin datos'
}

function bankStyle(bankId, index = 0) {
  const known = BILLING_BANK_STYLES[bankId]
  if (known) return { bankId, ...known }
  return {
    bankId,
    label: bankId || 'Otro banco',
    color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  }
}

function bankOrder(cards = []) {
  const ids = []
  const push = id => {
    if (id && !ids.includes(id)) ids.push(id)
  }

  push('bchile')
  push('falabella')
  cards.forEach(card => push(card.bank))
  return ids
}

function normalizePercentages(items, total) {
  if (total <= 0) return items.map(item => ({ ...item, percentage: 0 }))
  let used = 0
  return items.map((item, index) => {
    const last = index === items.length - 1
    const raw = item.amount * 100 / total
    const percentage = last ? Math.max(0, 100 - used) : Math.round(raw)
    used += percentage
    return { ...item, percentage }
  })
}

export function buildBillingHistory(cycles = [], cards = [], months = 6) {
  const cycleRows = (cycles || []).filter(cycle => validCycleKey(cycle.cycleKey))
  if (!cycleRows.length) {
    return { months: [], banks: bankOrder(cards).map((id, index) => bankStyle(id, index)), latestKey: '', maxTotal: 0 }
  }

  const keys = [...new Set(cycleRows.map(cycle => cycle.cycleKey))].sort()
  const latestKey = keys[keys.length - 1]
  const count = Math.max(1, Number(months || 6))
  const monthKeys = Array.from({ length: count }, (_, index) => addMonthsToCycleKey(latestKey, index - count + 1))
  const cardMap = new Map((cards || []).map(card => [card.id, card]))
  const orderedBankIds = bankOrder(cards)

  cycleRows.forEach(cycle => {
    const bankId = cardMap.get(cycle.cardId)?.bank || cycle.transactions?.[0]?.bankId || ''
    if (bankId && !orderedBankIds.includes(bankId)) orderedBankIds.push(bankId)
  })

  const banks = orderedBankIds.map((id, index) => bankStyle(id, index))

  const resultMonths = monthKeys.map(cycleKey => {
    const bankAmounts = new Map(banks.map(bank => [bank.bankId, 0]))
    const bankModes = new Map()
    const bankDueDates = new Map()
    const bankStatuses = new Map()

    cycleRows.filter(cycle => cycle.cycleKey === cycleKey).forEach(cycle => {
      const bankId = cardMap.get(cycle.cardId)?.bank || cycle.transactions?.[0]?.bankId || ''
      if (!bankId) return
      bankAmounts.set(bankId, Number(bankAmounts.get(bankId) || 0) + billingCycleAmount(cycle))
      bankModes.set(bankId, billingCycleAmountMode(cycle))
      if (cycle.dueDate) bankDueDates.set(bankId, cycle.dueDate)
      if (cycle.status) bankStatuses.set(bankId, cycle.status)
    })

    const bankRows = banks.map(bank => ({
      ...bank,
      amount: Number(bankAmounts.get(bank.bankId) || 0),
      mode: bankModes.get(bank.bankId) || 'sin datos',
      dueDate: bankDueDates.get(bank.bankId) || '',
      status: bankStatuses.get(bank.bankId) || '',
    }))

    const total = bankRows.reduce((sum, item) => sum + item.amount, 0)
    const withPercentages = normalizePercentages(bankRows, total)

    return {
      cycleKey,
      label: billingMonthLabel(cycleKey),
      shortLabel: billingMonthLabel(cycleKey, true),
      total,
      banks: withPercentages,
      isLatest: cycleKey === latestKey,
    }
  })

  return {
    months: resultMonths,
    banks,
    latestKey,
    maxTotal: Math.max(0, ...resultMonths.map(item => item.total)),
  }
}
