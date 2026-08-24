import {
  fetchInstallments as fetchLegacyInstallments,
  createInstallment,
  updateInstallment,
  patchInstallment,
  removeInstallment,
} from './installmentsServiceV2'
import { auditInstallmentPlans } from '../lib/installmentAudit'

export async function fetchInstallments() {
  const plans = await fetchLegacyInstallments()
  return auditInstallmentPlans(plans || [])
}

export {
  createInstallment,
  updateInstallment,
  patchInstallment,
  removeInstallment,
}
