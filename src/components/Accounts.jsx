import React, { useEffect, useMemo, useState } from 'react'
import { Badge, Card, Select } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'
import { useBanks } from '../services/banksService'
import { fetchBillingCycles } from '../services/billingCyclesService'
import { fetchMercadoPagoStatus } from '../services/mercadoPagoService'
import { fetchPayables } from '../services/recurringService'
import FinancialBrand, { brandForCard } from './FinancialBrand'

const ACCOUNT_TYPES = [
  { id: 'debito', label: 'Cuenta débito' },
  { id: 'billetera', label: 'Billetera' },
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'ahorro', label: 'Ahorro' },
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
function accountBrand(item) {
  const key = `${item?.name || ''} ${item?.bankId || item?.bank_id || ''}`.toLowerCase()
  if (key.includes('mercado')) return 'mercadopago'
  if (key.includes('falabella') || key.includes('cmr')) return 'falabella'
  if (key.includes('banco de chile') || key.includes('bchile')) return 'bchile'
  if (key.includes('banco estado') || key.includes('bancoestado') || key.includes('cuenta rut')) return 'bancoestado'
  return 'accounts'
}
function isMercadoPagoAccount(item) {
  return accountBrand(item) === 'mercadopago'
}
function isReservedPayable(item) {
  const text = `${item?.name || ''} ${item?.personName || item?.person_name || ''} ${item?.notes || ''}`.toLowerCase()
  return text.includes('reserva') || text.includes('papá') || text.includes('papa')
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
      <Field label="Tipo"><Select value={form.type} onChange={value => set('type', value)} options={ACCOUNT_TYPES.map(item => ({ value: item.id, label: item.label }))}/></Field>
      <Field label="Banco"><Select value={form.bankId || ''} onChange={value => set('bankId', value || null)} options={[{ value: '', label: 'Sin institución' }, ...banks.map(bank => ({ value: bank.id, label: bank.label }))]}/></Field>
      <div className="col-span-2"><Field label="Saldo total" hint="Ajuste manual excepcional. En fuentes sincronizadas, Gastito actualiza el saldo automáticamente."><input type="number" min="0" value={form.balance} onChange={event => set('balance', event.target.value)} className={`${INPUT} font-mono`}/></Field></div>
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

function MoneyMetric({ label, value, detail, tone = 'neutral' }) {
  const cls = tone === 'yellow'
    ? 'bg-[#FFF9C9] border-[#F0D800]'
    : tone === 'violet'
      ? 'bg-violet-50 border-violet-100 text-violet-950'
      : 'bg-[var(--bg-elev)] border-[var(--line)]'
  return <div className={`rounded-2xl border p-3.5 min-h-[102px] ${cls}`}>
    <div className="text-[9px] uppercase tracking-[0.12em] font-bold opacity-55">{label}</div>
    <div className="font-mono text-[20px] md:text-[22px] font-bold mt-2 tracking-tight">{value}</div>
    <div className="text-[9px] opacity-65 mt-1 leading-relaxed">{detail}</div>
  </div>
}

export default function Accounts({
  accounts = [], creditCards = [], payables = [],
  onCreateAccount, onUpdateAccount, onDeleteAccount, onCreateCard, onUpdateCard, onDeleteCard,
}) {
  const banks = useBanks()
  const [tab, setTab] = useState('summary')
  const [cycles, setCycles] = useState([])
  const [loadedPayables, setLoadedPayables] = useState([])
  const [mpStatus, setMpStatus] = useState(null)
  const [loadingCycles, setLoadingCycles] = useState(true)
  const [editingAccount, setEditingAccount] = useState(null)
  const [editingCard, setEditingCard] = useState(null)
  const [showEmptyAccounts, setShowEmptyAccounts] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([fetchBillingCycles(), fetchPayables(), fetchMercadoPagoStatus()]).then(([cycleResult, payableResult, mpResult]) => {
      if (cancelled) return
      if (cycleResult.status === 'fulfilled') setCycles(cycleResult.value || [])
      if (payableResult.status === 'fulfilled') setLoadedPayables(payableResult.value || [])
      if (mpResult.status === 'fulfilled') setMpStatus(mpResult.value || null)
    }).catch(console.error).finally(() => { if (!cancelled) setLoadingCycles(false) })
    return () => { cancelled = true }
  }, [])

  const payablesData = payables.length ? payables : loadedPayables
  const activeAccounts = accounts.filter(item => item.active !== false)
  const totalBalance = activeAccounts.reduce((sum, item) => sum + Number(item.balance || 0), 0)
  const mpAccount = activeAccounts.find(isMercadoPagoAccount)
  const otherAvailable = activeAccounts.filter(item => !isMercadoPagoAccount(item)).reduce((sum, item) => sum + Number(item.balance || 0), 0)
  const reservedCommitments = payablesData.filter(item => item.status !== 'paid' && isReservedPayable(item)).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const mpAvailable = mpStatus?.last_balance == null ? null : Number(mpStatus.last_balance || 0)
  const mpReserved = mpStatus?.reserved_partition_balance == null
    ? Math.max(Number(mpAccount?.balance || 0) - Number(mpAvailable || 0), 0)
    : Number(mpStatus.reserved_partition_balance || 0)
  const availableNow = mpAvailable == null ? Math.max(totalBalance - reservedCommitments, 0) : mpAvailable + otherAvailable
  const reserveYield = Math.max(mpReserved - reservedCommitments, 0)

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

  const nonZeroActiveAccounts = activeAccounts.filter(item => Number(item.balance || 0) !== 0)
  const emptyAccounts = accounts.filter(item => Number(item.balance || 0) === 0 || item.active === false)
  const visibleAccounts = showEmptyAccounts ? accounts : nonZeroActiveAccounts

  const saveAccount = async form => { if (form.id) await onUpdateAccount?.(form); else await onCreateAccount?.(form); setEditingAccount(null) }
  const saveCard = async form => { if (form.id) await onUpdateCard?.(form); else await onCreateCard?.(form); setEditingCard(null) }

  return <div className="max-w-7xl mx-auto pb-20 flex flex-col gap-4">
    <Card padding="p-2"><div className="grid grid-cols-3 gap-1">{[['summary','Resumen'],['accounts','Cuentas'],['cards','Tarjetas']].map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`h-10 rounded-xl text-[11px] font-semibold ${tab === id ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)] hover:bg-[var(--hover)]'}`}>{label}{id === 'accounts' ? ` · ${nonZeroActiveAccounts.length}` : id === 'cards' ? ` · ${creditCards.filter(card => card.isActive !== false).length}` : ''}</button>)}</div></Card>

    {tab === 'summary' && <>
      <div>
        <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">Tu dinero hoy</div>
        <div className="text-[12px] font-semibold mt-0.5">Qué puedes usar y qué está separado</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <div className="col-span-2 lg:col-span-1"><MoneyMetric label="Disponible real" value={fmtCLP(availableNow)} detail={mpAvailable != null ? `Mercado Pago ${fmtCLP(mpAvailable)}${otherAvailable ? ` · otras cuentas ${fmtCLP(otherAvailable)}` : ''}` : 'Saldo libre estimado'} tone="yellow"/></div>
        <MoneyMetric label="Reservas MP" value={fmtCLP(mpReserved)} detail={reservedCommitments ? `${fmtCLP(reservedCommitments)} comprometidos${reserveYield ? ` · ${fmtCLP(reserveYield)} de ganancia` : ''}` : 'Dinero separado dentro de Mercado Pago'} tone="violet"/>
        <MoneyMetric label="Total administrado" value={fmtCLP(totalBalance)} detail="Disponible + dinero reservado en tus cuentas"/>
      </div>

      <Card padding="p-0" className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div><div className="text-[9px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Próximos pagos</div><div className="text-[12px] font-semibold mt-0.5">Facturas reales de tarjetas</div></div>
          <div className="font-mono text-[13px] font-bold">{loadingCycles ? '…' : fmtCLP(nextCardsTotal)}</div>
        </div>
        {loadingCycles ? <div className="p-6 text-center text-[10px] text-[var(--muted)]">Actualizando facturación…</div> : near.length ? <div className="divide-y divide-[var(--line)]">{near.map(cycle => {
          const card = creditCards.find(item => item.id === cycle.cardId)
          const amount = cycleAmount(cycle)
          const days = daysBetween(today, dateOnly(cycle.dueDate))
          return <div key={cycle.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center px-4 py-3">
            <FinancialBrand brand={brandForCard(card)} size="md"/>
            <div className="min-w-0"><div className="text-[11px] font-semibold truncate">{card?.name || 'Tarjeta'} {card?.lastFour ? `•••• ${card.lastFour}` : ''}</div><div className="text-[8.5px] text-[var(--muted)] mt-0.5">Vence {shortDate(cycle.dueDate)} · {days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`}</div></div>
            <div className="text-right"><div className="font-mono text-[12px] font-bold">{fmtCLP(amount)}</div><div className="text-[8px] text-[var(--muted)] mt-0.5">{cycle.reportedAmountIsFinal ? 'Cerrada' : 'En curso'}</div></div>
          </div>
        })}</div> : <div className="p-6 text-center text-[10px] text-[var(--muted)]">No hay facturas próximas registradas.</div>}
      </Card>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-3.5 flex items-center justify-between gap-3">
        <div><div className="text-[11px] font-semibold">Administración manual</div><div className="text-[8.5px] text-[var(--muted)] mt-0.5">Solo úsala para cuentas que no se sincronizan automáticamente.</div></div>
        <button onClick={() => setTab('accounts')} className="h-9 px-3 rounded-xl border border-[var(--line)] text-[9.5px] font-semibold whitespace-nowrap">Ver cuentas</button>
      </div>
    </>}

    {tab === 'accounts' && <Card padding="p-0" className="overflow-hidden">
      <div className="px-4 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3">
        <div><div className="text-[13px] font-bold">Cuentas con saldo</div><div className="text-[9.5px] text-[var(--muted)]">Se ocultan las cuentas en $0 para reducir ruido.</div></div>
        <button onClick={() => setEditingAccount({ ...BLANK_ACCOUNT })} className="h-9 px-3 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[9.5px] font-semibold inline-flex items-center gap-1.5"><Icon name="plus" size={11}/> Nueva</button>
      </div>
      <div className="divide-y divide-[var(--line)]">{visibleAccounts.length ? visibleAccounts.map(item => {
        const meta = TYPE_MAP[item.type] || ACCOUNT_TYPES[0]
        const bank = banks.find(row => row.id === item.bankId)
        const age = accountAge(item.updatedAt)
        const brand = accountBrand(item)
        const isMp = brand === 'mercadopago'
        return <div key={item.id} className={`px-4 py-3 flex items-center gap-3 ${item.active === false ? 'opacity-50' : ''}`}>
          <FinancialBrand brand={brand} size="md"/>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className="text-[11.5px] font-semibold">{item.name}</span><Badge tone="muted" className="!text-[8px]">{meta.label}</Badge>{!item.active && <Badge tone="muted" className="!text-[8px]">Inactiva</Badge>}</div><div className="text-[8.5px] text-[var(--muted)] mt-0.5">{isMp && mpAvailable != null ? `Disponible ${fmtCLP(mpAvailable)} · reservas ${fmtCLP(mpReserved)}` : `${bank?.label || 'Sin institución'} · ${age.label}`}</div></div>
          <div className="font-mono text-[13px] font-bold whitespace-nowrap">{fmtCLP(item.balance || 0)}</div>
          <div className="flex gap-1"><button aria-label="Editar cuenta" onClick={() => setEditingAccount({ ...item })} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="pencil" size={11}/></button><button aria-label="Eliminar cuenta" onClick={() => window.confirm('¿Eliminar esta cuenta?') && onDeleteAccount?.(item.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center"><Icon name="trash" size={11}/></button></div>
        </div>
      }) : <div className="p-7 text-center text-[10px] text-[var(--muted)]">No hay cuentas con saldo.</div>}</div>
      {emptyAccounts.length > 0 && <div className="px-4 py-3 border-t border-[var(--line)]"><button onClick={() => setShowEmptyAccounts(value => !value)} className="w-full h-9 rounded-xl bg-[var(--soft)] text-[9.5px] font-semibold">{showEmptyAccounts ? 'Ocultar cuentas sin saldo' : `Ver cuentas sin saldo · ${emptyAccounts.length}`}</button></div>}
    </Card>}

    {tab === 'cards' && <Card padding="p-0" className="overflow-hidden">
      <div className="px-4 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3"><div><div className="text-[13px] font-bold">Tarjetas de crédito</div><div className="text-[9.5px] text-[var(--muted)]">La deuda real se lee desde Facturación.</div></div><button onClick={() => setEditingCard({ ...BLANK_CARD })} className="h-9 px-3 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[9.5px] font-semibold inline-flex items-center gap-1.5"><Icon name="plus" size={11}/> Nueva</button></div>
      <div className="divide-y divide-[var(--line)]">{creditCards.map(item => { const bank = banks.find(row => row.id === item.bank); return <div key={item.id} className={`px-4 py-3 flex items-center gap-3 ${item.isActive === false ? 'opacity-50' : ''}`}><FinancialBrand brand={brandForCard(item)} size="md"/><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="text-[11.5px] font-semibold">{item.name}</span>{item.lastFour && <span className="font-mono text-[8.5px] text-[var(--muted)]">•••• {item.lastFour}</span>}{item.isActive === false && <Badge tone="muted" className="!text-[8px]">Inactiva</Badge>}</div><div className="text-[8.5px] text-[var(--muted)] mt-0.5">{bank?.label || 'Sin institución'} · cierra {item.billingDay || '—'} · paga {item.paymentDueDay || '—'}</div></div><div className="flex gap-1"><button aria-label="Editar tarjeta" onClick={() => setEditingCard({ ...item })} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="pencil" size={11}/></button><button aria-label="Eliminar tarjeta" onClick={() => window.confirm('¿Eliminar esta tarjeta?') && onDeleteCard?.(item.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center"><Icon name="trash" size={11}/></button></div></div>})}</div>
    </Card>}

    {editingAccount && <Modal title={editingAccount.id ? 'Editar cuenta' : 'Nueva cuenta'} onClose={() => setEditingAccount(null)}><AccountForm initial={editingAccount} banks={banks} onClose={() => setEditingAccount(null)} onSave={saveAccount}/></Modal>}
    {editingCard && <Modal title={editingCard.id ? 'Editar tarjeta' : 'Nueva tarjeta'} onClose={() => setEditingCard(null)}><CardForm initial={editingCard} banks={banks} onClose={() => setEditingCard(null)} onSave={saveCard}/></Modal>}
  </div>
}
