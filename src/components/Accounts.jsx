import React, { useState } from 'react'
import { Card, Badge, Select, BankLogo } from './ui'
import { Icon, fmtCLP, fmtCLPshort } from '../lib/helpers'
import { useBanks } from '../services/banksService'

const ACCOUNT_TYPES = [
  { id: 'debito',    label: 'Cuenta débito', icon: '🏦' },
  { id: 'billetera', label: 'Billetera',      icon: '📱' },
  { id: 'efectivo',  label: 'Efectivo',       icon: '💵' },
  { id: 'ahorro',    label: 'Ahorro',         icon: '🐷' },
]
const TYPE_MAP = Object.fromEntries(ACCOUNT_TYPES.map(t => [t.id, t]))

const BLANK_ACCOUNT = { name: '', type: 'debito', bankId: '', balance: '', active: true }
const BLANK_CARD    = { name: '', bank: '', lastFour: '', billingDay: '', paymentDueDay: '', creditLimit: '' }

const SHORT_MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function monthDiff(startStr, toStr) {
  const [sy, sm] = startStr.split('-').map(Number)
  const [ty, tm] = toStr.split('-').map(Number)
  return (ty - sy) * 12 + (tm - sm)
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">{label}</span>
      {children}
      {hint && <div className="text-[11px] text-[var(--muted)] mt-1">{hint}</div>}
    </label>
  )
}

const inp = "w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"

// ── Formulario de cuenta ─────────────────────────────────────────────────────

function AccountForm({ initial, onSave, onCancel, banks }) {
  const [f, setF] = useState(initial)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const valid = f.name.trim()

  return (
    <Card padding="p-5" className="border-[var(--ink)]/20">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-4">
        {initial.id ? 'Editar cuenta' : 'Nueva cuenta'}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Nombre">
          <input value={f.name} onChange={e => set('name', e.target.value)}
            placeholder="Cuenta RUT, Mach, Billetera…" autoFocus
            className={inp}/>
        </Field>
        <Field label="Tipo">
          <Select value={f.type} onChange={v => set('type', v)}
            options={ACCOUNT_TYPES.map(t => ({ value: t.id, label: t.label }))}/>
        </Field>
        <Field label="Banco / Institución">
          <Select value={f.bankId ?? ''} onChange={v => set('bankId', v || null)}
            options={[{ value: '', label: 'Sin banco' }, ...banks.map(b => ({ value: b.id, label: b.label }))]}/>
        </Field>
        <Field label="Saldo actual" hint="Actualiza manualmente cuando cambies de banco">
          <input type="text" inputMode="numeric" value={f.balance} onChange={e => set('balance', e.target.value)}
            placeholder="0" className={inp + ' font-mono col-span-2'}/>
        </Field>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} className="w-4 h-4"/>
            <span className="text-[13px]">Activa</span>
          </label>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] underline">Cancelar</button>
        <button onClick={() => valid && onSave(f)} disabled={!valid}
          className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium disabled:opacity-40">
          <Icon name="check" size={13}/> {initial.id ? 'Guardar cambios' : 'Crear cuenta'}
        </button>
      </div>
    </Card>
  )
}

// ── Formulario de tarjeta ─────────────────────────────────────────────────────

function CreditCardForm({ initial, onSave, onCancel, banks }) {
  const [f, setF] = useState(initial)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const valid = f.name.trim()

  return (
    <Card padding="p-5" className="border-[var(--ink)]/20">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-4">
        {initial.id ? 'Editar tarjeta' : 'Nueva tarjeta de crédito'}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Nombre tarjeta">
          <input value={f.name} onChange={e => set('name', e.target.value)}
            placeholder="Visa BCI, CMR Falabella…" autoFocus className={inp}/>
        </Field>
        <Field label="Banco">
          <select value={f.bank} onChange={e => set('bank', e.target.value)}
            className={inp}>
            <option value="">Sin banco</option>
            {banks.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="Últimos 4 dígitos" hint="Opcional">
          <input value={f.lastFour} maxLength={4}
            onChange={e => set('lastFour', e.target.value.replace(/\D/g,'').slice(0,4))}
            placeholder="1234" className={inp + ' font-mono'}/>
        </Field>
        <Field label="Día de facturación" hint="Día en que cierra el ciclo de compras.">
          <input type="number" min="1" max="31" value={f.billingDay}
            onChange={e => set('billingDay', e.target.value)}
            placeholder="20" className={inp + ' font-mono'}/>
        </Field>
        <Field label="Día de pago" hint="Día en que se paga la factura.">
          <input type="number" min="1" max="31" value={f.paymentDueDay}
            onChange={e => set('paymentDueDay', e.target.value)}
            placeholder="5" className={inp + ' font-mono'}/>
        </Field>
        <Field label="Límite de crédito" hint="Opcional">
          <input type="number" min="0" value={f.creditLimit}
            onChange={e => set('creditLimit', e.target.value)}
            placeholder="1500000" className={inp + ' font-mono'}/>
        </Field>
      </div>
      <div className="p-3 rounded-md bg-[var(--bg-elev)] border border-[var(--line)] text-[11.5px] text-[var(--muted)] leading-relaxed">
        <span className="font-medium text-[var(--ink-2)]">Ej:</span> cierre día <strong>20</strong>, pago día <strong>5</strong> → compras del 21 abr al 20 may se pagan el 5 jun.
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] underline">Cancelar</button>
        <button onClick={() => valid && onSave(f)} disabled={!valid}
          className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium disabled:opacity-40">
          <Icon name="check" size={13}/> {initial.id ? 'Guardar cambios' : 'Agregar tarjeta'}
        </button>
      </div>
    </Card>
  )
}

// ── Tab: Flujo de caja ────────────────────────────────────────────────────────

function CashflowTab({ accounts, creditCards, expenses, recurringList, installmentDebts }) {
  const today = new Date()
  const banks = useBanks()
  const activeAccounts = accounts.filter(a => a.active)
  const totalAvailable = activeAccounts.reduce((s, a) => s + (a.balance ?? 0), 0)

  // Dinero comprometido (por pagar, préstamos personales)
  const pendingPayables = (recurringList ?? []).filter(r => r.active && r.kind === 'payable' && r.status !== 'paid')
  const pendingPayableTotal = pendingPayables.reduce((s, r) => s + r.amount, 0)
  const usableBalance = totalAvailable - pendingPayableTotal

  // Compromisos fijos: solo gastos recurrentes (sin payables)
  const recurringTotal = (recurringList ?? [])
    .filter(r => r.active && r.kind === 'expense')
    .reduce((s, r) => s + r.amount, 0)

  // Cuotas activas para cálculo por tarjeta
  const activeDebts = (installmentDebts ?? []).filter(d => d.status === 'active')

  // Próximo pago por tarjeta — misma lógica que Dashboard
  const cardNextPayments = creditCards.filter(c => c.isActive !== false).map(card => {
    const bd = Number(card.billingDay ?? 20)
    const pd = Number(card.paymentDueDay ?? 5)

    let npMonth = today.getMonth()
    let npYear  = today.getFullYear()
    if (today.getDate() >= pd) {
      npMonth++
      if (npMonth > 11) { npMonth = 0; npYear++ }
    }
    const nextPayDate     = new Date(npYear, npMonth, pd)
    const nextPayMonthStr = `${npYear}-${String(npMonth + 1).padStart(2, '0')}`

    let bmMonth = npMonth - 1; let bmYear = npYear
    if (bmMonth < 0) { bmMonth = 11; bmYear-- }
    const cycleEnd = new Date(bmYear, bmMonth, bd)
    let csMonth = bmMonth - 1; let csYear = bmYear
    if (csMonth < 0) { csMonth = 11; csYear-- }
    const cycleStart = new Date(csYear, csMonth, bd + 1)

    const contadoAmount = (expenses ?? [])
      .filter(e => {
        if (e.type !== 'credito') return false
        if (card.bank && e.bank !== card.bank) return false
        if ((e.installments ?? 1) > 1) return false
        const d = new Date(e.date)
        return d >= cycleStart && d <= cycleEnd
      })
      .reduce((s, e) => s + (e.amount || 0), 0)

    const cardCuotas = activeDebts.filter(d => {
      if (card.bank && d.bank !== card.bank) return false
      if (!d.startMonth) return false
      const elapsed = monthDiff(d.startMonth, nextPayMonthStr)
      return elapsed >= 0 && elapsed < d.installments
    })
    const cuotasAmount = cardCuotas.reduce((s, d) => s + (d.monthlyAmount || 0), 0)
    const cuotasCount  = cardCuotas.length

    // Ciclo actual acumulado (dato informativo secundario)
    const openCycleStart = today.getDate() > bd
      ? new Date(today.getFullYear(), today.getMonth(), bd + 1)
      : new Date(today.getFullYear(), today.getMonth() - 1, bd + 1)
    const cycleCredit = (expenses ?? [])
      .filter(e => {
        const d = new Date(e.date)
        return d >= openCycleStart && e.type === 'credito' && (!card.bank || e.bank === card.bank)
      })
      .reduce((s, e) => s + e.amount, 0)

    return { card, nextPayDate, contadoAmount, cuotasAmount, cuotasCount,
             totalAmount: contadoAmount + cuotasAmount, cycleCredit }
  })

  const totalNextCardPayment = cardNextPayments.reduce((s, c) => s + c.totalAmount, 0)
  const freeBalance = usableBalance - totalNextCardPayment - recurringTotal
  const netColor = freeBalance >= 0 ? 'text-[var(--accent-ink)]' : 'text-[#A02828]'

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="wallet" size={12}/> {pendingPayableTotal > 0 ? 'Total en cuentas' : 'Disponible'}
          </div>
          <div className={`mt-2 font-mono text-[22px] tracking-tight leading-none ${totalAvailable > 0 ? 'text-[var(--accent-ink)]' : ''}`}>
            {fmtCLP(totalAvailable)}
          </div>
          {pendingPayableTotal > 0 ? (
            <div className="mt-1 flex flex-col gap-0.5">
              <div className="text-[10.5px] text-[var(--amber-ink)]">− {fmtCLPshort(pendingPayableTotal)} comprometido</div>
              <div className="text-[10.5px] text-[var(--muted)]">Usable: <span className="font-mono text-[var(--accent-ink)]">{fmtCLPshort(usableBalance)}</span></div>
            </div>
          ) : (
            <div className="mt-1.5 text-[11px] text-[var(--muted)]">{activeAccounts.length} cuentas activas</div>
          )}
        </Card>

        <Card padding="p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="card" size={12}/> Próximo pago tarjetas
          </div>
          <div className="mt-2 font-mono text-[22px] tracking-tight leading-none">{fmtCLP(totalNextCardPayment)}</div>
          <div className="mt-1.5 text-[11px] text-[var(--muted)]">
            {cardNextPayments.length > 0
              ? `${cardNextPayments.length} tarjeta${cardNextPayments.length !== 1 ? 's' : ''} · contado + cuotas`
              : 'sin tarjetas activas'}
          </div>
        </Card>

        <Card padding="p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="repeat" size={12}/> Recurrentes fijos
          </div>
          <div className="mt-2 font-mono text-[22px] tracking-tight leading-none">{fmtCLP(recurringTotal)}</div>
          <div className="mt-1.5 text-[11px] text-[var(--muted)]">gastos recurrentes activos</div>
        </Card>

        <Card padding="p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="trend" size={12}/> Saldo libre estimado
          </div>
          <div className={`mt-2 font-mono text-[22px] tracking-tight leading-none ${netColor}`}>{fmtCLP(freeBalance)}</div>
          <div className="mt-1.5 text-[11px] text-[var(--muted)]">
            {freeBalance >= 0 ? 'Después de compromisos' : '⚠ Déficit estimado'}
          </div>
        </Card>
      </div>

      {/* Desglose + próximo pago de tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="p-5">
          <div className="font-semibold tracking-tight mb-4">Desglose</div>
          <div className="flex flex-col gap-2.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Total en cuentas</span>
              <span className="font-mono text-[var(--accent-ink)]">{fmtCLP(totalAvailable)}</span>
            </div>
            {pendingPayableTotal > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">— Dinero comprometido/por pagar</span>
                  <span className="font-mono text-[var(--amber-ink)]">{fmtCLP(pendingPayableTotal)}</span>
                </div>
                <div className="flex justify-between text-[12px] border-t border-[var(--line)] pt-1">
                  <span className="text-[var(--muted)] font-medium">= Disponible usable</span>
                  <span className="font-mono text-[var(--accent-ink)] font-medium">{fmtCLP(usableBalance)}</span>
                </div>
              </>
            )}
            <div className={`${pendingPayableTotal > 0 ? '' : 'border-t border-[var(--line)] pt-2'} flex justify-between`}>
              <span className="text-[var(--muted)]">— Próximo pago tarjetas</span>
              <span className="font-mono">{fmtCLP(totalNextCardPayment)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">— Gastos recurrentes/mes</span>
              <span className="font-mono">{fmtCLP(recurringTotal)}</span>
            </div>
            <div className="border-t border-[var(--line)] pt-2.5 flex justify-between font-semibold">
              <span>Saldo libre estimado</span>
              <span className={`font-mono ${netColor}`}>{fmtCLP(freeBalance)}</span>
            </div>
          </div>
        </Card>

        <Card padding="p-5">
          <div className="font-semibold tracking-tight mb-4">Próximo pago de tarjetas</div>
          {cardNextPayments.length === 0 ? (
            <div className="text-center py-4 text-[13px] text-[var(--muted)]">
              No hay tarjetas activas.{' '}
              <span className="underline cursor-pointer">Agrega una en la pestaña Tarjetas.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cardNextPayments.map(({ card, nextPayDate, contadoAmount, cuotasAmount, cuotasCount, totalAmount, cycleCredit }) => {
                const bank   = banks.find(b => b.id === card.bank)
                const payLbl = `${nextPayDate.getDate()} ${SHORT_MES[nextPayDate.getMonth()]}`
                const lim    = card.creditLimit ? Number(card.creditLimit) : null
                const util   = lim && lim > 0 ? (totalAmount / lim) * 100 : null
                return (
                  <div key={card.id} className="p-3 rounded-lg border border-[var(--line)] bg-[var(--bg)]">
                    <div className="flex items-center gap-2.5 mb-2">
                      <BankLogo bank={bank} size="sm"/>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[13px] truncate">
                          {card.name}
                          {card.lastFour && <span className="text-[var(--muted)] font-mono text-[11px] ml-1">···{card.lastFour}</span>}
                        </div>
                        <div className="text-[11px] text-[var(--muted)]">Pago el {payLbl}</div>
                      </div>
                      <div className="font-mono text-[14px] font-semibold shrink-0">{fmtCLP(totalAmount)}</div>
                    </div>
                    <div className="flex flex-col gap-1 pl-8">
                      {contadoAmount > 0 && (
                        <div className="flex justify-between text-[11.5px]">
                          <span className="text-[var(--muted)]">Compras contado</span>
                          <span className="font-mono">{fmtCLP(contadoAmount)}</span>
                        </div>
                      )}
                      {cuotasAmount > 0 && (
                        <div className="flex justify-between text-[11.5px]">
                          <span className="text-[var(--muted)]">Cuotas del mes · {cuotasCount} activa{cuotasCount !== 1 ? 's' : ''}</span>
                          <span className="font-mono">{fmtCLP(cuotasAmount)}</span>
                        </div>
                      )}
                      {contadoAmount === 0 && cuotasAmount === 0 && (
                        <div className="text-[11.5px] text-[var(--muted)]">Sin movimientos facturados</div>
                      )}
                      {cycleCredit > 0 && (
                        <div className="flex justify-between text-[10.5px] pt-0.5 border-t border-[var(--line)] text-[var(--muted)]">
                          <span>Ciclo actual acumulado</span>
                          <span className="font-mono">{fmtCLP(cycleCredit)}</span>
                        </div>
                      )}
                    </div>
                    {util !== null && (
                      <div className="mt-2">
                        <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{
                            width: Math.min(100, util) + '%',
                            background: util > 80 ? '#A02828' : util > 60 ? 'var(--amber-ink)' : 'var(--accent)'
                          }}/>
                        </div>
                        <div className="mt-1 text-[10.5px] text-[var(--muted)]">{util.toFixed(0)}% del límite</div>
                      </div>
                    )}
                  </div>
                )
              })}
              {cardNextPayments.length > 1 && (
                <div className="flex justify-between pt-1 border-t border-[var(--line)] text-[12.5px] font-semibold">
                  <span>Total tarjetas</span>
                  <span className="font-mono">{fmtCLP(totalNextCardPayment)}</span>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Accounts({
  accounts = [],
  creditCards = [],
  expenses = [],
  recurringList = [],
  installmentDebts = [],
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onCreateCard,
  onUpdateCard,
  onDeleteCard,
}) {
  const banks      = useBanks()
  const [tab, setTab]         = useState('accounts')
  const [formState, setFormState] = useState(null)
  const [formType, setFormType]   = useState(null) // 'account' | 'card'
  const isSupabase = Boolean(onCreateAccount)

  const totalAvailable = accounts.filter(a => a.active).reduce((s, a) => s + (a.balance ?? 0), 0)

  const openAccountForm = (item = null) => { setFormType('account'); setFormState(item ?? { ...BLANK_ACCOUNT }) }
  const openCardForm    = (item = null) => { setFormType('card');    setFormState(item ?? { ...BLANK_CARD }) }

  const handleSave = async (form) => {
    try {
      if (formType === 'account') {
        const toSave = { ...form, balance: Number(form.balance) || 0 }
        if (form.id) { if (onUpdateAccount) await onUpdateAccount(toSave) }
        else         { if (onCreateAccount) await onCreateAccount(toSave) }
      } else {
        if (form.id) { if (onUpdateCard) await onUpdateCard(form) }
        else         { if (onCreateCard) await onCreateCard(form) }
      }
    } catch (err) { alert(err.message) }
    setFormState(null)
  }

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('¿Eliminar esta cuenta?')) return
    try { if (onDeleteAccount) await onDeleteAccount(id) }
    catch (err) { alert(err.message) }
  }

  const handleDeleteCard = async (id) => {
    if (!window.confirm('¿Eliminar esta tarjeta?')) return
    try { if (onDeleteCard) await onDeleteCard(id) }
    catch (err) { alert(err.message) }
  }

  const TABS = [
    { id: 'accounts', label: 'Cuentas',          badge: accounts.filter(a => a.active).length },
    { id: 'cards',    label: 'Tarjetas crédito',  badge: creditCards.filter(c => c.isActive !== false).length },
    { id: 'cashflow', label: 'Flujo de caja',     badge: 0 },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Flujo de caja (propio, fuera del card de tabs) */}
      {tab === 'cashflow' && (
        <CashflowTab
          accounts={accounts}
          creditCards={creditCards}
          expenses={expenses}
          recurringList={recurringList}
          installmentDebts={installmentDebts}
        />
      )}

      <Card padding="p-0" className="overflow-hidden">
        {/* Tabs navigation */}
        <div className="px-2 pt-2 border-b border-[var(--line)] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setFormState(null) }}
                className={`px-3 h-9 inline-flex items-center gap-2 text-[12.5px] rounded-md transition
                  ${tab === t.id ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--ink-2)] hover:bg-[var(--hover)]'}`}>
                {t.label}
                {t.badge > 0 && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded
                    ${tab === t.id ? 'bg-[var(--bg)]/15 text-[var(--bg)]' : 'bg-[var(--line)] text-[var(--ink-2)]'}`}>{t.badge}</span>
                )}
              </button>
            ))}
          </div>
          {isSupabase && tab !== 'cashflow' && formState === null && (
            <button
              onClick={() => tab === 'accounts' ? openAccountForm() : openCardForm()}
              className="mr-2 mb-1 h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[12.5px] font-medium shrink-0">
              <Icon name="plus" size={12}/> {tab === 'accounts' ? 'Nueva cuenta' : 'Nueva tarjeta'}
            </button>
          )}
        </div>

        {/* Form inline */}
        {formState !== null && (
          <div className="p-4">
            {formType === 'account'
              ? <AccountForm   initial={formState} onSave={handleSave} onCancel={() => setFormState(null)} banks={banks}/>
              : <CreditCardForm initial={formState} onSave={handleSave} onCancel={() => setFormState(null)} banks={banks}/>
            }
          </div>
        )}

        {/* ── Cuentas ── */}
        {tab === 'accounts' && formState === null && (
          accounts.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-[32px] mb-3">🏦</div>
              <div className="font-semibold text-[15px] tracking-tight">Sin cuentas registradas</div>
              <div className="text-[13px] text-[var(--muted)] mt-1 mb-4">Agrega tus cuentas bancarias, billeteras digitales y efectivo disponible.</div>
              {isSupabase && (
                <button onClick={() => openAccountForm()}
                  className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
                  <Icon name="plus" size={13}/> Agregar cuenta
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="px-5 py-3 bg-[var(--bg)] border-b border-[var(--line)] flex items-center justify-between">
                <span className="text-[12px] text-[var(--muted)]">Total disponible (cuentas activas)</span>
                <span className="font-mono text-[20px] font-semibold text-[var(--accent-ink)]">{fmtCLP(totalAvailable)}</span>
              </div>
              <ul className="divide-y divide-[var(--line)]">
                {accounts.map(a => {
                  const typeInfo = TYPE_MAP[a.type] ?? ACCOUNT_TYPES[0]
                  const bank = banks.find(b => b.id === a.bankId)
                  return (
                    <li key={a.id} className={`px-5 py-3.5 flex items-center gap-3 ${!a.active ? 'opacity-50' : ''}`}>
                      <div className="w-9 h-9 rounded-md grid place-items-center text-[18px] bg-[var(--bg-elev)] shrink-0">
                        {typeInfo.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-[14px]">{a.name}</span>
                          <Badge tone="muted">{typeInfo.label}</Badge>
                          {!a.active && <Badge tone="muted">inactiva</Badge>}
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                          {bank?.label ?? '—'}
                        </div>
                      </div>
                      <div className="font-mono text-[17px] tabular-nums shrink-0 text-[var(--accent-ink)]">
                        {fmtCLP(a.balance ?? 0)}
                      </div>
                      {isSupabase && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openAccountForm({ ...a })}
                            className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[var(--muted)]">
                            <Icon name="pencil" size={12}/>
                          </button>
                          <button onClick={() => handleDeleteAccount(a.id)}
                            className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[#A02828]">
                            <Icon name="trash" size={12}/>
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )
        )}

        {/* ── Tarjetas ── */}
        {tab === 'cards' && formState === null && (
          creditCards.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-[32px] mb-3">💳</div>
              <div className="font-semibold text-[15px] tracking-tight">Sin tarjetas configuradas</div>
              <div className="text-[13px] text-[var(--muted)] mt-1 mb-4">
                Configura tus tarjetas para ver ciclos de facturación y deuda acumulada en Flujo de caja.
              </div>
              {isSupabase && (
                <button onClick={() => openCardForm()}
                  className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
                  <Icon name="plus" size={13}/> Agregar tarjeta
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {creditCards.map(card => {
                const bank = banks.find(b => b.id === card.bank)
                const isActive = card.isActive !== false
                return (
                  <li key={card.id} className={`px-5 py-3.5 flex items-center gap-3 ${!isActive ? 'opacity-50' : ''}`}>
                    <BankLogo bank={bank} size="md"/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[14px]">{card.name}</span>
                        {card.lastFour && <span className="font-mono text-[11px] text-[var(--muted)]">···{card.lastFour}</span>}
                        {!isActive && <Badge tone="muted">inactiva</Badge>}
                        {card.creditLimit && <Badge tone="info">{fmtCLPshort(Number(card.creditLimit))}</Badge>}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                        {bank?.label && <span>{bank.label} · </span>}
                        Factura día <span className="font-mono">{card.billingDay ?? '—'}</span>
                        {' '}· Paga día <span className="font-mono">{card.paymentDueDay ?? '—'}</span>
                      </div>
                    </div>
                    {isSupabase && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openCardForm({ ...card })}
                          className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[var(--muted)]">
                          <Icon name="pencil" size={12}/>
                        </button>
                        <button onClick={() => handleDeleteCard(card.id)}
                          className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[#A02828]">
                          <Icon name="trash" size={12}/>
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )
        )}
      </Card>
    </div>
  )
}
