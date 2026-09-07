const BANK_ORDER = ['bchile', 'falabella', 'otros']

export const SPENDING_BANKS = {
  bchile: { id: 'bchile', label: 'Banco Chile', color: '#1E5EFF' },
  falabella: { id: 'falabella', label: 'Banco Falabella', color: '#2FAA30' },
  otros: { id: 'otros', label: 'Otros gastos', color: '#8B8F97' },
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : ''
}

export function addMonthsKey(key, offset) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return ''
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function currentMonthKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'America/Santiago',
  }).formatToParts(now)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  return year && month ? `${year}-${month}` : now.toISOString().slice(0, 7)
}

export function monthLabel(key, short = false) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return key || 'Sin mes'
  const options = short
    ? { month: 'short', timeZone: 'UTC' }
    : { month: 'long', year: 'numeric', timeZone: 'UTC' }
  const text = new Intl.DateTimeFormat('es-CL', options)
    .format(new Date(Date.UTC(year, month - 1, 1)))
  return text.charAt(0).toUpperCase() + text.slice(1).replace('.', '')
}

export function normalizeBankId(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  if (
    normalized === 'bchile'
    || normalized.includes('banco chile')
    || normalized.includes('banco de chile')
    || normalized === 'chile'
  ) return 'bchile'

  if (
    normalized === 'falabella'
    || normalized.includes('falabella')
    || normalized.includes('cmr')
  ) return 'falabella'

  return 'otros'
}

function emptySegments() {
  return { bchile: 0, falabella: 0, otros: 0 }
}

function totalSegments(segments) {
  return BANK_ORDER.reduce((sum, key) => sum + Number(segments[key] || 0), 0)
}

function safeAmount(value) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

function historicalRows(expenses, currentKey) {
  const keys = [-3, -2, -1].map(offset => addMonthsKey(currentKey, offset))
  const rows = new Map(keys.map(key => [key, {
    key,
    label: monthLabel(key),
    shortLabel: monthLabel(key, true),
    kind: 'actual',
    segments: emptySegments(),
    sourceCount: 0,
  }]))

  ;(expenses || []).forEach(expense => {
    const key = dateOnly(expense.date).slice(0, 7)
    const row = rows.get(key)
    if (!row) return

    const status = String(expense.status || '').toLowerCase()
    if (['pendiente', 'revisar'].includes(status)) return
    if (['payment', 'credit'].includes(expense.movementType)) return

    const amount = safeAmount(expense.amount)
    if (!amount) return

    const bank = normalizeBankId(expense.bank || expense.bankId || expense.cardName)
    row.segments[bank] += amount
    row.sourceCount += 1
  })

  return keys.map(key => {
    const row = rows.get(key)
    const segments = Object.fromEntries(
      Object.entries(row.segments).map(([bank, amount]) => [bank, Math.max(0, amount)])
    )
    return {
      ...row,
      segments,
      total: totalSegments(segments),
    }
  })
}

function cardBankMap(creditCards = []) {
  return new Map((creditCards || []).map(card => [card.id, normalizeBankId(card.bank || card.name)]))
}

function futureBankSegments(month, cards) {
  const segments = emptySegments()

  ;(month.knownCycles || []).forEach(cycle => {
    const bank = cards.get(cycle.cardId) || 'otros'
    segments[bank] += Math.max(0, safeAmount(cycle.amount))
  })

  // Cuotas o pisos futuros no cubiertos por una factura ya conocida.
  ;(month.uncoveredInstallmentDetail || []).forEach(item => {
    const bank = cards.get(item.cardId) || normalizeBankId(item.bankId || item.bankLabel)
    segments[bank] += Math.max(0, safeAmount(item.amount))
  })

  // El motor de proyección puede sumar gasto variable de crédito o recurrentes
  // de tarjeta sin una entidad bancaria explícita. El remanente sigue siendo
  // compromiso de tarjeta, pero se presenta como "Otros" para no inventar banco.
  const classifiedCard = totalSegments(segments)
  const cardResidual = Math.max(0, safeAmount(month.cardAmount) - classifiedCard)
  segments.otros += cardResidual

  // Todo lo que no sea tarjeta (fijos directos, variable directo, por pagar,
  // simulaciones) se agrupa en Otros gastos para que la barra represente TODO.
  const nonCard = Math.max(0, safeAmount(month.outflow) - safeAmount(month.cardAmount))
  segments.otros += nonCard

  return segments
}

function futureRows(planMonths, currentKey, creditCards) {
  const cards = cardBankMap(creditCards)
  const byKey = new Map((planMonths || []).map(month => [month.key, month]))
  return Array.from({ length: 6 }, (_, index) => {
    const key = addMonthsKey(currentKey, index)
    const month = byKey.get(key)
    const segments = month ? futureBankSegments(month, cards) : emptySegments()
    const total = month ? Math.max(0, safeAmount(month.outflow)) : totalSegments(segments)
    return {
      key,
      label: monthLabel(key),
      shortLabel: monthLabel(key, true),
      kind: 'projected',
      segments,
      total,
      confidence: month?.cardConfidence || 'projected',
      cardAmount: safeAmount(month?.cardAmount),
      directAmount: Math.max(0, total - safeAmount(month?.cardAmount)),
      knownCycles: month?.knownCycles || [],
      sourceCount: (month?.knownCycles || []).length + (month?.installmentDetail || []).length,
    }
  })
}

function decorateRows(rows, maxTotal) {
  return rows.map(row => ({
    ...row,
    heightRatio: row.total / maxTotal,
    percentages: Object.fromEntries(BANK_ORDER.map(bank => [
      bank,
      row.total > 0 ? Math.round((row.segments[bank] || 0) * 100 / row.total) : 0,
    ])),
  }))
}

export function buildSpendingTimeline({
  expenses = [],
  projectionMonths = [],
  creditCards = [],
  now = new Date(),
} = {}) {
  const currentKey = currentMonthKey(now)
  const rawHistory = historicalRows(expenses, currentKey)
  const rawFuture = futureRows(projectionMonths, currentKey, creditCards)
  const rawRows = [...rawHistory, ...rawFuture]
  const maxTotal = Math.max(1, ...rawRows.map(row => row.total))
  const rows = decorateRows(rawRows, maxTotal)

  return {
    currentKey,
    history: rows.slice(0, 3),
    future: rows.slice(3),
    rows,
    maxTotal,
  }
}
