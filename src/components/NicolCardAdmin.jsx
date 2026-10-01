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

const FALLBACK_CATEGORY = { label: 'Otros', icon: '•', color: '#888880' }

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`))
}

function formatShortDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`)).replace('.', '')
}

function formatCycleLabel(key, short = false) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return key || 'Ciclo'
  const [year, month] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CL', {
    month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1))).replace('.', '')
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

function LinkPanel({ link, percentage, setPercentage, generatedUrl, onGenerate, onSavePercentage, onRevoke, onViewShared, busy }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
  }

  return (
    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-rose-50 p-3.5 sm:p-5 space-y-3 sm:space-y-4 shadow-sm shadow-violet-950/5">
      <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-fuchsia-300/25 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.12em] text-violet-700 font-bold">Enlace compartido</div>
          <h2 className="text-[16px] sm:text-[18px] font-bold mt-0.5 text-slate-900">Portal de Nicol</h2>
          <p className="text-[10.5px] sm:text-[11.5px] text-slate-600 mt-1 leading-relaxed max-w-xl">
            Nicol ve solo los gastos que marques y su porcentaje correspondiente.
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-bold ${link ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {link ? '● Activo' : '● Sin enlace'}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
        <label>
          <span className="block text-[10px] sm:text-[11px] text-[var(--muted)] mb-1">Porcentaje de Nicol</span>
          <input
            type="number" min="0" max="100" step="0.1" value={percentage}
            onChange={event => setPercentage(event.target.value)}
            className="w-full h-9 sm:h-10 rounded-xl border border-violet-200 bg-white/85 px-3 font-mono text-[12px] sm:text-[13px] outline-none focus:ring-2 focus:ring-violet-300"
          />
        </label>
        {link && (
          <button disabled={busy} onClick={onSavePercentage}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl border border-violet-200 bg-white/75 text-[10px] sm:text-[12px] font-semibold text-violet-900 disabled:opacity-50">
            Guardar
          </button>
        )}
      </div>

      {generatedUrl && (
        <div className="rounded-xl border border-violet-200 bg-white/75 p-2.5">
          <div className="text-[9px] uppercase tracking-[0.1em] text-violet-700 font-bold mb-1.5">Enlace nuevo</div>
          <div className="rounded-lg bg-white/80 px-2.5 py-2 text-[9.5px] sm:text-[10.5px] break-all font-mono text-slate-700">{generatedUrl}</div>
          <div className="flex gap-2 mt-2">
            <button onClick={copy} className="h-8 px-3 rounded-lg bg-violet-700 text-white text-[10px] font-semibold">
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <a href={generatedUrl} target="_blank" rel="noreferrer" className="h-8 px-3 rounded-lg border border-violet-200 bg-white text-violet-800 text-[10px] font-semibold inline-flex items-center">
              Abrir portal
            </a>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onViewShared}
          className="h-9 px-3.5 rounded-xl bg-slate-950 text-white text-[10.5px] sm:text-[11px] font-semibold shadow-sm">
          Ver gastos de Nicol
        </button>
        <button disabled={busy} onClick={onGenerate}
          className="h-9 px-3.5 rounded-xl bg-violet-700 text-white text-[10.5px] sm:text-[11px] font-semibold disabled:opacity-50">
          {link ? 'Renovar enlace' : 'Crear enlace'}
        </button>
        {link && (
          <button disabled={busy} onClick={onRevoke}
            className="h-9 px-3.5 rounded-xl border border-red-200 bg-white/60 text-red-700 text-[10.5px] sm:text-[11px] font-semibold disabled:opacity-50">
            Desactivar
          </button>
        )}
      </div>

      {link && !generatedUrl && (
        <p className="text-[9.5px] sm:text-[10.5px] text-slate-500 leading-relaxed">
          El enlace está activo. Gastito no guarda el token original; para copiarlo nuevamente debes renovarlo.
        </p>
      )}
    </section>
  )
}

function InstallmentBadges({ item }) {
  const current = Number(item.installment_current || 0)
  const total = Number(item.installment_total || 0)
  if (item.movement_type !== 'installment' || current < 1 || total < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[8.5px] sm:text-[9.5px] font-bold">Paga</span>
      <span className="inline-flex items-center rounded-full bg-[var(--ink)] text-[var(--bg)] px-2 py-0.5 text-[9px] sm:text-[10px] font-bold font-mono">{current}/{total}</span>
      {current === total && <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[8.5px] sm:text-[9.5px] font-bold">Última</span>}
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
    <div className={`px-3 py-3 sm:px-4 sm:py-4 flex items-start gap-2.5 sm:gap-3 hover:bg-[var(--hover)] ${item.shared_with_nicol ? 'bg-violet-50/35' : ''}`}>
      <input
        type="checkbox" checked={Boolean(item.shared_with_nicol)} disabled={busy}
        onChange={() => onToggle(item)} aria-label={`Compartir ${item.description} con Nicol`}
        className="mt-1 w-4 h-4 accent-violet-700 shrink-0"
      />

      <div
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl grid place-items-center text-[15px] sm:text-[17px] shrink-0 border"
        style={{ borderColor: translucent(category.color, '55'), backgroundColor: translucent(category.color, '20') }}
        aria-hidden="true"
      >
        {category.icon || '•'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] sm:text-[13px] font-semibold break-words leading-tight sm:leading-snug">{item.description}</div>
        <InstallmentBadges item={item} />

        <div className="mt-1.5 sm:mt-2 grid sm:grid-cols-[minmax(0,230px)_1fr] gap-1.5 sm:gap-2 sm:items-end">
          <label>
            <span className="sr-only">Categoría</span>
            <select
              value={item.category_id || ''} disabled={categoryBusy}
              onChange={event => onCategoryChange(item, event.target.value)}
              className="w-full h-8 sm:h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 text-[9.5px] sm:text-[11px] outline-none disabled:opacity-50"
            >
              <option value="">✨ Automática</option>
              {categories.map(option => <option key={option.id} value={option.id}>{option.icon || '•'} {option.label}</option>)}
            </select>
          </label>

          <div className="text-[9px] sm:text-[10.5px] text-[var(--muted)] leading-relaxed sm:pb-1">
            {formatDate(item.transaction_date)} · {TYPE_LABELS[item.movement_type] || item.movement_type}
            {isInstallment && originalAmount > amount && <> · Total {fmtCLP(originalAmount)}</>}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0 max-w-[88px] sm:max-w-none">
        <div className="font-mono text-[11.5px] sm:text-[13px] font-bold">{fmtCLP(amount)}</div>
        <div className="text-[8.5px] sm:text-[9.5px] text-[var(--muted)] mt-0.5 sm:mt-1 leading-tight">
          {isInstallment ? 'esta cuota' : 'gasto'}
        </div>
        {item.shared_with_nicol && <div className="mt-1 text-[8.5px] sm:text-[9.5px] font-semibold text-violet-700">Con Nicol</div>}
      </div>
    </div>
  )
}

function FilterButton({ active, children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`h-8 rounded-lg px-2.5 text-[9.5px] sm:text-[10.5px] font-semibold border transition-colors ${active
        ? 'bg-slate-950 border-slate-950 text-white'
        : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)]'}`}>
      {children}
    </button>
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
  const [shareFilter, setShareFilter] = useState('all')

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
  const displayedTransactions = useMemo(() => {
    if (shareFilter === 'shared') return visibleTransactions.filter(item => item.shared_with_nicol)
    if (shareFilter === 'unshared') return visibleTransactions.filter(item => !item.shared_with_nicol)
    return visibleTransactions
  }, [shareFilter, visibleTransactions])
  const categoriesById = useMemo(
    () => new Map((data.categories || []).map(category => [category.id, category])),
    [data.categories],
  )

  const sharedCount = visibleTransactions.filter(item => item.shared_with_nicol).length
  const unsharedCount = visibleTransactions.length - sharedCount
  const sharedTotal = visibleTransactions
    .filter(item => item.shared_with_nicol)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const nicolTotal = Math.round(sharedTotal * (Number(percentage || 0) / 100))

  const viewShared = () => {
    setShareFilter('shared')
    window.requestAnimationFrame(() => document.getElementById('nicol-expenses')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const toggleOne = async item => {
    setBusy(true)
    setError('')
    try {
      const updated = await setNicolTransactionShared(item.id, !item.shared_with_nicol)
      setData(previous => ({
        ...previous,
        transactions: previous.transactions.map(transaction => transaction.id === item.id ? { ...transaction, ...updated } : transaction),
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
        transactions: previous.transactions.map(transaction => transaction.id === item.id ? { ...transaction, ...updated } : transaction),
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
        <div className="max-w-5xl mx-auto px-4 py-3.5 sm:py-4 flex items-center justify-between gap-4">
          <div className="relative">
            <div className="text-[17px] sm:text-[18px] font-bold text-slate-900">Gastito · Nicol</div>
            <div className="text-[10px] sm:text-[11px] text-slate-600 mt-0.5">Gastos, cuotas y portal compartido</div>
          </div>
          <ExternalMenu />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-5 pb-16">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-[11px] sm:text-[12px]">{error}</div>}

        <LinkPanel
          link={data.link} percentage={percentage} setPercentage={setPercentage}
          generatedUrl={generatedUrl} onGenerate={generate} onSavePercentage={savePercentage}
          onRevoke={revoke} onViewShared={viewShared} busy={busy}
        />

        <section className="rounded-xl sm:rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 px-3 py-2.5 sm:px-4 sm:py-3.5">
          <div className="flex items-start gap-2">
            <Icon name="tag" size={14} className="mt-0.5 text-fuchsia-800 shrink-0" />
            <div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.12em] text-fuchsia-800 font-bold">Categorías automáticas</div>
              <p className="text-[10px] sm:text-[11.5px] text-slate-600 mt-0.5 leading-relaxed">
                Gastito reconoce comercios conocidos. Puedes corregir la categoría desde cada gasto.
              </p>
            </div>
          </div>
        </section>

        <section id="nicol-expenses" className="scroll-mt-4 bg-[var(--bg-elev)] border border-[var(--line)] rounded-2xl overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-[var(--line)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 sm:gap-3">
              <label className="flex-1 min-w-0">
                <span className="block text-[10px] sm:text-[11px] text-[var(--muted)] mb-1">Tarjeta y ciclo</span>
                <select
                  value={cycle?.id || ''}
                  onChange={event => { setSelectedCycle(event.target.value); setShareFilter('all') }}
                  className="w-full h-10 sm:min-h-12 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px] sm:text-[12px] outline-none"
                >
                  {data.cycles.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.card_name}{item.card_last_four ? ` •••• ${item.card_last_four}` : ''} · {formatCycleLabel(item.cycle_key, true)} · {formatShortDate(item.period_start)}–{formatShortDate(item.period_end)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button disabled={busy || !visibleTransactions.length} onClick={() => toggleAll(true)}
                  className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg border border-[var(--line)] text-[9.5px] sm:text-[11px] font-semibold disabled:opacity-40">
                  Marcar todos
                </button>
                <button disabled={busy || !visibleTransactions.length} onClick={() => toggleAll(false)}
                  className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg border border-[var(--line)] text-[9.5px] sm:text-[11px] font-semibold disabled:opacity-40">
                  Quitar todos
                </button>
              </div>
            </div>

            {cycle && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-[0.1em] font-bold text-[var(--muted)]">Ciclo seleccionado</div>
                  <div className="text-[11.5px] sm:text-[13px] font-bold mt-0.5 truncate">
                    {cycle.card_name}{cycle.card_last_four ? ` •••• ${cycle.card_last_four}` : ''} · {formatCycleLabel(cycle.cycle_key)}
                  </div>
                  <div className="text-[9.5px] sm:text-[10.5px] text-[var(--muted)] mt-0.5">{formatShortDate(cycle.period_start)} – {formatShortDate(cycle.period_end)}</div>
                </div>
                <span className="shrink-0 rounded-full bg-violet-50 text-violet-700 px-2 py-1 text-[9px] font-semibold">{visibleTransactions.length} gastos</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-2.5 sm:p-3">
                <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold">Compartido</div>
                <div className="font-mono text-[16px] sm:text-[18px] font-bold mt-0.5 sm:mt-1">{fmtCLP(sharedTotal)}</div>
              </div>
              <div className="bg-gradient-to-br from-violet-700 to-fuchsia-700 text-white rounded-xl p-2.5 sm:p-3 shadow-sm shadow-violet-700/20">
                <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.1em] opacity-70 font-bold">Nicol · {percentage || 0}%</div>
                <div className="font-mono text-[16px] sm:text-[18px] font-bold mt-0.5 sm:mt-1">{fmtCLP(nicolTotal)}</div>
              </div>
            </div>

            <div>
              <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-1.5">Mostrar</div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                <FilterButton active={shareFilter === 'all'} onClick={() => setShareFilter('all')}>Todos · {visibleTransactions.length}</FilterButton>
                <FilterButton active={shareFilter === 'shared'} onClick={() => setShareFilter('shared')}>Con Nicol · {sharedCount}</FilterButton>
                <FilterButton active={shareFilter === 'unshared'} onClick={() => setShareFilter('unshared')}>Sin compartir · {unsharedCount}</FilterButton>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-[12px] text-[var(--muted)]">Cargando movimientos…</div>
          ) : displayedTransactions.length === 0 ? (
            <div className="p-8 sm:p-10 text-center">
              <div className="text-[12px] font-semibold">No hay gastos en este filtro</div>
              <div className="text-[10px] text-[var(--muted)] mt-1">Prueba “Todos” o selecciona otro ciclo.</div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {displayedTransactions.map(item => (
                <TransactionRow
                  key={item.id} item={item} categories={data.categories || []}
                  categoriesById={categoriesById} busy={busy}
                  categoryBusy={categoryBusyId === item.id} onToggle={toggleOne}
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
