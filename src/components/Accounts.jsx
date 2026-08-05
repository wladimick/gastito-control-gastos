import React, { useEffect, useMemo, useState } from 'react'
import { financialHelpFor } from '../lib/financialHelp'
import { Badge, BankLogo, Card, Select, InfoTip } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'
import { useBanks } from '../services/banksService'
import { fetchBillingCycles } from '../services/billingCyclesService'
import { fetchIncome, fetchPayables } from '../services/recurringService'

const ACCOUNT_TYPES = [
  { id: 'debito', label: 'Cuenta débito', icon: '🏦' },
  { id: 'billetera', label: 'Billetera', icon: '📱' },
  { id: 'efectivo', label: 'Efectivo', icon: '💵' },
  { id: 'ahorro', label: 'Ahorro', icon: '🐷' },
]
const TYPE_MAP = Object.fromEntries(ACCOUNT_TYPES.map(item => [item.id, item]))
const BLANK_ACCOUNT = { name: '', type: 'debito', bankId: '', balance: '', active: true }
const BLANK_CARD = { name: '', bank: '', lastFour: '', billingDay: '', billingStartDay: '', paymentDueDay: '', creditLimit: '', isActive: true }
const INPUT = 'w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[13px] focus:outline-none focus:border-[var(--ink)]'

function dateOnly(value) { return value ? String(value).slice(0, 10) : '' }
function daysBetween(left, right) {
  if (!left || !right) return null
  return Math.round((new Date(`${right}T12:00:00`) - new Date(`${left}T12:00:00`)) / 86400000)
}
function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())
}
function shortDate(value) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${dateOnly(value)}T12:00:00Z`))
}
function cycleAmount(cycle) {
  if (cycle.reportedAmountIsFinal) return Number(cycle.reportedAmount || 0)
  return Math.max(Number(cycle.reportedAmount || 0), Number(cycle.estimatedAmount || 0), Number(cycle.calculatedAmount || 0))
}
function accountAge(value) {
  if (!value) return { stale: true, label: 'Sin fecha de actualización' }
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000))
  if (days === 0) return { stale: false, label: 'Actualizada hoy' }
  if (days === 1) return { stale: false, label: 'Actualizada ayer' }
  return { stale: days > 7, label: `Actualizada hace ${days} días` }
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative w-full md:max-w-[520px] max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-[var(--bg-elev)] border border-[var(--line)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3.5 border-b border-[var(--line)] bg-[var(--bg-elev)]">
          <div className="text-[14px] font-bold">{title}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="x" size={13}/></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children, hint }) {
  return <label className="block"><span className="block text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">{label}</span>{children}{hint && <span className="block text-[10px] text-[var(--muted)] mt-1">{hint}</span>}</label>
}

function AccountForm({ initial, banks, onClose, onSave }) {
  const [form, setForm] = useState(initial)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const valid = String(form.name || '').trim()
  return <>
    <div className="p-4 grid grid-cols-2 gap-3">
      <div className="col-span-2"><Field label="Nombre"><input value={form.name} onChange={event => set('name', event.target.value)} className={INPUT} placeholder="Mercado Pago, Cuenta RUT…"/></Field></div>
      <Field label="Tipo"><Select value={form.type} onChange={value => set('type', value)} options={ACCOUNT_TYPES.map(item => ({ value: item.id, label: `${item.icon} ${item.label}` }))}/></Field>
      <Field label="Banco"><Select value={form.bankId || ''} onChange={value => set('bankId', value || null)} options={[{ value: '', label: 'Sin institución' }, ...banks.map(bank => ({ value: bank.id, label: bank.label }))]}/></Field>
      <div className="col-span-2"><Field label="Saldo disponible" hint="Dinero real disponible; no incluyas cupos de tarjetas."><input type="number" min="0" value={form.balance} onChange={event => set('balance', event.target.value)} className={`${INPUT} font-mono`}/></Field></div>
      <label className="col-span-2 flex items-center gap-2 text-[12px]"><input type="checkbox" checked={form.active !== false} onChange={event => set('active', event.target.checked)}/>Cuenta activa</label>
    </div>
    <div className="px-4 py-3 border-t border-[var(--line)] flex justify-end gap-2"><button onClick={onClose} className="h-9 px-3 text-[11px] text-[var(--muted)]">Cancelar</button><button disabled={!valid} onClick={() => valid && onSave({ ...form, balance: Number(form.balance || 0) })} className="h-9 px-4 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold disabled:opacity-40">Guardar cuenta</button></div>
  </>
}

function CardForm({ initial, banks, onClose, onSave }) {
  const [form, setForm] = useState(initial)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const valid = String(form.name || '').trim()
  return <>
    <div className="p-4 grid grid-cols-2 gap-3">
      <div className="col-span-2"><Field label="Nombre"><input value={form.name} onChange={event => set('name', event.target.value)} className={INPUT} placeholder="CMR, Banco Chile…"/></Field></div>
      <Field label="Banco"><select value={form.bank || ''} onChange={event => set('bank', event.target.value)} className={INPUT}><option value="">Sin banco</option>{banks.map(bank => <option key={bank.id} value={bank.id}>{bank.label}</option>)}</select></Field>
      <Field label="Últimos 4"><input value={form.lastFour || ''} maxLength={4} onChange={event => set('lastFour', event.target.value.replace(/\D/g, '').slice(0, 4))} className={`${INPUT} font-mono`}/></Field>
      <Field label="Día de cierre"><input type="number" min="1" max="31" value={form.billingDay || ''} onChange={event => set('billingDay', event.target.value)} className={`${INPUT} font-mono`}/></Field>
      <Field label="Día de pago"><input type="number" min="1" max="31" value={form.paymentDueDay || ''} onChange={event => set('paymentDueDay', event.target.value)} className={`${INPUT} font-mono`}/></Field>
      <div className="col-span-2"><Field label="Cupo total"><input type="number" min="0" value={form.creditLimit || ''} onChange={event => set('creditLimit', event.target.value)} className={`${INPUT} font-mono`}/></Field></div>
      <label className="col-span-2 flex items-center gap-2 text-[12px]"><input type="checkbox" checked={form.isActive !== false} onChange={event => set('isActive', event.target.checked)}/>Tarjeta activa</label>
    </div>
    <div className="px-4 py-3 border-t border-[var(--line)] flex justify-end gap-2"><button onClick={onClose} className="h-9 px-3 text-[11px] text-[var(--muted)]">Cancelar</button><button disabled={!valid} onClick={() => valid && onSave(form)} className="h-9 px-4 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold disabled:opacity-40">Guardar tarjeta</button></div>
  </>
}

function Metric({label, value, detail, tone = 'default', info}) {
  const help = info || financialHelpFor(label)
  const cls = tone === 'dark' ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent' : tone === 'danger' ? 'bg-red-50 text-red-800 border-red-100' : tone === 'warning' ? 'bg-[var(--amber-soft)] text-[var(--amber-ink)] border-transparent' : 'bg-[var(--bg-elev)] border-[var(--line)]'
  return <div className={`rounded-2xl border p-4 min-h-[116px] ${cls}`}><div className="flex items-center gap-1.5"><div className="text-[10px] uppercase tracking-[0.11em] font-bold opacity-60">{label}</div>{help && <InfoTip content={help}/>}</div><div className="font-mono text-[23px] font-bold mt-3 tracking-tight">{value}</div><div className="text-[10.5px] opacity-65 mt-1.5 leading-relaxed">{detail}</div></div>
}

export default function Accounts({
  accounts = [], creditCards = [], recurringList = [], payables = [], incomeList = [],
  onCreateAccount, onUpdateAccount, onDeleteAccount, onCreateCard, onUpdateCard, onDeleteCard,
}) {
  const banks = useBanks()
  const [tab, setTab] = useState('summary')
  const [cycles, setCycles] = useState([])
  const [loadedPayables, setLoadedPayables] = useState([])
  const [loadedIncome, setLoadedIncome] = useState([])
  const [loadingCycles, setLoadingCycles] = useState(true)
  const [editingAccount, setEditingAccount] = useState(null)
  const [editingCard, setEditingCard] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([fetchBillingCycles(), fetchPayables(), fetchIncome()]).then(([cycleResult, payableResult, incomeResult]) => {
      if (cancelled) return
      if (cycleResult.status === 'fulfilled') setCycles(cycleResult.value || [])
      if (payableResult.status === 'fulfilled') setLoadedPayables(payableResult.value || [])
      if (incomeResult.status === 'fulfilled') setLoadedIncome(incomeResult.value || [])
    }).catch(console.error).finally(() => { if (!cancelled) setLoadingCycles(false) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => setDrafts(Object.fromEntries(accounts.filter(item => item.active).map(item => [item.id, String(Number(item.balance || 0))]))), [accounts])

  const payablesData = payables.length ? payables : loadedPayables
  const incomeData = incomeList.length ? incomeList : loadedIncome
  const activeAccounts = accounts.filter(item => item.active)
  const totalBalance = activeAccounts.reduce((sum, item) => sum + Number(item.balance || 0), 0)
  const pendingPayables = payablesData.filter(item => item.status !== 'paid')
  const reserved = pendingPayables.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const freeBalance = totalBalance - reserved
  const directRecurring = recurringList.filter(item => item.active && item.type !== 'credito')
  const directRecurringTotal = directRecurring.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const monthlyIncome = incomeData.filter(item => item.active).reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const today = todayKey()
  const outstanding = useMemo(() => cycles.filter(cycle => cycle.status !== 'paid' && cycle.dueDate && dateOnly(cycle.dueDate) >= today).sort((a, b) => dateOnly(a.dueDate).localeCompare(dateOnly(b.dueDate))), [cycles, today])
  const near = useMemo(() => {
    const sevenDays = outstanding.filter(cycle => daysBetween(today, dateOnly(cycle.dueDate)) <= 7)
    if (sevenDays.length) return sevenDays
    if (!outstanding.length) return []
    const firstMonth = dateOnly(outstanding[0].dueDate).slice(0, 7)
    return outstanding.filter(cycle => dateOnly(cycle.dueDate).slice(0, 7) === firstMonth)
  }, [outstanding, today])
  const nextCardsTotal = near.reduce((sum, cycle) => sum + cycleAmount(cycle), 0)
  const gap = freeBalance - nextCardsTotal
  const changedAccounts = activeAccounts.filter(item => Number(drafts[item.id] || 0) !== Number(item.balance || 0))

  const saveBalances = async () => {
    if (!changedAccounts.length || !onUpdateAccount) return
    setSaving(true)
    try { for (const item of changedAccounts) await onUpdateAccount({ ...item, balance: Number(drafts[item.id] || 0) }) } finally { setSaving(false) }
  }
  const saveAccount = async form => { if (form.id) await onUpdateAccount?.(form); else await onCreateAccount?.(form); setEditingAccount(null) }
  const saveCard = async form => { if (form.id) await onUpdateCard?.(form); else await onCreateCard?.(form); setEditingCard(null) }

  return <div className="max-w-7xl mx-auto pb-20 flex flex-col gap-5">
    <Card padding="p-2"><div className="grid grid-cols-3 gap-1">{[['summary','Resumen'],['accounts','Cuentas'],['cards','Tarjetas']].map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`h-10 rounded-xl text-[11px] font-semibold ${tab === id ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)] hover:bg-[var(--hover)]'}`}>{label}{id === 'accounts' ? ` · ${activeAccounts.length}` : id === 'cards' ? ` · ${creditCards.filter(card => card.isActive !== false).length}` : ''}</button>)}</div></Card>

    {tab === 'summary' && <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Metric label="Saldo en cuentas" value={fmtCLP(totalBalance)} detail={`${activeAccounts.length} cuentas activas`} tone="dark"/>
        <Metric label="Reserva comprometida" value={fmtCLP(reserved)} detail={pendingPayables.length ? pendingPayables.map(item => item.personName || item.name).join(', ') : 'Sin deudas reservadas'} tone={reserved ? 'warning' : 'default'}/>
        <Metric label="Dinero realmente libre" value={fmtCLP(freeBalance)} detail="Saldo menos reservas y préstamos pendientes" tone={freeBalance < 0 ? 'danger' : 'default'}/>
        <Metric label="Facturas próximas" value={fmtCLP(nextCardsTotal)} detail={near.length ? `${near.length} tarjetas · ${near.map(item => shortDate(item.dueDate)).join(' y ')}` : 'Sin facturas próximas'} tone={gap < 0 ? 'danger' : 'default'}/>
      </div>

      <div className={`rounded-2xl border p-4 ${gap < 0 ? 'border-red-200 bg-red-50' : 'border-emerald-100 bg-emerald-50'}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.11em] font-bold opacity-60">Cobertura de próximos pagos</div><div className="text-[13px] font-bold mt-1">{gap >= 0 ? 'Tu saldo libre cubre las facturas próximas.' : `Faltan ${fmtCLP(Math.abs(gap))} para cubrirlas con el saldo libre actual.`}</div><div className="text-[10.5px] opacity-65 mt-1">La reserva de {fmtCLP(reserved)} no se usa en este cálculo. Ingreso mensual configurado: {fmtCLP(monthlyIncome)}.</div></div><div className={`font-mono text-[25px] font-bold ${gap < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{gap >= 0 ? '+' : '−'}{fmtCLP(Math.abs(gap))}</div></div>
      </div>

      <div className="grid lg:grid-cols-[1.05fr_1.4fr] gap-4">
        <Card padding="p-4 md:p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-bold">Punto de partida</div><div className="text-[10.5px] text-[var(--muted)] mt-1">Actualiza solo dinero disponible; no incluyas cupos de crédito.</div></div><button disabled={!changedAccounts.length || saving} onClick={saveBalances} className="h-9 px-3 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold disabled:opacity-35">{saving ? 'Guardando…' : 'Guardar saldos'}</button></div><div className="mt-4 divide-y divide-[var(--line)]">{activeAccounts.map(item => { const age = accountAge(item.updatedAt); return <div key={item.id} className="py-3 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-[var(--bg)] grid place-items-center">{TYPE_MAP[item.type]?.icon || '🏦'}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[12px] font-semibold">{item.name}</span><Badge tone={age.stale ? 'warn' : 'ok'}>{age.stale ? 'Revisar' : 'Vigente'}</Badge></div><div className="text-[9.5px] text-[var(--muted)] mt-0.5">{age.label}</div></div><div className="relative w-32"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]">$</span><input type="number" value={drafts[item.id] ?? ''} onChange={event => setDrafts(current => ({ ...current, [item.id]: event.target.value }))} className="w-full h-9 rounded-xl border border-[var(--line)] bg-[var(--bg)] pl-6 pr-2 text-right font-mono text-[12px]"/></div></div>})}</div></Card>

        <Card padding="p-4 md:p-5"><div><div className="text-[13px] font-bold">Próximas facturas reales</div><div className="text-[10.5px] text-[var(--muted)] mt-1">Se leen desde Facturación; no se reconstruyen desde gastos manuales.</div></div>{loadingCycles ? <div className="py-10 text-center text-[11px] text-[var(--muted)]">Actualizando ciclos…</div> : near.length ? <div className="mt-4 space-y-2">{near.map(cycle => { const card = creditCards.find(item => item.id === cycle.cardId); const bank = banks.find(item => item.id === card?.bank); const amount = cycleAmount(cycle); const days = daysBetween(today, dateOnly(cycle.dueDate)); return <div key={cycle.id} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3.5"><div className="flex items-start gap-3"><BankLogo bank={bank} size="sm"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[12px] font-semibold">{card?.name || 'Tarjeta'} {card?.lastFour ? `•••• ${card.lastFour}` : ''}</span><Badge tone={cycle.reportedAmountIsFinal ? 'ok' : 'info'}>{cycle.reportedAmountIsFinal ? 'Cerrada' : 'En curso'}</Badge></div><div className="text-[9.5px] text-[var(--muted)] mt-1">Vence {shortDate(cycle.dueDate)} · {days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`}</div></div><div className="font-mono text-[15px] font-bold">{fmtCLP(amount)}</div></div>{!cycle.reportedAmountIsFinal && cycle.estimatedAmount > cycle.reportedAmount && <div className="mt-2 text-[9.5px] text-[var(--amber-ink)]">Incluye estimación de {fmtCLP(cycle.estimatedAmount)}; el banco informa {fmtCLP(cycle.reportedAmount)}.</div>}</div>})}<div className="pt-2 flex justify-between text-[12px] font-bold"><span>Total próximo</span><span className="font-mono">{fmtCLP(nextCardsTotal)}</span></div></div> : <div className="py-10 text-center text-[11px] text-[var(--muted)]">No hay facturas próximas registradas.</div>}</Card>
      </div>

      <Card padding="p-4"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-ink)] grid place-items-center"><Icon name="repeat" size={15}/></div><div><div className="text-[12px] font-bold">Gastos directos recurrentes: {fmtCLP(directRecurringTotal)}/mes</div><div className="text-[10.5px] text-[var(--muted)] mt-1">Solo se muestran aparte los débitos, transferencias y efectivo. Los recurrentes cargados a crédito ya quedan dentro de la factura de cada tarjeta.</div></div></div></Card>
    </>}

    {tab === 'accounts' && <Card padding="p-0"><div className="px-4 py-3.5 border-b border-[var(--line)] flex items-center justify-between"><div><div className="text-[13px] font-bold">Cuentas disponibles</div><div className="text-[10px] text-[var(--muted)]">Total activo: {fmtCLP(totalBalance)}</div></div><button onClick={() => setEditingAccount({ ...BLANK_ACCOUNT })} className="h-9 px-3 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold"><Icon name="plus" size={11}/> Nueva cuenta</button></div><div className="divide-y divide-[var(--line)]">{accounts.map(item => { const meta = TYPE_MAP[item.type] || ACCOUNT_TYPES[0]; const bank = banks.find(row => row.id === item.bankId); const age = accountAge(item.updatedAt); return <div key={item.id} className={`p-4 flex items-center gap-3 ${item.active ? '' : 'opacity-50'}`}><div className="w-10 h-10 rounded-xl bg-[var(--bg)] grid place-items-center text-[18px]">{meta.icon}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[13px] font-semibold">{item.name}</span><Badge tone="muted">{meta.label}</Badge>{!item.active && <Badge tone="muted">Inactiva</Badge>}</div><div className="text-[10px] text-[var(--muted)] mt-1">{bank?.label || 'Sin institución'} · {age.label}</div></div><div className="font-mono text-[16px] font-bold">{fmtCLP(item.balance || 0)}</div><div className="flex gap-1"><button onClick={() => setEditingAccount({ ...item })} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="pencil" size={11}/></button><button onClick={() => window.confirm('¿Eliminar esta cuenta?') && onDeleteAccount?.(item.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center"><Icon name="trash" size={11}/></button></div></div>})}</div></Card>}

    {tab === 'cards' && <Card padding="p-0"><div className="px-4 py-3.5 border-b border-[var(--line)] flex items-center justify-between"><div><div className="text-[13px] font-bold">Tarjetas de crédito</div><div className="text-[10px] text-[var(--muted)]">Los montos reales se administran en Facturación.</div></div><button onClick={() => setEditingCard({ ...BLANK_CARD })} className="h-9 px-3 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold"><Icon name="plus" size={11}/> Nueva tarjeta</button></div><div className="divide-y divide-[var(--line)]">{creditCards.map(item => { const bank = banks.find(row => row.id === item.bank); return <div key={item.id} className={`p-4 flex items-center gap-3 ${item.isActive === false ? 'opacity-50' : ''}`}><BankLogo bank={bank} size="md"/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[13px] font-semibold">{item.name}</span>{item.lastFour && <span className="font-mono text-[10px] text-[var(--muted)]">•••• {item.lastFour}</span>}{item.isActive === false && <Badge tone="muted">Inactiva</Badge>}</div><div className="text-[10px] text-[var(--muted)] mt-1">Cierra día {item.billingDay || '—'} · paga día {item.paymentDueDay || '—'}{item.creditLimit ? ` · cupo ${fmtCLP(item.creditLimit)}` : ''}</div></div><div className="flex gap-1"><button onClick={() => setEditingCard({ ...item })} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="pencil" size={11}/></button><button onClick={() => window.confirm('¿Eliminar esta tarjeta?') && onDeleteCard?.(item.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center"><Icon name="trash" size={11}/></button></div></div>})}</div></Card>}

    {editingAccount && <Modal title={editingAccount.id ? 'Editar cuenta' : 'Nueva cuenta'} onClose={() => setEditingAccount(null)}><AccountForm initial={editingAccount} banks={banks} onClose={() => setEditingAccount(null)} onSave={saveAccount}/></Modal>}
    {editingCard && <Modal title={editingCard.id ? 'Editar tarjeta' : 'Nueva tarjeta'} onClose={() => setEditingCard(null)}><CardForm initial={editingCard} banks={banks} onClose={() => setEditingCard(null)} onSave={saveCard}/></Modal>}
  </div>
}
