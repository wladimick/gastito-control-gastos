import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtCLP } from '../lib/helpers'
import FinancialBrand from './FinancialBrand'
import {
  fetchMercadoPagoMovements,
  fetchMercadoPagoStatus,
  runMercadoPagoSync,
  setMercadoPagoEnabled,
} from '../services/mercadoPagoService'

const CLASS_LABEL = {
  expense: 'Gasto',
  income: 'Entrada',
  transfer_in: 'Transferencia entrada',
  transfer_out: 'Transferencia salida',
  refund: 'Devolución',
  fee: 'Costo financiero',
  other: 'Revisar',
}

const BTN = 'h-9 inline-flex items-center justify-center rounded-xl px-3 text-[10px] font-semibold transition disabled:opacity-50'

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Santiago',
  }).format(new Date(value))
}

function StatusBadge({ status }) {
  const map = {
    ok: ['Sincronizado', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
    syncing: ['Sincronizando', 'bg-blue-50 text-blue-700 border-blue-200'],
    credentials_missing: ['Falta credencial', 'bg-amber-50 text-amber-800 border-amber-200'],
    error: ['Error', 'bg-red-50 text-red-700 border-red-200'],
    idle: ['En espera', 'bg-white/85 text-slate-700 border-black/10'],
  }
  const [label, cls] = map[status] || [status || 'Sin configurar', 'bg-white/85 text-slate-700 border-black/10']
  return <span className={`h-8 inline-flex items-center rounded-full border px-2.5 text-[9.5px] font-semibold ${cls}`}>{label}</span>
}

function Kpi({ label, value, detail, accent = false }) {
  return <div className={`rounded-2xl border p-3.5 ${accent ? 'border-[#EAD400] bg-[#FFF9D7]' : 'border-slate-200 bg-white'}`}>
    <div className="text-[9px] uppercase tracking-[.11em] text-slate-400 font-bold">{label}</div>
    <div className="mt-2 font-mono text-[18px] md:text-[20px] font-bold tracking-tight leading-tight break-words">{value}</div>
    <div className="mt-1 text-[9px] text-slate-500 leading-relaxed">{detail}</div>
  </div>
}

export default function MercadoPagoAdmin() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [status, setStatus] = useState(null)
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => subscription.unsubscribe()
  }, [])

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const [nextStatus, nextMovements] = await Promise.all([
        fetchMercadoPagoStatus(),
        fetchMercadoPagoMovements({ limit: 80 }),
      ])
      setStatus(nextStatus)
      setMovements(nextMovements)
    } catch (error) {
      setMessage(error?.message || 'No fue posible cargar Mercado Pago.')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => movements.reduce((acc, item) => {
    acc.in += Number(item.net_credit_amount || 0)
    acc.out += Number(item.net_debit_amount || 0)
    return acc
  }, { in: 0, out: 0 }), [movements])

  const syncNow = async () => {
    setSyncing(true)
    setMessage('')
    try {
      const result = await runMercadoPagoSync()
      if (result?.status === 'credentials_missing') setMessage('La integración está lista. Solo falta agregar el Access Token de Mercado Pago.')
      else if (result?.status === 'ok') setMessage(`Sincronización completada: ${result.rowsInserted || 0} movimientos nuevos.`)
      else setMessage(result?.error || `Estado: ${result?.status || 'desconocido'}`)
      await load()
    } catch (error) {
      setMessage(error?.message || 'Falló la sincronización.')
    } finally {
      setSyncing(false)
    }
  }

  if (!authReady) return <div className="min-h-screen grid place-items-center text-[11px] text-slate-500">Cargando…</div>
  if (!session) return (
    <div className="min-h-screen bg-[#f7f6f2] grid place-items-center p-5">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><FinancialBrand brand="mercadopago"/><div className="text-[18px] font-bold">Mercado Pago · Gastito</div></div>
        <p className="mt-3 text-[11px] text-slate-500">Primero inicia sesión en Gastito y luego vuelve a esta página.</p>
        <a href="/" className={`${BTN} mt-4 bg-slate-900 text-white`}>Ir a Gastito</a>
      </div>
    </div>
  )

  const available = Number(status?.last_balance || 0)
  const reserved = Number(status?.reserved_partition_balance || 0)

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-slate-900">
      <div className="mx-auto max-w-6xl p-4 md:p-7 space-y-4">
        <section className="rounded-3xl border border-[#EAD400] bg-[#FFE600] p-4 md:p-5 overflow-hidden relative">
          <div className="absolute -right-12 -top-16 w-48 h-48 rounded-full bg-white/25"/>
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <FinancialBrand brand="mercadopago" size="lg"/>
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-[.14em] font-bold text-slate-700/60">Gastito · Dinero sincronizado</div>
                <h1 className="mt-0.5 text-[21px] md:text-[23px] font-bold tracking-tight">Mercado Pago</h1>
                <p className="mt-0.5 text-[10px] text-slate-700/75">Saldo, reservas y movimientos conciliados automáticamente.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <StatusBadge status={status?.status}/>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <a href="/" className={`${BTN} min-w-[104px] border border-black/10 bg-white/85 text-slate-900`}>Volver</a>
                <button onClick={syncNow} disabled={syncing} className={`${BTN} min-w-[138px] bg-[#171715] text-white`}>
                  {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] text-amber-900">{message}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Disponible" value={status?.last_balance == null ? '—' : fmtCLP(available)} detail={status?.last_balance_at ? `Actualizado ${formatDate(status.last_balance_at)}` : 'Esperando conciliación'} accent/>
          <Kpi label="En reservas MP" value={fmtCLP(reserved)} detail="Dinero separado dentro de Mercado Pago"/>
          <Kpi label="Último sync" value={status?.last_success_at ? formatDate(status.last_success_at) : 'Aún no'} detail="Automático cada hora"/>
          <Kpi label="Por revisar" value={status?.reviewCount ?? 0} detail="Movimientos ambiguos"/>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold">Sincronización automática</div>
            <div className="text-[9px] text-slate-500 mt-0.5">Credencial {status?.credential_state === 'configured' ? 'configurada' : status?.credential_state === 'invalid' ? 'inválida' : 'pendiente'} · cron horario</div>
          </div>
          <button
            onClick={async () => { await setMercadoPagoEnabled(!status?.enabled); await load() }}
            className={`${BTN} min-w-[104px] ${status?.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
          >
            {status?.enabled ? 'Activada' : 'Desactivada'}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11.5px] font-semibold">Movimientos</div>
              <div className="text-[8.5px] text-slate-500 mt-0.5">{movements.length} visibles · Entradas {fmtCLP(totals.in)} · Salidas {fmtCLP(totals.out)}</div>
            </div>
            <div className="hidden sm:flex"><FinancialBrand brand="mercadopago" size="sm"/></div>
          </div>
          {loading ? <div className="p-8 text-center text-[10px] text-slate-400">Cargando movimientos…</div> : movements.length === 0 ? (
            <div className="p-8 text-center text-[10px] text-slate-400">Aún no hay movimientos importados.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {movements.map(item => {
                const isCredit = Number(item.net_credit_amount || 0) > 0
                const amount = isCredit ? Number(item.net_credit_amount || 0) : Number(item.net_debit_amount || 0)
                return <div key={item.id} className="px-3.5 py-3 flex items-start gap-3">
                  <FinancialBrand brand="mercadopago" size="sm"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="text-[10.5px] font-semibold truncate">{item.merchant || item.description || 'Mercado Pago'}</div>
                      <span className="text-[8px] rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600">{CLASS_LABEL[item.classification] || item.classification}</span>
                      {item.review_status === 'review_required' && <span className="text-[8px] rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">Revisar</span>}
                    </div>
                    <div className="mt-0.5 text-[8.5px] text-slate-500">{formatDate(item.occurred_at)}{item.category?.label ? ` · ${item.category.label}` : ''}</div>
                  </div>
                  <div className={`font-mono text-[11px] font-bold ${isCredit ? 'text-emerald-700' : 'text-slate-900'}`}>{isCredit ? '+' : '−'}{fmtCLP(amount)}</div>
                </div>
              })}
            </div>
          )}
        </div>

        {status?.last_error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[9px] text-red-700"><strong>Último error:</strong> {status.last_error}</div>}
      </div>
    </div>
  )
}
