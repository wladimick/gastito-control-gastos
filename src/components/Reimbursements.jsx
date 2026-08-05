import React, { useMemo, useState } from 'react'
import { Badge, Card, InfoTip, StatCard } from './ui'
import { Icon, fmtCLP, todayLocal } from '../lib/helpers'

const STATUS = {
  pending: { label: 'Por rendir', tone: 'warn' },
  submitted: { label: 'Rendido · esperando pago', tone: 'info' },
  approved: { label: 'Aprobado', tone: 'ok' },
  reimbursed: { label: 'Reembolsado', tone: 'ok' },
  excluded: { label: 'No rendir', tone: 'muted' },
  rejected: { label: 'Rechazado', tone: 'warn' },
}

const SUGGESTION_WORDS = [
  'openai', 'chatgpt', 'claude', 'wpdescargas', 'wp descargas',
  'cloudways', 'donweb', 'don web', 'dominio', 'hosting', 'filmora',
  'suscripcion', 'subscription',
]

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : ''
}

function formatDate(value) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${dateOnly(value)}T12:00:00Z`))
}

function endOfMonth(value) {
  const source = dateOnly(value) || todayLocal()
  const [year, month] = source.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

function sourceIds(movement) {
  if (!movement) return { expenseId: null, billingTransactionId: null }
  if (movement.source === 'billing') {
    return { expenseId: null, billingTransactionId: movement.rawId }
  }
  if (movement.source === 'reconciled') {
    return { expenseId: movement.rawId, billingTransactionId: movement.billingId || null }
  }
  return { expenseId: movement.rawId || movement.id, billingTransactionId: null }
}

function movementKey(movement) {
  const ids = sourceIds(movement)
  return `${ids.expenseId || ''}|${ids.billingTransactionId || ''}`
}

function isSuggested(movement) {
  const text = `${movement.description || ''} ${movement.notes || ''}`.toLowerCase()
  return SUGGESTION_WORDS.some(word => text.includes(word))
}

function createDraft(movement = null) {
  const ids = sourceIds(movement)
  const expenseDate = dateOnly(movement?.date) || todayLocal()
  return {
    id: null,
    ...ids,
    company: 'TIBOX',
    title: movement?.description || '',
    amount: Number(movement?.amount || 0),
    expenseDate,
    submissionDueDate: endOfMonth(expenseDate),
    expectedPaymentDate: '',
    status: 'pending',
    submittedAt: null,
    approvedAt: null,
    reimbursedAt: null,
    notes: movement
      ? `Origen: ${movement.cardName || movement.bank || movement.source || 'Gasto'}`
      : '',
  }
}

function Field({ label, children }) {
  return <label className="block"><span className="block mb-1.5 text-[10px] uppercase tracking-[0.1em] font-bold text-[var(--muted)]">{label}</span>{children}</label>
}

const inputClass = 'w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px] outline-none focus:border-[var(--ink)]'

function ReimbursementModal({ item, expenses, existing, onClose, onSave }) {
  const [form, setForm] = useState(item || createDraft())
  const linkedExpenseIds = new Set(existing.map(row => row.expenseId).filter(Boolean))
  const linkedBillingIds = new Set(existing.map(row => row.billingTransactionId).filter(Boolean))
  const candidates = (expenses || []).filter(movement => {
    if (Number(movement.amount || 0) <= 0) return false
    const ids = sourceIds(movement)
    return !(ids.expenseId && linkedExpenseIds.has(ids.expenseId))
      && !(ids.billingTransactionId && linkedBillingIds.has(ids.billingTransactionId))
  }).slice(0, 250)

  const selectedKey = form.expenseId || form.billingTransactionId
    ? `${form.expenseId || ''}|${form.billingTransactionId || ''}`
    : ''

  const selectMovement = key => {
    if (!key) {
      setForm(current => ({ ...createDraft(), company: current.company || 'TIBOX' }))
      return
    }
    const movement = candidates.find(row => movementKey(row) === key)
    if (movement) setForm(createDraft(movement))
  }

  const submit = event => {
    event.preventDefault()
    if (!form.title.trim()) return alert('Escribe el nombre de la rendición.')
    if (Number(form.amount || 0) <= 0) return alert('Ingresa un monto válido.')
    onSave({ ...form, amount: Number(form.amount || 0) })
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-black/45 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Cerrar"/>
      <form onSubmit={submit} className="relative w-full md:max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-2xl md:rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--bg-elev)] px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Rendiciones</div>
            <h2 className="text-[18px] font-semibold mt-1">{form.id ? 'Editar rendición' : 'Nueva rendición'}</h2>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 grid place-items-center rounded-xl border border-[var(--line)]"><Icon name="x" size={15}/></button>
        </div>

        <div className="p-5 grid md:grid-cols-2 gap-4">
          {!form.id && (
            <div className="md:col-span-2">
              <Field label="Vincular a un gasto existente">
                <select value={selectedKey} onChange={event => selectMovement(event.target.value)} className={inputClass}>
                  <option value="">Registro histórico o manual</option>
                  {candidates.map(movement => (
                    <option key={movementKey(movement)} value={movementKey(movement)}>
                      {formatDate(movement.date)} · {movement.description} · {fmtCLP(movement.amount)}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="mt-2 text-[10px] text-[var(--muted)]">Al vincularlo, Gastito evita que rindas dos veces el mismo movimiento.</p>
            </div>
          )}

          <Field label="Empresa o cliente">
            <input value={form.company} onChange={event => setForm(current => ({ ...current, company: event.target.value }))} className={inputClass}/>
          </Field>
          <Field label="Estado">
            <select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value }))} className={inputClass}>
              {Object.entries(STATUS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2"><Field label="Título"><input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className={inputClass}/></Field></div>
          <Field label="Monto"><input type="number" min="1" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} className={inputClass}/></Field>
          <Field label="Fecha del gasto"><input type="date" value={form.expenseDate} onChange={event => setForm(current => ({ ...current, expenseDate: event.target.value }))} className={inputClass}/></Field>
          <Field label="Plazo para rendir"><input type="date" value={form.submissionDueDate || ''} onChange={event => setForm(current => ({ ...current, submissionDueDate: event.target.value }))} className={inputClass}/></Field>
          <Field label="Pago esperado"><input type="date" value={form.expectedPaymentDate || ''} onChange={event => setForm(current => ({ ...current, expectedPaymentDate: event.target.value }))} className={inputClass}/></Field>
          <div className="md:col-span-2"><Field label="Notas"><textarea rows="3" value={form.notes || ''} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[12px] outline-none focus:border-[var(--ink)] resize-none"/></Field></div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--bg-elev)] px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-[var(--line)] text-[12px]">Cancelar</button>
          <button type="submit" className="h-10 px-4 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[12px] font-semibold">Guardar rendición</button>
        </div>
      </form>
    </div>
  )
}

export default function Reimbursements({ items, expenses, onCreate, onUpdate, onPatch, onDelete }) {
  const [tab, setTab] = useState('open')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const today = todayLocal()

  const linkedExpenseIds = useMemo(() => new Set(items.map(row => row.expenseId).filter(Boolean)), [items])
  const linkedBillingIds = useMemo(() => new Set(items.map(row => row.billingTransactionId).filter(Boolean)), [items])
  const suggestions = useMemo(() => (expenses || [])
    .filter(isSuggested)
    .filter(movement => {
      const ids = sourceIds(movement)
      return !(ids.expenseId && linkedExpenseIds.has(ids.expenseId))
        && !(ids.billingTransactionId && linkedBillingIds.has(ids.billingTransactionId))
    })
    .slice(0, 8), [expenses, linkedExpenseIds, linkedBillingIds])

  const pending = items.filter(item => item.status === 'pending')
  const awaiting = items.filter(item => ['submitted', 'approved'].includes(item.status))
  const reimbursed = items.filter(item => item.status === 'reimbursed')
  const overdue = pending.filter(item => item.submissionDueDate && item.submissionDueDate < today)
  const currentMonth = today.slice(0, 7)
  const reimbursedMonth = reimbursed.filter(item => dateOnly(item.reimbursedAt).slice(0, 7) === currentMonth)

  const visible = items.filter(item => {
    if (tab === 'open' && !['pending', 'submitted', 'approved'].includes(item.status)) return false
    if (tab === 'pending' && item.status !== 'pending') return false
    if (tab === 'awaiting' && !['submitted', 'approved'].includes(item.status)) return false
    if (tab === 'reimbursed' && item.status !== 'reimbursed') return false
    const needle = search.trim().toLowerCase()
    return !needle || `${item.title} ${item.company} ${item.notes}`.toLowerCase().includes(needle)
  })

  const total = rows => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)

  const transition = async (item, status) => {
    const now = new Date().toISOString()
    const patch = { status }
    if (status === 'submitted') patch.submittedAt = now
    if (status === 'approved') patch.approvedAt = now
    if (status === 'reimbursed') patch.reimbursedAt = now
    await onPatch(item.id, patch)
  }

  return (
    <div className="max-w-[1500px] mx-auto p-4 md:p-7 space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Reembolsos de empresa</div>
          <h2 className="text-[25px] md:text-[30px] font-semibold tracking-tight mt-1">Rendiciones</h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[var(--muted)]">Controla lo que pagaste personalmente, lo que ya rendiste y lo que todavía debe transferirte la empresa.</p>
        </div>
        <button type="button" onClick={() => setEditing(createDraft())} className="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[12px] font-semibold"><Icon name="plus" size={14}/>Nueva rendición</button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Por rendir" value={fmtCLP(total(pending))} sub={`${pending.length} gasto${pending.length === 1 ? '' : 's'} aún no enviado${pending.length === 1 ? '' : 's'}`} icon="list" info="Gastos pagados por ti que todavía no has informado formalmente a la empresa."/>
        <StatCard label="Esperando reembolso" value={fmtCLP(total(awaiting))} sub={`${awaiting.length} rendición${awaiting.length === 1 ? '' : 'es'} enviada${awaiting.length === 1 ? '' : 's'}`} icon="cash" tone="dark" info="Dinero que la empresa ya debería devolverte porque la rendición fue enviada o aprobada."/>
        <StatCard label="Vencidas" value={String(overdue.length)} sub={overdue.length ? 'Requieren atención' : 'Todo dentro de plazo'} icon="alert" info="Rendiciones cuyo plazo configurado ya pasó y todavía siguen sin enviarse."/>
        <StatCard label="Reembolsado este mes" value={fmtCLP(total(reimbursedMonth))} sub={`${reimbursedMonth.length} movimiento${reimbursedMonth.length === 1 ? '' : 's'}`} icon="check" info="Transferencias recibidas durante el mes actual por gastos que habías pagado personalmente."/>
      </div>

      {suggestions.length > 0 && (
        <Card className="border-amber-200 bg-[var(--amber-soft)]" padding="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[12px] font-semibold"><Icon name="alert" size={14}/>Posibles rendiciones detectadas <InfoTip content="Gastito reconoce palabras habituales en tus gastos de trabajo. Son sugerencias: nada se agrega hasta que tú lo confirmes."/></div>
              <p className="mt-1 text-[10px] text-[var(--amber-ink)]/70">Revisa estos movimientos para que no se te pase uno.</p>
            </div>
          </div>
          <div className="mt-3 grid md:grid-cols-2 xl:grid-cols-4 gap-2">
            {suggestions.map(movement => (
              <button key={movement.id} type="button" onClick={() => setEditing(createDraft(movement))} className="text-left rounded-xl border border-amber-200 bg-white/65 p-3 hover:bg-white transition">
                <div className="text-[11px] font-semibold truncate">{movement.description}</div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted)]"><span>{formatDate(movement.date)}</span><span className="font-mono text-[var(--ink)]">{fmtCLP(movement.amount)}</span></div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card padding="p-3 md:p-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex gap-1.5 overflow-x-auto">
            {[
              ['open', 'Abiertas'], ['pending', 'Por rendir'], ['awaiting', 'Esperando pago'],
              ['reimbursed', 'Reembolsadas'], ['all', 'Todas'],
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setTab(value)} className={`h-9 px-3 rounded-xl text-[11px] font-medium whitespace-nowrap ${tab === value ? 'bg-[var(--ink)] text-[var(--bg)]' : 'hover:bg-[var(--hover)] text-[var(--ink-2)]'}`}>{label}</button>
            ))}
          </div>
          <div className="relative lg:w-80">
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar título, empresa o nota..." className="w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] pl-9 pr-3 text-[11px] outline-none focus:border-[var(--ink)]"/>
          </div>
        </div>
      </Card>

      <Card padding="p-0" className="overflow-hidden">
        {visible.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="mx-auto w-11 h-11 rounded-full bg-[var(--hover)] grid place-items-center text-[var(--muted)]"><Icon name="cash" size={18}/></div>
            <div className="mt-3 text-[13px] font-semibold">No hay rendiciones en esta vista</div>
            <div className="mt-1 text-[11px] text-[var(--muted)]">Agrega un gasto o cambia el filtro.</div>
          </div>
        ) : visible.map(item => {
          const meta = STATUS[item.status] || STATUS.pending
          const isOverdue = item.status === 'pending' && item.submissionDueDate && item.submissionDueDate < today
          return (
            <div key={item.id} className="border-b last:border-b-0 border-[var(--line)] p-4 md:px-5 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-[var(--hover)] grid place-items-center shrink-0"><Icon name="cash" size={16}/></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[12px]">{item.title}</span><Badge tone={meta.tone}>{meta.label}</Badge>{isOverdue && <Badge tone="warn">Fuera de plazo</Badge>}</div>
                  <div className="mt-1 text-[10px] text-[var(--muted)]">{item.company} · gasto {formatDate(item.expenseDate)}{item.submissionDueDate ? ` · rendir antes del ${formatDate(item.submissionDueDate)}` : ''}</div>
                  {item.notes && <div className="mt-1 text-[10px] text-[var(--ink-2)] line-clamp-1">{item.notes}</div>}
                </div>
              </div>
              <div className="flex items-center justify-between lg:justify-end gap-3 lg:min-w-[390px]">
                <div className="font-mono text-[16px] font-semibold">{fmtCLP(item.amount)}</div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {item.status === 'pending' && <button type="button" onClick={() => transition(item, 'submitted')} className="h-8 px-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold">Marcar rendida</button>}
                  {item.status === 'submitted' && <button type="button" onClick={() => transition(item, 'approved')} className="h-8 px-3 rounded-lg border border-[var(--line)] text-[10px] font-semibold">Aprobada</button>}
                  {['submitted', 'approved'].includes(item.status) && <button type="button" onClick={() => transition(item, 'reimbursed')} className="h-8 px-3 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-ink)] text-[10px] font-semibold">Reembolsada</button>}
                  <button type="button" onClick={() => setEditing(item)} className="w-8 h-8 grid place-items-center rounded-lg border border-[var(--line)]" aria-label="Editar"><Icon name="pencil" size={13}/></button>
                  <button type="button" onClick={() => onDelete(item.id)} className="w-8 h-8 grid place-items-center rounded-lg text-[#A02828] hover:bg-[#FDECEC]" aria-label="Eliminar"><Icon name="trash" size={13}/></button>
                </div>
              </div>
            </div>
          )
        })}
      </Card>

      {editing && (
        <ReimbursementModal
          item={editing}
          expenses={expenses}
          existing={items}
          onClose={() => setEditing(null)}
          onSave={async value => {
            if (value.id) await onUpdate(value)
            else await onCreate(value)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
