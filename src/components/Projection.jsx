import React, { useState, useMemo, useCallback } from 'react'
import { Select } from './ui'
import { Icon, fmtCLP, fmtCLPshort, MES } from '../lib/helpers'
import { PAYMENT_METHODS } from '../data'
import { useCategories } from '../services/categoriesService'
import { useBanks } from '../services/banksService'

// ── Persistence ────────────────────────────────────────────────
const LS_KEY = 'gastito_proj_v1'
const loadItems = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] } }
const saveItems = items => localStorage.setItem(LS_KEY, JSON.stringify(items))

// ── Math ───────────────────────────────────────────────────────
function mDiff(a, b) {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}
function mkKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}` }

// ── Core projection engine ─────────────────────────────────────
// Three rolling trajectories per month:
//   balConservative = start - outflows (no income)
//   balExpected     = start + income - outflows
//   balSim          = balExpected - simulated items
//
// Recurring items are filtered by startDate/endDate to avoid
// counting subscriptions that haven't started yet.
function computeMonths({
  startBalance,
  incomeItems      = [],
  receivables      = [],
  payables         = [],
  recurringItems   = [],
  installmentDebts = [],
  projectedItems   = [],
  sw               = {},
}) {
  const today    = new Date()
  const todayDay = today.getDate()
  const active   = projectedItems.filter(i => i.active)
  let balC = startBalance
  let balE = startBalance
  let balS = startBalance

  return [0, 1, 2].map(offset => {
    const d         = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    const y         = d.getFullYear()
    const m         = d.getMonth()
    const mk        = mkKey(y, m)
    const isCurrent = offset === 0

    // ── Recurring expenses (startDate/endDate aware) ────────────
    const recurringDetail = []
    for (const r of recurringItems) {
      if (r.kind !== 'expense' || r.active === false) continue
      // Skip if subscription hasn't started for this period
      if (r.startDate && r.startDate.slice(0, 7) > mk) continue
      // Skip if subscription has ended for this period
      if (r.endDate && r.endDate.slice(0, 7) < mk) continue
      // Current month: skip if charge day already passed
      if (isCurrent && r.dayOfMonth != null && Number(r.dayOfMonth) <= todayDay) continue
      recurringDetail.push({ item: r, amount: r.amount || 0 })
    }
    const recurring = recurringDetail.reduce((s, x) => s + x.amount, 0)

    // ── Income ──────────────────────────────────────────────────
    const incomeDetail = []
    for (const r of incomeItems) {
      if (r.active === false) continue
      if (r.startDate && r.startDate.slice(0, 7) > mk) continue
      if (r.endDate   && r.endDate.slice(0, 7)   < mk) continue
      if (isCurrent && r.dayOfMonth != null && Number(r.dayOfMonth) <= todayDay) continue
      incomeDetail.push({ item: r, amount: r.amount || 0 })
    }
    const income = incomeDetail.reduce((s, x) => s + x.amount, 0)

    // ── Receivables (one-time, only current month) ──────────────
    const recvDetail = isCurrent
      ? receivables.filter(r => r.status !== 'paid').map(r => ({ item: r, amount: r.amount || 0 }))
      : []
    const recvAmt = recvDetail.reduce((s, x) => s + x.amount, 0)

    // ── Payables (one-time personal debts, only current month) ──
    const payDetail = isCurrent
      ? payables.filter(p => p.status !== 'paid').map(p => ({ item: p, amount: p.amount || 0 }))
      : []
    const payAmt = payDetail.reduce((s, x) => s + x.amount, 0)

    // ── Cuotas ──────────────────────────────────────────────────
    const cuotasDetail = []
    for (const debt of installmentDebts) {
      if (debt.status !== 'active' || !debt.startMonth) continue
      const el = mDiff(debt.startMonth, mk)
      if (el < 0 || el >= debt.installments) continue
      if (isCurrent && debt.dayOfMonth != null && Number(debt.dayOfMonth) <= todayDay) continue
      cuotasDetail.push({ item: debt, amount: debt.monthlyAmount || 0 })
    }
    const cuotas = cuotasDetail.reduce((s, x) => s + x.amount, 0)

    // ── Projected (simulated) items ─────────────────────────────
    const projBreakdown = active.map(item => {
      const id  = new Date(item.date)
      const imk = mkKey(id.getFullYear(), id.getMonth())
      let amt   = 0
      if (item.installments > 1) {
        const el = mDiff(imk, mk)
        if (el >= 0 && el < item.installments) amt = Math.round(item.amount / item.installments)
      } else {
        if (id.getMonth() === m && id.getFullYear() === y) amt = item.amount
      }
      return { item, amount: amt }
    }).filter(x => x.amount > 0)
    const projOut = projBreakdown.reduce((s, x) => s + x.amount, 0)

    // ── Apply switches ──────────────────────────────────────────
    const effRecv   = sw.receivables !== false ? recvAmt : 0
    const effPay    = sw.payables    ?           payAmt  : 0
    const effCuotas = sw.cuotas      !== false ? cuotas  : 0
    const effSim    = sw.sim         !== false ? projOut : 0
    const effOut    = recurring + effCuotas + effPay

    const newBalC = balC - effOut
    const newBalE = balE + income + effRecv - effOut
    const newBalS = balS + income + effRecv - effOut - effSim

    // ── Diagnostic logs ─────────────────────────────────────────
    const itemsExcluidos = recurringItems.filter(r =>
      r.kind === 'expense' && r.active !== false &&
      !recurringDetail.some(x => x.item.id === r.id)
    ).map(r => ({
      name: r.name,
      reason: (r.startDate?.slice(0, 7) > mk)
        ? `startDate ${r.startDate.slice(0, 7)} > ${mk}`
        : (r.endDate?.slice(0, 7) < mk)
        ? `endDate ${r.endDate.slice(0, 7)} < ${mk}`
        : `día ${r.dayOfMonth} ya pasó (hoy: ${todayDay})`,
    }))
    console.log('[projection:recurrentes]', {
      periodo: mk, isCurrent,
      itemsIncluidos: recurringDetail.map(x => ({ name: x.item.name, amount: x.amount })),
      itemsExcluidos,
      total: recurring,
    })
    console.log('[projection:resumen]', {
      periodo: mk,
      ...(offset === 0 ? { saldoBase: startBalance } : {}),
      ingresosIncluidos: income + effRecv,
      gastosIncluidos: effOut,
      cuotasIncluidas: effCuotas,
      simulacionesIncluidas: effSim,
      saldoFinalConservador: newBalC,
      saldoFinalEsperado: newBalE,
    })

    const row = {
      key: mk, y, m, offset, isCurrent,
      income, recvAmt, payAmt, recurring, cuotas,
      incomeDetail, recvDetail, payDetail, recurringDetail, cuotasDetail,
      projOut, projBreakdown,
      balConservative: newBalC,
      balExpected:     newBalE,
      balSim:          newBalS,
      hasSim:          active.length > 0,
    }
    balC = newBalC
    balE = newBalE
    balS = newBalS
    return row
  })
}

function verdict(bal, ref) {
  if (bal <= 0) return 'rojo'
  return bal < Math.max(ref * 0.15, 50000) ? 'amarillo' : 'verde'
}

const VC = {
  verde:    { label: 'Viable',            bg: 'var(--accent-soft)', color: 'var(--accent-ink)', icon: 'check' },
  amarillo: { label: 'Posible, ajustado', bg: 'var(--amber-soft)',  color: 'var(--amber-ink)',  icon: 'alert' },
  rojo:     { label: 'No recomendado',    bg: '#FFF0EE',            color: '#C0392B',            icon: 'alert' },
}

const PERIOD_LABELS = ['Este mes', 'Próximo mes', '3er mes']
const mkBlank = () => ({
  id: null, name: '', amount: '', category: 'otros',
  date: new Date().toISOString().slice(0, 10),
  description: '', method: 'tarjeta', type: 'debito',
  bank: 'bchile', installments: 1, active: true,
})

// ── Clickable flow row ─────────────────────────────────────────
function FlowRow({ label, amount, type, items, open, onToggle }) {
  const isSim    = type === 'sim'
  const isIncome = type === 'income'
  const sign     = isIncome ? '+' : '−'
  const color    = isIncome ? 'var(--accent-ink)' : isSim ? 'var(--ink)' : 'var(--ink-2)'
  const hasItems = (items?.length ?? 0) > 0

  return (
    <div>
      <button type="button" onClick={hasItems ? onToggle : undefined}
        className={`w-full flex items-center justify-between text-[13px] text-left transition
          ${hasItems ? 'hover:opacity-75 cursor-pointer' : 'cursor-default'}`}>
        <span className={isSim ? 'font-medium text-[var(--ink)]' : 'text-[var(--muted)]'}>{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono tabular-nums" style={{ color, fontWeight: isSim ? 600 : 400 }}>
            {sign}{fmtCLP(amount)}
          </span>
          {hasItems && <Icon name={open ? 'chevdown' : 'chevron'} size={11} className="text-[var(--muted)]"/>}
        </div>
      </button>
      {open && hasItems && (
        <div className="mt-1.5 pl-3 border-l-2 border-[var(--line)] flex flex-col gap-1">
          {items.map((x, i) => (
            <div key={i} className="flex items-center justify-between text-[11.5px]">
              <span className="text-[var(--muted)] truncate min-w-0">
                {x.item.name || x.item.personName || x.item.description || '—'}
              </span>
              <span className="font-mono tabular-nums text-[var(--ink-2)] shrink-0 ml-2">
                {sign}{fmtCLP(x.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────
function ProjModal({ item, onClose, onSave }) {
  const categories = useCategories()
  const banks = useBanks()
  const [f, setF0] = useState(item)
  const sf = (k, v) => setF0(p => ({ ...p, [k]: v }))
  const isNew = item.id === null
  const cat = categories.find(c => c.id === f.category) ?? categories.find(c => c.id === 'otros') ?? categories[0]

  const handleSave = () => onSave({
    ...f,
    amount:       Number(String(f.amount).replace(/[^0-9]/g, '')) || 0,
    installments: Math.max(1, Number(f.installments) || 1),
  })

  const canSave = f.name.trim() && f.amount

  return (
    <div className="fixed inset-0 z-50 flex md:items-stretch items-end justify-end">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose}/>
      <div className="relative w-full md:max-w-[460px] md:h-screen bg-[var(--bg-elev)] border-l border-[var(--line)]
                      rounded-t-2xl md:rounded-none overflow-y-auto"
           style={{ animation: 'slideUp .2s ease-out' }}>

        <div className="sticky top-0 bg-[var(--bg-elev)] border-b border-[var(--line)] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-md grid place-items-center text-[16px] shrink-0"
              style={{ background: (cat?.color || '#888') + '20' }}>{cat?.icon}</div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                {isNew ? 'Nuevo gasto proyectado' : 'Editar proyección'}
              </div>
              <div className="font-semibold tracking-tight truncate">{f.name || '—'}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-md border border-[var(--line)] hover:bg-[var(--hover)]">
            <Icon name="x" size={16}/>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          <div>
            <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Nombre</label>
            <input value={f.name} onChange={e => sf('name', e.target.value)}
              placeholder="Ej: Arreglo auto, iPhone en cuotas…"
              className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md focus:outline-none focus:border-[var(--ink)] text-[14px]"/>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Monto total</label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[24px] text-[var(--muted)]">$</span>
              <input type="text" inputMode="numeric" value={f.amount}
                onChange={e => sf('amount', e.target.value)} placeholder="0"
                className="flex-1 bg-transparent text-[24px] font-mono tabular-nums tracking-tight focus:outline-none border-b border-transparent focus:border-[var(--ink)] py-1"/>
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1 font-mono">
              {fmtCLP(Number(String(f.amount).replace(/[^0-9]/g, '')) || 0)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Categoría</label>
              <Select value={f.category} onChange={v => sf('category', v)}
                options={categories.map(c => ({ value: c.id, label: c.label }))}/>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Fecha inicio</label>
              <input type="date" value={f.date} onChange={e => sf('date', e.target.value)}
                className="w-full h-9 px-2 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Tipo de pago</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {['debito', 'credito'].map(t => (
                  <button key={t} type="button" onClick={() => sf('type', t)}
                    className={`h-9 rounded-md border text-[13px] transition
                      ${f.type === t ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]' : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]'}`}>
                    {t === 'debito' ? 'Débito' : 'Crédito'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Cuotas</label>
              <input type="number" min="1" max="60" value={f.installments}
                disabled={f.type !== 'credito'}
                onChange={e => sf('installments', e.target.value)}
                className="w-20 h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[14px] font-mono text-center focus:outline-none focus:border-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Medio de pago</label>
              <Select value={f.method} onChange={v => sf('method', v)}
                options={PAYMENT_METHODS.map(m => ({ value: m.id, label: m.label }))}/>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Banco</label>
              <Select value={f.bank} onChange={v => sf('bank', v)}
                options={banks.map(b => ({ value: b.id, label: b.label }))}/>
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Notas</label>
            <textarea value={f.description} rows={2} onChange={e => sf('description', e.target.value)}
              placeholder="Opcional: para qué es, si es urgente…"
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-md focus:outline-none focus:border-[var(--ink)] text-[13px] resize-none"/>
          </div>
        </div>

        <div className="sticky bottom-0 bg-[var(--bg-elev)] border-t border-[var(--line)] px-5 py-3 flex items-center justify-between">
          <button onClick={onClose} className="text-[13px] text-[var(--muted)] hover:text-[var(--ink)] underline">Cancelar</button>
          <button onClick={handleSave} disabled={!canSave}
            className="h-10 px-5 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium disabled:opacity-40">
            <Icon name="check" size={14}/> {isNew ? 'Agregar' : 'Guardar'}
          </button>
        </div>

        <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      </div>
    </div>
  )
}

// ── Expense item row ───────────────────────────────────────────
function ProjItem({ item, cat, impact, activePeriod, period, onToggle, onDelete, onEdit }) {
  const itemDate = new Date(item.date)
  const monthly  = item.installments > 1 ? Math.round(item.amount / item.installments) : null
  const pName    = activePeriod === 0 ? 'este mes' : activePeriod === 1 ? 'el próx. mes' : `en ${MES[period?.m]}`

  return (
    <div className={`rounded-xl border bg-[var(--bg-elev)] p-4 transition ${!item.active ? 'opacity-55' : ''}`}
      style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md grid place-items-center text-[16px] shrink-0"
          style={{ background: (cat?.color || '#888') + '20' }}>{cat?.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-[14px] tracking-tight truncate">{item.name}</div>
              <div className="text-[12px] text-[var(--muted)] mt-0.5 flex flex-wrap gap-x-1.5">
                <span>{MES[itemDate.getMonth()]} {itemDate.getFullYear()}</span>
                {item.installments > 1 && <><span>·</span><span>{item.installments} cuotas</span></>}
                {item.description && <><span>·</span><span className="truncate">{item.description}</span></>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-[14px] font-semibold tabular-nums">{fmtCLPshort(item.amount)}</div>
              {monthly && <div className="text-[11px] text-[var(--muted)] font-mono">{fmtCLPshort(monthly)}/mes</div>}
            </div>
          </div>
          {item.active && (
            <div className="mt-2">
              {impact > 0
                ? <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] bg-[var(--bg)] rounded-md px-2 py-1">
                    <Icon name="arrowdn" size={11}/>
                    Impacto {pName}: −{fmtCLPshort(impact)}
                  </span>
                : <span className="text-[11px] text-[var(--muted)]">Sin impacto en {pName}</span>
              }
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--line)]">
        <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
          <button type="button" onClick={() => onToggle(item.id)}
            className="relative rounded-full shrink-0 transition-colors"
            style={{ width: 40, height: 22, background: item.active ? 'var(--accent)' : 'var(--line)' }}>
            <span className="absolute rounded-full bg-white shadow transition-transform"
              style={{ top: 2, left: 2, width: 18, height: 18, transform: item.active ? 'translateX(18px)' : 'none' }}/>
          </button>
          <span className="text-[12px] text-[var(--muted)] truncate">
            {item.active ? 'Incluida en proyección' : 'Excluida de proyección'}
          </span>
        </label>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit}
            className="w-7 h-7 grid place-items-center rounded-md border border-[var(--line)] hover:bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--ink)] transition">
            <Icon name="pencil" size={13}/>
          </button>
          <button onClick={() => onDelete(item.id)}
            className="w-7 h-7 grid place-items-center rounded-md border border-[var(--line)] hover:bg-[var(--hover)] text-[var(--muted)] hover:text-red-500 transition">
            <Icon name="trash" size={13}/>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── KPI card ───────────────────────────────────────────────────
function KpiCard({ label, bal, sub, dotCls }) {
  const neg = bal < 0
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1 flex items-center gap-1.5">
        {dotCls && <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`}/>}
        {label}
      </div>
      <div className={`text-[17px] font-mono font-semibold tabular-nums tracking-tight ${neg ? 'text-[#C0392B]' : 'text-[var(--ink)]'}`}>
        {fmtCLPshort(bal)}
      </div>
      <div className="text-[10px] text-[var(--muted)] mt-0.5">{sub}</div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function Projection({
  accounts         = [],
  recurringList    = [],
  incomeList       = [],
  receivables      = [],
  payables         = [],
  installmentDebts = [],
}) {
  const categories = useCategories()
  const [items,        setItems]        = useState(loadItems)
  const [editItem,     setEditItem]     = useState(null)
  const [activePeriod, setActivePeriod] = useState(1)
  const [baseOverride, setBaseOverride] = useState(null)
  const [editingBase,  setEditingBase]  = useState(false)
  const [baseInput,    setBaseInput]    = useState('')
  const [openSection,  setOpenSection]  = useState(null)
  const [sw, setSw] = useState({ receivables: true, payables: false, cuotas: true, sim: true })
  const toggleSw = k => setSw(p => ({ ...p, [k]: !p[k] }))

  const persistItems = useCallback(next => { setItems(next); saveItems(next) }, [])

  const usableBalance = useMemo(() => {
    const total    = (accounts ?? []).filter(a => a.active).reduce((s, a) => s + (a.balance || 0), 0)
    const payFixed = (recurringList ?? []).filter(r => r.active && r.kind === 'payable').reduce((s, r) => s + (r.amount || 0), 0)
    return total - payFixed
  }, [accounts, recurringList])

  const startBalance = baseOverride != null ? baseOverride : usableBalance

  const months = useMemo(() =>
    computeMonths({
      startBalance,
      incomeItems:      incomeList,
      receivables,
      payables,
      recurringItems:   recurringList,
      installmentDebts,
      projectedItems:   items,
      sw,
    })
  , [startBalance, incomeList, receivables, payables, recurringList, installmentDebts, items, sw])

  const period  = months[activePeriod]
  const dispBal = mo => (mo.hasSim && sw.sim !== false) ? mo.balSim : mo.balExpected

  const v  = period ? verdict(dispBal(period), startBalance) : 'verde'
  const vc = VC[v]

  const recText = period ? (() => {
    const pName = activePeriod === 0 ? 'este mes' : activePeriod === 1 ? 'el próximo mes' : `en ${MES[period.m]}`
    const bal   = dispBal(period)
    if (!period.hasSim || sw.sim === false)
      return `Sin gastos simulados activos, proyectas terminar ${pName} con ${fmtCLP(bal)}.`
    if (v === 'rojo')     return `Si agregas estos gastos, terminarías ${pName} con déficit de ${fmtCLP(Math.abs(bal))}. No se recomienda.`
    if (v === 'amarillo') return `Si agregas estos gastos, terminarías ${pName} con ${fmtCLP(bal)}. El margen es ajustado.`
    return `Si agregas estos gastos, terminarías ${pName} con ${fmtCLP(bal)}. El saldo se mantiene saludable.`
  })() : ''

  const onSave = saved => {
    if (saved.id === null) persistItems([...items, { ...saved, id: 'pj' + Date.now() }])
    else persistItems(items.map(i => i.id === saved.id ? saved : i))
    setEditItem(null)
  }
  const onToggle = id => persistItems(items.map(i => i.id === id ? { ...i, active: !i.active } : i))
  const onDelete = id => { if (window.confirm('¿Eliminar este gasto simulado?')) persistItems(items.filter(i => i.id !== id)) }

  const getDot = mo => {
    const vv = verdict(dispBal(mo), startBalance)
    return vv === 'verde' ? 'bg-[var(--accent)]' : vv === 'amarillo' ? 'bg-amber-400' : 'bg-red-500'
  }
  const applyBaseOverride = () => {
    const val = Number(String(baseInput).replace(/[^0-9]/g, ''))
    setBaseOverride(isNaN(val) || val === 0 ? null : val)
    setEditingBase(false)
  }
  const resetBaseOverride = () => { setBaseOverride(null); setEditingBase(false) }
  const toggleSection = s => setOpenSection(p => p === s ? null : s)

  const showRecvWarning = sw.receivables !== false && (period?.recvAmt ?? 0) > 0

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">Proyección</h2>
          <p className="text-[13px] text-[var(--muted)] mt-0.5 leading-snug max-w-sm">
            Simula gastos futuros e hipotéticos para ver cómo afectarían tu saldo.
          </p>
        </div>
        <button onClick={() => setEditItem(mkBlank())}
          className="shrink-0 h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium hover:opacity-90">
          <Icon name="plus" size={14}/> Agregar
        </button>
      </div>

      {/* Info bar */}
      <div className="flex items-center gap-2 text-[12px] text-[var(--muted)] -mt-2 flex-wrap">
        <Icon name="info" size={13}/>
        <span>Proyección calculada desde tu saldo actual</span>
        <span>·</span>
        {editingBase ? (
          <span className="flex items-center gap-1.5">
            <span>Saldo base:</span>
            <input
              type="text" inputMode="numeric" value={baseInput}
              onChange={e => setBaseInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyBaseOverride(); if (e.key === 'Escape') resetBaseOverride() }}
              placeholder={fmtCLP(usableBalance)}
              autoFocus
              className="w-28 h-6 px-2 text-[12px] font-mono bg-[var(--bg)] border border-[var(--ink)] rounded focus:outline-none text-[var(--ink)]"
            />
            <button onClick={applyBaseOverride} className="text-[var(--accent-ink)] font-medium hover:underline">Ok</button>
            <button onClick={resetBaseOverride}><Icon name="x" size={11}/></button>
          </span>
        ) : (
          <button onClick={() => { setBaseInput(''); setEditingBase(true) }}
            className="flex items-center gap-1 hover:text-[var(--ink)] transition">
            <span className="font-mono font-medium text-[var(--ink-2)]">Saldo base: {fmtCLP(startBalance)}</span>
            {baseOverride != null && (
              <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-[var(--amber-soft)] text-[var(--amber-ink)]">manual</span>
            )}
            <Icon name="pencil" size={11}/>
          </button>
        )}
      </div>

      {/* Switches */}
      <div className="flex flex-wrap gap-2 -mt-2">
        {[
          { key: 'receivables', label: 'Por cobrar' },
          { key: 'payables',    label: 'Por pagar' },
          { key: 'cuotas',      label: 'Cuotas' },
          { key: 'sim',         label: 'Simulaciones' },
        ].map(s => (
          <button key={s.key} onClick={() => toggleSw(s.key)}
            className={`h-7 px-3 rounded-full text-[11px] font-medium border transition
              ${sw[s.key]
                ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                : 'bg-transparent text-[var(--muted)] border-[var(--line)] hover:border-[var(--ink-2)]'
              }`}>
            {sw[s.key] ? '✓ ' : ''}{s.label}
          </button>
        ))}
      </div>

      {/* Receivables warning */}
      {showRecvWarning && (
        <div className="flex items-center gap-2 -mt-2 text-[12px] rounded-lg px-3 py-2"
          style={{ background: 'var(--amber-soft)', color: 'var(--amber-ink)' }}>
          <Icon name="alert" size={13} className="shrink-0"/>
          <span>Esta proyección incluye <strong>{fmtCLP(period.recvAmt)}</strong> que aún no te pagan.</span>
        </div>
      )}

      {/* KPI cards: today + next month conservative + next month expected */}
      <div className="grid grid-cols-3 gap-2.5">
        <KpiCard label="Saldo hoy"           bal={startBalance}              sub="disponible"/>
        <KpiCard label={`${MES[months[1].m]} conserv.`} bal={months[1].balConservative} sub="sin ingresos"  dotCls={(() => { const vv = verdict(months[1].balConservative, startBalance); return vv === 'verde' ? 'bg-[var(--accent)]' : vv === 'amarillo' ? 'bg-amber-400' : 'bg-red-500' })()}/>
        <KpiCard label={`${MES[months[1].m]} esperado`} bal={dispBal(months[1])}        sub="con ingresos"  dotCls={getDot(months[1])}/>
      </div>

      {/* Period tabs + detail */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden">
        <div className="flex border-b border-[var(--line)]">
          {months.map((mo, i) => (
            <button key={mo.key} onClick={() => { setActivePeriod(i); setOpenSection(null) }}
              className={`flex-1 py-2.5 text-[12px] font-medium transition border-b-2 -mb-px flex flex-col items-center gap-0.5
                ${activePeriod === i ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink-2)]'}`}>
              <span>{PERIOD_LABELS[i]}</span>
              <span className="font-normal text-[11px]">{MES[mo.m]}</span>
              {mo.isCurrent && <span className="font-normal text-[10px] opacity-60">desde hoy</span>}
            </button>
          ))}
        </div>

        {period && (
          <div className="p-4 flex flex-col gap-3">
            {/* Flow breakdown with clickable drill-down */}
            <div className="flex flex-col gap-2.5">
              <FlowRow
                label={period.isCurrent ? 'Ingresos pendientes del mes' : 'Ingresos esperados'}
                amount={period.income + (sw.receivables !== false ? period.recvAmt : 0)}
                type="income"
                items={[...period.incomeDetail, ...(sw.receivables !== false ? period.recvDetail : [])]}
                open={openSection === 'income'}
                onToggle={() => toggleSection('income')}
              />
              <FlowRow
                label="Gastos recurrentes"
                amount={period.recurring}
                type="out"
                items={period.recurringDetail}
                open={openSection === 'recurring'}
                onToggle={() => toggleSection('recurring')}
              />
              {sw.cuotas !== false && period.cuotas > 0 && (
                <FlowRow
                  label="Cuotas comprometidas"
                  amount={period.cuotas}
                  type="out"
                  items={period.cuotasDetail}
                  open={openSection === 'cuotas'}
                  onToggle={() => toggleSection('cuotas')}
                />
              )}
              {sw.payables && period.payAmt > 0 && (
                <FlowRow
                  label="Gastos por pagar"
                  amount={period.payAmt}
                  type="out"
                  items={period.payDetail}
                  open={openSection === 'pay'}
                  onToggle={() => toggleSection('pay')}
                />
              )}
              {sw.sim !== false && period.projOut > 0 && (
                <div className="pt-1.5 border-t border-[var(--line)] mt-0.5">
                  <FlowRow
                    label="Gastos simulados"
                    amount={period.projOut}
                    type="sim"
                    items={period.projBreakdown}
                    open={openSection === 'sim'}
                    onToggle={() => toggleSection('sim')}
                  />
                </div>
              )}
            </div>

            <div className="h-px bg-[var(--line)]"/>

            {/* Dual result: conservative vs expected */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-[var(--muted)]">Conservador</div>
                <div className={`text-[20px] font-mono font-semibold tabular-nums tracking-tight
                  ${period.balConservative < 0 ? 'text-[#C0392B]' : 'text-[var(--ink)]'}`}>
                  {fmtCLP(period.balConservative)}
                </div>
                <div className="text-[10px] text-[var(--muted)] mt-0.5">sin ingresos futuros</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted)]">
                  {period.hasSim && sw.sim !== false ? 'Con simulaciones' : 'Esperado'}
                </div>
                <div className={`text-[20px] font-mono font-semibold tabular-nums tracking-tight
                  ${dispBal(period) < 0 ? 'text-[#C0392B]' : 'text-[var(--ink)]'}`}>
                  {fmtCLP(dispBal(period))}
                </div>
                <div className="text-[10px] text-[var(--muted)] mt-0.5">
                  {period.hasSim && sw.sim !== false ? 'con ingresos + sim' : 'con ingresos'}
                </div>
                {period.hasSim && sw.sim !== false && period.balExpected !== period.balSim && (
                  <div className="text-[10px] text-[var(--muted)] font-mono mt-0.5">
                    sin sim: {fmtCLPshort(period.balExpected)}
                  </div>
                )}
              </div>
            </div>

            {/* Recommendation */}
            <div className="rounded-lg px-3 py-2.5 flex items-start gap-2"
              style={{ background: vc.bg, color: vc.color }}>
              <Icon name={vc.icon} size={14} className="mt-px shrink-0"/>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold">{vc.label}</div>
                <div className="text-[12px] mt-0.5 leading-snug opacity-90">{recText}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gastos simulados list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-medium">
            Gastos simulados{' '}
            <span className="text-[var(--muted)] font-normal">
              ({items.filter(i => i.active).length}/{items.length} activos)
            </span>
          </div>
          {items.length > 0 && (
            <button onClick={() => setEditItem(mkBlank())}
              className="text-[12px] text-[var(--muted)] hover:text-[var(--ink)] underline transition">
              + Agregar
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] py-14 text-center">
            <div className="text-[36px] mb-3">🔮</div>
            <div className="font-medium text-[15px] tracking-tight mb-1.5">Sin gastos simulados</div>
            <div className="text-[13px] text-[var(--muted)] mb-5 leading-snug max-w-xs mx-auto">
              Agrega gastos futuros o hipotéticos. Por ejemplo: arreglo del auto en junio, iPhone en 6 cuotas, supermercado extra próximo mes.
            </div>
            <button onClick={() => setEditItem(mkBlank())}
              className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
              <Icon name="plus" size={14}/> Agregar primer gasto
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(item => {
              const cat    = categories.find(c => c.id === item.category) ?? categories.find(c => c.id === 'otros') ?? categories[0]
              const impact = item.active ? (period?.projBreakdown?.find(x => x.item.id === item.id)?.amount ?? 0) : 0
              return (
                <ProjItem key={item.id}
                  item={item} cat={cat} impact={impact}
                  activePeriod={activePeriod} period={period}
                  onToggle={onToggle} onDelete={onDelete}
                  onEdit={() => setEditItem({ ...item })}
                />
              )
            })}
          </div>
        )}
      </div>

      {editItem && <ProjModal item={editItem} onClose={() => setEditItem(null)} onSave={onSave}/>}
    </div>
  )
}
