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

const FIELDS = `id, name, amount, bank_id, payment_method_id, card_type,
  day_of_month, active, auto_register, last_charged_month, categories(label)`

function mapRow(row) {
  const cat = CATEGORIES.find(c => c.label?.toLowerCase() === row.categories?.label?.toLowerCase())
  return {
    id:               row.id,
    name:             row.name,
    amount:           row.amount,
    category:         cat?.id ?? 'otros',
    bank:             row.bank_id ?? 'bchile',
    method:           row.payment_method_id ?? 'tarjeta',
    type:             row.card_type ?? 'debito',
    dayOfMonth:       row.day_of_month,
    active:           row.active,
    autoRegister:     row.auto_register,
    lastChargedMonth: row.last_charged_month ?? null,
  }
}

async function toRow(r) {
  const { fwd } = await catMap()
  return {
    name:               r.name,
    amount:             r.amount,
    category_id:        fwd[r.category] ?? null,
    bank_id:            r.bank ?? null,
    payment_method_id:  r.method ?? 'tarjeta',
    card_type:          r.type ?? 'debito',
    day_of_month:       r.dayOfMonth ?? 1,
    active:             r.active ?? true,
    auto_register:      r.autoRegister ?? false,
    last_charged_month: r.lastChargedMonth ?? null,
  }
}

export async function fetchRecurring() {
  if (!isConfigured) return null
  const { data, error } = await supabase
    .from('recurring_expenses').select(FIELDS).order('day_of_month')
  if (error) throw error
  return data.map(mapRow)
}

export async function createRecurring(r, userId) {
  const row = { ...(await toRow(r)), user_id: userId }
  const { data, error } = await supabase
    .from('recurring_expenses').insert(row).select(FIELDS).single()
  if (error) throw error
  return mapRow(data)
}

export async function updateRecurring(r) {
  const row = await toRow(r)
  const { data, error } = await supabase
    .from('recurring_expenses').update(row).eq('id', r.id).select(FIELDS).single()
  if (error) throw error
  return mapRow(data)
}

export async function patchRecurring(id, patch) {
  const { error } = await supabase.from('recurring_expenses').update(patch).eq('id', id)
  if (error) throw error
}

export async function removeRecurring(id) {
  const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
  if (error) throw error
}
