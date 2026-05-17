import { supabase, isConfigured } from '../lib/supabase'
import { CATEGORIES } from '../data'

let _catMapP = null
async function catMap() {
  if (!isConfigured) return { fwd: {}, rev: {} }
  if (_catMapP) return _catMapP
  _catMapP = supabase.from('categories').select('id, label').is('user_id', null)
    .then(({ data }) => {
      const fwd = {}, rev = {}
      for (const r of (data ?? [])) {
        const local = CATEGORIES.find(c => c.label === r.label)
        if (local) { fwd[local.id] = r.id; rev[r.id] = local.id }
      }
      return { fwd, rev }
    })
    .catch(() => ({ fwd: {}, rev: {} }))
  return _catMapP
}

const FIELDS = `id, name, total_amount, installment_amount, total_installments,
  paid_installments, bank_id, due_day, start_date, auto_pay, last_paid_month, categories(label)`

function mapRow(row) {
  const cat   = CATEGORIES.find(c => c.label?.toLowerCase() === row.categories?.label?.toLowerCase())
  const paid  = row.paid_installments
  const total = row.total_installments
  const startMonth = row.start_date ? row.start_date.slice(0, 7) : new Date().toISOString().slice(0, 7)
  return {
    id:           row.id,
    description:  row.name,
    category:     cat?.id ?? 'otros',
    bank:         row.bank_id ?? 'bchile',
    method:       'tarjeta',
    total:        row.total_amount,
    installments: total,
    paid,
    monthlyAmount: row.installment_amount,
    startMonth,
    dayOfMonth:   row.due_day ?? 5,
    status:       paid >= total ? 'paid' : 'active',
    autoPay:      row.auto_pay,
    notes:        '',
  }
}

async function toRow(d) {
  const { fwd } = await catMap()
  return {
    name:               d.description,
    total_amount:       d.total,
    installment_amount: d.monthlyAmount,
    total_installments: d.installments,
    paid_installments:  d.paid ?? 0,
    bank_id:            d.bank ?? null,
    category_id:        fwd[d.category] ?? null,
    due_day:            d.dayOfMonth ?? 5,
    start_date:         d.startMonth ? d.startMonth + '-01' : null,
    auto_pay:           d.autoPay ?? false,
  }
}

export async function fetchInstallments() {
  if (!isConfigured) return null
  const { data, error } = await supabase.from('installments').select(FIELDS).order('created_at')
  if (error) throw error
  return data.map(mapRow)
}

export async function createInstallment(d, userId) {
  const row = { ...(await toRow(d)), user_id: userId }
  const { data, error } = await supabase.from('installments').insert(row).select(FIELDS).single()
  if (error) throw error
  return mapRow(data)
}

export async function updateInstallment(d) {
  const row = await toRow(d)
  const { data, error } = await supabase.from('installments').update(row).eq('id', d.id).select(FIELDS).single()
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
