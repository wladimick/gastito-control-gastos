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

function computeMonths({ usableBalance, monthlyIncome, recurringTotal, installmentDebts, projectedItems }) {
  const today  = new Date()
  const active = projectedItems.filter(i => i.active)
  let balBase  = usableBalance
  let balSim   = usableBalance

  return [0, 1, 2].map(offset => {
    const d  = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    const y  = d.getFullYear()
    const m  = d.getMonth()
    const mk = mkKey(y, m)

    const cuotas = (installmentDebts ?? [])
      .filter(d => d.status === 'active' && d.startMonth)
      .reduce((s, d) => {
        const el = mDiff(d.startMonth, mk)
        return el >= 0 && el < d.installments ? s + (d.monthlyAmount || 0) : s
      }, 0)

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

    const projOut    = projBreakdown.reduce((s, x) => s + x.amount, 0)
    const newBalBase = balBase + monthlyIncome - recurringTotal - cuotas
    const newBalSim  = balSim  + monthlyIncome - recurringTotal - cuotas - projOut

    const row = {
      key: mk, y, m, offset,
      income: monthlyIncome, cuotas, recurring: recurringTotal,
      projOut, projBreakdown,
      balBase: newBalBase,
      balSim:  newBalSim,
      hasSim:  active.length > 0,
    }
    balBase = newBalBase
    balSim  = newBalSim
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

// ── Flow row ───────────────────────────────────────────────────
function FlowRow({ label, amount, type }) {
  const isSim    = type === 'sim'
  const isIncome = type === 'income'
  const sign     = isIncome ? '+' : '−'
  const color    = isIncome ? 'var(--accent-ink)' : isSim ? 'var(--ink)' : 'var(--ink-2)'
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className={isSim ? 'font-medium text-[var(--ink)]' : 'text-[var(--muted)]'}>{label}</span>
      <span className="font-mono tabular-nums" style={{ color, fontWeight: isSim ? 600 : 400 }}>
        {sign}{fmtCLP(amount)}
      </span>
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
          {/* Nombre */}
          <div>
            <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Nombre</label>
            <input value={f.name} onChange={e => sf('name', e.target.value)}
              placeholder="Ej: Arreglo auto, iPhone en cuotas…"
              className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md focus:outline-none focus:border-[var(--ink)] text-[14px]"/>
          </div>

          {/* Monto */}
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

          {/* Categoría + Fecha */}
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

          {/* Tipo + Cuotas */}
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

          {/* Banco + Medio */}
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

          {/* Descripción */}
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
  installmentDebts = [],
}) {
  const categories = useCategories()
  const [items,       setItems]       = useState(loadItems)
  const [editItem,    setEditItem]    = useState(null)
  const [activePeriod, setActivePeriod] = useState(1)   // default: próximo mes

  const persistItems = useCallback(next => { setItems(next); saveItems(next) }, [])

  const usableBalance = useMemo(() => {
    const total    = (accounts ?? []).filter(a => a.active).reduce((s, a) => s + (a.balance || 0), 0)
    const payables = (recurringList ?? []).filter(r => r.active && r.kind === 'payable').reduce((s, r) => s + (r.amount || 0), 0)
    return total - payables
  }, [accounts, recurringList])

  const monthlyIncome = useMemo(() => {
    const rec  = (incomeList ?? []).filter(r => r.active !== false).reduce((s, r) => s + (r.amount || 0), 0)
    const punc = (receivables ?? []).filter(r => r.status !== 'paid').reduce((s, r) => s + (r.amount || 0), 0)
    return rec + punc
  }, [incomeList, receivables])

  const recurringTotal = useMemo(() =>
    (recurringList ?? []).filter(r => r.kind === 'expense' && r.active !== false).reduce((s, r) => s + (r.amount || 0), 0)
  , [recurringList])

  const months = useMemo(() =>
    computeMonths({ usableBalance, monthlyIncome, recurringTotal, installmentDebts, projectedItems: items })
  , [usableBalance, monthlyIncome, recurringTotal, installmentDebts, items])

  const period = months[activePeriod]
  const dispBal = mo => mo.hasSim ? mo.balSim : mo.balBase
  const v  = period ? verdict(dispBal(period), usableBalance) : 'verde'
  const vc = VC[v]

  const recText = period ? (() => {
    const pName = activePeriod === 0 ? 'este mes' : activePeriod === 1 ? 'el próximo mes' : `en ${MES[period.m]}`
    const bal   = dispBal(period)
    if (!period.hasSim)   return `Sin gastos simulados activos, proyectas terminar ${pName} con ${fmtCLP(bal)}.`
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

  const dotCls = v => VC[v].dotCls ?? (v === 'verde' ? 'bg-[var(--accent)]' : v === 'amarillo' ? 'bg-amber-400' : 'bg-red-500')
  const getDot = mo => {
    const vv = verdict(dispBal(mo), usableBalance)
    return vv === 'verde' ? 'bg-[var(--accent)]' : vv === 'amarillo' ? 'bg-amber-400' : 'bg-red-500'
  }

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

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <KpiCard label="Saldo hoy" bal={usableBalance} sub="disponible"/>
        <KpiCard label={MES[months[1].m]} bal={dispBal(months[1])} sub="proyectado" dotCls={getDot(months[1])}/>
        <KpiCard label={MES[months[2].m]} bal={dispBal(months[2])} sub="proyectado" dotCls={getDot(months[2])}/>
      </div>

      {/* Period tabs + detail */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden">
        <div className="flex border-b border-[var(--line)]">
          {months.map((mo, i) => (
            <button key={mo.key} onClick={() => setActivePeriod(i)}
              className={`flex-1 py-2.5 text-[12px] font-medium transition border-b-2 -mb-px flex flex-col items-center gap-0.5
                ${activePeriod === i ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink-2)]'}`}>
              <span>{PERIOD_LABELS[i]}</span>
              <span className="font-normal text-[11px]">{MES[mo.m]}</span>
            </button>
          ))}
        </div>

        {period && (
          <div className="p-4 flex flex-col gap-3">
            {/* Flow breakdown */}
            <div className="flex flex-col gap-2">
              <FlowRow label="Ingresos esperados"   amount={period.income}    type="income"/>
              <FlowRow label="Gastos recurrentes"   amount={period.recurring} type="out"/>
              {period.cuotas > 0 &&
                <FlowRow label="Cuotas comprometidas" amount={period.cuotas}    type="out"/>}
              {period.projOut > 0 && (
                <div className="pt-1.5 border-t border-[var(--line)] mt-0.5">
                  <FlowRow label="Gastos simulados" amount={period.projOut} type="sim"/>
                </div>
              )}
            </div>

            <div className="h-px bg-[var(--line)]"/>

            {/* Result */}
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[12px] text-[var(--muted)]">Saldo al cierre de {MES[period.m]}</div>
                {period.hasSim && period.projOut > 0 && (
                  <div className="text-[11px] text-[var(--muted)] mt-0.5 font-mono">
                    sin simulados: {fmtCLPshort(period.balBase)}
                  </div>
                )}
              </div>
              <div className={`text-[22px] font-mono font-semibold tabular-nums tracking-tight
                ${dispBal(period) < 0 ? 'text-[#C0392B]' : 'text-[var(--ink)]'}`}>
                {fmtCLP(dispBal(period))}
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
