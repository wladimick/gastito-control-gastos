import { supabase, isConfigured } from '../lib/supabase'
import { CATEGORIES } from '../data'
import { reportDataHealth, reportMutationError } from '../lib/appEvents'

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

export async function fetchBudgets() {
  if (!isConfigured) return null
  const { data, error } = await supabase
    .from('budgets').select('amount, categories(label)').is('month', null)
  if (error) {
    reportDataHealth('budgets', 'error', 'No fue posible cargar los presupuestos.')
    throw error
  }
  reportDataHealth('budgets', 'complete')
  const result = {}
  for (const row of (data ?? [])) {
    const cat = CATEGORIES.find(c => c.label === row.categories?.label)
    if (cat) result[cat.id] = row.amount
  }
  return result
}

export async function upsertBudget(localCategoryId, amount, userId) {
  try {
    const { fwd } = await catMap()
    const catId = fwd[localCategoryId]
    if (!catId) throw new Error('La categoría no tiene equivalencia en Supabase.')

    const { data: existing, error: lookupError } = await supabase
      .from('budgets').select('id')
      .eq('user_id', userId).eq('category_id', catId).is('month', null)
      .maybeSingle()
    if (lookupError) throw lookupError

    if (existing) {
      const { error } = await supabase.from('budgets').update({ amount }).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('budgets')
        .insert({ user_id: userId, category_id: catId, amount, month: null })
      if (error) throw error
    }
  } catch (error) {
    reportMutationError('Guardar presupuesto', error)
    throw error
  }
}
