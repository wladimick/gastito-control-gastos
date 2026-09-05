import React, { useMemo } from 'react'
import ExpensesListBase from './ExpensesListBase'
import { fmtCLP } from '../lib/helpers'

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : ''
}

function monthKey(value) {
  return dateOnly(value).slice(0, 7)
}

function monthLabel(key) {
  if (!key) return 'Sin mes'
  const [year, month] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CL', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function currentMonthKey() {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'America/Santiago',
  }).format(new Date()).slice(0, 7)
}

export default function ExpensesList(props) {
  const expenses = props.expenses || []
  const importedByMonth = useMemo(() => {
    const groups = new Map()
    expenses
      .filter(row => ['billing', 'reconciled'].includes(row.source))
      .filter(row => monthKey(row.date))
      .forEach(row => {
        const key = monthKey(row.date)
        const current = groups.get(key) || { key, count: 0, total: 0 }
        current.count += 1
        current.total += Number(row.amount || 0)
        groups.set(key, current)
      })
    return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, [expenses])

  const current = currentMonthKey()
  const previousImported = importedByMonth.find(group => group.key !== current)

  return (
    <div>
      {previousImported && (
        <div className="max-w-7xl mx-auto mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950">
          <div className="text-[10px] uppercase tracking-[0.11em] font-bold opacity-65">Movimientos de tarjeta cargados</div>
          <div className="text-[12px] font-semibold mt-1">
            {previousImported.count} movimientos están en {monthLabel(previousImported.key)} · {fmtCLP(previousImported.total)}
          </div>
          <div className="text-[10.5px] mt-1 opacity-75 leading-relaxed">
            Gastos se ordena por la fecha real de compra, no por la fecha de pago de la tarjeta. Si acabamos de cargar compras de agosto, aparecen en el botón de Agosto aunque hoy estemos en septiembre.
          </div>
        </div>
      )}
      <ExpensesListBase {...props}/>
    </div>
  )
}
