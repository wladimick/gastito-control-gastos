import React, { useEffect, useMemo, useState } from 'react'
import { fmtCLP } from '../lib/helpers'
import { isConfigured, supabase } from '../lib/supabase'

const TYPE_LABELS = {
  purchase: 'Compra',
  installment: 'Compra en cuotas',
  commission: 'Comisión',
  tax: 'Impuesto',
  interest: 'Interés',
  other: 'Gasto mensual',
}

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`))
}

function formatCycleLabel(key) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return key || 'Ciclo'
  const [year, month] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function Header() {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--bg-elev)]">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-[18px] font-bold tracking-tight">Gastito</div>
          <div className="text-[11px] text-[var(--muted)] mt-0.5">Gastos compartidos con Nicol</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--muted)] border border-[var(--line)] rounded-full px-2.5 py-1">
          Solo lectura
        </div>
      </div>
    </header>
  )
}

function Message({ title, text, loading = false }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        {loading && <div className="w-8 h-8 rounded-full border-2 border-[var(--line)] border-t-[var(--ink)] animate-spin mx-auto mb-5" />}
        <h1 className="text-[19px] font-bold">{title}</h1>
        <p className="text-[13px] text-[var(--muted)] mt-2 leading-relaxed">{text}</p>
      </main>
    </div>
  )
}

function CycleSelector({ cycles, selectedKey, onSelect }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Ciclo mensual</div>
          <div className="text-[12px] text-[var(--muted)] mt-0.5">Selecciona el mes que quieres revisar</div>
        </div>
        <div className="text-[10.5px] text-[var(--muted)] whitespace-nowrap">{cycles.length} meses</div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
        {cycles.map(cycle => {
          const selected = cycle.cycleKey === selectedKey
          return (
            <button
              key={cycle.cycleKey}
              type="button"
              onClick={() => onSelect(cycle.cycleKey)}
              className={`snap-start shrink-0 min-w-[150px] rounded-2xl border px-3.5 py-3 text-left transition-colors ${selected
                ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                : 'bg-[var(--bg-elev)] text-[var(--ink)] border-[var(--line)] hover:bg-[var(--hover)]'}`}
            >
              <div className="text-[11.5px] font-semibold">{formatCycleLabel(cycle.cycleKey)}</div>
              <div className="font-mono text-[15px] font-bold mt-1">{fmtCLP(cycle.nicolAmount || 0)}</div>
              <div className={`text-[9.5px] mt-1 ${selected ? 'opacity-60' : 'text-[var(--muted)]'}`}>
                {cycle.isCurrent ? 'Mes actual' : cycle.isUpcoming ? 'Próximo mes' : 'Mes anterior'}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function CycleSummary({ cycle, percentage, index, total, onMove }) {
  return (
    <section className="bg-[var(--ink)] text-[var(--bg)] rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] opacity-60 font-bold">
            {cycle.isUpcoming ? 'Monto estimado del ciclo' : 'Total compartido del ciclo'}
          </div>
          <div className="text-[17px] font-semibold mt-1">{formatCycleLabel(cycle.cycleKey)}</div>
        </div>
        <div className="flex gap-1.5">
          <button type="button" disabled={index <= 0} onClick={() => onMove(-1)} aria-label="Ciclo anterior"
            className="w-9 h-9 rounded-full border border-white/15 grid place-items-center disabled:opacity-25 hover:bg-white/10">
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" disabled={index >= total - 1} onClick={() => onMove(1)} aria-label="Ciclo siguiente"
            className="w-9 h-9 rounded-full border border-white/15 grid place-items-center disabled:opacity-25 hover:bg-white/10">
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      <div className="font-mono text-[30px] font-bold mt-4">{fmtCLP(cycle.sharedTotal || 0)}</div>
      <div className="mt-4 pt-4 border-t border-white/15 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] opacity-60 font-bold">Aporte de Nicol</div>
          <div className="font-mono text-[23px] font-bold mt-1">{fmtCLP(cycle.nicolAmount || 0)}</div>
        </div>
        <div className="text-[13px] font-semibold bg-white/10 rounded-full px-3 py-1.5">{percentage}%</div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] opacity-65 mt-4">
        {cycle.dueDate && <span>Vencimiento desde {formatDate(cycle.dueDate)}</span>}
        {cycle.projectedCount > 0 && <span>{cycle.projectedCount} cuotas proyectadas</span>}
        {cycle.recurringCount > 0 && <span>{cycle.recurringCount} recurrentes</span>}
      </div>
    </section>
  )
}

function InstallmentBadges({ item }) {
  const current = Number(item.installmentCurrent || 0)
  const total = Number(item.installmentTotal || 0)
  if (item.movementType !== 'installment' || current < 1 || total < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${item.isProjected
        ? 'bg-blue-100 text-blue-800'
        : 'bg-amber-100 text-amber-900'}`}>
        {item.isProjected ? 'Este ciclo pagará' : 'Este ciclo paga'}
      </span>
      <span className="inline-flex items-center rounded-full bg-[var(--ink)] text-[var(--bg)] px-2.5 py-1 text-[11px] font-bold font-mono">
        Cuota {current}/{total}
      </span>
      {current === total && (
        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-[10px] font-bold">
          Última cuota
        </span>
      )}
    </div>
  )
}

function TransactionRow({ item }) {
  const isInstallment = item.movementType === 'installment'
    && Number(item.installmentCurrent || 0) > 0
    && Number(item.installmentTotal || 0) > 1
  const meta = item.isRecurring
    ? 'Gasto mensual'
    : item.isProjected
      ? 'Monto proyectado'
      : formatDate(item.date) || TYPE_LABELS[item.movementType] || 'Movimiento'

  return (
    <div className="px-4 py-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold break-words leading-snug">{item.description}</div>
        <InstallmentBadges item={item} />
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] text-[var(--muted)] mt-2">
          <span>{meta}</span>
          {!item.isRecurring && !isInstallment && <span>· {TYPE_LABELS[item.movementType] || 'Movimiento'}</span>}
          {item.isRecurring && (
            <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold">Recurrente</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-[13px] font-bold">{fmtCLP(item.amount || 0)}</div>
        {isInstallment && <div className="text-[9.5px] text-[var(--muted)] mt-1">valor de esta cuota</div>}
      </div>
    </div>
  )
}

export default function NicolPublicCyclesVisual({ token }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' })
  const [selectedKey, setSelectedKey] = useState('')

  useEffect(() => {
    if (!supabase) {
      setState({ loading: false, data: null, error: 'Supabase no está configurado.' })
      return undefined
    }

    let cancelled = false
    const cleanToken = String(token || '').trim()
    supabase.rpc('get_nicol_share_cycles', { p_token: cleanToken })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) throw error
        if (!data?.ok) throw new Error(data?.message || 'El enlace no existe o fue desactivado.')
        setState({ loading: false, data, error: '' })
      })
      .catch(error => {
        if (!cancelled) setState({ loading: false, data: null, error: error.message })
      })

    return () => { cancelled = true }
  }, [token])

  const cycles = state.data?.cycles || []

  useEffect(() => {
    if (!cycles.length) return
    if (selectedKey && cycles.some(cycle => cycle.cycleKey === selectedKey)) return
    const current = cycles.find(cycle => cycle.cycleKey === state.data?.currentCycleKey)
    const next = cycles.find(cycle => cycle.cycleKey > (state.data?.currentCycleKey || ''))
    setSelectedKey((current || next || cycles[cycles.length - 1]).cycleKey)
  }, [cycles, selectedKey, state.data?.currentCycleKey])

  const selectedIndex = useMemo(
    () => Math.max(0, cycles.findIndex(cycle => cycle.cycleKey === selectedKey)),
    [cycles, selectedKey],
  )
  const cycle = cycles[selectedIndex] || null

  const move = direction => {
    const nextIndex = selectedIndex + direction
    if (nextIndex >= 0 && nextIndex < cycles.length) setSelectedKey(cycles[nextIndex].cycleKey)
  }

  if (!isConfigured) return <Message title="Configuración incompleta" text="Esta vista todavía no tiene conexión a Supabase." />
  if (state.loading) return <Message loading title="Cargando gastos compartidos" text="Consultando ciclos y próximas cuotas…" />
  if (state.error || !state.data) return <Message title="Enlace no disponible" text={state.error || 'El enlace no existe o fue desactivado.'} />

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5 pb-16">
        {cycles.length > 0 ? (
          <>
            <CycleSelector cycles={cycles} selectedKey={selectedKey} onSelect={setSelectedKey} />
            {cycle && (
              <>
                <CycleSummary
                  cycle={cycle}
                  percentage={state.data.percentage || 0}
                  index={selectedIndex}
                  total={cycles.length}
                  onMove={move}
                />

                <section className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">Detalle del ciclo</div>
                      <div className="text-[12px] text-[var(--muted)] mt-0.5">
                        {(cycle.transactions || []).length} conceptos compartidos
                      </div>
                    </div>
                    {cycle.isUpcoming && (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">Estimado</span>
                    )}
                  </div>

                  {(cycle.transactions || []).length > 0 ? (
                    <div className="divide-y divide-[var(--line)]">
                      {cycle.transactions.map(item => <TransactionRow key={item.id} item={item} />)}
                    </div>
                  ) : (
                    <div className="px-5 py-10 text-center">
                      <div className="text-[14px] font-semibold">Sin gastos compartidos</div>
                      <p className="text-[11.5px] text-[var(--muted)] mt-1">Por ahora no hay movimientos asignados a este ciclo.</p>
                    </div>
                  )}
                </section>

                {cycle.isUpcoming && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] text-blue-800 leading-relaxed">
                    Las cuotas indicadas con “Este ciclo pagará” son proyecciones de ese mes. El monto puede cambiar cuando cierre el estado de cuenta.
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <section className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-2xl p-8 text-center">
            <div className="text-[15px] font-semibold">Todavía no hay movimientos compartidos</div>
            <p className="text-[12px] text-[var(--muted)] mt-2">El detalle aparecerá cuando Wladimick marque gastos o recurrentes para Nicol.</p>
          </section>
        )}

        <p className="text-[10.5px] text-[var(--muted)] text-center leading-relaxed px-4">
          Esta página es informativa y de solo lectura. No muestra tarjetas, bancos, identificadores personales ni datos de acceso.
        </p>
      </main>
    </div>
  )
}
