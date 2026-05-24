import React, { useState, useEffect } from 'react'
import { Icon, fmtCLP } from '../lib/helpers'
import { PAYMENT_METHODS } from '../data'
import { useBanks } from '../services/banksService'
import { useCategories } from '../services/categoriesService'

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
      className={`w-full rounded-[10px] border px-3.5 py-[11px] text-[13.5px] outline-none transition-colors ${className}`}
      style={{
        background:  '#f0efe9',
        borderColor: focused ? '#1e2535' : '#e8e6df',
        color:       '#1e2535',
        ...extraStyle,
      }}
    />
  )
}

// ── Styled select with wrapper ────────────────────────────────
function StyledSelect({ value, onChange, children }) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full pl-3.5 pr-8 py-[10px] rounded-[10px] border text-[13.5px] outline-none appearance-none cursor-pointer transition-colors"
        style={{
          background:  '#f0efe9',
          borderColor: focused ? '#1e2535' : '#e8e6df',
          color:       '#1e2535',
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
  const banks      = useBanks()
  const categories = useCategories()
  const [form, setForm] = useState(expense)
  useEffect(() => { setForm(expense) }, [expense])
  if (!expense) return null

  const isNew    = expense.id === null
  const cat      = categories.find(c => c.id === form.category) ?? categories.find(c => c.id === 'otros') ?? categories[0]
  const setF     = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const dateInput = new Date(form.date).toISOString().slice(0, 16)

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
         style={{ background: 'rgba(20,24,36,.5)', backdropFilter: 'blur(4px)' }}>
      <div className="absolute inset-0" onClick={onClose}/>

      <div className="relative w-full md:max-w-[430px] rounded-t-[20px] md:rounded-[20px] max-h-[92vh] overflow-y-auto"
           style={{ background: '#ffffff', animation: 'sheetUp .28s cubic-bezier(.34,1.12,.64,1)' }}>

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
        <div style={{ padding: '16px' }} className="flex flex-col gap-4">

          {/* Monto */}
          <div>
            <FieldLabel>Monto</FieldLabel>
            <div className="flex items-baseline gap-1.5 pt-3 pb-1">
              <span className="text-[24px] font-light" style={{ color: '#9ba5c2' }}>$</span>
              <input
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

          {/* Categoría + fecha */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel>Categoría</FieldLabel>
              <StyledSelect value={form.category} onChange={v => setF('category', v)}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </StyledSelect>
            </div>
            <div>
              <FieldLabel>Fecha y hora</FieldLabel>
              <TxtInput
                type="datetime-local"
                value={dateInput}
                onChange={e => setF('date', new Date(e.target.value).toISOString())}
                style={{ fontSize: '12px' }}
                className="px-3"
              />
            </div>
          </div>

          {/* Medio + banco */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel>Medio de pago</FieldLabel>
              <StyledSelect value={form.method} onChange={v => setF('method', v)}>
                {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </StyledSelect>
            </div>
            <div>
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
                  className="w-[80px] py-[10px] px-3 rounded-[10px] text-[13.5px] font-bold border-[1.5px] text-center outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#f0efe9', borderColor: '#dddbd3', color: '#1e2535' }}
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
              className="w-full rounded-[10px] border px-3.5 py-[11px] text-[13.5px] outline-none resize-none leading-relaxed transition-colors"
              style={{ background: '#f0efe9', borderColor: '#e8e6df', color: '#1e2535', minHeight: '80px' }}
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
