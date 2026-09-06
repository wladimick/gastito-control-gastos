import { supabase, isConfigured } from '../lib/supabase'
import { parseBillingJson } from '../lib/billingJsonImport'

function ensureConfigured() {
  if (!isConfigured || !supabase) throw new Error('Supabase no está configurado.')
}

async function runImportRpc(creditCardId, payload, preview) {
  ensureConfigured()
  if (!creditCardId) throw new Error('Selecciona una tarjeta antes de continuar.')
  if (!payload?.transactions?.length) throw new Error('No hay movimientos válidos para procesar.')

  const { data, error } = await supabase.rpc('import_billing_json', {
    p_credit_card_id: creditCardId,
    p_payload: payload,
    p_preview: preview,
  })

  if (error) throw error
  return data || { summary: {}, items: [] }
}

export async function previewBillingJsonImport({ creditCardId, json }) {
  const parsed = parseBillingJson(json)
  if (parsed.rootError) return { parsed, server: null }
  if (!parsed.validTransactions.length) return { parsed, server: null }

  const server = await runImportRpc(creditCardId, parsed.payload, true)
  return { parsed, server }
}

export async function commitBillingJsonImport({ creditCardId, parsed }) {
  if (!parsed?.payload?.transactions?.length) throw new Error('No hay movimientos válidos para importar.')
  return runImportRpc(creditCardId, parsed.payload, false)
}
