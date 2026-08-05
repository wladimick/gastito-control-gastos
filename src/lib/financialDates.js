export const SANTIAGO_TIME_ZONE = 'America/Santiago'

function partsFor(value, options) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SANTIAGO_TIME_ZONE,
    ...options,
  }).formatToParts(date)
  return Object.fromEntries(parts.map(part => [part.type, part.value]))
}

export function dateOnlyCL(value) {
  if (!value) return ''
  const raw = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parts = partsFor(value, { year: 'numeric', month: '2-digit', day: '2-digit' })
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : ''
}

export function monthKeyCL(value = new Date()) {
  return dateOnlyCL(value).slice(0, 7)
}

export function todayDateOnlyCL(now = new Date()) {
  return dateOnlyCL(now)
}

export function parseDateOnly(value) {
  const day = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date, 12))
}

export function formatDateCL(value, options = {}) {
  const day = dateOnlyCL(value)
  const date = parseDateOnly(day)
  if (!date) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...options,
  }).format(date)
}

export function monthLabelCL(key, short = false) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return key || 'Sin mes'
  const label = new Intl.DateTimeFormat('es-CL', {
    month: short ? 'short' : 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function previousMonthKey(key) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return ''
  const date = new Date(Date.UTC(year, month - 2, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function daysInMonthKey(key) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return 0
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function dayOfMonthCL(value = new Date()) {
  return Number(dateOnlyCL(value).slice(8, 10)) || 1
}

export function compareDateOnly(left, right) {
  return dateOnlyCL(left).localeCompare(dateOnlyCL(right))
}

export function billingCycleAmount(cycle) {
  const reported = Number(cycle?.reportedAmount || 0)
  const estimated = Number(cycle?.estimatedAmount || 0)
  const calculated = Number(cycle?.calculatedAmount || 0)
  if (cycle?.reportedAmountIsFinal && reported > 0) return reported
  return Math.max(reported, estimated, calculated)
}

export function isCyclePending(cycle) {
  return cycle?.status !== 'paid' && billingCycleAmount(cycle) > 0
}
