import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIES } from '../data'

// Merge global (user_id IS NULL) + user's own categories
export async function fetchAllCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, label, icon, color, sort_order, user_id')
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map(row => ({
    id:       row.id,
    label:    row.label,
    icon:     row.icon ?? '•',
    color:    row.color ?? '#888880',
    isGlobal: row.user_id === null,
    userId:   row.user_id,
  }))
}

export async function createUserCategory(cat, userId) {
  const { data, error } = await supabase.from('categories').insert({
    user_id:    userId,
    label:      cat.label,
    icon:       cat.icon || '•',
    color:      cat.color || '#888880',
    sort_order: 100,
  }).select().single()
  if (error) throw error
  return { id: data.id, label: data.label, icon: data.icon, color: data.color, isGlobal: false }
}

export async function updateUserCategory(cat) {
  const { error } = await supabase.from('categories').update({
    label: cat.label,
    icon:  cat.icon || '•',
    color: cat.color || '#888880',
  }).eq('id', cat.id)
  if (error) throw error
}

export async function removeUserCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

export function useCategories() {
  const [categories, setCategories] = useState(CATEGORIES)
  useEffect(() => {
    fetchAllCategories()
      .then(cats => { if (cats?.length) setCategories(cats) })
      .catch(() => {})
  }, [])
  return categories
}
