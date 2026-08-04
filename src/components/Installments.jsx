import React, { useEffect, useMemo, useState } from 'react'
import { Icon, fmtCLP } from '../lib/helpers'
import { useBanks } from '../services/banksService'
import { useCategories } from '../services/categoriesService'
import { fetchBillingCycles } from '../services/billingCyclesService'
import { fetchMyCards } from '../services/creditCardsService'

const FALLBACK_CATEGORY = { id: 'otros', label: 'Otros', icon: '•', color: '#888880' }
const BLANK = {
  description: '', total: '', installments: 3, paid: 0, monthlyAmount: '',
  category: 'otros', bank: 'bchile', dayOfMonth: 5,
  startMonth: new Date().toISOString().slice(0, 7), autoPay: false, status: 'active',
}

function translucent(color, opacity = '18') {
  return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? `${color}${opacity}` : `#888880${opacity}`
}

function parseYM(key) {
  const [year, month] = String(key || '').split('-').map(Number)
  return { year, month }
}

function addMonthsKey(key, offset) {
  const { year, month } = parseYM(key)
  const date = new Date(Date.UTC(year, (month || 1) - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', timeZone: 'America/Santiago',
  }).formatToParts(new Date())
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}`
}

function monthLabel(key, short = false) {
  const { year, month } = parseYM(key)
  if (!year || !month) return key || 'Sin mes'
  const text = new Intl.DateTimeFormat('es-CL', {
    month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function normalizeMerchant(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(compra|cuotas?|sin|interes|tasa|int|com|fija|pago|mercadopago|mp|payu|tuu|curico|spa|cpc|cl)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

function tokenSimilarity(a, b) {
  const left = new Set(normalizeMerchant(a).split(' ').filter(token => token.length > 2))
  const right = new Set(normalizeMerchant(b).split(' ').filter(token => token.length > 2))
  if (!left.size || !right.size) return 0
  const shared = [...left].filter(token => right.has(token)).length
  return shared / Math.max(left.size, right.size)
}

function categoryFor(categories, idOrCategory) {
  if (idOrCategory && typeof idOrCategory === 'object') return idOrCategory
  return categories.find(category => category.id === idOrCategory) || FALLBACK_CATEGORY
}

function formatDueDate(value) {
  if (!value) return ''
  const day = String(value).slice(0, 10)
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${day}T12:00:00Z`))
}

function expandManualDebt(debt, categories, banks) {
  const category = categoryFor(categories, debt.category)
  const bank = banks.find(item => item.id === debt.bank)
  const occurrences = []
  for (let index = 0; index < Number(debt.installments || 0); index += 1) {
    occurrences.push({
      id: `manual:${debt.id}:${index + 1}`,
      planId: `manual:${debt.id}`,
      debtId: debt.id,
      source: 'manual',
      projected: true,
      confirmed: false,
      monthKey: addMonthsKey(debt.startMonth, index),
      description: debt.description,
      amount: Number(debt.monthlyAmount || 0),
      installmentCurrent: index + 1,
      installmentTotal: Number(debt.installments || 1),
      paid: index < Number(debt.paid || 0),
      bankId: debt.bank,
      bankLabel: bank?.label || debt.bank || 'Manual',
      cardLabel: bank?.label || 'Seguimiento manual',
      category,
      sharedWithNicol: false,
      dueDay: Number(debt.dayOfMonth || 5),
      dueDate: '',
      originalAmount: Number(debt.total || 0),
      isPending: false,
      manualDebt: debt,
    })
  }
  return occurrences
}

function buildBankPlans(cycles, creditCards, categories, banks) {
  const cardMap = new Map(creditCards.map(card => [card.id, card]))
  const groups = new Map()

  cycles.forEach(cycle => {
    const card = cardMap.get(cycle.cardId)
    const bank = banks.find(item => item.id === card?.bank)
    cycle.transactions
      .filter(item => Number(item.installmentTotal || 0) > 1 && Number(item.amount || 0) > 0 && item.affectsCycleTotal)
      .forEach(item => {
        const key = [cycle.cardId, normalizeMerchant(item.description), Number(item.amount), Number(item.installmentTotal)].join('|')
        const plan = groups.get(key) || {
          id: `bank:${key}`,
          source: 'bank',
          cardId: cycle.cardId,
          bankId: card?.bank || item.bankId,
          bankLabel: bank?.label || card?.bank || item.bankId || 'Banco',
          cardLabel: card ? `${card.name}${card.lastFour ? ` •••• ${card.lastFour}` : ''}` : 'Tarjeta',
          description: item.description,
          amount: Number(item.amount),
          installmentTotal: Number(item.installmentTotal),
          category: categoryFor(categories, item.category),
          originalAmount: Number(item.originalAmount || 0),
          actual: [],
          sharedWithNicol: Boolean(item.sharedWithNicol),
        }
        plan.actual.push({
          id: `bank:${item.id}`,
          transactionId: item.id,
          planId: plan.id,
          source: 'bank',
          projected: false,
          confirmed: !item.isPending,
          monthKey: cycle.cycleKey,
          description: item.description,
          amount: Number(item.amount),
          installmentCurrent: Number(item.installmentCurrent || 1),
          installmentTotal: Number(item.installmentTotal),
          paid: false,
          bankId: plan.bankId,
          bankLabel: plan.bankLabel,
          cardLabel: plan.cardLabel,
          category: categoryFor(categories, item.category),
          sharedWithNicol: Boolean(item.sharedWithNicol),
          dueDate: cycle.dueDate,
          originalAmount: Number(item.originalAmount || 0),
          isPending: Boolean(item.isPending),
        })
        plan.description = item.description || plan.description
        plan.category = categoryFor(categories, item.category) || plan.category
        plan.originalAmount = Number(item.originalAmount || plan.originalAmount || 0)
        plan.sharedWithNicol = Boolean(item.sharedWithNicol)
        groups.set(key, plan)
      })
  })

  return [...groups.values()].map(plan => {
    const uniqueActual = [...new Map(plan.actual
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey) || a.installmentCurrent - b.installmentCurrent)
      .map(item => [`${item.monthKey}:${item.installmentCurrent}`, item])).values()]
    const latest = uniqueActual[uniqueActual.length - 1]
    const projected = []
    if (latest) {
      for (let n = latest.installmentCurrent + 1; n <= latest.installmentTotal; n += 1) {
        const offset = n - latest.installmentCurrent
        projected.push({
          ...latest,
          id: `${plan.id}:projection:${n}`,
          projected: true,
          confirmed: false,
          monthKey: addMonthsKey(latest.monthKey, offset),
          installmentCurrent: n,
          isPending: false,
          sharedWithNicol: plan.sharedWithNicol,
        })
      }
    }
    return {
      ...plan,
      actual: uniqueActual,
      projected,
      latest,
      occurrences: [...uniqueActual, ...projected],
    }
  })
}

function reconcileManualDebts(debts, bankPlans) {
  const usedPlans = new Set()
  const matches = new Map()

  debts.forEach(debt => {
    const candidates = bankPlans
      .filter(plan => !usedPlans.has(plan.id))
      .filter(plan => !debt.bank || !plan.bankId || debt.bank === plan.bankId)
      .filter(plan => Number(debt.installments || 0) === Number(plan.installmentTotal || 0))
      .filter(plan => Math.abs(Number(debt.monthlyAmount || 0) - Number(plan.amount || 0)) <= Math.max(3, Number(plan.amount || 0) * 0.01))
      .map(plan => ({ plan, score: tokenSimilarity(debt.description, plan.description) }))
      .sort((a, b) => b.score - a.score)

    const best = candidates.find(candidate => candidate.score >= 0.2) || (candidates.length === 1 ? candidates[0] : null)
    if (best) {
      usedPlans.add(best.plan.id)
      matches.set(debt.id, best.plan.id)
    }
  })
  return matches
}

function buildUnifiedData(debts, cycles, creditCards, categories, banks) {
  const bankPlans = buildBankPlans(cycles, creditCards, categories, banks)
  const matches = reconcileManualDebts(debts, bankPlans)
  const debtMap = new Map(debts.map(debt => [debt.id, debt]))
  const matchedPlanToDebt = new Map([...matches.entries()].map(([debtId, planId]) => [planId, debtMap.get(debtId)]))
  const enrichedPlans = bankPlans.map(plan => ({ ...plan, manualDebt: matchedPlanToDebt.get(plan.id) || null }))
  const unmatchedDebts = debts.filter(debt => !matches.has(debt.id))
  const manualOccurrences = unmatchedDebts.flatMap(debt => expandManualDebt(debt, categories, banks))
  const occurrences = [...enrichedPlans.flatMap(plan => plan.occurrences), ...manualOccurrences]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey) || a.amount - b.amount)
  return { bankPlans: enrichedPlans, unmatchedDebts, matches, occurrences }
}

function ModalShell({ title, onClose, children }) {
  return <>
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-[480px] max-h-[92vh] rounded-t-2xl bg-[var(--bg-elev)] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3.5 border-b border-[var(--line)] bg-[var(--bg-elev)]">
          <div className="text-[15px] font-bold">{title}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="x" size={14}/></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  </>
}

function Field({ label, children }) {
  return <label className="block"><span className="text-[9.5px] uppercase tracking-[.09em] font-bold text-[var(--muted)] block mb-1.5">{label}</span>{children}</label>
}

function InstallmentForm({ initial, categories, banks, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const recalculateFromTotal = value => {
    const total = Number(value) || 0
    const installments = Math.max(1, Number(form.installments) || 1)
    setForm(current => ({ ...current, total: value, monthlyAmount: total ? Math.round(total / installments) : '' }))
  }
  const recalculateInstallments = value => {
    const installments = Math.max(1, Number(value) || 1)
    const total = Number(form.total) || 0
    setForm(current => ({ ...current, installments, monthlyAmount: total ? Math.round(total / installments) : current.monthlyAmount }))
  }
  const valid = form.description.trim() && Number(form.monthlyAmount) > 0 && Number(form.installments) > 0

  return <div className="grid grid-cols-2 gap-3">
    <div className="col-span-2"><Field label="Descripción"><input value={form.description} onChange={e => set('description', e.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px]" placeholder="Compra o compromiso"/></Field></div>
    <Field label="Total"><input inputMode="numeric" value={form.total} onChange={e => recalculateFromTotal(e.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px] font-mono"/></Field>
    <Field label="Número de cuotas"><input type="number" min="1" max="60" value={form.installments} onChange={e => recalculateInstallments(e.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px] font-mono"/></Field>
    <Field label="Valor de cuota"><input inputMode="numeric" value={form.monthlyAmount} onChange={e => set('monthlyAmount', e.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px] font-mono"/></Field>
    <Field label="Cuotas pagadas"><input type="number" min="0" max={form.installments} value={form.paid} onChange={e => set('paid', Number(e.target.value))} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px] font-mono"/></Field>
    <Field label="Banco"><select value={form.bank} onChange={e => set('bank', e.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px]">{banks.map(bank => <option key={bank.id} value={bank.id}>{bank.label}</option>)}</select></Field>
    <Field label="Categoría"><select value={form.category} onChange={e => set('category', e.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px]">{categories.map(category => <option key={category.id} value={category.id}>{category.icon} {category.label}</option>)}</select></Field>
    <Field label="Mes de inicio"><input type="month" value={form.startMonth} onChange={e => set('startMonth', e.target.value)} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px]"/></Field>
    <Field label="Día de cobro"><input type="number" min="1" max="31" value={form.dayOfMonth} onChange={e => set('dayOfMonth', Number(e.target.value))} className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px] font-mono"/></Field>
    <label className="col-span-2 flex items-center gap-2 text-[11px] text-[var(--muted)]"><input type="checkbox" checked={Boolean(form.autoPay)} onChange={e => set('autoPay', e.target.checked)}/> Avanzar cuotas pagadas automáticamente después del día de cobro.</label>
    <div className="col-span-2 flex justify-end gap-2 mt-2"><button onClick={onCancel} className="h-9 px-3 text-[11px] text-[var(--muted)]">Cancelar</button><button disabled={!valid} onClick={() => valid && onSave(form)} className="h-9 px-4 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold disabled:opacity-40">Guardar</button></div>
  </div>
}

function SummaryCard({ label, value, detail, tone = 'default' }) {
  const cls = tone === 'dark' ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent' : tone === 'violet' ? 'bg-violet-50 text-violet-950 border-violet-100' : 'bg-[var(--bg-elev)] border-[var(--line)]'
  return <div className={`rounded-2xl border p-3.5 ${cls}`}><div className="text-[9.5px] uppercase tracking-[.1em] font-bold opacity-60">{label}</div><div className="font-mono text-[19px] font-bold mt-2">{value}</div><div className="text-[9.5px] opacity-65 mt-1">{detail}</div></div>
}

function OccurrenceRow({ item }) {
  const category = item.category || FALLBACK_CATEGORY
  const sourceLabel = item.source === 'manual' ? 'Manual' : item.projected ? 'Proyección bancaria' : item.isPending ? 'Pendiente banco' : 'Confirmada por banco'
  const sourceClass = item.source === 'manual' ? 'bg-slate-100 text-slate-700' : item.projected ? 'bg-blue-50 text-blue-700' : item.isPending ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-700'
  return <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[auto_minmax(230px,1.5fr)_minmax(180px,.8fr)_auto] gap-3 items-center px-3.5 py-3 border-b border-[var(--line)] last:border-b-0">
    <div className="w-9 h-9 rounded-xl grid place-items-center border text-[17px]" style={{ borderColor: translucent(category.color, '55'), backgroundColor: translucent(category.color, '20') }}>{category.icon || '•'}</div>
    <div className="min-w-0"><div className="text-[12px] font-semibold truncate">{item.description}</div><div className="text-[9.5px] text-[var(--muted)] mt-0.5 truncate">{item.cardLabel} · {item.dueDate ? `vence ${formatDueDate(item.dueDate)}` : `día ${item.dueDay || 5}`}</div><div className="flex flex-wrap gap-1 mt-1.5"><span className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-bold ${sourceClass}`}>{sourceLabel}</span><span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold bg-[var(--ink)] text-[var(--bg)]">Cuota {item.installmentCurrent}/{item.installmentTotal}</span>{item.sharedWithNicol && <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold bg-violet-50 text-violet-700">Nicol</span>}</div></div>
    <div className="hidden lg:block text-[9.5px] text-[var(--muted)]">{category.icon} {category.label}<div className="mt-1">{item.projected ? 'Monto estimado' : 'Movimiento registrado'}</div></div>
    <div className="text-right"><div className="font-mono text-[13px] font-bold whitespace-nowrap">{fmtCLP(item.amount)}</div>{item.originalAmount > item.amount && <div className="text-[8.5px] text-[var(--muted)] mt-0.5">total {fmtCLP(item.originalAmount)}</div>}</div>
  </div>
}

function PlanRow({ plan, onEditManual, onDeleteManual }) {
  const category = plan.category || FALLBACK_CATEGORY
  const manual = plan.manualDebt
  const latest = plan.latest
  const remaining = Math.max(0, Number(plan.installmentTotal || 0) - Number(latest?.installmentCurrent || 0))
  return <div className="px-3.5 py-3 border-b border-[var(--line)] last:border-b-0">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl grid place-items-center border text-[17px] shrink-0" style={{ borderColor: translucent(category.color, '55'), backgroundColor: translucent(category.color, '20') }}>{category.icon || '•'}</div>
      <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div><div className="text-[12px] font-semibold">{plan.description}</div><div className="text-[9.5px] text-[var(--muted)] mt-0.5">{plan.cardLabel} · {latest ? `última cuota ${latest.installmentCurrent}/${latest.installmentTotal}` : ''}</div></div><div className="font-mono text-[13px] font-bold whitespace-nowrap">{fmtCLP(plan.amount)}<div className="text-[8.5px] text-[var(--muted)] text-right">por cuota</div></div></div>
        <div className="flex flex-wrap gap-1 mt-2"><span className="rounded-full bg-blue-50 text-blue-700 px-1.5 py-0.5 text-[8.5px] font-bold">Banco</span>{manual && <span className="rounded-full bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[8.5px] font-bold">Manual conciliada</span>}{plan.sharedWithNicol && <span className="rounded-full bg-violet-50 text-violet-700 px-1.5 py-0.5 text-[8.5px] font-bold">Nicol</span>}<span className="rounded-full bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[8.5px] font-bold">Quedan {remaining}</span></div>
      </div>
      {manual && <div className="flex gap-1 shrink-0"><button onClick={() => onEditManual(manual)} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="pencil" size={12}/></button><button onClick={() => onDeleteManual(manual.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center"><Icon name="trash" size={12}/></button></div>}
    </div>
  </div>
}

function ManualPlanRow({ debt, categories, banks, onEdit, onDelete, onMarkPaid }) {
  const category = categoryFor(categories, debt.category)
  const bank = banks.find(item => item.id === debt.bank)
  const remaining = Math.max(0, Number(debt.installments) - Number(debt.paid))
  return <div className="px-3.5 py-3 border-b border-[var(--line)] last:border-b-0">
    <div className="flex items-start gap-3"><div className="w-9 h-9 rounded-xl grid place-items-center border text-[17px]" style={{ borderColor: translucent(category.color, '55'), backgroundColor: translucent(category.color, '20') }}>{category.icon || '•'}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div><div className="text-[12px] font-semibold">{debt.description}</div><div className="text-[9.5px] text-[var(--muted)] mt-0.5">{bank?.label || debt.bank} · {debt.paid}/{debt.installments} pagadas</div></div><div className="font-mono text-[13px] font-bold">{fmtCLP(debt.monthlyAmount)}<div className="text-[8.5px] text-[var(--muted)] text-right">por cuota</div></div></div><div className="flex flex-wrap gap-1 mt-2"><span className="rounded-full bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[8.5px] font-bold">Solo manual</span><span className="rounded-full bg-[var(--amber-soft)] text-[var(--amber-ink)] px-1.5 py-0.5 text-[8.5px] font-bold">Quedan {remaining}</span></div></div><div className="flex gap-1 shrink-0">{remaining > 0 && <button onClick={() => onMarkPaid(debt.id)} className="h-8 px-2 rounded-lg bg-emerald-50 text-emerald-700 text-[9px] font-semibold">Pagar 1</button>}<button onClick={() => onEdit(debt)} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="pencil" size={12}/></button><button onClick={() => onDelete(debt.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center"><Icon name="trash" size={12}/></button></div></div>
  </div>
}

export default function Installments({
  debts,
  setDebts,
  creditCards = [],
  onCreateInstallment,
  onUpdateInstallment,
  onDeleteInstallment,
}) {
  const banks = useBanks()
  const categories = useCategories()
  const nowKey = currentMonthKey()
  const [cycles, setCycles] = useState([])
  const [loadedCards, setLoadedCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(nowKey)
  const [viewMode, setViewMode] = useState('calendar')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [bankFilter, setBankFilter] = useState('all')
  const [sharedOnly, setSharedOnly] = useState(false)
  const [formState, setFormState] = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [nextCycles, nextCards] = await Promise.all([fetchBillingCycles(), fetchMyCards()])
      setCycles(nextCycles)
      setLoadedCards(nextCards || [])
    }
    catch (exception) { console.error('fetchBillingCycles from Installments:', exception); setError(exception.message || 'No se pudieron cargar las cuotas bancarias.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const effectiveCards = creditCards.length ? creditCards : loadedCards
  const data = useMemo(() => buildUnifiedData(debts, cycles, effectiveCards, categories, banks), [debts, cycles, effectiveCards, categories, banks])
  const months = useMemo(() => Array.from({ length: 8 }, (_, index) => addMonthsKey(nowKey, index)), [nowKey])
  const selectedOccurrences = useMemo(() => data.occurrences.filter(item => item.monthKey === selectedMonth && !item.paid), [data.occurrences, selectedMonth])
  const filteredOccurrences = useMemo(() => selectedOccurrences.filter(item => {
    if (sourceFilter === 'bank' && item.source !== 'bank') return false
    if (sourceFilter === 'manual' && item.source !== 'manual') return false
    if (sourceFilter === 'actual' && item.projected) return false
    if (sourceFilter === 'projected' && !item.projected) return false
    if (bankFilter !== 'all' && item.bankId !== bankFilter) return false
    if (sharedOnly && !item.sharedWithNicol) return false
    return true
  }), [selectedOccurrences, sourceFilter, bankFilter, sharedOnly])

  const currentOccurrences = data.occurrences.filter(item => item.monthKey === nowKey && !item.paid)
  const currentTotal = currentOccurrences.reduce((sum, item) => sum + item.amount, 0)
  const currentBank = currentOccurrences.filter(item => item.source === 'bank').reduce((sum, item) => sum + item.amount, 0)
  const currentShared = currentOccurrences.filter(item => item.sharedWithNicol).reduce((sum, item) => sum + item.amount, 0)
  const futureSix = months.slice(0, 6).map(month => data.occurrences.filter(item => item.monthKey === month && !item.paid).reduce((sum, item) => sum + item.amount, 0))
  const averageSix = futureSix.reduce((sum, amount) => sum + amount, 0) / 6

  const bankIds = [...new Set(data.occurrences.map(item => item.bankId).filter(Boolean))]
  const monthTotal = key => data.occurrences.filter(item => item.monthKey === key && !item.paid).reduce((sum, item) => sum + item.amount, 0)

  const handleSave = async form => {
    const payload = {
      ...form,
      total: Number(form.total || 0),
      installments: Number(form.installments || 1),
      paid: Number(form.paid || 0),
      monthlyAmount: Number(form.monthlyAmount || 0),
      dayOfMonth: Number(form.dayOfMonth || 5),
    }
    if (formState?.id) {
      const updated = { ...payload, id: formState.id }
      if (onUpdateInstallment) await onUpdateInstallment(updated)
      else setDebts(debts.map(debt => debt.id === updated.id ? updated : debt))
    } else if (onCreateInstallment) await onCreateInstallment(payload)
    else setDebts([...debts, { ...payload, id: `manual-${Date.now()}` }])
    setFormState(null)
  }

  const markPaid = id => {
    const updated = debts.map(debt => debt.id === id ? { ...debt, paid: Math.min(debt.installments, debt.paid + 1), status: debt.paid + 1 >= debt.installments ? 'paid' : 'active' } : debt)
    setDebts(updated)
  }

  const deleteManual = async id => {
    if (onDeleteInstallment) await onDeleteInstallment(id)
    else setDebts(debts.filter(debt => debt.id !== id))
  }

  return <div className="max-w-7xl mx-auto pb-20">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div><div className="text-[10px] uppercase tracking-[.13em] text-[var(--muted)] font-bold">Proyección conciliada</div><p className="text-[11px] text-[var(--muted)] mt-1">Cuotas reales de tarjetas y seguimientos manuales, sin sumar coincidencias dos veces.</p></div>
      <div className="flex flex-wrap gap-2"><div className="flex rounded-lg border border-[var(--line)] p-1 bg-[var(--bg-elev)]"><button onClick={() => setViewMode('calendar')} className={`h-7 px-2.5 rounded-md text-[10px] font-semibold ${viewMode === 'calendar' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)]'}`}>Calendario</button><button onClick={() => setViewMode('plans')} className={`h-7 px-2.5 rounded-md text-[10px] font-semibold ${viewMode === 'plans' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)]'}`}>Planes</button></div><button onClick={load} className="h-9 px-3 rounded-lg border border-[var(--line)] text-[10px] font-semibold flex items-center gap-1.5"><Icon name="refresh" size={12}/>Actualizar</button><button onClick={() => setFormState({ ...BLANK, category: categories[0]?.id || 'otros', bank: banks[0]?.id || 'bchile' })} className="h-9 px-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold flex items-center gap-1.5"><Icon name="plus" size={12}/>Nueva manual</button></div>
    </div>

    {loading && <div className="mt-3 h-1 rounded-full bg-[var(--soft)] overflow-hidden"><div className="h-full w-1/2 bg-[var(--ink)] animate-pulse"/></div>}
    {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] text-red-700">{error}</div>}
    {data.matches.size > 0 && <div className="mt-3 rounded-xl bg-emerald-50 text-emerald-800 px-3.5 py-2.5 text-[10px]"><strong>{data.matches.size}</strong> seguimientos manuales fueron conciliados con cuotas bancarias. El total usa el movimiento del banco.</div>}

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4">
      <SummaryCard label="Cuotas este mes" value={fmtCLP(currentTotal)} detail={monthLabel(nowKey)} tone="dark"/>
      <SummaryCard label="Confirmadas/proyectadas banco" value={fmtCLP(currentBank)} detail={`${data.bankPlans.length} planes bancarios`}/>
      <SummaryCard label="Compartido con Nicol" value={fmtCLP(currentShared)} detail="Base de cuotas del mes" tone="violet"/>
      <SummaryCard label="Promedio próximos 6 meses" value={fmtCLP(Math.round(averageSix))} detail="Banco + manuales no conciliadas"/>
    </div>

    {viewMode === 'calendar' ? <>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{months.map(key => { const active = selectedMonth === key; const total = monthTotal(key); return <button key={key} onClick={() => setSelectedMonth(key)} className={`shrink-0 rounded-xl border px-3 py-2 text-left min-w-[130px] ${active ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--bg-elev)] border-[var(--line)]'}`}><div className="text-[9.5px] font-semibold opacity-70">{monthLabel(key, true)}</div><div className="font-mono text-[13px] font-bold mt-0.5">{fmtCLP(total)}</div><div className="text-[8.5px] opacity-60 mt-0.5">{data.occurrences.filter(item => item.monthKey === key && !item.paid).length} cuotas</div></button> })}</div>

      <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-2.5 flex flex-wrap gap-2">
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[10px]"><option value="all">Todas las fuentes</option><option value="actual">Registradas por banco</option><option value="projected">Proyectadas</option><option value="bank">Solo banco</option><option value="manual">Solo manuales</option></select>
        <select value={bankFilter} onChange={e => setBankFilter(e.target.value)} className="h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[10px]"><option value="all">Todos los bancos</option>{bankIds.map(id => <option key={id} value={id}>{banks.find(bank => bank.id === id)?.label || id}</option>)}</select>
        <label className="h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 flex items-center gap-2 text-[10px]"><input type="checkbox" checked={sharedOnly} onChange={e => setSharedOnly(e.target.checked)}/>Solo Nicol</label>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden">
        <div className="px-3.5 py-3 border-b border-[var(--line)] flex justify-between"><div><div className="text-[12px] font-bold">{monthLabel(selectedMonth)}</div><div className="text-[9.5px] text-[var(--muted)] mt-0.5">Las proyecciones se reemplazan cuando llega el movimiento real del banco.</div></div><div className="font-mono text-[13px] font-bold">{fmtCLP(filteredOccurrences.reduce((sum, item) => sum + item.amount, 0))}</div></div>
        {filteredOccurrences.map(item => <OccurrenceRow key={item.id} item={item}/>)}
        {!filteredOccurrences.length && <div className="p-8 text-center text-[11px] text-[var(--muted)]">No hay cuotas con estos filtros.</div>}
      </div>
    </> : <div className="mt-4 grid lg:grid-cols-2 gap-3">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden"><div className="px-3.5 py-3 border-b border-[var(--line)]"><div className="text-[12px] font-bold">Planes bancarios</div><div className="text-[9.5px] text-[var(--muted)] mt-0.5">Fuente principal para las proyecciones.</div></div>{data.bankPlans.map(plan => <PlanRow key={plan.id} plan={plan} onEditManual={setFormState} onDeleteManual={deleteManual}/>)}{!data.bankPlans.length && <div className="p-8 text-center text-[11px] text-[var(--muted)]">Sin cuotas bancarias.</div>}</section>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden"><div className="px-3.5 py-3 border-b border-[var(--line)]"><div className="text-[12px] font-bold">Seguimientos solo manuales</div><div className="text-[9.5px] text-[var(--muted)] mt-0.5">Compromisos que aún no están respaldados por Facturación.</div></div>{data.unmatchedDebts.map(debt => <ManualPlanRow key={debt.id} debt={debt} categories={categories} banks={banks} onEdit={setFormState} onDelete={deleteManual} onMarkPaid={markPaid}/>)}{!data.unmatchedDebts.length && <div className="p-8 text-center text-[11px] text-[var(--muted)]">Todos los seguimientos manuales están conciliados.</div>}</section>
    </div>}

    {formState && <ModalShell title={formState.id ? 'Editar seguimiento manual' : 'Nueva cuota manual'} onClose={() => setFormState(null)}><InstallmentForm initial={formState} categories={categories} banks={banks} onSave={handleSave} onCancel={() => setFormState(null)}/></ModalShell>}
  </div>
}
