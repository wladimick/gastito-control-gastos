import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryLabel, uniqueCategoryOptions } from '../src/lib/categoryOptions.js'

test('presenta una sola alternativa para categorías equivalentes', () => {
  const categories = [
    { id: 'plural', label: 'Mascotas' },
    { id: 'singular', label: 'Mascota' },
    { id: 'food', label: 'Comida' },
  ]

  assert.deepEqual(uniqueCategoryOptions(categories).map(item => item.id), ['food', 'singular'])
  assert.equal(categoryLabel(categories[0]), 'Mascota')
})
