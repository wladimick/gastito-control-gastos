import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBillingDescription, parseBillingJson } from '../src/lib/billingJsonImport.js'

test('normaliza un payload válido y clasifica compras, impuestos y cuotas', () => {
  const result = parseBillingJson(JSON.stringify({
    bank: 'falabella',
    card: 'cmr',
    source: 'prueba-json',
    transactions: [
      { date: '2026-09-01', description: 'Supermercado Central', amount: 12500 },
      { date: '2026-09-02', description: 'Impuesto compra cuotas', amount: 85 },
      { date: '2026-09-03', description: 'Comercio Online', amount: 9990, installment_current: 1, installment_total: 3 },
    ],
  }))

  assert.equal(result.rootError, '')
  assert.equal(result.totals.rows, 3)
  assert.equal(result.totals.valid, 3)
  assert.equal(result.totals.errors, 0)
  assert.equal(result.totals.amount, 22575)
  assert.equal(result.validTransactions[0].movement_type, 'purchase')
  assert.equal(result.validTransactions[1].movement_type, 'tax')
  assert.equal(result.validTransactions[2].movement_type, 'installment')
  assert.equal(result.validTransactions[2].installment_current, 1)
  assert.equal(result.validTransactions[2].installment_total, 3)
})

test('acepta montos CLP escritos con separador de miles', () => {
  const result = parseBillingJson({
    transactions: [
      { fecha: '2026-09-01', descripcion: 'Compra local', monto: '$13.756' },
    ],
  })

  assert.equal(result.totals.valid, 1)
  assert.equal(result.validTransactions[0].amount, 13756)
})

test('acepta pendientes sin fecha y los deja fuera del total por defecto', () => {
  const result = parseBillingJson({
    transactions: [
      { description: 'Mayorista DyL', amount: 50926, is_pending: true },
      { date: '2026-08-29', description: 'Impuesto compra cuotas', amount: 76, affects_cycle_total: false },
    ],
  })

  assert.equal(result.totals.valid, 2)
  assert.equal(result.validTransactions[0].date, null)
  assert.equal(result.validTransactions[0].is_pending, true)
  assert.equal(result.validTransactions[0].affects_cycle_total, false)
  assert.equal(result.validTransactions[1].movement_type, 'tax')
  assert.equal(result.validTransactions[1].affects_cycle_total, false)
})

test('mantiene errores por fila sin descartar movimientos válidos', () => {
  const result = parseBillingJson({
    transactions: [
      { date: '2026-09-01', description: 'Movimiento válido', amount: 1000 },
      { date: '2026-02-31', description: '', amount: 0, installment_current: 4, installment_total: 3 },
    ],
  })

  assert.equal(result.totals.rows, 2)
  assert.equal(result.totals.valid, 1)
  assert.equal(result.totals.errors, 1)
  assert.equal(result.items[1].status, 'error')
  assert.ok(result.items[1].errors.length >= 3)
})

test('reporta JSON raíz inválido', () => {
  const result = parseBillingJson('{mal json')
  assert.match(result.rootError, /JSON inválido/)
  assert.equal(result.payload, null)
})

test('normaliza descripción para conciliación', () => {
  assert.equal(
    normalizeBillingDescription('  CLÍNICA   ÁRBOL  '),
    'clinica arbol',
  )
})
