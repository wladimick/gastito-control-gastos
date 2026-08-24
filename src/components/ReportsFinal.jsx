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

  return (
    <div className="flex flex-col gap-4">
      {(uncertainAmount > 0 || forecastAmount > 0) && (
        <Card padding="p-4" className="border-[var(--line)]">
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
