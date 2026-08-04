import { supabase, isConfigured } from '../lib/supabase'

const CYCLE_SELECT = `
  id, user_id, credit_card_id, cycle_key,
  period_start, period_end, closing_date, due_date, payment_date,
  status, reported_amount, reported_amount_is_final, minimum_payment,
  estimated_amount, reconciliation_status, source_file, notes,
  imported_at, created_at, updated_at,
  billing_transactions (
    id, bank_id, transaction_date, description, movement_type,
    amount, original_amount, installment_current, installment_total,
    installments_remaining, currency, affects_cycle_total, is_pending,
    review_status, source_file, source_kind, source_row, stable_hash,
    shared_with_nicol
  )
`

function mapTransaction(row) {
  return {
    id: row.id,
    bankId: row.bank_id,
    date: row.transaction_date,
    description: row.description,
    movementType: row.movement_type,
    amount: Number(row.amount ?? 0),
    originalAmount: row.original_amount == null ? null : Number(row.original_amount),
    installmentCurrent: row.installment_current,
    installmentTotal: row.installment_total,
    installmentsRemaining: row.installments_remaining,
    currency: row.currency || 'CLP',
    affectsCycleTotal: Boolean(row.affects_cycle_total),
    isPending: Boolean(row.is_pending),
    reviewStatus: row.review_status,
    sourceFile: row.source_file,
    sourceKind: row.source_kind,
    sourceRow: row.source_row,
    stableHash: row.stable_hash,
    sharedWithNicol: Boolean(row.shared_with_nicol),
  }
}

function mapCycle(row) {
  const transactions = (row.billing_transactions || [])
    .map(mapTransaction)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.sourceRow || 0) - (b.sourceRow || 0))

  const calculatedAmount = transactions
    .filter(item => item.affectsCycleTotal)
    .reduce((sum, item) => sum + item.amount, 0)

  const reportedAmount = Number(row.reported_amount ?? 0)
  const estimatedAmount = Number(row.estimated_amount ?? 0)

  return {
    id: row.id,
    cardId: row.credit_card_id,
    cycleKey: row.cycle_key,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    closingDate: row.closing_date,
    dueDate: row.due_date,
    paymentDate: row.payment_date,
    status: row.status,
    reportedAmount,
    reportedAmountIsFinal: Boolean(row.reported_amount_is_final),
    minimumPayment: row.minimum_payment == null ? null : Number(row.minimum_payment),
    estimatedAmount,
    reconciliationStatus: row.reconciliation_status,
    sourceFile: row.source_file,
    notes: row.notes || '',
    importedAt: row.imported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    transactions,
    calculatedAmount,
    difference: reportedAmount - calculatedAmount,
    reviewCount: transactions.filter(item => item.reviewStatus === 'review_required').length,
    sharedCount: transactions.filter(item => item.sharedWithNicol).length,
  }
}

function getCurrentCycleKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Santiago',
  }).formatToParts(new Date())
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  return year && month ? `${year}-${month}` : ''
}

export async function fetchBillingCycles() {
  if (!isConfigured || !supabase) return []

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const userId = authData?.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('billing_cycles')
    .select(CYCLE_SELECT)
    .eq('user_id', userId)
    .order('due_date', { ascending: false })
    .order('cycle_key', { ascending: false })

  if (error) throw error

  const currentCycleKey = getCurrentCycleKey()
  return (data || [])
    .map(mapCycle)
    .sort((a, b) => {
      if (a.cycleKey === currentCycleKey && b.cycleKey !== currentCycleKey) return -1
      if (b.cycleKey === currentCycleKey && a.cycleKey !== currentCycleKey) return 1
      return b.cycleKey.localeCompare(a.cycleKey) || (b.dueDate || '').localeCompare(a.dueDate || '')
    })
}
