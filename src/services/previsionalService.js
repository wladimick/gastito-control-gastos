import { supabase, isConfigured } from '../lib/supabase'

export async function fetchPrevisionalAccounts() {
  if (!isConfigured) return []
  const { data, error } = await supabase
    .from('previsional_accounts')
    .select('id, account_type, provider, account_name, balance, as_of_date, source_type, source_reference, fund_code, fund_allocation_percent, fund_units, notes')
    .eq('active', true)
    .order('account_type')
  if (error) throw error
  return (data || []).map(row => ({
    id: row.id,
    accountType: row.account_type,
    provider: row.provider,
    accountName: row.account_name,
    balance: Number(row.balance || 0),
    asOfDate: row.as_of_date,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    fundCode: row.fund_code,
    fundAllocationPercent: Number(row.fund_allocation_percent || 0),
    fundUnits: Number(row.fund_units || 0),
    notes: row.notes,
  }))
}

export async function fetchAfcContributions() {
  if (!isConfigured) return []
  const { data, error } = await supabase
    .from('previsional_contributions')
    .select('period_month, taxable_income, worker_contribution, employer_personal_contribution, payment_date, provider, verified')
    .eq('system', 'afc')
    .order('period_month')
  if (error) throw error
  return (data || []).map(row => ({
    periodMonth: row.period_month,
    taxableIncome: Number(row.taxable_income || 0),
    workerContribution: Number(row.worker_contribution || 0),
    employerPersonalContribution: Number(row.employer_personal_contribution || 0),
    paymentDate: row.payment_date,
    provider: row.provider,
    verified: Boolean(row.verified),
  }))
}

export async function fetchAfcSimulations() {
  if (!isConfigured) return []
  const { data, error } = await supabase
    .from('unemployment_insurance_simulations')
    .select('id, simulation_date, termination_date, termination_cause, funding_type, average_remuneration, total_benefit, total_afp_contribution, max_payments, notes')
    .order('funding_type')
  if (error) throw error
  return (data || []).map(row => ({
    id: row.id,
    simulationDate: row.simulation_date,
    terminationDate: row.termination_date,
    terminationCause: row.termination_cause,
    fundingType: row.funding_type,
    averageRemuneration: Number(row.average_remuneration || 0),
    totalBenefit: Number(row.total_benefit || 0),
    totalAfpContribution: Number(row.total_afp_contribution || 0),
    maxPayments: Number(row.max_payments || 0),
    notes: row.notes,
  }))
}
