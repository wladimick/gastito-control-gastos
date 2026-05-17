import React, { useState } from 'react'
import { Card, Badge, IconBtn, CatChip, Select } from './ui'
import { Icon, fmtCLP, MES } from '../lib/helpers'
import { CATEGORIES, BANKS, PAYMENT_METHODS } from '../data'

function TabBtn({ active, onClick, label, badge, warn }) {
  return (
    <button onClick={onClick}
      className={`px-3 h-9 inline-flex items-center gap-2 text-[12.5px] rounded-md transition
        ${active ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--ink-2)] hover:bg-[var(--hover)]'}`}>
      <span>{label}</span>
      {badge !== undefined && (
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded
          ${active ? 'bg-[var(--bg)]/15 text-[var(--bg)]' : 'bg-[var(--line)] text-[var(--ink-2)]'}`}>{badge}</span>
      )}
      {warn > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber-ink)]"></span>}
    </button>
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
  name: '', amount: 0, category: 'hogar', bank: 'bchile',
  method: 'tarjeta', type: 'debito', dayOfMonth: 1,
  active: true, autoRegister: false, lastChargedMonth: null,
}

function RecurringForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const valid = f.name.trim() && f.amount > 0

  return (
    <Card padding="p-5" className="border-[var(--ink)]/20">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-4">
        {initial.id ? 'Editar recurrente' : 'Nuevo gasto recurrente'}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Nombre">
          <input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Arriendo, Netflix…"
            className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Monto">
          <input type="number" min="1" value={f.amount} onChange={e => set('amount', Number(e.target.value))}
            className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Día del mes">
          <input type="number" min="1" max="31" value={f.dayOfMonth} onChange={e => set('dayOfMonth', Number(e.target.value))}
            className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Categoría">
          <Select value={f.category} onChange={v => set('category', v)} options={CATEGORIES.map(c => ({ value: c.id, label: c.label }))}/>
        </Field>
        <Field label="Banco">
          <Select value={f.bank} onChange={v => set('bank', v)} options={BANKS.map(b => ({ value: b.id, label: b.label }))}/>
        </Field>
        <Field label="Tipo">
          <div className="grid grid-cols-2 gap-1.5">
            {['debito', 'credito'].map(t => (
              <button key={t} type="button" onClick={() => set('type', t)}
                className={`h-9 rounded-md border text-[12.5px] transition
                  ${f.type === t ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]' : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]'}`}>
                {t === 'debito' ? 'Débito' : 'Crédito'}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] underline">Cancelar</button>
        <button onClick={() => valid && onSave(f)} disabled={!valid}
          className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium disabled:opacity-40">
          <Icon name="check" size={13}/> {initial.id ? 'Guardar cambios' : 'Crear recurrente'}
        </button>
      </div>
    </Card>
  )
}

export default function Recurring({ recurring, setRecurring, income, receivables, onCreateRecurring, onUpdateRecurring, onDeleteRecurring }) {
  const today    = new Date()
  const monthLabel = `${MES[today.getMonth()]} ${today.getFullYear()}`
  const monthStr   = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [tab, setTab] = useState('expenses')
  const [formState, setFormState] = useState(null) // null | { ...blank or item }

  const activeRec         = recurring.filter(r => r.active)
  const totalRecurMonth   = activeRec.reduce((s, r) => s + r.amount, 0)
  const chargedThisMonth  = activeRec.filter(r => r.lastChargedMonth === monthStr)
  const pendingThisMonth  = activeRec.filter(r => r.lastChargedMonth !== monthStr)

  const totalIncomeMonth = (income ?? []).reduce((s, i) => {
    if (i.recurrent) return s + i.amount
    const d = new Date(i.receivedAt)
    if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) return s + i.amount
    return s
  }, 0)

  const pendingReceivables = (receivables ?? []).filter(r => r.status !== 'cobrado')
  const totalPending       = pendingReceivables.reduce((s, r) => s + r.amount, 0)
  const overdueCount       = (receivables ?? []).filter(r => r.status === 'vencido').length
  const balance            = totalIncomeMonth - totalRecurMonth

  const toggleActive = (id) => {
    setRecurring(recurring.map(r => r.id === id ? { ...r, active: !r.active } : r))
  }
  const runNow = (id) => {
    setRecurring(recurring.map(r => r.id === id ? { ...r, lastChargedMonth: monthStr } : r))
  }

  const handleSave = async (form) => {
    if (formState?.id) {
      const updated = { ...form, id: formState.id }
      if (onUpdateRecurring) await onUpdateRecurring(updated)
      else setRecurring(recurring.map(r => r.id === updated.id ? updated : r))
    } else {
      if (onCreateRecurring) await onCreateRecurring(form)
      else setRecurring([...recurring, { ...form, id: 'rc' + Date.now() }])
    }
    setFormState(null)
  }

  const handleDelete = async (id) => {
    if (onDeleteRecurring) await onDeleteRecurring(id)
    else setRecurring(recurring.filter(r => r.id !== id))
  }

  const isSupabase = Boolean(onCreateRecurring)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card padding="p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="arrowup" size={12}/> Ingresos previstos
          </div>
          <div className="mt-2 font-mono text-[26px] tracking-tight text-[var(--accent-ink)]">{fmtCLP(totalIncomeMonth)}</div>
          <div className="mt-1 text-[12px] text-[var(--muted)]">{monthLabel}</div>
        </Card>
        <Card padding="p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="arrowdn" size={12}/> Gastos recurrentes
          </div>
          <div className="mt-2 font-mono text-[26px] tracking-tight">{fmtCLP(totalRecurMonth)}</div>
          <div className="mt-1 text-[12px] text-[var(--muted)]">{activeRec.length} activos · {pendingThisMonth.length} por cargar</div>
        </Card>
        <Card padding="p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="wallet" size={12}/> Balance estimado
          </div>
          <div className={`mt-2 font-mono text-[26px] tracking-tight ${balance < 0 ? 'text-[#A02828]' : ''}`}>{fmtCLP(balance)}</div>
          <div className="mt-1 text-[12px] text-[var(--muted)]">Ingresos − recurrentes</div>
        </Card>
      </div>

      {formState !== null && (
        <RecurringForm
          initial={formState}
          onSave={handleSave}
          onCancel={() => setFormState(null)}
        />
      )}

      <Card padding="p-0" className="overflow-hidden">
        <div className="px-2 pt-2 border-b border-[var(--line)] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <TabBtn active={tab === 'expenses'}    onClick={() => setTab('expenses')}    label="Gastos recurrentes" badge={pendingThisMonth.length}/>
            <TabBtn active={tab === 'income'}      onClick={() => setTab('income')}      label="Ingresos"           badge={(income ?? []).length}/>
            <TabBtn active={tab === 'receivables'} onClick={() => setTab('receivables')} label="Por cobrar"         badge={pendingReceivables.length} warn={overdueCount}/>
          </div>
          {tab === 'expenses' && isSupabase && formState === null && (
            <button onClick={() => setFormState(BLANK)}
              className="mr-2 mb-1 h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[12.5px] font-medium shrink-0">
              <Icon name="plus" size={12}/> Nuevo
            </button>
          )}
        </div>

        {tab === 'expenses' && (
          recurring.length === 0 && isSupabase ? (
            <div className="p-10 text-center">
              <div className="text-[28px] mb-2">🔄</div>
              <div className="font-semibold text-[14px] tracking-tight">Sin gastos recurrentes</div>
              <div className="text-[12.5px] text-[var(--muted)] mt-1 mb-4">Crea tus gastos fijos mensuales: arriendo, servicios, suscripciones.</div>
              <button onClick={() => setFormState(BLANK)}
                className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
                <Icon name="plus" size={13}/> Crear recurrente
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {recurring.map(r => {
                const cat     = CATEGORIES.find(c => c.id === r.category) ?? CATEGORIES[0]
                const bank    = BANKS.find(b => b.id === r.bank)
                const charged = r.lastChargedMonth === monthStr
                return (
                  <li key={r.id} className={`px-5 py-3.5 flex items-center gap-3 ${!r.active ? 'opacity-55' : ''}`}>
                    <div className="w-9 h-9 rounded-md grid place-items-center text-[15px] shrink-0" style={{ background: (cat.color ?? '#888') + '20' }}>{cat.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[14px] truncate">{r.name}</span>
                        {!r.active                && <Badge tone="muted">pausado</Badge>}
                        {r.active &&  charged     && <Badge tone="ok">cobrado este mes</Badge>}
                        {r.active && !charged     && <Badge tone="warn">pendiente</Badge>}
                        {r.autoRegister           && <Badge tone="info">auto</Badge>}
                      </div>
                      <div className="mt-1 text-[11.5px] text-[var(--muted)] flex items-center gap-1.5 flex-wrap">
                        <Icon name="calendar" size={11}/> Día {r.dayOfMonth}
                        <span>·</span><span>{bank?.label}</span>
                        <span>·</span><span>{r.type === 'credito' ? 'Crédito' : 'Débito'}</span>
                      </div>
                    </div>
                    <div className="font-mono text-[15px] tabular-nums shrink-0">{fmtCLP(r.amount)}</div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {r.active && !charged && (
                        <button onClick={() => runNow(r.id)}
                                className="text-[11px] px-2 h-7 rounded-md border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]">
                          Cobrar
                        </button>
                      )}
                      {isSupabase && (
                        <IconBtn name="pencil" label="Editar" tone="outline" onClick={() => setFormState({ ...r })}/>
                      )}
                      <IconBtn name="power" label={r.active ? 'Pausar' : 'Activar'}
                               tone={r.active ? 'outline' : 'ok'} onClick={() => toggleActive(r.id)}/>
                      {isSupabase && (
                        <IconBtn name="trash" label="Eliminar" tone="danger" onClick={() => handleDelete(r.id)}/>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        )}

        {tab === 'income' && (
          <ul className="divide-y divide-[var(--line)]">
            {(income ?? []).map(i => (
              <li key={i.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-md grid place-items-center bg-[var(--accent-soft)] text-[var(--accent-ink)] shrink-0">
                  <Icon name="arrowup" size={15}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[14px] truncate">{i.source}</span>
                    {i.recurrent ? <Badge tone="ok">mensual · día {i.dayOfMonth}</Badge> : <Badge tone="muted">puntual</Badge>}
                  </div>
                  <div className="mt-1 text-[11.5px] text-[var(--muted)]">{i.notes}</div>
                </div>
                <div className="font-mono text-[15px] tabular-nums shrink-0 text-[var(--accent-ink)]">+{fmtCLP(i.amount)}</div>
              </li>
            ))}
            {(income ?? []).length === 0 && (
              <li className="px-5 py-8 text-center text-[13px] text-[var(--muted)]">Sin ingresos configurados</li>
            )}
            <li className="px-5 py-3">
              <button className="w-full text-left text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] inline-flex items-center gap-1.5">
                <Icon name="plus" size={13}/> Agregar ingreso
              </button>
            </li>
          </ul>
        )}

        {tab === 'receivables' && (
          <ul className="divide-y divide-[var(--line)]">
            {(receivables ?? []).map(r => {
              const due      = new Date(r.dueDate)
              const isOverdue = r.status === 'vencido'
              const isPaid    = r.status === 'cobrado'
              const dueDiff   = Math.round((due - today) / 86400000)
              return (
                <li key={r.id} className={`px-5 py-3.5 flex items-center gap-3 ${isPaid ? 'opacity-50' : ''}`}>
                  <div className={`w-9 h-9 rounded-md grid place-items-center shrink-0
                    ${isPaid    ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                    : isOverdue ? 'bg-[#FDECEC] text-[#A02828]'
                                : 'bg-[var(--bg)] text-[var(--ink-2)] border border-[var(--line)]'}`}>
                    {isPaid ? <Icon name="check" size={15}/> : <span className="text-[10px] font-mono uppercase">{r.debtor?.slice(0, 2)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[14px]">{r.debtor}</span>
                      {isOverdue              && <Badge tone="warn">vencido</Badge>}
                      {isPaid                 && <Badge tone="ok">cobrado</Badge>}
                      {!isPaid && !isOverdue && dueDiff <= 3 && <Badge tone="warn">por vencer</Badge>}
                    </div>
                    <div className="mt-1 text-[11.5px] text-[var(--muted)]">
                      {r.description} · {dueDiff > 0 ? `vence en ${dueDiff} días` : (dueDiff === 0 ? 'vence hoy' : `vencido hace ${-dueDiff} días`)}
                    </div>
                  </div>
                  <div className="font-mono text-[15px] tabular-nums shrink-0">{fmtCLP(r.amount)}</div>
                </li>
              )
            })}
            {(receivables ?? []).length === 0 && (
              <li className="px-5 py-8 text-center text-[13px] text-[var(--muted)]">Sin cuentas por cobrar</li>
            )}
            {pendingReceivables.length > 0 && (
              <li className="px-5 py-3 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--muted)]">Total pendiente</span>
                <span className="font-mono">{fmtCLP(totalPending)}</span>
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  )
}
