import test from 'node:test'
import assert from 'node:assert/strict'
import {
  billingCycleAmount,
  dateOnlyCL,
  daysInMonthKey,
  monthKeyCL,
  previousMonthKey,
} from '../src/lib/financialDates.js'

test('mantiene intactas las fechas bancarias sin hora', () => {
  assert.equal(dateOnlyCL('2026-08-05'), '2026-08-05')
})

test('convierte timestamps UTC a la fecha local de Chile', () => {
  assert.equal(dateOnlyCL('2026-08-05T02:30:00.000Z'), '2026-08-04')
  assert.equal(monthKeyCL('2026-09-01T02:00:00.000Z'), '2026-08')
})

test('calcula correctamente meses anteriores y su duración', () => {
  assert.equal(previousMonthKey('2026-01'), '2025-12')
  assert.equal(daysInMonthKey('2028-02'), 29)
})

test('prioriza el monto final y usa la mejor estimación en ciclos abiertos', () => {
  assert.equal(billingCycleAmount({
    reportedAmount: 100,
    estimatedAmount: 140,
    calculatedAmount: 130,
    reportedAmountIsFinal: false,
  }), 140)
  assert.equal(billingCycleAmount({
    reportedAmount: 100,
    estimatedAmount: 140,
    calculatedAmount: 130,
    reportedAmountIsFinal: true,
  }), 100)
})
