import { supabase, isConfigured } from '../lib/supabase'

const FIELDS = `id, period_month, scheduled_payment_date, actual_payment_date, payment_evidence, net_amount, gross_amount,
  base_salary_contract, base_salary_paid, gratification, overtime_amount, taxable_base,
  pension_amount, health_amount, unemployment_amount, income_tax, legal_deductions,
  other_deductions, days_worked, overtime_minutes, permission_minutes, nonworked_minutes,
  employer, position_title, source_file, status, notes, created_at, updated_at,
  contract_type, contract_start_date, pension_provider, pension_rate_percent,
  health_provider, health_rate_percent, uf_value, taxable_earnings, non_taxable_earnings,
  pension_health_base, unemployment_base, total_earnings, total_deductions, source_details_verified`

function mapRow(row) {
  return {
    id: row.id,
    periodMonth: row.period_month,
    scheduledPaymentDate: row.scheduled_payment_date,
    actualPaymentDate: row.actual_payment_date,
    paymentEvidence: row.payment_evidence,
    netAmount: Number(row.net_amount || 0),
    grossAmount: Number(row.gross_amount || 0),
    baseSalaryContract: Number(row.base_salary_contract || 0),
    baseSalaryPaid: Number(row.base_salary_paid || 0),
    gratification: Number(row.gratification || 0),
    overtimeAmount: Number(row.overtime_amount || 0),
    taxableBase: Number(row.taxable_base || 0),
    pensionAmount: Number(row.pension_amount || 0),
    healthAmount: Number(row.health_amount || 0),
    unemploymentAmount: Number(row.unemployment_amount || 0),
    incomeTax: Number(row.income_tax || 0),
    legalDeductions: Number(row.legal_deductions || 0),
    otherDeductions: Number(row.other_deductions || 0),
    daysWorked: row.days_worked == null ? null : Number(row.days_worked),
    overtimeMinutes: Number(row.overtime_minutes || 0),
    permissionMinutes: Number(row.permission_minutes || 0),
    nonworkedMinutes: Number(row.nonworked_minutes || 0),
    employer: row.employer,
    positionTitle: row.position_title,
    sourceFile: row.source_file,
    status: row.status || 'actual',
    notes: row.notes,
    contractType: row.contract_type,
    contractStartDate: row.contract_start_date,
    pensionProvider: row.pension_provider,
    pensionRatePercent: Number(row.pension_rate_percent || 0),
    healthProvider: row.health_provider,
    healthRatePercent: Number(row.health_rate_percent || 0),
    ufValue: Number(row.uf_value || 0),
    taxableEarnings: Number(row.taxable_earnings || 0),
    nonTaxableEarnings: Number(row.non_taxable_earnings || 0),
    pensionHealthBase: Number(row.pension_health_base || 0),
    unemploymentBase: Number(row.unemployment_base || 0),
    totalEarnings: Number(row.total_earnings || 0),
    totalDeductions: Number(row.total_deductions || 0),
    sourceDetailsVerified: Boolean(row.source_details_verified),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchSalarySlips() {
  if (!isConfigured) return []
  const { data, error } = await supabase
    .from('salary_slips')
    .select(FIELDS)
    .order('period_month', { ascending: false })
  if (error) throw error
  return (data || []).map(mapRow)
}
