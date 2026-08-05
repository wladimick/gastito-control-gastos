import { supabase, isConfigured } from '../lib/supabase'
import { CATEGORIES } from '../data'
import { fetchBillingCycles } from './billingCyclesService'
import { fetchMyCards } from './creditCardsService'
import { buildUnifiedMovements } from './financialAlignmentService'
import { reportDataHealth, reportMutationError } from '../lib/appEvents'

let _catMapPromise = null

async function getCategoryMap() {
  if (!isConfigured) return {}
  if (_catMapPromise) return _catMapPromise
  _catMapPromise = supabase
    .from('categories')
    .select('id, label')
    .is('user_id', null)
    .then(({ data }) => {
      const map = {}
      for (const row of (data ?? [])) {
        const local = CATEGORIES.find(category => category.label === row.label)
        if (local) map[local.id] = row.id
      }
      return map
    })
    .catch(() => ({}))
  return _catMapPromise
}

function mapRow(row) {
  const category = CATEGORIES.find(
    item => item.label.toLowerCase() === row.categories?.label?.toLowerCase()
  )
  return {
    id: row.id,
    rawId: row.id,
    source: 'manual',
    editable: true,
    amount: Number(row.amount || 0),
    description: row.description,
    category: category?.id ?? 'otros',
    bank: row.bank_id ?? 'efectivo',
    method: row.payment_method_id ?? 'tarjeta',
    type: row.card_type ?? 'debito',
    installments: Number(row.installments_count ?? 1),
    status: row.status ?? 'ok',
    date: row.expense_date,
    notes: row.notes ?? '',
    sharedWithNicol: false,
  }
}

const SELECT_FIELDS = `
  id, amount, description, bank_id, payment_method_id,
  card_type, installments_count, status, expense_date, notes,
  categories ( label )
`

async function fetchManualExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select(SELECT_FIELDS)
    .order('expense_date', { ascending: false })
  if (error) throw error
  return (data || []).map(mapRow)
}

async function toRow(expense) {
  const categoryMap = await getCategoryMap()
  return {
    amount: Number(expense.amount || 0),
    description: expense.description,
    category_id: categoryMap[expense.category] ?? null,
    bank_id: expense.bank,
    payment_method_id: expense.method,
    card_type: expense.type,
    installments_count: Number(expense.installments ?? 1),
    status: expense.status ?? 'ok',
    expense_date: expense.date,
    notes: expense.notes ?? '',
    source: 'manual',
  }
}

async function runMutation(context, callback) {
  try {
    return await callback()
  } catch (error) {
    reportMutationError(context, error)
    throw error
  }
}

export async function fetchExpenses() {
  if (!isConfigured) return null

  const [manualResult, cyclesResult, cardsResult] = await Promise.allSettled([
    fetchManualExpenses(),
    fetchBillingCycles(),
    fetchMyCards(),
  ])

  if (manualResult.status === 'rejected') {
    reportDataHealth('expenses', 'error', 'No fue posible cargar los gastos manuales.')
    throw manualResult.reason
  }

  const manual = manualResult.value || []
  const cycles = cyclesResult.status === 'fulfilled' ? cyclesResult.value || [] : []
  const cards = cardsResult.status === 'fulfilled' ? cardsResult.value || [] : []
  const missing = []
  if (cyclesResult.status === 'rejected') missing.push('Facturación')
  if (cardsResult.status === 'rejected') missing.push('tarjetas')

  if (missing.length) {
    reportDataHealth('expenses', 'partial', `No se cargaron: ${missing.join(' y ')}.`)
  } else {
    reportDataHealth('expenses', 'complete')
  }

  return buildUnifiedMovements(manual, cycles, cards).movements
}

export async function createExpense(expense, userId) {
  return runMutation('Registrar gasto', async () => {
    const row = { ...(await toRow(expense)), user_id: userId }
    const { data, error } = await supabase
      .from('expenses')
      .insert(row)
      .select(SELECT_FIELDS)
      .single()
    if (error) throw error
    return mapRow(data)
  })
}

export async function updateExpense(expense) {
  return runMutation('Editar gasto', async () => {
    const row = await toRow(expense)
    const { data, error } = await supabase
      .from('expenses')
      .update(row)
      .eq('id', expense.id)
      .select(SELECT_FIELDS)
      .single()
    if (error) throw error
    return mapRow(data)
  })
}

export async function patchExpense(id, patch) {
  return runMutation('Actualizar estado del gasto', async () => {
    const { error } = await supabase.from('expenses').update(patch).eq('id', id)
    if (error) throw error
  })
}

export async function removeExpense(id) {
  return runMutation('Eliminar gasto', async () => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw error
  })
}
