import React, { useEffect, useMemo, useState } from 'react'
import { fmtCLP } from '../lib/helpers'
import { fetchBillingCycles } from '../services/billingCyclesService'
import { buildProjectionPlan } from '../services/projectionPlanService'
import {
  buildSpendingTimeline,
  SPENDING_BANKS,
} from '../lib/projectionSpendingTimeline'

const BANK_KEYS = ['bchile', 'falabella', 'otros']

function Segment({ bank, amount, total }) {
  if (amount <= 0 || total <= 0) return null
  const percent = Math.max(0, amount * 100 / total)
  return (
    <div
      className="w-full relative flex items-center justify-center overflow-hidden transition-all"
      style={{
        height: `${percent}%`,
        minHeight: percent > 0 ? 2 : 0,
        backgroundColor: SPENDING_BANKS[bank].color,
      }}
      title={`${SPENDING_BANKS[bank].label}: ${fmtCLP(amount)} (${Math.round(percent)}%)`}
    >
      {percent >= 18 && (
        <span className="text-[9px] font-bold text-white drop-shadow-sm">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  )
}

function TimelineBar({ row, maxTotal, selected, onSelect, divider }) {
  const height = row.total > 0
    ? Math.max(12, Math.round((row.total / maxTotal) * 188))
    : 4

  return (
    <div className={`relative shrink-0 w-[82px] sm:w-[92px] ${divider ? 'ml-5 sm:ml-7' : ''}`}>
      {divider && (
        <div className="absolute -left-3 sm:-left-4 top-7 bottom-9 border-l border-dashed border-[var(--line)]" aria-hidden="true"/>
      )}
      <button
        type="button"
        onClick={() => onSelect(row.key)}
        className="w-full group text-center"
        aria-label={`${row.label}: ${fmtCLP(row.total)}`}
      >
        <div className={`font-mono text-[9px] sm:text-[10px] font-bold mb-2 whitespace-nowrap ${selected ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
          {fmtCLP(row.total)}
        </div>
        <div className="h-[196px] flex items-end justify-center">
          <div
            className={`w-[48px] sm:w-[54px] rounded-t-[10px] overflow-hidden flex flex-col-reverse justify-start shadow-sm transition-all ${selected ? 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--bg-elev)]' : 'group-hover:ring-1 group-hover:ring-[var(--line)]'}`}
            style={{ height, backgroundColor: row.total > 0 ? '#eef0f3' : 'var(--soft)' }}
          >
            {BANK_KEYS.map(bank => (
              <Segment
                key={bank}
                bank={bank}
                amount={Number(row.segments[bank] || 0)}
                total={row.total}
              />
            ))}
          </div>
        </div>
        <div className="mt-2 text-[10.5px] font-bold leading-tight">{row.shortLabel}</div>
        <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[8.5px] font-bold ${row.kind === 'actual'
          ? 'bg-slate-100 text-slate-700'
          : 'bg-violet-50 text-violet-700'}`}>
          {row.kind === 'actual' ? 'Real' : 'Proyección'}
        </div>
      </button>
    </div>
  )
}

function DetailPanel({ row }) {
  if (!row) return null
  return (
    <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <div className="text-[9px] uppercase tracking-[0.11em] text-[var(--muted)] font-bold">
            {row.kind === 'actual' ? 'Gasto real registrado' : 'Salida esperada'}
          </div>
          <div className="text-[14px] font-bold mt-1">{row.label}</div>
          <div className="text-[10px] text-[var(--muted)] mt-1">
            {row.kind === 'actual'
              ? `${row.sourceCount} movimientos conciliados por fecha de compra.`
              : 'Proyección realista: facturas conocidas, cuotas, recurrentes y gasto variable estimado.'}
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">Total</div>
          <div className="font-mono text-[18px] font-bold mt-0.5">{fmtCLP(row.total)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
        {BANK_KEYS.map(bank => {
          const amount = Number(row.segments[bank] || 0)
          const percentage = Number(row.percentages[bank] || 0)
          return (
            <div key={bank} className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SPENDING_BANKS[bank].color }}/>
                  <span className="text-[10px] font-semibold truncate">{SPENDING_BANKS[bank].label}</span>
                </div>
                <span className="text-[9.5px] font-bold text-[var(--muted)]">{percentage}%</span>
              </div>
              <div className="font-mono text-[12px] font-bold mt-1.5">{fmtCLP(amount)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ProjectionSpendingTimeline({
  accounts = [],
  recurringList = [],
  incomeList = [],
  receivables = [],
  payables = [],
  installmentDebts = [],
  expenses = [],
  creditCards = [],
}) {
  const [cycles, setCycles] = useState([])
  const [error, setError] = useState('')
  const [selectedKey, setSelectedKey] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchBillingCycles()
      .then(data => { if (!cancelled) setCycles(data || []) })
      .catch(loadError => {
        if (cancelled) return
        console.error('ProjectionSpendingTimeline:', loadError)
        setError('No fue posible cargar el detalle de tarjetas para el gráfico.')
      })
    return () => { cancelled = true }
  }, [])

  const plan = useMemo(() => buildProjectionPlan({
    accounts,
    recurringList,
    incomeList,
    receivables,
    payables,
    installmentDebts,
    expenses,
    billingCycles: cycles,
    simulations: [],
    scenario: 'realistic',
    includeSavings: false,
    includeReceivables: false,
    includePayables: true,
    horizonMonths: 6,
  }), [
    accounts,
    recurringList,
    incomeList,
    receivables,
    payables,
    installmentDebts,
    expenses,
    cycles,
  ])

  const timeline = useMemo(() => buildSpendingTimeline({
    expenses,
    projectionMonths: plan?.months || [],
    creditCards,
  }), [expenses, plan?.months, creditCards])

  useEffect(() => {
    setSelectedKey(current => timeline.rows.some(row => row.key === current)
      ? current
      : timeline.currentKey)
  }, [timeline.currentKey, timeline.rows])

  const selected = timeline.rows.find(row => row.key === selectedKey) || timeline.rows[3] || timeline.rows[0]

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden shadow-sm">
      <div className="p-4 sm:p-5 border-b border-[var(--line)]">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div>
            <div className="text-[9.5px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Histórico + futuro</div>
            <h2 className="text-[18px] font-bold tracking-tight mt-1">Gasto real y próximos 6 meses</h2>
            <p className="text-[10.5px] text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
              Compara los 3 meses completos anteriores con las salidas esperadas desde este mes. Azul es Banco Chile, verde Banco Falabella y gris agrupa el resto de los gastos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[9.5px] text-[var(--muted)]">
            {BANK_KEYS.map(bank => (
              <span key={bank} className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SPENDING_BANKS[bank].color }}/>
                {SPENDING_BANKS[bank].label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="mx-4 mt-4 rounded-xl bg-amber-50 text-amber-800 px-3 py-2 text-[10px]">{error}</div>}

      <div className="px-3 sm:px-5 pt-4">
        <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] mb-2">
          <span className="w-[246px] sm:w-[276px] text-center">3 meses reales</span>
          <span className="flex-1 text-center">Próximos 6 meses</span>
        </div>
        <div className="overflow-x-auto pb-3">
          <div className="min-w-[810px] flex items-end justify-start gap-1.5 sm:gap-2 px-1">
            {timeline.rows.map((row, index) => (
              <TimelineBar
                key={row.key}
                row={row}
                maxTotal={timeline.maxTotal}
                selected={row.key === selectedKey}
                onSelect={setSelectedKey}
                divider={index === 3}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 pb-4 sm:pb-5">
        <DetailPanel row={selected}/>
        <div className="mt-3 rounded-xl bg-[var(--soft)] px-3 py-2.5 text-[9.5px] text-[var(--muted)] leading-relaxed">
          <strong className="text-[var(--ink-2)]">Cómo leerlo:</strong> los 3 meses de la izquierda son gasto real por fecha de compra. Los 6 de la derecha son flujo futuro esperado: tarjetas por vencimiento, cuotas, gastos fijos y una estimación del gasto variable. Por eso el futuro es una proyección y puede cambiar al cargar nuevos estados de cuenta.
        </div>
      </div>
    </section>
  )
}
