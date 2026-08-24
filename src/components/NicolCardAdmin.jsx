import React, { useEffect, useMemo, useState } from 'react'
import ExternalMenu from './ExternalMenu'
import Login from './Login'
import { fmtCLP, Icon } from '../lib/helpers'
import { isConfigured, supabase } from '../lib/supabase'
import {
  createOrRotateNicolShare,
  fetchNicolAdminData,
  revokeNicolShare,
  setNicolCycleTransactions,
  setNicolTransactionCategory,
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

const FALLBACK_CATEGORY = {
  label: 'Otros',
  icon: '•',
  color: '#888880',
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

function translucent(color, opacity = '18') {
  return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? `${color}${opacity}` : `#888880${opacity}`
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
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-rose-50 p-4 sm:p-5 space-y-4 shadow-sm shadow-violet-950/5">
      <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-fuchsia-300/25 blur-2xl" aria-hidden="true" />
      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-violet-700 font-bold">Enlace compartido</div>
          <h2 className="text-[18px] font-bold mt-1 text-slate-900">Portal de Nicol</h2>
          <p className="text-[11.5px] text-slate-600 mt-1 leading-relaxed max-w-xl">
            Comparte solo los movimientos y recurrentes que marques. Nicol puede verlos, pero no modificar nada.
          </p>
        </div>
        <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${link ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {link ? '● Enlace activo' : '● Aún no creado'}
        </span>
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
            className="w-full h-10 rounded-xl border border-violet-200 bg-white/85 px-3 font-mono text-[13px] outline-none focus:ring-2 focus:ring-violet-300"
          />
        </label>
        {link && (
          <button disabled={busy} onClick={onSavePercentage}
            className="h-10 px-4 rounded-xl border border-violet-200 bg-white/70 text-[12px] font-semibold text-violet-900 hover:bg-white disabled:opacity-50">
            Guardar porcentaje
          </button>
        )}
      </div>

      {generatedUrl ? (
        <div className="relative rounded-2xl border border-violet-200 bg-white/90 p-3.5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-[10px] uppercase tracking-[0.1em] text-violet-700 font-bold">Enlace listo para enviar</div>
            <span className="text-[10px] font-semibold text-emerald-700">Solo lectura</span>
          </div>
          <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-[11px] break-all font-mono text-slate-700">{generatedUrl}</div>
          <button onClick={copy} className="mt-2 h-9 px-3 rounded-lg bg-violet-700 text-white text-[11px] font-semibold hover:bg-violet-800">
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
        </div>
      ) : link ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-[11px] text-emerald-900 leading-relaxed">
          <span className="font-bold">El enlace de Nicol está activo.</span> Por seguridad, Gastito no conserva el token original: si necesitas volver a verlo o copiarlo, usa “Renovar enlace” y envía el nuevo.
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-[11px] text-amber-900 leading-relaxed">
          Aún no hay un enlace para Nicol. Créalo cuando quieras compartir el detalle seleccionado.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={onGenerate}
          className="h-10 px-4 rounded-xl bg-violet-700 text-white text-[12px] font-semibold shadow-sm shadow-violet-700/25 hover:bg-violet-800 disabled:opacity-50">
          {link ? 'Renovar enlace' : 'Crear enlace para Nicol'}
        </button>
        {link && (
          <button disabled={busy} onClick={onRevoke}
            className="h-10 px-4 rounded-xl border border-red-200 bg-white/60 text-red-700 text-[12px] font-semibold hover:bg-red-50 disabled:opacity-50">
            Desactivar enlace
          </button>
        )}
      </div>

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

function TransactionRow({ item, categories, categoriesById, busy, categoryBusy, onToggle, onCategoryChange }) {
  const isInstallment = item.movement_type === 'installment'
    && Number(item.installment_current || 0) > 0
    && Number(item.installment_total || 0) > 1
  const originalAmount = Number(item.original_amount || 0)
  const amount = Number(item.amount || 0)
  const category = categoriesById.get(item.category_id) || FALLBACK_CATEGORY

  return (
    <div className="px-4 py-4 flex items-start gap-3 hover:bg-[var(--hover)]">
      <input
        type="checkbox"
        checked={Boolean(item.shared_with_nicol)}
        disabled={busy}
        onChange={() => onToggle(item)}
        aria-label={`Compartir ${item.description} con Nicol`}
        className="mt-1 w-4 h-4 accent-[var(--ink)] shrink-0"
      />

      <div
        className="w-9 h-9 rounded-xl grid place-items-center text-[17px] shrink-0 border"
        style={{
          borderColor: translucent(category.color, '55'),
          backgroundColor: translucent(category.color, '20'),
        }}
        aria-hidden="true"
      >
        {category.icon || '•'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold break-words leading-snug">{item.description}</div>
        <InstallmentBadges item={item} />

        <div className="mt-2 grid sm:grid-cols-[minmax(0,230px)_1fr] gap-2 sm:items-end">
          <label>
            <span className="block text-[9.5px] uppercase tracking-[0.08em] text-[var(--muted)] font-bold mb-1"><Icon name="tag" size={13} className="sm:hidden"/><span className="hidden sm:inline">Categoría</span></span>
            <select
              value={item.category_id || ''}
              disabled={categoryBusy}
              onChange={event => onCategoryChange(item, event.target.value)}
              className="w-full h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[11px] outline-none disabled:opacity-50"
            >
              <option value="">✨ Detectar automáticamente</option>
              {categories.map(option => (
                <option key={option.id} value={option.id}>
                  {option.icon || '•'} {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="text-[10.5px] text-[var(--muted)] leading-relaxed sm:pb-1">
            {formatDate(item.transaction_date)} · {TYPE_LABELS[item.movement_type] || item.movement_type}
            {isInstallment && originalAmount > amount && <> · Compra total {fmtCLP(originalAmount)}</>}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="font-mono text-[13px] font-bold">{fmtCLP(amount)}</div>
        <div className="text-[9.5px] text-[var(--muted)] mt-1">
          {isInstallment ? 'valor de esta cuota' : 'monto del gasto'}
        </div>
      </div>
    </div>
  )
}

export default function NicolCardAdmin() {
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState(null)
  const [data, setData] = useState({ cycles: [], transactions: [], categories: [], link: null })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [categoryBusyId, setCategoryBusyId] = useState('')
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
  const categoriesById = useMemo(
    () => new Map((data.categories || []).map(category => [category.id, category])),
    [data.categories],
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

  const changeCategory = async (item, categoryId) => {
    setCategoryBusyId(item.id)
    setError('')
    try {
      const updated = await setNicolTransactionCategory(item.id, categoryId)
      setData(previous => ({
        ...previous,
        transactions: previous.transactions.map(transaction => transaction.id === item.id
          ? { ...transaction, ...updated }
          : transaction),
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setCategoryBusyId('')
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
    <div className="min-h-screen bg-[#fcfbff] text-[var(--ink)]">
      <header className="relative overflow-visible border-b border-violet-100 bg-gradient-to-r from-violet-100 via-fuchsia-50 to-rose-50">
        <div className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-violet-300/25 blur-2xl" aria-hidden="true" />
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="relative">
            <div className="text-[18px] font-bold text-slate-900">Gastito · Nicol</div>
            <div className="text-[11px] text-slate-600 mt-0.5">Gastos, cuotas y el portal compartido</div>
          </div>
          <ExternalMenu/>
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

        <section className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 px-4 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.12em] text-fuchsia-800 font-bold">Categorías automáticas</div>
          <p className="text-[11.5px] text-slate-600 mt-1 leading-relaxed">
            Gastito reconoce comercios como Lider, Shell, veterinarias, Sodimac y servicios básicos. Cuando el nombre no sea suficiente, cambia la categoría manualmente en la fila del gasto.
          </p>
        </section>

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
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold">Compartido</div>
                <div className="font-mono text-[18px] font-bold mt-1">{fmtCLP(sharedTotal)}</div>
              </div>
              <div className="bg-gradient-to-br from-violet-700 to-fuchsia-700 text-white rounded-xl p-3 shadow-sm shadow-violet-700/20">
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
                <TransactionRow
                  key={item.id}
                  item={item}
                  categories={data.categories || []}
                  categoriesById={categoriesById}
                  busy={busy}
                  categoryBusy={categoryBusyId === item.id}
                  onToggle={toggleOne}
                  onCategoryChange={changeCategory}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
