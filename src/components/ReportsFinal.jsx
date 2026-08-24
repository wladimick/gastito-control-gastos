import React, { useEffect, useMemo, useState } from 'react'
import ReportsAudited from './ReportsAudited'
import { Card } from './ui'
import { fmtCLP } from '../lib/helpers'
import { fetchBillingCycles } from '../services/billingCyclesService'
import { fetchBillingForecasts } from '../services/billingForecastsService'
import { fetchMercadoPagoStatus } from '../services/mercadoPagoService'
import { coverReservePayables } from '../lib/financialModel'

function monthKey(value) {
  return String(value || '').slice(0, 7)
}

export default function ReportsFinal(props) {
  const [cycles, setCycles] = useState([])
  const [forecasts, setForecasts] = useState([])
  const [mpStatus, setMpStatus] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      fetchBillingCycles(),
      fetchBillingForecasts(),
      fetchMercadoPagoStatus(),
    ]).then(([cycleResult, forecastResult, mpResult]) => {
      if (cancelled) return
      if (cycleResult.status === 'fulfilled') setCycles(cycleResult.value || [])
      if (forecastResult.status === 'fulfilled') setForecasts(forecastResult.value || [])
      if (mpResult.status === 'fulfilled') setMpStatus(mpResult.value || null)
    })
    return () => { cancelled = true }
  }, [])

  const coveredPayables = useMemo(() => coverReservePayables(
    props.payables || [],
    Number(mpStatus?.reserved_partition_balance || 0),
  ), [props.payables, mpStatus])

  const forecastPayables = useMemo(() => {
    const actualCardMonths = new Set((cycles || [])
      .filter(cycle => cycle.status !== 'paid')
      .map(cycle => `${cycle.cardId}|${monthKey(cycle.dueDate) || cycle.cycleKey}`))

    return (forecasts || [])
      .filter(item => item.active !== false && Number(item.amount || 0) > 0)
      .filter(item => !actualCardMonths.has(`${item.cardId}|${item.cashMonth}`))
      .map(item => ({
        id: `billing-forecast-payable:${item.id}`,
        kind: 'payable',
        name: 'Piso futuro de tarjeta',
        personName: 'Estado de cuenta',
        amount: Number(item.amount || 0),
        dueDate: `${item.cashMonth}-15`,
        status: 'pending',
        active: true,
        forecastOnly: true,
        notes: item.notes || 'Monto futuro informado por estado de cuenta.',
      }))
  }, [cycles, forecasts])

  const safePayables = useMemo(
    () => [...coveredPayables, ...forecastPayables],
    [coveredPayables, forecastPayables],
  )

  const safeReceivables = useMemo(
    () => (props.receivables || []).filter(item => item.reimbursement),
    [props.receivables],
  )

  const uncertainReceivables = (props.receivables || [])
    .filter(item => item.status !== 'paid' && !item.reimbursement)
  const uncertainAmount = uncertainReceivables.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const forecastAmount = forecastPayables.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  if (props.dataState === 'loading') {
    return <div className="space-y-4" aria-busy="true" aria-label="Cargando reportes financieros">
      <div className="h-28 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] animate-pulse"/>
      <div className="grid md:grid-cols-2 gap-4">{[0, 1].map(item => <div key={item} className="h-48 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] animate-pulse"/>)}</div>
    </div>
  }

  if (props.dataState === 'error') {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><div className="text-[13px] font-semibold text-red-800">No fue posible cargar los reportes financieros</div><p className="mt-1 text-[10.5px] text-red-700">Actualiza los movimientos y vuelve a intentarlo para evitar analizar datos incompletos.</p></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[9.5px] uppercase tracking-[.13em] text-[var(--muted)] font-bold">Flujo · Resumen mensual</div>
        <h1 className="text-[21px] md:text-[22px] font-bold tracking-tight mt-1">Reportes financieros</h1>
        <p className="text-[10px] text-[var(--muted)] mt-1 max-w-2xl">Revisa el consumo, los ingresos y los compromisos del mes elegido sin contar una compra dos veces.</p>
      </div>
      {(uncertainAmount > 0 || forecastAmount > 0) && (
        <Card padding="p-0" className="overflow-hidden">
          <details className="group">
            <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-3"><div><div className="text-[11px] font-semibold">Ver supuestos y cobros aún no confirmados</div><div className="text-[9px] text-[var(--muted)] mt-1">Se mantienen fuera del flujo base hasta tener evidencia.</div></div><span className="text-[13px] text-[var(--muted)] group-open:rotate-45 transition-transform">+</span></summary>
          <div className="border-t border-[var(--line)] p-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold">Cobros personales no confirmados</div>
              <div className="font-mono text-[16px] font-bold mt-1">{fmtCLP(uncertainAmount)}</div>
              <div className="text-[9.5px] text-[var(--muted)] mt-1">Se muestran como dinero por cobrar en su módulo, pero no mejoran el flujo base hasta que realmente se cobren.</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold">Pisos futuros de tarjetas</div>
              <div className="font-mono text-[16px] font-bold mt-1">{fmtCLP(forecastAmount)}</div>
              <div className="text-[9.5px] text-[var(--muted)] mt-1">Solo se usan cuando todavía no existe una factura real para esa tarjeta y mes; la factura real siempre tiene prioridad.</div>
            </div>
          </div>
          </div>
          </details>
        </Card>
      )}
      <ReportsAudited
        {...props}
        payables={safePayables}
        receivables={safeReceivables}
      />
    </div>
  )
}
