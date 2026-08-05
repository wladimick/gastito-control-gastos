const LEGACY_KEY = 'gastito_billed_v1'

function clearLegacyStorage() {
  try { localStorage.removeItem(LEGACY_KEY) } catch {}
}

// Compatibilidad temporal con App.jsx. Los montos reales ahora provienen
// exclusivamente de billing_cycles en Supabase.
export function getBilledStatements() {
  clearLegacyStorage()
  return []
}

export function upsertBilledStatement() {
  clearLegacyStorage()
  return []
}

export function deleteBilledStatement() {
  clearLegacyStorage()
  return []
}
