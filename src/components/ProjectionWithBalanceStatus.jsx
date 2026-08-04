import React, { useEffect, useMemo, useState } from 'react'
import ProjectionV2 from './ProjectionV2'
import { Badge, Card } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'

const OVERRIDE_KEY = 'gastito_projection_balance_override'
const STALE_AFTER_DAYS = 7

function ageInDays(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
}

function freshness(account) {
  const days = ageInDays(account.updatedAt)
  if (days == null) return { stale: true, label: 'Sin fecha de actualización' }
  if (days === 0) return { stale: false, label: 'Actualizada hoy' }
  if (days === 1) return { stale: false, label: 'Actualizada ayer' }
  return { stale: days > STALE_AFTER_DAYS, label: `Actualizada hace ${days} días` }
}

function readOverride() {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY)
    if (raw == null || raw === '') return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

export default function ProjectionWithBalanceStatus(props) {
  const { accounts = [] } = props
  const activeOperating = useMemo(
    () => accounts.filter(account => account.active && account.type !== 'ahorro'),
    [accounts],
  )
  const registeredBalance = activeOperating.reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const staleAccounts = activeOperating.filter(account => freshness(account).stale)
  const [override, setOverride] = useState(readOverride)
  const [input, setInput] = useState(() => override == null ? '' : String(override))

  useEffect(() => {
    try {
      if (override == null) localStorage.removeItem(OVERRIDE_KEY)
      else localStorage.setItem(OVERRIDE_KEY, String(override))
    } catch {}
  }, [override])

  const projectedAccounts = useMemo(() => {
    if (override == null) return accounts
    const preserved = accounts.map(account => (
      account.active && account.type !== 'ahorro'
        ? { ...account, active: false }
        : account
    ))
    return [
      ...preserved,
      {
        id: 'projection-balance-override',
        name: 'Saldo temporal de Proyección',
        type: 'debito',
        bankId: null,
        balance: override,
        active: true,
        updatedAt: new Date().toISOString(),
      },
    ]
  }, [accounts, override])

  const applyOverride = () => {
    const value = Number(String(input || '').replace(/[^0-9-]/g, ''))
    if (!Number.isFinite(value)) return
    setOverride(value)
  }

  const clearOverride = () => {
    setOverride(null)
    setInput('')
  }

  const effectiveBalance = override == null ? registeredBalance : override
  const needsReview = staleAccounts.length > 0 && override == null

  return (
    <div className="flex flex-col gap-5">
      <Card padding="p-4 md:p-5" className={needsReview ? 'border-[var(--amber-ink)]/30' : ''}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${needsReview ? 'bg-[var(--amber-soft)] text-[var(--amber-ink)]' : 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'}`}>
              <Icon name={needsReview ? 'alert' : 'wallet'} size={16}/>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[13px] font-bold">Punto de partida de la proyección</div>
                <Badge tone={override == null ? (needsReview ? 'warn' : 'ok') : 'info'}>
                  {override == null ? (needsReview ? 'Revisar saldos' : 'Saldos registrados') : 'Saldo temporal'}
                </Badge>
              </div>
              <div className="text-[10.5px] text-[var(--muted)] mt-1 leading-relaxed">
                Proyección comienza con {fmtCLP(effectiveBalance)}. Las tarjetas de crédito no forman parte de este saldo; solo cuentas, billeteras y efectivo disponibles.
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {activeOperating.map(account => {
                  const state = freshness(account)
                  return (
                    <span key={account.id} className={`rounded-full border px-2.5 py-1 text-[9.5px] ${state.stale ? 'border-[var(--amber-ink)]/25 bg-[var(--amber-soft)] text-[var(--amber-ink)]' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'}`}>
                      {account.name}: {fmtCLP(account.balance || 0)} · {state.label}
                    </span>
                  )
                })}
                {!activeOperating.length && <span className="text-[10px] text-[var(--muted)]">No hay cuentas operativas activas.</span>}
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[310px] shrink-0 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3">
            <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold">Saldo temporal para probar</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="font-mono text-[15px] text-[var(--muted)]">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder={String(registeredBalance)}
                className="min-w-0 flex-1 h-9 rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-3 text-[12px] font-mono outline-none focus:border-[var(--ink)]"
              />
              <button type="button" onClick={applyOverride} className="h-9 px-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold">Usar</button>
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="text-[9.5px] text-[var(--muted)]">No modifica Cuentas ni Supabase.</div>
              {override != null && <button type="button" onClick={clearOverride} className="text-[9.5px] font-semibold underline">Volver al registrado</button>}
            </div>
          </div>
        </div>

        {needsReview && (
          <div className="mt-3 rounded-xl bg-[var(--amber-soft)] text-[var(--amber-ink)] px-3 py-2.5 text-[10.5px] leading-relaxed">
            El saldo registrado puede estar desactualizado. Actualiza las cuentas desde la página Cuentas antes de usar esta proyección para decidir compras o pagos.
          </div>
        )}
      </Card>

      <ProjectionV2 {...props} accounts={projectedAccounts}/>
    </div>
  )
}
