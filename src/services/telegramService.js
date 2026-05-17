import { supabase } from '../lib/supabase'

// Genera un código de 6 chars, lo guarda en linking_codes y lo retorna
export async function generateLinkingCode() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa')

  const code = Math.random().toString(36).substring(2, 8).toUpperCase()

  // Upsert: reemplaza código anterior del mismo usuario
  const { error } = await supabase
    .from('linking_codes')
    .upsert(
      {
        code,
        user_id:    user.id,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) throw error
  return code
}

// Retorna la cuenta de Telegram vinculada al usuario actual, o null
export async function getLinkedAccount() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('telegram_accounts')
    .select('id, telegram_username, chat_id, is_active, created_at')
    .eq('user_id', user.id)
    .single()

  return data ?? null
}

// Desvincula la cuenta de Telegram
export async function unlinkAccount(id) {
  const { error } = await supabase
    .from('telegram_accounts')
    .delete()
    .eq('id', id)

  if (error) throw error
}
