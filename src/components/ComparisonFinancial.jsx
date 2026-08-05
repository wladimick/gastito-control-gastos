import React, { useMemo } from 'react'
import { financialHelpFor } from '../lib/financialHelp'
import { Badge, Card, InfoTip } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'
import { CATEGORIES } from '../data'
import {
  dateOnlyCL,
  dayOfMonthCL,
  daysInMonthKey,
  monthKeyCL,
  monthLabelCL,
  previousMonthKey,
} from '../lib/financialDates'

const FALLBACK_CATEGORY = CATEGORIES.find(category => category.id === 'otros') || {
  id: 'otros', label: 'Otros', icon: '•', color: '#888880',
}

function categoryFor(row) {
  return row.categoryMeta || CATEGORIES.find(category => category.id === row.category) || FALLBACK_CATEGORY
}

function amount(list) {
  return list.reduce((sum, row) => sum + Number(row.amount || 0), 0)
}

function Metric({label, value, detail, tone = 'default', info}) {
  const help = info || financialHelpFor(label);
  const toneClass = tone === 'dark'
    ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent'
    : tone === 'good'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-100'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-900 border-amber-100'
        : 'bg-[var(--bg-elev)] border-[var(--line)]'
  return (
    <div className={`rounded-2xl border p-4 min-h-[108px] ${toneClass}`}>
      <div className="flex items-center gap-1.5"><div className="text-[9.5px] uppercase tracking-[.12em] font-bold opacity-60">{label}</div>{help && <InfoTip content={help}/>}</div>
      <div className="font-mono text-[21px] font-bold mt-2">{value}</div>
      <div className="text-[9.5px] opacity-65 mt-1 leading-relaxed">{detail}</div>
    </div>
  )
}

export default function ComparisonFinancial({ expenses = [] }) {
  const currentKey = monthKeyCL()
  const previousKey = previousMonthKey(currentKey)
  const currentDay = dayOfMonthCL()
  const previousComparableDay = Math.min(currentDay, daysInMonthKey(previousKey))

  const currentRows = useMemo(() => expenses.filter(row => monthKeyCL(row.date) === currentKey), [expenses, currentKey])
  const previousRows = useMemo(() => expenses.filter(row => monthKeyCL(row.date) === previousKey), [expenses, previousKey])
  const previousComparableRows = useMemo(() => previousRows.filter(row => {
    const day = Number(dateOnlyCL(row.date).slice(8, 10)) || 0
    return day <= previousComparableDay
  }), [previousRows, previousComparableDay])

  const currentTotal = amount(currentRows)
  const previousComparableTotal = amount(previousComparableRows)
  const previousFullTotal = amount(previousRows)
  const delta = currentTotal - previousComparableTotal
  const deltaPct = previousComparableTotal > 0
    ? delta * 100 / previousComparableTotal
    : currentTotal > 0 ? 100 : 0
  const projectedCurrent = currentDay > 0
    ? Math.round(currentTotal / currentDay * daysInMonthKey(currentKey))
    : currentTotal

  const categoryRows = useMemo(() => {
    const grouped = new Map()
    const add = (row, key) => {
      const category = categoryFor(row)
      const current = grouped.get(category.id) || { ...category, current: 0, previous: 0 }
      current[key] += Number(row.amount || 0)
      grouped.set(category.id, current)
    }
    currentRows.forEach(row => add(row, 'current'))
    previousComparableRows.forEach(row => add(row, 'previous'))
    return [...grouped.values()]
      .filter(row => row.current > 0 || row.previous > 0)
      .sort((a, b) => Math.max(b.current, b.previous) - Math.max(a.current, a.previous))
  }, [currentRows, previousComparableRows])

  const methodRows = useMemo(() => {
    const split = list => list.reduce((result, row) => {
      const key = row.method === 'efectivo'
        ? 'efectivo'
        : row.type === 'credito' ? 'credito' : 'debito'
      result[key] += Number(row.amount || 0)
      return result
    }, { credito: 0, debito: 0, efectivo: 0 })
    return { current: split(currentRows), previous: split(previousComparableRows) }
  }, [currentRows, previousComparableRows])

  const daily = useMemo(() => {
    const maxDays = Math.max(daysInMonthKey(currentKey), daysInMonthKey(previousKey))
    const rows = Array.from({ length: maxDays }, (_, index) => ({ day: index + 1, current: 0, previous: 0 }))
    currentRows.forEach(row => {
      const day = Number(dateOnlyCL(row.date).slice(8, 10))
      if (rows[day - 1]) rows[day - 1].current += Number(row.amount || 0)
    })
    previousComparableRows.forEach(row => {
      const day = Number(dateOnlyCL(row.date).slice(8, 10))
      if (rows[day - 1]) rows[day - 1].previous += Number(row.amount || 0)
    })
    return rows
  }, [currentRows, previousComparableRows, currentKey, previousKey])

  const maxDaily = Math.max(1, ...daily.flatMap(row => [row.current, row.previous]))
  const maxCategory = Math.max(1, ...categoryRows.flatMap(row => [row.current, row.previous]))

  if (!currentRows.length && !previousRows.length) {
    return (
      <Card padding="p-12" className="text-center">
        <div className="text-[30px]">📅</div>
        <div className="text-[14px] font-semibold mt-3">Sin datos para comparar</div>
        <div className="text-[11px] text-[var(--muted)] mt-1">Registra gastos en el mes actual o anterior para generar la comparación.</div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <div>
        <div className="text-[10px] uppercase tracking-[.13em] text-[var(--muted)] font-bold">Análisis</div>
        <h1 className="text-[22px] font-bold mt-1">Comparación mensual</h1>
        <p className="text-[11px] text-[var(--muted)] mt-1 max-w-2xl">
          Compara los primeros {currentDay} días de {monthLabelCL(currentKey)} con el mismo tramo de {monthLabelCL(previousKey)}. Así no se enfrenta un mes parcial contra un mes completo.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label={`${monthLabelCL(currentKey, true)} · día ${currentDay}`} value={fmtCLP(currentTotal)}
          detail={`${currentRows.length} movimientos conciliados`} tone="dark"/>
        <Metric label={`${monthLabelCL(previousKey, true)} · primeros ${previousComparableDay} días`} value={fmtCLP(previousComparableTotal)}
          detail={`${previousComparableRows.length} movimientos comparables`}/>
        <Metric label="Diferencia comparable" value={`${delta >= 0 ? '+' : ''}${fmtCLP(delta)}`}
          detail={`${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(0)}% frente al mismo tramo`}
          tone={delta <= 0 ? 'good' : 'warn'}/>
        <Metric label="Proyección al cierre" value={fmtCLP(projectedCurrent)}
          detail={`Mes anterior completo: ${fmtCLP(previousFullTotal)}`}/>
      </div>

      <Card padding="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Ritmo diario</div>
            <div className="text-[13px] font-semibold mt-1">Mismo número de días</div>
          </div>
          <div className="flex items-center gap-3 text-[9px] text-[var(--muted)]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--ink)]"/>Actual</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--ink-3)]"/>Anterior</span>
          </div>
        </div>
        <div className="mt-5 grid gap-1 items-end" style={{ gridTemplateColumns: `repeat(${daily.length}, minmax(4px, 1fr))` }}>
          {daily.map(row => (
            <div key={row.day} className={`flex flex-col justify-end gap-0.5 h-28 ${row.day > currentDay ? 'opacity-20' : ''}`}
              title={`Día ${row.day}: actual ${fmtCLP(row.current)} · anterior ${fmtCLP(row.previous)}`}>
              <div className="rounded-t bg-[var(--ink)]" style={{ height: `${Math.max(row.current ? 3 : 1, row.current * 88 / maxDaily)}px` }}/>
              <div className="rounded-b bg-[var(--ink-3)]" style={{ height: `${Math.max(row.previous ? 3 : 1, row.previous * 88 / maxDaily)}px` }}/>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[8px] text-[var(--muted)]"><span>Día 1</span><span>Día {daily.length}</span></div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr] gap-4">
        <Card padding="p-0" className="overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[var(--line)] flex items-center justify-between">
            <div>
              <div className="text-[9.5px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Categorías</div>
              <div className="text-[13px] font-semibold mt-0.5">Dónde cambió el gasto</div>
            </div>
            <Badge tone="muted">{categoryRows.length}</Badge>
          </div>
          <div>
            {categoryRows.map(category => {
              const categoryDelta = category.current - category.previous
              return (
                <div key={category.id} className="px-4 py-3.5 border-b border-[var(--line)] last:border-b-0">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center">
                    <div className="w-9 h-9 rounded-xl grid place-items-center text-[16px]"
                      style={{ backgroundColor: `${category.color || '#888880'}18` }}>{category.icon}</div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold truncate">{category.label}</div>
                        <div className="text-[9px] text-[var(--muted)]">Antes {fmtCLP(category.previous)}</div>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--line)] mt-2 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${category.current * 100 / maxCategory}%`, backgroundColor: category.color || '#888880' }}/>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[11.5px] font-bold">{fmtCLP(category.current)}</div>
                      <div className={`text-[8.5px] mt-0.5 ${categoryDelta <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {categoryDelta >= 0 ? '+' : ''}{fmtCLP(categoryDelta)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card padding="p-4">
          <div className="text-[9.5px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Medios de pago</div>
          <div className="text-[13px] font-semibold mt-1">Actual versus tramo anterior</div>
          <div className="space-y-3 mt-4">
            {[
              ['credito', 'Crédito', 'card'],
              ['debito', 'Débito', 'card'],
              ['efectivo', 'Efectivo', 'cash'],
            ].map(([key, label, icon]) => {
              const current = methodRows.current[key]
              const previous = methodRows.previous[key]
              const change = current - previous
              return (
                <div key={key} className="rounded-xl border border-[var(--line)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold"><Icon name={icon} size={13}/>{label}</div>
                    <div className={`text-[9px] ${change <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{change >= 0 ? '+' : ''}{fmtCLP(change)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div><div className="text-[8px] uppercase text-[var(--muted)]">Actual</div><div className="font-mono text-[12px] font-bold">{fmtCLP(current)}</div></div>
                    <div><div className="text-[8px] uppercase text-[var(--muted)]">Anterior</div><div className="font-mono text-[12px] text-[var(--muted)]">{fmtCLP(previous)}</div></div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
