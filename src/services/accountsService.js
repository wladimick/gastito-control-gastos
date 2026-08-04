import { supabase, isConfigured } from '../lib/supabase'

function mapRow(row) {
  return {
    id:        row.id,
    name:      row.name,
    type:      row.type,
    bankId:    row.bank_id ?? null,
    balance:   Number(row.balance ?? 0),
    active:    row.active,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

export async function fetchAccounts() {
  if (!isConfigured) return []
  const { data, error } = await supabase.from('accounts').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function createAccount(a, userId) {
  const { data, error } = await supabase.from('accounts')
    .insert({
      user_id: userId,
      name:    a.name,
      type:    a.type,
      bank_id: a.bankId || null,
      balance: a.balance ?? 0,
      active:  a.active ?? true,
    })
    .select('*').single()
  if (error) throw error
  return mapRow(data)
}

export async function updateAccount(a) {
  const { data, error } = await supabase.from('accounts')
    .update({
      name:    a.name,
      type:    a.type,
      bank_id: a.bankId || null,
      balance: a.balance ?? 0,
      active:  a.active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', a.id)
    .select('*').single()
  if (error) throw error
  return mapRow(data)
}

export async function patchAccount(id, patch) {
  const { error } = await supabase.from('accounts').update({
    ...patch,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
}

export async function removeAccount(id) {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}
