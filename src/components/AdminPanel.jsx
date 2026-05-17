import React, { useState, useEffect } from 'react'
import { Card, Badge } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'
import { BANKS } from '../data'
import {
  fetchUserList, fetchUserDetails,
  updateUserProfile, updateUserSettings,
  createCardForUser, updateCardForUser, removeCardForUser,
  logAdminAction,
} from '../services/adminService'

const ROLE_LABELS = { user: 'Usuario', admin: 'Admin', super_admin: 'Super Admin' }
const ROLE_TONES  = { user: 'muted',   admin: 'info',  super_admin: 'dark' }
const CURRENCIES  = ['CLP', 'ARS', 'USD', 'MXN']
const TIMEZONES   = ['America/Santiago', 'America/Buenos_Aires', 'America/Lima', 'America/Mexico_City', 'UTC']

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SaveBar({ saving, saved, onSave, label = 'Guardar' }) {
  return (
    <div className="mt-4 pt-4 border-t border-[var(--line)] flex items-center justify-between">
      {saved && (
        <span className="text-[12px] text-[var(--accent-ink)] inline-flex items-center gap-1.5">
          <Icon name="check" size={13}/> Guardado
        </span>
      )}
      <button onClick={onSave} disabled={saving}
        className="ml-auto h-8 px-4 bg-[var(--ink)] text-[var(--bg)] rounded-md text-[12px] font-medium disabled:opacity-50">
        {saving ? 'Guardando…' : label}
      </button>
    </div>
  )
}

const BLANK_CARD = { name: '', bank: '', lastFour: '', billingDay: '', paymentDueDay: '', creditLimit: '' }

function AdminCardForm({ targetUserId, card, onSave, onCancel, saving }) {
  const [draft, setDraft] = useState(card ? {
    name: card.name || '', bank: card.bank || '', lastFour: card.lastFour || '',
    billingDay: card.billingDay || '', paymentDueDay: card.paymentDueDay || '',
    creditLimit: card.creditLimit || '',
  } : BLANK_CARD)
  const set = (k, v) => setDraft(p => ({ ...p, [k]: v }))
  return (
    <div className="mt-2 rounded-lg border border-[var(--ink)]/20 p-3 bg-[var(--bg)] flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nombre"><input value={draft.name} onChange={e => set('name', e.target.value)} placeholder="Visa Banco Chile"
          className="w-full h-8 px-2.5 bg-[var(--bg-elev)] border border-[var(--line)] rounded text-[12px] focus:outline-none focus:border-[var(--ink)]"/></Field>
        <Field label="Banco">
          <select value={draft.bank} onChange={e => set('bank', e.target.value)}
            className="w-full h-8 px-2.5 bg-[var(--bg-elev)] border border-[var(--line)] rounded text-[12px] focus:outline-none focus:border-[var(--ink)]">
            <option value="">—</option>
            {BANKS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="4 dígitos"><input value={draft.lastFour} onChange={e => set('lastFour', e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="1234"
          className="w-full h-8 px-2.5 bg-[var(--bg-elev)] border border-[var(--line)] rounded text-[12px] font-mono focus:outline-none focus:border-[var(--ink)]"/></Field>
        <Field label="Límite"><input type="number" value={draft.creditLimit} onChange={e => set('creditLimit', e.target.value)} placeholder="—" min={0}
          className="w-full h-8 px-2.5 bg-[var(--bg-elev)] border border-[var(--line)] rounded text-[12px] focus:outline-none focus:border-[var(--ink)]"/></Field>
        <Field label="Factura día"><input type="number" value={draft.billingDay} onChange={e => set('billingDay', e.target.value)} placeholder="—" min={1} max={31}
          className="w-full h-8 px-2.5 bg-[var(--bg-elev)] border border-[var(--line)] rounded text-[12px] focus:outline-none focus:border-[var(--ink)]"/></Field>
        <Field label="Pago día"><input type="number" value={draft.paymentDueDay} onChange={e => set('paymentDueDay', e.target.value)} placeholder="—" min={1} max={31}
          className="w-full h-8 px-2.5 bg-[var(--bg-elev)] border border-[var(--line)] rounded text-[12px] focus:outline-none focus:border-[var(--ink)]"/></Field>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(draft)} disabled={!draft.name.trim() || saving}
          className="h-7 px-3 bg-[var(--ink)] text-[var(--bg)] rounded text-[11px] font-medium disabled:opacity-50">
          {saving ? '…' : card ? 'Guardar' : 'Crear'}
        </button>
        <button onClick={onCancel} className="h-7 px-3 border border-[var(--line)] rounded text-[11px] text-[var(--ink-2)] hover:bg-[var(--hover)]">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function AdminPanel({ adminUserId }) {
  const [users,         setUsers]         = useState([])
  const [loadingUsers,  setLoadingUsers]  = useState(true)
  const [usersError,    setUsersError]    = useState(null)
  const [selectedId,    setSelectedId]    = useState(null)
  const [detail,        setDetail]        = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [profileDraft,  setProfileDraft]  = useState(null)
  const [settingsDraft, setSettingsDraft] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savedProfile,  setSavedProfile]  = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savedSettings,  setSavedSettings]  = useState(false)

  const [cardForm,    setCardForm]    = useState(null)
  const [savingCard,  setSavingCard]  = useState(false)

  useEffect(() => {
    fetchUserList()
      .then(list => { setUsers(list); setLoadingUsers(false) })
      .catch(err  => { setUsersError(err.message); setLoadingUsers(false) })
  }, [])

  const selectUser = async (id) => {
    if (id === selectedId) return
    setSelectedId(id)
    setDetail(null)
    setCardForm(null)
    setLoadingDetail(true)
    try {
      const d = await fetchUserDetails(id)
      setDetail(d)
      setProfileDraft({
        display_name:  d.profile?.display_name  ?? '',
        role:          d.profile?.role          ?? 'user',
        is_active:     d.profile?.is_active     !== false,
        support_notes: d.profile?.support_notes ?? '',
      })
      setSettingsDraft({
        currency:           d.settings?.currency           ?? 'CLP',
        timezone:           d.settings?.timezone           ?? 'America/Santiago',
        salary_payment_day: d.settings?.salary_payment_day ?? '',
        month_start_day:    d.settings?.month_start_day    ?? 1,
      })
    } catch (err) { console.error(err) }
    finally { setLoadingDetail(false) }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      await updateUserProfile(selectedId, profileDraft)
      await logAdminAction(adminUserId, selectedId, 'update_profile', profileDraft)
      setUsers(prev => prev.map(u => u.id === selectedId ? { ...u, ...profileDraft } : u))
      setDetail(d => ({ ...d, profile: { ...d.profile, ...profileDraft } }))
      setSavedProfile(true); setTimeout(() => setSavedProfile(false), 2000)
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
      await updateUserSettings(selectedId, patch)
      await logAdminAction(adminUserId, selectedId, 'update_settings', patch)
      setSavedSettings(true); setTimeout(() => setSavedSettings(false), 2000)
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSavingSettings(false) }
  }

  const handleSaveCard = async (draft) => {
    setSavingCard(true)
    try {
      if (cardForm?.id) {
        await updateCardForUser(cardForm.id, {
          name:            draft.name,
          bank_id:         draft.bank || null,
          last_four:       draft.lastFour || null,
          billing_day:     draft.billingDay     ? Number(draft.billingDay)     : null,
          payment_due_day: draft.paymentDueDay  ? Number(draft.paymentDueDay)  : null,
          credit_limit:    draft.creditLimit    ? Number(draft.creditLimit)    : null,
        })
        await logAdminAction(adminUserId, selectedId, 'update_card', { cardId: cardForm.id })
        const updated = { ...cardForm, ...draft, bankLabel: BANKS.find(b => b.id === draft.bank)?.label ?? draft.bank }
        setDetail(d => ({ ...d, cards: d.cards.map(c => c.id === cardForm.id ? updated : c) }))
      } else {
        const created = await createCardForUser(selectedId, draft)
        await logAdminAction(adminUserId, selectedId, 'create_card', { name: draft.name })
        setDetail(d => ({ ...d, cards: [...d.cards, created] }))
      }
      setCardForm(null)
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSavingCard(false) }
  }

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm('¿Eliminar esta tarjeta?')) return
    try {
      await removeCardForUser(cardId)
      await logAdminAction(adminUserId, selectedId, 'delete_card', { cardId })
      setDetail(d => ({ ...d, cards: d.cards.filter(c => c.id !== cardId) }))
    } catch (err) { alert('Error: ' + err.message) }
  }

  const selectedUser = users.find(u => u.id === selectedId)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">

      {/* ── Lista de usuarios ──────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <Card padding="p-0">
          <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
            <div className="font-semibold tracking-tight text-[14px]">Usuarios</div>
            <Badge tone="muted">{users.length}</Badge>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center h-24">
              <div className="w-5 h-5 rounded-full border-2 border-[var(--line)] border-t-[var(--ink)] animate-spin"/>
            </div>
          ) : usersError ? (
            <div className="px-4 py-6 text-center">
              <div className="text-[12px] text-[#A02828]">{usersError}</div>
              <div className="text-[11px] text-[var(--muted)] mt-1">Verifica que tengas rol super_admin</div>
            </div>
          ) : users.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-[var(--muted)]">Sin usuarios</div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {users.map(u => (
                <li key={u.id}>
                  <button onClick={() => selectUser(u.id)}
                    className={`w-full px-4 py-3 text-left flex items-start gap-3 transition
                      ${selectedId === u.id ? 'bg-[var(--hover)]' : 'hover:bg-[var(--hover)]'}`}>
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${u.is_active !== false ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`}/>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">
                        {u.display_name || u.email}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] truncate mt-0.5">{u.email}</div>
                    </div>
                    <Badge tone={ROLE_TONES[u.role] ?? 'muted'} className="shrink-0">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="rounded-lg border border-[var(--line)] p-4 flex items-start gap-2.5 text-[12px] text-[var(--muted)]">
          <Icon name="info" size={14} className="mt-0.5 shrink-0"/>
          <div>
            Los gastos de cada usuario son privados. El admin no los ve por defecto — solo puede ayudar con configuraciones y tarjetas.
          </div>
        </div>
      </div>

      {/* ── Detalle del usuario seleccionado ──────────────── */}
      <div className="flex flex-col gap-5">
        {!selectedId && (
          <div className="flex items-center justify-center h-64 rounded-xl border-2 border-dashed border-[var(--line)]">
            <div className="text-center">
              <Icon name="users" size={28} className="mx-auto text-[var(--muted)] mb-2"/>
              <div className="text-[13px] text-[var(--muted)]">Selecciona un usuario para ver su ficha</div>
            </div>
          </div>
        )}

        {selectedId && loadingDetail && (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--line)] border-t-[var(--ink)] animate-spin"/>
          </div>
        )}

        {selectedId && !loadingDetail && detail && (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-full bg-[var(--hover)] border border-[var(--line)] grid place-items-center font-semibold text-[15px]">
                {(selectedUser?.display_name || selectedUser?.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold tracking-tight text-[15px]">
                  {selectedUser?.display_name || selectedUser?.email}
                </div>
                <div className="text-[12px] text-[var(--muted)]">{selectedUser?.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={detail.profile?.is_active !== false ? 'ok' : 'warn'}>
                  {detail.profile?.is_active !== false ? 'Activo' : 'Inactivo'}
                </Badge>
                <Badge tone={ROLE_TONES[detail.profile?.role] ?? 'muted'}>
                  {ROLE_LABELS[detail.profile?.role] ?? detail.profile?.role}
                </Badge>
              </div>
            </div>

            {/* Perfil */}
            <Card padding="p-5">
              <div className="font-semibold tracking-tight mb-4">Perfil</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nombre visible">
                  <input value={profileDraft.display_name}
                    onChange={e => setProfileDraft(p => ({ ...p, display_name: e.target.value }))}
                    className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
                </Field>
                <Field label="Rol">
                  <select value={profileDraft.role}
                    onChange={e => setProfileDraft(p => ({ ...p, role: e.target.value }))}
                    className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]">
                    <option value="user">Usuario</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </Field>
                <Field label="Estado">
                  <div className="flex items-center gap-3 h-9">
                    <button
                      onClick={() => setProfileDraft(p => ({ ...p, is_active: !p.is_active }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${profileDraft.is_active ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${profileDraft.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                    </button>
                    <span className="text-[13px]">{profileDraft.is_active ? 'Activo' : 'Inactivo'}</span>
                  </div>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Notas de soporte">
                    <textarea value={profileDraft.support_notes}
                      onChange={e => setProfileDraft(p => ({ ...p, support_notes: e.target.value }))}
                      rows={2} placeholder="Notas internas del administrador"
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] resize-none focus:outline-none focus:border-[var(--ink)]"/>
                  </Field>
                </div>
              </div>
              <SaveBar saving={savingProfile} saved={savedProfile} onSave={handleSaveProfile} label="Guardar perfil"/>
            </Card>

            {/* Configuración */}
            <Card padding="p-5">
              <div className="font-semibold tracking-tight mb-4">Configuración</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Moneda">
                  <select value={settingsDraft.currency}
                    onChange={e => setSettingsDraft(p => ({ ...p, currency: e.target.value }))}
                    className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Zona horaria">
                  <select value={settingsDraft.timezone}
                    onChange={e => setSettingsDraft(p => ({ ...p, timezone: e.target.value }))}
                    className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]">
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </Field>
                <Field label="Día pago sueldo">
                  <input type="number" value={settingsDraft.salary_payment_day}
                    onChange={e => setSettingsDraft(p => ({ ...p, salary_payment_day: e.target.value }))}
                    placeholder="—" min={1} max={31}
                    className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
                </Field>
                <Field label="Inicio mes financiero">
                  <input type="number" value={settingsDraft.month_start_day}
                    onChange={e => setSettingsDraft(p => ({ ...p, month_start_day: e.target.value }))}
                    placeholder="1" min={1} max={28}
                    className="w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
                </Field>
              </div>
              <SaveBar saving={savingSettings} saved={savedSettings} onSave={handleSaveSettings} label="Guardar configuración"/>
            </Card>

            {/* Telegram */}
            <Card padding="p-5">
              <div className="font-semibold tracking-tight mb-3">Telegram</div>
              {detail.telegram ? (
                <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] p-3.5">
                  <div className={`w-8 h-8 rounded-md grid place-items-center text-white ${detail.telegram.is_active ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`}>
                    <Icon name="bot" size={15}/>
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium font-mono">
                      {detail.telegram.telegram_username ? `@${detail.telegram.telegram_username}` : 'Vinculado'}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] font-mono mt-0.5">
                      chat_id: {detail.telegram.chat_id}
                    </div>
                  </div>
                  <Badge tone={detail.telegram.is_active ? 'ok' : 'warn'}>
                    {detail.telegram.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              ) : (
                <div className="text-[12px] text-[var(--muted)] py-2">Sin cuenta Telegram vinculada</div>
              )}
            </Card>

            {/* Tarjetas */}
            <Card padding="p-0">
              <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
                <div className="font-semibold tracking-tight">Tarjetas</div>
                {cardForm === null && (
                  <button onClick={() => setCardForm(BLANK_CARD)}
                    className="h-7 px-3 inline-flex items-center gap-1.5 bg-[var(--ink)] text-[var(--bg)] rounded text-[11px] font-medium">
                    <Icon name="plus" size={12}/> Agregar
                  </button>
                )}
              </div>

              <div className="px-5 py-4 flex flex-col gap-2">
                {detail.cards.length === 0 && cardForm === null && (
                  <div className="py-4 text-center text-[12px] text-[var(--muted)]">
                    Sin tarjetas registradas
                  </div>
                )}
                {detail.cards.map(c => (
                  <div key={c.id}>
                    <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] p-3">
                      <Icon name="card" size={14} className="text-[var(--muted)]"/>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium">
                          {c.name}
                          {c.lastFour && <span className="font-mono text-[var(--muted)] ml-1.5 text-[11px]">•••• {c.lastFour}</span>}
                        </div>
                        <div className="text-[11px] text-[var(--muted)] mt-0.5">
                          {c.bankLabel}
                          {c.billingDay && ` · Factura ${c.billingDay}`}
                          {c.paymentDueDay && ` · Pago ${c.paymentDueDay}`}
                          {c.creditLimit && ` · ${fmtCLP(c.creditLimit)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setCardForm(cardForm?.id === c.id ? null : c)}
                          className="w-6 h-6 grid place-items-center rounded hover:bg-[var(--hover)] text-[var(--ink-2)]">
                          <Icon name="pencil" size={12}/>
                        </button>
                        <button onClick={() => handleDeleteCard(c.id)}
                          className="w-6 h-6 grid place-items-center rounded hover:bg-[var(--hover)] text-[#A02828]">
                          <Icon name="trash" size={12}/>
                        </button>
                      </div>
                    </div>
                    {cardForm?.id === c.id && (
                      <AdminCardForm targetUserId={selectedId} card={cardForm}
                        onSave={handleSaveCard} onCancel={() => setCardForm(null)} saving={savingCard}/>
                    )}
                  </div>
                ))}
                {cardForm && !cardForm.id && (
                  <AdminCardForm targetUserId={selectedId} card={null}
                    onSave={handleSaveCard} onCancel={() => setCardForm(null)} saving={savingCard}/>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
