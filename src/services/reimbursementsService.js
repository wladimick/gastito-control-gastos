import { supabase, isConfigured } from '../lib/supabase'
import { reportDataHealth, reportMutationError } from '../lib/appEvents'

const FIELDS = `
  id, user_id, expense_id, billing_transaction_id,
  company, title, amount, expense_date,
  submission_due_date, expected_payment_date,
  status, submitted_at, approved_at, reimbursed_at,
  notes, created_at, updated_at
`

function mapRow(row) {
  return {
    id: row.id,
    expenseId: row.expense_id || null,
    billingTransactionId: row.billing_transaction_id || null,
    company: row.company || 'TIBOX',
    title: row.title || 'Rendición',
    amount: Number(row.amount || 0),
    expenseDate: row.expense_date,
    submissionDueDate: row.submission_due_date || null,
    expectedPaymentDate: row.expected_payment_date || null,
    status: row.status || 'pending',
    submittedAt: row.submitted_at || null,
    approvedAt: row.approved_at || null,
    reimbursedAt: row.reimbursed_at || null,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRow(item) {
  return {
    expense_id: item.expenseId || null,
    billing_transaction_id: item.billingTransactionId || null,
    company: item.company || 'TIBOX',
    title: item.title || 'Rendición',
    amount: Number(item.amount || 0),
    expense_date: item.expenseDate,
    submission_due_date: item.submissionDueDate || null,
    expected_payment_date: item.expectedPaymentDate || null,
    status: item.status || 'pending',
    submitted_at: item.submittedAt || null,
    approved_at: item.approvedAt || null,
    reimbursed_at: item.reimbursedAt || null,
    notes: item.notes || null,
  }
}

async function runMutation(context, callback) {
  try {
    return await callback()
  } catch (error) {
    reportMutationError(context, error)
    throw error
  }
}

export async function fetchReimbursements() {
  if (!isConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('expense_reimbursements')
    .select(FIELDS)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) {
    reportDataHealth('reimbursements', 'error', 'No fue posible cargar las rendiciones.')
    throw error
  }
  reportDataHealth('reimbursements', 'complete')
  return (data || []).map(mapRow)
}

export async function createReimbursement(item, userId) {
  return runMutation('Crear rendición', async () => {
    const { data, error } = await supabase
      .from('expense_reimbursements')
      .insert({ ...toRow(item), user_id: userId })
      .select(FIELDS)
      .single()
    if (error) throw error
    return mapRow(data)
  })
}

export async function updateReimbursement(item) {
  return runMutation('Editar rendición', async () => {
    const { data, error } = await supabase
      .from('expense_reimbursements')
      .update(toRow(item))
      .eq('id', item.id)
      .select(FIELDS)
      .single()
    if (error) throw error
    return mapRow(data)
  })
}

export async function patchReimbursement(id, patch) {
  return runMutation('Actualizar rendición', async () => {
    const row = {}
    if ('status' in patch) row.status = patch.status
    if ('submittedAt' in patch) row.submitted_at = patch.submittedAt
    if ('approvedAt' in patch) row.approved_at = patch.approvedAt
    if ('reimbursedAt' in patch) row.reimbursed_at = patch.reimbursedAt
    if ('expectedPaymentDate' in patch) row.expected_payment_date = patch.expectedPaymentDate
    const { data, error } = await supabase
      .from('expense_reimbursements')
      .update(row)
      .eq('id', id)
      .select(FIELDS)
      .single()
    if (error) throw error
    return mapRow(data)
  })
}

export async function removeReimbursement(id) {
  return runMutation('Eliminar rendición', async () => {
    const { error } = await supabase.from('expense_reimbursements').delete().eq('id', id)
    if (error) throw error
  })
}

export function reimbursementToReceivable(item) {
  return {
    id: `reimbursement:${item.id}`,
    kind: 'receivable',
    name: `Rendición · ${item.title}`,
    amount: Number(item.amount || 0),
    category: 'por_cobrar',
    bank: null,
    method: null,
    type: null,
    active: true,
    personName: item.company || 'Empresa',
    description: 'Reembolso de gasto pagado personalmente',
    dueDate: item.expectedPaymentDate || item.submissionDueDate || item.expenseDate,
    status: item.status === 'reimbursed' ? 'paid' : 'pending',
    paidAt: item.reimbursedAt || null,
    notes: item.notes || '',
    reimbursement: true,
  }
}
