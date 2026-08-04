import React, { useEffect, useMemo, useState } from 'react'
import Login from './Login'
import { fmtCLP } from '../lib/helpers'
import { isConfigured, supabase } from '../lib/supabase'
import {
  createOrRotateNicolShare,
  fetchNicolAdminData,
  revokeNicolShare,
  setNicolCycleTransactions,
  setNicolTransactionShared,
  updateNicolSharePercentage,
} from '../services/nicolShareService'

const TYPE_LABELS = {
  purchase: 'Compra',
  installment: 'Compra en cuotas',
  commission: 'Comisión',
  tax: 'Impuesto',
  interest: 'Interés',
  other: 'Otro cargo',
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`))
}

function formatCycleLabel(key) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return key || 'Ciclo'
  const [year, month] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function SimpleMessage({ title, text, loading = false }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        {loading && <div className="w-8 h-8 rounded-full border-2 border-[var(--line)] border-t-[var(--ink)] animate-spin mx-auto mb-5" />}
        <h1 className="text-[19px] font-bold">{title}</h1>
        <p className="text-[13px] text-[var(--muted)] mt-2 leading-relaxed">{text}</p>
      </main>
    </div>
  )
}

function LinkPanel({ link, percentage, setPercentage, generatedUrl, onGenerate, onSavePercentage, onRevoke, busy }) {
  const copy = async () => {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    alert('Enlace copiado')
  }

  return (
    <section className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-2xl p-4 space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">Enlace público</div>
        <h2 className="text-[16px] font-bold mt-1">Acceso de Nicol</h2>
        <p className="text-[11.5px] text-[var(--muted)] mt-1 leading-relaxed">
          Nicol solo puede leer los movimientos y recurrentes que marques.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <label className="flex-1">
          <span className="block text-[11px] text-[var(--muted)] mb-1">Porcentaje de Nicol</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={percentage}
            onChange={event => setPercentage(event.target.value)}
            className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 font-mono text-[13px] outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </label>
        {link && (
          <button disabled={busy} onClick={onSavePercentage}
            className="h-10 px-4 rounded-lg border border-[var(--line)] text-[12px] font-semibold hover:bg-[var(--hover)] disabled:opacity-50">
            Guardar porcentaje
          </button>
        )}
      </div>

      {generatedUrl && (
        <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3">
          <div className="text-[10px] text-[var(--muted)] mb-1">Nuevo enlace — guárdalo ahora</div>
          <div className="text-[11px] break-all font-mono">{generatedUrl}</div>
          <button onClick={copy} className="mt-2 h-8 px-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold">
            Copiar enlace
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={onGenerate}
          className="h-10 px-4 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[12px] font-semibold disabled:opacity-50">
          {link ? 'Renovar enlace' : 'Crear enlace para Nicol'}
        </button>
        {link && (
          <button disabled={busy} onClick={onRevoke}
            className="h-10 px-4 rounded-lg border border-red-200 text-red-600 text-[12px] font-semibold hover:bg-red-50 disabled:opacity-50">
            Desactivar enlace
          </button>
        )}
      </div>

      {link && !generatedUrl && (
        <div className="text-[11px] text-[var(--muted)]">
          Hay un enlace activo. Usa “Renovar enlace” solamente cuando necesites generar un token nuevo.
        </div>
      )}
    </section>
  )
}

function InstallmentBadges({ item }) {
  const current = Number(item.installment_current || 0)
  const total = Number(item.installment_total || 0)
  if (item.movement_type !== 'installment' || current < 1 || total < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 px-2.5 py-1 text-[10px] font-bold">
        Este ciclo paga
      </span>
      <span className="inline-flex items-center rounded-full bg-[var(--ink)] text-[var(--bg)] px-2.5 py-1 text-[11px] font-bold font-mono">
        Cuota {current}/{total}
      </span>
      {current === total && (
        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-[10px] font-bold">
          Última cuota
        </span>
      )}
    </div>
  )
}

function TransactionRow({ item, busy, onToggle }) {
  const isInstallment = item.movement_type === 'installment'
    && Number(item.installment_current || 0) > 0
    && Number(item.installment_total || 0) > 1
  const originalAmount = Number(item.original_amount || 0)
  const amount = Number(item.amount || 0)

  return (
    <label className="px-4 py-4 flex items-start gap-3 cursor-pointer hover:bg-[var(--hover)]">
      <input
        type="checkbox"
        checked={Boolean(item.shared_with_nicol)}
        disabled={busy}
        onChange={() => onToggle(item)}
        className="mt-1 w-4 h-4 accent-[var(--ink)]"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold break-words leading-snug">{item.description}</div>
        <InstallmentBadges item={item} />
        <div className="text-[10.5px] text-[var(--muted)] mt-2 leading-relaxed">
          {formatDate(item.transaction_date)} · {TYPE_LABELS[item.movement_type] || item.movement_type}
          {isInstallment && originalAmount > amount && (
            <> · Compra total {fmtCLP(originalAmount)}</>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-[13px] font-bold">{fmtCLP(amount)}</div>
        {isInstallment && <div className="text-[9.5px] text-[var(--muted)] mt-1">valor de esta cuota</div>}
      </div>
    </label>
  )
}

export default function NicolCardAdmin() {
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState(null)
  const [data, setData] = useState({ cycles: [], transactions: [], link: null })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedCycle, setSelectedCycle] = useState('')
  const [percentage, setPercentage] = useState('33')
  const [generatedUrl, setGeneratedUrl] = useState('')

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return undefined }
    supabase.auth.getSession().then(({ data: result }) => {
      setSession(result.session)
      setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  const reload = async currentSession => {
    if (!currentSession) return
    setLoading(true)
    setError('')
    try {
      const result = await fetchNicolAdminData(currentSession.user.id)
      setData(result)
      if (result.link) setPercentage(String(result.link.percentage))
      setSelectedCycle(current => current && result.cycles.some(item => item.id === current)
        ? current
        : (result.cycles[0]?.id || ''))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload(session) }, [session])

  const cycle = data.cycles.find(item => item.id === selectedCycle) || data.cycles[0] || null
  const visibleTransactions = useMemo(
    () => cycle ? data.transactions.filter(item => item.billing_cycle_id === cycle.id) : [],
    [cycle, data.transactions],
  )
  const sharedTotal = visibleTransactions
    .filter(item => item.shared_with_nicol)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const nicolTotal = Math.round(sharedTotal * (Number(percentage || 0) / 100))

  const toggleOne = async item => {
    setBusy(true)
    setError('')
    try {
      const updated = await setNicolTransactionShared(item.id, !item.shared_with_nicol)
      setData(previous => ({
        ...previous,
        transactions: previous.transactions.map(transaction => transaction.id === item.id
          ? { ...transaction, ...updated }
          : transaction),
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleAll = async shared => {
    const ids = visibleTransactions.map(item => item.id)
    if (!ids.length) return
    setBusy(true)
    setError('')
    try {
      await setNicolCycleTransactions(ids, shared)
      setData(previous => ({
        ...previous,
        transactions: previous.transactions.map(transaction => ids.includes(transaction.id)
          ? { ...transaction, shared_with_nicol: shared }
          : transaction),
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const generate = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await createOrRotateNicolShare(percentage)
      const url = new URL(window.location.origin + window.location.pathname)
      url.searchParams.set('nicol', result.token)
      setGeneratedUrl(url.toString())
      await reload(session)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const savePercentage = async () => {
    if (!data.link) return
    setBusy(true)
    setError('')
    try {
      const link = await updateNicolSharePercentage(data.link.id, percentage)
      setData(previous => ({ ...previous, link }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    if (!data.link || !window.confirm('¿Desactivar el enlace público de Nicol?')) return
    setBusy(true)
    setError('')
    try {
      await revokeNicolShare(data.link.id)
      setData(previous => ({ ...previous, link: null }))
      setGeneratedUrl('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!authReady) return <SimpleMessage loading title="Verificando acceso" text="Un momento…" />
  if (!isConfigured) return <SimpleMessage title="Configuración incompleta" text="Supabase no está configurado." />
  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--bg-elev)]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-[18px] font-bold">Gastito · Nicol</div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">Configura los gastos compartidos</div>
          </div>
          <a href={window.location.pathname}
            className="text-[11px] font-semibold border border-[var(--line)] rounded-lg px-3 py-2 hover:bg-[var(--hover)]">
            Volver a Gastito
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5 pb-16">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-[12px]">{error}</div>}

        <LinkPanel
          link={data.link}
          percentage={percentage}
          setPercentage={setPercentage}
          generatedUrl={generatedUrl}
          onGenerate={generate}
          onSavePercentage={savePercentage}
          onRevoke={revoke}
          busy={busy}
        />

        <section className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[var(--line)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <label className="flex-1">
                <span className="block text-[11px] text-[var(--muted)] mb-1">Tarjeta y ciclo de facturación</span>
                <select
                  value={cycle?.id || ''}
                  onChange={event => setSelectedCycle(event.target.value)}
                  className="w-full min-h-12 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[12px] outline-none"
                >
                  {data.cycles.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.card_name}{item.card_last_four ? ` •••• ${item.card_last_four}` : ''} · {formatCycleLabel(item.cycle_key)} · {formatDate(item.period_start)} – {formatDate(item.period_end)}
                    </option>
                  ))}
                </select>
                <span className="block text-[10.5px] text-[var(--muted)] mt-1.5">
                  Un mismo mes puede aparecer dos veces porque CMR y Banco de Chile tienen períodos distintos.
                </span>
              </label>

              <div className="flex gap-2">
                <button disabled={busy || !visibleTransactions.length} onClick={() => toggleAll(true)}
                  className="h-9 px-3 rounded-lg border border-[var(--line)] text-[11px] font-semibold disabled:opacity-40">
                  Marcar todos
                </button>
                <button disabled={busy || !visibleTransactions.length} onClick={() => toggleAll(false)}
                  className="h-9 px-3 rounded-lg border border-[var(--line)] text-[11px] font-semibold disabled:opacity-40">
                  Quitar todos
                </button>
              </div>
            </div>

            {cycle && (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3">
                <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--muted)]">Ciclo seleccionado</div>
                <div className="text-[14px] font-bold mt-1">
                  {cycle.card_name}{cycle.card_last_four ? ` •••• ${cycle.card_last_four}` : ''} · {formatCycleLabel(cycle.cycle_key)}
                </div>
                <div className="text-[11px] text-[var(--muted)] mt-1">
                  {formatDate(cycle.period_start)} – {formatDate(cycle.period_end)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold">Compartido</div>
                <div className="font-mono text-[18px] font-bold mt-1">{fmtCLP(sharedTotal)}</div>
              </div>
              <div className="bg-[var(--ink)] text-[var(--bg)] rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-[0.1em] opacity-60 font-bold">Nicol · {percentage || 0}%</div>
                <div className="font-mono text-[18px] font-bold mt-1">{fmtCLP(nicolTotal)}</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-[12px] text-[var(--muted)]">Cargando movimientos…</div>
          ) : visibleTransactions.length === 0 ? (
            <div className="p-10 text-center text-[12px] text-[var(--muted)]">Este ciclo no tiene movimientos seleccionables.</div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {visibleTransactions.map(item => (
                <TransactionRow key={item.id} item={item} busy={busy} onToggle={toggleOne} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
