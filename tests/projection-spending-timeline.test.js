import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSpendingTimeline,
  normalizeBankId,
} from '../src/lib/projectionSpendingTimeline.js'

test('normaliza Banco Chile y Banco Falabella', () => {
  assert.equal(normalizeBankId('bchile'), 'bchile')
  assert.equal(normalizeBankId('Banco de Chile'), 'bchile')
  assert.equal(normalizeBankId('CMR Falabella'), 'falabella')
  assert.equal(normalizeBankId('efectivo'), 'otros')
})

test('muestra 3 meses reales y 6 meses futuros', () => {
  const timeline = buildSpendingTimeline({
    now: new Date('2026-09-07T15:00:00Z'),
    expenses: [],
    projectionMonths: [],
  })

  assert.equal(timeline.rows.length, 9)
  assert.deepEqual(
    timeline.history.map(row => row.key),
    ['2026-06', '2026-07', '2026-08'],
  )
  assert.deepEqual(
    timeline.future.map(row => row.key),
    ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02'],
  )
})

test('el histórico usa todos los gastos conciliados y evita pagos de tarjeta', () => {
  const timeline = buildSpendingTimeline({
    now: new Date('2026-09-07T15:00:00Z'),
    expenses: [
      { date: '2026-08-02', amount: 100000, bank: 'bchile', status: 'ok', movementType: 'purchase' },
      { date: '2026-08-03', amount: 200000, bank: 'falabella', status: 'ok', movementType: 'purchase' },
      { date: '2026-08-04', amount: 50000, bank: 'efectivo', status: 'ok' },
      { date: '2026-08-05', amount: 300000, bank: 'falabella', status: 'ok', movementType: 'payment' },
      { date: '2026-08-06', amount: 10000, bank: 'bchile', status: 'pendiente', movementType: 'purchase' },
    ],
  })

  const august = timeline.history.find(row => row.key === '2026-08')
  assert.equal(august.total, 350000)
  assert.equal(august.segments.bchile, 100000)
  assert.equal(august.segments.falabella, 200000)
  assert.equal(august.segments.otros, 50000)
})

test('la proyección reparte facturas conocidas por banco y resto como otros gastos', () => {
  const timeline = buildSpendingTimeline({
    now: new Date('2026-09-07T15:00:00Z'),
    creditCards: [
      { id: 'chile-card', bank: 'bchile', name: 'Banco Chile' },
      { id: 'cmr-card', bank: 'falabella', name: 'CMR' },
    ],
    projectionMonths: [
      {
        key: '2026-09',
        outflow: 1000000,
        cardAmount: 700000,
        cardConfidence: 'confirmed',
        knownCycles: [
          { cardId: 'chile-card', amount: 200000 },
          { cardId: 'cmr-card', amount: 500000 },
        ],
        uncoveredInstallmentDetail: [],
        installmentDetail: [],
      },
    ],
  })

  const september = timeline.future.find(row => row.key === '2026-09')
  assert.equal(september.total, 1000000)
  assert.equal(september.segments.bchile, 200000)
  assert.equal(september.segments.falabella, 500000)
  assert.equal(september.segments.otros, 300000)
  assert.equal(september.percentages.bchile, 20)
  assert.equal(september.percentages.falabella, 50)
  assert.equal(september.percentages.otros, 30)
})

test('un piso de cuotas futuro conserva el banco por cardId', () => {
  const timeline = buildSpendingTimeline({
    now: new Date('2026-09-07T15:00:00Z'),
    creditCards: [{ id: 'cmr-card', bank: 'falabella', name: 'CMR' }],
    projectionMonths: [
      {
        key: '2026-10',
        outflow: 250000,
        cardAmount: 180000,
        knownCycles: [],
        uncoveredInstallmentDetail: [
          { cardId: 'cmr-card', amount: 120000 },
        ],
        installmentDetail: [],
      },
    ],
  })

  const october = timeline.future.find(row => row.key === '2026-10')
  assert.equal(october.segments.falabella, 120000)
  assert.equal(october.segments.otros, 130000)
  assert.equal(october.total, 250000)
})
