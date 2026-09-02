const ALLOWED_MOVEMENT_TYPES = new Set([
  'purchase',
  'installment',
  'commission',
  'tax',
  'interest',
  'payment',
  'credit',
  'other',
])

function firstDefined(object, keys) {
  for (const key of keys) {
    const value = object?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function parseClpAmount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Number.isInteger(value) ? value : NaN
  }

  if (typeof value !== 'string') return NaN
  let normalized = value.trim().replace(/\s/g, '').replace(/^CLP/i, '').replace(/^\$/i, '')
  if (!normalized) return NaN

  // Formato chileno habitual: 13.756 o 1.234.567. Si viene un número
  // plano (13756), se conserva tal cual.
  if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) normalized = normalized.replace(/\./g, '')
  normalized = normalized.replace(/,/g, '.')

  const number = Number(normalized)
  return Number.isFinite(number) && Number.isInteger(number) ? number : NaN
}

function parsePositiveInteger(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : NaN
}

function normalizeDate(value) {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return ''
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return ''
  return text
}

export function normalizeBillingDescription(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
}

function inferMovementType(rawType, description, installmentTotal) {
  const explicit = String(rawType || '').trim().toLowerCase()
  if (explicit) return ALLOWED_MOVEMENT_TYPES.has(explicit) ? explicit : ''

  const normalized = normalizeBillingDescription(description)
  if (normalized.startsWith('impuesto')) return 'tax'
  if (normalized.includes('interes')) return 'interest'
  if (normalized.includes('comision')) return 'commission'
  if (installmentTotal > 1) return 'installment'
  return 'purchase'
}

export function parseBillingJson(input) {
  let root
  try {
    root = typeof input === 'string' ? JSON.parse(input) : input
  } catch (error) {
    return {
      rootError: `JSON inválido: ${error.message}`,
      meta: {},
      items: [],
      validTransactions: [],
      payload: null,
      totals: { rows: 0, valid: 0, errors: 1, amount: 0 },
    }
  }

  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return {
      rootError: 'El JSON debe ser un objeto con un arreglo "transactions".',
      meta: {},
      items: [],
      validTransactions: [],
      payload: null,
      totals: { rows: 0, valid: 0, errors: 1, amount: 0 },
    }
  }

  const rawTransactions = firstDefined(root, ['transactions', 'movements', 'movimientos', 'pagos'])
  if (!Array.isArray(rawTransactions) || rawTransactions.length === 0) {
    return {
      rootError: 'El JSON no contiene movimientos en "transactions".',
      meta: {},
      items: [],
      validTransactions: [],
      payload: null,
      totals: { rows: 0, valid: 0, errors: 1, amount: 0 },
    }
  }

  const meta = {
    bank: firstDefined(root, ['bank', 'banco']) || '',
    card: firstDefined(root, ['card', 'tarjeta']) || '',
    source: firstDefined(root, ['source', 'origen']) || 'Gastito · JSON manual',
  }

  const items = rawTransactions.map((raw, index) => {
    const errors = []
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { row: index + 1, raw, status: 'error', errors: ['El movimiento debe ser un objeto.'] }
    }

    const date = normalizeDate(firstDefined(raw, ['date', 'fecha']))
    const description = String(firstDefined(raw, ['description', 'descripcion', 'comercio']) || '').trim().replace(/\s+/g, ' ')
    const amount = parseClpAmount(firstDefined(raw, ['amount', 'monto']))
    const installmentTotal = parsePositiveInteger(firstDefined(raw, ['installment_total', 'installments_total', 'cuotas_totales']), 1)
    const installmentCurrent = parsePositiveInteger(firstDefined(raw, ['installment_current', 'cuota_actual']), 1)
    const originalAmountRaw = firstDefined(raw, ['original_amount', 'monto_original'])
    const originalAmount = originalAmountRaw === undefined ? null : parseClpAmount(originalAmountRaw)
    const movementType = inferMovementType(firstDefined(raw, ['movement_type', 'tipo']), description, installmentTotal)

    if (!date) errors.push('Fecha inválida; usa YYYY-MM-DD.')
    if (!description) errors.push('Falta la descripción.')
    if (!Number.isInteger(amount) || amount <= 0) errors.push('El monto debe ser un entero CLP mayor que cero.')
    if (!Number.isInteger(installmentTotal) || installmentTotal < 1) errors.push('El total de cuotas debe ser un entero mayor que cero.')
    if (!Number.isInteger(installmentCurrent) || installmentCurrent < 1) errors.push('La cuota actual debe ser un entero mayor que cero.')
    if (Number.isInteger(installmentCurrent) && Number.isInteger(installmentTotal) && installmentCurrent > installmentTotal) {
      errors.push('La cuota actual no puede ser mayor que el total de cuotas.')
    }
    if (originalAmountRaw !== undefined && (!Number.isInteger(originalAmount) || originalAmount <= 0)) {
      errors.push('El monto original debe ser un entero CLP mayor que cero.')
    }
    if (!movementType) errors.push('Tipo de movimiento no reconocido.')

    const normalized = {
      source_row: index + 1,
      date,
      description,
      amount,
      movement_type: movementType,
      installment_current: installmentCurrent,
      installment_total: installmentTotal,
      original_amount: originalAmount,
    }

    return {
      row: index + 1,
      raw,
      normalized,
      status: errors.length ? 'error' : 'valid',
      errors,
    }
  })

  const validTransactions = items
    .filter(item => item.status === 'valid')
    .map(item => item.normalized)

  return {
    rootError: '',
    meta,
    items,
    validTransactions,
    payload: {
      bank: meta.bank,
      card: meta.card,
      source: meta.source,
      transactions: validTransactions,
    },
    totals: {
      rows: items.length,
      valid: validTransactions.length,
      errors: items.filter(item => item.status === 'error').length,
      amount: validTransactions.reduce((sum, item) => sum + item.amount, 0),
    },
  }
}

export { ALLOWED_MOVEMENT_TYPES }
