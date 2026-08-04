import { supabase } from '../lib/supabase'

function ensureSupabase() {
  if (!supabase) throw new Error('Supabase no está configurado')
}

export async function fetchPublicNicolShare(token) {
  ensureSupabase()
  const cleanToken = String(token || '').trim()
  if (!cleanToken) throw new Error('El enlace no contiene un token válido')

  const { data, error } = await supabase.rpc('get_nicol_share', { p_token: cleanToken })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.message || 'El enlace no existe o fue desactivado')
  return data
}

export async function fetchNicolAdminData(userId) {
  ensureSupabase()
  const [cyclesResult, transactionsResult, cardsResult, categoriesResult, linkResult] = await Promise.all([
    supabase
      .from('billing_cycles')
      .select('id, cycle_key, period_start, period_end, closing_date, due_date, status, reported_amount, estimated_amount, reconciliation_status, credit_card_id')
      .eq('user_id', userId)
      .order('cycle_key', { ascending: false })
      .order('due_date', { ascending: false }),
    supabase
      .from('billing_transactions')
      .select('id, billing_cycle_id, transaction_date, description, movement_type, amount, original_amount, installment_current, installment_total, installments_remaining, affects_cycle_total, is_pending, review_status, shared_with_nicol, category_id')
      .eq('user_id', userId)
      .eq('affects_cycle_total', true)
      .gt('amount', 0)
      .not('movement_type', 'in', '(payment,credit)')
      .order('transaction_date', { ascending: false }),
    supabase
      .from('credit_cards')
      .select('id, name, last_four')
      .eq('user_id', userId),
    supabase
      .from('categories')
      .select('id, user_id, label, icon, color, sort_order')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true }),
    supabase
      .from('billing_share_links')
      .select('id, label, percentage, active, created_at, updated_at')
      .eq('user_id', userId)
      .eq('label', 'Nicol')
      .eq('active', true)
      .maybeSingle(),
  ])

  if (cyclesResult.error) throw cyclesResult.error
  if (transactionsResult.error) throw transactionsResult.error
  if (cardsResult.error) throw cardsResult.error
  if (categoriesResult.error) throw categoriesResult.error
  if (linkResult.error) throw linkResult.error

  const cardsById = new Map((cardsResult.data || []).map(card => [card.id, card]))
  const cycles = (cyclesResult.data || []).map(cycle => {
    const card = cardsById.get(cycle.credit_card_id)
    return {
      ...cycle,
      card_name: card?.name || 'Tarjeta',
      card_last_four: card?.last_four || '',
    }
  })

  return {
    cycles,
    transactions: transactionsResult.data || [],
    categories: categoriesResult.data || [],
    link: linkResult.data || null,
  }
}

export async function setNicolTransactionShared(transactionId, shared) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('billing_transactions')
    .update({ shared_with_nicol: Boolean(shared), updated_at: new Date().toISOString() })
    .eq('id', transactionId)
    .select('id, shared_with_nicol, category_id')
    .single()
  if (error) throw error
  return data
}

export async function setNicolTransactionCategory(transactionId, categoryId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('billing_transactions')
    .update({ category_id: categoryId || null, updated_at: new Date().toISOString() })
    .eq('id', transactionId)
    .select('id, category_id, shared_with_nicol')
    .single()
  if (error) throw error
  return data
}

export async function setNicolCycleTransactions(transactionIds, shared) {
  ensureSupabase()
  if (!transactionIds.length) return []
  const { data, error } = await supabase
    .from('billing_transactions')
    .update({ shared_with_nicol: Boolean(shared), updated_at: new Date().toISOString() })
    .in('id', transactionIds)
    .select('id, shared_with_nicol, category_id')
  if (error) throw error
  return data || []
}

export async function createOrRotateNicolShare(percentage = 33) {
  ensureSupabase()
  const { data, error } = await supabase.rpc('create_or_rotate_nicol_share', {
    p_percentage: Number(percentage),
  })
  if (error) throw error
  if (!data?.token) throw new Error('Supabase no devolvió el nuevo token')
  return data
}

export async function updateNicolSharePercentage(linkId, percentage) {
  ensureSupabase()
  const { data, error } = await supabase
    .from('billing_share_links')
    .update({ percentage: Number(percentage), updated_at: new Date().toISOString() })
    .eq('id', linkId)
    .select('id, label, percentage, active, created_at, updated_at')
    .single()
  if (error) throw error
  return data
}

export async function revokeNicolShare(linkId) {
  ensureSupabase()
  const { error } = await supabase
    .from('billing_share_links')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', linkId)
  if (error) throw error
}
