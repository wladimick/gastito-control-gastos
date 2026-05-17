import { useState, useEffect } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { BANKS as LOCAL_BANKS } from '../data'

export async function fetchBanks() {
  if (!isConfigured) return LOCAL_BANKS
  try {
    const { data, error } = await supabase.from('banks').select('id, label').order('label')
    if (error || !data?.length) return LOCAL_BANKS
    return data.map(r => ({ id: r.id, label: r.label }))
  } catch {
    return LOCAL_BANKS
  }
}

export function useBanks() {
  const [banks, setBanks] = useState(LOCAL_BANKS)
  useEffect(() => {
    fetchBanks().then(setBanks).catch(() => {})
  }, [])
  return banks
}
