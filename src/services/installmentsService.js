import { supabase, isConfigured } from '../lib/supabase'
import { CATEGORIES } from '../data'
import { fetchBillingCycles } from './billingCyclesService'
import { fetchMyCards } from './creditCardsService'
import { buildUnifiedInstallments } from './financialAlignmentService'

let _catMapPromise = null

async function categoryMap() {
  if (!isConfigured) return { forward: {}, reverse: {} }
  if (_catMapPromise) return _catMapPromise
  _catMapPromise = supabase
    .from('categories')
    .select('id, label')
    .is('user_id', null)
    .then(({ data }) => {
      const forward = {}
      const reverse = {}
      for (const row of (data ?? [])) {
        const local = CATEGORIES.find(category => category.label === row.label)
        if (local) {
          forward[local.id] = row.id
          reverse[row.id] = local.id
        }
      }
      return { forward, reverse }
    })
    .catch(() => ({ forward: {}, reverse: {} }))
  return _catMapPromise
}

const FIELDS = `id, name, total_amount, installment_amount, total_installments,
  paid_installments, bank_id, due_day, start_date, auto_pay, last_paid_month,
  categories(id, label, icon, color)`

function mapRow(row) {
  const category = CATEGORIES.find(
    item => item.label?.toLowerCase() === row.categories?.label?.toLowerCase()
  )
  const paid = Number(row.paid_installments || 0)
  const total = Number(row.total_installments || 1)
  const startMonth = row.start_date ? row.start_date.slice(0, 7) : new Date().toISOString().slice(0, 7)

  return {
    id: row.id,
    source: 'manual',
    editable: true,
    description: row.name,
    category: category?.id ?? 'otros',
    categoryMeta: category || { id: 'otros', label: 'Otros', icon: '•', color: '#888880' },
    bank: row.bank_id ?? 'bchile',
    method: 'tarjeta',
    total: Number(row.total_amount || 0),
    installments: total,
    paid,
    monthlyAmount: Number(row.installment_amount || 0),
    startMonth,
    dayOfMonth: Number(row.due_day ?? 5),
    status: paid >= total ? 'paid' : 'active',
    autoPay: Boolean(row.auto_pay),
    notes: '',
    lastPaidMonth: row.last_paid_month || null,
  }
}

async function fetchManualInstallments() {
  const { data, error } = await supabase
    .from('installments')
    .select(FIELDS)
    .order('created_at')
  if (error) throw error
  return (data || []).map(mapRow)
}

async function toRow(debt) {
  const { forward } = await categoryMap()
  const selectedCategory = String(debt.category || '')
  const categoryId = selectedCategory.includes('-')
    ? selectedCategory
    : forward[selectedCategory] ?? null
  return {
    name: debt.description,
    total_amount: Number(debt.total || 0),
    installment_amount: Number(debt.monthlyAmount || 0),
    total_installments: Number(debt.installments || 1),
    paid_installments: Number(debt.paid ?? 0),
    bank_id: debt.bank ?? null,
    category_id: categoryId,
    due_day: Number(debt.dayOfMonth ?? 5),
    start_date: debt.startMonth ? `${debt.startMonth}-01` : null,
    auto_pay: Boolean(debt.autoPay),
  }
}

// Entrega planes bancarios conciliados con los seguimientos manuales.
// Dashboard, Reportes, Proyección y Cuentas reciben esta misma lista.
export async function fetchInstallments() {
  if (!isConfigured) return null

  const [manualResult, cyclesResult, cardsResult] = await Promise.allSettled([
    fetchManualInstallments(),
    fetchBillingCycles(),
    fetchMyCards(),
  ])

  if (manualResult.status === 'rejected') throw manualResult.reason

  const manual = manualResult.value || []
  const cycles = cyclesResult.status === 'fulfilled' ? cyclesResult.value || [] : []
  const cards = cardsResult.status === 'fulfilled' ? cardsResult.value || [] : []

  if (cyclesResult.status === 'rejected') {
    console.warn('fetchInstallments: Facturación no disponible; se usarán seguimientos manuales.', cyclesResult.reason)
  }

  return buildUnifiedInstallments(manual, cycles, cards).plans
}

export async function createInstallment(debt, userId) {
  const row = { ...(await toRow(debt)), user_id: userId }
  const { data, error } = await supabase
    .from('installments')
    .insert(row)
    .select(FIELDS)
    .single()
  if (error) throw error
  return mapRow(data)
}

export async function updateInstallment(debt) {
  const row = await toRow(debt)
  const { data, error } = await supabase
    .from('installments')
    .update(row)
    .eq('id', debt.id)
    .select(FIELDS)
    .single()
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
