import test from 'node:test'
import assert from 'node:assert/strict'
import { tripSummary, monthlySavingSuggestion } from '../src/lib/tripMath.js'

test('presupuesto y aportes separados sin mezclar compras o gastos bancarios', () => {
  const x = tripSummary(
    [{ estimate: 300000, actual: 120000 }, { estimate: 180000, actual: null }],
    [{ name: 'Wladimick', amount: 100000 }, { name: 'Nicol', amount: 50000 }],
  )
  assert.equal(x.budget, 480000)
  assert.equal(x.spent, 120000)
  assert.equal(x.saved, 150000)
  assert.equal(x.remaining, 330000)
  assert.equal(x.byName.Nicol, 50000)
})
test('ahorro sugerido para febrero desde octubre, sin división por cero', () => {
  const x = monthlySavingSuggestion(980000, '2027-02-12', new Date(2026, 9, 14))
  assert.deepEqual(x, { months: 4, together: 245000, perPerson: 123000 })
})
