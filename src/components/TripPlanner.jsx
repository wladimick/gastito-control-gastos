import React, { useEffect, useMemo, useState } from 'react'
import Login from './Login'
import { supabase, isConfigured } from '../lib/supabase'
import { monthlySavingSuggestion, tripSummary } from '../lib/tripMath'
import {
  fetchTripAdmin, fetchTripPublic, updateTripItem, addTripItem, addTripSaving,
  removeTripSaving, createTripShare, revokeTripShare,
} from '../services/tripService'

const money = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0)
const dateLabel = value => value ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(String(value).slice(0,10) + 'T12:00:00Z')) : ''
const control = 'w-full h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] text-[var(--ink)] outline-none focus:border-emerald-500'
const card = 'rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-4 sm:p-5 shadow-sm'
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
  return <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#102D31] via-[#176669] to-[#309796] text-white p-5 sm:p-8">
    <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/10 blur-xl" aria-hidden="true"/>
    <div className="absolute right-7 bottom-[-80px] h-56 w-56 rounded-full bg-teal-200/10 blur-2xl" aria-hidden="true"/>
    <div className="relative">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] tracking-[0.14em] font-bold uppercase text-teal-100">Gastito · Viaje compartido</span>
        <span className="text-[10px] rounded-full border border-white/25 bg-white/10 px-2.5 py-1">{admin ? 'Administración' : 'Vista compartida · Solo lectura'}</span>
      </div>
      <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-7">Antofagasta <span aria-hidden="true">✈️</span></div>
      <p className="text-teal-100 mt-2 text-[13px] sm:text-sm">Nuestro viaje al matrimonio · Nicol y Wladimick</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-7">
        <div className="rounded-xl bg-white/10 p-3"><div className="text-[10px] uppercase text-teal-100">Viernes 12 feb.</div><div className="text-[13px] font-semibold mt-1">Viaje de ida y check-in</div></div>
        <div className="rounded-xl bg-white/20 p-3 border border-white/15"><div className="text-[10px] uppercase text-teal-100">Sábado 13 feb.</div><div className="text-[13px] font-semibold mt-1">Matrimonio 💍</div></div>
        <div className="rounded-xl bg-white/10 p-3"><div className="text-[10px] uppercase text-teal-100">Domingo 14 feb.</div><div className="text-[13px] font-semibold mt-1">Regreso a Curicó</div></div>
      </div>
      <p className="mt-5 text-[11px] text-teal-100/90 leading-relaxed">{plan.description}</p>
    </div>
  </div>
}

function BudgetRow({ item, admin, draft, onChange, onSave, busy }) {
  const [opened, setOpened] = useState(false)
  return <div className="py-4 border-b border-[var(--line)] last:border-b-0">
    <div className="flex flex-wrap gap-2 justify-between items-start">
      <div className="flex-1 min-w-[170px]">
        <div className="text-[10px] uppercase text-[var(--muted)] font-semibold tracking-wider">{item.category}</div>
        <div className="font-semibold text-[13px] mt-1">{item.name}</div>
        {item.note && !opened && <p className="text-[11px] text-[var(--muted)] mt-1 leading-relaxed">{item.note}</p>}
      </div>
      <div className="text-right min-w-[116px]">
        <div className="font-bold font-mono text-[14px]">{money(item.estimate)}</div>
        {item.actual != null && <div className="text-[11px] text-emerald-700 mt-0.5">Real: {money(item.actual)}</div>}
        <div className="mt-1.5"><Status value={item.status}/></div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3 mt-2">
      {item.url && <a className="text-[11px] text-teal-700 hover:underline font-semibold" href={item.url} target="_blank" rel="noopener noreferrer">Consultar opción ↗</a>}
      {admin && <button type="button" onClick={() => setOpened(!opened)} className="text-[11px] text-teal-800 font-semibold underline">{opened ? 'Cerrar edición' : 'Editar presupuesto'}</button>}
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
  const suggestion = useMemo(() => monthlySavingSuggestion(summary.remaining, plan?.startDate), [summary.remaining, plan?.startDate])
  const doWork = async task => {
    setBusy(true)
    setError('')
    try { await task(); if (session) await reload(session.user.id) }
    catch (err) { setError(err.message || 'No se pudo guardar') }
    finally { setBusy(false) }
  }
  const handleSaveRow = item => doWork(() => updateTripItem(item.id, edits[item.id]))
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

  return <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
    <header className="border-b border-[var(--line)] bg-white">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <div><strong className="text-[18px] tracking-tight">Gastito</strong><p className="text-[11px] text-[var(--muted)]">Viajes · planificación compartida</p></div>
        <a className="text-[12px] text-teal-700 font-semibold hover:underline" href={admin ? '/' : undefined}>{admin ? '← Volver a mis finanzas' : 'Nuestro viaje 💛'}</a>
      </div>
    </header>
    <main className="max-w-5xl mx-auto px-4 py-5 sm:py-8 space-y-5">
      {error && <div role="alert" className="border border-red-200 bg-red-50 text-red-800 rounded-xl px-4 py-3 text-[12px]">{error}</div>}
      {plan ? <>
        <Hero plan={plan} admin={admin}/>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={card}><div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-bold">Presupuesto</div><div className="font-mono text-xl sm:text-2xl font-bold mt-1">{money(summary.budget)}</div><p className="text-[10px] text-[var(--muted)] mt-1">Estimación ajustable</p></div>
          <div className={card}><div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-bold">Aportes juntos</div><div className="font-mono text-xl sm:text-2xl font-bold mt-1 text-teal-700">{money(summary.saved)}</div><p className="text-[10px] text-[var(--muted)] mt-1">Ahorro registrado</p></div>
          <div className={card}><div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-bold">Por reunir</div><div className="font-mono text-xl sm:text-2xl font-bold mt-1">{money(summary.remaining)}</div><p className="text-[10px] text-[var(--muted)] mt-1">Respecto al estimado</p></div>
          <div className={card}><div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-bold">Gasto real</div><div className="font-mono text-xl sm:text-2xl font-bold mt-1">{money(summary.spent)}</div><p className="text-[10px] text-[var(--muted)] mt-1">Pagos anotados</p></div>
        </div>
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="font-bold text-[16px]">Avance de nuestro ahorro</h2><p className="text-[11px] text-[var(--muted)] mt-1">Los aportes son registros manuales, no saldos bancarios automáticos.</p></div>
            <span className="font-bold font-mono text-lg">{summary.progress}%</span>
          </div>
          <div className="h-3 rounded-full bg-[var(--soft)] overflow-hidden mt-4"><div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-400" style={{ width: summary.progress + '%' }}/></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl bg-[var(--soft)] px-3 py-3"><div className="text-[11px] text-[var(--muted)]">Wladimick</div><div className="font-mono font-bold">{money(summary.byName.Wladimick)}</div></div>
            <div className="rounded-xl bg-[var(--soft)] px-3 py-3"><div className="text-[11px] text-[var(--muted)]">Nicol</div><div className="font-mono font-bold">{money(summary.byName.Nicol)}</div></div>
            <div className="rounded-xl bg-teal-50 px-3 py-3"><div className="text-[11px] text-teal-800">Aporte sugerido c/u por mes</div><div className="font-mono font-bold text-teal-950">{money(suggestion.perPerson)}</div><div className="text-[10px] text-teal-800">Durante {suggestion.months} mes(es), a partes iguales</div></div>
          </div>
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
          <section className={card}>
            <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-[17px]">Presupuesto detallado</h2><p className="text-[11px] text-[var(--muted)] mt-1">{plan.items.length} conceptos · precios referenciales hasta cotizar</p></div></div>
            <div className="mt-2">{plan.items.map((item,index) => <BudgetRow key={item.id || index} item={item} admin={admin} draft={edits[item.id]} onChange={(key,value) => editRow(item.id,key,value)} onSave={() => handleSaveRow(item)} busy={busy}/>)}</div>
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
          <div className="space-y-5">
            <section className={card}>
              <h2 className="text-[16px] font-bold">Aportes al viaje</h2>
              <p className="text-[11px] text-[var(--muted)] mt-1">El registro no mueve dinero; confirma aportes que realmente separaron.</p>
              {admin && <form className="mt-4 space-y-3" onSubmit={e => {e.preventDefault();doWork(async () => {await addTripSaving(plan.id,savingForm.name,savingForm.amount,savingForm.note);setSavingForm(old => ({...old,amount:'',note:''}))})}}>
                <label className="block"><span className="text-[10px] uppercase text-[var(--muted)] font-semibold">Quién ahorró</span>
                  <select className={control + ' mt-1'} value={savingForm.name} onChange={e => setSavingForm(old => ({...old,name:e.target.value}))}><option>Wladimick</option><option>Nicol</option></select>
                </label>
                <TextField label="Monto aportado CLP" type="number" value={savingForm.amount} onChange={value => setSavingForm(old => ({...old,amount:value}))}/>
                <TextField label="Nota opcional (privada)" value={savingForm.note} onChange={value => setSavingForm(old => ({...old,note:value}))} placeholder="Ej: Ahorro de noviembre"/>
                <button type="submit" disabled={busy} className="w-full py-2.5 bg-[#163D3C] text-white rounded-xl text-[12px] font-bold disabled:opacity-50">Registrar aporte</button>
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
              <h2 className="text-[16px] font-bold">Próximas decisiones</h2>
              <ol className="mt-3 space-y-3 text-[12px] leading-relaxed text-[var(--ink-2)]">
                <li><strong>1.</strong> Cotizar vuelos directos Santiago ⇄ Antofagasta para 2 personas. Priorizar regreso domingo no demasiado tarde.</li>
                <li><strong>2.</strong> Confirmar ubicación y hora del matrimonio antes de elegir el alojamiento.</li>
                <li><strong>3.</strong> Revisar transporte Curicó ⇄ Santiago y transfer oficial en Antofagasta.</li>
                <li><strong>4.</strong> Decidir monto del regalo y si necesitan 1 maleta de cabina para ropa formal.</li>
              </ol>
              <div className="flex flex-wrap gap-3 mt-4">
                <a href="https://www.skyairline.com/flights/es-cl/vuelos-desde-santiago-a-antofagasta" target="_blank" rel="noopener noreferrer" className="text-[11px] underline text-teal-700">Ver vuelos SKY ↗</a>
                <a href="https://aeropuertoandressabella.cl/transfer/" target="_blank" rel="noopener noreferrer" className="text-[11px] underline text-teal-700">Transfer ANF ↗</a>
              </div>
            </section>
          </div>
        </div>
        {admin && <section className={card}>
          <h2 className="text-[16px] font-bold">Enlace para Nicol</h2>
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
