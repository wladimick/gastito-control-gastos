import React, { useState, useMemo } from 'react'
import { Icon, fmtCLP, relDate, timeOnly, MES } from '../lib/helpers'
import { CATEGORIES, BANKS, PAYMENT_METHODS, TODAY } from '../data'

// ── Source badge ──────────────────────────────────────────────
const SRC = {
  demo:     { text: 'Modo demo',         style: { background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' } },
  loading:  { text: 'Cargando…',         style: { background: '#f0efe9', borderColor: '#dddbd3', color: '#9ba5c2' } },
  supabase: { text: 'Datos reales',      style: { background: 'rgba(61,214,140,0.10)', borderColor: 'rgba(61,214,140,0.22)', color: '#28c47a' } },
  error:    { text: 'Error de conexión', style: { background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.20)', color: '#ef4444' } },
}

// ── Filter select with chevron wrapper ────────────────────────
function SelectFilter({ value, onChange, options, placeholder }) {
  const active = Boolean(value)
  return (
    <div className="relative flex-1">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-3 pr-8 py-[9px] rounded-[10px] border text-[13px] outline-none appearance-none cursor-pointer transition-colors"
        style={{
          background:  active ? '#1e2535' : '#f0efe9',
          borderColor: active ? '#1e2535' : '#e8e6df',
          color:       active ? '#ffffff' : '#9ba5c2',
        }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke={active ? '#fff' : '#9ba5c2'} strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}

// ── Category tag ──────────────────────────────────────────────
function CatTag({ cat }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
          style={{ background: '#f0efe9', borderColor: '#dddbd3', color: '#5d6888' }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat.color ?? '#9ca3af' }}/>
      {cat.label}
    </span>
  )
}

// ── Payment type tag ──────────────────────────────────────────
function PayTag({ type, method, installments }) {
  if (method === 'efectivo') {
    return (
      <span className="text-[11px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
            style={{ background: '#fefce8', borderColor: '#fde68a', color: '#92400e' }}>
        Efectivo
      </span>
    )
  }
  if (type === 'credito') {
    return (
      <span className="text-[11px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
            style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
        Crédito{installments > 1 ? ` (${installments}c)` : ''}
      </span>
    )
  }
  return (
    <span className="text-[11px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
          style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d' }}>
      Débito
    </span>
  )
}

// ── Edit/Delete action buttons ────────────────────────────────
function ActBtn({ onClick, variant, children }) {
  const style = variant === 'del'
    ? { background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.20)', color: '#ef4444' }
    : { background: '#f0efe9', borderColor: '#dddbd3', color: '#5d6888' }
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-opacity hover:opacity-75"
      style={style}>
      {children}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────
export default function ExpensesList({ expenses, onEdit, onDelete, onToggleStatus, onNew, dataSource = 'demo' }) {
  const today = TODAY

  const months = useMemo(() => {
    const set = new Set()
    expenses.forEach(e => {
      const d = new Date(e.date)
      set.add(`${d.getFullYear()}-${d.getMonth()}`)
    })
    return Array.from(set).map(k => {
      const [y, m] = k.split('-').map(Number)
      return { value: k, label: `${MES[m]} ${y}` }
    }).sort().reverse()
  }, [expenses])

  const [fMonth,  setFMonth]  = useState(`${today.getFullYear()}-${today.getMonth()}`)
  const [fCat,    setFCat]    = useState('')
  const [fBank,   setFBank]   = useState('')
  const [fMethod, setFMethod] = useState('')
  const [fType,   setFType]   = useState('')
  const [q,       setQ]       = useState('')

  const filtered = expenses.filter(e => {
    const d = new Date(e.date)
    if (fMonth  && `${d.getFullYear()}-${d.getMonth()}` !== fMonth) return false
    if (fCat    && e.category !== fCat)   return false
    if (fBank   && e.bank    !== fBank)   return false
    if (fMethod && e.method  !== fMethod) return false
    if (fType   && e.type    !== fType)   return false
    if (q && !e.description.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).sort((a, b) => new Date(b.date) - new Date(a.date))

  const total         = filtered.reduce((s, e) => s + e.amount, 0)
  const activeFilters = [fCat, fBank, fMethod, fType, q].filter(Boolean).length
  const clearAll      = () => { setFCat(''); setFBank(''); setFMethod(''); setFType(''); setQ('') }

  const src = SRC[dataSource] ?? SRC.demo

  return (
    <div className="flex flex-col gap-3">

      {/* ── Filter panel ── */}
      <div className="rounded-2xl border shadow-sm" style={{ background: '#ffffff', borderColor: '#e8e6df', padding: '12px 14px 14px' }}>
        {/* Row 1: search + month */}
        <div className="flex gap-2 mb-2">
          <div className="flex items-center gap-2 rounded-[10px] border px-3 py-[9px] min-w-0"
               style={{ background: '#f0efe9', borderColor: '#e8e6df', flex: '1.4' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <circle cx="11" cy="11" r="7" stroke="#9ba5c2" strokeWidth="1.8"/>
              <path d="M21 21l-4.35-4.35" stroke="#9ba5c2" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar descripción..."
              className="bg-transparent text-[13px] outline-none min-w-0 w-full"
              style={{ color: '#1e2535' }}
            />
          </div>
          <div className="relative" style={{ flex: 1 }}>
            <select
              value={fMonth}
              onChange={e => setFMonth(e.target.value)}
              className="w-full pl-3 pr-8 py-[9px] rounded-[10px] border text-[13px] outline-none appearance-none cursor-pointer"
              style={{ background: '#f0efe9', borderColor: '#e8e6df', color: '#5d6888' }}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="#9ba5c2" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Row 2: category + bank */}
        <div className="flex gap-2 mb-2">
          <SelectFilter value={fCat}  onChange={setFCat}
            options={CATEGORIES.map(c => ({ value: c.id, label: c.label }))} placeholder="Categoría"/>
          <SelectFilter value={fBank} onChange={setFBank}
            options={BANKS.map(b => ({ value: b.id, label: b.label }))} placeholder="Banco"/>
        </div>

        {/* Row 3: medio + tipo */}
        <div className="flex gap-2 mb-2">
          <SelectFilter value={fMethod} onChange={setFMethod}
            options={PAYMENT_METHODS.map(m => ({ value: m.id, label: m.label }))} placeholder="Medio"/>
          <SelectFilter value={fType} onChange={setFType}
            options={[{ value: 'debito', label: 'Débito' }, { value: 'credito', label: 'Crédito' }]}
            placeholder="Tipo"/>
        </div>

        {/* Row 4: clear + nuevo */}
        <div className="flex gap-2 items-center mt-0.5">
          {activeFilters > 0 && (
            <button onClick={clearAll}
              className="text-[12.5px] font-semibold underline underline-offset-2 shrink-0 px-1"
              style={{ color: '#9ba5c2', background: 'none', border: 'none', cursor: 'pointer' }}>
              Limpiar ({activeFilters})
            </button>
          )}
          {onNew && (
            <button onClick={onNew}
              className="flex-1 flex items-center justify-center gap-2 py-[9px] px-4 rounded-[10px] text-[13px] font-bold text-white border-none cursor-pointer"
              style={{ background: '#1e2535', boxShadow: '0 2px 8px rgba(30,37,53,.15)' }}>
              <Icon name="plus" size={14}/> Nuevo gasto
            </button>
          )}
        </div>
      </div>

      {/* ── Summary row ── */}
      <div className="flex items-center justify-between px-1">
        <div className="text-[13px]" style={{ color: '#5d6888' }}>
          <strong className="font-extrabold" style={{ color: '#1e2535' }}>{filtered.length} gastos</strong>
          {' · '}{fmtCLP(total)}
        </div>
        <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full border" style={src.style}>
          {src.text}
        </span>
      </div>

      {/* ── Error state ── */}
      {dataSource === 'error' && (
        <div className="rounded-2xl border p-4"
             style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.20)' }}>
          <div className="flex items-center gap-3" style={{ color: '#ef4444' }}>
            <Icon name="alert" size={16}/>
            <div>
              <div className="font-semibold text-[13px]">Error al conectar con Supabase</div>
              <div className="text-[12px] mt-0.5">Revisa tu conexión o las variables de entorno.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {dataSource === 'supabase' && expenses.length === 0 && activeFilters === 0 && (
        <div className="rounded-2xl border p-12 text-center shadow-sm"
             style={{ background: '#ffffff', borderColor: '#e8e6df' }}>
          <div className="text-[32px] mb-3">📭</div>
          <div className="font-bold text-[14px]" style={{ color: '#1e2535' }}>Sin gastos registrados</div>
          <div className="text-[12.5px] mt-1 mb-4" style={{ color: '#9ba5c2' }}>
            Agrega tu primer gasto o envía un mensaje al bot de Telegram.
          </div>
          {onNew && (
            <button onClick={onNew}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-bold text-white border-none cursor-pointer"
              style={{ background: '#1e2535' }}>
              <Icon name="plus" size={13}/> Registrar gasto
            </button>
          )}
        </div>
      )}

      {/* ── Desktop table (md+) ── */}
      <div className="hidden md:block rounded-2xl border overflow-hidden shadow-sm"
           style={{ background: '#ffffff', borderColor: '#e8e6df' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: '#e8e6df' }}>
                {['Fecha','Descripción','Categoría','Medio','Banco','Monto','Estado',''].map((h, i) => (
                  <th key={i}
                    className={`py-3 px-4 text-[10.5px] font-bold tracking-[0.09em] uppercase ${i === 5 ? 'text-right' : 'text-left'}`}
                    style={{ color: '#9ba5c2' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const cat  = CATEGORIES.find(c => c.id === e.category) ?? CATEGORIES[0]
                const bank = BANKS.find(b => b.id === e.bank)
                return (
                  <tr key={e.id}
                    className="border-b last:border-b-0 group transition-colors hover:bg-[#f0efe9]"
                    style={{ borderColor: '#e8e6df' }}>
                    <td className="py-3 px-4 align-top">
                      <div style={{ color: '#1e2535' }}>{relDate(e.date)}</div>
                      <div className="text-[11px] font-mono mt-0.5" style={{ color: '#9ba5c2' }}>{timeOnly(e.date)}</div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-[13.5px]" style={{ color: '#1e2535' }}>{e.description}</div>
                      {e.notes && (
                        <div className="text-[11.5px] mt-0.5 truncate max-w-[260px]" style={{ color: '#9ba5c2' }}>{e.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top"><CatTag cat={cat}/></td>
                    <td className="py-3 px-4 align-top">
                      <PayTag type={e.type} method={e.method} installments={e.installments}/>
                    </td>
                    <td className="py-3 px-4 align-top text-[13px]" style={{ color: '#5d6888' }}>{bank?.label}</td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums font-bold"
                        style={{ color: '#1e2535' }}>
                      {fmtCLP(e.amount)}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {e.status === 'revisar'
                        ? <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full border"
                                style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>revisar</span>
                        : <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full border"
                                style={{ background: 'rgba(61,214,140,0.10)', borderColor: 'rgba(61,214,140,0.22)', color: '#28c47a' }}>registrado</span>}
                    </td>
                    <td className="py-2 pl-4 pr-3 align-top">
                      <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {e.status === 'revisar' && (
                          <button onClick={() => onToggleStatus(e.id)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11.5px] font-semibold"
                            style={{ background: 'rgba(61,214,140,0.10)', borderColor: 'rgba(61,214,140,0.22)', color: '#28c47a' }}>
                            <Icon name="check" size={12}/>
                          </button>
                        )}
                        <button onClick={() => onEdit(e)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11.5px] font-semibold"
                          style={{ background: '#f0efe9', borderColor: '#dddbd3', color: '#5d6888' }}>
                          <Icon name="pencil" size={12}/>
                        </button>
                        <button onClick={() => onDelete(e.id)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11.5px] font-semibold"
                          style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.20)', color: '#ef4444' }}>
                          <Icon name="trash" size={12}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-10 text-center text-[13px]" style={{ color: '#9ba5c2' }}>
              Sin resultados para los filtros actuales.
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile cards ── */}
      <div className="md:hidden flex flex-col gap-2.5">
        {filtered.map(e => {
          const cat  = CATEGORIES.find(c => c.id === e.category) ?? CATEGORIES.find(c => c.id === 'otros') ?? CATEGORIES[0]
          const bank = BANKS.find(b => b.id === e.bank)
          return (
            <div key={e.id} className="rounded-2xl border overflow-hidden shadow-sm"
                 style={{ background: '#ffffff', borderColor: '#e8e6df' }}>
              {/* Main row */}
              <div className="flex items-start gap-3" style={{ padding: '13px 14px 10px' }}>
                <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-[18px] shrink-0 border"
                     style={{ background: (cat.color ?? '#888') + '20', borderColor: '#e8e6df' }}>
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-[13.5px] font-semibold truncate"
                         style={{ maxWidth: '180px', color: '#1e2535' }}>
                      {e.description}
                    </div>
                    <div className="text-[14px] font-extrabold tabular-nums whitespace-nowrap shrink-0"
                         style={{ color: '#1e2535' }}>
                      {fmtCLP(e.amount)}
                    </div>
                  </div>
                  <div className="text-[11.5px] mt-[3px]" style={{ color: '#9ba5c2' }}>
                    {relDate(e.date)} · {timeOnly(e.date)}{bank ? ` · ${bank.label}` : ''}
                  </div>
                  <div className="flex gap-1.5 mt-[7px] flex-wrap">
                    <CatTag cat={cat}/>
                    <PayTag type={e.type} method={e.method} installments={e.installments}/>
                    {e.status === 'revisar' && (
                      <span className="text-[11px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                            style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                        revisar
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions footer */}
              <div className="flex justify-end gap-1.5 border-t"
                   style={{ padding: '9px 14px 11px', borderColor: '#e8e6df' }}>
                {e.status === 'revisar' && (
                  <ActBtn onClick={() => onToggleStatus(e.id)} variant="ok">
                    <Icon name="check" size={13}/> Revisar
                  </ActBtn>
                )}
                <ActBtn onClick={() => onEdit(e)} variant="edit">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  Editar
                </ActBtn>
                <ActBtn onClick={() => onDelete(e.id)} variant="del">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Eliminar
                </ActBtn>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="rounded-2xl border p-8 text-center text-[13px] shadow-sm"
               style={{ background: '#ffffff', borderColor: '#e8e6df', color: '#9ba5c2' }}>
            Sin resultados.
          </div>
        )}
      </div>
    </div>
  )
}
