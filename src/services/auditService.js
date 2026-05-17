import { supabase, isConfigured } from '../lib/supabase'

export async function fetchAuditLog() {
  if (!isConfigured) return null
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor, action, target_id, target_type, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return []
  return data.map(row => ({
    id:      row.id,
    at:      row.created_at,
    actor:   row.actor,
    action:  row.action,
    target:  row.target_id ?? row.target_type ?? '',
    summary: row.summary ?? '',
  }))
}
