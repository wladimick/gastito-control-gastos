import { supabase, isConfigured } from '../lib/supabase'
import { CATEGORIES } from '../data'

// Cache de UUIDs de categorías: { localId → supabaseUUID }
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
        const local = CATEGORIES.find(c => c.label === row.label)
        if (local) map[local.id] = row.id
      }
      return map
    })
    .catch(() => ({}))
  return _catMapPromise
}

// Fila de Supabase → formato interno de la app
function mapRow(row) {
  const cat = CATEGORIES.find(
    c => c.label.toLowerCase() === row.categories?.label?.toLowerCase()
  )
  return {
    id:           row.id,
    amount:       row.amount,
    description:  row.description,
    category:     cat?.id ?? 'otros',
    bank:         row.bank_id ?? 'efectivo',
    method:       row.payment_method_id ?? 'tarjeta',
    type:         row.card_type ?? 'debito',
    installments: row.installments_count ?? 1,
    status:       row.status ?? 'ok',
    date:         row.expense_date,
    notes:        row.notes ?? '',
  }
}

const SELECT_FIELDS = `
  id, amount, description, bank_id, payment_method_id,
  card_type, installments_count, status, expense_date, notes,
  categories ( label )
`

// Formato interno → columnas de Supabase (sin id ni user_id)
async function toRow(expense) {
  const catMap = await getCategoryMap()
  return {
    amount:             expense.amount,
    description:        expense.description,
    category_id:        catMap[expense.category] ?? null,
    bank_id:            expense.bank,
    payment_method_id:  expense.method,
    card_type:          expense.type,
    installments_count: expense.installments ?? 1,
    status:             expense.status ?? 'ok',
    expense_date:       expense.date,
    notes:              expense.notes ?? '',
    source:             'manual',
  }
}

// ── READ ─────────────────────────────────────────────────────
// Retorna [] cuando hay sesión pero no hay gastos (nunca null con sesión).
// Retorna null cuando Supabase no está configurado.
export async function fetchExpenses() {
  if (!isConfigured) return null

  const { data, error } = await supabase
    .from('expenses')
    .select(SELECT_FIELDS)
    .order('expense_date', { ascending: false })

  if (error) throw error
  return data.map(mapRow)
}

// ── CREATE ───────────────────────────────────────────────────
export async function createExpense(expense, userId) {
  const row = { ...(await toRow(expense)), user_id: userId }
  const { data, error } = await supabase
    .from('expenses')
    .insert(row)
    .select(SELECT_FIELDS)
    .single()

  if (error) throw error
  return mapRow(data)
}

// ── UPDATE ───────────────────────────────────────────────────
export async function updateExpense(expense) {
  const row = await toRow(expense)
  const { data, error } = await supabase
    .from('expenses')
    .update(row)
    .eq('id', expense.id)
    .select(SELECT_FIELDS)
    .single()

  if (error) throw error
  return mapRow(data)
}

// ── PATCH (campo puntual, ej: status) ────────────────────────
export async function patchExpense(id, patch) {
  const { error } = await supabase
    .from('expenses')
    .update(patch)
    .eq('id', id)

  if (error) throw error
}

// ── DELETE ───────────────────────────────────────────────────
export async function removeExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}
