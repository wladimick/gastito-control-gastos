import React, { useState } from 'react'
import { Card, Badge, IconBtn, Select } from './ui'
import { Icon, fmtCLP, MES } from '../lib/helpers'
import { useBanks } from '../services/banksService'
import { useCategories } from '../services/categoriesService'

function ModalShell({ title, onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}/>
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-full md:max-w-xl
                        max-h-[90vh] md:max-h-[85vh]
                        rounded-t-2xl md:rounded-xl
                        bg-[var(--bg)] flex flex-col overflow-hidden shadow-2xl"
             style={{ animation: 'slideUpR .22s ease-out' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)] shrink-0">
            <div className="font-semibold tracking-tight">{title}</div>
            <button type="button" onClick={onClose}
              className="w-8 h-8 rounded-md hover:bg-[var(--hover)] grid place-items-center">
              <Icon name="x" size={15}/>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
      <style>{`@keyframes slideUpR{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  )
}

function TabBtn({ active, onClick, label, badge, warn }) {
  return (
    <button onClick={onClick}
      className={`px-3 h-9 inline-flex items-center gap-2 text-[12.5px] rounded-md transition
        ${active ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--ink-2)] hover:bg-[var(--hover)]'}`}>
      <span>{label}</span>
      {badge > 0 && (
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded
          ${active ? 'bg-[var(--bg)]/15 text-[var(--bg)]' : 'bg-[var(--line)] text-[var(--ink-2)]'}`}>{badge}</span>
      )}
      {warn > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber-ink)]"/>}
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

const inp = "w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"

const MEDIOS_LABEL = {
  cta_corriente: 'Cta. corriente',
  tc_credito:    'Tarjeta crédito',
  tc_debito:     'Tarjeta débito',
  otro:          'Otro',
}

function fmtLocalDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

function nextChargeDate(r, today = new Date()) {
  const dom     = Number(r.dayOfMonth) || 1
  const todayYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  if (r.startDate) {
    const startYM = r.startDate.slice(0, 7)
    if (startYM > todayYM) {
      const [sy, sm] = startYM.split('-').map(Number)
      return new Date(sy, sm - 1, dom)
    }
  }
  if (dom > today.getDate()) return new Date(today.getFullYear(), today.getMonth(), dom)
  return new Date(today.getFullYear(), today.getMonth() + 1, dom)
}

function fmtNextCharge(r, today) {
  const d = nextChargeDate(r, today)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// ── Expense/Income form ───────────────────────────────────────

const BLANK_EXPENSE = {
  name: '', amount: '', category: 'hogar', bank: 'bchile',
  method: 'tarjeta', type: 'debito', dayOfMonth: '',
  startDate: new Date().toISOString().slice(0, 10), endDate: '',
  active: true, autoRegister: false, lastChargedMonth: null, kind: 'expense',
  comisionBancaria: false, medio: '',
}
const BLANK_INCOME = {
  name: '', amount: '', category: 'sueldo', bank: '',
  method: 'transfer', type: 'debito', dayOfMonth: '',
  startDate: new Date().toISOString().slice(0, 10), endDate: '',
  active: true, autoRegister: true, lastChargedMonth: null, kind: 'income',
}

function RecurringForm({ initial, onSave, onCancel, banks, bare = false }) {
  const categories = useCategories()
  const [f, setF] = useState(initial)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const isIncome = f.kind === 'income'
  const valid = f.name.trim() && Number(f.amount) > 0

  const inner = (
    <>
      {!bare && (
        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-4">
          {initial.id
            ? (isIncome ? 'Editar ingreso' : 'Editar gasto recurrente')
            : (isIncome ? 'Nuevo ingreso recurrente' : 'Nuevo gasto recurrente')}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label={isIncome ? 'Fuente / Nombre' : 'Nombre'}>
          <input value={f.name} onChange={e => set('name', e.target.value)}
            placeholder={isIncome ? 'Sueldo, Bono…' : 'Arriendo, Netflix…'}
            className={inp}/>
        </Field>
        <Field label="Monto">
          <input type="text" inputMode="numeric" value={f.amount} onChange={e => set('amount', e.target.value)}
            placeholder="0" className={inp + ' font-mono'}/>
        </Field>
        <Field label="Día del mes">
          <input type="text" inputMode="numeric" value={f.dayOfMonth} onChange={e => set('dayOfMonth', e.target.value)}
            placeholder="1" className={inp + ' font-mono'}/>
        </Field>
        <Field label="Inicia">
          <input type="date" value={f.startDate || ''} onChange={e => set('startDate', e.target.value)}
            className={inp}/>
        </Field>
        <Field label="Termina (opcional)">
          <input type="date" value={f.endDate || ''} onChange={e => set('endDate', e.target.value)}
            className={inp}/>
        </Field>
        <Field label="Categoría">
          <Select value={f.category} onChange={v => set('category', v)} options={categories.map(c => ({ value: c.id, label: c.label }))}/>
        </Field>
        {!isIncome && (
          <Field label="Banco">
            <Select value={f.bank} onChange={v => set('bank', v)} options={banks.map(b => ({ value: b.id, label: b.label }))}/>
          </Field>
        )}
        {!isIncome && (
          <Field label="Tipo de gasto">
            <div className="grid grid-cols-2 gap-1.5">
              {[false, true].map(isCom => (
                <button key={String(isCom)} type="button" onClick={() => set('comisionBancaria', isCom)}
                  className={`h-9 rounded-md border text-[12.5px] transition
                    ${f.comisionBancaria === isCom
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]'
                      : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]'}`}>
                  {isCom ? 'Comisión' : 'Gasto fijo'}
                </button>
              ))}
            </div>
          </Field>
        )}
        {!isIncome && f.comisionBancaria && (
          <Field label="Medio asociado">
            <Select value={f.medio || ''} onChange={v => set('medio', v)} options={[
              { value: '',            label: 'Sin especificar' },
              { value: 'cta_corriente', label: 'Cuenta corriente' },
              { value: 'tc_credito',    label: 'Tarjeta crédito' },
              { value: 'tc_debito',     label: 'Tarjeta débito' },
              { value: 'otro',          label: 'Otro' },
            ]}/>
          </Field>
        )}
        {isIncome ? (
          <Field label="Método">
            <Select value={f.method} onChange={v => set('method', v)} options={[
              { value: 'transfer', label: 'Transferencia' },
              { value: 'tarjeta',  label: 'Tarjeta' },
              { value: 'efectivo', label: 'Efectivo' },
            ]}/>
          </Field>
        ) : (
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
        )}
        <Field label="Modo">
          <div className="grid grid-cols-2 gap-1.5">
            {[true, false].map(auto => (
              <button key={String(auto)} type="button" onClick={() => set('autoRegister', auto)}
                className={`h-9 rounded-md border text-[12.5px] transition
                  ${f.autoRegister === auto ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]' : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]'}`}>
                {auto ? 'Automático' : 'Manual'}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        {!bare && <button onClick={onCancel} className="text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] underline">Cancelar</button>}
        <button onClick={() => valid && onSave(f)} disabled={!valid}
          className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium disabled:opacity-40">
          <Icon name="check" size={13}/> {initial.id ? 'Guardar cambios' : (isIncome ? 'Crear ingreso' : 'Crear recurrente')}
        </button>
      </div>
    </>
  )
  if (bare) return inner
  return <Card padding="p-5" className="border-[var(--ink)]/20">{inner}</Card>
}

// ── Receivable / Payable form ─────────────────────────────────

function BLANK_RELATION(kind) {
  return {
    name: '', personName: '', description: '', amount: '',
    dueDate: '', category: kind === 'payable' ? 'por_pagar' : 'por_cobrar',
    notes: '', status: 'pending', active: true, autoRegister: false, kind,
  }
}

function RelationForm({ initial, onSave, onCancel, bare = false }) {
  const categories = useCategories()
  const [f, setF] = useState(initial)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const isPayable = f.kind === 'payable'
  const valid = (f.personName || f.name).trim() && Number(f.amount) > 0

  const inner = (
    <>
      {!bare && (
        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-4">
          {initial.id
            ? (isPayable ? 'Editar deuda' : 'Editar por cobrar')
            : (isPayable ? 'Nueva deuda personal' : 'Nuevo por cobrar')}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label={isPayable ? 'A quién le debo' : 'Quién me debe'}>
          <input value={f.personName} onChange={e => { set('personName', e.target.value); set('name', e.target.value) }}
            placeholder={isPayable ? 'Papá, María…' : 'Juan, Empresa…'}
            className={inp}/>
        </Field>
        <Field label="Monto">
          <input type="text" inputMode="numeric" value={f.amount} onChange={e => set('amount', e.target.value)}
            placeholder="0" className={inp + ' font-mono'}/>
        </Field>
        <Field label="Fecha esperada">
          <input type="date" value={f.dueDate} onChange={e => set('dueDate', e.target.value)}
            className={inp}/>
        </Field>
        <Field label="Descripción">
          <input value={f.description} onChange={e => set('description', e.target.value)}
            placeholder={isPayable ? 'Motivo del préstamo…' : 'Qué me deben…'}
            className={inp}/>
        </Field>
        <Field label="Categoría">
          <Select value={f.category} onChange={v => set('category', v)} options={categories.map(c => ({ value: c.id, label: c.label }))}/>
        </Field>
        <Field label="Modo">
          <div className="grid grid-cols-2 gap-1.5">
            {[false, true].map(auto => (
              <button key={String(auto)} type="button" onClick={() => set('autoRegister', auto)}
                className={`h-9 rounded-md border text-[12.5px] transition
                  ${f.autoRegister === auto ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]' : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]'}`}>
                {auto ? 'Automático' : 'Manual'}
              </button>
            ))}
          </div>
        </Field>
        <div className="md:col-span-3">
          <Field label="Nota">
            <input value={f.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Notas opcionales…"
              className={inp}/>
          </Field>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        {!bare && <button onClick={onCancel} className="text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] underline">Cancelar</button>}
        <button onClick={() => valid && onSave(f)} disabled={!valid}
          className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium disabled:opacity-40">
          <Icon name="check" size={13}/> {initial.id ? 'Guardar cambios' : (isPayable ? 'Registrar deuda' : 'Registrar por cobrar')}
        </button>
      </div>
    </>
  )
  if (bare) return inner
  return <Card padding="p-5" className="border-[var(--ink)]/20">{inner}</Card>
}

// ── Relation list row ─────────────────────────────────────────

function RelationRow({ item, onMarkPaid, onEdit, onDelete, isSupabase }) {
  const today      = new Date()
  const categories = useCategories()
  const due        = item.dueDate ? new Date(item.dueDate) : null
  const isPaid     = item.status === 'paid'
  const isOverdue  = !isPaid && due && due < today
  const dueDiff    = due ? Math.round((due - today) / 86400000) : null
  const cat        = categories.find(c => c.id === item.category)

  return (
    <li className={`px-5 py-3.5 flex items-center gap-3 ${isPaid ? 'opacity-50' : ''}`}>
      <div className="w-9 h-9 rounded-md grid place-items-center text-[14px] shrink-0" style={{ background: (cat?.color ?? '#888') + '20' }}>
        {cat?.icon ?? '•'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-[14px] truncate">{item.personName || item.name}</span>
          {isPaid    && <Badge tone="ok">pagado</Badge>}
          {isOverdue && !isPaid && <Badge tone="warn">vencido</Badge>}
          {!isPaid && !isOverdue && due && dueDiff !== null && dueDiff <= 3 && <Badge tone="warn">por vencer</Badge>}
          {item.autoRegister && <Badge tone="info">auto</Badge>}
        </div>
        <div className="mt-0.5 text-[11.5px] text-[var(--muted)]">
          {item.description && <span>{item.description} · </span>}
          {due && (
            <span>
              {isPaid ? (item.paidAt ? `Pagado ${new Date(item.paidAt).toLocaleDateString('es-CL')}` : 'Pagado')
                : dueDiff === 0 ? 'Vence hoy'
                : dueDiff > 0  ? `Vence en ${dueDiff} días`
                               : `Venció hace ${-dueDiff} días`}
            </span>
          )}
          {item.notes && <span> · {item.notes}</span>}
        </div>
      </div>
      <div className="font-mono text-[15px] tabular-nums shrink-0">{fmtCLP(item.amount)}</div>
      <div className="flex items-center gap-0.5 shrink-0">
        {!isPaid && (
          <button onClick={() => onMarkPaid(item.id)}
            className="text-[11px] px-2 h-7 rounded-md border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]">
            Pagado
          </button>
        )}
        {isSupabase && <IconBtn name="pencil" label="Editar" tone="outline" onClick={() => onEdit(item)}/>}
        {isSupabase && <IconBtn name="trash"  label="Eliminar" tone="danger" onClick={() => onDelete(item.id)}/>}
      </div>
    </li>
  )
}

// ── Main component ────────────────────────────────────────────

export default function Recurring({
  // Expenses
  recurring, setRecurring,
  onCreateRecurring, onUpdateRecurring, onDeleteRecurring,
  // Income
  incomeList, onCreateIncome, onUpdateIncome, onDeleteIncome,
  // Receivables
  receivablesList, onCreateReceivable, onUpdateReceivable, onDeleteReceivable, onMarkReceivablePaid,
  // Payables
  payablesList, onCreatePayable, onUpdatePayable, onDeletePayable, onMarkPayablePaid,
  // Settings
  salaryPaymentDay,
}) {
  const banks      = useBanks()
  const categories = useCategories()
  const today     = new Date()
  const monthLabel = `${MES[today.getMonth()]} ${today.getFullYear()}`
  const monthStr   = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [tab, setTab]           = useState('expenses')
  const [formState, setFormState] = useState(null)

  const income_     = incomeList     ?? []
  const receivables = receivablesList ?? []
  const payables    = payablesList   ?? []

  const activeRec        = recurring.filter(r => r.active)
  const totalRecurMonth  = activeRec.reduce((s, r) => s + r.amount, 0)
  const chargedThisMonth = activeRec.filter(r => r.lastChargedMonth === monthStr)
  const pendingThisMonth = activeRec.filter(r => r.lastChargedMonth !== monthStr)

  const comisiones       = activeRec.filter(r => r.comisionBancaria)
  const totalComisiones  = comisiones.reduce((s, r) => s + r.amount, 0)

  const totalIncomeMonth  = income_.filter(i => i.active).reduce((s, i) => s + i.amount, 0)
  const balance           = totalIncomeMonth - totalRecurMonth

  const pendingReceivables = receivables.filter(r => r.status !== 'paid')
  const totalReceivable    = pendingReceivables.reduce((s, r) => s + r.amount, 0)
  const overdueReceivable  = pendingReceivables.filter(r => r.status === 'overdue' || (r.dueDate && new Date(r.dueDate) < today)).length

  const pendingPayables    = payables.filter(p => p.status !== 'paid')
  const totalPayable       = pendingPayables.reduce((s, p) => s + p.amount, 0)
  const overduePayable     = pendingPayables.filter(p => p.status === 'overdue' || (p.dueDate && new Date(p.dueDate) < today)).length

  const isSupabaseExp = Boolean(onCreateRecurring)
  const isSupabaseInc = Boolean(onCreateIncome)
  const isSupabaseRec = Boolean(onCreateReceivable)
  const isSupabasePay = Boolean(onCreatePayable)

  const toggleActive = (id) => {
    setRecurring(recurring.map(r => r.id === id ? { ...r, active: !r.active } : r))
  }
  const runNow = (id) => {
    setRecurring(recurring.map(r => r.id === id ? { ...r, lastChargedMonth: monthStr } : r))
  }

  const handleSaveExpense = async (form) => {
    const toSave = {
      ...form,
      amount:     Number(form.amount) || 0,
      dayOfMonth: Number(form.dayOfMonth) || 1,
      startDate:  form.startDate || null,
      endDate:    form.endDate   || null,
    }
    if (formState?.id) {
      const updated = { ...toSave, id: formState.id }
      if (onUpdateRecurring) await onUpdateRecurring(updated)
      else setRecurring(recurring.map(r => r.id === updated.id ? updated : r))
    } else {
      if (onCreateRecurring) await onCreateRecurring({ ...toSave, kind: 'expense' })
      else setRecurring([...recurring, { ...toSave, id: 'rc' + Date.now(), kind: 'expense' }])
    }
    setFormState(null)
  }

  const handleSaveIncome = async (form) => {
    const toSave = {
      ...form,
      amount:     Number(form.amount) || 0,
      dayOfMonth: Number(form.dayOfMonth) || 1,
      startDate:  form.startDate || null,
      endDate:    form.endDate   || null,
    }
    if (formState?.id) {
      const updated = { ...toSave, id: formState.id }
      if (onUpdateIncome) await onUpdateIncome(updated)
      // local: income is managed externally
    } else {
      if (onCreateIncome) await onCreateIncome({ ...toSave, kind: 'income' })
    }
    setFormState(null)
  }

  const handleSaveReceivable = async (form) => {
    const toSave = { ...form, amount: Number(form.amount) || 0 }
    if (formState?.id) {
      if (onUpdateReceivable) await onUpdateReceivable({ ...toSave, id: formState.id })
    } else {
      if (onCreateReceivable) await onCreateReceivable({ ...toSave, kind: 'receivable' })
    }
    setFormState(null)
  }

  const handleSavePayable = async (form) => {
    const toSave = { ...form, amount: Number(form.amount) || 0 }
    if (formState?.id) {
      if (onUpdatePayable) await onUpdatePayable({ ...toSave, id: formState.id })
    } else {
      if (onCreatePayable) await onCreatePayable({ ...toSave, kind: 'payable' })
    }
    setFormState(null)
  }

  const handleDeleteReceivable = async (id) => {
    if (!window.confirm('¿Eliminar este registro?')) return
    if (onDeleteReceivable) await onDeleteReceivable(id)
  }
  const handleDeletePayable = async (id) => {
    if (!window.confirm('¿Eliminar este registro?')) return
    if (onDeletePayable) await onDeletePayable(id)
  }

  const openForm = (tab, item = null) => {
    if (tab === 'expenses')    setFormState(item ?? { ...BLANK_EXPENSE })
    if (tab === 'income')      setFormState(item ?? { ...BLANK_INCOME })
    if (tab === 'receivables') setFormState(item ?? BLANK_RELATION('receivable'))
    if (tab === 'payables')    setFormState(item ?? BLANK_RELATION('payable'))
  }

  const canAdd = (
    (tab === 'expenses'    && isSupabaseExp) ||
    (tab === 'income'      && isSupabaseInc) ||
    (tab === 'receivables' && isSupabaseRec) ||
    (tab === 'payables'    && isSupabasePay)
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="arrowup" size={12}/> Ingresos
          </div>
          <div className="mt-2 font-mono text-[22px] tracking-tight text-[var(--accent-ink)]">{fmtCLP(totalIncomeMonth)}</div>
          <div className="mt-1 text-[11px] text-[var(--muted)]">{monthLabel}</div>
        </Card>
        <Card padding="p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="arrowdn" size={12}/> Gastos fijos
          </div>
          <div className="mt-2 font-mono text-[22px] tracking-tight">{fmtCLP(totalRecurMonth)}</div>
          <div className="mt-1 text-[11px] text-[var(--muted)]">
            {pendingThisMonth.length} pendientes
            {totalComisiones > 0 && <> · comisiones {fmtCLP(totalComisiones)}</>}
          </div>
        </Card>
        <Card padding="p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="income" size={12}/> Por cobrar
          </div>
          <div className="mt-2 font-mono text-[22px] tracking-tight text-[var(--accent-ink)]">{fmtCLP(totalReceivable)}</div>
          <div className="mt-1 text-[11px] text-[var(--muted)]">{pendingReceivables.length} pendientes{overdueReceivable > 0 ? ` · ${overdueReceivable} vencidos` : ''}</div>
        </Card>
        <Card padding="p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="expense" size={12}/> Por pagar
          </div>
          <div className={`mt-2 font-mono text-[22px] tracking-tight ${totalPayable > 0 ? 'text-[#A02828]' : ''}`}>{fmtCLP(totalPayable)}</div>
          <div className="mt-1 text-[11px] text-[var(--muted)]">{pendingPayables.length} pendientes{overduePayable > 0 ? ` · ${overduePayable} vencidos` : ''}</div>
        </Card>
      </div>

      {/* Form modal */}
      {formState !== null && (
        <ModalShell
          title={
            tab === 'expenses'    && formState.id ? 'Editar gasto recurrente'
            : tab === 'expenses' && formState.comisionBancaria ? 'Nueva comisión bancaria'
            : tab === 'expenses'                  ? 'Nuevo gasto recurrente'
            : tab === 'income'    && formState.id ? 'Editar ingreso recurrente'
            : tab === 'income'                    ? 'Nuevo ingreso recurrente'
            : tab === 'receivables' && formState.id ? 'Editar por cobrar'
            : tab === 'receivables'               ? 'Nuevo por cobrar'
            : tab === 'payables'  && formState.id ? 'Editar por pagar'
            : 'Nuevo por pagar'
          }
          onClose={() => setFormState(null)}>
          <div className="p-5">
            {tab === 'expenses' || tab === 'income'
              ? <RecurringForm initial={formState} onSave={tab === 'income' ? handleSaveIncome : handleSaveExpense} onCancel={() => setFormState(null)} banks={banks} bare/>
              : <RelationForm  initial={formState} onSave={tab === 'receivables' ? handleSaveReceivable : handleSavePayable} onCancel={() => setFormState(null)} bare/>}
          </div>
        </ModalShell>
      )}

      {/* Tabs + list */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="px-2 pt-2 border-b border-[var(--line)] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <TabBtn active={tab === 'expenses'}    onClick={() => { setTab('expenses');    setFormState(null) }} label="Gastos fijos"  badge={pendingThisMonth.length}/>
            <TabBtn active={tab === 'income'}      onClick={() => { setTab('income');      setFormState(null) }} label="Ingresos"      badge={income_.filter(i => i.active).length}/>
            <TabBtn active={tab === 'receivables'} onClick={() => { setTab('receivables'); setFormState(null) }} label="Por cobrar"    badge={pendingReceivables.length} warn={overdueReceivable}/>
            <TabBtn active={tab === 'payables'}    onClick={() => { setTab('payables');    setFormState(null) }} label="Por pagar"     badge={pendingPayables.length}    warn={overduePayable}/>
          </div>
          {canAdd && formState === null && (
            <button onClick={() => openForm(tab)}
              className="mr-2 mb-1 h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[12.5px] font-medium shrink-0">
              <Icon name="plus" size={12}/> Nuevo
            </button>
          )}
        </div>

        {/* ── Gastos fijos ── */}
        {tab === 'expenses' && (
          recurring.length === 0 && isSupabaseExp ? (
            <div className="p-10 text-center">
              <div className="text-[28px] mb-2">🔄</div>
              <div className="font-semibold text-[14px] tracking-tight">Sin gastos recurrentes</div>
              <div className="text-[12.5px] text-[var(--muted)] mt-1 mb-4">Crea tus gastos fijos: arriendo, servicios, suscripciones.</div>
              <button onClick={() => openForm('expenses')}
                className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
                <Icon name="plus" size={13}/> Crear recurrente
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {recurring.map(r => {
                const cat     = categories.find(c => c.id === r.category) ?? categories[0]
                const charged = r.lastChargedMonth === monthStr
                return (
                  <li key={r.id} className={`px-5 py-3.5 flex items-center gap-3 ${!r.active ? 'opacity-55' : ''}`}>
                    <div className="w-9 h-9 rounded-md grid place-items-center text-[15px] shrink-0" style={{ background: (cat.color ?? '#888') + '20' }}>{cat.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[14px] truncate">{r.name}</span>
                        {r.comisionBancaria && <Badge tone="warn">comisión</Badge>}
                        {!r.active && <Badge tone="muted">pausado</Badge>}
                        {r.active && charged && <Badge tone="ok">cobrado</Badge>}
                        {r.active && !charged && <Badge tone="warn">pendiente</Badge>}
                        {r.autoRegister && <Badge tone="info">auto</Badge>}
                      </div>
                      <div className="mt-1 text-[11.5px] text-[var(--muted)] leading-snug">
                        Cobra el día {r.dayOfMonth}
                        {r.startDate && <> · Inicia: {fmtLocalDate(r.startDate)}</>}
                        {r.endDate   && <> · Termina: {fmtLocalDate(r.endDate)}</>}
                        {r.active && !charged && <> · Próximo cobro: {fmtNextCharge(r, today)}</>}
                        {r.bank && ` · ${banks.find(b => b.id === r.bank)?.label ?? r.bank}`}
                        {r.medio && ` · ${MEDIOS_LABEL[r.medio] ?? r.medio}`}
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
                      {isSupabaseExp && <IconBtn name="pencil" label="Editar" tone="outline" onClick={() => openForm('expenses', { ...r })}/>}
                      <IconBtn name="power" label={r.active ? 'Pausar' : 'Activar'}
                               tone={r.active ? 'outline' : 'ok'} onClick={() => toggleActive(r.id)}/>
                      {isSupabaseExp && <IconBtn name="trash" label="Eliminar" tone="danger" onClick={() => {
                        if (window.confirm('¿Eliminar gasto recurrente?')) onDeleteRecurring?.(r.id)
                      }}/>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        )}

        {/* ── Ingresos ── */}
        {tab === 'income' && (
          income_.length === 0 && isSupabaseInc ? (
            <div className="p-10 text-center">
              <div className="text-[28px] mb-2">💰</div>
              <div className="font-semibold text-[14px] tracking-tight">Sin ingresos registrados</div>
              <div className="text-[12.5px] text-[var(--muted)] mt-1 mb-4">Agrega tu sueldo, bonos u otros ingresos recurrentes.</div>
              <button onClick={() => openForm('income')}
                className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
                <Icon name="plus" size={13}/> Agregar ingreso
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {income_.map(i => {
                const cat     = categories.find(c => c.id === i.category) ?? categories.find(c => c.id === 'sueldo') ?? categories[0]
                const charged = i.lastChargedMonth === monthStr
                return (
                  <li key={i.id} className={`px-5 py-3.5 flex items-center gap-3 ${!i.active ? 'opacity-55' : ''}`}>
                    <div className="w-9 h-9 rounded-md grid place-items-center text-[15px] shrink-0" style={{ background: (cat.color ?? '#888') + '20' }}>{cat.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[14px] truncate">{i.name ?? i.source}</span>
                        {i.dayOfMonth && <Badge tone="muted">día {i.dayOfMonth}</Badge>}
                        {!i.active && <Badge tone="muted">inactivo</Badge>}
                        {i.autoRegister && <Badge tone="info">auto</Badge>}
                        {i.active && charged && <Badge tone="ok">recibido este mes</Badge>}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                        {cat.label} {i.notes ? `· ${i.notes}` : ''}
                      </div>
                    </div>
                    <div className="font-mono text-[15px] tabular-nums shrink-0 text-[var(--accent-ink)]">+{fmtCLP(i.amount)}</div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {i.active && !charged && (
                        <button onClick={() => setRecurring && null}
                          className="text-[11px] px-2 h-7 rounded-md border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]">
                          Recibido
                        </button>
                      )}
                      {isSupabaseInc && <IconBtn name="pencil" label="Editar" tone="outline" onClick={() => openForm('income', { ...i })}/>}
                      {isSupabaseInc && <IconBtn name="trash" label="Eliminar" tone="danger" onClick={() => {
                        if (window.confirm('¿Eliminar ingreso?')) onDeleteIncome?.(i.id)
                      }}/>}
                    </div>
                  </li>
                )
              })}
              {income_.length > 0 && !isSupabaseInc && (
                <li className="px-5 py-3">
                  <button onClick={() => openForm('income')}
                    className="w-full text-left text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] inline-flex items-center gap-1.5">
                    <Icon name="plus" size={13}/> Agregar ingreso
                  </button>
                </li>
              )}
            </ul>
          )
        )}

        {/* ── Por cobrar ── */}
        {tab === 'receivables' && (
          receivables.length === 0 && isSupabaseRec ? (
            <div className="p-10 text-center">
              <div className="text-[28px] mb-2">💵</div>
              <div className="font-semibold text-[14px] tracking-tight">Sin cuentas por cobrar</div>
              <div className="text-[12.5px] text-[var(--muted)] mt-1 mb-4">Registra dinero que te deben amigos, familia u otras personas.</div>
              <button onClick={() => openForm('receivables')}
                className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
                <Icon name="plus" size={13}/> Agregar por cobrar
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {receivables.map(r => (
                <RelationRow key={r.id} item={r}
                  onMarkPaid={id => onMarkReceivablePaid?.(id)}
                  onEdit={item => openForm('receivables', { ...item })}
                  onDelete={handleDeleteReceivable}
                  isSupabase={isSupabaseRec}/>
              ))}
              {totalReceivable > 0 && (
                <li className="px-5 py-3 bg-[var(--bg)] flex items-center justify-between text-[12.5px]">
                  <span className="text-[var(--muted)]">Total pendiente</span>
                  <span className="font-mono">{fmtCLP(totalReceivable)}</span>
                </li>
              )}
            </ul>
          )
        )}

        {/* ── Por pagar ── */}
        {tab === 'payables' && (
          payables.length === 0 && isSupabasePay ? (
            <div className="p-10 text-center">
              <div className="text-[28px] mb-2">💸</div>
              <div className="font-semibold text-[14px] tracking-tight">Sin deudas personales</div>
              <div className="text-[12.5px] text-[var(--muted)] mt-1 mb-4">Registra dinero que debes a familiares, amigos u otras personas.</div>
              <button onClick={() => openForm('payables')}
                className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
                <Icon name="plus" size={13}/> Agregar deuda
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {payables.map(p => (
                <RelationRow key={p.id} item={p}
                  onMarkPaid={id => onMarkPayablePaid?.(id)}
                  onEdit={item => openForm('payables', { ...item })}
                  onDelete={handleDeletePayable}
                  isSupabase={isSupabasePay}/>
              ))}
              {totalPayable > 0 && (
                <li className="px-5 py-3 bg-[var(--bg)] flex items-center justify-between text-[12.5px]">
                  <span className="text-[var(--muted)]">Total por pagar</span>
                  <span className="font-mono text-[#A02828]">{fmtCLP(totalPayable)}</span>
                </li>
              )}
            </ul>
          )
        )}
      </Card>
    </div>
  )
}
