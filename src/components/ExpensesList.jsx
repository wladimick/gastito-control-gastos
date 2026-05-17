import React, { useState, useMemo } from 'react'
import { Card, Badge, IconBtn, CatChip, Select, TextInput } from './ui'
import { Icon, fmtCLP, relDate, timeOnly, MES } from '../lib/helpers'
import { CATEGORIES, BANKS, PAYMENT_METHODS, TODAY } from '../data'

const SOURCE_LABEL = {
  demo:     { text: "Modo demo",        cls: "bg-[var(--amber-soft)] text-[var(--amber-ink)]" },
  loading:  { text: "Cargando…",        cls: "bg-[var(--line)] text-[var(--muted)]" },
  supabase: { text: "Datos reales",     cls: "bg-[color:oklch(0.93_0.06_145)] text-[color:oklch(0.38_0.12_145)]" },
  error:    { text: "Error de conexión",cls: "bg-[color:oklch(0.93_0.06_25)] text-[color:oklch(0.45_0.18_25)]" },
}

export default function ExpensesList({ expenses, onEdit, onDelete, onToggleStatus, onNew, dataSource = "demo" }) {
  const today = TODAY;

  const months = useMemo(() => {
    const set = new Set();
    expenses.forEach(e => {
      const d = new Date(e.date);
      set.add(`${d.getFullYear()}-${d.getMonth()}`);
    });
    return Array.from(set).map(k => {
      const [y, m] = k.split("-").map(Number);
      return { value: k, label: `${MES[m]} ${y}` };
    }).sort().reverse();
  }, [expenses]);

  const [fMonth,  setFMonth]  = useState(`${today.getFullYear()}-${today.getMonth()}`);
  const [fCat,    setFCat]    = useState("");
  const [fBank,   setFBank]   = useState("");
  const [fMethod, setFMethod] = useState("");
  const [fType,   setFType]   = useState("");
  const [q,       setQ]       = useState("");

  const filtered = expenses.filter(e => {
    const d = new Date(e.date);
    if (fMonth && `${d.getFullYear()}-${d.getMonth()}` !== fMonth) return false;
    if (fCat    && e.category !== fCat)    return false;
    if (fBank   && e.bank    !== fBank)    return false;
    if (fMethod && e.method  !== fMethod)  return false;
    if (fType   && e.type    !== fType)    return false;
    if (q && !e.description.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const activeFilters = [fCat, fBank, fMethod, fType, q].filter(Boolean).length;
  const clearAll = () => { setFCat(""); setFBank(""); setFMethod(""); setFType(""); setQ(""); };

  const src = SOURCE_LABEL[dataSource] ?? SOURCE_LABEL.demo

  return (
    <div className="flex flex-col gap-4">
      <Card padding="p-3.5 md:p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <TextInput value={q} onChange={setQ} placeholder="Buscar descripción..." icon="search" className="flex-1 min-w-[200px]"/>
          <Select value={fMonth}  onChange={setFMonth}  options={months}                                                            className="w-[150px]"/>
          <Select value={fCat}    onChange={setFCat}    placeholder="Categoría"    options={CATEGORIES.map(c  => ({ value: c.id,  label: c.label  }))} className="w-[150px]"/>
          <Select value={fBank}   onChange={setFBank}   placeholder="Banco"        options={BANKS.map(b       => ({ value: b.id,  label: b.label  }))} className="w-[150px]"/>
          <Select value={fMethod} onChange={setFMethod} placeholder="Medio"        options={PAYMENT_METHODS.map(m => ({ value: m.id, label: m.label }))} className="w-[140px]"/>
          <Select value={fType}   onChange={setFType}   placeholder="Tipo"         options={[{value:"debito",label:"Débito"},{value:"credito",label:"Crédito"}]} className="w-[130px]"/>
          {activeFilters > 0 && (
            <button onClick={clearAll} className="text-[12px] text-[var(--muted)] hover:text-[var(--ink)] underline">
              Limpiar ({activeFilters})
            </button>
          )}
          {onNew && (
            <button
              onClick={onNew}
              className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium shrink-0 hover:opacity-90 transition-opacity">
              <Icon name="plus" size={14}/> Nuevo gasto
            </button>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between text-[12.5px] text-[var(--muted)] px-1">
        <div>{filtered.length} gastos · <span className="font-mono text-[var(--ink-2)]">{fmtCLP(total)}</span></div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${src.cls}`}>{src.text}</span>
      </div>

      {dataSource === "error" && (
        <Card padding="p-5" className="border-[color:oklch(0.85_0.08_25)]">
          <div className="flex items-center gap-3 text-[color:oklch(0.45_0.18_25)]">
            <Icon name="alert" size={16}/>
            <div>
              <div className="font-semibold text-[13px]">Error al conectar con Supabase</div>
              <div className="text-[12px] mt-0.5">Revisa tu conexión o las variables de entorno.</div>
            </div>
          </div>
        </Card>
      )}

      {dataSource === "supabase" && expenses.length === 0 && activeFilters === 0 && (
        <Card padding="p-12" className="text-center">
          <div className="text-[32px] mb-3">📭</div>
          <div className="font-semibold text-[15px] tracking-tight">Sin gastos registrados</div>
          <div className="text-[13px] text-[var(--muted)] mt-1 mb-4">Agrega tu primer gasto o envía un mensaje al bot de Telegram.</div>
          {onNew && (
            <button
              onClick={onNew}
              className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
              <Icon name="plus" size={14}/> Registrar gasto
            </button>
          )}
        </Card>
      )}

      {/* Tabla desktop */}
      <Card padding="p-0" className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="text-left font-medium py-3 px-4">Fecha</th>
                <th className="text-left font-medium py-3 px-4">Descripción</th>
                <th className="text-left font-medium py-3 px-4">Categoría</th>
                <th className="text-left font-medium py-3 px-4">Medio</th>
                <th className="text-left font-medium py-3 px-4">Banco</th>
                <th className="text-right font-medium py-3 px-4">Monto</th>
                <th className="text-left font-medium py-3 px-4">Estado</th>
                <th className="text-right font-medium py-3 pl-4 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const bank = BANKS.find(b => b.id === e.bank);
                return (
                  <tr key={e.id} className="border-b last:border-b-0 border-[var(--line)] hover:bg-[var(--hover)] group">
                    <td className="py-3 px-4 align-top">
                      <div className="text-[13px]">{relDate(e.date)}</div>
                      <div className="text-[11px] text-[var(--muted)] font-mono">{timeOnly(e.date)}</div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-medium text-[13.5px]">{e.description}</div>
                      {e.notes && <div className="text-[11.5px] text-[var(--muted)] mt-0.5 truncate max-w-[260px]">{e.notes}</div>}
                    </td>
                    <td className="py-3 px-4 align-top"><CatChip catId={e.category}/></td>
                    <td className="py-3 px-4 align-top">
                      <div className="flex items-center gap-1.5">
                        <Icon name={e.method === "efectivo" ? "cash" : "card"} size={13}/>
                        <span className="capitalize">{e.method === "efectivo" ? "Efectivo" : (e.type === "credito" ? "Crédito" : "Débito")}</span>
                        {e.installments > 1 && <Badge tone="muted">{e.installments}c</Badge>}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top text-[var(--ink-2)]">{bank?.label}</td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums">{fmtCLP(e.amount)}</td>
                    <td className="py-3 px-4 align-top">
                      {e.status === "revisar" ? <Badge tone="warn">revisar</Badge> : <Badge tone="ok">registrado</Badge>}
                    </td>
                    <td className="py-2 pl-4 pr-3 align-top">
                      <div className="flex items-center gap-0.5 justify-end opacity-50 group-hover:opacity-100 transition">
                        {e.status === "revisar" && (
                          <IconBtn name="check" label="Marcar como revisado" tone="ok" onClick={() => onToggleStatus(e.id)}/>
                        )}
                        <IconBtn name="pencil" label="Editar"    tone="outline" onClick={() => onEdit(e)}/>
                        <IconBtn name="trash"  label="Eliminar"  tone="danger"  onClick={() => onDelete(e.id)}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-10 text-center text-[var(--muted)] text-[13px]">Sin resultados para los filtros actuales.</div>
          )}
        </div>
      </Card>

      {/* Lista móvil */}
      <div className="md:hidden flex flex-col gap-2.5">
        {filtered.map(e => {
          const cat  = CATEGORIES.find(c => c.id === e.category) ?? CATEGORIES.find(c => c.id === 'otros') ?? CATEGORIES[0];
          const bank = BANKS.find(b => b.id === e.bank);
          return (
            <Card key={e.id} padding="p-3.5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md grid place-items-center text-[15px] shrink-0" style={{ background: (cat.color ?? '#888') + "20" }}>{cat.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-[14px] truncate">{e.description}</div>
                    <div className="font-mono text-[14px] shrink-0">{fmtCLP(e.amount)}</div>
                  </div>
                  <div className="mt-1 text-[11.5px] text-[var(--muted)] flex items-center gap-1.5 flex-wrap">
                    <span>{relDate(e.date)} · {timeOnly(e.date)}</span>
                    <span>·</span>
                    <span>{bank?.label}</span>
                    {e.installments > 1 && <><span>·</span><span>{e.installments} cuotas</span></>}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <CatChip catId={e.category}/>
                    <Badge tone="muted">{e.method === "efectivo" ? "Efectivo" : (e.type === "credito" ? "Crédito" : "Débito")}</Badge>
                    {e.status === "revisar" && <Badge tone="warn">revisar</Badge>}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--line)] flex items-center justify-end gap-1">
                {e.status === "revisar" && <IconBtn name="check" label="Revisado" tone="ok"    onClick={() => onToggleStatus(e.id)}/>}
                <IconBtn name="pencil" label="Editar"   tone="outline" onClick={() => onEdit(e)}/>
                <IconBtn name="trash"  label="Eliminar" tone="danger"  onClick={() => onDelete(e.id)}/>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card padding="p-8" className="text-center text-[var(--muted)] text-[13px]">Sin resultados.</Card>
        )}
      </div>
    </div>
  );
}
