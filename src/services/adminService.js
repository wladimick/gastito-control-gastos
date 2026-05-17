import { supabase } from '../lib/supabase'
import { BANKS } from '../data'

// ── Role helpers ─────────────────────────────────────────────

export async function fetchCurrentRole() {
  if (!supabase) return 'user'
  const { data, error } = await supabase.rpc('current_user_role')
  if (error) return 'user'
  return data ?? 'user'
}

// ── User management (super_admin only) ───────────────────────

export async function fetchUserList() {
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw error
  return data ?? []
}

export async function fetchUserDetails(userId) {
  const [profileRes, settingsRes, cardsRes, telegramRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('credit_cards').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('telegram_accounts')
      .select('id, telegram_username, chat_id, is_active, created_at')
      .eq('user_id', userId).maybeSingle(),
  ])
  return {
    profile:  profileRes.data,
    settings: settingsRes.data,
    cards:    (cardsRes.data ?? []).map(mapCard),
    telegram: telegramRes.data,
  }
}

export async function updateUserProfile(userId, patch) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw error
}

export async function updateUserSettings(userId, patch) {
  const { data: existing } = await supabase
    .from('user_settings').select('id').eq('user_id', userId).maybeSingle()
  if (existing) {
    const { error } = await supabase.from('user_settings').update(patch).eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('user_settings').insert({ user_id: userId, ...patch })
    if (error) throw error
  }
}

// ── Admin card management (for support use) ──────────────────

function mapCard(row) {
  return {
    id:             row.id,
    name:           row.name,
    bank:           row.bank_id,
    bankLabel:      BANKS.find(b => b.id === row.bank_id)?.label ?? (row.bank_id || '—'),
    lastFour:       row.last_four,
    billingDay:     row.billing_day,
    paymentDueDay:  row.payment_due_day,
    creditLimit:    row.credit_limit,
    isActive:       row.is_active,
  }
}

export async function createCardForUser(targetUserId, card) {
  const { data, error } = await supabase.from('credit_cards').insert({
    user_id:         targetUserId,
    name:            card.name,
    bank_id:         card.bank || null,
    last_four:       card.lastFour || null,
    billing_day:     card.billingDay ? Number(card.billingDay) : null,
    payment_due_day: card.paymentDueDay ? Number(card.paymentDueDay) : null,
    credit_limit:    card.creditLimit ? Number(card.creditLimit) : null,
    is_active:       true,
  }).select().single()
  if (error) throw error
  return mapCard(data)
}

export async function updateCardForUser(cardId, patch) {
  const { error } = await supabase.from('credit_cards').update(patch).eq('id', cardId)
  if (error) throw error
}

export async function removeCardForUser(cardId) {
  const { error } = await supabase.from('credit_cards').delete().eq('id', cardId)
  if (error) throw error
}

// ── Audit logging ─────────────────────────────────────────────

export async function logAdminAction(adminUserId, targetUserId, action, metadata = {}) {
  const { error } = await supabase.from('audit_logs').insert({
    user_id:       targetUserId,
    admin_user_id: adminUserId,
    actor:         'user',
    action:        `admin.${action}`,
    summary:       `Admin: ${action}`,
    metadata,
  })
  if (error) console.error('logAdminAction:', error)
}
