import React, { useEffect, useMemo, useState } from 'react'
import ExternalMenu from './ExternalMenu'
import Login from './Login'
import { fmtCLP } from '../lib/helpers'
import { isConfigured, supabase } from '../lib/supabase'
import {
  createNicolRecurringExpense,
  fetchNicolRecurringData,
  updateNicolRecurringExpense,
} from '../services/nicolRecurringService'

const EMPTY_FORM = {
  name: '',
  amount: '',
  dayOfMonth: '5',
  categoryId: '',
  sharedWithNicol: true,
}

const FALLBACK_CATEGORY = {
  label: 'Otros',
  icon: '•',
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

export default function NicolRecurringAdmin() {
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState(null)
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [drafts, setDrafts] = useState({})
  const [percentage, setPercentage] = useState(33)
  const [hasActiveLink, setHasActiveLink] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return undefined }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  const load = async currentSession => {
    if (!currentSession) return
    setLoading(true)
    setError('')
    try {
      const result = await fetchNicolRecurringData(currentSession.user.id)
      setItems(result.items)
      setCategories(result.categories)
      setPercentage(result.percentage)
      setHasActiveLink(result.hasActiveLink)
      setDrafts(Object.fromEntries(result.items.map(item => [item.id, {
        amount: String(item.amount),
        dayOfMonth: item.day_of_month == null ? '' : String(item.day_of_month),
        categoryId: item.category_id || '',
      }])))
    } catch (loadError) {
      setError(loadError.message || 'No fue posible cargar los recurrentes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(session) }, [session])

  const categoriesById = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories],
  )
  const sharedItems = useMemo(
    () => items.filter(item => item.active && item.shared_with_nicol),
    [items],
  )
  const sharedTotal = sharedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const nicolTotal = Math.round(sharedTotal * percentage / 100)

  const setDraft = (id, key, value) => {
    setDrafts(current => ({ ...current, [id]: { ...current[id], [key]: value } }))
  }

  const replaceItem = updated => {
    setItems(current => current.map(item => item.id === updated.id ? updated : item))
    setDrafts(current => ({
      ...current,
      [updated.id]: {
        amount: String(updated.amount),
        dayOfMonth: updated.day_of_month == null ? '' : String(updated.day_of_month),
        categoryId: updated.category_id || '',
      },
    }))
  }

  const toggleShare = async item => {
    setBusyId(item.id)
    setError('')
    try {
      const updated = await updateNicolRecurringExpense(item.id, { sharedWithNicol: !item.shared_with_nicol })
      replaceItem(updated)
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setBusyId('')
    }
  }

  const saveItem = async item => {
    const draft = drafts[item.id] || {}
    setBusyId(item.id)
    setError('')
    try {
      const updated = await updateNicolRecurringExpense(item.id, {
        amount: draft.amount,
        dayOfMonth: draft.dayOfMonth,
        categoryId: draft.categoryId,
      })
      replaceItem(updated)
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setBusyId('')
    }
  }

  const createItem = async event => {
    event.preventDefault()
    if (!session) return
    setCreating(true)
    setError('')
    try {
      const created = await createNicolRecurringExpense(session.user.id, form)
      setItems(current => [...current, created].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1
        return (a.day_of_month ?? 99) - (b.day_of_month ?? 99) || a.name.localeCompare(b.name, 'es')
      }))
      setDrafts(current => ({
        ...current,
        [created.id]: {
          amount: String(created.amount),
          dayOfMonth: created.day_of_month == null ? '' : String(created.day_of_month),
          categoryId: created.category_id || '',
        },
      }))
      setForm(EMPTY_FORM)
    } catch (createError) {
      setError(createError.message)
    } finally {
      setCreating(false)
    }
  }

  if (!authReady) return <SimpleMessage loading title="Verificando acceso" text="Un momento…" />
  if (!isConfigured) return <SimpleMessage title="Configuración incompleta" text="Supabase no está configurado." />
  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-[#fcfbff] text-[var(--ink)]">
      <header className="relative overflow-visible border-b border-violet-100 bg-gradient-to-r from-violet-100 via-fuchsia-50 to-rose-50">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-rose-300/30 blur-2xl" aria-hidden="true" />
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <div className="text-[18px] font-bold text-slate-900">Gastito · Recurrentes de Nicol</div>
            <div className="text-[11px] text-slate-600 mt-0.5">Luz, agua, internet y otros gastos mensuales</div>
          </div>
          <ExternalMenu/>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5 pb-24">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-[12px]">{error}</div>}

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-violet-700 to-fuchsia-700 text-white rounded-2xl p-4 shadow-sm shadow-violet-700/20">
            <div className="text-[10px] uppercase tracking-[0.12em] opacity-60 font-bold">Recurrentes compartidos</div>
            <div className="font-mono text-[22px] font-bold mt-1">{fmtCLP(sharedTotal)}</div>
            <div className="text-[11px] opacity-65 mt-1">{sharedItems.length} conceptos activos</div>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-[0.12em] text-violet-800 font-bold">Aporte Nicol</div>
            <div className="font-mono text-[20px] font-bold mt-1">{fmtCLP(nicolTotal)}</div>
            <div className="text-[11px] text-violet-700 mt-1">{percentage}%</div>
          </div>
          <div className={`rounded-2xl border p-4 ${hasActiveLink ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className={`text-[10px] uppercase tracking-[0.12em] font-bold ${hasActiveLink ? 'text-emerald-800' : 'text-amber-800'}`}>Enlace público</div>
            <div className={`text-[13px] font-semibold mt-2 ${hasActiveLink ? 'text-emerald-700' : 'text-amber-700'}`}>
              {hasActiveLink ? 'Activo' : 'Sin crear'}
            </div>
            <a href="?nicol-admin=1" className={`inline-block mt-1 text-[10.5px] font-semibold underline underline-offset-2 ${hasActiveLink ? 'text-emerald-800' : 'text-amber-800'}`}>Ver y administrar enlace</a>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-[0.12em] text-rose-800 font-bold">Categorías</div>
            <div className="text-[11.5px] font-semibold mt-2">Automáticas y editables</div>
          </div>
        </section>

        <form onSubmit={createItem} className="bg-white border border-violet-100 rounded-2xl p-4 shadow-sm shadow-violet-950/5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">Nuevo recurrente</div>
            <h2 className="text-[16px] font-bold mt-1">Agregar gasto mensual</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_150px_110px_190px] gap-3 mt-4">
            <label>
              <span className="block text-[10.5px] text-[var(--muted)] mb-1">Nombre</span>
              <input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                placeholder="Ej. Luz CGE" required
                className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
            </label>
            <label>
              <span className="block text-[10.5px] text-[var(--muted)] mb-1">Monto mensual</span>
              <input type="number" min="1" step="1" value={form.amount}
                onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} required
                className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 font-mono text-[12px] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
            </label>
            <label>
              <span className="block text-[10.5px] text-[var(--muted)] mb-1">Día de pago</span>
              <input type="number" min="1" max="31" value={form.dayOfMonth}
                onChange={event => setForm(current => ({ ...current, dayOfMonth: event.target.value }))}
                className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 font-mono text-[12px] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
            </label>
            <label>
              <span className="block text-[10.5px] text-[var(--muted)] mb-1">Categoría</span>
              <select value={form.categoryId}
                onChange={event => setForm(current => ({ ...current, categoryId: event.target.value }))}
                className="w-full h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px] outline-none">
                <option value="">✨ Detectar automáticamente</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.icon || '•'} {category.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[11.5px] font-medium">
              <input type="checkbox" checked={form.sharedWithNicol}
                onChange={event => setForm(current => ({ ...current, sharedWithNicol: event.target.checked }))}
                className="w-4 h-4 accent-[var(--ink)]" />
              Incluir inmediatamente en el cobro a Nicol
            </label>
            <button disabled={creating} type="submit"
              className="h-10 px-4 rounded-xl bg-violet-700 text-white text-[12px] font-semibold hover:bg-violet-800 disabled:opacity-50">
              {creating ? 'Agregando…' : 'Agregar recurrente'}
            </button>
          </div>
        </form>

        <section className="bg-white border border-violet-100 rounded-2xl overflow-hidden shadow-sm shadow-violet-950/5">
          <div className="p-4 border-b border-[var(--line)]">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">Gastos existentes</div>
            <h2 className="text-[16px] font-bold mt-1">Seleccionar, categorizar y actualizar</h2>
            <p className="text-[11.5px] text-[var(--muted)] mt-1">Solo los activos y marcados se muestran en el enlace público.</p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-[12px] text-[var(--muted)]">Cargando recurrentes…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-[12px] text-[var(--muted)]">Todavía no hay gastos recurrentes.</div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {items.map(item => {
                const draft = drafts[item.id] || {
                  amount: String(item.amount),
                  dayOfMonth: item.day_of_month ?? '',
                  categoryId: item.category_id || '',
                }
                const category = categoriesById.get(item.category_id) || FALLBACK_CATEGORY
                const changed = Number(draft.amount) !== Number(item.amount)
                  || String(draft.dayOfMonth ?? '') !== String(item.day_of_month ?? '')
                  || String(draft.categoryId || '') !== String(item.category_id || '')

                return (
                  <div key={item.id} className={`p-4 ${item.active ? '' : 'opacity-55'}`}>
                    <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                      <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                        <input type="checkbox" checked={Boolean(item.shared_with_nicol)} disabled={busyId === item.id || !item.active}
                          onChange={() => toggleShare(item)} className="mt-1 w-4 h-4 accent-[var(--ink)]" />
                        <div className="w-9 h-9 rounded-xl border border-[var(--line)] bg-[var(--bg)] grid place-items-center text-[17px] shrink-0">
                          {category.icon || '•'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold break-words">{item.name}</div>
                          <div className="text-[10.5px] text-[var(--muted)] mt-1">
                            {category.label} · {item.active ? 'Activo' : 'Pausado'} · {item.day_of_month ? `Pago el día ${item.day_of_month}` : 'Sin día definido'}
                          </div>
                        </div>
                      </label>

                      <div className="grid sm:grid-cols-[130px_90px_180px_auto] gap-2 lg:w-auto">
                        <label>
                          <span className="block text-[9.5px] text-[var(--muted)] mb-1">Monto</span>
                          <input type="number" min="1" step="1" value={draft.amount}
                            onChange={event => setDraft(item.id, 'amount', event.target.value)}
                            className="w-full h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 font-mono text-[11.5px] outline-none" />
                        </label>
                        <label>
                          <span className="block text-[9.5px] text-[var(--muted)] mb-1">Día</span>
                          <input type="number" min="1" max="31" value={draft.dayOfMonth}
                            onChange={event => setDraft(item.id, 'dayOfMonth', event.target.value)}
                            className="w-full h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 font-mono text-[11.5px] outline-none" />
                        </label>
                        <label>
                          <span className="block text-[9.5px] text-[var(--muted)] mb-1">Categoría</span>
                          <select value={draft.categoryId}
                            onChange={event => setDraft(item.id, 'categoryId', event.target.value)}
                            className="w-full h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[11px] outline-none">
                            <option value="">✨ Automática</option>
                            {categories.map(option => (
                              <option key={option.id} value={option.id}>{option.icon || '•'} {option.label}</option>
                            ))}
                          </select>
                        </label>
                        <button type="button" disabled={!changed || busyId === item.id} onClick={() => saveItem(item)}
                          className="self-end h-9 px-3 rounded-lg border border-[var(--line)] text-[11px] font-semibold disabled:opacity-35 hover:bg-[var(--hover)]">
                          Guardar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
