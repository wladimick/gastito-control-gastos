import { supabase, isConfigured } from '../lib/supabase'
import {
  fetchExpenses as fetchLegacyExpenses,
  createExpense,
  updateExpense,
  patchExpense,
  removeExpense,
} from './expensesServiceV2'
import { removeLinkedManualDuplicates } from '../lib/movementAudit'

async function fetchLinkedManualExpenseIds() {
  if (!isConfigured) return new Set()
  const { data, error } = await supabase
    .from('billing_transactions')
    .select('manual_expense_id')
    .not('manual_expense_id', 'is', null)
  if (error) throw error
  return new Set((data || []).map(row => row.manual_expense_id).filter(Boolean))
}

export async function fetchExpenses() {
  const movements = await fetchLegacyExpenses()
  try {
    const linked = await fetchLinkedManualExpenseIds()
    return removeLinkedManualDuplicates(movements || [], linked)
  } catch (error) {
    console.warn('No fue posible aplicar deduplicación exacta manual/facturación:', error)
    return movements || []
  }
}

export {
  createExpense,
  updateExpense,
  patchExpense,
  removeExpense,
}
