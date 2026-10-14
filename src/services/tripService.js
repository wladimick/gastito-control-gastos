import { supabase } from '../lib/supabase'

const SLUG = 'matrimonio-antofagasta-2027'

function checkClient() {
  if (!supabase) throw new Error('No hay conexión con Supabase')
}

function normalizeItem(row) {
  return {
    id: row.id, category: row.category, name: row.name,
    estimate: row.estimated_amount, actual: row.actual_amount,
    status: row.status, note: row.note, url: row.booking_url, position: row.position,
  }
}

export async function fetchTripAdmin(userId) {
  checkClient()
  const { data: plan, error } = await supabase.from('trip_plans').select('*')
    .eq('user_id', userId).eq('slug', SLUG).maybeSingle()
  if (error) throw error
  if (!plan) throw new Error('No existe el viaje en tu cuenta. Verifica la configuración.')
  const [itemsResult, savingsResult] = await Promise.all([
    supabase.from('trip_budget_items').select('*').eq('trip_id', plan.id).order('position'),
    supabase.from('trip_savings').select('*').eq('trip_id', plan.id).order('contribution_date', { ascending: false }),
  ])
  if (itemsResult.error) throw itemsResult.error
  if (savingsResult.error) throw savingsResult.error
  return {
    id: plan.id, title: plan.title, destination: plan.destination,
    startDate: plan.start_date, weddingDate: plan.wedding_date, endDate: plan.end_date,
    peopleCount: plan.people_count, description: plan.description, shareActive: plan.share_active,
    items: (itemsResult.data || []).map(normalizeItem),
    savings: (savingsResult.data || []).map(row => ({
      id: row.id, name: row.contributor, amount: row.amount,
      date: row.contribution_date, note: row.note,
    })),
  }
}

export async function fetchTripPublic(token) {
  checkClient()
  if (!/^[0-9a-f]{48}$/.test(String(token || ''))) throw new Error('Enlace inválido')
  const { data, error } = await supabase.rpc('get_trip_share', { p_token: token })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.message || 'Enlace desactivado')
  return data
}

export async function updateTripItem(id, draft) {
  checkClient()
  const estimate = Number(draft.estimate)
  const actual = draft.actual === '' || draft.actual == null ? null : Number(draft.actual)
  if (!Number.isInteger(estimate) || estimate < 0 || (actual !== null && (!Number.isInteger(actual) || actual < 0))) {
    throw new Error('Los montos deben ser enteros positivos en pesos')
  }
  const url = String(draft.url || '').trim()
  if (url && !/^https:\/\//i.test(url)) throw new Error('El enlace debe comenzar con https://')
  const { error } = await supabase.from('trip_budget_items').update({
    estimated_amount: estimate, actual_amount: actual, status: draft.status,
    note: String(draft.note || '').slice(0,1200), booking_url: url,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
}

export async function addTripItem(tripId, name, category, estimate) {
  checkClient()
  const amount = Number(estimate)
  if (!name.trim() || !Number.isInteger(amount) || amount < 0) throw new Error('Completa un concepto y monto válidos')
  const { error } = await supabase.from('trip_budget_items').insert({
    trip_id: tripId, category, name: name.trim().slice(0,160),
    estimated_amount: amount, position: 999,
  })
  if (error) throw error
}

export async function addTripSaving(tripId, contributor, amount, note) {
  checkClient()
  const value = Number(amount)
  if (!['Wladimick','Nicol'].includes(contributor) || !Number.isInteger(value) || value <= 0) {
    throw new Error('Selecciona quién aportó y un monto válido')
  }
  const { error } = await supabase.from('trip_savings').insert({
    trip_id: tripId, contributor, amount: value,
    note: String(note || '').slice(0,300),
  })
  if (error) throw error
}

export async function removeTripSaving(id) {
  checkClient()
  const { error } = await supabase.from('trip_savings').delete().eq('id', id)
  if (error) throw error
}

export async function createTripShare(tripId) {
  checkClient()
  const { data, error } = await supabase.rpc('rotate_trip_share', { p_trip_id: tripId })
  if (error) throw error
  if (!data?.token) throw new Error('No se pudo generar el enlace')
  return data.token
}

export async function revokeTripShare(tripId) {
  checkClient()
  const { error } = await supabase.from('trip_plans').update({
    share_active: false, share_token_hash: null, updated_at: new Date().toISOString(),
  }).eq('id', tripId)
  if (error) throw error
}
