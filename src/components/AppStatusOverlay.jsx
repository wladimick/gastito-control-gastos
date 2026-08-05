import React, { useEffect, useMemo, useState } from 'react'
import { getDataHealthSnapshot, observeAppEvents } from '../lib/appEvents'

const LABELS = {
  expenses: 'Gastos',
  installments: 'Cuotas',
  recurring: 'Recurrentes',
  budgets: 'Presupuestos',
}

export default function AppStatusOverlay() {
  const [health, setHealth] = useState(() => getDataHealthSnapshot())
  const [mutation, setMutation] = useState(null)
  const [hiddenHealth, setHiddenHealth] = useState(false)

  useEffect(() => observeAppEvents({
    onDataHealth: detail => {
      setHealth(current => {
        const next = current.filter(item => item.source !== detail.source)
        return [...next, detail]
      })
      if (detail.status !== 'complete') setHiddenHealth(false)
    },
    onMutationError: detail => {
      setMutation(detail)
      window.setTimeout(() => setMutation(current => current?.at === detail.at ? null : current), 8000)
    },
  }), [])

  const problems = useMemo(
    () => health.filter(item => item.status === 'partial' || item.status === 'error'),
    [health],
  )

  if (!mutation && (!problems.length || hiddenHealth)) return null

  return (
    <div className="fixed right-3 bottom-20 lg:bottom-4 z-[100] w-[min(360px,calc(100vw-24px))] space-y-2 pointer-events-none">
      {mutation && (
        <div className="pointer-events-auto rounded-2xl border border-red-200 bg-red-50 p-4 shadow-xl text-red-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[.12em] font-bold opacity-70">No se confirmó el cambio</div>
              <div className="text-[12px] font-semibold mt-1">{mutation.context}</div>
              <div className="text-[10px] mt-1 opacity-75 leading-relaxed">{mutation.message}. Recarga la página antes de asumir que quedó guardado.</div>
            </div>
            <button type="button" onClick={() => setMutation(null)} className="text-[16px] leading-none opacity-60">×</button>
          </div>
        </div>
      )}

      {problems.length > 0 && !hiddenHealth && (
        <div className="pointer-events-auto rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xl text-amber-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[.12em] font-bold opacity-70">Datos parciales</div>
              <div className="text-[11px] mt-1 leading-relaxed">Alguna fuente no respondió. Los totales visibles pueden estar incompletos.</div>
            </div>
            <button type="button" onClick={() => setHiddenHealth(true)} className="text-[16px] leading-none opacity-60">×</button>
          </div>
          <div className="mt-3 space-y-1.5">
            {problems.map(item => (
              <div key={item.source} className="rounded-lg bg-white/60 px-2.5 py-2 text-[9.5px]">
                <strong>{LABELS[item.source] || item.source}:</strong> {item.message || 'fuente no disponible'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
