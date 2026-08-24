import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectionPlan } from '../src/services/projectionPlanService.js'
import { coverReservePayables, withMercadoPagoFreeBalance } from '../src/lib/financialModel.js'
import { withStatementForecastFloors } from '../src/lib/installmentAudit.js'

test('snapshot comprometido cuadra con saldos y estados de cuenta vigentes', () => {
  const accounts = withMercadoPagoFreeBalance([
    { id: 'mp', name: 'Mercado Pago', bankId: 'mercadopago', type: 'debito', balance: 550340, active: true },
  ], { last_balance: 250100, reserved_partition_balance: 300240 })

  const payables = coverReservePayables([
    { id: 'papa', name: 'Papá', personName: 'Papá', amount: 300000, dueDate: '2026-12-31', status: 'pending' },
    { id: 'agua', name: 'Agua Nuevo Sur', amount: 38030, dueDate: '2026-09-03', status: 'pending' },
    { id: 'luz', name: 'Luz CGE', amount: 53600, dueDate: '2026-09-05', status: 'pending' },
  ], 300240)

  const forecasts = [
    { id: 'cmr-oct', cardId: 'cmr', cashMonth: '2026-10', amount: 187644, active: true },
    { id: 'cmr-nov', cardId: 'cmr', cashMonth: '2026-11', amount: 59702, active: true },
    { id: 'cmr-dec', cardId: 'cmr', cashMonth: '2026-12', amount: 37606, active: true },
    { id: 'bch-oct', cardId: 'bchile', cashMonth: '2026-10', amount: 115635, active: true },
    { id: 'bch-nov', cardId: 'bchile', cashMonth: '2026-11', amount: 44710, active: true },
    { id: 'bch-dec', cardId: 'bchile', cashMonth: '2026-12', amount: 21994, active: true },
  ]
  const installmentDebts = withStatementForecastFloors([], forecasts)

  const plan = buildProjectionPlan({
    accounts,
    recurringList: [
      { id: 'internet', kind: 'expense', name: 'Internet', amount: 15500, type: 'debito', active: true, dayOfMonth: 5 },
      { id: 'telefono', kind: 'expense', name: 'Telefonía', amount: 15371, type: 'debito', active: true, dayOfMonth: 1 },
      { id: 'transporte', kind: 'expense', name: 'Transporte', amount: 65000, type: 'debito', active: true, dayOfMonth: 5 },
    ],
    incomeList: [
      { id: 'salary-sep', kind: 'income', name: 'Sueldo estimado', amount: 1236953, active: true, dayOfMonth: 5, startDate: '2026-09-01', endDate: '2026-09-28' },
      { id: 'salary-oct', kind: 'income', name: 'Sueldo estimado', amount: 1236953, active: true, dayOfMonth: 5, startDate: '2026-10-01', endDate: '2026-10-28' },
      { id: 'salary-nov', kind: 'income', name: 'Sueldo estimado', amount: 1236953, active: true, dayOfMonth: 5, startDate: '2026-11-01', endDate: '2026-11-28' },
      { id: 'salary-dec', kind: 'income', name: 'Sueldo estimado', amount: 1236953, active: true, dayOfMonth: 5, startDate: '2026-12-01', endDate: '2026-12-28' },
      { id: 'chatgpt', kind: 'income', name: 'ChatGPT', amount: 22000, active: true, dayOfMonth: 5 },
      { id: 'wp', kind: 'income', name: 'WP descargas', amount: 10000, active: true, dayOfMonth: 5 },
    ],
    receivables: [
      { id: 'nicol', name: 'Aporte Nicol', amount: 200000, dueDate: '2026-08-31', status: 'pending' },
    ],
    payables,
    installmentDebts,
    expenses: [],
    billingCycles: [
      { id: 'bch-sep', cardId: 'bchile', cycleKey: '2026-09', dueDate: '2026-09-02', status: 'closed', reportedAmount: 148353, reportedAmountIsFinal: true, transactions: [] },
      { id: 'cmr-sep', cardId: 'cmr', cycleKey: '2026-09', dueDate: '2026-09-05', status: 'closed', reportedAmount: 883550, reportedAmountIsFinal: true, transactions: [] },
      { id: 'cmr-oct-real', cardId: 'cmr', cycleKey: '2026-10', dueDate: '2026-10-05', status: 'in_progress', reportedAmount: 187644, reportedAmountIsFinal: false, estimatedAmount: 255094, transactions: [] },
    ],
    scenario: 'committed',
    includeReceivables: false,
    horizonMonths: 5,
    now: new Date('2026-08-23T21:35:00-04:00'),
  })

  assert.equal(plan.startBalance, 250100)
  const september = plan.months.find(item => item.key === '2026-09')
  const october = plan.months.find(item => item.key === '2026-10')
  const november = plan.months.find(item => item.key === '2026-11')
  const december = plan.months.find(item => item.key === '2026-12')

  assert.equal(september.cardAmount, 1031903)
  assert.equal(september.directRecurring, 95871)
  assert.equal(september.payableAmount, 91630)
  assert.equal(september.income, 1268953)
  assert.equal(september.net, 49549)

  assert.equal(october.cardAmount, 370729)
  assert.equal(november.cardAmount, 104412)
  assert.equal(december.cardAmount, 59600)
  assert.equal(december.payableAmount, 0)
})
