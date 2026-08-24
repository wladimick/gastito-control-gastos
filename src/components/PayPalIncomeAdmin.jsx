import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtCLP } from '../lib/helpers'
import { supabase } from '../lib/supabase'
import { fetchExternalIncomeEvents, fetchExternalIncomeSources } from '../services/externalIncomeService'
import FinancialBrand from './FinancialBrand'
import ExternalMenu from './ExternalMenu'

function money(amount, currency) {
  const value = Number(amount || 0)
  if (currency === 'CLP') return fmtCLP(value)
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2 }).format(value)
}

function shortDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Santiago' }).format(new Date(value))
}

function Kpi({ label, value, detail, dark = false }) {
  return <div className={`rounded-2xl border p-3.5 ${dark ? 'bg-[#003087] text-white border-[#003087]' : 'bg-white border-slate-200'}`}>
    <div className="text-[9px] uppercase tracking-[.11em] font-bold opacity-55">{label}</div>
    <div className="mt-2 font-mono text-[19px] md:text-[21px] font-bold tracking-tight">{value}</div>
    <div className="mt-1 text-[9px] opacity-60 leading-relaxed">{detail}</div>
  </div>
}

export default function PayPalIncomeAdmin() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [source, setSource] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); setAuthReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => subscription.unsubscribe()
  }, [])

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setMessage('')
    try {
      const sources = await fetchExternalIncomeSources()
      const shopify = sources.find(item => item.provider === 'shopify_partners') || sources[0] || null
      setSource(shopify)
      setEvents(shopify ? await fetchExternalIncomeEvents(shopify.id, 100) : [])
    } catch (error) {
      setMessage(error?.message || 'No fue posible cargar Shopify / PayPal.')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => events.reduce((acc, event) => {
    if (event.event_type === 'received' && event.currency === 'USD') acc.receivedUsd += Number(event.amount || 0)
    if (event.event_type === 'withdrawal' && event.currency === 'CLP') acc.withdrawnClp += Number(event.amount || 0)
    return acc
  }, { receivedUsd: 0, withdrawnClp: 0 }), [events])

  if (!authReady) return <div className="min-h-screen grid place-items-center text-[11px] text-slate-500">Cargando…</div>
  if (!session) return <div className="min-h-screen bg-[#f7f6f2] grid place-items-center p-5"><div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><FinancialBrand brand="paypal"/><FinancialBrand brand="shopify"/><h1 className="text-[18px] font-bold">Shopify / PayPal</h1></div><p className="mt-3 text-[11px] text-slate-500">Primero inicia sesión en Gastito.</p><a href="/" className="mt-4 inline-flex rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-semibold text-white">Ir a Gastito</a></div></div>

  return <div className="min-h-screen bg-[#f7f6f2] text-slate-900">
    <div className="mx-auto max-w-5xl p-4 md:p-7 space-y-4">
      <section className="rounded-3xl border border-[#DCE6FA] bg-gradient-to-r from-[#F2F6FF] to-[#F1F8EC] p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex -space-x-2 shrink-0"><FinancialBrand brand="paypal" size="lg"/><FinancialBrand brand="shopify" size="lg"/></div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[.14em] font-bold text-slate-400">Gastito · Ingreso externo</div>
              <h1 className="mt-0.5 text-[20px] md:text-[22px] font-bold tracking-tight">Shopify Partners · PayPal</h1>
              <p className="mt-0.5 text-[10px] text-slate-500">Ingreso trimestral en USD; se convierte en liquidez CLP recién cuando lo retiras.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <ExternalMenu align="left"/>
            <button onClick={load} disabled={loading} className="h-10 rounded-xl bg-[#003087] px-3 text-[10px] font-semibold text-white disabled:opacity-50">{loading ? 'Actualizando…' : 'Actualizar'}</button>
          </div>
        </div>
      </section>

      {message && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] text-amber-900"><div>No fue posible actualizar Shopify / PayPal.</div><button type="button" onClick={load} className="mt-2 font-semibold underline">Reintentar</button></div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Saldo PayPal" value={source ? money(source.current_balance, source.currency) : '—'} detail="Saldo visible informado" dark/>
        <Kpi label="Próximo estimado" value={source?.next_expected_date ? shortDate(`${source.next_expected_date}T12:00:00-04:00`) : '—'} detail={`Cada ${source?.frequency_months || 3} meses aprox.`}/>
        <Kpi label="Recibido visible" value={money(stats.receivedUsd, 'USD')} detail="Pagos Shopify registrados"/>
        <Kpi label="Retirado a CLP" value={fmtCLP(stats.withdrawnClp)} detail="Retiros históricos visibles"/>
      </div>

      <details className="rounded-2xl border border-blue-200 bg-blue-50 p-3.5 group">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3"><span className="flex items-center gap-2"><FinancialBrand brand="paypal" size="sm"/><span className="text-[10.5px] font-semibold text-blue-950">Esta fuente se actualiza manualmente</span></span><span className="text-[13px] text-blue-800 group-open:rotate-45 transition-transform">+</span></summary>
        <div className="mt-2 text-[9px] leading-relaxed text-blue-800">Gastito conserva el calendario y el historial. Cuando conectemos la API de PayPal, esta vista podrá actualizar saldo, pagos Shopify y retiros automáticamente.</div>
      </details>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div><div className="text-[11.5px] font-semibold">Historial conocido</div><div className="text-[8.5px] text-slate-500 mt-0.5">Pagos y retiros registrados en Gastito.</div></div>
          <div className="flex gap-1.5"><FinancialBrand brand="shopify" size="sm"/><FinancialBrand brand="paypal" size="sm"/></div>
        </div>
        {loading ? <div className="p-8 text-center text-[10px] text-slate-400" aria-busy="true">Cargando…</div> : events.length ? <div className="divide-y divide-slate-100">{events.map(event => <div key={event.id} className="px-3.5 py-3 flex items-start justify-between gap-4"><div className="min-w-0 flex items-start gap-2.5"><FinancialBrand brand={event.event_type === 'received' ? 'shopify' : 'paypal'} size="sm"/><div className="min-w-0"><div className="text-[10.5px] font-semibold truncate">{event.description || (event.event_type === 'received' ? 'Ingreso' : 'Retiro')}</div><div className="mt-0.5 text-[8.5px] text-slate-500">{shortDate(event.occurred_at)}{event.destination ? ` · ${event.destination}` : ''}</div></div></div><div className={`font-mono text-[11px] font-bold whitespace-nowrap ${event.event_type === 'received' ? 'text-emerald-700' : 'text-slate-900'}`}>{event.event_type === 'received' ? '+' : '−'}{money(event.amount, event.currency)}</div></div>)}</div> : <div className="p-8 text-center"><div className="text-[11px] font-semibold text-slate-700">Aún no hay pagos ni retiros registrados</div><div className="mt-1 text-[9.5px] text-slate-500">Registra el próximo evento para que esta fuente aparezca en tus reportes.</div></div>}
      </div>
    </div>
  </div>
}
