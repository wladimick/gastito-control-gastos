import { CATEGORIES } from '../data.js'

export const PROJECTION_BANKS = {
  bchile: { id: 'bchile', label: 'Banco Chile', color: '#1E5EFF' },
  falabella: { id: 'falabella', label: 'Banco Falabella', color: '#2FAA30' },
  otros: { id: 'otros', label: 'Otros', color: '#8B8F97' },
}

export const PROJECTION_LAYERS = {
  recurring: { id: 'recurring', label: 'Recurrentes', color: '#F59E0B' },
  installments: { id: 'installments', label: 'Cuotas adicionales', color: '#7C3AED' },
  simulations: { id: 'simulations', label: 'Simulaciones', color: '#E11D8A' },
}

export const PROJECTION_SOURCES = {
  billing: { id: 'billing', label: 'Informado por banco' },
  recurring: PROJECTION_LAYERS.recurring,
  installments: PROJECTION_LAYERS.installments,
  simulations: PROJECTION_LAYERS.simulations,
  other: { id: 'other', label: 'Otros compromisos', color: '#8B8F97' },
}

const BANK_ORDER = ['bchile', 'falabella', 'otros']
const SOURCE_ORDER = ['billing', 'recurring', 'installments', 'simulations', 'other']

export function monthKey(value) {
  return value ? String(value).slice(0, 7) : ''
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
  const value = new Intl.DateTimeFormat('es-CL', {
    month: short ? 'short' : 'long',
    year: short ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return value.charAt(0).toUpperCase() + value.slice(1).replace('.', '')
}

export function normalizeBank(value) {
  const text = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  if (text === 'bchile' || text.includes('banco chile') || text.includes('banco de chile')) return 'bchile'
  if (text === 'falabella' || text.includes('falabella') || text.includes('cmr')) return 'falabella'
  return 'otros'
}

function emptyBanks() {
  return { bchile: 0, falabella: 0, otros: 0 }
}

function emptyCategories() {
  return Object.fromEntries(CATEGORIES.map(category => [category.id, 0]))
}

function emptySources() {
  return Object.fromEntries(BANK_ORDER.map(bank => [bank, {
    billing: 0,
    recurring: 0,
    installments: 0,
    simulations: 0,
    other: 0,
  }]))
}

function emptySourceDetails() {
  return { billing: [], recurring: [], installments: [], simulations: [], other: [] }
}

function validExpense(expense) {
  if (!expense || Number(expense.amount || 0) <= 0) return false
  const status = String(expense.status || '').toLowerCase()
  if (['pendiente', 'revisar'].includes(status)) return false
  if (['payment', 'credit'].includes(expense.movementType)) return false
  return true
}

function categoryId(value) {
  const id = typeof value === 'string' ? value : value?.id
  return CATEGORIES.some(category => category.id === id) ? id : 'otros'
}

function addMap(target, source) {
  Object.entries(source || {}).forEach(([key, value]) => {
    target[key] = Number(target[key] || 0) + Number(value || 0)
  })
}

function cardMap(creditCards = []) {
  return new Map((creditCards || []).map(card => [card.id, normalizeBank(card.bank || card.name)]))
}

function cardInfoMap(creditCards = []) {
  return new Map((creditCards || []).map(card => [card.id, card]))
}

function historicalRows(expenses, currentKey) {
  const keys = [-3, -2, -1].map(offset => addMonthsKey(currentKey, offset))
  const byKey = new Map(keys.map(key => [key, {
    key,
    label: monthLabel(key),
    shortLabel: monthLabel(key, true),
    kind: 'actual',
    bankSegments: emptyBanks(),
    categorySegments: emptyCategories(),
    sourceByBank: emptySources(),
    sourceDetails: emptySourceDetails(),
    layers: { recurring: 0, installments: 0, simulations: 0 },
    sourceCount: 0,
  }]))

  ;(expenses || []).filter(validExpense).forEach(expense => {
    const row = byKey.get(monthKey(expense.date))
    if (!row) return
    const amount = Number(expense.amount || 0)
    const bank = normalizeBank(expense.bank || expense.bankId || expense.cardName)
    row.bankSegments[bank] += amount
    row.categorySegments[categoryId(expense.category)] += amount
    if (Number(expense.installmentTotal || expense.installments || 1) > 1 || expense.movementType === 'installment') {
      row.layers.installments += amount
    }
    row.sourceCount += 1
  })

  return keys.map(key => {
    const row = byKey.get(key)
    return {
      ...row,
      total: Object.values(row.bankSegments).reduce((sum, value) => sum + value, 0),
    }
  })
}

function cycleCategoryTotals(cycle) {
  const result = emptyCategories()
  ;(cycle?.transactions || [])
    .filter(item => item.affectsCycleTotal && !item.isPending)
    .filter(item => Number(item.amount || 0) > 0)
    .filter(item => !['payment', 'credit'].includes(item.movementType))
    .forEach(item => {
      result[categoryId(item.category)] += Number(item.amount || 0)
    })
  return result
}

function occurrenceCategoryMap(installmentDebts = []) {
  const map = new Map()
  ;(installmentDebts || []).forEach(plan => {
    ;(plan.occurrences || []).forEach(item => {
      map.set(item.id, categoryId(item.category || plan.category))
    })
  })
  return map
}

function addSource(row, bankValue, source, amountValue, detail = null) {
  const amount = Number(amountValue || 0)
  if (amount <= 0) return
  const bank = BANK_ORDER.includes(bankValue) ? bankValue : normalizeBank(bankValue)
  row.sourceByBank[bank][source] += amount
  if (detail) row.sourceDetails[source].push({ ...detail, amount, bank })
}

function sumSourceByBank(sourceByBank) {
  const banks = emptyBanks()
  BANK_ORDER.forEach(bank => {
    banks[bank] = SOURCE_ORDER.reduce((sum, source) => sum + Number(sourceByBank?.[bank]?.[source] || 0), 0)
  })
  return banks
}

function sumSource(row, source, bankFilter = 'all') {
  const banks = bankFilter === 'all' ? BANK_ORDER : [bankFilter]
  return banks.reduce((sum, bank) => sum + Number(row.sourceByBank?.[bank]?.[source] || 0), 0)
}

function recurringDetailsIncluded(month) {
  const known = Number(month.knownCardAmount || 0)
  const installments = Number(month.uncoveredInstallmentAmount || 0)
  const estimated = Number(month.estimatedCreditVariableRemaining || 0)
  return Math.max(0, Number(month.cardAmount || 0) - known - installments - estimated)
}

function takeRecurringItems(items, amountToTake) {
  let remaining = Math.max(0, Number(amountToTake || 0))
  const result = []
  for (const item of (items || [])) {
    if (remaining <= 0) break
    const original = Number(item.amount || 0)
    if (original <= 0) continue
    const amount = Math.min(original, remaining)
    result.push({ item, amount })
    remaining -= amount
  }
  return result
}

function forecastMapForMonth(billingForecasts = []) {
  const map = new Map()
  ;(billingForecasts || []).filter(item => item?.active !== false).forEach(item => {
    if (!item.cardId || !item.cashMonth || Number(item.amount || 0) <= 0) return
    map.set(`${item.cashMonth}|${item.cardId}`, item)
  })
  return map
}

function futureRows({ planMonths, currentKey, creditCards, billingCycles, billingForecasts, installmentDebts, simulations }) {
  const cards = cardMap(creditCards)
  const cardInfo = cardInfoMap(creditCards)
  const cycles = new Map((billingCycles || []).map(cycle => [cycle.id, cycle]))
  const occurrenceCategories = occurrenceCategoryMap(installmentDebts)
  const forecasts = forecastMapForMonth(billingForecasts)
  const planMap = new Map((planMonths || []).map(month => [month.key, month]))

  return Array.from({ length: 6 }, (_, index) => {
    const key = addMonthsKey(currentKey, index)
    const month = planMap.get(key)
    const row = {
      key,
      label: monthLabel(key),
      shortLabel: monthLabel(key, true),
      kind: 'projected',
      bankSegments: emptyBanks(),
      categorySegments: emptyCategories(),
      sourceByBank: emptySources(),
      sourceDetails: emptySourceDetails(),
      layers: { recurring: 0, installments: 0, simulations: 0 },
      total: 0,
      sourceCount: 0,
    }
    if (!month) return row

    const knownCardIds = new Set()
    ;(month.knownCycles || []).forEach(item => {
      const bank = cards.get(item.cardId) || 'otros'
      const amount = Number(item.amount || 0)
      knownCardIds.add(item.cardId)
      addSource(row, bank, 'billing', amount, {
        id: item.id,
        label: cardInfo.get(item.cardId)?.name || PROJECTION_BANKS[bank]?.label || 'Tarjeta de crédito',
        meta: [item.dueDate ? `Vence ${item.dueDate}` : null, item.final ? 'Monto final' : 'Ciclo en curso'].filter(Boolean).join(' · '),
        source: 'billing_cycle',
      })
      addMap(row.categorySegments, cycleCategoryTotals(cycles.get(item.id)))
    })

    const installmentsByCard = new Map()
    const installmentsWithoutCard = []
    ;(month.uncoveredInstallmentDetail || []).forEach(item => {
      if (item.cardId) {
        const current = installmentsByCard.get(item.cardId) || []
        current.push(item)
        installmentsByCard.set(item.cardId, current)
      } else {
        installmentsWithoutCard.push(item)
      }
      row.categorySegments[occurrenceCategories.get(item.id) || 'otros'] += Number(item.amount || 0)
    })

    for (const [cardId, items] of installmentsByCard.entries()) {
      const bank = cards.get(cardId) || normalizeBank(items[0]?.bankId || items[0]?.bankLabel)
      const totalInstallments = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
      const forecast = forecasts.get(`${key}|${cardId}`)

      if (!knownCardIds.has(cardId) && forecast) {
        const bankReported = Math.min(totalInstallments, Number(forecast.amount || 0))
        addSource(row, bank, 'billing', bankReported, {
          id: `forecast:${forecast.id || `${cardId}:${key}`}`,
          label: cardInfo.get(cardId)?.name || PROJECTION_BANKS[bank]?.label || 'Tarjeta de crédito',
          meta: `Vencimiento informado por el banco · ${monthLabel(key)}`,
          source: 'billing_forecast',
        })
        const extra = Math.max(0, totalInstallments - bankReported)
        addSource(row, bank, 'installments', extra, {
          id: `extra-installments:${cardId}:${key}`,
          label: 'Cuotas adicionales sobre lo informado por el banco',
          meta: 'Compromisos registrados en Gastito que exceden el vencimiento informado',
          source: 'installment_extra',
        })
      } else if (!knownCardIds.has(cardId)) {
        addSource(row, bank, 'installments', totalInstallments, {
          id: `installments:${cardId}:${key}`,
          label: cardInfo.get(cardId)?.name ? `Cuotas · ${cardInfo.get(cardId).name}` : 'Cuotas comprometidas',
          meta: 'Cuotas conocidas sin un vencimiento bancario importado para este mes',
          source: 'installments',
        })
      }
    }

    installmentsWithoutCard.forEach(item => {
      const bank = normalizeBank(item.bankId || item.bankLabel)
      addSource(row, bank, 'installments', item.amount, {
        id: item.id,
        label: item.description || 'Cuota comprometida',
        meta: [item.installmentCurrent && item.installmentTotal ? `Cuota ${item.installmentCurrent}/${item.installmentTotal}` : null, item.dueDate ? `Vence ${item.dueDate}` : null].filter(Boolean).join(' · '),
        source: 'installment',
      })
    })

    ;(month.directRecurringDetail || []).forEach(item => {
      const amount = Number(item.amount || 0)
      const bank = normalizeBank(item.bank)
      addSource(row, bank, 'recurring', amount, {
        id: item.id,
        label: item.name || item.description || 'Recurrente',
        meta: [item.dayOfMonth ? `Día ${item.dayOfMonth}` : null, PROJECTION_BANKS[bank]?.label || null].filter(Boolean).join(' · '),
        source: 'recurring',
      })
      row.categorySegments[categoryId(item.category)] += amount
    })

    const creditRecurringIncluded = recurringDetailsIncluded(month)
    takeRecurringItems(month.creditRecurringDetail, creditRecurringIncluded).forEach(({ item, amount }) => {
      const bank = normalizeBank(item.bank)
      addSource(row, bank, 'recurring', amount, {
        id: item.id,
        label: item.name || item.description || 'Recurrente de tarjeta',
        meta: [item.dayOfMonth ? `Día ${item.dayOfMonth}` : null, PROJECTION_BANKS[bank]?.label || null].filter(Boolean).join(' · '),
        source: 'credit_recurring',
      })
      row.categorySegments[categoryId(item.category)] += amount
    })

    ;(month.simulationDetail || []).forEach(item => {
      const amount = Number(item.amountThisMonth || 0)
      const bank = normalizeBank(item.bank)
      addSource(row, bank, 'simulations', amount, {
        id: item.id,
        label: item.name || 'Simulación',
        meta: item.installmentCurrent && item.installmentTotal ? `Cuota ${item.installmentCurrent}/${item.installmentTotal}` : 'Compra simulada',
        source: 'simulation',
      })
      row.categorySegments[categoryId(item.category)] += amount
    })

    const targetTotal = Math.max(0, Number(month.outflow || 0))
    const classified = BANK_ORDER.reduce((sum, bank) => sum + SOURCE_ORDER.reduce((inner, source) => inner + Number(row.sourceByBank[bank][source] || 0), 0), 0)
    const residual = Math.max(0, Math.round(targetTotal - classified))
    addSource(row, 'otros', 'other', residual, {
      id: `other:${key}`,
      label: 'Otro compromiso identificado por el motor',
      meta: 'No tiene una fuente más específica para mostrar',
      source: 'other',
    })

    row.bankSegments = sumSourceByBank(row.sourceByBank)
    row.layers.recurring = sumSource(row, 'recurring')
    row.layers.installments = sumSource(row, 'installments')
    row.layers.simulations = sumSource(row, 'simulations')
    row.total = Object.values(row.bankSegments).reduce((sum, value) => sum + value, 0)
    row.closingBalance = Number(month.closingBalance || 0)
    row.income = Number(month.income || 0) + Number(month.receivableAmount || 0)
    row.sourceCount = Object.values(row.sourceDetails).reduce((sum, items) => sum + items.length, 0)

    const categoryKnown = Object.values(row.categorySegments).reduce((sum, value) => sum + Number(value || 0), 0)
    if (categoryKnown < row.total) row.categorySegments.otros += row.total - categoryKnown

    return row
  })
}

function layerEnabled(layers, source) {
  if (source === 'recurring') return layers?.recurring !== false
  if (source === 'installments') return layers?.installments !== false
  if (source === 'simulations') return layers?.simulations !== false
  return true
}

export function projectionSegments(row, bankFilter = 'all', layers = null) {
  if (!row) return []
  const banks = bankFilter === 'all' ? BANK_ORDER : [bankFilter]

  if (row.kind === 'actual' || !row.sourceByBank) {
    return banks
      .map(bank => ({
        id: `actual:${bank}`,
        source: 'actual',
        bank,
        label: PROJECTION_BANKS[bank]?.label || bank,
        color: PROJECTION_BANKS[bank]?.color || PROJECTION_BANKS.otros.color,
        amount: Number(row.bankSegments?.[bank] || 0),
      }))
      .filter(item => item.amount > 0)
  }

  const result = []
  banks.forEach(bank => {
    const amount = Number(row.sourceByBank?.[bank]?.billing || 0)
    if (amount > 0) result.push({
      id: `billing:${bank}`,
      source: 'billing',
      bank,
      label: `${PROJECTION_BANKS[bank]?.label || 'Banco'} · informado`,
      color: PROJECTION_BANKS[bank]?.color || PROJECTION_BANKS.otros.color,
      amount,
    })
  })

  ;['recurring', 'installments', 'simulations', 'other'].forEach(source => {
    if (!layerEnabled(layers, source)) return
    const amount = banks.reduce((sum, bank) => sum + Number(row.sourceByBank?.[bank]?.[source] || 0), 0)
    if (amount <= 0) return
    result.push({
      id: source,
      source,
      bank: bankFilter,
      label: PROJECTION_SOURCES[source].label,
      color: PROJECTION_SOURCES[source].color,
      amount,
    })
  })

  return result
}

export function safeSpendingCapacity(planMonths = [], monthKeyValue) {
  const index = (planMonths || []).findIndex(month => month.key === monthKeyValue)
  if (index < 0) return 0
  const remaining = planMonths.slice(index)
  const headroom = remaining.map(month => {
    const income = Number(month.income || 0) + Number(month.receivableAmount || 0)
    const buffer = Math.max(100000, Math.round(income * 0.1))
    return Number(month.closingBalance || 0) - buffer
  })
  return Math.max(0, Math.floor(Math.min(...headroom)))
}

export function buildNewProjectionTimeline({
  expenses = [],
  planMonths = [],
  creditCards = [],
  billingCycles = [],
  billingForecasts = [],
  installmentDebts = [],
  simulations = [],
  now = new Date(),
} = {}) {
  const currentKey = currentMonthKey(now)
  const history = historicalRows(expenses, currentKey)
  const future = futureRows({
    planMonths,
    currentKey,
    creditCards,
    billingCycles,
    billingForecasts,
    installmentDebts,
    simulations,
  })
  const rows = [...history, ...future]
  const maxTotal = Math.max(1, ...rows.map(row => Number(row.total || 0)))
  return { currentKey, history, future, rows, maxTotal }
}

export function visibleBankTotal(row, filter = 'all', layers = null) {
  return projectionSegments(row, filter, layers).reduce((sum, item) => sum + Number(item.amount || 0), 0)
}

export function categoryTotal(row, filter = 'all') {
  if (!row) return 0
  if (filter === 'all') return Object.values(row.categorySegments || {}).reduce((sum, value) => sum + Number(value || 0), 0)
  return Number(row.categorySegments?.[filter] || 0)
}
