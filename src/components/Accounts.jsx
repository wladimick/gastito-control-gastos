import React, { useEffect, useMemo, useState } from 'react'
import AccountsLegacy from './AccountsLegacy'
import { Badge, Card } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'

const STALE_AFTER_DAYS = 7

function ageInDays(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
}

function freshness(account) {
  const days = ageInDays(account.updatedAt)
  if (days == null) return { stale: true, label: 'Sin fecha' }
  if (days === 0) return { stale: false, label: 'Actualizada hoy' }
  if (days === 1) return { stale: false, label: 'Actualizada ayer' }
  return { stale: days > STALE_AFTER_DAYS, label: `Actualizada hace ${days} días` }
}

export default function Accounts(props) {
  const { accounts = [], onUpdateAccount } = props
  const activeAccounts = useMemo(() => accounts.filter(account => account.active), [accounts])
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setDrafts(Object.fromEntries(activeAccounts.map(account => [account.id, String(Number(account.balance || 0))])))
  }, [activeAccounts])

  const staleAccounts = activeAccounts.filter(account => freshness(account).stale)
  const changedAccounts = activeAccounts.filter(account => {
    const next = Number(String(drafts[account.id] ?? '').replace(/[^0-9-]/g, '')) || 0
    return next !== Number(account.balance || 0)
  })
  const currentTotal = activeAccounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const draftTotal = activeAccounts.reduce((sum, account) => {
    const value = Number(String(drafts[account.id] ?? '').replace(/[^0-9-]/g, '')) || 0
    return sum + value
  }, 0)

  const saveBalances = async () => {
    if (!onUpdateAccount || !changedAccounts.length) return
    setSaving(true)
    setMessage('')
    try {
      for (const account of changedAccounts) {
        const balance = Number(String(drafts[account.id] ?? '').replace(/[^0-9-]/g, '')) || 0
        await onUpdateAccount({ ...account, balance })
      }
      setMessage('Saldos actualizados. Proyección usará estos valores como punto de partida.')
    } catch (error) {
      setMessage(error.message || 'No fue posible actualizar los saldos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {activeAccounts.length > 0 && (
        <Card padding="p-4 md:p-5" className={staleAccounts.length ? 'border-[var(--amber-ink)]/30' : ''}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${staleAccounts.length ? 'bg-[var(--amber-soft)] text-[var(--amber-ink)]' : 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'}`}>
                <Icon name={staleAccounts.length ? 'alert' : 'wallet'} size={16}/>
              </div>
              <div>
                <div className="text-[13px] font-bold">Actualizar saldos disponibles</div>
                <div className="text-[10.5px] text-[var(--muted)] mt-1 leading-relaxed">
                  Estos saldos forman el punto de partida de Proyección. Escribe lo que tienes disponible hoy, no el cupo de las tarjetas de crédito.
                </div>
              </div>
            </div>
            <div className="text-left md:text-right shrink-0">
              <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">Total registrado</div>
              <div className="font-mono text-[20px] font-bold mt-1">{fmtCLP(currentTotal)}</div>
            </div>
          </div>

          {staleAccounts.length > 0 && (
            <div className="mt-3 rounded-xl bg-[var(--amber-soft)] text-[var(--amber-ink)] px-3 py-2.5 text-[10.5px] leading-relaxed">
              {staleAccounts.length === activeAccounts.length
                ? 'Todos los saldos activos están desactualizados o no tienen fecha de actualización.'
                : `${staleAccounts.length} cuenta${staleAccounts.length === 1 ? '' : 's'} necesita${staleAccounts.length === 1 ? '' : 'n'} revisión.`}
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-2.5 mt-4">
            {activeAccounts.map(account => {
              const state = freshness(account)
              return (
                <label key={account.id} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold truncate">{account.name}</div>
                      <div className={`text-[9px] mt-0.5 ${state.stale ? 'text-[var(--amber-ink)]' : 'text-[var(--muted)]'}`}>{state.label}</div>
                    </div>
                    <Badge tone={state.stale ? 'warn' : 'ok'}>{state.stale ? 'Revisar' : 'Vigente'}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3">
                    <span className="font-mono text-[16px] text-[var(--muted)]">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={drafts[account.id] ?? ''}
                      onChange={event => setDrafts(current => ({ ...current, [account.id]: event.target.value }))}
                      className="min-w-0 flex-1 bg-transparent border-b border-[var(--line)] focus:border-[var(--ink)] outline-none py-1 font-mono text-[17px] font-semibold"
                    />
                  </div>
                </label>
              )
            })}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">Nuevo total</div>
              <div className="font-mono text-[18px] font-bold mt-0.5">{fmtCLP(draftTotal)}</div>
              {message && <div className="text-[10px] text-[var(--muted)] mt-1">{message}</div>}
            </div>
            <button
              type="button"
              onClick={saveBalances}
              disabled={!changedAccounts.length || saving || !onUpdateAccount}
              className="h-10 px-4 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Icon name="check" size={13}/>{saving ? 'Guardando' : `Guardar ${changedAccounts.length || ''} saldo${changedAccounts.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </Card>
      )}

      <AccountsLegacy {...props}/>
    </div>
  )
}
