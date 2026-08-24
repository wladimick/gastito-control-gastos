import { supabase, isConfigured } from '../lib/supabase'

const FIELDS = `id, credit_card_id, cash_month, amount, confidence, source_file, notes, active, created_at, updated_at`

function mapRow(row) {
  return {
    id: row.id,
    cardId: row.credit_card_id,
    cashMonth: row.cash_month,
    amount: Number(row.amount || 0),
    confidence: row.confidence || 'statement_schedule',
    sourceFile: row.source_file || '',
    notes: row.notes || '',
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchBillingForecasts() {
  if (!isConfigured) return []
  const { data, error } = await supabase
    .from('billing_forecasts')
    .select(FIELDS)
    .eq('active', true)
    .order('cash_month')
  if (error) throw error
  return (data || []).map(mapRow)
}
