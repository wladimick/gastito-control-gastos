import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtCLP } from '../lib/helpers'
import FinancialBrand from './FinancialBrand'
import ExternalMenu from './ExternalMenu'

function formatDate(value, withTime = false) {
  if (!value) return 'Sin fecha'
  const options = withTime
    ? { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' }
    : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }
  return new Intl.DateTimeFormat('es-CL', options).format(new Date(withTime ? value : `${String(value).slice(0, 10)}T12:00:00Z`))
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())
}

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10.5px] focus:outline-none focus:border-slate-500'
const BTN = 'h-9 inline-flex items-center justify-center rounded-xl px-3 text-[10px] font-semibold transition disabled:opacity-40'
const BTN_SMALL = 'h-8 inline-flex items-center justify-center rounded-xl px-2.5 text-[9px] font-semibold transition disabled:opacity-40'

function PersonAvatar({ name }) {
  const initials = String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-700 border border-violet-100 grid place-items-center text-[10px] font-bold shrink-0">{initials}</div>
}

function Kpi({ label, value, detail, tone = 'default' }) {
  const toneClass = tone === 'violet'
    ? 'bg-violet-50 border-violet-100 text-violet-950'
    : tone === 'green'
      ? 'bg-emerald-50 border-emerald-100 text-emerald-950'
      : 'bg-white border-slate-200 text-slate-900'
  return <div className={`rounded-2xl border p-3 ${toneClass}`}>
    <div className="text-[8.5px] uppercase tracking-wider opacity-55 font-bold">{label}</div>
    <div className="mt-1.5 font-mono text-[17px] md:text-[19px] font-bold tracking-tight leading-tight">{value}</div>
    <div className="mt-1 text-[8.5px] opacity-60 leading-relaxed">{detail}</div>
  </div>
}

export default function ReceivablesAdmin() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [receivables, setReceivables] = useState([])
  const [allocations, setAllocations] = useState([])
  const [transfers, setTransfers] = useState([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(null)
  const [linking, setLinking] = useState(null)
  const [selectedTransfer, setSelectedTransfer] = useState({})
  const [formOpen, setFormOpen] = useState(false)
  const [expandedItem, setExpandedItem] = useState(null)
  const [form, setForm] = useState({ person: '', name: '', amount: '', dueDate: '' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); setReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => subscription.unsubscribe()
  }, [])

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setMessage('')
    try {
      const [r, a, t] = await Promise.all([
        supabase.from('recurring_expenses')
          .select('id,name,person_name,amount,due_date,status,paid_at,notes,created_at')
          .eq('kind', 'receivable')
          .order('status', { ascending: true })
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('receivable_allocations')
          .select('id,receivable_id,mercadopago_movement_id,amount,paid_at,note,created_at')
          .order('created_at', { ascending: false }),
        supabase.from('mercadopago_movements')
          .select('id,occurred_at,merchant,description,net_credit_amount,classification,raw_data')
          .eq('classification', 'transfer_in')
          .gt('net_credit_amount', 0)
          .order('occurred_at', { ascending: false })
          .limit(100),
      ])
      if (r.error) throw r.error
      if (a.error) throw a.error
      if (t.error) throw t.error
      setReceivables(r.data || [])
      setAllocations(a.data || [])
      setTransfers(t.data || [])
    } catch (error) {
      setMessage(error?.message || 'No fue posible cargar las cuentas por cobrar.')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => { load() }, [load])

  const allocationByReceivable = useMemo(() => allocations.reduce((map, item) => {
    map[item.receivable_id] = (map[item.receivable_id] || 0) + Number(item.amount || 0)
    return map
  }, {}), [allocations])

  const allocationByTransfer = useMemo(() => allocations.reduce((map, item) => {
    if (item.mercadopago_movement_id) map[item.mercadopago_movement_id] = (map[item.mercadopago_movement_id] || 0) + Number(item.amount || 0)
    return map
  }, {}), [allocations])

  const groups = useMemo(() => {
    const map = new Map()
    for (const item of receivables) {
      const person = item.person_name || 'Sin persona'
      if (!map.has(person)) map.set(person, [])
      map.get(person).push(item)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [receivables])

  const pendingTotal = receivables.reduce((sum, item) => {
    if (item.status === 'paid') return sum
    return sum + Math.max(Number(item.amount || 0) - Number(allocationByReceivable[item.id] || 0), 0)
  }, 0)
  const paidTotal = receivables.reduce((sum, item) => sum + (item.status === 'paid' ? Number(item.amount || 0) : 0), 0)
  const today = todayKey()

  const availableTransfers = transfers.map(item => ({
    ...item,
    available: Math.max(Number(item.net_credit_amount || 0) - Number(allocationByTransfer[item.id] || 0), 0),
  })).filter(item => item.available > 0)

  const markPaid = async item => {
    setBusy(item.id)
    setMessage('')
    try {
      const { error } = await supabase.rpc('mark_receivable_paid', { p_receivable_id: item.id })
      if (error) throw error
      setMessage(`${item.person_name || item.name}: marcado como pagado.`)
      await load()
    } catch (error) { setMessage(error?.message || 'No se pudo marcar como pagado.') }
    finally { setBusy(null) }
  }

  const reopen = async item => {
    setBusy(item.id)
    setMessage('')
    try {
      const { error } = await supabase.from('recurring_expenses').update({ status: 'pending', paid_at: null }).eq('id', item.id)
      if (error) throw error
      await load()
    } catch (error) { setMessage(error?.message || 'No se pudo reabrir la deuda.') }
    finally { setBusy(null) }
  }

  const linkTransfer = async item => {
    const movementId = selectedTransfer[item.id]
    if (!movementId) return
    setBusy(item.id)
    setMessage('')
    try {
      const { data, error } = await supabase.rpc('allocate_receivable_payment', {
        p_receivable_id: item.id,
        p_movement_id: movementId,
        p_amount: null,
      })
      if (error) throw error
      setMessage(`Transferencia relacionada: ${fmtCLP(data?.allocated || 0)} aplicada a ${item.name}.`)
      setLinking(null)
      setSelectedTransfer(current => ({ ...current, [item.id]: '' }))
      await load()
    } catch (error) { setMessage(error?.message || 'No se pudo relacionar la transferencia.') }
    finally { setBusy(null) }
  }

  const createReceivable = async () => {
    const person = form.person.trim()
    const amount = Math.round(Number(form.amount || 0))
    if (!person || amount <= 0) return
    setBusy('new')
    setMessage('')
    try {
      const { error } = await supabase.from('recurring_expenses').insert({
        user_id: session.user.id,
        kind: 'receivable',
        name: form.name.trim() || `Dinero por cobrar · ${person}`,
        person_name: person,
        amount,
        due_date: form.dueDate || null,
        status: 'pending',
        active: true,
        auto_register: false,
        notes: 'Creado desde la sección Me deben.',
      })
      if (error) throw error
      setForm({ person: '', name: '', amount: '', dueDate: '' })
      setFormOpen(false)
      await load()
    } catch (error) { setMessage(error?.message || 'No se pudo crear la deuda.') }
    finally { setBusy(null) }
  }

  if (!ready) return <div className="min-h-screen grid place-items-center text-[11px] text-slate-500">Cargando…</div>
  if (!session) return <div className="min-h-screen bg-[#f7f6f2] grid place-items-center p-5"><div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><FinancialBrand brand="receivables"/><h1 className="text-[18px] font-bold">Me deben · Gastito</h1></div><p className="mt-3 text-[11px] text-slate-500">Primero inicia sesión en Gastito.</p><a href="/" className={`${BTN} mt-4 bg-slate-900 text-white`}>Ir a Gastito</a></div></div>

  return <div className="min-h-screen bg-[#f7f6f2] text-slate-900">
    <div className="mx-auto max-w-5xl p-4 md:p-7 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <FinancialBrand brand="receivables" size="lg"/>
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-[.14em] font-bold text-slate-400">Gastito · Cuentas por cobrar</div>
            <h1 className="mt-0.5 text-[21px] md:text-[22px] font-bold tracking-tight">Me deben</h1>
            <p className="mt-0.5 text-[10px] text-slate-500">Préstamos, cuentas compartidas y pagos pendientes.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ExternalMenu/>
          <button onClick={() => setFormOpen(v => !v)} className={`${BTN} bg-slate-900 text-white`}>+ Nueva</button>
        </div>
      </div>

      {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] text-amber-900">{message}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Pendiente total" value={fmtCLP(pendingTotal)} detail="Dinero que falta recibir" tone="violet"/>
        <Kpi label="Personas" value={groups.filter(([,items]) => items.some(i => i.status !== 'paid')).length} detail="Con deuda pendiente"/>
        <Kpi label="Ya pagado" value={fmtCLP(paidTotal)} detail="Historial conservado" tone="green"/>
        <Kpi label="Transferencias MP" value={availableTransfers.length} detail="Entradas sin asignar"/>
      </div>

      {formOpen && <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
        <div className="text-[11px] font-semibold">Nueva cuenta por cobrar</div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <input className={INPUT} placeholder="Persona, ej. Boris" value={form.person} onChange={e => setForm(v => ({...v, person:e.target.value}))}/>
          <input className={INPUT} placeholder="Concepto, ej. Préstamo" value={form.name} onChange={e => setForm(v => ({...v, name:e.target.value}))}/>
          <input type="number" className={INPUT} placeholder="Monto" value={form.amount} onChange={e => setForm(v => ({...v, amount:e.target.value}))}/>
          <input type="date" className={INPUT} value={form.dueDate} onChange={e => setForm(v => ({...v, dueDate:e.target.value}))}/>
        </div>
        <div className="mt-3 flex justify-end"><button disabled={!form.person.trim() || Number(form.amount) <= 0 || busy === 'new'} onClick={createReceivable} className={`${BTN} bg-slate-900 text-white`}>Guardar</button></div>
      </div>}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-[10px] text-slate-400">Cargando cuentas por cobrar…</div> : groups.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-[10px] text-slate-400">No hay cuentas por cobrar.</div> : groups.map(([person, items]) => {
        const personPending = items.reduce((sum, item) => item.status === 'paid' ? sum : sum + Math.max(Number(item.amount) - Number(allocationByReceivable[item.id] || 0), 0), 0)
        return <section key={person} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-3.5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-violet-50/55 to-white">
            <div className="flex items-center gap-2.5 min-w-0"><PersonAvatar name={person}/><div className="min-w-0"><div className="text-[12.5px] font-bold truncate">{person}</div><div className="text-[8.5px] text-slate-500 mt-0.5">{items.length} concepto{items.length === 1 ? '' : 's'}</div></div></div>
            <div className="text-right"><div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Pendiente</div><div className="font-mono text-[15px] font-bold">{fmtCLP(personPending)}</div></div>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map(item => {
              const allocated = Number(allocationByReceivable[item.id] || 0)
              const remaining = item.status === 'paid' ? 0 : Math.max(Number(item.amount) - allocated, 0)
              const overdue = item.status !== 'paid' && item.due_date && String(item.due_date).slice(0,10) < today
              const itemAllocations = allocations.filter(a => a.receivable_id === item.id)
              const expanded = expandedItem === item.id
              return <div key={item.id} className="px-3.5 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="text-[10.5px] font-semibold truncate">{item.name}</div>
                      {item.status === 'paid' ? <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700">Pagado</span> : overdue ? <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[8px] font-semibold text-red-700">Vencido</span> : <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-700">Pendiente</span>}
                    </div>
                    <div className="mt-0.5 text-[8.5px] text-slate-500 truncate">{item.due_date ? `Fecha: ${formatDate(item.due_date)}` : 'Sin fecha acordada'}{allocated > 0 ? ` · ${fmtCLP(allocated)} conciliado` : ''}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[14px] font-bold">{fmtCLP(item.amount)}</div>
                    {item.status !== 'paid' && allocated > 0 && <div className="text-[8px] text-slate-500 mt-0.5">Falta {fmtCLP(remaining)}</div>}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <button onClick={() => setExpandedItem(expanded ? null : item.id)} className="text-[8.8px] font-semibold text-slate-600 underline underline-offset-2">{expanded ? 'Ocultar detalle' : 'Ver más detalle'}</button>
                  {!expanded && item.status !== 'paid' && <div className="text-[8px] text-slate-400">Acciones disponibles al abrir</div>}
                </div>

                {expanded && <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-100 p-3">
                  {item.notes && <div className="text-[9px] text-slate-600 leading-relaxed">{item.notes}</div>}
                  {itemAllocations.length > 0 && <div className={`${item.notes ? 'mt-2' : ''} text-[8.5px] text-emerald-700`}>{itemAllocations.map(a => `${fmtCLP(a.amount)} · ${formatDate(a.paid_at, true)}`).join(' · ')}</div>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.status === 'paid' ? <button disabled={busy === item.id} onClick={() => reopen(item)} className={`${BTN_SMALL} border border-slate-200 bg-white`}>Reabrir</button> : <button disabled={busy === item.id} onClick={() => markPaid(item)} className={`${BTN_SMALL} bg-emerald-600 text-white`}>Marcar pagado</button>}
                    <button onClick={() => setLinking(linking === item.id ? null : item.id)} className={`${BTN_SMALL} border border-[#EAD400] bg-[#FFF9D7] text-slate-900`}><FinancialBrand brand="mercadopago" size="sm"/><span className="ml-1.5">Relacionar MP</span></button>
                  </div>

                  {linking === item.id && <div className="mt-3 rounded-xl bg-white border border-slate-200 p-3">
                    <div className="text-[9.5px] font-semibold">Selecciona una transferencia entrante</div>
                    <div className="mt-2 flex flex-col md:flex-row gap-2">
                      <select className={`${INPUT} flex-1`} value={selectedTransfer[item.id] || ''} onChange={e => setSelectedTransfer(v => ({...v, [item.id]:e.target.value}))}>
                        <option value="">Seleccionar…</option>
                        {availableTransfers.map(t => <option key={t.id} value={t.id}>{formatDate(t.occurred_at, true)} · {fmtCLP(t.available)} disponible · {t.merchant || t.description || 'Transferencia'}</option>)}
                      </select>
                      <button disabled={!selectedTransfer[item.id] || busy === item.id} onClick={() => linkTransfer(item)} className={`${BTN_SMALL} bg-slate-900 text-white`}>Aplicar</button>
                    </div>
                    <div className="mt-1.5 text-[8.5px] text-slate-500">Gastito aplica automáticamente el menor valor entre lo pendiente y lo disponible en la transferencia.</div>
                  </div>}
                </div>}
              </div>
            })}
          </div>
        </section>
      })}
    </div>
  </div>
}
