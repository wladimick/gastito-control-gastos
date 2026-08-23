import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtCLP } from '../lib/helpers'
import { supabase } from '../lib/supabase'
import { fetchExternalIncomeEvents, fetchExternalIncomeSources } from '../services/externalIncomeService'

function money(amount, currency) {
  const value = Number(amount || 0)
  if (currency === 'CLP') return fmtCLP(value)
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2 }).format(value)
}

function shortDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Santiago' }).format(new Date(value))
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

  if (!authReady) return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Cargando…</div>
  if (!session) return <div className="min-h-screen bg-[#f7f6f2] grid place-items-center p-6"><div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-6"><h1 className="text-xl font-bold">Shopify / PayPal · Gastito</h1><p className="mt-2 text-sm text-slate-500">Primero inicia sesión en Gastito.</p><a href="/" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Ir a Gastito</a></div></div>

  return <div className="min-h-screen bg-[#f7f6f2] text-slate-900">
    <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[.16em] font-bold text-slate-400">Gastito · Ingreso externo</div>
          <h1 className="mt-1 text-3xl font-bold">Shopify Partners · PayPal</h1>
          <p className="mt-1 text-sm text-slate-500">Ingreso trimestral en USD. No se mezcla con tu ingreso mensual en CLP hasta que retires el dinero.</p>
        </div>
        <div className="flex gap-2"><a href="/" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Volver a Gastito</a><button onClick={load} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Actualizar</button></div>
      </div>

      {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-slate-900 text-white p-4"><div className="text-[10px] uppercase tracking-wider opacity-60 font-bold">Saldo PayPal</div><div className="mt-3 font-mono text-2xl font-bold">{source ? money(source.current_balance, source.currency) : '—'}</div><div className="mt-2 text-xs opacity-60">Saldo visible informado</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Próximo estimado</div><div className="mt-3 text-lg font-bold">{source?.next_expected_date ? shortDate(`${source.next_expected_date}T12:00:00-04:00`) : '—'}</div><div className="mt-2 text-xs text-slate-500">Frecuencia aproximada: cada {source?.frequency_months || 3} meses</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Recibido visible</div><div className="mt-3 font-mono text-2xl font-bold">{money(stats.receivedUsd, 'USD')}</div><div className="mt-2 text-xs text-slate-500">Pagos Shopify registrados</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Retirado a CLP</div><div className="mt-3 font-mono text-2xl font-bold">{fmtCLP(stats.withdrawnClp)}</div><div className="mt-2 text-xs text-slate-500">Retiros históricos visibles</div></div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <div className="font-semibold">Estado de integración: manual</div>
        <div className="mt-1 text-xs leading-relaxed text-blue-800">Gastito ya conoce esta fuente y su calendario, pero todavía no consulta PayPal automáticamente. Cuando conectemos la API, esta misma pantalla podrá actualizar saldo, pagos Shopify y retiros sin cambiar el modelo financiero.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100"><div className="font-semibold">Historial conocido</div><div className="text-xs text-slate-500 mt-1">Datos registrados desde la captura de PayPal.</div></div>
        {loading ? <div className="p-8 text-center text-sm text-slate-400">Cargando…</div> : events.length ? <div className="divide-y divide-slate-100">{events.map(event => <div key={event.id} className="p-4 flex items-start justify-between gap-4"><div className="min-w-0"><div className="font-semibold truncate">{event.description || (event.event_type === 'received' ? 'Ingreso' : 'Retiro')}</div><div className="mt-1 text-xs text-slate-500">{shortDate(event.occurred_at)}{event.destination ? ` · ${event.destination}` : ''}</div></div><div className={`font-mono font-bold whitespace-nowrap ${event.event_type === 'received' ? 'text-emerald-700' : 'text-slate-900'}`}>{event.event_type === 'received' ? '+' : '−'}{money(event.amount, event.currency)}</div></div>)}</div> : <div className="p-8 text-center text-sm text-slate-400">Sin movimientos registrados.</div>}
      </div>
    </div>
  </div>
}
