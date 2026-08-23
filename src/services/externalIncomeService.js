import { supabase, isConfigured } from '../lib/supabase'

export async function fetchExternalIncomeSources() {
  if (!isConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('external_income_sources')
    .select('id,name,provider,destination,currency,frequency_months,estimated_amount,current_balance,last_received_at,next_expected_date,active,automation_state,notes,updated_at')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data || []
}

export async function fetchExternalIncomeEvents(sourceId, limit = 100) {
  if (!isConfigured || !supabase || !sourceId) return []
  const { data, error } = await supabase
    .from('external_income_events')
    .select('id,event_type,occurred_at,amount,currency,description,destination,external_ref,notes,raw_metadata')
    .eq('source_id', sourceId)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}
