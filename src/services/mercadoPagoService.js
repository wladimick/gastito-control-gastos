import { supabase, isConfigured } from '../lib/supabase'

export async function fetchMercadoPagoStatus() {
  if (!isConfigured || !supabase) return null
  const [{ data: config, error: configError }, { data: runs, error: runsError }] = await Promise.all([
    supabase
      .from('mercadopago_sync_config')
      .select('id, account_id, enabled, credential_state, status, mp_user_id, lookback_days, last_requested_at, last_sync_at, last_success_at, last_error, last_report_task_id, last_report_file, last_balance, last_balance_at, updated_at')
      .maybeSingle(),
    supabase
      .from('mercadopago_sync_runs')
      .select('id, trigger_source, status, started_at, finished_at, report_task_id, report_file, rows_seen, rows_inserted, expenses_created, balance, error_message, metadata')
      .order('started_at', { ascending: false })
      .limit(1),
  ])
  if (configError) throw configError
  if (runsError) throw runsError

  const { count: reviewCount, error: reviewError } = await supabase
    .from('mercadopago_movements')
    .select('id', { count: 'exact', head: true })
    .eq('review_status', 'review_required')
  if (reviewError) throw reviewError

  return {
    ...(config || {}),
    lastRun: runs?.[0] || null,
    reviewCount: Number(reviewCount || 0),
  }
}

export async function fetchMercadoPagoMovements({ limit = 100, reviewOnly = false } = {}) {
  if (!isConfigured || !supabase) return []
  let query = supabase
    .from('mercadopago_movements')
    .select(`
      id, source_id, external_reference, occurred_at, record_type, description, merchant,
      net_credit_amount, net_debit_amount, gross_amount, mp_fee_amount, taxes_amount,
      balance_amount, currency, payment_method, installments, classification,
      review_status, report_file, expense_id,
      category:categories(id, label, icon, color)
    `)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (reviewOnly) query = query.eq('review_status', 'review_required')
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function runMercadoPagoSync() {
  if (!isConfigured || !supabase) return null
  const { data, error } = await supabase.functions.invoke('mercadopago-sync', { body: {} })
  if (error) throw error
  return data
}

export async function setMercadoPagoEnabled(enabled) {
  if (!isConfigured || !supabase) return null
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const userId = authData?.user?.id
  if (!userId) throw new Error('Sesión no disponible')
  const { data, error } = await supabase
    .from('mercadopago_sync_config')
    .update({ enabled: Boolean(enabled), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markMercadoPagoMovement(id, reviewStatus) {
  if (!['verified', 'review_required', 'ignored'].includes(reviewStatus)) throw new Error('Estado inválido')
  const { error } = await supabase
    .from('mercadopago_movements')
    .update({ review_status: reviewStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
