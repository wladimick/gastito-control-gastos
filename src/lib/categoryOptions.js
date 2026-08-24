const ALIASES = new Map([
  ['mascotas', 'mascota'],
  ['préstamos', 'préstamo'],
  ['regalos', 'regalo'],
  ['salidas', 'entretenimiento / salidas'],
])

function normalizedLabel(category) {
  return String(category?.label || '').trim().toLocaleLowerCase('es-CL')
}

/**
 * Keeps saved category IDs intact while removing equivalent choices from new
 * selectors. This lets historical rows using an old plural label render safely.
 */
export function uniqueCategoryOptions(categories = []) {
  const options = new Map()
  for (const category of categories) {
    const label = normalizedLabel(category)
    const key = ALIASES.get(label) || label
    const current = options.get(key)
    const isCanonical = label === key
    if (!current || isCanonical) options.set(key, category)
  }
  return [...options.values()].sort((a, b) => String(a.label).localeCompare(String(b.label), 'es'))
}

export function categoryLabel(category) {
  if (!category) return 'Sin categoría'
  const label = String(category.label || '').trim()
  const canonical = ALIASES.get(label.toLocaleLowerCase('es-CL'))
  return canonical ? canonical.replace(/^./, letter => letter.toUpperCase()) : label
}
