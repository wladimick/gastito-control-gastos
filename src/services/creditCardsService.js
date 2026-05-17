import { supabase } from '../lib/supabase'

function mapCard(row) {
  return {
    id:            row.id,
    name:          row.name,
    bank:          row.bank_id,
    lastFour:      row.last_four,
    billingDay:    row.billing_day,
    paymentDueDay: row.payment_due_day,
    creditLimit:   row.credit_limit,
    isActive:      row.is_active,
  }
}

function toRow(card) {
  return {
    name:            card.name,
    bank_id:         card.bank || null,
    last_four:       card.lastFour?.trim() || null,
    billing_day:     card.billingDay     ? Number(card.billingDay)     : null,
    payment_due_day: card.paymentDueDay  ? Number(card.paymentDueDay)  : null,
    credit_limit:    card.creditLimit    ? Number(card.creditLimit)    : null,
    is_active:       card.isActive !== false,
  }
}

export async function fetchMyCards() {
  const { data, error } = await supabase
    .from('credit_cards').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map(mapCard)
}

export async function createCard(card, userId) {
  const { data, error } = await supabase
    .from('credit_cards').insert({ user_id: userId, ...toRow(card) }).select().single()
  if (error) throw error
  return mapCard(data)
}

export async function updateCard(card) {
  const { data, error } = await supabase
    .from('credit_cards').update(toRow(card)).eq('id', card.id).select().single()
  if (error) throw error
  return mapCard(data)
}

export async function removeCard(id) {
  const { error } = await supabase.from('credit_cards').delete().eq('id', id)
  if (error) throw error
}
