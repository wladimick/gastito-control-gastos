import React, { useEffect, useMemo, useState } from 'react'
import { fmtCLP } from '../lib/helpers'
import { buildBillingHistory } from '../lib/billingHistoryChart'
import { fetchBillingCycles } from '../services/billingCyclesService'

const STATUS_LABEL = {
  paid: 'Pagado',
  in_progress: 'En curso',
  closed: 'Cerrado',
  partial: 'Parcial',
}

function formatDueDate(value) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function monthOnly(label) {
  return String(label || '').split(' ')[0] || 'Mes'
}

function amountModeLabel(month) {
  const active = month?.banks?.filter(bank => bank.amount > 0) || []
  if (!active.length) return 'Sin datos'
  if (active.every(bank => bank.mode === 'informado')) return 'Monto informado'
  if (active.some(bank => bank.mode === 'estimado')) return 'Estimación actual'
  if (active.some(bank => bank.mode === 'detalle conocido')) return 'Detalle conocido'
  return 'Monto disponible'
}

function ChartSkeleton() {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-4 sm:p-5 animate-pulse">
      <div className="h-5 w-48 rounded bg-black/10"/>
      <div className="h-3 w-64 rounded bg-black/5 mt-2"/>
      <div className="h-52 rounded-2xl bg-black/[0.035] mt-5"/>
    </div>
  )
}

export default function BillingHistoryChart({ creditCards = [], refreshToken = 0 }) {
  const [cycles, setCycles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeKey, setActiveKey] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    fetchBillingCycles()
      .then(data => {
        if (!alive) return
        setCycles(data)
      })
      .catch(err => {
        if (!alive) return
        setError(err?.message || 'No fue posible cargar el historial de facturación.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [refreshToken])

  const history = useMemo(
    () => buildBillingHistory(cycles, creditCards, 6),
    [cycles, creditCards],
  )

  useEffect(() => {
    if (!history.months.length) return
    if (!activeKey || !history.months.some(month => month.cycleKey === activeKey)) {
      setActiveKey(history.latestKey)
    }
  }, [history, activeKey])

  const activeMonth = history.months.find(month => month.cycleKey === activeKey)
    || history.months[history.months.length - 1]
    || null

  if (loading) return <ChartSkeleton/>

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">
        <strong>No se pudo cargar el gráfico.</strong> {error}
      </section>
    )
  }

  if (!history.months.length || history.maxTotal <= 0) return null

  const maxHeight = 200
  const gridLines = [0, 25, 50, 75, 100]

  return (
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-50 text-blue-800 grid place-items-center text-[19px] shrink-0" aria-hidden="true">
            ▦
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">Evolución de tarjetas</div>
            <h2 className="text-[18px] sm:text-[20px] font-bold mt-0.5">Próximos vencimientos</h2>
            <p className="text-[11px] sm:text-[12px] text-[var(--muted)] mt-1">Facturación de los últimos 6 meses · composición por banco</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 self-start">
          {history.banks.map(bank => (
            <div key={bank.bankId} className="flex items-center gap-1.5 text-[10.5px] font-semibold whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bank.color }}/>
              {bank.label}
            </div>
          ))}
        </div>
      </div>

      <div className="px-2 sm:px-4 pt-4">
        <div className="overflow-x-auto pb-2">
          <div className="relative min-w-[670px] h-[300px] px-3 pt-8">
            <div className="absolute inset-x-3 top-8 bottom-[62px] pointer-events-none">
              {gridLines.map(value => (
                <div
                  key={value}
                  className="absolute inset-x-0 border-t border-dashed border-slate-200"
                  style={{ bottom: `${value}%` }}
                />
              ))}
            </div>

            <div className="relative z-10 h-full grid grid-cols-6 gap-2 sm:gap-3 items-end">
              {history.months.map(month => {
                const isActive = month.cycleKey === activeMonth?.cycleKey
                const barHeight = history.maxTotal > 0
                  ? Math.max(month.total > 0 ? 18 : 3, month.total * maxHeight / history.maxTotal)
                  : 3

                return (
                  <button
                    type="button"
                    key={month.cycleKey}
                    onClick={() => setActiveKey(month.cycleKey)}
                    aria-pressed={isActive}
                    aria-label={`${month.label}: ${fmtCLP(month.total)}`}
                    className={`group h-full min-w-0 rounded-2xl px-1 pt-1 pb-0 flex flex-col items-center justify-end transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isActive ? 'bg-emerald-50/70 ring-1 ring-emerald-200' : 'hover:bg-[var(--hover)]'}`}
                  >
                    <div className="h-[38px] flex flex-col justify-end items-center w-full">
                      {month.isLatest && (
                        <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[9px] font-bold whitespace-nowrap">
                          Facturación {monthOnly(month.label).toLowerCase()}
                        </span>
                      )}
                      <div className="font-mono text-[11px] font-bold mt-1 whitespace-nowrap">{fmtCLP(month.total)}</div>
                    </div>

                    <div
                      className="w-full max-w-[82px] rounded-t-lg overflow-hidden flex flex-col-reverse shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] bg-slate-100"
                      style={{ height: `${barHeight}px` }}
                    >
                      {month.banks.map(bank => {
                        if (bank.percentage <= 0) return null
                        return (
                          <div
                            key={bank.bankId}
                            className="w-full grid place-items-center transition-opacity group-hover:opacity-90"
                            style={{
                              height: `${bank.percentage}%`,
                              backgroundColor: bank.color,
                              minHeight: bank.percentage > 0 ? '4px' : 0,
                            }}
                            title={`${bank.label}: ${fmtCLP(bank.amount)} (${bank.percentage}%)`}
                          >
                            {bank.percentage >= 12 && (
                              <span className="text-white text-[9px] sm:text-[10px] font-bold drop-shadow-sm">{bank.percentage}%</span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="h-[58px] pt-2 text-center w-full">
                      <div className="text-[10px] sm:text-[11px] font-bold leading-tight">{month.shortLabel}</div>
                      <div className="flex justify-center gap-1 mt-1">
                        {month.banks.map(bank => (
                          <span
                            key={bank.bankId}
                            className="text-[8.5px] font-semibold"
                            style={{ color: bank.amount > 0 ? bank.color : 'var(--muted)' }}
                          >
                            {bank.percentage}%
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {activeMonth && (
        <div className="border-t border-[var(--line)] bg-[var(--soft)]/55 px-4 sm:px-5 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">{amountModeLabel(activeMonth)}</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <div className="font-mono text-[21px] font-bold">{fmtCLP(activeMonth.total)}</div>
                <div className="text-[11px] text-[var(--muted)]">{activeMonth.label}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:min-w-[430px]">
              {activeMonth.banks.map(bank => (
                <div key={bank.bankId} className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bank.color }}/>
                      {bank.label}
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: bank.color }}>{bank.percentage}%</span>
                  </div>
                  <div className="font-mono text-[13px] font-bold mt-1">{fmtCLP(bank.amount)}</div>
                  <div className="text-[9.5px] text-[var(--muted)] mt-1 flex flex-wrap gap-x-1">
                    <span>{bank.mode}</span>
                    {bank.dueDate && <span>· vence {formatDueDate(bank.dueDate)}</span>}
                    {bank.status && <span>· {STATUS_LABEL[bank.status] || bank.status}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[9.5px] text-[var(--muted)] leading-relaxed mt-3">
            Cada barra muestra el total del ciclo. El color indica qué porcentaje corresponde a cada banco. Los ciclos conciliados usan el monto informado; los ciclos abiertos usan la estimación más reciente.
          </p>
        </div>
      )}
    </section>
  )
}
