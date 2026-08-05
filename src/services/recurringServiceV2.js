import { supabase, isConfigured } from '../lib/supabase'
import { CATEGORIES } from '../data'
import { reportDataHealth, reportMutationError } from '../lib/appEvents'

let _catMapP = null
async function catMap() {
  if (!isConfigured) return { fwd: {}, rev: {} }
  if (_catMapP) return _catMapP
  _catMapP = supabase.from('categories').select('id, label').is('user_id', null)
    .then(({ data }) => {
      const fwd = {}, rev = {}
      for (const r of (data ?? [])) {
        const local = CATEGORIES.find(c => c.label?.toLowerCase() === r.label?.toLowerCase())
        if (local) { fwd[local.id] = r.id; rev[r.id] = local.id }
      }
      return { fwd, rev }
    })
    .catch(() => ({ fwd: {}, rev: {} }))
  return _catMapP
}

const META_SEP = '||__gc__:'
const META_REGEX = /\|\|__gc__:.*$/

function parseMeta(notes) {
  if (!notes) return {}
  const idx = notes.indexOf(META_SEP)
  if (idx === -1) return {}
  try { return JSON.parse(notes.slice(idx + META_SEP.length)) } catch { return {} }
}

function buildNotes(rawNotes, meta) {
  const clean = rawNotes ? rawNotes.replace(META_REGEX, '').trim() : ''
  const payload = {}
  if (meta.comisionBancaria) payload.comisionBancaria = true
  if (meta.medio) payload.medio = meta.medio
  if (!Object.keys(payload).length) return clean || null
  return clean + META_SEP + JSON.stringify(payload)
}

function detectComision(name) {
  return /comisi[oó]n|mantenci[oó]n|mantenimiento|mantenci[oó]n\s+tarjeta|administraci[oó]n|seguro\s+(tarjeta|cuenta)/i.test(name ?? '')
}

const FIELDS = `id, name, amount, bank_id, payment_method_id, card_type,
  day_of_month, active, auto_register, last_charged_month, categories(label),
  kind, person_name, description, due_date, status, paid_at, notes`

function mapRow(row) {
  const meta = parseMeta(row.notes)
  const comisionBancaria = meta.comisionBancaria ?? detectComision(row.name)
  const medio = meta.medio ?? ''
  const cleanNotes = row.notes ? row.notes.replace(META_REGEX, '').trim() || null : null
  const catByLabel = CATEGORIES.find(c => c.label?.toLowerCase() === row.categories?.label?.toLowerCase())
  const category = comisionBancaria ? 'comision_bancaria' : (catByLabel?.id ?? 'otros')

  return {
    id: row.id,
    kind: row.kind ?? 'expense',
    name: row.name,
    amount: row.amount,
    category,
    bank: row.bank_id ?? null,
    method: row.payment_method_id ?? 'tarjeta',
    type: row.card_type ?? 'debito',
    dayOfMonth: row.day_of_month ?? null,
    active: row.active,
    autoRegister: row.auto_register,
    lastChargedMonth: row.last_charged_month ?? null,
    personName: row.person_name ?? null,
    description: row.description ?? null,
    dueDate: row.due_date ?? null,
    status: row.status ?? null,
    paidAt: row.paid_at ?? null,
    notes: cleanNotes,
    comisionBancaria,
    medio,
  }
}

async function toRow(r, kind) {
  const { fwd } = await catMap()
  return {
    kind,
    name: r.name || r.personName || 'Sin nombre',
    amount: r.amount,
    category_id: fwd[r.category] ?? null,
    active: r.active ?? true,
    auto_register: r.autoRegister ?? false,
    last_charged_month: r.lastChargedMonth ?? null,
    bank_id: r.bank || null,
    payment_method_id: r.method || null,
    card_type: r.type || null,
    day_of_month: r.dayOfMonth ? Number(r.dayOfMonth) : null,
    person_name: r.personName || null,
    description: r.description || null,
    due_date: r.dueDate || null,
    status: r.status || (kind === 'receivable' || kind === 'payable' ? 'pending' : null),
    paid_at: r.paidAt || null,
    notes: buildNotes(r.notes, { comisionBancaria: r.comisionBancaria, medio: r.medio }),
  }
}

async function fetchByKind(kind) {
  if (!isConfigured) return null
  const order = (kind === 'expense' || kind === 'income') ? 'day_of_month' : 'due_date'
  const { data, error } = await supabase
    .from('recurring_expenses').select(FIELDS).eq('kind', kind).order(order)
  if (error) {
    reportDataHealth('recurring', 'error', 'No fue posible cargar los registros recurrentes.')
    throw error
  }
  reportDataHealth('recurring', 'complete')
  return data.map(mapRow)
}

async function runMutation(context, callback) {
  try {
    return await callback()
  } catch (error) {
    reportMutationError(context, error)
    throw error
  }
}

export const fetchRecurring = () => fetchByKind('expense')
export const fetchIncome = () => fetchByKind('income')
export const fetchReceivables = () => fetchByKind('receivable')
export const fetchPayables = () => fetchByKind('payable')

export async function createItem(item, userId, kind) {
  return runMutation(`Crear ${kind === 'income' ? 'ingreso' : kind === 'receivable' ? 'por cobrar' : kind === 'payable' ? 'por pagar' : 'recurrente'}`, async () => {
    const row = { ...(await toRow(item, kind)), user_id: userId }
    const { data, error } = await supabase
      .from('recurring_expenses').insert(row).select(FIELDS).single()
    if (error) throw error
    return mapRow(data)
  })
}

export async function updateItem(item) {
  return runMutation('Editar recurrente', async () => {
    const row = await toRow(item, item.kind ?? 'expense')
    const { data, error } = await supabase
      .from('recurring_expenses').update(row).eq('id', item.id).select(FIELDS).single()
    if (error) throw error
    return mapRow(data)
  })
}

export async function patchRecurring(id, patch) {
  return runMutation('Actualizar recurrente', async () => {
    const { error } = await supabase.from('recurring_expenses').update(patch).eq('id', id)
    if (error) throw error
  })
}

export async function removeRecurring(id) {
  return runMutation('Eliminar recurrente', async () => {
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
    if (error) throw error
  })
}

export async function createRecurring(r, userId) { return createItem(r, userId, 'expense') }
export async function updateRecurring(r) { return updateItem(r) }
export const patchItem = patchRecurring
export const removeItem = removeRecurring
