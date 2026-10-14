export function tripSummary(items = [], savings = []) {
  const budget = items.reduce((sum, row) => sum + Math.max(0, Number(row.estimate || 0)), 0)
  const spent = items.reduce((sum, row) => sum + Math.max(0, Number(row.actual || 0)), 0)
  const byName = { Wladimick: 0, Nicol: 0 }
  for (const row of savings) if (Object.prototype.hasOwnProperty.call(byName, row.name)) {
    byName[row.name] += Math.max(0, Number(row.amount || 0))
  }
  const saved = byName.Wladimick + byName.Nicol
  return {
    budget, spent, saved, byName,
    remaining: Math.max(0, budget - saved),
    difference: budget - spent,
    progress: budget ? Math.min(100, Math.round(saved / budget * 100)) : 0,
  }
}

export function monthlySavingSuggestion(remaining, tripDate, now = new Date()) {
  if (!tripDate) return { months: 0, perPerson: 0, together: 0 }
  const [year, month] = String(tripDate).slice(0, 7).split('-').map(Number)
  const target = year * 12 + month - 1
  const current = now.getFullYear() * 12 + now.getMonth()
  const months = Math.max(1, target - current)
  const together = Math.ceil(Math.max(0, remaining) / months / 1000) * 1000
  return { months, together, perPerson: Math.ceil(together / 2 / 1000) * 1000 }
}
