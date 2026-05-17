import React, { useState, useEffect } from 'react'
import { Card, Badge } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'
import { BANKS } from '../data'
import {
  fetchMyProfile, saveMyProfile,
  fetchMySettings, saveMySettings,
} from '../services/userSettingsService'
import { fetchMyCards, createCard, updateCard, removeCard } from '../services/creditCardsService'
import {
  fetchAllCategories, createUserCategory, updateUserCategory, removeUserCategory,
} from '../services/categoriesService'

const COLOR_SWATCHES = [
  '#E07A5F','#81B29A','#F2CC8F','#9B89B3','#6D9DC5','#C77DFF',
  '#B07156','#27AE60','#2196F3','#FF9800','#E91E63','#F44336',
  '#00BCD4','#607D8B','#3F51B5','#FF5722','#8BC34A','#888880',
]

const BLANK_CAT = { label: '', icon: '•', color: '#888880' }

const CURRENCIES = [
  { id: 'CLP', label: 'CLP — Peso chileno' },
  { id: 'ARS', label: 'ARS — Peso argentino' },
  { id: 'USD', label: 'USD — Dólar' },
  { id: 'MXN', label: 'MXN — Peso mexicano' },
]
const TIMEZONES = [
  'America/Santiago', 'America/Buenos_Aires', 'America/Lima',
  'America/Mexico_City', 'America/Bogota', 'UTC',
]

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-[var(--muted)] mt-1.5">{hint}</div>}
    </div>
  )
}

const BLANK_CARD = { name: '', bank: '', lastFour: '', billingDay: '', paymentDueDay: '', creditLimit: '' }

function CardForm({ card, onSave, onCancel, saving }) {
  const [draft, setDraft] = useState(card || BLANK_CARD)
  const set = (k, v) => setDraft(p => ({ ...p, [k]: v }))
  return (
    <div className="mt-3 rounded-lg border border-[var(--ink)]/20 p-4 bg-[var(--bg)] flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre de la tarjeta">
          <input value={draft.name} onChange={e => set('name', e.target.value)}
            placeholder="Visa Banco Chile"
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Banco">
          <select value={draft.bank} onChange={e => set('bank', e.target.value)}
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]">
            <option value="">Sin banco</option>
            {BANKS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="Últimos 4 dígitos" hint="Opcional">
          <input value={draft.lastFour} onChange={e => set('lastFour', e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="1234" maxLength={4}
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Límite de crédito" hint="Opcional">
          <input type="number" value={draft.creditLimit} onChange={e => set('creditLimit', e.target.value)}
            placeholder="1500000" min={0}
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Día de facturación">
          <input type="number" value={draft.billingDay} onChange={e => set('billingDay', e.target.value)}
            placeholder="15" min={1} max={31}
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Día de pago">
          <input type="number" value={draft.paymentDueDay} onChange={e => set('paymentDueDay', e.target.value)}
            placeholder="5" min={1} max={31}
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => onSave(draft)} disabled={!draft.name.trim() || saving}
          className="h-8 px-4 bg-[var(--ink)] text-[var(--bg)] rounded-md text-[12px] font-medium disabled:opacity-50">
          {saving ? 'Guardando…' : card?.id ? 'Guardar cambios' : 'Crear tarjeta'}
        </button>
        <button onClick={onCancel}
          className="h-8 px-3 border border-[var(--line)] rounded-md text-[12px] text-[var(--ink-2)] hover:bg-[var(--hover)]">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function CatForm({ cat, onSave, onCancel, saving }) {
  const [draft, setDraft] = useState(cat ? { label: cat.label, icon: cat.icon, color: cat.color } : { ...BLANK_CAT })
  const set = (k, v) => setDraft(p => ({ ...p, [k]: v }))
  return (
    <div className="mt-2 rounded-lg border border-[var(--ink)]/20 p-4 bg-[var(--bg)] flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre">
          <input value={draft.label} onChange={e => set('label', e.target.value)}
            placeholder="Ej: Deportes"
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
        <Field label="Ícono (emoji)">
          <input value={draft.icon} onChange={e => set('icon', e.target.value)}
            placeholder="🏷️" maxLength={4}
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] text-center focus:outline-none focus:border-[var(--ink)]"/>
        </Field>
      </div>
      <Field label="Color">
        <div className="flex flex-wrap gap-2 mt-1">
          {COLOR_SWATCHES.map(sw => (
            <button key={sw} type="button"
              onClick={() => set('color', sw)}
              className={`w-6 h-6 rounded-full border-2 transition ${draft.color === sw ? 'border-[var(--ink)] scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: sw }}/>
          ))}
          <input type="color" value={draft.color} onChange={e => set('color', e.target.value)}
            className="w-6 h-6 rounded-full border border-[var(--line)] cursor-pointer bg-transparent p-0"
            title="Color personalizado"/>
        </div>
      </Field>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => onSave(draft)} disabled={!draft.label.trim() || saving}
          className="h-8 px-4 bg-[var(--ink)] text-[var(--bg)] rounded-md text-[12px] font-medium disabled:opacity-50">
          {saving ? 'Guardando…' : cat?.id ? 'Guardar cambios' : 'Crear categoría'}
        </button>
        <button onClick={onCancel}
          className="h-8 px-3 border border-[var(--line)] rounded-md text-[12px] text-[var(--ink-2)] hover:bg-[var(--hover)]">
          Cancelar
        </button>
        {draft.label && (
          <div className="ml-auto flex items-center gap-1.5 text-[12px]"
            style={{ color: draft.color }}>
            <span>{draft.icon || '•'}</span>
            <span>{draft.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UserProfile({ userId, userEmail }) {
  const [profile,       setProfile]       = useState(null)
  const [settings,      setSettings]      = useState(null)
  const [cards,         setCards]         = useState([])
  const [loading,       setLoading]       = useState(true)

  const [profileDraft,  setProfileDraft]  = useState({ display_name: '' })
  const [settingsDraft, setSettingsDraft] = useState({
    currency: 'CLP', timezone: 'America/Santiago',
    salary_payment_day: '', month_start_day: 1,
  })
  const [savingProfile,  setSavingProfile]  = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savedProfile,   setSavedProfile]   = useState(false)
  const [savedSettings,  setSavedSettings]  = useState(false)

  const [cardForm, setCardForm] = useState(null) // null | blank | existing card
  const [savingCard, setSavingCard] = useState(false)

  const [categories, setCategories] = useState([])
  const [catForm,    setCatForm]    = useState(null) // null | BLANK_CAT | existing cat
  const [savingCat,  setSavingCat]  = useState(false)

  useEffect(() => {
    if (!userId) return
    Promise.all([fetchMyProfile(), fetchMySettings(), fetchMyCards(), fetchAllCategories()])
      .then(([p, s, c, cats]) => {
        setProfile(p)
        setSettings(s)
        setCards(c ?? [])
        setCategories(cats ?? [])
        setProfileDraft({ display_name: p?.display_name ?? '' })
        setSettingsDraft({
          currency:           s?.currency           ?? 'CLP',
          timezone:           s?.timezone           ?? 'America/Santiago',
          salary_payment_day: s?.salary_payment_day ?? '',
          month_start_day:    s?.month_start_day    ?? 1,
        })
        setLoading(false)
      })
      .catch(err => { console.error('UserProfile load:', err); setLoading(false) })
  }, [userId])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      await saveMyProfile({ display_name: profileDraft.display_name })
      setProfile(p => ({ ...p, display_name: profileDraft.display_name }))
      setSavedProfile(true)
      setTimeout(() => setSavedProfile(false), 2000)
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSavingProfile(false) }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const patch = {
        currency:           settingsDraft.currency,
        timezone:           settingsDraft.timezone,
        salary_payment_day: settingsDraft.salary_payment_day ? Number(settingsDraft.salary_payment_day) : null,
        month_start_day:    Number(settingsDraft.month_start_day) || 1,
      }
      await saveMySettings(userId, patch)
      setSettings(s => ({ ...s, ...patch }))
      setSavedSettings(true)
      setTimeout(() => setSavedSettings(false), 2000)
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSavingSettings(false) }
  }

  const handleSaveCard = async (draft) => {
    setSavingCard(true)
    try {
      if (cardForm?.id) {
        const updated = await updateCard({ ...cardForm, ...draft })
        setCards(prev => prev.map(c => c.id === updated.id ? updated : c))
      } else {
        const created = await createCard(draft, userId)
        setCards(prev => [...prev, created])
      }
      setCardForm(null)
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSavingCard(false) }
  }

  const handleDeleteCard = async (id) => {
    if (!window.confirm('¿Eliminar esta tarjeta?')) return
    try {
      await removeCard(id)
      setCards(prev => prev.filter(c => c.id !== id))
    } catch (err) { alert('Error: ' + err.message) }
  }

  const handleSaveCategory = async (draft) => {
    if (!draft.label.trim()) return
    setSavingCat(true)
    try {
      if (catForm?.id) {
        await updateUserCategory({ ...catForm, ...draft })
        setCategories(prev => prev.map(c => c.id === catForm.id ? { ...c, ...draft } : c))
      } else {
        const created = await createUserCategory(draft, userId)
        setCategories(prev => [...prev, created])
      }
      setCatForm(null)
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSavingCat(false) }
  }

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('¿Eliminar esta categoría?')) return
    try {
      await removeUserCategory(id)
      setCategories(prev => prev.filter(c => c.id !== id))
    } catch (err) { alert('Error: ' + err.message) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-7 h-7 rounded-full border-2 border-[var(--line)] border-t-[var(--ink)] animate-spin"/>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      {/* ── Datos básicos ───────────────────────────────────── */}
      <Card padding="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="font-semibold tracking-tight">Datos básicos</div>
          {savedProfile && <Badge tone="ok">✓ Guardado</Badge>}
        </div>
        <div className="flex flex-col gap-4">
          <Field label="Nombre visible">
            <input
              value={profileDraft.display_name}
              onChange={e => setProfileDraft(p => ({ ...p, display_name: e.target.value }))}
              placeholder="Tu nombre"
              className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
          </Field>
          <Field label="Email">
            <div className="h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] flex items-center text-[var(--ink-2)]">
              {userEmail}
            </div>
          </Field>
          <div className="flex items-center gap-2 pt-1">
            {profile?.role && profile.role !== 'user' && (
              <Badge tone={profile.role === 'super_admin' ? 'dark' : 'info'}>
                {profile.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </Badge>
            )}
            <button onClick={handleSaveProfile} disabled={savingProfile}
              className="h-9 px-4 bg-[var(--ink)] text-[var(--bg)] rounded-md text-[13px] font-medium disabled:opacity-50 ml-auto">
              {savingProfile ? 'Guardando…' : 'Guardar nombre'}
            </button>
          </div>
        </div>
      </Card>

      {/* ── Preferencias ────────────────────────────────────── */}
      <Card padding="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="font-semibold tracking-tight">Preferencias</div>
          {savedSettings && <Badge tone="ok">✓ Guardado</Badge>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Moneda">
            <select value={settingsDraft.currency}
              onChange={e => setSettingsDraft(p => ({ ...p, currency: e.target.value }))}
              className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]">
              {CURRENCIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Zona horaria">
            <select value={settingsDraft.timezone}
              onChange={e => setSettingsDraft(p => ({ ...p, timezone: e.target.value }))}
              className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]">
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Día de pago de sueldo" hint="Entre 1 y 31">
            <input type="number" value={settingsDraft.salary_payment_day}
              onChange={e => setSettingsDraft(p => ({ ...p, salary_payment_day: e.target.value }))}
              placeholder="—" min={1} max={31}
              className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
          </Field>
          <Field label="Inicio mes financiero" hint="Día en que empieza tu mes (1–28)">
            <input type="number" value={settingsDraft.month_start_day}
              onChange={e => setSettingsDraft(p => ({ ...p, month_start_day: e.target.value }))}
              placeholder="1" min={1} max={28}
              className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
          </Field>
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--line)] flex justify-end">
          <button onClick={handleSaveSettings} disabled={savingSettings}
            className="h-9 px-4 bg-[var(--ink)] text-[var(--bg)] rounded-md text-[13px] font-medium disabled:opacity-50">
            {savingSettings ? 'Guardando…' : 'Guardar preferencias'}
          </button>
        </div>
      </Card>

      {/* ── Tarjetas de crédito ──────────────────────────────── */}
      <Card padding="p-0">
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <div className="font-semibold tracking-tight">Tarjetas de crédito</div>
          {cardForm === null && (
            <button onClick={() => setCardForm(BLANK_CARD)}
              className="h-8 px-3 inline-flex items-center gap-1.5 bg-[var(--ink)] text-[var(--bg)] rounded-md text-[12px] font-medium">
              <Icon name="plus" size={13}/> Nueva tarjeta
            </button>
          )}
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {cards.length === 0 && cardForm === null && (
            <div className="py-8 text-center">
              <div className="text-[28px] mb-2">💳</div>
              <div className="text-[13px] font-medium">Sin tarjetas registradas</div>
              <div className="text-[12px] text-[var(--muted)] mt-1">
                Agrega tus tarjetas para llevar control de facturación y pagos.
              </div>
              <button onClick={() => setCardForm(BLANK_CARD)}
                className="mt-3 h-8 px-4 bg-[var(--ink)] text-[var(--bg)] rounded-md text-[12px] font-medium">
                Agregar primera tarjeta
              </button>
            </div>
          )}

          {cards.map(c => (
            <div key={c.id}>
              <div className={`rounded-lg border p-4 ${c.isActive ? 'border-[var(--line)]' : 'border-[var(--line)] opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-[var(--hover)] grid place-items-center">
                      <Icon name="card" size={15}/>
                    </div>
                    <div>
                      <div className="text-[13.5px] font-medium">
                        {c.name}
                        {c.lastFour && <span className="font-mono text-[var(--muted)] ml-2">•••• {c.lastFour}</span>}
                      </div>
                      <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
                        {c.bankLabel}
                        {c.billingDay && ` · Factura día ${c.billingDay}`}
                        {c.paymentDueDay && ` · Pago día ${c.paymentDueDay}`}
                        {c.creditLimit && ` · Límite ${fmtCLP(c.creditLimit)}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!c.isActive && <Badge tone="warn">Inactiva</Badge>}
                    <button onClick={() => setCardForm(cardForm?.id === c.id ? null : c)}
                      className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[var(--ink-2)]">
                      <Icon name="pencil" size={13}/>
                    </button>
                    <button onClick={() => handleDeleteCard(c.id)}
                      className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[#A02828]">
                      <Icon name="trash" size={13}/>
                    </button>
                  </div>
                </div>
              </div>
              {cardForm?.id === c.id && (
                <CardForm card={cardForm} onSave={handleSaveCard} onCancel={() => setCardForm(null)} saving={savingCard}/>
              )}
            </div>
          ))}

          {cardForm && !cardForm.id && (
            <CardForm card={null} onSave={handleSaveCard} onCancel={() => setCardForm(null)} saving={savingCard}/>
          )}
        </div>
      </Card>

      {/* ── Categorías ──────────────────────────────────────── */}
      <Card padding="p-0">
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <div>
            <div className="font-semibold tracking-tight">Categorías</div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">Las globales son de solo lectura. Crea las tuyas propias.</div>
          </div>
          {catForm === null && (
            <button onClick={() => setCatForm(BLANK_CAT)}
              className="h-8 px-3 inline-flex items-center gap-1.5 bg-[var(--ink)] text-[var(--bg)] rounded-md text-[12px] font-medium">
              <Icon name="plus" size={13}/> Nueva
            </button>
          )}
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Global categories (read-only) */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] mb-2">Globales</div>
            <div className="flex flex-wrap gap-2">
              {categories.filter(c => c.isGlobal).map(c => (
                <div key={c.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--line)] text-[12px]"
                  style={{ borderColor: c.color + '44', backgroundColor: c.color + '18' }}>
                  <span>{c.icon}</span>
                  <span style={{ color: c.color }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* User categories */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] mb-2">Mis categorías</div>
            {categories.filter(c => !c.isGlobal).length === 0 && catForm === null && (
              <div className="py-4 text-center text-[12px] text-[var(--muted)] border border-dashed border-[var(--line)] rounded-lg">
                Sin categorías propias aún
              </div>
            )}
            <div className="flex flex-col gap-2">
              {categories.filter(c => !c.isGlobal).map(c => (
                <div key={c.id}>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--line)]">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg leading-none">{c.icon}</span>
                      <span className="text-[13px] font-medium">{c.label}</span>
                      <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c.color }}/>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCatForm(catForm?.id === c.id ? null : c)}
                        className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[var(--ink-2)]">
                        <Icon name="pencil" size={13}/>
                      </button>
                      <button onClick={() => handleDeleteCategory(c.id)}
                        className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[#A02828]">
                        <Icon name="trash" size={13}/>
                      </button>
                    </div>
                  </div>
                  {catForm?.id === c.id && (
                    <CatForm cat={catForm} onSave={handleSaveCategory} onCancel={() => setCatForm(null)} saving={savingCat}/>
                  )}
                </div>
              ))}
            </div>
          </div>

          {catForm && !catForm.id && (
            <CatForm cat={null} onSave={handleSaveCategory} onCancel={() => setCatForm(null)} saving={savingCat}/>
          )}
        </div>
      </Card>
    </div>
  )
}
