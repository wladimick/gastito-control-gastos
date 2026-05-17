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

// Returns { [localCategoryId]: amount } — same shape as BUDGETS in data.js
// Reads permanent budgets (month IS NULL)
export async function fetchBudgets() {
  if (!isConfigured) return null
  const { data, error } = await supabase
    .from('budgets').select('amount, categories(label)').is('month', null)
  if (error) throw error
  const result = {}
  for (const row of (data ?? [])) {
    const cat = CATEGORIES.find(c => c.label === row.categories?.label)
    if (cat) result[cat.id] = row.amount
  }
  return result
}

// Upserts a single category budget (select → insert or update, avoids NULL unique conflict)
export async function upsertBudget(localCategoryId, amount, userId) {
  const { fwd } = await catMap()
  const catId = fwd[localCategoryId]
  if (!catId) return

  const { data: existing } = await supabase
    .from('budgets').select('id')
    .eq('user_id', userId).eq('category_id', catId).is('month', null)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('budgets').update({ amount }).eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('budgets')
      .insert({ user_id: userId, category_id: catId, amount, month: null })
    if (error) throw error
  }
}
