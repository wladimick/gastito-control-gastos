import { supabase, isConfigured } from '../lib/supabase'
import { CATEGORIES } from '../data'

let _categoryMapPromise = null

async function categoryMap() {
  if (!isConfigured) return {}
  if (_categoryMapPromise) return _categoryMapPromise
  _categoryMapPromise = supabase
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
  return _categoryMapPromise
}

const FIELDS = `
  id, name, total_amount, installment_amount, total_installments,
  paid_installments, bank_id, due_day, start_date, auto_pay,
  last_paid_month, categories(id, label, icon, color)
`

function mapRow(row) {
  const linkedCategory = Array.isArray(row.categories) ? row.categories[0] : row.categories
  const local = CATEGORIES.find(category =>
    category.label?.toLowerCase() === linkedCategory?.label?.toLowerCase()
  )
  const paid = Number(row.paid_installments ?? 0)
  const total = Number(row.total_installments ?? 1)
  return {
    id: row.id,
    description: row.name,
    category: linkedCategory?.id ?? local?.id ?? 'otros',
    bank: row.bank_id ?? 'bchile',
    method: 'tarjeta',
    total: Number(row.total_amount ?? 0),
    installments: total,
    paid,
    monthlyAmount: Number(row.installment_amount ?? 0),
    startMonth: row.start_date ? row.start_date.slice(0, 7) : new Date().toISOString().slice(0, 7),
    dayOfMonth: Number(row.due_day ?? 5),
    status: paid >= total ? 'paid' : 'active',
    autoPay: Boolean(row.auto_pay),
    notes: '',
  }
}

async function toRow(debt) {
  const map = await categoryMap()
  const categoryId = String(debt.category || '').includes('-')
    ? debt.category
    : map[debt.category] ?? null
  return {
    name: debt.description,
    total_amount: Number(debt.total ?? 0),
    installment_amount: Number(debt.monthlyAmount ?? 0),
    total_installments: Number(debt.installments ?? 1),
    paid_installments: Number(debt.paid ?? 0),
    bank_id: debt.bank ?? null,
    category_id: categoryId,
    due_day: Number(debt.dayOfMonth ?? 5),
    start_date: debt.startMonth ? `${debt.startMonth}-01` : null,
    auto_pay: Boolean(debt.autoPay),
  }
}

export async function fetchInstallments() {
  if (!isConfigured) return null
  const { data, error } = await supabase.from('installments').select(FIELDS).order('created_at')
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function createInstallment(debt, userId) {
  const row = { ...(await toRow(debt)), user_id: userId }
  const { data, error } = await supabase.from('installments').insert(row).select(FIELDS).single()
  if (error) throw error
  return mapRow(data)
}

export async function updateInstallment(debt) {
  const row = await toRow(debt)
  const { data, error } = await supabase.from('installments').update(row).eq('id', debt.id).select(FIELDS).single()
  if (error) throw error
  return mapRow(data)
}

export async function patchInstallment(id, patch) {
  const { error } = await supabase.from('installments').update(patch).eq('id', id)
  if (error) throw error
}

export async function removeInstallment(id) {
  const { error } = await supabase.from('installments').delete().eq('id', id)
  if (error) throw error
}
