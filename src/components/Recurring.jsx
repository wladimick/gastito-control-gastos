import React, { useState } from 'react'
import { Select } from './ui'
import { Icon, fmtCLP, MES } from '../lib/helpers'
import { useBanks } from '../services/banksService'
import { useCategories } from '../services/categoriesService'
import { CATEGORIES } from '../data'

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

// ── Tag ──────────────────────────────────────────────────────
const TAG_STYLES = {
  default:  { background: '#f0efe9', borderColor: '#dddbd3', color: '#5d6888' },
  auto:     { background: 'rgba(61,214,140,0.10)', borderColor: 'rgba(61,214,140,0.22)', color: '#28c47a' },
  manual:   { background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' },
  vencido:  { background: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' },
  pagado:   { background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d' },
  pausado:  { background: '#f0efe9', borderColor: '#dddbd3', color: '#9ba5c2' },
  comision: { background: '#faf5ff', borderColor: '#e9d5ff', color: '#7c3aed' },
}

function Tag({ children, type = 'default' }) {
  const s = TAG_STYLES[type] ?? TAG_STYLES.default
  return (
    <span style={s}
      className="inline-flex items-center text-[10.5px] font-semibold px-2 py-[2px] rounded-full border whitespace-nowrap leading-none">
      {children}
    </span>
  )
}

// ── Action buttons ────────────────────────────────────────────
function EditBtn({ onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="w-[30px] h-[30px] rounded-[8px] border flex items-center justify-center transition-opacity hover:opacity-70"
      style={{ background: '#f0efe9', borderColor: '#dddbd3', color: '#5d6888' }}>
      <Icon name="pencil" size={13}/>
    </button>
  )
}

function DelBtn({ onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="w-[30px] h-[30px] rounded-[8px] border flex items-center justify-center transition-opacity hover:opacity-70"
      style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.20)', color: '#ef4444' }}>
      <Icon name="trash" size={13}/>
    </button>
  )
}

function StateBtn({ onClick, active, warn, children }) {
  const style = active
    ? { borderColor: 'rgba(61,214,140,0.22)', background: 'rgba(61,214,140,0.10)', color: '#28c47a' }
    : warn
    ? { borderColor: '#fde68a', background: '#fffbeb', color: '#92400e' }
    : { borderColor: '#dddbd3', background: '#ffffff', color: '#9ba5c2' }
  return (
    <button type="button" onClick={onClick} style={style}
      className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-[11px] py-[5px] rounded-lg border-[1.5px] whitespace-nowrap transition-colors">
      {children}
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────
function ModalShell({ title, onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 z-50"
           style={{ background: 'rgba(20,24,36,.5)', backdropFilter: 'blur(4px)' }}
           onClick={onClose}/>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-5 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[420px] max-h-[88vh] overflow-y-auto rounded-[20px] shadow-2xl"
             style={{ background: '#ffffff', animation: 'modalUp .25s cubic-bezier(.34,1.12,.64,1)' }}>
          <div className="flex items-center justify-between px-[18px] pt-[18px] pb-[14px] border-b"
               style={{ borderColor: '#e8e6df' }}>
            <span className="text-[16px] font-extrabold" style={{ color: '#1e2535' }}>{title}</span>
            <button type="button" onClick={onClose}
              className="w-[30px] h-[30px] rounded-lg border flex items-center justify-center"
              style={{ background: '#f0efe9', borderColor: '#dddbd3', color: '#9ba5c2' }}>
              <Icon name="x" size={14}/>
            </button>
          </div>
          {children}
        </div>
      </div>
      <style>{`@keyframes modalUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  )
}

// ── Field ─────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold tracking-[0.09em] uppercase mb-[5px]"
            style={{ color: '#9ba5c2' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

const INP = `w-full px-3 py-2.5 rounded-[10px] border text-[13.5px] outline-none transition-colors focus:border-[#1e2535]`
const INP_STYLE = { background: '#f0efe9', borderColor: '#e8e6df', color: '#1e2535' }

// ── Toggle button helper ──────────────────────────────────────
function TogBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="flex-1 py-[9px] rounded-[10px] text-[13px] font-semibold border-[1.5px] transition-colors"
      style={active
        ? { background: '#1e2535', borderColor: '#1e2535', color: '#ffffff' }
        : { background: '#f0efe9', borderColor: '#dddbd3', color: '#9ba5c2' }}>
      {children}
    </button>
  )
}

// ── Form footer ───────────────────────────────────────────────
function FormFooter({ onCancel, onSave, valid, saveLabel }) {
  return (
    <div className="flex items-center justify-between px-[18px] pb-[18px] pt-[14px] border-t"
         style={{ borderColor: '#e8e6df' }}>
      <button type="button" onClick={onCancel}
        className="text-[13px] font-semibold underline underline-offset-2"
        style={{ color: '#9ba5c2' }}>
        Cancelar
      </button>
      <button type="button" onClick={onSave} disabled={!valid}
        className="inline-flex items-center gap-2 px-[22px] py-[11px] rounded-[10px] text-[14px] font-bold text-white disabled:opacity-40 transition-opacity"
        style={{ background: '#1e2535', boxShadow: '0 2px 8px rgba(30,37,53,.18)' }}>
        <Icon name="check" size={14}/>
        {saveLabel}
      </button>
    </div>
  )
}

// ── Blanks ────────────────────────────────────────────────────
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
function BLANK_RELATION(kind) {
  return {
    name: '', personName: '', description: '', amount: '',
    dueDate: '', category: kind === 'payable' ? 'por_pagar' : 'por_cobrar',
    notes: '', status: 'pending', active: true, autoRegister: false, kind,
  }
}

// ── RecurringForm ─────────────────────────────────────────────
function RecurringForm({ initial, onSave, onCancel, banks }) {
  const categories = CATEGORIES
  const [f, setF] = useState({ comisionBancaria: false, medio: '', ...initial })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const isIncome = f.kind === 'income'
  const valid = f.name.trim() && Number(f.amount) > 0

  const toggleComision = (isCom) => {
    setF(p => ({
      ...p,
      comisionBancaria: isCom,
      medio: isCom ? p.medio : '',
      category: isCom ? 'comision_bancaria' : (p.category === 'comision_bancaria' ? 'hogar' : p.category),
    }))
  }

  return (
    <>
      <div className="p-4 grid grid-cols-2 gap-3">
        <Field label={isIncome ? 'Fuente / Nombre' : 'Nombre'}>
          <input value={f.name} onChange={e => set('name', e.target.value)}
            placeholder={isIncome ? 'Sueldo, Bono…' : 'Arriendo, Netflix…'}
            className={INP} style={INP_STYLE}/>
        </Field>
        <Field label="Monto">
          <input type="text" inputMode="numeric" value={f.amount}
            onChange={e => set('amount', e.target.value)}
            placeholder="0" className={INP} style={INP_STYLE}/>
        </Field>
        <Field label="Día del mes">
          <input type="text" inputMode="numeric" value={f.dayOfMonth}
            onChange={e => set('dayOfMonth', e.target.value)}
            placeholder="1" className={INP} style={INP_STYLE}/>
        </Field>
        <Field label="Inicia">
          <input type="date" value={f.startDate || ''}
            onChange={e => set('startDate', e.target.value)}
            className={INP} style={INP_STYLE}/>
        </Field>
        <Field label="Termina (opcional)">
          <input type="date" value={f.endDate || ''}
            onChange={e => set('endDate', e.target.value)}
            className={INP} style={INP_STYLE}/>
        </Field>
        <Field label="Categoría">
          <Select value={f.category} onChange={v => set('category', v)}
            options={categories.map(c => ({ value: c.id, label: c.label }))}/>
        </Field>
        {!isIncome && (
          <Field label="Banco">
            <Select value={f.bank} onChange={v => set('bank', v)}
              options={banks.map(b => ({ value: b.id, label: b.label }))}/>
          </Field>
        )}
        {!isIncome && (
          <Field label="Tipo de gasto">
            <div className="flex gap-2">
              <TogBtn active={!f.comisionBancaria} onClick={() => toggleComision(false)}>Gasto fijo</TogBtn>
              <TogBtn active={f.comisionBancaria}  onClick={() => toggleComision(true)}>Comisión</TogBtn>
            </div>
          </Field>
        )}
        {!isIncome && f.comisionBancaria && (
          <Field label="Medio asociado">
            <Select value={f.medio || ''} onChange={v => set('medio', v)} options={[
              { value: '',              label: 'Sin especificar' },
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
            <div className="flex gap-2">
              <TogBtn active={f.type === 'debito'}  onClick={() => set('type', 'debito')}>Débito</TogBtn>
              <TogBtn active={f.type === 'credito'} onClick={() => set('type', 'credito')}>Crédito</TogBtn>
            </div>
          </Field>
        )}
        <Field label="Modo">
          <div className="flex gap-2">
            <TogBtn active={f.autoRegister}  onClick={() => set('autoRegister', true)}>Automático</TogBtn>
            <TogBtn active={!f.autoRegister} onClick={() => set('autoRegister', false)}>Manual</TogBtn>
          </div>
        </Field>
      </div>
      <FormFooter
        onCancel={onCancel}
        onSave={() => valid && onSave(f)}
        valid={valid}
        saveLabel={f.id ? 'Guardar cambios' : isIncome ? 'Crear ingreso' : 'Crear recurrente'}/>
    </>
  )
}

// ── RelationForm ──────────────────────────────────────────────
function RelationForm({ initial, onSave, onCancel }) {
  const categories = useCategories()
  const [f, setF] = useState(initial)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const isPayable = f.kind === 'payable'
  const valid = (f.personName || f.name).trim() && Number(f.amount) > 0

  return (
    <>
      <div className="p-4 grid grid-cols-2 gap-3">
        <Field label={isPayable ? 'A quién le debo' : 'Quién me debe'}>
          <input value={f.personName}
            onChange={e => { set('personName', e.target.value); set('name', e.target.value) }}
            placeholder={isPayable ? 'Papá, María…' : 'Juan, Empresa…'}
            className={INP} style={INP_STYLE}/>
        </Field>
        <Field label="Monto">
          <input type="text" inputMode="numeric" value={f.amount}
            onChange={e => set('amount', e.target.value)}
            placeholder="0" className={INP} style={INP_STYLE}/>
        </Field>
        <Field label="Fecha esperada">
          <input type="date" value={f.dueDate} onChange={e => set('dueDate', e.target.value)}
            className={INP} style={INP_STYLE}/>
        </Field>
        <Field label="Descripción">
          <input value={f.description} onChange={e => set('description', e.target.value)}
            placeholder={isPayable ? 'Motivo del préstamo…' : 'Qué me deben…'}
            className={INP} style={INP_STYLE}/>
        </Field>
        <Field label="Categoría">
          <Select value={f.category} onChange={v => set('category', v)}
            options={categories.map(c => ({ value: c.id, label: c.label }))}/>
        </Field>
        <Field label="Modo">
          <div className="flex gap-2">
            <TogBtn active={!f.autoRegister} onClick={() => set('autoRegister', false)}>Manual</TogBtn>
            <TogBtn active={f.autoRegister}  onClick={() => set('autoRegister', true)}>Automático</TogBtn>
          </div>
        </Field>
        <div className="col-span-2">
          <Field label="Nota">
            <input value={f.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Notas opcionales…"
              className={INP} style={INP_STYLE}/>
          </Field>
        </div>
      </div>
      <FormFooter
        onCancel={onCancel}
        onSave={() => valid && onSave(f)}
        valid={valid}
        saveLabel={f.id ? 'Guardar cambios' : isPayable ? 'Registrar deuda' : 'Registrar por cobrar'}/>
    </>
  )
}

// ── Empty state ───────────────────────────────────────────────
function Empty({ emoji, title, subtitle, onAction, actionLabel }) {
  return (
    <div className="p-10 text-center">
      <div className="text-[28px] mb-2">{emoji}</div>
      <div className="font-bold text-[14px]" style={{ color: '#1e2535' }}>{title}</div>
      <div className="text-[12.5px] mt-1 mb-4" style={{ color: '#9ba5c2' }}>{subtitle}</div>
      <button type="button" onClick={onAction}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-bold text-white"
        style={{ background: '#1e2535' }}>
        <Icon name="plus" size={13}/> {actionLabel}
      </button>
    </div>
  )
}

// ── Panel total footer ────────────────────────────────────────
function PanelTotal({ label, amount, color = '#1e2535', prefix = '' }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t-2"
         style={{ borderColor: '#e8e6df', background: '#f0efe9' }}>
      <span className="text-[13px]" style={{ color: '#5d6888' }}>{label}</span>
      <span className="text-[16px] font-extrabold tabular-nums" style={{ color }}>
        {prefix}{fmtCLP(amount)}
      </span>
    </div>
  )
}

// ── Item icon box ─────────────────────────────────────────────
function ItemIcon({ icon, color }) {
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border"
         style={{ background: (color ?? '#888') + '20', borderColor: '#e8e6df' }}>
      {icon}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function Recurring({
  recurring, setRecurring,
  onCreateRecurring, onUpdateRecurring, onDeleteRecurring,
  incomeList, onCreateIncome, onUpdateIncome, onDeleteIncome,
  receivablesList, onCreateReceivable, onUpdateReceivable, onDeleteReceivable, onMarkReceivablePaid,
  payablesList, onCreatePayable, onUpdatePayable, onDeletePayable, onMarkPayablePaid,
  salaryPaymentDay,
}) {
  const banks      = useBanks()
  const categories = CATEGORIES
  const today      = new Date()
  const monthLabel = `${MES[today.getMonth()]} ${today.getFullYear()}`
  const monthStr   = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [tab, setTab]         = useState('expenses')
  const [formState, setFormState] = useState(null)

  const income_     = incomeList     ?? []
  const receivables = receivablesList ?? []
  const payables    = payablesList   ?? []

  const activeRec        = recurring.filter(r => r.active)
  const totalRecurMonth  = activeRec.reduce((s, r) => s + r.amount, 0)
  const pendingThisMonth = activeRec.filter(r => r.lastChargedMonth !== monthStr)
  const comisiones       = activeRec.filter(r => r.comisionBancaria)
  const totalComisiones  = comisiones.reduce((s, r) => s + r.amount, 0)

  const totalIncomeMonth = income_.filter(i => i.active).reduce((s, i) => s + i.amount, 0)

  const pendingReceivables = receivables.filter(r => r.status !== 'paid')
  const totalReceivable    = pendingReceivables.reduce((s, r) => s + r.amount, 0)
  const overdueReceivable  = pendingReceivables.filter(r =>
    r.status === 'overdue' || (r.dueDate && new Date(r.dueDate) < today)).length

  const pendingPayables = payables.filter(p => p.status !== 'paid')
  const totalPayable    = pendingPayables.reduce((s, p) => s + p.amount, 0)
  const overduePayable  = pendingPayables.filter(p =>
    p.status === 'overdue' || (p.dueDate && new Date(p.dueDate) < today)).length

  const isSupabaseExp = Boolean(onCreateRecurring)
  const isSupabaseInc = Boolean(onCreateIncome)
  const isSupabaseRec = Boolean(onCreateReceivable)
  const isSupabasePay = Boolean(onCreatePayable)

  const toggleActive = (id) =>
    setRecurring(recurring.map(r => r.id === id ? { ...r, active: !r.active } : r))

  const runNow = (id) =>
    setRecurring(recurring.map(r => r.id === id ? { ...r, lastChargedMonth: monthStr } : r))

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

  const openForm = (tabId, item = null) => {
    if (tabId === 'expenses')    setFormState(item ?? { ...BLANK_EXPENSE })
    if (tabId === 'income')      setFormState(item ?? { ...BLANK_INCOME })
    if (tabId === 'receivables') setFormState(item ?? BLANK_RELATION('receivable'))
    if (tabId === 'payables')    setFormState(item ?? BLANK_RELATION('payable'))
  }

  const canAdd = (
    (tab === 'expenses'    && isSupabaseExp) ||
    (tab === 'income'      && isSupabaseInc) ||
    (tab === 'receivables' && isSupabaseRec) ||
    (tab === 'payables'    && isSupabasePay)
  )

  const TABS = [
    { id: 'expenses',    label: 'Gastos fijos', badge: pendingThisMonth.length, warn: 0 },
    { id: 'income',      label: 'Ingresos',     badge: income_.filter(i => i.active).length, warn: 0 },
    { id: 'receivables', label: 'Por cobrar',   badge: pendingReceivables.length, warn: overdueReceivable },
    { id: 'payables',    label: 'Por pagar',    badge: pendingPayables.length, warn: overduePayable },
  ]

  const modalTitle =
    tab === 'expenses' && formState?.id && formState?.comisionBancaria ? 'Editar comisión bancaria' :
    tab === 'expenses' && formState?.id ? 'Editar gasto recurrente' :
    tab === 'expenses' && formState?.comisionBancaria ? 'Nueva comisión bancaria' :
    tab === 'expenses' ? 'Nuevo gasto recurrente' :
    tab === 'income'   && formState?.id ? 'Editar ingreso recurrente' :
    tab === 'income'   ? 'Nuevo ingreso recurrente' :
    tab === 'receivables' && formState?.id ? 'Editar por cobrar' :
    tab === 'receivables' ? 'Nuevo por cobrar' :
    tab === 'payables'    && formState?.id ? 'Editar por pagar' :
    'Nuevo por pagar'

  return (
    <div className="flex flex-col gap-3">

      {/* ── Hero 2x2 ── */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Ingresos — navy */}
        <div className="rounded-2xl p-4 shadow-lg"
             style={{ background: '#1e2535', border: '1px solid #1e2535' }}>
          <div className="flex items-center gap-1.5 mb-2"
               style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
            <Icon name="arrowup" size={10}/> Ingresos
          </div>
          <div className="font-extrabold tabular-nums"
               style={{ fontSize: '22px', lineHeight: 1, color: '#3dd68c' }}>
            {fmtCLP(totalIncomeMonth)}
          </div>
          <div className="mt-[5px]" style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.35)' }}>
            {monthLabel}
          </div>
        </div>

        {/* Gastos fijos — white */}
        <div className="rounded-2xl p-4 border shadow-sm"
             style={{ background: '#ffffff', borderColor: '#e8e6df' }}>
          <div className="flex items-center gap-1.5 mb-2"
               style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9ba5c2' }}>
            <Icon name="arrowdn" size={10}/> Gastos fijos
          </div>
          <div className="font-extrabold tabular-nums"
               style={{ fontSize: totalRecurMonth >= 1000000 ? '18px' : '22px', lineHeight: 1, color: '#1e2535' }}>
            {fmtCLP(totalRecurMonth)}
          </div>
          <div className="mt-[5px]" style={{ fontSize: '10.5px', color: '#9ba5c2' }}>
            {pendingThisMonth.length} pendientes
            {totalComisiones > 0 && <> · comisiones {fmtCLP(totalComisiones)}</>}
          </div>
        </div>

        {/* Por cobrar — white */}
        <div className="rounded-2xl p-4 border shadow-sm"
             style={{ background: '#ffffff', borderColor: '#e8e6df' }}>
          <div className="flex items-center gap-1.5 mb-2"
               style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9ba5c2' }}>
            <Icon name="arrowup" size={10}/> Por cobrar
          </div>
          <div className="font-extrabold tabular-nums"
               style={{ fontSize: '22px', lineHeight: 1, color: '#1e2535' }}>
            {fmtCLP(totalReceivable)}
          </div>
          <div className="mt-[5px]" style={{ fontSize: '10.5px', color: '#9ba5c2' }}>
            {pendingReceivables.length} pendientes
            {overdueReceivable > 0 && ` · ${overdueReceivable} vencido${overdueReceivable !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Por pagar — red tint */}
        <div className="rounded-2xl p-4 border shadow-sm"
             style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.20)' }}>
          <div className="flex items-center gap-1.5 mb-2"
               style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(239,68,68,0.75)' }}>
            <Icon name="arrowdn" size={10}/> Por pagar
          </div>
          <div className="font-extrabold tabular-nums"
               style={{ fontSize: '22px', lineHeight: 1, color: '#ef4444' }}>
            {fmtCLP(totalPayable)}
          </div>
          <div className="mt-[5px]" style={{ fontSize: '10.5px', color: 'rgba(239,68,68,0.6)' }}>
            {pendingPayables.length} pendiente{pendingPayables.length !== 1 ? 's' : ''}
            {overduePayable > 0 && ` · ${overduePayable} vencido${overduePayable !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* ── Tabs card ── */}
      <div className="rounded-2xl overflow-hidden border shadow-sm"
           style={{ background: '#ffffff', borderColor: '#e8e6df' }}>
        <div className="flex overflow-x-auto p-3 pb-0 gap-1" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.id} type="button"
              onClick={() => { setTab(t.id); setFormState(null) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full whitespace-nowrap text-[12.5px] font-semibold border-[1.5px] transition-colors shrink-0 mb-2.5"
              style={tab === t.id
                ? { background: '#1e2535', borderColor: '#1e2535', color: '#ffffff' }
                : { background: 'transparent', borderColor: 'transparent', color: '#5d6888' }}>
              {t.label}
              {t.badge > 0 && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full"
                      style={tab === t.id
                        ? { background: 'rgba(255,255,255,0.2)', color: '#ffffff' }
                        : t.warn > 0
                        ? { background: 'rgba(249,115,22,0.2)', color: '#c2410c' }
                        : { background: '#f0efe9', color: '#9ba5c2' }}>
                  {t.badge}
                </span>
              )}
              {t.warn > 0 && tab !== t.id && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#f97316' }}/>
              )}
            </button>
          ))}
        </div>
        {canAdd && formState === null && (
          <div className="px-3 pb-3">
            <button type="button" onClick={() => openForm(tab)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-white px-3.5 py-2 rounded-[10px]"
              style={{ background: '#1e2535', boxShadow: '0 2px 8px rgba(30,37,53,.15)' }}>
              <Icon name="plus" size={13}/> Nuevo
            </button>
          </div>
        )}
      </div>

      {/* ── Panel card ── */}
      <div className="rounded-2xl overflow-hidden border shadow-sm"
           style={{ background: '#ffffff', borderColor: '#e8e6df' }}>

        {/* ── Gastos fijos ── */}
        {tab === 'expenses' && (
          recurring.length === 0 && isSupabaseExp
            ? <Empty emoji="🔄" title="Sin gastos recurrentes"
                subtitle="Crea tus gastos fijos: arriendo, servicios, suscripciones."
                onAction={() => openForm('expenses')} actionLabel="Crear recurrente"/>
            : <>
                {recurring.map((r, i) => {
                  const cat       = categories.find(c => c.id === r.category) ?? categories[0]
                  const charged   = r.lastChargedMonth === monthStr
                  const bankLabel = banks.find(b => b.id === r.bank)?.label ?? r.bank ?? ''
                  return (
                    <div key={r.id}
                      className={`flex items-start gap-3 px-4 py-3.5 ${i > 0 ? 'border-t' : ''} ${!r.active ? 'opacity-60' : ''}`}
                      style={{ borderColor: '#e8e6df' }}>
                      <ItemIcon icon={cat.icon} color={cat.color}/>
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] font-bold"
                              style={{ color: !r.active ? '#9ba5c2' : '#1e2535' }}>{r.name}</span>
                        <div className="text-[11.5px] mt-[2px] leading-snug" style={{ color: '#9ba5c2' }}>
                          {cat.label}{bankLabel ? ` · ${bankLabel}` : ''}
                          {r.active && !charged && <> · Próximo: {fmtNextCharge(r, today)}</>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-[5px]">
                          {r.dayOfMonth && <Tag>día {r.dayOfMonth}</Tag>}
                          {r.active
                            ? (r.autoRegister ? <Tag type="auto">auto</Tag> : <Tag type="manual">manual</Tag>)
                            : null}
                          {r.comisionBancaria && <Tag type="comision">comisión</Tag>}
                          {!r.active && <Tag type="pausado">⏸ pausado</Tag>}
                          {r.active && charged && <Tag type="pagado">cobrado</Tag>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="font-extrabold tabular-nums whitespace-nowrap"
                             style={{ fontSize: '15px', color: '#ef4444' }}>
                          −{fmtCLP(r.amount)}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {r.active && !charged && (
                            <StateBtn onClick={() => runNow(r.id)}>Cobrar</StateBtn>
                          )}
                          <StateBtn
                            active={!r.active}
                            onClick={() => toggleActive(r.id)}>
                            {r.active ? 'Pausar' : 'Activar'}
                          </StateBtn>
                          {isSupabaseExp && <EditBtn onClick={() => openForm('expenses', { ...r })}/>}
                          {isSupabaseExp && (
                            <DelBtn onClick={() => {
                              if (window.confirm('¿Eliminar gasto recurrente?')) onDeleteRecurring?.(r.id)
                            }}/>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {recurring.length > 0 && (
                  <PanelTotal label="Total gastos fijos activos" amount={totalRecurMonth} color="#ef4444" prefix="−"/>
                )}
              </>
        )}

        {/* ── Ingresos ── */}
        {tab === 'income' && (
          income_.length === 0 && isSupabaseInc
            ? <Empty emoji="💰" title="Sin ingresos registrados"
                subtitle="Agrega tu sueldo, bonos u otros ingresos recurrentes."
                onAction={() => openForm('income')} actionLabel="Agregar ingreso"/>
            : <>
                {income_.map((item, idx) => {
                  const cat     = categories.find(c => c.id === item.category)
                              ?? categories.find(c => c.id === 'sueldo')
                              ?? categories[0]
                  const charged = item.lastChargedMonth === monthStr
                  const methodLabel = item.method === 'transfer' ? 'Transferencia'
                                    : item.method === 'tarjeta'  ? 'Tarjeta'
                                    : 'Efectivo'
                  return (
                    <div key={item.id}
                      className={`flex items-start gap-3 px-4 py-3.5 ${idx > 0 ? 'border-t' : ''} ${!item.active ? 'opacity-55' : ''}`}
                      style={{ borderColor: '#e8e6df' }}>
                      <ItemIcon icon={cat.icon} color={cat.color}/>
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] font-bold" style={{ color: '#1e2535' }}>
                          {item.name ?? item.source}
                        </span>
                        <div className="text-[11.5px] mt-[2px] leading-snug" style={{ color: '#9ba5c2' }}>
                          {cat.label} · {methodLabel}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-[5px]">
                          {item.dayOfMonth && <Tag>día {item.dayOfMonth}</Tag>}
                          {item.autoRegister
                            ? <Tag type="auto">auto</Tag>
                            : <Tag type="manual">manual</Tag>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="font-extrabold tabular-nums whitespace-nowrap"
                             style={{ fontSize: '15px', color: '#28c47a' }}>
                          +{fmtCLP(item.amount)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <StateBtn active={charged} onClick={() => {}}>
                            {charged ? 'Recibido' : 'Pendiente'}
                          </StateBtn>
                          {isSupabaseInc && <EditBtn onClick={() => openForm('income', { ...item })}/>}
                          {isSupabaseInc && (
                            <DelBtn onClick={() => {
                              if (window.confirm('¿Eliminar ingreso?')) onDeleteIncome?.(item.id)
                            }}/>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {income_.length > 0 && (
                  <PanelTotal label="Total ingresos recurrentes" amount={totalIncomeMonth} color="#28c47a" prefix="+"/>
                )}
              </>
        )}

        {/* ── Por cobrar ── */}
        {tab === 'receivables' && (
          receivables.length === 0 && isSupabaseRec
            ? <Empty emoji="💵" title="Sin cuentas por cobrar"
                subtitle="Registra dinero que te deben amigos, familia u otras personas."
                onAction={() => openForm('receivables')} actionLabel="Agregar por cobrar"/>
            : <>
                {receivables.map((r, idx) => {
                  const cat       = categories.find(c => c.id === r.category) ?? categories[0]
                  const isPaid    = r.status === 'paid'
                  const due       = r.dueDate ? new Date(r.dueDate) : null
                  const isOverdue = !isPaid && due && due < today
                  const dueDiff   = due ? Math.round((due - today) / 86400000) : null
                  const amtColor  = isOverdue ? '#f97316' : isPaid ? '#9ba5c2' : '#28c47a'
                  return (
                    <div key={r.id}
                      className={`flex items-start gap-3 px-4 py-3.5 ${idx > 0 ? 'border-t' : ''} ${isPaid ? 'opacity-55' : ''}`}
                      style={{ borderColor: '#e8e6df' }}>
                      <ItemIcon icon={cat.icon} color={cat.color}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[14px] font-bold"
                                style={{ color: isPaid ? '#9ba5c2' : '#1e2535' }}>
                            {r.personName || r.name}
                          </span>
                          {isPaid    && <Tag type="pagado">pagado</Tag>}
                          {isOverdue && <Tag type="vencido">vencido</Tag>}
                        </div>
                        <div className="text-[11.5px] mt-[2px] leading-snug" style={{ color: '#9ba5c2' }}>
                          {r.description && <span>{r.description} · </span>}
                          {due && (
                            isPaid
                              ? (r.paidAt ? `Pagado ${new Date(r.paidAt).toLocaleDateString('es-CL')}` : 'Pagado')
                              : dueDiff === 0 ? 'Vence hoy'
                              : dueDiff > 0  ? `Vence en ${dueDiff} días`
                              : `Venció hace ${-dueDiff} días`
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="font-extrabold tabular-nums whitespace-nowrap"
                             style={{ fontSize: '15px', color: amtColor }}>
                          {fmtCLP(r.amount)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!isPaid && (
                            <StateBtn warn={!!isOverdue} onClick={() => onMarkReceivablePaid?.(r.id)}>
                              Pagado
                            </StateBtn>
                          )}
                          {isSupabaseRec && <EditBtn onClick={() => openForm('receivables', { ...r })}/>}
                          {isSupabaseRec && <DelBtn onClick={() => handleDeleteReceivable(r.id)}/>}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {totalReceivable > 0 && (
                  <PanelTotal label="Total pendiente" amount={totalReceivable} color="#f97316"/>
                )}
              </>
        )}

        {/* ── Por pagar ── */}
        {tab === 'payables' && (
          payables.length === 0 && isSupabasePay
            ? <Empty emoji="💸" title="Sin deudas personales"
                subtitle="Registra dinero que debes a familiares, amigos u otras personas."
                onAction={() => openForm('payables')} actionLabel="Agregar deuda"/>
            : <>
                {payables.map((p, idx) => {
                  const cat       = categories.find(c => c.id === p.category) ?? categories[0]
                  const isPaid    = p.status === 'paid'
                  const due       = p.dueDate ? new Date(p.dueDate) : null
                  const isOverdue = !isPaid && due && due < today
                  const dueDiff   = due ? Math.round((due - today) / 86400000) : null
                  return (
                    <div key={p.id}
                      className={`flex items-start gap-3 px-4 py-3.5 ${idx > 0 ? 'border-t' : ''} ${isPaid ? 'opacity-55' : ''}`}
                      style={{ borderColor: '#e8e6df' }}>
                      <ItemIcon icon={cat.icon} color={cat.color}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[14px] font-bold"
                                style={{ color: isPaid ? '#9ba5c2' : '#1e2535' }}>
                            {p.personName || p.name}
                          </span>
                          {isPaid    && <Tag type="pagado">pagado</Tag>}
                          {isOverdue && <Tag type="vencido">vencido</Tag>}
                        </div>
                        <div className="text-[11.5px] mt-[2px] leading-snug" style={{ color: '#9ba5c2' }}>
                          {p.description && <span>{p.description} · </span>}
                          {due && (
                            isPaid
                              ? (p.paidAt ? `Pagado ${new Date(p.paidAt).toLocaleDateString('es-CL')}` : 'Pagado')
                              : dueDiff === 0 ? 'Vence hoy'
                              : dueDiff > 0  ? `Vence en ${dueDiff} días`
                              : `Venció hace ${-dueDiff} días`
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="font-extrabold tabular-nums whitespace-nowrap"
                             style={{ fontSize: '15px', color: '#ef4444' }}>
                          {fmtCLP(p.amount)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!isPaid && (
                            <StateBtn warn={!!isOverdue} onClick={() => onMarkPayablePaid?.(p.id)}>
                              Pagado
                            </StateBtn>
                          )}
                          {isSupabasePay && <EditBtn onClick={() => openForm('payables', { ...p })}/>}
                          {isSupabasePay && <DelBtn onClick={() => handleDeletePayable(p.id)}/>}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {totalPayable > 0 && (
                  <PanelTotal label="Total por pagar" amount={totalPayable} color="#ef4444"/>
                )}
              </>
        )}

      </div>

      {/* ── Modal ── */}
      {formState !== null && (
        <ModalShell title={modalTitle} onClose={() => setFormState(null)}>
          {tab === 'expenses' || tab === 'income'
            ? <RecurringForm
                initial={formState}
                onSave={tab === 'income' ? handleSaveIncome : handleSaveExpense}
                onCancel={() => setFormState(null)}
                banks={banks}/>
            : <RelationForm
                initial={formState}
                onSave={tab === 'receivables' ? handleSaveReceivable : handleSavePayable}
                onCancel={() => setFormState(null)}/>}
        </ModalShell>
      )}

    </div>
  )
}
