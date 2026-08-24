import test from 'node:test'
import assert from 'node:assert/strict'
import { removeLinkedManualDuplicates } from '../src/lib/movementAudit.js'

test('el vínculo manual_expense_id evita duplicados aunque cambie el nombre del comercio', () => {
  const rows = [
    { id: 'expense-1', rawId: 'expense-1', source: 'manual', description: 'SUSHI EL PATRON', amount: 10500 },
    { id: 'billing-1', rawId: 'billing-1', source: 'billing', description: 'MercadoPago *Pratrons', amount: 10500 },
  ]
  const result = removeLinkedManualDuplicates(rows, new Set(['expense-1']))
  assert.deepEqual(result.map(item => item.id), ['billing-1'])
})

test('una fila ya conciliada se conserva porque representa un único movimiento', () => {
  const rows = [
    { id: 'expense-2', rawId: 'expense-2', source: 'reconciled', description: 'Shell', amount: 30020 },
  ]
  const result = removeLinkedManualDuplicates(rows, new Set(['expense-2']))
  assert.equal(result.length, 1)
  assert.equal(result[0].source, 'reconciled')
})
