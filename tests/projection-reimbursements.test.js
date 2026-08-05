import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectionPlan } from '../src/services/projectionPlanService.js'

const now = new Date('2026-08-05T16:00:00-04:00')

function planWith(receivables, includeReceivables = false) {
  return buildProjectionPlan({
    accounts: [],
    receivables,
    includeReceivables,
    horizonMonths: 2,
    scenario: 'committed',
    now,
  })
}

test('incluye rendiciones enviadas aunque otros cobros estén desactivados', () => {
  const plan = planWith([
    {
      id: 'reimbursement:1',
      name: 'Rendición Claude',
      amount: 22054,
      dueDate: '2026-08-31',
      status: 'pending',
      reimbursement: true,
    },
    {
      id: 'receivable:1',
      name: 'Cobro informal',
      amount: 50000,
      dueDate: '2026-08-31',
      status: 'pending',
    },
  ])

  assert.equal(plan.firstMonth.receivableAmount, 22054)
  assert.equal(plan.firstMonth.receivableDetail.length, 1)
  assert.equal(plan.firstMonth.receivableDetail[0].reimbursement, true)
})

test('incluye todos los cobros cuando el usuario activa el supuesto', () => {
  const plan = planWith([
    { id: 'reimbursement:1', amount: 22054, dueDate: '2026-08-31', status: 'pending', reimbursement: true },
    { id: 'receivable:1', amount: 50000, dueDate: '2026-08-31', status: 'pending' },
  ], true)

  assert.equal(plan.firstMonth.receivableAmount, 72054)
})

test('no vuelve a proyectar una rendición ya reembolsada', () => {
  const plan = planWith([
    {
      id: 'reimbursement:1',
      amount: 22054,
      dueDate: '2026-08-31',
      status: 'paid',
      reimbursement: true,
    },
  ])

  assert.equal(plan.firstMonth.receivableAmount, 0)
})
