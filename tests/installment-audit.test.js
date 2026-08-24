import test from 'node:test'
import assert from 'node:assert/strict'
import { auditInstallmentPlans, likelyCoveredByBank, withStatementForecastFloors } from '../src/lib/installmentAudit.js'
import { buildProjectionPlan } from '../src/services/projectionPlanService.js'

test('evidencia bancaria reemplaza seguimiento manual antiguo aunque el contador pagado esté atrasado', () => {
  const manual = {
    id: 'manual-ripley', source: 'manual', bank: 'bchile', description: 'Ripley',
    total: 40230, installments: 3, paid: 0, monthlyAmount: 13410, startMonth: '2026-07',
    status: 'active', occurrences: [
      { monthKey: '2026-07', amount: 13410 },
      { monthKey: '2026-08', amount: 13410 },
      { monthKey: '2026-09', amount: 13410 },
    ],
  }
  const bank = {
    id: 'bank-ripley', source: 'bank', bank: 'bchile', description: 'RIPLEY CURICO',
    total: 40230, installments: 3, paid: 1, monthlyAmount: 13410, startMonth: '2026-07',
    status: 'active', occurrences: [],
  }
  assert.equal(likelyCoveredByBank(manual, bank), true)
  assert.deepEqual(auditInstallmentPlans([bank, manual], '2026-08').map(item => item.id), ['bank-ripley'])
})

test('seguimiento manual ya terminado por calendario no revive cuotas futuras', () => {
  const plans = auditInstallmentPlans([{
    id: 'old', source: 'manual', bank: 'bchile', total: 44000,
    installments: 3, paid: 0, monthlyAmount: 14667, startMonth: '2026-05',
    status: 'active', occurrences: [
      { monthKey: '2026-05', amount: 14667 },
      { monthKey: '2026-06', amount: 14667 },
      { monthKey: '2026-07', amount: 14666 },
    ],
  }], '2026-08')
  assert.equal(plans[0].status, 'paid')
  assert.equal(plans[0].staleManual, true)
  assert.equal(plans[0].occurrences.length, 0)
})

test('estado de cuenta completa solo la diferencia faltante del piso futuro', () => {
  const plans = [{
    id: 'bchile-known', source: 'bank', cardId: 'bchile-card',
    occurrences: [
      { monthKey: '2026-10', cardId: 'bchile-card', amount: 57499 },
      { monthKey: '2026-10', cardId: 'bchile-card', amount: 13410 },
      { monthKey: '2026-10', cardId: 'bchile-card', amount: 11550 },
    ],
  }]
  const result = withStatementForecastFloors(plans, [{
    id: 'forecast', cardId: 'bchile-card', cashMonth: '2026-10', amount: 115635, active: true,
    confidence: 'statement_schedule', sourceFile: 'Estado_Cuenta.pdf',
  }])
  const topup = result.find(item => item.source === 'statement_forecast')
  assert.equal(topup.monthlyAmount, 33176)
  assert.equal(topup.occurrences[0].forecastFloor, 115635)
})

test('factura real de una tarjeta domina su piso de estado de cuenta', () => {
  const installmentDebts = withStatementForecastFloors([], [{
    id: 'cmr-floor', cardId: 'cmr', cashMonth: '2026-10', amount: 187644, active: true,
  }])
  const plan = buildProjectionPlan({
    accounts: [], recurringList: [], incomeList: [], receivables: [], payables: [],
    installmentDebts, expenses: [], scenario: 'committed', horizonMonths: 3,
    now: new Date('2026-08-23T12:00:00-04:00'),
    billingCycles: [{
      id: 'cmr-oct', cardId: 'cmr', cycleKey: '2026-10', dueDate: '2026-10-05', status: 'in_progress',
      reportedAmount: 187644, reportedAmountIsFinal: false, estimatedAmount: 255094,
      transactions: [],
    }],
  })
  const october = plan.months.find(item => item.key === '2026-10')
  assert.equal(october.cardAmount, 255094)
})
