import test from 'node:test'
import assert from 'node:assert/strict'
import { salaryForCashMonth } from '../src/lib/salaryModel.js'

test('usa la fecha bancaria efectiva del sueldo cuando existe', () => {
  const slips = [
    {
      periodMonth: '2026-03-01',
      scheduledPaymentDate: '2026-04-05',
      actualPaymentDate: '2026-04-06',
      netAmount: 1220217,
      status: 'actual',
    },
  ]

  const april = salaryForCashMonth(slips, '2026-04')
  assert.equal(april.amount, 1220217)
  assert.equal(april.mode, 'actual')
  assert.equal(april.periodKey, '2026-03')
})

test('un sueldo confirmado en otro mes no se duplica en el mes programado', () => {
  const slips = [
    {
      periodMonth: '2026-05-01',
      scheduledPaymentDate: '2026-06-05',
      actualPaymentDate: '2026-07-02',
      netAmount: 1273249,
      status: 'actual',
    },
  ]

  const june = salaryForCashMonth(slips, '2026-06')
  const july = salaryForCashMonth(slips, '2026-07')

  assert.equal(june.amount, 0)
  assert.equal(june.mode, 'no_payment')
  assert.equal(july.amount, 1273249)
  assert.equal(july.mode, 'actual')
})
