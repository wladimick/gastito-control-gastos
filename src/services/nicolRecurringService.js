import { supabase } from '../lib/supabase'

const FIELDS = 'id, name, amount, day_of_month, active, shared_with_nicol, category_id, updated_at'

function ensureSupabase() {
  if (!supabase) throw new Error('Supabase no está configurado')
}

export async function fetchNicolRecurringData(userId) {
  ensureSupabase()
  const [itemsResult, categoriesResult, linkResult] = await Promise.all([
    supabase
      .from('recurring_expenses')
      .select(FIELDS)
      .eq('user_id', userId)
      .eq('kind', 'expense')
      .order('active', { ascending: false })
      .order('day_of_month', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true }),
    supabase
      .from('categories')
      .select('id, user_id, label, icon, color, sort_order')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true }),
    supabase
      .from('billing_share_links')
      .select('id, percentage, active')
      .eq('user_id', userId)
      .eq('label', 'Nicol')
      .eq('active', true)
      .maybeSingle(),
  ])

  if (itemsResult.error) throw itemsResult.error
  if (categoriesResult.error) throw categoriesResult.error
  if (linkResult.error) throw linkResult.error

  return {
    items: itemsResult.data || [],
    categories: categoriesResult.data || [],
    percentage: Number(linkResult.data?.percentage ?? 33),
    hasActiveLink: Boolean(linkResult.data),
  }
}

export async function createNicolRecurringExpense(userId, input) {
  ensureSupabase()
  const name = String(input.name || '').trim()
  const amount = Math.round(Number(input.amount || 0))
  const day = input.dayOfMonth === '' || input.dayOfMonth == null ? null : Number(input.dayOfMonth)

  if (!name) throw new Error('Ingresa un nombre para el gasto')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('El monto debe ser mayor que cero')
  if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) throw new Error('El día debe estar entre 1 y 31')

  const { data, error } = await supabase
    .from('recurring_expenses')
    .insert({
      user_id: userId,
      kind: 'expense',
      name,
      amount,
      day_of_month: day,
      category_id: input.categoryId || null,
      active: true,
      auto_register: false,
      shared_with_nicol: input.sharedWithNicol !== false,
    })
    .select(FIELDS)
    .single()

  if (error) throw error
  return data
}

export async function updateNicolRecurringExpense(itemId, patch) {
  ensureSupabase()
  const update = {}

  if ('amount' in patch) {
    const amount = Math.round(Number(patch.amount || 0))
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('El monto debe ser mayor que cero')
    update.amount = amount
  }

  if ('dayOfMonth' in patch) {
    const day = patch.dayOfMonth === '' || patch.dayOfMonth == null ? null : Number(patch.dayOfMonth)
    if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) throw new Error('El día debe estar entre 1 y 31')
    update.day_of_month = day
  }

  if ('categoryId' in patch) update.category_id = patch.categoryId || null
  if ('sharedWithNicol' in patch) update.shared_with_nicol = Boolean(patch.sharedWithNicol)
  if ('active' in patch) update.active = Boolean(patch.active)
  update.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('recurring_expenses')
    .update(update)
    .eq('id', itemId)
    .select(FIELDS)
    .single()

  if (error) throw error
  return data
}
