import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectionPlan } from '../src/services/projectionPlanService.js'
import { buildNewProjectionTimeline } from '../src/lib/newProjectionModel.js'

const now = new Date('2026-09-07T12:00:00-03:00')

test('Nueva Proyección usa solo compromisos conocidos y muestra el mes actual completo sin descontarlo dos veces', () => {
  const plan = buildProjectionPlan({
    now,
    accounts: [{ id: 'cuenta', active: true, type: 'cuenta', balance: 1000000 }],
    recurringList: [
      { id: 'r1', kind: 'expense', active: true, name: 'Arriendo', amount: 100000, dayOfMonth: 1, type: 'debito' },
      { id: 'r2', kind: 'expense', active: true, name: 'Internet', amount: 50000, dayOfMonth: 20, type: 'debito' },
    ],
    expenses: [
      { id: 'g1', date: '2026-08-10', amount: 300000, type: 'debito', status: 'ok', movementType: 'purchase', description: 'Gasto variable histórico' },
    ],
    billingCycles: [
      { id: 'cmr-sep', cardId: 'fal', dueDate: '2026-09-05', status: 'paid', reportedAmount: 883550, reportedAmountIsFinal: true, transactions: [] },
      { id: 'chi-sep', cardId: 'chi', dueDate: '2026-09-02', status: 'paid', reportedAmount: 148353, reportedAmountIsFinal: true, transactions: [] },
      { id: 'cmr-oct', cardId: 'fal', dueDate: '2026-10-05', status: 'open', reportedAmount: 600000, reportedAmountIsFinal: true, transactions: [] },
    ],
    payables: [
      { id: 'p1', amount: 999999, dueDate: '2026-10-01', status: 'pending' },
    ],
    simulations: [
      { id: 's1', active: true, name: 'Notebook', amount: 300000, date: '2026-10-01', installments: 3, bank: 'falabella', category: 'otros' },
    ],
    scenario: 'simulated',
    includePayables: true,
    horizonMonths: 2,
  })

  const september = plan.months[0]
  const october = plan.months[1]

  // Septiembre explica todo el mes: facturas ya pagadas + recurrentes del mes.
  assert.equal(september.knownCardAmount, 1031903)
  assert.equal(september.directRecurring, 150000)
  assert.equal(september.outflow, 1181903)

  // Pero el saldo parte desde hoy y no vuelve a descontar lo ya pagado.
  assert.equal(september.forwardOutflow, 50000)
  assert.equal(september.closingBalance, 950000)

  // No se agregan estimaciones automáticas ni cuentas por pagar genéricas.
  assert.equal(september.estimatedDirectVariable, 0)
  assert.equal(october.estimatedCreditVariableRemaining, 0)
  assert.equal(october.payableAmount, 0)

  // Octubre contiene solo factura conocida + recurrentes + simulación explícita.
  assert.equal(october.knownCardAmount, 600000)
  assert.equal(october.directRecurring, 150000)
  assert.equal(october.simulationAmount, 100000)
  assert.equal(october.outflow, 850000)
})

test('la parte futura no reparte montos desconocidos según el historial', () => {
  const cardId = 'fal'
  const cycleId = 'cycle-sep'
  const timeline = buildNewProjectionTimeline({
    now,
    expenses: [
      { date: '2026-08-10', amount: 900000, bank: 'falabella', category: 'supermercado', status: 'ok', type: 'credito' },
      { date: '2026-08-11', amount: 100000, bank: 'bchile', category: 'bencina', status: 'ok', type: 'debito' },
    ],
    planMonths: [{
      key: '2026-09',
      outflow: 600000,
      closingBalance: 900000,
      income: 1200000,
      receivableAmount: 0,
      knownCycles: [{ id: cycleId, cardId, amount: 550000 }],
      uncoveredInstallmentDetail: [],
      directRecurringDetail: [],
      creditRecurringDetail: [],
      simulationDetail: [],
      directRecurring: 0,
      creditRecurring: 0,
      installmentAmount: 0,
      simulationAmount: 0,
    }],
    creditCards: [{ id: cardId, bank: 'falabella', name: 'CMR' }],
    billingCycles: [{ id: cycleId, transactions: [] }],
  })

  const september = timeline.future[0]
  assert.equal(september.bankSegments.falabella, 550000)
  assert.equal(september.bankSegments.bchile, 0)
  assert.equal(september.bankSegments.otros, 50000)
})
