const KEY = 'gastito_billed_v1'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function persist(items) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function getBilledStatements() {
  return load()
}

// cardId + cycleKey (YYYY-MM of payment month) form the unique key
export function upsertBilledStatement(stmt) {
  const items = load()
  const idx = items.findIndex(s => s.cardId === stmt.cardId && s.cycleKey === stmt.cycleKey)
  const now = new Date().toISOString()
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...stmt, updatedAt: now }
  } else {
    items.push({
      id: crypto.randomUUID(),
      createdAt: now,
      ...stmt,
    })
  }
  persist(items)
  return items
}

export function deleteBilledStatement(cardId, cycleKey) {
  const items = load().filter(s => !(s.cardId === cardId && s.cycleKey === cycleKey))
  persist(items)
  return items
}
