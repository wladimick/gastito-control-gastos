import React, { useMemo, useState } from 'react'
import { Icon, fmtCLP } from '../lib/helpers'
import { useBanks } from '../services/banksService'
import { useCategories } from '../services/categoriesService'
import { Badge, Card } from './ui'
import { CATEGORIES } from '../data'

const FALLBACK_CATEGORY = { id: 'otros', label: 'Otros', icon: '•', color: '#888880' }
const BLANK = {
  description: '', total: '', installments: 3, paid: 0, monthlyAmount: '',
  category: 'otros', bank: 'bchile', dayOfMonth: 5,
  startMonth: new Date().toISOString().slice(0, 7), autoPay: false, status: 'active',
}

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'America/Santiago',
  }).formatToParts(new Date())
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}`
}

function addMonthsKey(key, offset) {
  const [year, month] = String(key || '').split('-').map(Number)
  const date = new Date(Date.UTC(year, (month || 1) - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key, short = false) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return key || 'Sin mes'
  const label = new Intl.DateTimeFormat('es-CL', {
    month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatDueDate(value) {
  if (!value) return ''
  const day = String(value).slice(0, 10)
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: 'short', timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`))
}

function categoryFor(categories, value, meta) {
  if (meta?.label) return meta
  const local = CATEGORIES.find(category => category.id === value)
  if (local) return local
  return categories.find(category => category.id === value) || FALLBACK_CATEGORY
}

function formCategoryId(categories, plan) {
  const direct = categories.find(category => category.id === plan.category)
  if (direct) return direct.id
  const local = CATEGORIES.find(category => category.id === plan.category)
  const label = plan.categoryMeta?.label || local?.label
  return categories.find(category => category.label === label)?.id || categories[0]?.id || plan.category || 'otros'
}

function bankFor(banks, id) {
  return banks.find(bank => bank.id === id) || { id, label: id || 'Sin banco' }
}

function manualOccurrences(plan) {
  if (Array.isArray(plan.occurrences) && plan.occurrences.length) return plan.occurrences
  const result = []
  const paid = Number(plan.paid || 0)
  const total = Number(plan.installments || 1)
  for (let current = paid + 1; current <= total; current += 1) {
    result.push({
      id: `manual:${plan.id}:${current}`,
      source: 'manual',
      projected: true,
      confirmed: false,
      isPending: false,
      monthKey: addMonthsKey(plan.startMonth, current - 1),
      dueDate: '',
      dueDay: Number(plan.dayOfMonth || 5),
      description: plan.description,
      amount: Number(plan.monthlyAmount || 0),
      installmentCurrent: current,
      installmentTotal: total,
      bankId: plan.bank,
      cardLabel: 'Seguimiento manual',
      category: plan.category,
      categoryMeta: plan.categoryMeta,
      sharedWithNicol: false,
      originalAmount: Number(plan.total || 0),
    })
  }
  return result
}

function allOccurrences(plans) {
  return plans.flatMap(plan => manualOccurrences(plan).map(item => ({
    ...item,
    planId: plan.id,
    planSource: plan.source,
    bankId: item.bankId || plan.bank,
    category: item.category || plan.category,
    categoryMeta: item.categoryMeta || plan.categoryMeta,
    sharedWithNicol: Boolean(item.sharedWithNicol || plan.sharedWithNicol),
  })))
}

function MetricCard({ label, value, detail, tone = 'default' }) {
  const cls = tone === 'dark'
    ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent'
    : tone === 'violet'
      ? 'bg-violet-50 text-violet-950 border-violet-100'
      : 'bg-[var(--bg-elev)] border-[var(--line)]'
  return (
    <div className={`rounded-2xl border p-4 min-h-[104px] ${cls}`}>
      <div className="text-[9.5px] uppercase tracking-[.11em] font-bold opacity-60">{label}</div>
      <div className="font-mono text-[20px] font-bold mt-2 tracking-tight">{value}</div>
      <div className="text-[10px] opacity-65 mt-1 leading-relaxed">{detail}</div>
    </div>
  )
}

function ModalShell({ title, onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" onClick={onClose}/>
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none p-0 md:p-4">
        <div className="pointer-events-auto w-full max-w-[520px] max-h-[92vh] rounded-t-2xl md:rounded-2xl bg-[var(--bg-elev)] overflow-y-auto border border-[var(--line)]">
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3.5 border-b border-[var(--line)] bg-[var(--bg-elev)]">
            <div className="text-[14px] font-bold">{title}</div>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="x" size={13}/></button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }) {
  return <label className="block"><span className="text-[9px] uppercase tracking-[.09em] font-bold text-[var(--muted)] block mb-1.5">{label}</span>{children}</label>
}

function InstallmentForm({ initial, categories, banks, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const setTotal = value => {
    const total = Number(value) || 0
    const installments = Math.max(1, Number(form.installments) || 1)
    setForm(current => ({ ...current, total: value, monthlyAmount: total ? Math.round(total / installments) : '' }))
  }
  const setInstallments = value => {
    const installments = Math.max(1, Number(value) || 1)
    const total = Number(form.total) || 0
    setForm(current => ({ ...current, installments, monthlyAmount: total ? Math.round(total / installments) : current.monthlyAmount }))
  }
  const valid = form.description?.trim() && Number(form.monthlyAmount) > 0 && Number(form.installments) > 0

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><Field label="Descripción"><input value={form.description || ''} onChange={event => set('description', event.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px]" placeholder="Compra o compromiso"/></Field></div>
      <Field label="Total"><input inputMode="numeric" value={form.total ?? ''} onChange={event => setTotal(event.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px] font-mono"/></Field>
      <Field label="Número de cuotas"><input type="number" min="1" max="60" value={form.installments || 1} onChange={event => setInstallments(event.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px] font-mono"/></Field>
      <Field label="Valor de cuota"><input inputMode="numeric" value={form.monthlyAmount ?? ''} onChange={event => set('monthlyAmount', event.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px] font-mono"/></Field>
      <Field label="Cuotas pagadas"><input type="number" min="0" max={form.installments || 1} value={form.paid || 0} onChange={event => set('paid', Number(event.target.value))} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px] font-mono"/></Field>
      <Field label="Banco"><select value={form.bank || 'bchile'} onChange={event => set('bank', event.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[10px]">{banks.map(bank => <option key={bank.id} value={bank.id}>{bank.label}</option>)}</select></Field>
      <Field label="Categoría"><select value={form.category || 'otros'} onChange={event => set('category', event.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[10px]">{categories.map(category => <option key={category.id} value={category.id}>{category.icon} {category.label}</option>)}</select></Field>
      <Field label="Mes de inicio"><input type="month" value={form.startMonth || currentMonthKey()} onChange={event => set('startMonth', event.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[10px]"/></Field>
      <Field label="Día de cobro"><input type="number" min="1" max="31" value={form.dayOfMonth || 5} onChange={event => set('dayOfMonth', Number(event.target.value))} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px] font-mono"/></Field>
      <label className="col-span-2 flex items-center gap-2 text-[10px] text-[var(--muted)]"><input type="checkbox" checked={Boolean(form.autoPay)} onChange={event => set('autoPay', event.target.checked)}/>Avanzar cuotas pagadas automáticamente después del día de cobro.</label>
      <div className="col-span-2 flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="h-9 px-3 text-[10px] text-[var(--muted)]">Cancelar</button>
        <button type="button" disabled={!valid} onClick={() => valid && onSave(form)} className="h-9 px-4 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold disabled:opacity-40">Guardar</button>
      </div>
    </div>
  )
}

function sourceMeta(item) {
  if (item.source === 'manual') return { label: 'Solo manual', tone: 'muted' }
  if (item.projected) return { label: 'Proyección bancaria', tone: 'info' }
  if (item.isPending) return { label: 'Pendiente banco', tone: 'warn' }
  return { label: 'Confirmada por banco', tone: 'ok' }
}

function OccurrenceRow({ item, categories, banks }) {
  const category = categoryFor(categories, item.category, item.categoryMeta)
  const bank = bankFor(banks, item.bankId)
  const source = sourceMeta(item)
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[auto_minmax(250px,1.5fr)_minmax(170px,.7fr)_auto] gap-3 items-center px-3.5 py-3 border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--hover)]/45">
      <div className="w-9 h-9 rounded-xl grid place-items-center border text-[16px]" style={{ borderColor: `${category.color}45`, backgroundColor: `${category.color}18` }}>{category.icon}</div>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold truncate">{item.description}</div>
        <div className="text-[9.5px] text-[var(--muted)] mt-0.5 truncate">
          {item.cardLabel || bank.label} · {item.dueDate ? `vence ${formatDueDate(item.dueDate)}` : `día ${item.dueDay || 5}`}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge tone={source.tone} className="!text-[8.5px] !px-1.5 !py-0.5">{source.label}</Badge>
          <Badge tone="dark" className="!text-[8.5px] !px-1.5 !py-0.5">Cuota {item.installmentCurrent}/{item.installmentTotal}</Badge>
          {item.sharedWithNicol && <span className="rounded px-1.5 py-0.5 text-[8.5px] font-semibold bg-violet-50 text-violet-700">Nicol</span>}
        </div>
      </div>
      <div className="hidden lg:block text-[9.5px] text-[var(--muted)]">
        {category.icon} {category.label}<div className="mt-1">{bank.label}</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[13px] font-bold whitespace-nowrap">{fmtCLP(item.amount)}</div>
        {Number(item.originalAmount || 0) > Number(item.amount || 0) && <div className="text-[8.5px] text-[var(--muted)] mt-0.5">total {fmtCLP(item.originalAmount)}</div>}
      </div>
    </div>
  )
}

function PlanRow({ plan, categories, banks, onEdit, onDelete, onMarkPaid }) {
  const category = categoryFor(categories, plan.category, plan.categoryMeta)
  const bank = bankFor(banks, plan.bank || plan.bankId)
  const manual = plan.source === 'manual' ? plan : plan.manualDebt
  const remaining = Math.max(0, Number(plan.installments || 0) - Number(plan.paid || 0))
  const title = plan.friendlyDescription || plan.description
  const sourceTone = plan.source === 'manual' ? 'muted' : plan.source === 'reconciled' ? 'ok' : 'info'
  const sourceLabel = plan.source === 'manual' ? 'Solo manual' : plan.source === 'reconciled' ? 'Banco + manual conciliada' : 'Banco'

  return (
    <div className="px-3.5 py-3 border-b border-[var(--line)] last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl grid place-items-center border text-[16px] shrink-0" style={{ borderColor: `${category.color}45`, backgroundColor: `${category.color}18` }}>{category.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold leading-snug">{title}</div>
              <div className="text-[9.5px] text-[var(--muted)] mt-0.5">{plan.cardLabel || bank.label} · {plan.paid || 0}/{plan.installments} cubiertas</div>
            </div>
            <div className="font-mono text-[13px] font-bold whitespace-nowrap">{fmtCLP(plan.monthlyAmount)}<div className="text-[8.5px] text-[var(--muted)] text-right">por cuota</div></div>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            <Badge tone={sourceTone} className="!text-[8.5px] !px-1.5 !py-0.5">{sourceLabel}</Badge>
            <Badge tone={remaining ? 'warn' : 'ok'} className="!text-[8.5px] !px-1.5 !py-0.5">Quedan {remaining}</Badge>
            {plan.sharedWithNicol && <span className="rounded px-1.5 py-0.5 text-[8.5px] font-semibold bg-violet-50 text-violet-700">Nicol</span>}
          </div>
        </div>
        {manual && (
          <div className="flex gap-1 shrink-0">
            {plan.source === 'manual' && remaining > 0 && (
              <button type="button" onClick={() => onMarkPaid(plan.id)} className="h-8 px-2 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-ink)] text-[8.5px] font-semibold">Pagar 1</button>
            )}
            <button type="button" onClick={() => onEdit(manual)} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="pencil" size={12}/></button>
            <button type="button" onClick={() => onDelete(manual.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center"><Icon name="trash" size={12}/></button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Installments({
  debts = [],
  setDebts,
  onCreateInstallment,
  onUpdateInstallment,
  onDeleteInstallment,
}) {
  const banks = useBanks()
  const categories = useCategories()
  const nowKey = currentMonthKey()
  const [selectedMonth, setSelectedMonth] = useState(nowKey)
  const [viewMode, setViewMode] = useState('calendar')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [bankFilter, setBankFilter] = useState('all')
  const [sharedOnly, setSharedOnly] = useState(false)
  const [formState, setFormState] = useState(null)
  const [saving, setSaving] = useState(false)

  const plans = useMemo(() => debts.filter(Boolean), [debts])
  const occurrences = useMemo(() => allOccurrences(plans), [plans])
  const months = useMemo(() => Array.from({ length: 8 }, (_, index) => addMonthsKey(nowKey, index)), [nowKey])

  const selectedOccurrences = useMemo(() => occurrences.filter(item => item.monthKey === selectedMonth), [occurrences, selectedMonth])
  const filteredOccurrences = useMemo(() => selectedOccurrences.filter(item => {
    if (sourceFilter === 'bank' && item.source === 'manual') return false
    if (sourceFilter === 'manual' && item.source !== 'manual') return false
    if (sourceFilter === 'actual' && item.projected) return false
    if (sourceFilter === 'projected' && !item.projected) return false
    if (bankFilter !== 'all' && item.bankId !== bankFilter) return false
    if (sharedOnly && !item.sharedWithNicol) return false
    return true
  }), [selectedOccurrences, sourceFilter, bankFilter, sharedOnly])

  const current = occurrences.filter(item => item.monthKey === nowKey)
  const currentTotal = current.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const currentBank = current.filter(item => item.source !== 'manual').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const currentShared = current.filter(item => item.sharedWithNicol).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const futureTotals = months.slice(0, 6).map(month => occurrences.filter(item => item.monthKey === month).reduce((sum, item) => sum + Number(item.amount || 0), 0))
  const averageSix = futureTotals.reduce((sum, value) => sum + value, 0) / Math.max(1, futureTotals.length)
  const bankIds = [...new Set(occurrences.map(item => item.bankId).filter(Boolean))]
  const bankPlans = plans.filter(plan => plan.source !== 'manual')
  const manualPlans = plans.filter(plan => plan.source === 'manual')
  const openManualForm = plan => setFormState({ ...plan, category: formCategoryId(categories, plan) })

  const monthTotal = key => occurrences.filter(item => item.monthKey === key).reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const handleSave = async form => {
    const payload = {
      ...form,
      total: Number(form.total || 0),
      installments: Number(form.installments || 1),
      paid: Number(form.paid || 0),
      monthlyAmount: Number(form.monthlyAmount || 0),
      dayOfMonth: Number(form.dayOfMonth || 5),
      source: 'manual',
    }
    setSaving(true)
    try {
      if (form.id) {
        if (onUpdateInstallment) await onUpdateInstallment(payload)
        else setDebts?.(debts.map(plan => plan.id === payload.id ? payload : plan))
      } else if (onCreateInstallment) {
        await onCreateInstallment(payload)
      } else {
        setDebts?.([...debts, { ...payload, id: `manual-${Date.now()}` }])
      }
      setFormState(null)
      window.setTimeout(() => window.location.reload(), 150)
    } finally {
      setSaving(false)
    }
  }

  const markPaid = id => {
    const updated = debts.map(plan => plan.id === id
      ? { ...plan, paid: Math.min(plan.installments, Number(plan.paid || 0) + 1), status: Number(plan.paid || 0) + 1 >= plan.installments ? 'paid' : 'active' }
      : plan)
    setDebts?.(updated)
  }

  const deleteManual = async id => {
    if (!window.confirm('¿Eliminar este seguimiento manual?')) return
    if (onDeleteInstallment) await onDeleteInstallment(id)
    else setDebts?.(debts.filter(plan => plan.id !== id))
    window.setTimeout(() => window.location.reload(), 150)
  }

  return (
    <div className="max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[.12em] font-bold text-[var(--muted)]">Proyección conciliada</div>
          <p className="text-[11px] text-[var(--muted)] mt-1 max-w-2xl">La cuota bancaria es la fuente principal; los seguimientos manuales solo completan lo que todavía no aparece en Facturación.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] p-1">
            <button type="button" onClick={() => setViewMode('calendar')} className={`h-7 px-2.5 rounded-md text-[9.5px] font-semibold ${viewMode === 'calendar' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)]'}`}>Calendario</button>
            <button type="button" onClick={() => setViewMode('plans')} className={`h-7 px-2.5 rounded-md text-[9.5px] font-semibold ${viewMode === 'plans' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)]'}`}>Planes</button>
          </div>
          <button type="button" onClick={() => window.location.reload()} className="h-9 px-3 rounded-lg border border-[var(--line)] text-[10px] font-semibold flex items-center gap-1.5"><Icon name="refresh" size={12}/>Actualizar</button>
          <button type="button" onClick={() => setFormState({ ...BLANK, category: categories[0]?.id || 'otros', bank: banks[0]?.id || 'bchile' })} className="h-9 px-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold flex items-center gap-1.5"><Icon name="plus" size={12}/>Nueva manual</button>
        </div>
      </div>

      {plans.some(plan => plan.source === 'reconciled') && (
        <div className="mt-3 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-ink)] px-3.5 py-2.5 text-[9.5px]">
          <strong>{plans.filter(plan => plan.source === 'reconciled').length}</strong> seguimientos manuales están conciliados con Facturación y no se suman dos veces.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4">
        <MetricCard label="Cuotas este mes" value={fmtCLP(currentTotal)} detail={monthLabel(nowKey)} tone="dark"/>
        <MetricCard label="Respaldado por banco" value={fmtCLP(currentBank)} detail={`${bankPlans.length} planes bancarios`}/>
        <MetricCard label="Compartido con Nicol" value={fmtCLP(currentShared)} detail="Base de cuotas del mes" tone="violet"/>
        <MetricCard label="Promedio próximos 6 meses" value={fmtCLP(Math.round(averageSix))} detail="Banco + manuales no conciliadas"/>
      </div>

      {viewMode === 'calendar' ? (
        <>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {months.map(key => {
              const active = selectedMonth === key
              const total = monthTotal(key)
              const count = occurrences.filter(item => item.monthKey === key).length
              return (
                <button key={key} type="button" onClick={() => setSelectedMonth(key)} className={`shrink-0 rounded-xl border px-3 py-2 text-left min-w-[132px] ${active ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--bg-elev)] border-[var(--line)]'}`}>
                  <div className="text-[9px] font-semibold opacity-65">{monthLabel(key, true)}</div>
                  <div className="font-mono text-[13px] font-bold mt-0.5">{fmtCLP(total)}</div>
                  <div className="text-[8.5px] opacity-55 mt-0.5">{count} cuotas</div>
                </button>
              )
            })}
          </div>

          <Card padding="p-2.5" className="mt-3 flex flex-wrap gap-2">
            <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} className="h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[9.5px]">
              <option value="all">Todas las fuentes</option>
              <option value="actual">Confirmadas por banco</option>
              <option value="projected">Proyectadas</option>
              <option value="bank">Solo banco</option>
              <option value="manual">Solo manuales</option>
            </select>
            <select value={bankFilter} onChange={event => setBankFilter(event.target.value)} className="h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[9.5px]">
              <option value="all">Todos los bancos</option>
              {bankIds.map(id => <option key={id} value={id}>{bankFor(banks, id).label}</option>)}
            </select>
            <label className="h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 flex items-center gap-2 text-[9.5px]"><input type="checkbox" checked={sharedOnly} onChange={event => setSharedOnly(event.target.checked)}/>Solo Nicol</label>
          </Card>

          <Card padding="p-0" className="mt-3 overflow-hidden">
            <div className="px-3.5 py-3 border-b border-[var(--line)] flex justify-between gap-3">
              <div><div className="text-[12px] font-bold">{monthLabel(selectedMonth)}</div><div className="text-[9.5px] text-[var(--muted)] mt-0.5">Las proyecciones se reemplazan cuando llega la cuota real del banco.</div></div>
              <div className="font-mono text-[13px] font-bold">{fmtCLP(filteredOccurrences.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</div>
            </div>
            {filteredOccurrences.map(item => <OccurrenceRow key={item.id} item={item} categories={categories} banks={banks}/>) }
            {!filteredOccurrences.length && <div className="p-9 text-center text-[10.5px] text-[var(--muted)]">No hay cuotas con estos filtros.</div>}
          </Card>
        </>
      ) : (
        <div className="mt-4 grid lg:grid-cols-2 gap-3">
          <Card padding="p-0" className="overflow-hidden">
            <div className="px-3.5 py-3 border-b border-[var(--line)]"><div className="text-[12px] font-bold">Planes respaldados por banco</div><div className="text-[9.5px] text-[var(--muted)] mt-0.5">Fuente principal de la proyección.</div></div>
            {bankPlans.map(plan => <PlanRow key={plan.id} plan={plan} categories={categories} banks={banks} onEdit={openManualForm} onDelete={deleteManual} onMarkPaid={markPaid}/>) }
            {!bankPlans.length && <div className="p-9 text-center text-[10.5px] text-[var(--muted)]">Todavía no hay cuotas bancarias.</div>}
          </Card>
          <Card padding="p-0" className="overflow-hidden">
            <div className="px-3.5 py-3 border-b border-[var(--line)]"><div className="text-[12px] font-bold">Seguimientos solo manuales</div><div className="text-[9.5px] text-[var(--muted)] mt-0.5">Compromisos que aún no aparecen en Facturación.</div></div>
            {manualPlans.map(plan => <PlanRow key={plan.id} plan={plan} categories={categories} banks={banks} onEdit={openManualForm} onDelete={deleteManual} onMarkPaid={markPaid}/>) }
            {!manualPlans.length && <div className="p-9 text-center text-[10.5px] text-[var(--muted)]">Todos los seguimientos están respaldados por el banco.</div>}
          </Card>
        </div>
      )}

      {formState && (
        <ModalShell title={formState.id ? 'Editar seguimiento manual' : 'Nueva cuota manual'} onClose={() => setFormState(null)}>
          <InstallmentForm initial={formState} categories={categories} banks={banks} onSave={handleSave} onCancel={() => setFormState(null)}/>
          {saving && <div className="mt-3 text-[9.5px] text-[var(--muted)]">Guardando y conciliando…</div>}
        </ModalShell>
      )}
    </div>
  )
}
