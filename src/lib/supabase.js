import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// null cuando las variables no están configuradas — app corre con data.js
export const supabase = url && key ? createClient(url, key) : null
export const isConfigured = Boolean(url && key)
