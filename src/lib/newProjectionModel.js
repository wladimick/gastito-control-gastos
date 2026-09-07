import { CATEGORIES } from '../data'

export const PROJECTION_BANKS = {
  bchile: { id: 'bchile', label: 'Banco Chile', color: '#1E5EFF' },
  falabella: { id: 'falabella', label: 'Banco Falabella', color: '#2FAA30' },
  otros: { id: 'otros', label: 'Otros', color: '#8B8F97' },
}

export const PROJECTION_LAYERS = {
  recurring: { id: 'recurring', label: 'Recurrentes', color: '#F59E0B' },
  installments: { id: 'installments', label: 'Cuotas', color: '#7C3AED' },
  simulations: { id: 'simulations', label: 'Simulaciones', color: '#E11D8A' },
}

const BANK_ORDER = ['bchile', 'falabella', 'otros']

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

function shares(values) {
  const total = Object.values(values).reduce((sum, value) => sum + Number(value || 0), 0)
  if (total <= 0) return null
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value || 0) / total]))
}

function allocate(total, distribution, fallbackKey = 'otros') {
  const result = {}
  if (total <= 0) return result
  if (!distribution) return { [fallbackKey]: total }
  let assigned = 0
  const entries = Object.entries(distribution)
  entries.forEach(([key, ratio], index) => {
    const amount = index === entries.length - 1 ? total - assigned : Math.round(total * ratio)
    result[key] = amount
    assigned += amount
  })
  return result
}

function addMap(target, source) {
  Object.entries(source || {}).forEach(([key, value]) => {
    target[key] = Number(target[key] || 0) + Number(value || 0)
  })
}

function cardMap(creditCards = []) {
  return new Map((creditCards || []).map(card => [card.id, normalizeBank(card.bank || card.name)]))
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
    layers: { recurring: 0, installments: 0, simulations: 0 },
    sourceCount: 0,
  }]))

  ;(expenses || []).filter(validExpense).forEach(expense => {
    const row = byKey.get(monthKey(expense.date))
    if (!row) return
    const amount = Number(expense.amount || 0)
    row.bankSegments[normalizeBank(expense.bank || expense.bankId || expense.cardName)] += amount
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

function historicalDistributions(history) {
  const banks = emptyBanks()
  const categories = emptyCategories()
  history.forEach(row => {
    addMap(banks, row.bankSegments)
    addMap(categories, row.categorySegments)
  })
  return { bankShares: shares(banks), categoryShares: shares(categories) }
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

function futureRows({ planMonths, currentKey, creditCards, billingCycles, installmentDebts, simulations, distributions }) {
  const cards = cardMap(creditCards)
  const cycles = new Map((billingCycles || []).map(cycle => [cycle.id, cycle]))
  const occurrenceCategories = occurrenceCategoryMap(installmentDebts)
  const planMap = new Map((planMonths || []).map(month => [month.key, month]))

  return Array.from({ length: 6 }, (_, index) => {
    const key = addMonthsKey(currentKey, index)
    const month = planMap.get(key)
    const banks = emptyBanks()
    const categories = emptyCategories()
    const layers = { recurring: 0, installments: 0, simulations: 0 }
    if (!month) return {
      key, label: monthLabel(key), shortLabel: monthLabel(key, true), kind: 'projected',
      bankSegments: banks, categorySegments: categories, layers, total: 0, sourceCount: 0,
    }

    ;(month.knownCycles || []).forEach(item => {
      banks[cards.get(item.cardId) || 'otros'] += Number(item.amount || 0)
      const sourceCycle = cycles.get(item.id)
      addMap(categories, cycleCategoryTotals(sourceCycle))
    })

    ;(month.uncoveredInstallmentDetail || []).forEach(item => {
      banks[cards.get(item.cardId) || normalizeBank(item.bankId || item.bankLabel)] += Number(item.amount || 0)
      categories[occurrenceCategories.get(item.id) || 'otros'] += Number(item.amount || 0)
    })

    const hasKnownBill = (month.knownCycles || []).length > 0
    ;(month.directRecurringDetail || []).forEach(item => {
      const amount = Number(item.amount || 0)
      banks[normalizeBank(item.bank)] += amount
      categories[categoryId(item.category)] += amount
    })
    if (!hasKnownBill) {
      ;(month.creditRecurringDetail || []).forEach(item => {
        const amount = Number(item.amount || 0)
        banks[normalizeBank(item.bank)] += amount
        categories[categoryId(item.category)] += amount
      })
    }

    ;(month.simulationDetail || []).forEach(item => {
      const amount = Number(item.amountThisMonth || 0)
      banks[normalizeBank(item.bank)] += amount
      categories[categoryId(item.category)] += amount
    })

    layers.recurring = Number(month.directRecurring || 0) + Number(month.creditRecurring || 0)
    layers.installments = Number(month.installmentAmount || 0)
    layers.simulations = Number(month.simulationAmount || 0)

    const total = Math.max(0, Number(month.outflow || 0))
    const bankKnown = Object.values(banks).reduce((sum, value) => sum + value, 0)
    addMap(banks, allocate(Math.max(0, total - bankKnown), distributions.bankShares, 'otros'))

    const categoryKnown = Object.values(categories).reduce((sum, value) => sum + value, 0)
    addMap(categories, allocate(Math.max(0, total - categoryKnown), distributions.categoryShares, 'otros'))

    return {
      key,
      label: monthLabel(key),
      shortLabel: monthLabel(key, true),
      kind: 'projected',
      bankSegments: banks,
      categorySegments: categories,
      layers,
      total,
      closingBalance: Number(month.closingBalance || 0),
      income: Number(month.income || 0) + Number(month.receivableAmount || 0),
      sourceCount: (month.knownCycles || []).length + (month.installmentDetail || []).length + (month.directRecurringDetail || []).length,
    }
  })
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
  installmentDebts = [],
  simulations = [],
  now = new Date(),
} = {}) {
  const currentKey = currentMonthKey(now)
  const history = historicalRows(expenses, currentKey)
  const distributions = historicalDistributions(history)
  const future = futureRows({
    planMonths,
    currentKey,
    creditCards,
    billingCycles,
    installmentDebts,
    simulations,
    distributions,
  })
  const rows = [...history, ...future]
  const maxTotal = Math.max(1, ...rows.map(row => Number(row.total || 0)))
  return { currentKey, history, future, rows, maxTotal, distributions }
}

export function visibleBankTotal(row, filter = 'all') {
  if (!row) return 0
  if (filter === 'all') return Number(row.total || 0)
  return Number(row.bankSegments?.[filter] || 0)
}

export function categoryTotal(row, filter = 'all') {
  if (!row) return 0
  if (filter === 'all') return Object.values(row.categorySegments || {}).reduce((sum, value) => sum + Number(value || 0), 0)
  return Number(row.categorySegments?.[filter] || 0)
}
