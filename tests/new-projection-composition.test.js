import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildNewProjectionTimeline,
  projectionSegments,
  visibleBankTotal,
} from '../src/lib/newProjectionModel.js'

const now = new Date('2026-09-07T17:00:00-03:00')

test('separa el vencimiento informado por Falabella de recurrentes y cuotas adicionales', () => {
  const cardId = 'fal'
  const timeline = buildNewProjectionTimeline({
    now,
    creditCards: [{ id: cardId, bank: 'falabella', name: 'CMR Falabella' }],
    billingForecasts: [{
      id: 'forecast-nov',
      cardId,
      cashMonth: '2026-11',
      amount: 73458,
      active: true,
    }],
    planMonths: [{
      key: '2026-11',
      outflow: 130532,
      cardAmount: 120000,
      knownCardAmount: 0,
      uncoveredInstallmentAmount: 90000,
      estimatedCreditVariableRemaining: 0,
      knownCycles: [],
      uncoveredInstallmentDetail: [{
        id: 'occ-1',
        cardId,
        amount: 90000,
        installmentCurrent: 2,
        installmentTotal: 6,
      }],
      directRecurringDetail: [{
        id: 'agua', name: 'Agua', amount: 10532, bank: '', category: 'hogar', dayOfMonth: 12,
      }],
      creditRecurringDetail: [{
        id: 'spotify', name: 'Spotify', amount: 30000, bank: 'falabella', category: 'entretencion', dayOfMonth: 18,
      }],
      directRecurring: 10532,
      creditRecurring: 30000,
      simulationDetail: [],
      simulationAmount: 0,
      closingBalance: 1000000,
      income: 1200000,
      receivableAmount: 0,
    }],
  })

  const november = timeline.future.find(row => row.key === '2026-11')
  assert.ok(november)
  assert.equal(november.total, 130532)
  assert.equal(november.sourceByBank.falabella.billing, 73458)
  assert.equal(november.sourceByBank.falabella.installments, 16542)
  assert.equal(november.sourceByBank.falabella.recurring, 30000)
  assert.equal(november.sourceByBank.otros.recurring, 10532)

  const all = projectionSegments(november, 'all')
  assert.equal(all.find(item => item.id === 'billing:falabella')?.amount, 73458)
  assert.equal(all.find(item => item.id === 'recurring')?.amount, 40532)
  assert.equal(all.find(item => item.id === 'installments')?.amount, 16542)
  assert.equal(all.reduce((sum, item) => sum + item.amount, 0), 130532)

  const falabella = projectionSegments(november, 'falabella')
  assert.equal(falabella.find(item => item.id === 'billing:falabella')?.amount, 73458)
  assert.equal(falabella.find(item => item.id === 'recurring')?.amount, 30000)
  assert.equal(falabella.find(item => item.id === 'installments')?.amount, 16542)
  assert.equal(visibleBankTotal(november, 'falabella'), 120000)
})

test('los checkboxes ocultan la capa sin alterar la base informada por el banco', () => {
  const row = {
    kind: 'projected',
    sourceByBank: {
      bchile: { billing: 0, recurring: 0, installments: 0, simulations: 0, other: 0 },
      falabella: { billing: 73458, recurring: 30000, installments: 16542, simulations: 10000, other: 0 },
      otros: { billing: 0, recurring: 10532, installments: 0, simulations: 0, other: 0 },
    },
  }

  assert.equal(visibleBankTotal(row, 'falabella'), 130000)
  assert.equal(visibleBankTotal(row, 'falabella', { recurring: false, installments: true, simulations: true }), 100000)
  assert.equal(visibleBankTotal(row, 'falabella', { recurring: false, installments: false, simulations: false }), 73458)
})
