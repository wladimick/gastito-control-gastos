import { useState, useEffect } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { BANKS as LOCAL_BANKS } from '../data'

export async function fetchBanks() {
  if (!isConfigured) return LOCAL_BANKS
  try {
    const { data, error } = await supabase
      .from('banks')
      .select('id, label, color, logo_url, is_active, sort_order')
      .order('sort_order', { nullsFirst: false })
      .order('label')
    if (error || !data?.length) return LOCAL_BANKS
    return data.map(r => ({
      id:        r.id,
      label:     r.label,
      color:     r.color    || null,
      logoUrl:   r.logo_url || null,
      isActive:  r.is_active !== false,
      sortOrder: r.sort_order,
    }))
  } catch {
    return LOCAL_BANKS
  }
}

export async function updateBankBranding(id, { label, color, logoUrl }) {
  if (!isConfigured) throw new Error('Supabase no configurado')
  const { error } = await supabase
    .from('banks')
    .update({ label, color: color || null, logo_url: logoUrl || null })
    .eq('id', id)
  if (error) throw error
}

export function useBanks() {
  const [banks, setBanks] = useState(LOCAL_BANKS)
  useEffect(() => {
    fetchBanks().then(setBanks).catch(() => {})
  }, [])
  return banks
}
