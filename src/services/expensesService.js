import { supabase, isConfigured } from '../lib/supabase'
import { CATEGORIES } from '../data'

// Mapea una fila de Supabase al formato que espera la app (igual a data.js)
function mapRow(row) {
  const cat = CATEGORIES.find(
    c => c.label.toLowerCase() === row.categories?.label?.toLowerCase()
  )
  return {
    id:           row.id,
    amount:       row.amount,
    description:  row.description,
    category:     cat?.id ?? 'otros',
    bank:         row.bank_id ?? 'efectivo',
    method:       row.payment_method_id ?? 'tarjeta',
    type:         row.card_type ?? 'debito',
    installments: row.installments_count ?? 1,
    status:       row.status ?? 'ok',
    date:         row.expense_date,
    notes:        row.notes ?? '',
  }
}

/**
 * Lee todos los gastos del usuario autenticado.
 * Retorna null si Supabase no está configurado.
 * Retorna [] si hay sesión pero no hay datos (RLS sin sesión también retorna []).
 * Lanza error si la query falla.
 */
export async function fetchExpenses() {
  if (!isConfigured) return null

  const { data, error } = await supabase
    .from('expenses')
    .select(`
      id, amount, description, bank_id, payment_method_id,
      card_type, installments_count, status, expense_date, notes,
      categories ( label )
    `)
    .order('expense_date', { ascending: false })

  if (error) throw error
  return data.map(mapRow)
}
