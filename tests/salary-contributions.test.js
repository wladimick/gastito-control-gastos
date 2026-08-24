import test from 'node:test'
import assert from 'node:assert/strict'
import { salaryContributionStats } from '../src/lib/salaryModel.js'

const slips = [
  { pensionHealthBase:1535997, unemploymentBase:1535997, pensionAmount:160665, healthAmount:107520, unemploymentAmount:9216, status:'actual' },
  { pensionHealthBase:1509103, unemploymentBase:1509103, pensionAmount:157852, healthAmount:105637, unemploymentAmount:9055, status:'actual' },
  { pensionHealthBase:1502498, unemploymentBase:1502498, pensionAmount:157161, healthAmount:105175, unemploymentAmount:9015, status:'actual' },
  { pensionHealthBase:1503230, unemploymentBase:1503230, pensionAmount:157238, healthAmount:105226, unemploymentAmount:9019, status:'actual' },
  { pensionHealthBase:1499497, unemploymentBase:1499497, pensionAmount:156847, healthAmount:104965, unemploymentAmount:8997, status:'actual' },
  { pensionHealthBase:1570168, unemploymentBase:1570168, pensionAmount:164240, healthAmount:109912, unemploymentAmount:9421, status:'actual' },
  { pensionHealthBase:1502167, unemploymentBase:1502167, pensionAmount:157127, healthAmount:105152, unemploymentAmount:9013, status:'actual' },
]

test('resume aportes previsionales documentados sin confundirlos con saldos reales', () => {
  const s = salaryContributionStats(slips)
  assert.equal(s.months, 7)
  assert.equal(s.pensionBase, 10622660)
  assert.equal(s.afpDeducted, 1111130)
  assert.equal(s.afpWorkerSavings, 1062267)
  assert.equal(s.afpCommission, 48863)
  assert.equal(s.health, 743587)
  assert.equal(s.afcWorker, 63736)
  assert.equal(s.afcEmployerCic, 169964)
  assert.equal(s.afcExpectedCic, 233700)
  assert.equal(s.afcEmployerFcs, 84981)
})
