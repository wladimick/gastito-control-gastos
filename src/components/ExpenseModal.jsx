import React, { useState, useEffect } from 'react'
import { Icon, fmtCLP } from '../lib/helpers'
import { PAYMENT_METHODS, CATEGORIES } from '../data'
import { useBanks } from '../services/banksService'

// datetime-local no incluye zona horaria. Convertimos el ISO de Supabase a la
// hora local del dispositivo y, al guardar, lo transformamos nuevamente a ISO.
function toLocalDateTimeParts(value) {
  const parsed = value ? new Date(value) : new Date()
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  const local = shifted.toISOString()
  return {
    date: local.slice(0, 10),
    time: local.slice(11, 16),
  }
}

function localDateTimeToIso(datePart, timePart) {
  if (!datePart) return new Date().toISOString()
  const safeTime = /^\d{2}:\d{2}$/.test(timePart || '') ? timePart : '00:00'
  const parsed = new Date(`${datePart}T${safeTime}:00`)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

// ── Chevron SVG ───────────────────────────────────────────────
function Chevron({ color = '#9ba5c2' }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

// ── Field label ───────────────────────────────────────────────
function FieldLabel({ children }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.09em] uppercase mb-1.5"
         style={{ color: '#9ba5c2' }}>
      {children}
    </div>
  )
}

// ── Styled text input ─────────────────────────────────────────
function TxtInput({ value, onChange, placeholder, type = 'text', style: extraStyle = {}, className = '' }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`w-full rounded-[10px] border px-3.5 py-[11px] outline-none transition-colors ${className}`}
      style={{
        background:  '#f0efe9',
        borderColor: focused ? '#1e2535' : '#e8e6df',
        color:       '#1e2535',
        fontSize:    '16px',
        minWidth:    0,
        maxWidth:    '100%',
        boxSizing:   'border-box',
        ...extraStyle,
      }}
    />
  )
}

// ── Styled select with wrapper ────────────────────────────────
function StyledSelect({ value, onChange, children }) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="relative min-w-0">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full pl-3.5 pr-8 py-[10px] rounded-[10px] border outline-none appearance-none cursor-pointer transition-colors"
        style={{
          background:  '#f0efe9',
          borderColor: focused ? '#1e2535' : '#e8e6df',
          color:       '#1e2535',
          fontSize:    '16px',
          minWidth:    0,
          maxWidth:    '100%',
          boxSizing:   'border-box',
        }}>
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <Chevron color={focused ? '#1e2535' : '#9ba5c2'}/>
      </div>
    </div>
  )
}

// ── Toggle button ─────────────────────────────────────────────
function TogBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="flex-1 py-[10px] rounded-[10px] text-[13.5px] font-semibold border-[1.5px] transition-colors"
      style={active
        ? { background: '#1e2535', borderColor: '#1e2535', color: '#ffffff' }
        : { background: '#f0efe9', borderColor: '#dddbd3', color: '#9ba5c2' }}>
      {children}
    </button>
  )
}

// ── Main modal ────────────────────────────────────────────────
export default function ExpenseModal({ expense, onClose, onSave }) {
  const banks = useBanks()
  const [form, setForm] = useState(expense)
  useEffect(() => { setForm(expense) }, [expense])
  if (!expense) return null

  const isNew = expense.id === null
  const cat   = CATEGORIES.find(c => c.id === form.category) ?? CATEGORIES.find(c => c.id === 'otros') ?? CATEGORIES[0]
  const setF  = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const localDateTime = toLocalDateTimeParts(form.date)

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
         style={{ background: 'rgba(20,24,36,.5)', backdropFilter: 'blur(4px)' }}>
      <div className="absolute inset-0" onClick={onClose}/>

      <div className="relative w-full md:max-w-[430px] rounded-t-[20px] md:rounded-[20px] max-h-[92vh] overflow-y-auto overflow-x-hidden"
           style={{ background: '#ffffff', animation: 'sheetUp .28s cubic-bezier(.34,1.12,.64,1)', maxWidth: '100vw' }}>

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b"
             style={{ background: '#ffffff', borderColor: '#e8e6df', padding: '18px 16px 14px' }}>
          <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-[18px] shrink-0"
               style={{ background: (cat?.color ?? '#888') + '20' }}>
            {cat?.icon ?? '•'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-[0.09em] uppercase" style={{ color: '#9ba5c2' }}>
              {isNew ? 'Nuevo gasto' : 'Editar gasto'}
            </div>
            <div className="text-[13px] font-semibold truncate" style={{ color: '#1e2535' }}>
              {form.description || '—'}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-[32px] h-[32px] rounded-lg border flex items-center justify-center shrink-0"
            style={{ background: '#f0efe9', borderColor: '#e8e6df', color: '#5d6888' }}>
            <Icon name="x" size={14}/>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '16px' }} className="flex flex-col gap-4 overflow-x-hidden max-w-full">

          {/* Monto */}
          <div>
            <FieldLabel>Monto</FieldLabel>
            <div className="flex items-baseline gap-1.5 pt-3 pb-1">
              <span className="text-[24px] font-light" style={{ color: '#9ba5c2' }}>$</span>
              <input
                data-keep-size
                type="text"
                inputMode="numeric"
                value={form.amount}
                onChange={e => setF('amount', e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent outline-none tabular-nums"
                style={{ fontSize: '42px', fontWeight: 800, color: '#1e2535', letterSpacing: '-0.02em' }}
              />
            </div>
            <div className="text-[13px] mt-1" style={{ color: '#9ba5c2' }}>{fmtCLP(form.amount)}</div>
          </div>

          {/* Descripción */}
          <div>
            <FieldLabel>Descripción</FieldLabel>
            <TxtInput value={form.description} onChange={e => setF('description', e.target.value)}/>
          </div>

          {/* Categoría */}
          <div>
            <FieldLabel>Categoría</FieldLabel>
            <StyledSelect value={form.category} onChange={v => setF('category', v)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </StyledSelect>
          </div>

          {/* Fecha y hora local */}
          <div className="rounded-[12px] border p-3" style={{ background: '#faf9f6', borderColor: '#e8e6df' }}>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div>
                <FieldLabel>Fecha y hora</FieldLabel>
                <div className="text-[11px] -mt-1" style={{ color: '#9ba5c2' }}>
                  Hora local de este dispositivo
                </div>
              </div>
              <button
                type="button"
                onClick={() => setF('date', new Date().toISOString())}
                className="shrink-0 rounded-lg border px-3 py-2 text-[11px] font-semibold"
                style={{ background: '#ffffff', borderColor: '#dddbd3', color: '#5d6888' }}>
                Usar ahora
              </button>
            </div>
            <div className="grid grid-cols-[1.25fr_.75fr] gap-2.5">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold mb-1" style={{ color: '#9ba5c2' }}>Fecha</div>
                <TxtInput
                  type="date"
                  value={localDateTime.date}
                  onChange={e => setF('date', localDateTimeToIso(e.target.value, localDateTime.time))}
                  style={{ minWidth: 0 }}
                />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold mb-1" style={{ color: '#9ba5c2' }}>Hora</div>
                <TxtInput
                  type="time"
                  value={localDateTime.time}
                  onChange={e => setF('date', localDateTimeToIso(localDateTime.date, e.target.value))}
                  style={{ minWidth: 0 }}
                />
              </div>
            </div>
          </div>

          {/* Medio + banco */}
          <div className="grid grid-cols-2 gap-2.5 overflow-x-hidden">
            <div className="min-w-0">
              <FieldLabel>Medio de pago</FieldLabel>
              <StyledSelect value={form.method} onChange={v => setF('method', v)}>
                {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </StyledSelect>
            </div>
            <div className="min-w-0">
              <FieldLabel>Banco / Tarjeta</FieldLabel>
              <StyledSelect value={form.bank} onChange={v => setF('bank', v)}>
                {banks.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </StyledSelect>
            </div>
          </div>

          {/* Tipo de pago + cuotas */}
          <div>
            <FieldLabel>Tipo de pago</FieldLabel>
            <div className="flex gap-2 items-end">
              <div className="flex gap-2 flex-1">
                <TogBtn active={form.type === 'debito'}  onClick={() => setF('type', 'debito')}>Débito</TogBtn>
                <TogBtn active={form.type === 'credito'} onClick={() => setF('type', 'credito')}>Crédito</TogBtn>
              </div>
              <div className="text-center shrink-0">
                <div className="text-[10px] font-bold tracking-[0.09em] uppercase mb-1 text-center"
                     style={{ color: '#9ba5c2' }}>
                  Cuotas
                </div>
                <input
                  type="number" min="1" max="24"
                  value={form.installments}
                  disabled={form.type !== 'credito'}
                  onChange={e => setF('installments', Number(e.target.value))}
                  className="w-[80px] py-[10px] px-3 rounded-[10px] font-bold border-[1.5px] text-center outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#f0efe9', borderColor: '#dddbd3', color: '#1e2535', fontSize: '16px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <FieldLabel>Notas</FieldLabel>
            <textarea
              value={form.notes}
              rows={3}
              onChange={e => setF('notes', e.target.value)}
              placeholder="Algún detalle adicional..."
              className="w-full rounded-[10px] border px-3.5 py-[11px] outline-none resize-none leading-relaxed transition-colors"
              style={{ background: '#f0efe9', borderColor: '#e8e6df', color: '#1e2535', minHeight: '80px', fontSize: '16px', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#1e2535')}
              onBlur={e => (e.target.style.borderColor = '#e8e6df')}
            />
          </div>

          {/* Revisar banner */}
          {form.status === 'revisar' && (
            <div className="rounded-[10px] p-3 flex items-start gap-2 text-[12.5px]"
                 style={{ background: '#fffbeb', color: '#92400e' }}>
              <Icon name="alert" size={14}/>
              <div>Este gasto fue marcado para revisar. Al guardar, también lo marcaremos como registrado.</div>
            </div>
          )}
        </div>

        {/* ── Sticky footer ── */}
        <div className="sticky bottom-0 flex items-center justify-between border-t"
             style={{ background: '#ffffff', borderColor: '#e8e6df', padding: '14px 16px 28px' }}>
          <button type="button" onClick={onClose}
            className="text-[13px] font-semibold underline underline-offset-2 border-none bg-transparent cursor-pointer"
            style={{ color: '#9ba5c2' }}>
            Cancelar
          </button>
          <button type="button"
            onClick={() => onSave({ ...form, amount: Number(form.amount) || 0, status: 'ok' })}
            className="flex items-center gap-2 rounded-[10px] text-[14px] font-bold text-white border-none cursor-pointer"
            style={{ background: '#1e2535', padding: '12px 24px', boxShadow: '0 2px 8px rgba(30,37,53,.18)' }}>
            <Icon name="check" size={14}/>
            {isNew ? 'Registrar gasto' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
