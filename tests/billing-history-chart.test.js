import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addMonthsToCycleKey,
  billingCycleAmount,
  buildBillingHistory,
} from '../src/lib/billingHistoryChart.js'

const cards = [
  { id: 'chile', bank: 'bchile', name: 'Banco Chile' },
  { id: 'cmr', bank: 'falabella', name: 'CMR' },
]

test('genera seis meses terminando en el ciclo más reciente', () => {
  const result = buildBillingHistory([
    { cycleKey: '2026-09', cardId: 'chile', reportedAmount: 148353, reportedAmountIsFinal: true, reconciliationStatus: 'reconciled' },
    { cycleKey: '2026-09', cardId: 'cmr', reportedAmount: 883550, reportedAmountIsFinal: true, reconciliationStatus: 'reconciled' },
    { cycleKey: '2026-10', cardId: 'cmr', reportedAmount: 593338, estimatedAmount: 692384, reportedAmountIsFinal: false, reconciliationStatus: 'partial' },
  ], cards, 6)

  assert.equal(result.months.length, 6)
  assert.equal(result.months[0].cycleKey, '2026-05')
  assert.equal(result.months[5].cycleKey, '2026-10')
  assert.equal(result.latestKey, '2026-10')
})

test('septiembre suma ambos bancos y calcula porcentajes', () => {
  const result = buildBillingHistory([
    { cycleKey: '2026-09', cardId: 'chile', reportedAmount: 148353, reportedAmountIsFinal: true, reconciliationStatus: 'reconciled' },
    { cycleKey: '2026-09', cardId: 'cmr', reportedAmount: 883550, reportedAmountIsFinal: true, reconciliationStatus: 'reconciled' },
  ], cards, 1)

  const september = result.months[0]
  assert.equal(september.total, 1031903)
  const chile = september.banks.find(bank => bank.bankId === 'bchile')
  const falabella = september.banks.find(bank => bank.bankId === 'falabella')
  assert.equal(chile.amount, 148353)
  assert.equal(falabella.amount, 883550)
  assert.equal(chile.percentage, 14)
  assert.equal(falabella.percentage, 86)
})

test('ciclo abierto usa estimación en vez de snapshot informado parcial', () => {
  const cycle = {
    reportedAmount: 593338,
    estimatedAmount: 692384,
    calculatedAmount: 692384,
    reportedAmountIsFinal: false,
    reconciliationStatus: 'partial',
  }
  assert.equal(billingCycleAmount(cycle), 692384)
})

test('ciclo conciliado prioriza monto oficial', () => {
  const cycle = {
    reportedAmount: 883550,
    estimatedAmount: 900000,
    calculatedAmount: 883551,
    reportedAmountIsFinal: true,
    reconciliationStatus: 'reconciled',
  }
  assert.equal(billingCycleAmount(cycle), 883550)
})

test('octubre muestra 0% Chile y 100% Falabella cuando no existe ciclo Chile', () => {
  const result = buildBillingHistory([
    { cycleKey: '2026-10', cardId: 'cmr', estimatedAmount: 692384, reconciliationStatus: 'partial' },
  ], cards, 1)
  const october = result.months[0]
  assert.equal(october.total, 692384)
  assert.equal(october.banks.find(bank => bank.bankId === 'bchile').percentage, 0)
  assert.equal(october.banks.find(bank => bank.bankId === 'falabella').percentage, 100)
})

test('suma meses correctamente', () => {
  assert.equal(addMonthsToCycleKey('2026-01', -1), '2025-12')
  assert.equal(addMonthsToCycleKey('2026-12', 1), '2027-01')
})
