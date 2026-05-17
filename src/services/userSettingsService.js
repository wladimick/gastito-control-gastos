import { supabase } from '../lib/supabase'

export async function fetchMyProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, is_active')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveMyProfile(patch) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No session')
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
  if (error) throw error
}

export async function fetchMySettings() {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveMySettings(userId, patch) {
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
