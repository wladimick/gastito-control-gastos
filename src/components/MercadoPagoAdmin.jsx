import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtCLP } from '../lib/helpers'
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
    ok: ['Activo', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
    syncing: ['Sincronizando', 'bg-blue-50 text-blue-700 border-blue-200'],
    credentials_missing: ['Falta credencial', 'bg-amber-50 text-amber-800 border-amber-200'],
    error: ['Error', 'bg-red-50 text-red-700 border-red-200'],
    idle: ['En espera', 'bg-slate-50 text-slate-700 border-slate-200'],
  }
  const [label, cls] = map[status] || [status || 'Sin configurar', 'bg-slate-50 text-slate-700 border-slate-200']
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{label}</span>
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

  if (!authReady) return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Cargando…</div>
  if (!session) return (
    <div className="min-h-screen bg-[#f7f6f2] grid place-items-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xl font-bold">Mercado Pago · Gastito</div>
        <p className="mt-2 text-sm text-slate-500">Primero inicia sesión en Gastito y luego vuelve a esta página.</p>
        <a href="/" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Ir a Gastito</a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-slate-900">
      <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[.16em] font-bold text-slate-400">Gastito · Integración</div>
            <h1 className="mt-1 text-2xl font-bold">Mercado Pago</h1>
            <p className="mt-1 text-sm text-slate-500">Movimientos de tu dinero, conciliación y saldo automático.</p>
          </div>
          <div className="flex gap-2">
            <a href="/" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Volver a Gastito</a>
            <button onClick={syncNow} disabled={syncing} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          </div>
        </div>

        {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Estado</div>
            <div className="mt-3"><StatusBadge status={status?.status}/></div>
            <div className="mt-2 text-xs text-slate-500">Credencial: {status?.credential_state === 'configured' ? 'configurada' : status?.credential_state === 'invalid' ? 'inválida' : 'pendiente'}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Saldo detectado</div>
            <div className="mt-3 font-mono text-xl font-bold">{status?.last_balance == null ? '—' : fmtCLP(status.last_balance)}</div>
            <div className="mt-2 text-xs text-slate-500">{status?.last_balance_at ? formatDate(status.last_balance_at) : 'Esperando primera conciliación'}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Último sync correcto</div>
            <div className="mt-3 text-sm font-semibold">{status?.last_success_at ? formatDate(status.last_success_at) : 'Aún no'}</div>
            <div className="mt-2 text-xs text-slate-500">Automático cada hora</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Por revisar</div>
            <div className="mt-3 font-mono text-xl font-bold">{status?.reviewCount ?? 0}</div>
            <div className="mt-2 text-xs text-slate-500">Movimientos ambiguos</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold">Sincronización automática</div>
            <div className="text-xs text-slate-500 mt-1">El cron seguirá funcionando aunque falte la credencial; en ese caso no modifica datos.</div>
          </div>
          <button
            onClick={async () => { await setMercadoPagoEnabled(!status?.enabled); await load() }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${status?.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
          >
            {status?.enabled ? 'Activada' : 'Desactivada'}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="font-semibold">Movimientos Mercado Pago</div>
              <div className="text-xs text-slate-500 mt-1">Últimos {movements.length} · Entradas {fmtCLP(totals.in)} · Salidas {fmtCLP(totals.out)}</div>
            </div>
          </div>
          {loading ? <div className="p-8 text-center text-sm text-slate-400">Cargando movimientos…</div> : movements.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Aún no hay movimientos importados.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {movements.map(item => {
                const isCredit = Number(item.net_credit_amount || 0) > 0
                const amount = isCredit ? Number(item.net_credit_amount || 0) : Number(item.net_debit_amount || 0)
                return <div key={item.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold truncate">{item.merchant || item.description || 'Mercado Pago'}</div>
                      <span className="text-[10px] rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{CLASS_LABEL[item.classification] || item.classification}</span>
                      {item.review_status === 'review_required' && <span className="text-[10px] rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Revisar</span>}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{formatDate(item.occurred_at)}{item.category?.label ? ` · ${item.category.label}` : ''}</div>
                  </div>
                  <div className={`font-mono font-bold ${isCredit ? 'text-emerald-700' : 'text-slate-900'}`}>{isCredit ? '+' : '−'}{fmtCLP(amount)}</div>
                </div>
              })}
            </div>
          )}
        </div>

        {status?.last_error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700"><strong>Último error:</strong> {status.last_error}</div>}
      </div>
    </div>
  )
}
