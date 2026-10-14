import React, { useEffect, useMemo, useState } from 'react'
import Login from './Login'
import './tripPlanner.css'
import { supabase, isConfigured } from '../lib/supabase'
import { monthlySavingSuggestion, tripSummary } from '../lib/tripMath'
import {
  fetchTripAdmin, fetchTripPublic, updateTripItem, addTripItem, addTripSaving,
  removeTripSaving, createTripShare, revokeTripShare, updateTripDecisions,
} from '../services/tripService'

const money = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0)
const dateLabel = value => value ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(String(value).slice(0,10) + 'T12:00:00Z')) : ''
const control = 'w-full h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] text-[var(--ink)] outline-none focus:border-emerald-500'
const card = 'trip-panel p-4 sm:p-6'
const statusName = { pendiente: 'Pendiente', cotizando: 'Cotizando', reservado: 'Reservado', pagado: 'Pagado' }
const statusTone = { pendiente: 'bg-slate-100 text-slate-700', cotizando: 'bg-amber-100 text-amber-800', reservado: 'bg-sky-100 text-sky-800', pagado: 'bg-emerald-100 text-emerald-800' }

function Status({ value }) {
  return <span className={'inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ' + (statusTone[value] || statusTone.pendiente)}>{statusName[value] || 'Pendiente'}</span>
}

function TextField({ label, value, onChange, type = 'text', placeholder = '' }) {
  return <label className="block min-w-0">
    <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">{label}</span>
    <input className={control} type={type} min={type === 'number' ? 0 : undefined} value={value ?? ''} onChange={event => onChange(event.target.value)} placeholder={placeholder}/>
  </label>
}

function Notice({ children }) {
  return <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900 leading-relaxed">{children}</div>
}

function Hero({ plan, admin }) {
  return <section className="trip-hero relative overflow-hidden rounded-[24px] text-white px-5 pt-5 pb-6 sm:px-9 sm:pt-8 sm:pb-8 min-h-[300px]">
    <div aria-hidden="true" className="absolute rounded-full bg-[#E8B25C] w-[86px] h-[86px] sm:w-[114px] sm:h-[114px] right-[11%] top-[18%] shadow-[0_0_45px_rgba(232,178,92,0.1)]"/>
    <div aria-hidden="true" className="trip-hero-wave trip-hero-wave-one"/>
    <div aria-hidden="true" className="trip-hero-wave trip-hero-wave-two"/>
    <div className="relative z-10">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] sm:text-[11px] tracking-[0.16em] font-bold uppercase text-[#9AD0CB]">Gastito · Viaje compartido</span>
        <span className="text-[10px] rounded-full border border-[#85B8B4] bg-white/5 px-3 py-1 text-[#C4E5DF]">{admin ? 'Administración' : 'Vista compartida · Solo lectura'}</span>
      </div>
      <div className="flex items-center gap-3 mt-7 sm:mt-8">
        <h1 className="trip-title text-4xl sm:text-[64px] font-bold tracking-[-0.04em] leading-none">Antofagasta</h1>
        <svg aria-hidden="true" className="text-[#E8B25C] w-7 h-7 sm:w-9 sm:h-9 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 9 15"/><path d="m22 2-8 20-4.5-8.5L1 9z"/></svg>
      </div>
      <p className="text-[#C5E1DB] mt-3 text-[13px] sm:text-sm">Nuestro viaje al matrimonio · Nicol y Wladimick</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-7">
        <div className="rounded-xl bg-white/10 border border-white/10 p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ACAC5]">Viernes 12 feb.</div>
          <div className="text-[13px] sm:text-[15px] font-bold mt-1">Viaje de ida y check-in</div>
          <div className="text-[11px] text-[#C7DFDC] mt-1.5">Curicó → Santiago → Antofagasta</div>
        </div>
        <div className="rounded-xl bg-[#B68D48]/20 border border-[#E8B25C]/35 p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#F0CE89]">Sábado 13 feb.</div>
          <div className="text-[13px] sm:text-[15px] font-bold mt-1">Matrimonio ♡</div>
          <div className="text-[11px] text-[#F4DFB7] mt-1.5">El día del matrimonio</div>
        </div>
        <div className="rounded-xl bg-white/10 border border-white/10 p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ACAC5]">Domingo 14 feb.</div>
          <div className="text-[13px] sm:text-[15px] font-bold mt-1">Regreso a Curicó</div>
          <div className="text-[11px] text-[#C7DFDC] mt-1.5">Vuelo con tiempo para volver tranquilos</div>
        </div>
      </div>
      <p className="mt-5 text-[11px] text-[#C7DFDC]/90 leading-relaxed max-w-[670px]">Ida y vuelta para dos personas. Mochila personal y equipaje de cabina opcional. Horarios y reservas por confirmar.</p>
    </div>
  </section>
}

const TRIP_CATEGORY_META = {
  Vuelos: '#0B5F63',
  Alojamiento: '#2E9C98',
  Traslados: '#7CCBC3',
  Comida: '#E8B25C',
  Regalo: '#C9794F',
  Equipaje: '#8FA3AD',
  Reserva: '#C9D6D9',
  Otros: '#5B6B73',
}
const TRIP_CATEGORY_ORDER = ['Vuelos', 'Alojamiento', 'Traslados', 'Comida', 'Regalo', 'Equipaje', 'Reserva', 'Otros']
const TRIP_DECISIONS = [
  'Cotizar vuelos directos Santiago ⇄ Antofagasta para 2 personas. Priorizar regreso domingo no demasiado tarde.',
  'Confirmar ubicación y hora del matrimonio antes de elegir el alojamiento.',
  'Revisar transporte Curicó ⇄ Santiago y transfer oficial en Antofagasta.',
  'Decidir monto del regalo y si necesitan 1 maleta de cabina para ropa formal.',
]

function BudgetBreakdown({ items = [] }) {
  const categoryTotals = items.reduce((all, item) => {
    const key = TRIP_CATEGORY_META[item.category] ? item.category : 'Otros'
    all[key] = (all[key] || 0) + Number(item.estimate || 0)
    return all
  }, {})
  const budget = Object.values(categoryTotals).reduce((a, b) => a + b, 0)
  const groups = TRIP_CATEGORY_ORDER.filter(key => categoryTotals[key] > 0).map(key => ({
    name: key, amount: categoryTotals[key], color: TRIP_CATEGORY_META[key],
    width: budget ? (categoryTotals[key] / budget * 100) + '%' : '0%',
  }))
  return <div className="mt-5 mb-3">
    <div className="flex w-full h-3 rounded-full overflow-hidden bg-[#E6EDEA]" role="img" aria-label="Distribución porcentual del presupuesto por categorías">
      {groups.map(part => <div key={part.name} title={part.name + ': ' + money(part.amount)} style={{ width: part.width, background: part.color }} />)}
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
      {groups.map(part => <div key={part.name} className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[#607478]">
        <span className="rounded-full h-2 w-2 shrink-0" style={{ background: part.color }} aria-hidden="true"/>
        <span>{part.name}</span><span className="trip-amount text-[#3B5658]">{money(part.amount)}</span>
      </div>)}
    </div>
  </div>
}

function BudgetRow({ item, admin, draft, onChange, onSave, busy, budgetTotal }) {
  const [opened, setOpened] = useState(false)
  return <div className="py-4 sm:py-5 border-b border-[#E2E9E6] last:border-b-0">
    <div className="flex flex-wrap gap-2 justify-between items-start">
      <div className="flex-1 min-w-[170px]">
        <div className="flex items-center gap-2 text-[10px] uppercase text-[#789092] font-bold tracking-[0.11em]"><span className="h-2 w-2 rounded-full" style={{ background: TRIP_CATEGORY_META[item.category] || TRIP_CATEGORY_META.Otros }}/>{item.category}</div>
        <div className="font-bold text-[13px] sm:text-[14px] mt-1 text-[#17393A]">{item.name}</div>
        {item.note && !opened && <p className="text-[11px] text-[var(--muted)] mt-1 leading-relaxed">{item.note}</p>}
      </div>
      <div className="text-right min-w-[116px]">
        <div className="trip-amount font-bold text-[15px] sm:text-[16px] text-[#17393A]">{money(item.estimate)}</div>
        {item.actual != null && <div className="text-[11px] text-emerald-700 mt-0.5">Real: {money(item.actual)}</div>}
        <div className="mt-1.5"><Status value={item.status}/></div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3 mt-2">
      {item.url && <a className="text-[11px] text-teal-700 hover:underline font-semibold" href={item.url} target="_blank" rel="noopener noreferrer">Consultar opción ↗</a>}
      {admin && <button type="button" onClick={() => setOpened(!opened)} className="text-[11px] text-[#086E6A] font-bold hover:underline">{opened ? 'Cerrar edición' : 'Editar presupuesto'}</button>}
    </div>
    <div className="h-[3px] rounded-full bg-[#E6EEEB] mt-3 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: budgetTotal ? (Number(item.estimate || 0) / budgetTotal * 100) + '%' : '0%', background: TRIP_CATEGORY_META[item.category] || TRIP_CATEGORY_META.Otros }}/>
    </div>
    {opened && admin && draft && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 p-3 rounded-xl bg-[var(--soft)]">
      <TextField label="Estimado CLP" type="number" value={draft.estimate} onChange={value => onChange('estimate', value)}/>
      <TextField label="Costo real CLP" type="number" value={draft.actual ?? ''} onChange={value => onChange('actual', value)} placeholder="Aún no confirmado"/>
      <label className="block"><span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">Estado</span>
        <select className={control} value={draft.status} onChange={e => onChange('status',e.target.value)}>
          {Object.entries(statusName).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <TextField label="Enlace de compra o reserva" value={draft.url || ''} onChange={value => onChange('url',value)} placeholder="https://"/>
      <label className="sm:col-span-2 block">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">Notas compartidas con Nicol</span>
        <textarea rows={2} className={control + ' !h-auto py-2'} value={draft.note || ''} onChange={e => onChange('note',e.target.value)}/>
      </label>
      <button type="button" disabled={busy} onClick={onSave} className="sm:col-span-2 rounded-xl bg-[#163D3C] text-white px-4 py-2.5 font-semibold text-[12px] disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar cambios'}</button>
    </div>}
  </div>
}

export default function TripPlanner({ token = '' }) {
  const admin = !token
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [edits, setEdits] = useState({})
  const [shareLink, setShareLink] = useState('')
  const [savingForm, setSavingForm] = useState({ name: 'Wladimick', amount: '', note: '' })
  const [newItem, setNewItem] = useState({ category: 'Otros', name: '', amount: '' })
  const [monthsOverride, setMonthsOverride] = useState(null)

  useEffect(() => {
    if (!admin || !supabase) { setAuthReady(true); return undefined }
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setSession(data.session); setAuthReady(true) }
    }).catch(err => { if (mounted) { setAuthReady(true); setError(err.message) } })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, value) => setSession(value))
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [admin])

  async function reload(userId) {
    const data = await fetchTripAdmin(userId)
    setPlan(data)
    setEdits(Object.fromEntries(data.items.map(item => [item.id, {
      estimate: item.estimate, actual: item.actual ?? '', status: item.status, note: item.note || '', url: item.url || '',
    }])))
  }

  useEffect(() => {
    if (!isConfigured || (admin && (!authReady || !session))) {
      if (authReady) setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    const task = admin ? fetchTripAdmin(session.user.id) : fetchTripPublic(token)
    task.then(data => {
      if (cancelled) return
      setPlan(data)
      if (admin) setEdits(Object.fromEntries(data.items.map(item => [item.id, {
        estimate: item.estimate, actual: item.actual ?? '', status: item.status, note: item.note || '', url: item.url || '',
      }])))
    }).catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [admin, token, session?.user?.id, authReady])

  const summary = useMemo(() => tripSummary(plan?.items, plan?.savings), [plan])
  const naturalSuggestion = useMemo(() => monthlySavingSuggestion(summary.remaining, plan?.startDate), [summary.remaining, plan?.startDate])
  const months = monthsOverride ?? naturalSuggestion.months
  const suggestion = {
    months,
    perPerson: Math.ceil(summary.remaining / Math.max(1, months) / 2 / 1000) * 1000,
    together: Math.ceil(summary.remaining / Math.max(1, months) / 1000) * 1000,
  }
  const doWork = async task => {
    setBusy(true)
    setError('')
    try { await task(); if (session) await reload(session.user.id) }
    catch (err) { setError(err.message || 'No se pudo guardar') }
    finally { setBusy(false) }
  }
  const handleSaveRow = item => doWork(() => updateTripItem(item.id, edits[item.id]))
  const updateChecklist = index => {
    if (!admin || !plan) return
    const checks = [...(plan.decisionChecks || [false,false,false,false])]
    checks[index] = !checks[index]
    doWork(() => updateTripDecisions(plan.id, checks))
  }
  const editRow = (id, key, value) => setEdits(previous => ({ ...previous, [id]: { ...previous[id], [key]: value } }))
  const handleShare = () => doWork(async () => {
    const value = await createTripShare(plan.id)
    setShareLink(window.location.origin + window.location.pathname + '?viaje=' + encodeURIComponent(value))
  })
  const handleRevoke = () => {
    if (window.confirm('¿Desactivar el acceso compartido actual? Nicol ya no podrá abrir ese enlace.')) {
      doWork(async () => { await revokeTripShare(plan.id); setShareLink('') })
    }
  }

  if (!isConfigured) return <div className="p-8">Gastito necesita conexión con Supabase para mostrar el viaje.</div>
  if (admin && !authReady) return <div className="p-8">Validando acceso…</div>
  if (admin && !session) return <Login/>
  if (loading) return <div className="min-h-screen p-12 text-center text-[var(--muted)]">Cargando nuestro viaje…</div>

  return <div className="trip-planner min-h-screen">
    <header className="border-b border-[#DFE8E4] bg-[#F2F6F3]">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex gap-3 items-center">
          <div className="rounded-xl bg-[#0C3F41] text-white w-10 h-10 grid place-items-center shadow-sm" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 15h4v4H5zM15 5h4v4h-4zM10 10h4v4h-4z" fill="currentColor" stroke="none"/><path d="m7 17 5-5 5-5"/></svg>
          </div>
          <div><div className="font-extrabold text-[16px] leading-tight">Gastito</div><p className="text-[11px] text-[#758C8B]">Viajes · planificación compartida</p></div>
        </div>
        {admin ? <a className="text-[12px] text-[#0A706D] font-semibold hover:underline flex items-center gap-1.5" href="/"><span aria-hidden="true">←</span> Volver a mis finanzas</a> : <div className="text-[12px] text-[#0A706D] font-semibold">Nuestro viaje ♡</div>}
      </div>
    </header>
    <main className="max-w-[1180px] mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5">
      {error && <div role="alert" className="border border-red-200 bg-red-50 text-red-800 rounded-xl px-4 py-3 text-[12px]">{error}</div>}
      {plan ? <>
        <Hero plan={plan} admin={admin}/>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className={card}><div className="text-[10px] text-[#768B8D] uppercase tracking-[0.12em] font-bold">Presupuesto</div><div className="trip-amount text-[19px] sm:text-[26px] font-bold mt-2">{money(summary.budget)}</div><p className="text-[11px] text-[#819193] mt-2">Estimación ajustable</p></div>
          <div className={card}><div className="text-[10px] text-[#768B8D] uppercase tracking-[0.12em] font-bold">Aportes juntos</div><div className="trip-amount text-[19px] sm:text-[26px] font-bold mt-2 text-[#0B796F]">{money(summary.saved)}</div><p className="text-[11px] text-[#819193] mt-2">Ahorro registrado</p></div>
          <div className="trip-panel bg-[#DDF2EE] border border-[#C9E8E3] p-4 sm:p-6"><div className="text-[10px] text-[#648D8A] uppercase tracking-[0.12em] font-bold">Por reunir</div><div className="trip-amount text-[19px] sm:text-[26px] font-bold mt-2 text-[#0A5F58]">{money(summary.remaining)}</div><p className="text-[11px] text-[#618F89] mt-2">Respecto al estimado</p></div>
          <div className={card}><div className="text-[10px] text-[#768B8D] uppercase tracking-[0.12em] font-bold">Gasto real</div><div className="trip-amount text-[19px] sm:text-[26px] font-bold mt-2">{money(summary.spent)}</div><p className="text-[11px] text-[#819193] mt-2">Pagos anotados</p></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
          <div className="space-y-5">
          <section className={card}>
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-bold text-[21px]">Avance de nuestro ahorro</h2><p className="text-[11px] text-[#819193] mt-1">Los aportes son registros manuales, no saldos bancarios automáticos.</p></div>
              <span className="trip-amount font-bold text-[27px] sm:text-[32px] text-[#0B7770]">{summary.progress}%</span>
            </div>
            <div className="h-[9px] rounded-full bg-[#E4EBE9] overflow-hidden mt-4">
              <div className="h-full rounded-full bg-[#0A817A] transition-all" style={{ width: summary.progress + '%' }}/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              {['Wladimick','Nicol'].map(name => <div key={name} className="rounded-xl bg-[#F1F5F3] p-3.5">
                <div className="text-[11px] text-[#718588]">{name}</div>
                <div className="trip-amount font-bold text-[16px] mt-1">{money(summary.byName[name])}</div>
                <div className="h-[4px] rounded-full bg-[#DAE5E2] overflow-hidden mt-3">
                  <div className="h-full bg-[#198D82]" style={{ width: Math.min(100, summary.budget ? summary.byName[name]/(summary.budget/2)*100 : 0) + '%' }}/>
                </div>
              </div>)}
              <div className="rounded-xl bg-[#DCF3EE] p-3.5">
                <div className="text-[10px] text-[#3F7976]">Aporte sugerido c/u por mes</div>
                <div className="trip-amount font-bold text-[16px] sm:text-[19px] mt-1 text-[#0B5D57]">{money(suggestion.perPerson)}</div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {admin && <div className="inline-flex items-center gap-1.5">
                    <button type="button" title="Menos meses" aria-label="Reducir meses" disabled={months <= 1} onClick={() => setMonthsOverride(Math.max(1, months - 1))} className="w-6 h-6 rounded-md bg-[#0B6461] text-white font-bold disabled:opacity-40">−</button>
                    <button type="button" title="Más meses" aria-label="Aumentar meses" disabled={months >= 24} onClick={() => setMonthsOverride(Math.min(24, months + 1))} className="w-6 h-6 rounded-md bg-[#0B6461] text-white font-bold disabled:opacity-40">+</button>
                  </div>}
                  <span className="text-[10px] text-[#547D7B]">Durante {suggestion.months} {suggestion.months === 1 ? 'mes' : 'meses'}, a partes iguales</span>
                </div>
              </div>
            </div>
          </section>
          <section className={card}>
            <div><h2 className="font-bold text-[21px]">Presupuesto detallado</h2><p className="text-[11px] text-[#7B8F90] mt-1">{plan.items.length} conceptos · precios referenciales hasta cotizar</p></div>
            <BudgetBreakdown items={plan.items}/>
            <div className="mt-2">{plan.items.map((item,index) => <BudgetRow key={item.id || index} item={item} budgetTotal={summary.budget} admin={admin} draft={edits[item.id]} onChange={(key,value) => editRow(item.id,key,value)} onSave={() => handleSaveRow(item)} busy={busy}/>)}</div>
            {admin && <form className="mt-5 border-t border-[var(--line)] pt-4 space-y-3" onSubmit={e => { e.preventDefault(); doWork(async () => { await addTripItem(plan.id,newItem.name,newItem.category,newItem.amount); setNewItem({category:'Otros',name:'',amount:''}) }) }}>
              <h3 className="text-[12px] font-bold">Agregar otro gasto</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <TextField label="Concepto" value={newItem.name} onChange={value => setNewItem(old => ({...old,name:value}))} placeholder="Ej: Peinado para la boda"/>
                <TextField label="Categoría" value={newItem.category} onChange={value => setNewItem(old => ({...old,category:value}))}/>
                <TextField label="Monto CLP" value={newItem.amount} type="number" onChange={value => setNewItem(old => ({...old,amount:value}))}/>
              </div>
              <button type="submit" disabled={busy} className="rounded-xl px-4 py-2 bg-[#163D3C] text-white text-[12px] font-semibold disabled:opacity-50">Agregar al presupuesto</button>
            </form>}
          </section>
          </div>
          <div className="space-y-5">
            <section className={card}>
              <h2 className="text-[19px] font-bold">Aportes al viaje</h2>
              <p className="text-[11px] text-[var(--muted)] mt-1">El registro no mueve dinero; confirma aportes que realmente separaron.</p>
              {admin && <form className="mt-4 space-y-3" onSubmit={e => {e.preventDefault();doWork(async () => {await addTripSaving(plan.id,savingForm.name,savingForm.amount,savingForm.note);setSavingForm(old => ({...old,amount:'',note:''}))})}}>
                <label className="block"><span className="text-[10px] uppercase text-[var(--muted)] font-semibold">Quién ahorró</span>
                  <select className={control + ' mt-1'} value={savingForm.name} onChange={e => setSavingForm(old => ({...old,name:e.target.value}))}><option>Wladimick</option><option>Nicol</option></select>
                </label>
                <TextField label="Monto aportado CLP" type="number" value={savingForm.amount} onChange={value => setSavingForm(old => ({...old,amount:value}))}/>
                <TextField label="Nota opcional (privada)" value={savingForm.note} onChange={value => setSavingForm(old => ({...old,note:value}))} placeholder="Ej: Ahorro de noviembre"/>
                <button type="submit" disabled={busy} className="w-full py-2.5 bg-[#7E9998] hover:bg-[#0C6460] text-white rounded-xl text-[12px] font-bold disabled:opacity-50">Registrar aporte</button>
              </form>}
              <div className="divide-y divide-[var(--line)] mt-4">
                {plan.savings.length === 0 && <p className="text-[12px] text-[var(--muted)] py-2">Aún no hay aportes registrados.</p>}
                {plan.savings.map((row,index) => <div key={row.id || index} className="flex items-center justify-between gap-2 py-2.5">
                  <div><div className="text-[12px] font-semibold">{row.name}</div><div className="text-[10px] text-[var(--muted)]">{dateLabel(row.date)}</div></div>
                  <div className="flex items-center gap-2"><strong className="font-mono text-[12px]">{money(row.amount)}</strong>
                  {admin && <button type="button" disabled={busy} aria-label="Eliminar aporte" className="text-red-700 text-[11px]" onClick={() => { if (window.confirm('¿Eliminar este aporte registrado?')) doWork(() => removeTripSaving(row.id)) }}>Quitar</button>}</div>
                </div>)}
              </div>
            </section>
            <section className={card}>
              <h2 className="text-[19px] font-bold">Próximas decisiones</h2>
              <div className="mt-5 space-y-4">
                {TRIP_DECISIONS.map((label,index) => {
                  const checked = Boolean(plan.decisionChecks?.[index])
                  return <div key={index} className="flex items-start gap-3">
                    <button type="button" aria-label={'Marcar decisión: ' + label} aria-pressed={checked} disabled={!admin || busy} onClick={() => updateChecklist(index)} className={'mt-0.5 w-[17px] h-[17px] shrink-0 rounded-[5px] border flex items-center justify-center disabled:cursor-default ' + (checked ? 'bg-[#0D746C] border-[#0D746C] text-white' : 'bg-white border-[#ADC1C0]')}>
                      {checked && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>}
                    </button>
                    <p className={'text-[12px] leading-relaxed ' + (checked ? 'line-through text-[#9CAFAA]' : 'text-[#345355]')}>{label}</p>
                  </div>
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-4">
                <a href="https://www.skyairline.com/flights/es-cl/vuelos-desde-santiago-a-antofagasta" target="_blank" rel="noopener noreferrer" className="text-[11px] underline text-teal-700">Ver vuelos SKY ↗</a>
                <a href="https://aeropuertoandressabella.cl/transfer/" target="_blank" rel="noopener noreferrer" className="text-[11px] underline text-teal-700">Transfer ANF ↗</a>
              </div>
            </section>
          </div>
        </div>
        {admin && <section className={card}>
          <h2 className="text-[19px] font-bold">Enlace para Nicol</h2>
          <p className="text-[12px] text-[var(--muted)] mt-1">Solo muestra este viaje, su presupuesto y aportes. No muestra cuentas, sueldos, facturas ni tarjetas de Gastito. Cualquiera con el enlace podrá leerlo.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button type="button" disabled={busy} onClick={handleShare} className="bg-[#163D3C] text-white rounded-xl px-4 py-2.5 text-[12px] font-bold disabled:opacity-50">{plan.shareActive ? 'Renovar enlace' : 'Crear enlace público'}</button>
            {plan.shareActive && <button type="button" disabled={busy} onClick={handleRevoke} className="border border-red-200 rounded-xl px-4 py-2.5 text-red-700 text-[12px]">Desactivar enlace</button>}
          </div>
          {shareLink && <div className="mt-3 rounded-xl bg-teal-50 p-3">
            <p className="text-[11px] font-semibold text-teal-900">Copia este enlace ahora; por seguridad no volverá a mostrarse después.</p>
            <p className="text-[11px] font-mono break-all mt-1">{shareLink}</p>
            <button type="button" className="text-[12px] underline font-semibold mt-2 text-teal-800" onClick={() => navigator.clipboard.writeText(shareLink)}>Copiar enlace</button>
          </div>}
          {plan.shareActive && !shareLink && <p className="text-[11px] text-[var(--muted)] mt-2">Hay un enlace activo. Puedes renovar uno nuevo si necesitas volver a copiarlo.</p>}
        </section>}
        <Notice>Los valores son estimaciones de planificación, no tarifas confirmadas. El total se ajusta al guardar cotizaciones; verificar condiciones de equipaje, horarios y beneficios bancarios antes de pagar.</Notice>
      </> : <div className={card}><h1 className="font-bold">Viaje no disponible</h1><p className="text-[12px] mt-2 text-[var(--muted)]">{error || 'No encontramos datos para este enlace.'}</p></div>}
    </main>
  </div>
}
