import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectionPlan } from '../src/services/projectionPlanService.js'

const now = new Date('2026-08-23T20:00:00-04:00')

test('la proyección desde hoy no descuenta otra vez facturas ya vencidas', () => {
  const plan = buildProjectionPlan({
    accounts: [{ active: true, type: 'debito', balance: 250100 }],
    billingCycles: [{
      id: 'aug-cmr', cardId: 'cmr', cycleKey: '2026-08', dueDate: '2026-08-05',
      status: 'closed', reportedAmount: 793460, reportedAmountIsFinal: true,
      estimatedAmount: 793460, transactions: [],
    }],
    scenario: 'committed',
    horizonMonths: 1,
    now,
  })

  assert.equal(plan.firstMonth.cardAmount, 0)
  assert.equal(plan.firstMonth.openingBalance, 250100)
  assert.equal(plan.firstMonth.closingBalance, 250100)
})

test('un ciclo conocido de una tarjeta no oculta cuotas de la otra tarjeta', () => {
  const plan = buildProjectionPlan({
    accounts: [{ active: true, type: 'debito', balance: 250100 }],
    billingCycles: [{
      id: 'oct-cmr', cardId: 'cmr', cycleKey: '2026-10', dueDate: '2026-10-05',
      status: 'in_progress', reportedAmount: 187644, estimatedAmount: 255094,
      reportedAmountIsFinal: false,
      transactions: [{ amount: 67450, movementType: 'purchase', affectsCycleTotal: true, isPending: false }],
    }],
    installmentDebts: [
      { id: 'cmr-plan', occurrences: [{ id: 'cmr-oct', monthKey: '2026-10', cardId: 'cmr', amount: 187644, projected: true }] },
      { id: 'bchile-plan', occurrences: [{ id: 'bchile-oct', monthKey: '2026-10', cardId: 'bchile', amount: 100000, projected: true }] },
    ],
    scenario: 'committed',
    horizonMonths: 3,
    now,
  })

  const october = plan.months.find(month => month.key === '2026-10')
  assert.ok(october)
  assert.equal(october.knownCardAmount, 255094)
  assert.equal(october.uncoveredInstallmentAmount, 100000)
  assert.equal(october.cardAmount, 355094)
})

test('un estado final en cero domina sobre cálculos antiguos dentro de la proyección', () => {
  const plan = buildProjectionPlan({
    accounts: [{ active: true, type: 'debito', balance: 100000 }],
    billingCycles: [{
      id: 'sep-zero', cardId: 'cmr', cycleKey: '2026-09', dueDate: '2026-09-05',
      status: 'closed', reportedAmount: 0, estimatedAmount: 50000,
      reportedAmountIsFinal: true,
      transactions: [{ amount: 50000, movementType: 'purchase', affectsCycleTotal: true, isPending: false }],
    }],
    scenario: 'committed',
    horizonMonths: 2,
    now,
  })

  const september = plan.months.find(month => month.key === '2026-09')
  assert.ok(september)
  assert.equal(september.knownCardAmount, 0)
  assert.equal(september.cardAmount, 0)
})
