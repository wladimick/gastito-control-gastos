import React, { useState, useMemo, useEffect } from 'react'
import { Card, Badge, Select } from './ui'
import { Icon, fmtCLP, fmtCLPshort, MES } from '../lib/helpers'
import { CATEGORIES, BANKS } from '../data'

const AUTO_PAY_DAY = 5

function parseYM(s) { const [y, m] = s.split('-').map(Number); return { y, m: m - 1 } }
function addMonths(y, m, n) {
  const date = new Date(y, m + n, 1)
  return { y: date.getFullYear(), m: date.getMonth() }
}
function ymKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}` }
function diffMonths(fromY, fromM, toY, toM) { return (toY - fromY) * 12 + (toM - fromM) }

function expandSchedule(debt) {
  const { y, m } = parseYM(debt.startMonth)
  const out = []
  for (let i = 0; i < debt.installments; i++) {
    const next = addMonths(y, m, i)
    out.push({
      debtId: debt.id, description: debt.description,
      n: i + 1, total: debt.installments,
      monthKey: ymKey(next.y, next.m),
      y: next.y, m: next.m,
      day: debt.dayOfMonth, amount: debt.monthlyAmount,
      paid: i < debt.paid, bank: debt.bank, category: debt.category,
    })
  }
  return out
}

function autoPaidCount(debt, today) {
  if (!debt.autoPay) return debt.paid
  const { y, m } = parseYM(debt.startMonth)
  const monthsSinceStart = diffMonths(y, m, today.getFullYear(), today.getMonth())
  if (monthsSinceStart < 0) return 0
  const includesCurrent = today.getDate() >= AUTO_PAY_DAY ? 1 : 0
  return Math.min(debt.installments, monthsSinceStart + includesCurrent)
}

function KPI({ label, value, sub, icon }) {
  return (
    <Card padding="p-4">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</div>
        {icon && <span className="text-[var(--muted)]"><Icon name={icon} size={14}/></span>}
      </div>
      <div className="mt-2 font-mono text-[22px] md:text-[24px] tracking-tight leading-none">{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px] text-[var(--muted)]">{sub}</div>}
    </Card>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">{label}</span>
      {children}
    </label>
  )
}

const BLANK = {
  description: '', total: 0, installments: 12, paid: 0,
  monthlyAmount: 0, category: 'otros', bank: 'bchile',
  dayOfMonth: 5, startMonth: new Date().toISOString().slice(0, 7),
  autoPay: false, status: 'active',
}

function InstallmentForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const valid = f.description.trim() && f.total > 0 && f.installments >= 1

  // Auto-compute monthly amount
  useEffect(() => {
    if (f.total > 0 && f.installments > 0) {
      set('monthlyAmount', Math.round(f.total / f.installments))
    }
  }, [f.total, f.installments])

  return (
    <Card padding="p-5" className="border-[var(--ink)]/20">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-4">
        {initial.id ? 'Editar cuota' : 'Nueva deuda en cuotas'}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Descripción">
          <input value={f.description} onChange={e => set('description', e.target.value)} placeholder="MacBook Air…"
            className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Monto total">
          <input type="number" min="1" value={f.total} onChange={e => set('total', Number(e.target.value))}
            className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Nº cuotas">
          <input type="number" min="1" max="60" value={f.installments} onChange={e => set('installments', Number(e.target.value))}
            className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label={`Monto/cuota ≈ $${(f.total / Math.max(1, f.installments)).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`}>
          <input type="number" min="1" value={f.monthlyAmount} onChange={e => set('monthlyAmount', Number(e.target.value))}
            className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Cuotas pagadas">
          <input type="number" min="0" max={f.installments} value={f.paid} onChange={e => set('paid', Number(e.target.value))}
            className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Día de cobro">
          <input type="number" min="1" max="31" value={f.dayOfMonth} onChange={e => set('dayOfMonth', Number(e.target.value))}
            className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Categoría">
          <Select value={f.category} onChange={v => set('category', v)} options={CATEGORIES.map(c => ({ value: c.id, label: c.label }))}/>
        </Field>
        <Field label="Banco">
          <Select value={f.bank} onChange={v => set('bank', v)} options={BANKS.map(b => ({ value: b.id, label: b.label }))}/>
        </Field>
        <Field label="Mes de inicio">
          <input type="month" value={f.startMonth} onChange={e => set('startMonth', e.target.value)}
            className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] underline">Cancelar</button>
        <button onClick={() => valid && onSave(f)} disabled={!valid}
          className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium disabled:opacity-40">
          <Icon name="check" size={13}/> {initial.id ? 'Guardar cambios' : 'Crear cuota'}
        </button>
      </div>
    </Card>
  )
}

export default function Installments({ debts, setDebts, recurring = [], onCreateInstallment, onUpdateInstallment, onDeleteInstallment }) {
  const today = new Date()
  const curY = today.getFullYear(), curM = today.getMonth()
  const curKey = ymKey(curY, curM)
  const [formState, setFormState] = useState(null)
  const [expandedDebt, setExpandedDebt] = useState(null)

  useEffect(() => {
    let needsUpdate = false
    const updated = debts.map(d => {
      const auto = autoPaidCount(d, today)
      if (auto > d.paid) {
        needsUpdate = true
        const newPaid = auto
        return { ...d, paid: newPaid, status: newPaid >= d.installments ? 'paid' : d.status }
      }
      return d
    })
    if (needsUpdate) setDebts(updated)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allCuotas = useMemo(() => debts.flatMap(d => expandSchedule(d).map(c => ({ ...c, debt: d }))), [debts])
  const activeRecurring = (recurring ?? []).filter(r => r.active)

  const active         = debts.filter(d => d.status === 'active')
  const totalRemaining = active.reduce((s, d) => s + d.monthlyAmount * (d.installments - d.paid), 0)
  const totalCommitted = active.reduce((s, d) => s + d.total, 0)
  const monthlyNow     = allCuotas.filter(c => c.monthKey === curKey && !c.paid).reduce((s, c) => s + c.amount, 0)
  const monthlyAvg6    = (() => {
    let total = 0
    for (let i = 0; i < 6; i++) {
      const { y, m } = addMonths(curY, curM, i)
      const key = ymKey(y, m)
      total += allCuotas.filter(c => c.monthKey === key && !c.paid).reduce((s, c) => s + c.amount, 0)
    }
    return total / 6
  })()
  const activeCuotasCount = allCuotas.filter(c => !c.paid && new Date(c.y, c.m, 1) >= new Date(curY, curM, 1)).length

  const upcomingMonths = useMemo(() => {
    const months = []
    for (let i = 0; i < 6; i++) {
      const { y, m } = addMonths(curY, curM, i)
      const key      = ymKey(y, m)
      const cuotas   = allCuotas.filter(c => c.monthKey === key && !c.paid).sort((a, b) => a.day - b.day)
      const recCharges = activeRecurring.map(r => ({
        kind: 'recurring', debtId: r.id, description: r.name,
        amount: r.amount, day: r.dayOfMonth, bank: r.bank, category: r.category,
      })).sort((a, b) => a.day - b.day)
      const cuotaTotal = cuotas.reduce((s, c) => s + c.amount, 0)
      const recTotal   = recCharges.reduce((s, c) => s + c.amount, 0)
      months.push({ y, m, key, cuotas, recCharges, cuotaTotal, recTotal, total: cuotaTotal + recTotal })
    }
    return months
  }, [allCuotas, activeRecurring])

  const maxMonthTotal = Math.max(1, ...upcomingMonths.map(m => m.total))

  const markCuotaPaid = (debtId) => {
    const updated = debts.map(d => d.id === debtId ? {
      ...d,
      paid: Math.min(d.installments, d.paid + 1),
      status: d.paid + 1 >= d.installments ? 'paid' : 'active',
    } : d)
    setDebts(updated)
  }

  const isSupabase = Boolean(onCreateInstallment)

  const handleSave = async (form) => {
    if (formState?.id) {
      const updated = { ...form, id: formState.id }
      if (onUpdateInstallment) await onUpdateInstallment(updated)
      else setDebts(debts.map(d => d.id === updated.id ? updated : d))
    } else {
      if (onCreateInstallment) await onCreateInstallment(form)
      else setDebts([...debts, { ...form, id: 'ic' + Date.now() }])
    }
    setFormState(null)
  }

  const handleDelete = async (id) => {
    if (onDeleteInstallment) await onDeleteInstallment(id)
    else setDebts(debts.filter(d => d.id !== id))
  }

  if (debts.length === 0 && isSupabase && formState === null) {
    return (
      <div className="flex flex-col gap-5">
        <Card padding="p-12" className="text-center">
          <div className="text-[32px] mb-3">💳</div>
          <div className="font-semibold text-[15px] tracking-tight">Sin deudas en cuotas</div>
          <div className="text-[13px] text-[var(--muted)] mt-1 mb-4">Registra compras en cuotas para hacer seguimiento mes a mes.</div>
          <button onClick={() => setFormState({ ...BLANK, startMonth: new Date().toISOString().slice(0, 7) })}
            className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
            <Icon name="plus" size={13}/> Registrar cuota
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-ink)] border border-[var(--accent-soft)]">
        <div className="w-8 h-8 rounded-md bg-[var(--accent)] text-white grid place-items-center shrink-0">
          <Icon name="repeat" size={14}/>
        </div>
        <div className="flex-1 min-w-0 text-[12.5px] leading-snug">
          <span className="font-semibold">Auto-pago activo</span> · Las cuotas se cobran el{' '}
          <span className="font-mono font-semibold">día {AUTO_PAY_DAY}</span> de cada mes.
        </div>
        {isSupabase && (
          <button onClick={() => setFormState({ ...BLANK, startMonth: new Date().toISOString().slice(0, 7) })}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[12px] font-medium shrink-0">
            <Icon name="plus" size={12}/> Nueva cuota
          </button>
        )}
      </div>

      {formState !== null && (
        <InstallmentForm
          initial={formState}
          onSave={handleSave}
          onCancel={() => setFormState(null)}
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPI label="Deuda restante"       value={fmtCLP(totalRemaining)}  sub={`de ${fmtCLP(totalCommitted)} comprometidos`} icon="layers"/>
        <KPI label="Cuotas este mes"      value={fmtCLP(monthlyNow)}      sub={`${MES[curM]} ${curY}`}                      icon="calendar"/>
        <KPI label="Promedio próximos 6m" value={fmtCLP(monthlyAvg6)}     sub="solo cuotas"                                 icon="trend"/>
        <KPI label="Cuotas pendientes"    value={activeCuotasCount}       sub={`en ${active.length} deudas`}                icon="card"/>
      </div>

      <Card padding="p-0">
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <div>
            <div className="font-semibold tracking-tight">Deudas en cuotas</div>
            <div className="text-[12px] text-[var(--muted)] mt-0.5">
              {active.length} activas · {debts.filter(d => d.status === 'paid').length} pagadas
            </div>
          </div>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {debts.map(d => {
            const cat       = CATEGORIES.find(c => c.id === d.category) ?? CATEGORIES.find(c => c.id === 'otros') ?? CATEGORIES[0]
            const bank      = BANKS.find(b => b.id === d.bank)
            const remaining = d.monthlyAmount * (d.installments - d.paid)
            const isExpanded = expandedDebt === d.id
            const schedule   = expandSchedule(d)
            const nextPending = schedule.find(c => !c.paid)
            const isPaid      = d.status === 'paid'
            return (
              <li key={d.id} className={isPaid ? 'opacity-60' : ''}>
                <div className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md grid place-items-center text-[15px] shrink-0" style={{ background: (cat.color ?? '#888') + '20' }}>{cat.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[14px]">{d.description}</span>
                        {isPaid                                   && <Badge tone="ok">pagada</Badge>}
                        {!isPaid && nextPending?.monthKey === curKey && <Badge tone="warn">cae este mes</Badge>}
                      </div>
                      <div className="mt-1 text-[11.5px] text-[var(--muted)] flex items-center gap-1.5 flex-wrap">
                        <span>{bank?.label}</span><span>·</span>
                        <span>día {d.dayOfMonth} de cada mes</span>
                        {nextPending && <><span>·</span><span>próxima: {MES[nextPending.m]} {nextPending.y}</span></>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <div className="font-mono text-[14px] tabular-nums">{fmtCLP(d.monthlyAmount)}</div>
                        <div className="text-[11px] text-[var(--muted)] font-mono">/cuota</div>
                      </div>
                      {isSupabase && (
                        <>
                          <button onClick={() => setFormState({ ...d })}
                            className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[var(--muted)]">
                            <Icon name="pencil" size={12}/>
                          </button>
                          <button onClick={() => handleDelete(d.id)}
                            className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[#A02828]">
                            <Icon name="trash" size={12}/>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 items-center">
                    <div>
                      <div className="flex items-center gap-[3px] mb-1.5">
                        {Array.from({ length: d.installments }).map((_, i) => (
                          <div key={i} className="flex-1 h-1.5 rounded-sm"
                               style={{ background: i < d.paid ? 'var(--ink)' : 'var(--line)' }}/>
                        ))}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] font-mono flex items-center gap-2">
                        <span>{d.paid}/{d.installments} cuotas</span>
                        <span>·</span>
                        <span>quedan {fmtCLP(remaining)} de {fmtCLP(d.total)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!isPaid && (
                        <button onClick={() => markCuotaPaid(d.id)}
                          className="text-[11px] px-2 h-7 rounded-md border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)] inline-flex items-center gap-1">
                          <Icon name="check" size={11}/> Marcar pagada
                        </button>
                      )}
                      <button onClick={() => setExpandedDebt(isExpanded ? null : d.id)}
                              className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[var(--muted)]">
                        <Icon name={isExpanded ? 'x' : 'chevdown'} size={13}/>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-[var(--line)] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {schedule.map(c => (
                        <div key={c.n}
                             className={`rounded-md border px-2.5 py-2 text-[12px] flex flex-col gap-0.5
                               ${c.paid          ? 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)]'
                               : c.monthKey === curKey ? 'bg-[var(--amber-soft)] border-[var(--amber-soft)] text-[var(--amber-ink)]'
                                                 : 'bg-[var(--bg-elev)] border-[var(--line)] text-[var(--ink-2)]'}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px]">#{c.n}/{c.total}</span>
                            {c.paid && <Icon name="check" size={10}/>}
                          </div>
                          <div className="font-mono text-[12px] tabular-nums">{fmtCLP(c.amount)}</div>
                          <div className="text-[10.5px]">{MES[c.m]} {c.y}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card padding="p-0">
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold tracking-tight">Próximos meses</div>
            <div className="text-[12px] text-[var(--muted)] mt-0.5">Cuotas y cargos recurrentes</div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--ink)]"/> Cuotas</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--accent)]"/> Recurrentes</span>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
            {upcomingMonths.map((mo, i) => {
              const isCurrent = i === 0
              const totalH  = maxMonthTotal > 0 ? (mo.total / maxMonthTotal) * 100 : 0
              const cuotaH  = mo.total > 0 ? (mo.cuotaTotal / mo.total) * totalH : 0
              const recH    = mo.total > 0 ? (mo.recTotal   / mo.total) * totalH : 0
              return (
                <div key={mo.key} className={`rounded-lg border p-3 flex flex-col gap-2 ${isCurrent ? 'border-[var(--ink)] bg-[var(--bg)]' : 'border-[var(--line)] bg-[var(--bg-elev)]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">{MES[mo.m]} {mo.y}</div>
                    {isCurrent && <Badge tone="dark" className="!text-[9px]">actual</Badge>}
                  </div>
                  <div className="font-mono text-[16px] tracking-tight">{fmtCLPshort(mo.total)}</div>
                  <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden flex">
                    <div className="h-full bg-[var(--ink)]"    style={{ width: cuotaH + '%' }}/>
                    <div className="h-full bg-[var(--accent)]" style={{ width: recH   + '%' }}/>
                  </div>
                  <div className="text-[10.5px] text-[var(--muted)] font-mono flex items-center justify-between">
                    <span>{mo.cuotas.length} cuotas</span>
                    <span>{mo.recCharges.length} rec.</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-[var(--line)] divide-y divide-[var(--line)]">
          {upcomingMonths.map((mo, i) => (
            <details key={mo.key} className="group" open={i < 2}>
              <summary className="px-5 py-3 cursor-pointer flex items-center justify-between hover:bg-[var(--hover)]">
                <div className="flex items-center gap-3">
                  <Icon name="chevron" size={14} className="group-open:rotate-90 transition"/>
                  <span className="font-medium text-[13.5px]">{MES[mo.m]} {mo.y}</span>
                  {i === 0 && <Badge tone="dark" className="!text-[10px]">este mes</Badge>}
                  <span className="text-[12px] text-[var(--muted)]">{mo.cuotas.length + mo.recCharges.length} cargos</span>
                </div>
                <span className="font-mono text-[14px] tabular-nums">{fmtCLP(mo.total)}</span>
              </summary>

              {(mo.cuotas.length > 0 || mo.recCharges.length > 0) && (
                <div className="bg-[var(--bg)] px-5 py-1">
                  <ul className="divide-y divide-[var(--line)]">
                    {[
                      ...mo.cuotas.map(c => ({ ...c, kind: 'cuota' })),
                      ...mo.recCharges.map(c => ({ ...c, kind: 'rec' })),
                    ].sort((a, b) => a.day - b.day).map((it, idx) => {
                      const cat  = CATEGORIES.find(c => c.id === it.category) ?? CATEGORIES[0]
                      const bank = BANKS.find(b => b.id === it.bank)
                      return (
                        <li key={idx} className="py-2.5 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md grid place-items-center text-[var(--muted)] font-mono text-[11px] shrink-0 bg-[var(--bg-elev)] border border-[var(--line)]">
                            {String(it.day).padStart(2, '0')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-medium">{it.description}</span>
                              {it.kind === 'cuota'
                                ? <Badge tone="muted" className="!text-[10px] font-mono">#{it.n}/{it.total}</Badge>
                                : <Badge tone="ok" className="!text-[10px]">recurrente</Badge>}
                            </div>
                            <div className="text-[11px] text-[var(--muted)] mt-0.5 flex items-center gap-1.5">
                              <span>{cat?.label}</span><span>·</span><span>{bank?.label}</span>
                            </div>
                          </div>
                          <div className="font-mono text-[13px] tabular-nums shrink-0">{fmtCLP(it.amount)}</div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </details>
          ))}
        </div>
      </Card>
    </div>
  )
}
