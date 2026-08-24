import { CATEGORIES } from '../data'

const FALLBACK_CATEGORY = CATEGORIES.find(category => category.id === 'otros') || {
  id: 'otros', label: 'Otros', icon: '•', color: '#888880',
}

const NOISE_WORDS = new Set([
  'compra', 'compras', 'cuota', 'cuotas', 'sin', 'interes', 'tasa', 'int',
  'com', 'fija', 'pago', 'mercadopago', 'mercado', 'mp', 'payu', 'tuu',
  'curico', 'spa', 'cpc', 'cl', 'chile', 'transaccion', 'tarjeta', 'credito',
])

export function dateOnly(value) {
  return value ? String(value).slice(0, 10) : ''
}

export function monthKey(value) {
  return dateOnly(value).slice(0, 7)
}

export function addMonthsKey(key, offset) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return ''
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function normalizeMerchant(value) {
  return normalizeText(value)
    .split(' ')
    .filter(token => token.length > 1 && !NOISE_WORDS.has(token))
    .join(' ')
}

function categoryFrom(value, movementType = '') {
  const raw = value && typeof value === 'object' ? value : null
  const byId = CATEGORIES.find(category => category.id === raw?.id || category.id === value)
  if (byId) return byId

  const label = raw?.label || (typeof value === 'string' ? value : '')
  const byLabel = CATEGORIES.find(category => normalizeText(category.label) === normalizeText(label))
  if (byLabel) return byLabel

  if (['commission', 'tax', 'interest'].includes(movementType)) {
    return CATEGORIES.find(category => category.id === 'comision_bancaria') || FALLBACK_CATEGORY
  }
  return FALLBACK_CATEGORY
}

function categoryId(value, movementType = '') {
  return categoryFrom(value, movementType).id
}

function cardFor(cards, cardId) {
  return (cards || []).find(card => card.id === cardId) || null
}

function duplicateKey(row) {
  const day = dateOnly(row.date)
  if (!day) return ''
  return `${day}|${Math.round(Number(row.amount || 0))}|${normalizeText(row.description)}`
}

function probableDuplicate(manual, billing) {
  const amountDiff = Math.abs(Number(manual.amount || 0) - Number(billing.amount || 0))
  if (amountDiff > 1) return false

  const manualDay = dateOnly(manual.date)
  const billingDay = dateOnly(billing.date)
  if (!manualDay || !billingDay) return false

  const dayDiff = Math.abs(
    (new Date(`${manualDay}T12:00:00Z`) - new Date(`${billingDay}T12:00:00Z`)) / 86400000
  )
  if (dayDiff > 1) return false

  const left = normalizeMerchant(manual.description)
  const right = normalizeMerchant(billing.description)
  if (!left || !right) return false
  if (left === right || left.includes(right) || right.includes(left)) return true

  const leftTokens = new Set(left.split(' ').filter(Boolean))
  const rightTokens = new Set(right.split(' ').filter(Boolean))
  const shared = [...leftTokens].filter(token => rightTokens.has(token)).length
  return shared / Math.max(leftTokens.size, rightTokens.size) >= 0.5
}

function mapBillingMovement(cycle, item, cards) {
  const card = cardFor(cards, cycle.cardId)
  const category = categoryFrom(item.category, item.movementType)
  return {
    id: `billing:${item.id}`,
    rawId: item.id,
    source: 'billing',
    originSource: 'billing',
    editable: false,
    amount: Number(item.amount || 0),
    description: item.description || 'Movimiento de tarjeta',
    category: category.id,
    categoryMeta: category,
    bank: card?.bank || item.bankId || 'efectivo',
    method: 'tarjeta',
    type: 'credito',
    installments: Number(item.installmentTotal || 1),
    installmentCurrent: Number(item.installmentCurrent || 0) || null,
    installmentTotal: Number(item.installmentTotal || 0) || null,
    originalAmount: item.originalAmount == null ? null : Number(item.originalAmount),
    status: item.reviewStatus === 'review_required' ? 'revisar' : 'ok',
    date: item.date || cycle.periodEnd || cycle.closingDate || cycle.dueDate,
    notes: `Importado desde Facturación · ciclo ${cycle.cycleKey}`,
    cycleKey: cycle.cycleKey,
    dueDate: cycle.dueDate,
    sharedWithNicol: Boolean(item.sharedWithNicol),
    movementType: item.movementType,
    cardId: cycle.cardId,
    cardName: card?.name || 'Tarjeta',
    lastFour: card?.lastFour || '',
  }
}

export function buildUnifiedMovements(manualExpenses = [], cycles = [], cards = []) {
  const manualRows = (manualExpenses || []).map(row => ({
    ...row,
    originSource: row.originSource || row.source || 'manual',
    source: row.source === 'reconciled' ? 'reconciled' : 'manual',
    editable: true,
    amount: Number(row.amount || 0),
    installments: Number(row.installments || 1),
    category: categoryId(row.category),
    categoryMeta: categoryFrom(row.category),
    sharedWithNicol: Boolean(row.sharedWithNicol),
  }))

  const billingRows = (cycles || []).flatMap(cycle =>
    (cycle.transactions || [])
      .filter(item => item.affectsCycleTotal)
      .filter(item => Number(item.amount || 0) > 0)
      .filter(item => !item.isPending)
      .filter(item => !['payment', 'credit'].includes(item.movementType))
      .map(item => mapBillingMovement(cycle, item, cards))
  )

  const exactMap = new Map()
  billingRows.forEach(row => {
    const key = duplicateKey(row)
    if (!key) return
    exactMap.set(key, [...(exactMap.get(key) || []), row])
  })

  const consumedBilling = new Set()
  let reconciledCount = 0

  const mergedManual = manualRows.map(manual => {
    const exact = (exactMap.get(duplicateKey(manual)) || [])
      .find(row => !consumedBilling.has(row.id))
    const probable = exact || billingRows.find(row =>
      !consumedBilling.has(row.id) && probableDuplicate(manual, row)
    )

    if (!probable) return manual
    consumedBilling.add(probable.id)
    reconciledCount += 1

    return {
      ...manual,
      source: 'reconciled',
      billingId: probable.rawId,
      bank: probable.bank || manual.bank,
      method: probable.method,
      type: probable.type,
      installments: probable.installments,
      installmentCurrent: probable.installmentCurrent,
      installmentTotal: probable.installmentTotal,
      originalAmount: probable.originalAmount,
      category: manual.category !== 'otros' ? manual.category : probable.category,
      categoryMeta: manual.category !== 'otros' ? manual.categoryMeta : probable.categoryMeta,
      cycleKey: probable.cycleKey,
      dueDate: probable.dueDate,
      sharedWithNicol: probable.sharedWithNicol,
      cardId: probable.cardId,
      cardName: probable.cardName,
      lastFour: probable.lastFour,
    }
  })

  const remainingBilling = billingRows.filter(row => !consumedBilling.has(row.id))
  const movements = [...mergedManual, ...remainingBilling]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || b.amount - a.amount)

  return {
    movements,
    reconciledCount,
    manualCount: manualRows.length,
    billingCount: billingRows.length,
  }
}

function tokenSimilarity(leftValue, rightValue) {
  const left = new Set(normalizeMerchant(leftValue).split(' ').filter(token => token.length > 2))
  const right = new Set(normalizeMerchant(rightValue).split(' ').filter(token => token.length > 2))
  if (!left.size || !right.size) return 0
  const shared = [...left].filter(token => right.has(token)).length
  return shared / Math.max(left.size, right.size)
}

function deriveStartMonth(cycleKey, installmentCurrent) {
  return addMonthsKey(cycleKey, -(Math.max(1, installmentCurrent) - 1))
}

function buildBankInstallmentPlans(cycles, cards) {
  const groups = new Map()

  ;(cycles || []).forEach(cycle => {
    const card = cardFor(cards, cycle.cardId)
    ;(cycle.transactions || [])
      .filter(item => item.affectsCycleTotal)
      .filter(item => Number(item.amount || 0) > 0)
      .filter(item => Number(item.installmentTotal || 0) > 1)
      .filter(item => !['payment', 'credit'].includes(item.movementType))
      .forEach(item => {
        const total = Number(item.installmentTotal || 1)
        const monthlyAmount = Number(item.amount || 0)
        const merchant = normalizeMerchant(item.description) || normalizeText(item.description)
        const key = [cycle.cardId, merchant, total, Math.round(monthlyAmount)].join('|')
        const category = categoryFrom(item.category, item.movementType)
        const current = Number(item.installmentCurrent || 1)
        const occurrence = {
          id: `billing-installment:${item.id}`,
          source: 'bank',
          projected: false,
          confirmed: !item.isPending,
          isPending: Boolean(item.isPending),
          monthKey: cycle.cycleKey,
          dueDate: cycle.dueDate,
          description: item.description || 'Compra en cuotas',
          amount: monthlyAmount,
          installmentCurrent: current,
          installmentTotal: total,
          bankId: card?.bank || item.bankId || '',
          bankLabel: card?.name || card?.bank || 'Tarjeta',
          cardId: cycle.cardId,
          cardLabel: card ? `${card.name}${card.lastFour ? ` •••• ${card.lastFour}` : ''}` : 'Tarjeta',
          category: category.id,
          categoryMeta: category,
          sharedWithNicol: Boolean(item.sharedWithNicol),
          originalAmount: item.originalAmount == null ? null : Number(item.originalAmount),
          cycleStatus: cycle.status,
        }

        const existing = groups.get(key) || {
          id: `bank-plan:${key}`,
          source: 'bank',
          bank: occurrence.bankId,
          bankId: occurrence.bankId,
          cardId: cycle.cardId,
          cardLabel: occurrence.cardLabel,
          description: occurrence.description,
          category: category.id,
          categoryMeta: category,
          total: Number(item.originalAmount || monthlyAmount * total),
          installments: total,
          monthlyAmount,
          dayOfMonth: Number(String(cycle.dueDate || '').slice(8, 10)) || 5,
          autoPay: false,
          sharedWithNicol: occurrence.sharedWithNicol,
          occurrences: [],
        }

        existing.occurrences.push(occurrence)
        existing.description = occurrence.description || existing.description
        existing.category = category.id
        existing.categoryMeta = category
        existing.total = Number(item.originalAmount || existing.total || monthlyAmount * total)
        existing.sharedWithNicol = existing.sharedWithNicol || occurrence.sharedWithNicol
        groups.set(key, existing)
      })
  })

  return [...groups.values()].map(plan => {
    const actual = [...new Map(
      plan.occurrences
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey) || a.installmentCurrent - b.installmentCurrent)
        .map(item => [`${item.monthKey}:${item.installmentCurrent}`, item])
    ).values()]
    const latest = actual[actual.length - 1]
    const paid = latest
      ? Math.max(0, latest.installmentCurrent - (latest.cycleStatus === 'paid' ? 0 : 1))
      : 0
    const projections = []

    if (latest) {
      for (let current = latest.installmentCurrent + 1; current <= latest.installmentTotal; current += 1) {
        projections.push({
          ...latest,
          id: `${plan.id}:projection:${current}`,
          projected: true,
          confirmed: false,
          isPending: false,
          monthKey: addMonthsKey(latest.monthKey, current - latest.installmentCurrent),
          installmentCurrent: current,
        })
      }
    }

    return {
      ...plan,
      paid,
      startMonth: latest ? deriveStartMonth(latest.monthKey, latest.installmentCurrent) : '',
      status: paid >= plan.installments ? 'paid' : 'active',
      latestInstallment: latest?.installmentCurrent || 0,
      dueDate: latest?.dueDate || '',
      occurrences: [...actual, ...projections],
    }
  })
}

function manualOccurrenceRows(debt) {
  const occurrences = []
  const total = Math.max(1, Number(debt.installments || 1))
  const paid = Math.max(0, Number(debt.paid || 0))
  for (let current = paid + 1; current <= total; current += 1) {
    occurrences.push({
      id: `manual-installment:${debt.id}:${current}`,
      source: 'manual',
      projected: true,
      confirmed: false,
      isPending: false,
      monthKey: addMonthsKey(debt.startMonth, current - 1),
      dueDate: '',
      description: debt.description,
      amount: Number(debt.monthlyAmount || 0),
      installmentCurrent: current,
      installmentTotal: total,
      bankId: debt.bank,
      bankLabel: debt.bank,
      cardId: '',
      cardLabel: 'Seguimiento manual',
      category: categoryId(debt.category),
      categoryMeta: categoryFrom(debt.category),
      sharedWithNicol: false,
      originalAmount: Number(debt.total || 0),
      dueDay: Number(debt.dayOfMonth || 5),
    })
  }
  return occurrences
}

function installmentMatch(manual, bankPlan) {
  if (manual.bank && bankPlan.bank && manual.bank !== bankPlan.bank) return null
  if (Number(manual.installments || 0) !== Number(bankPlan.installments || 0)) return null

  const tolerance = Math.max(3, Number(bankPlan.monthlyAmount || 0) * 0.01)
  const amountDiff = Math.abs(Number(manual.monthlyAmount || 0) - Number(bankPlan.monthlyAmount || 0))
  if (amountDiff > tolerance) return null

  const similarity = tokenSimilarity(manual.description, bankPlan.description)
  if (similarity < 0.2 && amountDiff > 1) return null
  return similarity + (amountDiff <= 1 ? 0.35 : 0)
}

export function buildUnifiedInstallments(manualDebts = [], cycles = [], cards = []) {
  const bankPlans = buildBankInstallmentPlans(cycles, cards)
  const usedPlans = new Set()
  const matchedManual = new Set()
  let reconciledCount = 0

  const enrichedBankPlans = bankPlans.map(plan => ({ ...plan }))

  ;(manualDebts || []).forEach(manual => {
    const candidates = enrichedBankPlans
      .filter(plan => !usedPlans.has(plan.id))
      .map(plan => ({ plan, score: installmentMatch(manual, plan) }))
      .filter(candidate => candidate.score != null)
      .sort((a, b) => b.score - a.score)

    const best = candidates[0]
    if (!best) return
    usedPlans.add(best.plan.id)
    matchedManual.add(manual.id)
    reconciledCount += 1

    best.plan.source = 'reconciled'
    best.plan.manualDebt = { ...manual, source: 'manual' }
    best.plan.friendlyDescription = manual.description
    if (manual.category && manual.category !== 'otros') {
      best.plan.category = categoryId(manual.category)
      best.plan.categoryMeta = categoryFrom(manual.category)
    }
  })

  const unmatchedManual = (manualDebts || [])
    .filter(debt => !matchedManual.has(debt.id))
    .map(debt => ({
      ...debt,
      source: 'manual',
      editable: true,
      amount: Number(debt.monthlyAmount || 0),
      category: categoryId(debt.category),
      categoryMeta: categoryFrom(debt.category),
      occurrences: manualOccurrenceRows(debt),
    }))

  const plans = [...enrichedBankPlans, ...unmatchedManual]
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return Number(b.monthlyAmount || 0) - Number(a.monthlyAmount || 0)
    })

  return {
    plans,
    reconciledCount,
    bankCount: bankPlans.length,
    manualCount: manualDebts.length,
  }
}

export function buildAlignmentSummary(movements = [], installments = []) {
  const confirmedSpend = movements.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const monthlyInstallments = installments
    .filter(plan => plan.status === 'active')
    .reduce((sum, plan) => sum + Number(plan.monthlyAmount || 0), 0)
  return { confirmedSpend, monthlyInstallments }
}
