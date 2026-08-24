import test from 'node:test'
import assert from 'node:assert/strict'
import {
  coverReservePayables,
  dashboardReservePayables,
  withMercadoPagoFreeBalance,
  withVariableSalary,
} from '../src/lib/financialModel.js'

const slips = [
  { periodMonth: '2026-04-01', netAmount: 1217281, status: 'actual' },
  { periodMonth: '2026-05-01', netAmount: 1273249, status: 'actual' },
  { periodMonth: '2026-07-01', netAmount: 1220330, status: 'actual' },
]

test('reemplaza el sueldo fijo por sueldo real o estimado por mes', () => {
  const income = withVariableSalary([
    { id: 'salary-old', name: 'Sueldo (estimado móvil)', amount: 1236953, active: true },
    { id: 'other', name: 'ChatGPT', amount: 22000, active: true },
  ], slips, '2026-08', 2, 5)

  const august = income.find(item => item.id === 'salary:2026-08')
  const september = income.find(item => item.id === 'salary:2026-09')
  assert.equal(august.amount, 1220330)
  assert.equal(august.salaryMode, 'actual')
  assert.equal(september.amount, 1236953)
  assert.equal(september.salaryMode, 'estimated')
  assert.equal(income.some(item => item.id === 'salary-old'), false)
})

test('la proyección usa solo el saldo libre de Mercado Pago', () => {
  const accounts = withMercadoPagoFreeBalance([
    { id: 'mp', name: 'Mercado Pago', balance: 550340, active: true },
    { id: 'other', name: 'Cuenta RUT', balance: 1000, active: true },
  ], { last_balance: 250100, reserved_partition_balance: 300240 })
  assert.equal(accounts.find(item => item.id === 'mp').balance, 250100)
  assert.equal(accounts.find(item => item.id === 'other').balance, 1000)
})

test('una deuda completamente financiada por reserva no vuelve a salir del dinero libre', () => {
  const payables = coverReservePayables([
    { id: 'dad', name: 'Papá', amount: 300000, status: 'pending', notes: 'reserva de emergencia' },
    { id: 'water', name: 'Agua', amount: 38030, status: 'pending' },
  ], 300240)
  assert.equal(payables.some(item => item.id === 'dad'), false)
  assert.equal(payables.find(item => item.id === 'water').amount, 38030)
})

test('el dashboard usa la reserva real de Mercado Pago, incluida su ganancia', () => {
  const payables = dashboardReservePayables([
    { id: 'dad', name: 'Papá', personName: 'Papá', amount: 300000, status: 'pending', notes: 'reserva' },
  ], { reserved_partition_balance: 300240 })
  const reserve = payables.find(item => item.id === 'dashboard:mercadopago-reserve')
  assert.equal(reserve.amount, 300240)
  assert.equal(payables.find(item => item.id === 'dad').status, 'paid')
})
