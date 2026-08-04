import React, { useEffect, useMemo, useState } from 'react'
import { Badge, Card } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'
import { CATEGORIES } from '../data'
import { fetchBillingCycles } from '../services/billingCyclesService'
import {
  buildProjectionPlan,
  currentMonthKey,
  monthLabel,
} from '../services/projectionPlanService'

const SIMULATIONS_KEY = 'gastito_proj_v1'
const SETTINGS_KEY = 'gastito_projection_v2_settings'

const DEFAULT_SETTINGS = {
  includeSavings: false,
  includeReceivables: false,
  includePayables: true,
  variableOverride: null,
}

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    return value ?? fallback
  } catch {
    return fallback
  }
}

function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

function formatTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago',
  }).format(value)
}

function shortDate(value) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`))
}

function scenarioText(scenario) {
  if (scenario === 'committed') return 'Solo considera compromisos conocidos: facturas, cuotas, recurrentes y deudas.'
  if (scenario === 'simulated') return 'Suma el gasto variable estimado y las compras hipotéticas que agregues abajo.'
  return 'Agrega un promedio de gasto variable calculado desde tus movimientos reales.'
}

function riskMeta(risk) {
  if (risk === 'danger') return { label: 'Déficit', tone: 'danger', className: 'bg-red-50 text-red-700' }
  if (risk === 'warning') return { label: 'Ajustado', tone: 'warn', className: 'bg-[var(--amber-soft)] text-[var(--amber-ink)]' }
  return { label: 'Saludable', tone: 'ok', className: 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' }
}

function confidenceMeta(value) {
  if (value === 'confirmed') return { label: 'Factura confirmada', className: 'bg-emerald-50 text-emerald-700' }
  if (value === 'in_progress') return { label: 'Factura en curso', className: 'bg-blue-50 text-blue-700' }
  return { label: 'Monto proyectado', className: 'bg-slate-100 text-slate-700' }
}

function MetricCard({ label, value, detail, tone = 'default', icon }) {
  const cls = tone === 'dark'
    ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent'
    : tone === 'warning'
      ? 'bg-[var(--amber-soft)] text-[var(--amber-ink)] border-transparent'
      : tone === 'danger'
        ? 'bg-red-50 text-red-800 border-red-100'
        : 'bg-[var(--bg-elev)] text-[var(--ink)] border-[var(--line)]'
  return (
    <div className={`rounded-2xl border p-4 min-h-[116px] ${cls}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>
        {icon && <Icon name={icon} size={15} className="opacity-50"/>}
      </div>
      <div className="font-mono text-[22px] md:text-[25px] font-bold mt-3 tracking-tight">{value}</div>
      {detail && <div className="text-[11px] mt-1.5 opacity-65 leading-relaxed">{detail}</div>}
    </div>
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="w-full flex items-center gap-3 text-left py-2.5">
      <span className={`relative w-9 h-5 rounded-full shrink-0 transition ${checked ? 'bg-[var(--ink)]' : 'bg-[var(--line)]'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition ${checked ? 'left-[18px]' : 'left-0.5'}`}/>
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold">{label}</span>
        {description && <span className="block text-[10.5px] text-[var(--muted)] mt-0.5 leading-snug">{description}</span>}
      </span>
    </button>
  )
}

function BreakdownRow({ label, amount, type = 'out', detail }) {
  if (!amount) return null
  const sign = type === 'in' ? '+' : '−'
  const color = type === 'in' ? 'text-emerald-700' : 'text-[var(--ink-2)]'
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-[var(--line)] last:border-0">
      <div className="min-w-0">
        <div className="text-[12px] text-[var(--ink-2)]">{label}</div>
        {detail && <div className="text-[9.5px] text-[var(--muted)] mt-0.5 leading-snug">{detail}</div>}
      </div>
      <div className={`font-mono text-[12px] font-semibold whitespace-nowrap ${color}`}>{sign}{fmtCLP(amount)}</div>
    </div>
  )
}

function MonthPanel({ month, expanded, onToggle }) {
  const risk = riskMeta(month.risk)
  const confidence = confidenceMeta(month.cardConfidence)
  const incomeBase = Math.max(1, month.income + month.receivableAmount)
  const pressure = Math.min(100, Math.round(month.outflow * 100 / incomeBase))
  const monthTitle = month.isCurrent ? `Resto de ${monthLabel(month.key).replace(/\s+\d{4}$/, '')}` : month.label

  const knownCardDetail = month.knownCycles.length
    ? month.knownCycles.map(item => `${shortDate(item.dueDate)} · ${item.final ? 'cerrada' : 'en curso'}`).join(' · ')
    : `${month.installmentDetail.length} cuotas previstas + estimación de compras`

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full p-4 text-left hover:bg-[var(--hover)] transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-bold">{monthTitle}</h3>
              <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${risk.className}`}>{risk.label}</span>
              <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${confidence.className}`}>{confidence.label}</span>
            </div>
            <div className="text-[10.5px] text-[var(--muted)] mt-1">
              Entran {fmtCLP(month.income + month.receivableAmount)} · salen {fmtCLP(month.outflow)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] uppercase tracking-[0.09em] text-[var(--muted)]">Saldo final</div>
            <div className={`font-mono text-[18px] font-bold mt-0.5 ${month.closingBalance < 0 ? 'text-red-700' : ''}`}>
              {fmtCLP(month.closingBalance)}
            </div>
            <div className={`text-[10px] mt-0.5 ${month.net < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {month.net >= 0 ? '+' : '−'}{fmtCLP(Math.abs(month.net))} en el mes
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          <div className="rounded-xl bg-[var(--bg)] px-3 py-2">
            <div className="text-[9px] text-[var(--muted)] uppercase">Ingresos</div>
            <div className="font-mono text-[12px] font-semibold mt-0.5">{fmtCLP(month.income + month.receivableAmount)}</div>
          </div>
          <div className="rounded-xl bg-[var(--bg)] px-3 py-2">
            <div className="text-[9px] text-[var(--muted)] uppercase">Fijos directos</div>
            <div className="font-mono text-[12px] font-semibold mt-0.5">{fmtCLP(month.directRecurring)}</div>
          </div>
          <div className="rounded-xl bg-[var(--bg)] px-3 py-2">
            <div className="text-[9px] text-[var(--muted)] uppercase">Tarjetas y cuotas</div>
            <div className="font-mono text-[12px] font-semibold mt-0.5">{fmtCLP(month.cardAmount)}</div>
          </div>
          <div className="rounded-xl bg-[var(--bg)] px-3 py-2">
            <div className="text-[9px] text-[var(--muted)] uppercase">Variable y eventos</div>
            <div className="font-mono text-[12px] font-semibold mt-0.5">{fmtCLP(month.estimatedDirectVariable + month.payableAmount + month.simulationAmount)}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden">
            <div className={`h-full rounded-full ${pressure >= 100 ? 'bg-red-500' : pressure >= 85 ? 'bg-amber-500' : 'bg-[var(--accent)]'}`} style={{ width: `${Math.min(100, pressure)}%` }}/>
          </div>
          <div className="flex items-center justify-between text-[9.5px] text-[var(--muted)] mt-1.5">
            <span>Presión de egresos: {pressure}%</span>
            <span className="inline-flex items-center gap-1">{expanded ? 'Ocultar detalle' : 'Ver detalle'} <Icon name={expanded ? 'chevdown' : 'chevron'} size={10}/></span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--line)] p-4 grid md:grid-cols-2 gap-4 bg-[var(--bg)]/60">
          <div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-2">Entradas</div>
            <BreakdownRow label="Ingresos recurrentes" amount={month.income} type="in" detail={`${month.incomeDetail.length} fuentes activas`}/>
            <BreakdownRow label="Por cobrar incluido" amount={month.receivableAmount} type="in" detail={month.receivableDetail.map(item => item.name || item.personName).join(', ')}/>
            {!month.income && !month.receivableAmount && <div className="text-[11px] text-[var(--muted)] py-3">Sin ingresos previstos para este mes.</div>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-2">Salidas</div>
            <BreakdownRow label="Gastos fijos directos" amount={month.directRecurring} detail={`${month.directRecurringDetail.length} recurrentes por débito, transferencia o efectivo`}/>
            <BreakdownRow label="Tarjetas y cuotas" amount={month.cardAmount} detail={knownCardDetail}/>
            <BreakdownRow label="Gasto variable directo" amount={month.estimatedDirectVariable} detail="Promedio de compras no recurrentes por débito, transferencia o efectivo"/>
            <BreakdownRow label="Por pagar" amount={month.payableAmount} detail={month.payableDetail.map(item => item.name || item.personName).join(', ')}/>
            <BreakdownRow label="Compras simuladas" amount={month.simulationAmount} detail={month.simulationDetail.map(item => item.name).join(', ')}/>
          </div>
        </div>
      )}
    </section>
  )
}

function SimulationModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const valid = String(form.name || '').trim() && Number(form.amount || 0) > 0 && form.date
  const category = CATEGORIES.find(item => item.id === form.category) || CATEGORIES.find(item => item.id === 'otros')

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative w-full md:max-w-[480px] max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-[var(--bg-elev)] border border-[var(--line)]">
        <div className="sticky top-0 z-10 px-4 py-3.5 border-b border-[var(--line)] bg-[var(--bg-elev)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl grid place-items-center text-[18px]" style={{ background: `${category?.color || '#888880'}20` }}>{category?.icon || '•'}</div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Simulación</div>
              <div className="text-[14px] font-bold">{initial.id ? 'Editar compra futura' : 'Nueva compra futura'}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="x" size={13}/></button>
        </div>

        <div className="p-4 grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] block mb-1.5">Descripción</span>
            <input value={form.name} onChange={event => set('name', event.target.value)} placeholder="Ej: reparación del auto" className="w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[13px]"/>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] block mb-1.5">Monto total</span>
            <input type="number" min="0" value={form.amount} onChange={event => set('amount', event.target.value)} className="w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[13px] font-mono"/>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] block mb-1.5">Fecha de inicio</span>
            <input type="date" value={form.date} onChange={event => set('date', event.target.value)} className="w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px]"/>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] block mb-1.5">Cuotas</span>
            <input type="number" min="1" max="60" value={form.installments} onChange={event => set('installments', event.target.value)} className="w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[13px] font-mono"/>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] block mb-1.5">Categoría</span>
            <select value={form.category} onChange={event => set('category', event.target.value)} className="w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px]">
              {CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.icon} {item.label}</option>)}
            </select>
          </label>
          <label className="col-span-2 flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <input type="checkbox" checked={form.active !== false} onChange={event => set('active', event.target.checked)}/>
            Incluir esta compra en el escenario “Con simulaciones”.
          </label>
        </div>

        <div className="sticky bottom-0 border-t border-[var(--line)] bg-[var(--bg-elev)] px-4 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3 text-[11px] text-[var(--muted)]">Cancelar</button>
          <button disabled={!valid} onClick={() => valid && onSave({
            ...form,
            amount: Number(form.amount || 0),
            installments: Math.max(1, Number(form.installments || 1)),
          })} className="h-9 px-4 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold disabled:opacity-40">
            Guardar simulación
          </button>
        </div>
      </div>
    </div>
  )
}

function blankSimulation() {
  return {
    id: null,
    name: '',
    amount: '',
    category: 'otros',
    date: new Date().toISOString().slice(0, 10),
    installments: 1,
    active: true,
  }
}

export default function ProjectionV2({
  accounts = [],
  recurringList = [],
  incomeList = [],
  receivables = [],
  payables = [],
  installmentDebts = [],
  expenses = [],
}) {
  const [cycles, setCycles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [scenario, setScenario] = useState('realistic')
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...readJSON(SETTINGS_KEY, {}) }))
  const [simulations, setSimulations] = useState(() => readJSON(SIMULATIONS_KEY, []))
  const [expandedMonth, setExpandedMonth] = useState(currentMonthKey())
  const [showAssumptions, setShowAssumptions] = useState(false)
  const [editingSimulation, setEditingSimulation] = useState(null)

  const loadCycles = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchBillingCycles()
      setCycles(data)
      setUpdatedAt(new Date())
    } catch (exception) {
      console.error('ProjectionV2 fetchBillingCycles:', exception)
      setError(exception.message || 'No fue posible actualizar las facturas de tarjetas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCycles() }, [])
  useEffect(() => { saveJSON(SETTINGS_KEY, settings) }, [settings])
  useEffect(() => { saveJSON(SIMULATIONS_KEY, simulations) }, [simulations])

  const plan = useMemo(() => buildProjectionPlan({
    accounts,
    recurringList,
    incomeList,
    receivables,
    payables,
    installmentDebts,
    expenses,
    billingCycles: cycles,
    simulations,
    scenario,
    includeSavings: settings.includeSavings,
    includeReceivables: settings.includeReceivables,
    includePayables: settings.includePayables,
    variableOverride: settings.variableOverride,
  }), [
    accounts, recurringList, incomeList, receivables, payables,
    installmentDebts, expenses, cycles, simulations, scenario, settings,
  ])

  const first = plan.firstMonth
  const lowest = plan.lowestMonth
  const nextThirtyOut = first?.outflow || 0
  const variableMonthsLabel = plan.variableAverages.monthsUsed.length
    ? plan.variableAverages.monthsUsed.map(key => monthLabel(key, true)).join(', ')
    : 'sin meses completos disponibles'

  const saveSimulation = form => {
    if (form.id) setSimulations(current => current.map(item => item.id === form.id ? form : item))
    else setSimulations(current => [...current, { ...form, id: `pj${Date.now()}` }])
    setEditingSimulation(null)
    setScenario('simulated')
  }

  const deleteSimulation = id => {
    if (!window.confirm('¿Eliminar esta simulación?')) return
    setSimulations(current => current.filter(item => item.id !== id))
  }

  const toggleSimulation = id => setSimulations(current => current.map(item =>
    item.id === id ? { ...item, active: item.active === false } : item
  ))

  return (
    <div className="max-w-7xl mx-auto pb-20 flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Plan financiero · 6 meses</div>
          <p className="text-[12px] text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            La proyección usa tus saldos, ingresos, recurrentes, cuotas conciliadas y facturas reales. Solo estima lo que todavía no existe en Facturación.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadCycles} disabled={loading} className="h-9 px-3 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] text-[11px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
            <Icon name="refresh" size={12}/>{loading ? 'Actualizando' : 'Actualizar datos'}
          </button>
          <button onClick={() => setEditingSimulation(blankSimulation())} className="h-9 px-3 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold inline-flex items-center gap-1.5">
            <Icon name="plus" size={12}/>Simular compra
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">{error}</div>}

      <Card padding="p-3">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            ['committed', 'Comprometido'],
            ['realistic', 'Realista'],
            ['simulated', 'Con simulaciones'],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setScenario(value)} className={`h-10 rounded-xl text-[11px] font-semibold transition ${scenario === value ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)] hover:bg-[var(--hover)]'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="text-[10.5px] text-[var(--muted)] mt-2 px-1">{scenarioText(scenario)}</div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <MetricCard label="Saldo disponible hoy" value={fmtCLP(plan.startBalance)} detail={settings.includeSavings ? 'Incluye cuentas de ahorro' : 'Solo cuentas operativas'} tone="dark" icon="wallet"/>
        <MetricCard label={first?.isCurrent ? `Fin de ${monthLabel(first.key).replace(/\s+\d{4}$/, '')}` : 'Próximo mes'} value={fmtCLP(first?.closingBalance || 0)} detail={`${first?.net >= 0 ? '+' : '−'}${fmtCLP(Math.abs(first?.net || 0))} durante el periodo`} tone={first?.closingBalance < 0 ? 'danger' : 'default'} icon="calendar"/>
        <MetricCard label="Menor saldo proyectado" value={fmtCLP(lowest?.closingBalance || 0)} detail={lowest?.label || 'Sin datos'} tone={lowest?.closingBalance < 0 ? 'danger' : lowest?.risk === 'warning' ? 'warning' : 'default'} icon="trend"/>
        <MetricCard label="Salidas próximas" value={fmtCLP(nextThirtyOut)} detail="Facturas, recurrentes, variables y eventos del primer periodo" tone={nextThirtyOut > (first?.income || 0) ? 'warning' : 'default'} icon="card"/>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-ink)] grid place-items-center shrink-0"><Icon name="check" size={15}/></div>
            <div>
              <div className="text-[12px] font-bold">Datos conciliados y actualizados</div>
              <div className="text-[10.5px] text-[var(--muted)] mt-1 leading-relaxed">
                {plan.knownCycleMonths} meses usan facturas conocidas y {plan.projectedCycleMonths} usan proyecciones. El gasto variable se calculó con {variableMonthsLabel}.
              </div>
            </div>
          </div>
          <div className="text-[10px] text-[var(--muted)] whitespace-nowrap">Actualizado {formatTime(updatedAt)}</div>
        </div>
        {!settings.includeReceivables && plan.overdueReceivableAmount > 0 && (
          <div className="mt-3 rounded-xl bg-[var(--amber-soft)] text-[var(--amber-ink)] px-3 py-2.5 text-[10.5px] leading-relaxed">
            No se están contando {fmtCLP(plan.overdueReceivableAmount)} de cobros atrasados, para no depender de dinero incierto. Puedes incluirlos en Supuestos.
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.11em] text-[var(--muted)] font-bold">Evolución del saldo</div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Cada mes parte desde el saldo final del anterior.</div>
          </div>
          <button onClick={() => setShowAssumptions(value => !value)} className="h-8 px-3 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] text-[10px] font-semibold inline-flex items-center gap-1.5">
            <Icon name="settings" size={11}/>Supuestos
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-3">
          {plan.months.map(month => (
            <MonthPanel key={month.key} month={month} expanded={expandedMonth === month.key} onToggle={() => setExpandedMonth(current => current === month.key ? '' : month.key)}/>
          ))}
        </div>
      </div>

      {showAssumptions && (
        <Card padding="p-4 md:p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-[12px] font-bold">Supuestos de la proyección</div>
              <div className="text-[10.5px] text-[var(--muted)] mt-1">Cambia estas opciones para revisar una versión más conservadora o más completa.</div>
            </div>
            <Badge tone="info">Automático</Badge>
          </div>
          <div className="grid md:grid-cols-2 gap-x-6">
            <div className="divide-y divide-[var(--line)]">
              <Toggle checked={settings.includeSavings} onChange={value => setSettings(current => ({ ...current, includeSavings: value }))} label="Incluir ahorros como saldo disponible" description={`Ahorros registrados: ${fmtCLP(plan.savingsBalance)}`}/>
              <Toggle checked={settings.includePayables} onChange={value => setSettings(current => ({ ...current, includePayables: value }))} label="Incluir deudas por pagar" description="Se agregan una sola vez en el mes de vencimiento."/>
              <Toggle checked={settings.includeReceivables} onChange={value => setSettings(current => ({ ...current, includeReceivables: value }))} label="Incluir cobros pendientes" description="Los vencidos se ubican en el primer mes, pero podrían no pagarse a tiempo."/>
            </div>
            <div className="mt-4 md:mt-0 rounded-xl bg-[var(--bg)] border border-[var(--line)] p-3.5">
              <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold">Gasto variable mensual</div>
              <div className="font-mono text-[20px] font-bold mt-2">{fmtCLP(plan.variableTotal)}</div>
              <div className="text-[10px] text-[var(--muted)] mt-1">Automático: {fmtCLP(plan.variableTotalAuto)} · crédito {fmtCLP(plan.variableCredit)} · directo {fmtCLP(plan.variableDirect)}</div>
              <div className="flex gap-2 mt-3">
                <input type="number" min="0" value={settings.variableOverride ?? ''} onChange={event => setSettings(current => ({ ...current, variableOverride: event.target.value === '' ? null : Number(event.target.value) }))} placeholder="Usar automático" className="min-w-0 flex-1 h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] px-3 text-[11px] font-mono"/>
                <button onClick={() => setSettings(current => ({ ...current, variableOverride: null }))} className="h-9 px-3 rounded-xl border border-[var(--line)] text-[10px] font-semibold">Auto</button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.11em] text-[var(--muted)] font-bold">Compras simuladas</div>
            <div className="text-[12px] text-[var(--muted)] mt-1">Prueba una compra antes de comprometerte.</div>
          </div>
          <button onClick={() => setEditingSimulation(blankSimulation())} className="h-8 px-3 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold inline-flex items-center gap-1.5"><Icon name="plus" size={11}/>Agregar</button>
        </div>
        <Card padding="p-0">
          {!simulations.length ? (
            <div className="p-8 text-center">
              <div className="text-[34px]">🔮</div>
              <div className="text-[13px] font-bold mt-2">Todavía no hay simulaciones</div>
              <div className="text-[10.5px] text-[var(--muted)] mt-1 max-w-sm mx-auto">Agrega una compra y cambia al escenario “Con simulaciones” para ver el impacto real en los próximos meses.</div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {simulations.map(item => {
                const category = CATEGORIES.find(categoryItem => categoryItem.id === item.category) || CATEGORIES.find(categoryItem => categoryItem.id === 'otros')
                const monthly = Number(item.installments || 1) > 1 ? Math.round(Number(item.amount || 0) / Number(item.installments)) : Number(item.amount || 0)
                return (
                  <div key={item.id} className={`p-3.5 flex items-start gap-3 ${item.active === false ? 'opacity-50' : ''}`}>
                    <div className="w-9 h-9 rounded-xl grid place-items-center text-[17px]" style={{ background: `${category?.color || '#888880'}20` }}>{category?.icon || '•'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[12px] font-semibold">{item.name}</div>
                          <div className="text-[9.5px] text-[var(--muted)] mt-0.5">Desde {shortDate(item.date)} · {item.installments || 1} {(item.installments || 1) === 1 ? 'pago' : 'cuotas'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-[12px] font-bold">{fmtCLP(item.amount)}</div>
                          {(item.installments || 1) > 1 && <div className="text-[9px] text-[var(--muted)]">{fmtCLP(monthly)}/mes</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge tone="muted">{category?.icon} {category?.label}</Badge>
                        <Badge tone={item.active === false ? 'muted' : 'ok'}>{item.active === false ? 'Inactiva' : 'Activa'}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => toggleSimulation(item.id)} className="h-8 px-2 rounded-lg border border-[var(--line)] text-[9px] font-semibold">{item.active === false ? 'Activar' : 'Pausar'}</button>
                      <button onClick={() => setEditingSimulation({ ...item })} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="pencil" size={11}/></button>
                      <button onClick={() => deleteSimulation(item.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center"><Icon name="trash" size={11}/></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {editingSimulation && <SimulationModal initial={editingSimulation} onClose={() => setEditingSimulation(null)} onSave={saveSimulation}/>} 
    </div>
  )
}
