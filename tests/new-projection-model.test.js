import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildNewProjectionTimeline,
  normalizeBank,
  safeSpendingCapacity,
  visibleBankTotal,
  categoryTotal,
} from '../src/lib/newProjectionModel.js'

test('normaliza Banco Chile y Falabella', () => {
  assert.equal(normalizeBank('Banco de Chile'), 'bchile')
  assert.equal(normalizeBank('CMR Falabella'), 'falabella')
  assert.equal(normalizeBank('Efectivo'), 'otros')
})

test('construye 3 meses reales y 6 proyectados', () => {
  const now = new Date('2026-09-07T16:00:00Z')
  const expenses = [
    { date: '2026-08-20', amount: 100000, bank: 'falabella', category: 'supermercado', status: 'ok', type: 'credito' },
    { date: '2026-08-22', amount: 50000, bank: 'bchile', category: 'bencina', status: 'ok', type: 'debito' },
  ]
  const planMonths = Array.from({ length: 6 }, (_, index) => ({
    key: `2026-${String(9 + index).padStart(2, '0')}`,
    outflow: 200000,
    closingBalance: 1000000,
    income: 1200000,
    receivableAmount: 0,
    knownCycles: [],
    uncoveredInstallmentDetail: [],
    directRecurringDetail: [],
    creditRecurringDetail: [],
    simulationDetail: [],
    directRecurring: 0,
    creditRecurring: 0,
    installmentAmount: 0,
    simulationAmount: 0,
  }))

  const result = buildNewProjectionTimeline({ expenses, planMonths, now })
  assert.equal(result.rows.length, 9)
  assert.equal(result.history.length, 3)
  assert.equal(result.future.length, 6)
  assert.equal(result.history[2].bankSegments.falabella, 100000)
  assert.equal(result.history[2].bankSegments.bchile, 50000)
  assert.equal(result.future[0].total, 200000)
})

test('asigna una factura conocida al banco de la tarjeta', () => {
  const now = new Date('2026-09-07T16:00:00Z')
  const cardId = 'card-falabella'
  const cycleId = 'cycle-october'
  const planMonths = [{
    key: '2026-09', outflow: 0, closingBalance: 1000000, income: 1000000, receivableAmount: 0,
    knownCycles: [], uncoveredInstallmentDetail: [], directRecurringDetail: [], creditRecurringDetail: [], simulationDetail: [],
    directRecurring: 0, creditRecurring: 0, installmentAmount: 0, simulationAmount: 0,
  }, {
    key: '2026-10', outflow: 600000, closingBalance: 900000, income: 1200000, receivableAmount: 0,
    knownCycles: [{ id: cycleId, cardId, amount: 550000 }],
    uncoveredInstallmentDetail: [], directRecurringDetail: [], creditRecurringDetail: [], simulationDetail: [],
    directRecurring: 0, creditRecurring: 0, installmentAmount: 0, simulationAmount: 0,
  }]
  const result = buildNewProjectionTimeline({
    planMonths,
    creditCards: [{ id: cardId, bank: 'falabella', name: 'CMR' }],
    billingCycles: [{ id: cycleId, transactions: [] }],
    now,
  })
  assert.equal(result.future[1].bankSegments.falabella, 550000)
  assert.equal(result.future[1].total, 600000)
})

test('capacidad conservadora mira también los meses posteriores', () => {
  const months = [
    { key: '2026-09', closingBalance: 900000, income: 1200000, receivableAmount: 0 },
    { key: '2026-10', closingBalance: 700000, income: 1200000, receivableAmount: 0 },
    { key: '2026-11', closingBalance: 250000, income: 1200000, receivableAmount: 0 },
  ]
  // Colchón = 120.000, por lo que noviembre limita el gasto extra a 130.000.
  assert.equal(safeSpendingCapacity(months, '2026-09'), 130000)
  assert.equal(safeSpendingCapacity(months, '2026-11'), 130000)
})

test('filtros de banco y categoría devuelven solo la parte seleccionada', () => {
  const row = {
    total: 300000,
    bankSegments: { bchile: 100000, falabella: 200000, otros: 0 },
    categorySegments: { supermercado: 180000, bencina: 120000 },
  }
  assert.equal(visibleBankTotal(row, 'falabella'), 200000)
  assert.equal(visibleBankTotal(row, 'all'), 300000)
  assert.equal(categoryTotal(row, 'supermercado'), 180000)
  assert.equal(categoryTotal(row, 'all'), 300000)
})
