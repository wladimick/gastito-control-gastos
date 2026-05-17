import { supabase, isConfigured } from '../lib/supabase'

// Unparsed messages (parsed=false) for the "Sin interpretar" view
export async function fetchUnparsedMessages() {
  if (!isConfigured) return null
  const { data, error } = await supabase
    .from('telegram_messages')
    .select('id, text, received_at, parse_error')
    .eq('parsed', false)
    .order('received_at', { ascending: false })
  if (error) throw error
  return data.map(row => ({
    id:       row.id,
    text:     row.text,
    received: row.received_at,
    guess:    null, // real messages don't carry a structured guess
  }))
}

// Most recent parsed message — used as lastBotMessage in Dashboard / TelegramSettings
export async function fetchLastBotMessage() {
  if (!isConfigured) return null
  const { data } = await supabase
    .from('telegram_messages')
    .select('text, received_at')
    .eq('parsed', true)
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return { text: data.text, at: data.received_at }
}
