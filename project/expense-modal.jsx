// ExpenseModal (panel lateral en desktop, sheet en móvil)
const { useState: useStateEm, useEffect: useEffectEm } = React;
function ExpenseModal({ expense, onClose, onSave }) {
  const { Badge, Select } = window.UI;
  const { Icon, fmtCLP } = window.Helpers;
  const [form, setForm] = useStateEm(expense);
  useEffectEm(() => { setForm(expense); }, [expense]);
  if (!expense) return null;

  const cat = window.MOCK.CATEGORIES.find(c => c.id === form.category);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const dateISO = new Date(form.date);
  const dateInput = dateISO.toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex md:items-stretch items-end justify-end">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose}/>
      <div className="relative w-full md:max-w-[480px] md:h-screen bg-[var(--bg-elev)] border-l border-[var(--line)]
                      rounded-t-2xl md:rounded-none animate-[slideUp_.2s_ease-out] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--bg-elev)] border-b border-[var(--line)] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-md grid place-items-center text-[16px]" style={{ background: cat.color + "20" }}>{cat.icon}</div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Editar gasto</div>
              <div className="font-semibold tracking-tight truncate">{form.description || "—"}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-md border border-[var(--line)] hover:bg-[var(--hover)]">
            <Icon name="x" size={16}/>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Monto destacado */}
          <div>
            <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Monto</label>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-mono text-[28px] text-[var(--muted)]">$</span>
              <input
                type="number"
                value={form.amount}
                onChange={e => setF("amount", Number(e.target.value))}
                className="flex-1 bg-transparent text-[28px] font-mono tabular-nums tracking-tight focus:outline-none border-b border-transparent focus:border-[var(--ink)] py-1"
              />
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-1 font-mono">{fmtCLP(form.amount)}</div>
          </div>

          <Field label="Descripción">
            <input value={form.description} onChange={e => setF("description", e.target.value)}
              className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md focus:outline-none focus:border-[var(--ink)] text-[14px]"/>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <Select value={form.category} onChange={v => setF("category", v)}
                options={window.MOCK.CATEGORIES.map(c => ({ value: c.id, label: c.label }))}/>
            </Field>
            <Field label="Fecha y hora">
              <input type="datetime-local" value={dateInput}
                onChange={e => setF("date", new Date(e.target.value).toISOString())}
                className="w-full h-9 px-2 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Medio de pago">
              <Select value={form.method} onChange={v => setF("method", v)}
                options={window.MOCK.PAYMENT_METHODS.map(m => ({ value: m.id, label: m.label }))}/>
            </Field>
            <Field label="Banco / Tarjeta">
              <Select value={form.bank} onChange={v => setF("bank", v)}
                options={window.MOCK.BANKS.map(b => ({ value: b.id, label: b.label }))}/>
            </Field>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <Field label="Tipo de pago">
              <div className="grid grid-cols-2 gap-2 mt-1">
                {["debito","credito"].map(t => (
                  <button key={t} type="button" onClick={() => setF("type", t)}
                    className={`h-9 rounded-md border text-[13px] transition
                      ${form.type === t ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]" : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]"}`}>
                    {t === "debito" ? "Débito" : "Crédito"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Cuotas">
              <input type="number" min="1" max="24" value={form.installments}
                disabled={form.type !== "credito"}
                onChange={e => setF("installments", Number(e.target.value))}
                className="w-20 h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[14px] font-mono text-center disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-[var(--ink)]"/>
            </Field>
          </div>

          <Field label="Notas">
            <textarea value={form.notes} rows={3} onChange={e => setF("notes", e.target.value)}
              placeholder="Algún detalle adicional..."
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-md focus:outline-none focus:border-[var(--ink)] text-[13px] resize-none"/>
          </Field>

          {form.status === "revisar" && (
            <div className="p-3 rounded-md bg-[var(--amber-soft)] text-[var(--amber-ink)] text-[12.5px] flex items-start gap-2">
              <Icon name="alert" size={14}/>
              <div>Este gasto fue marcado para revisar. Al guardar, también lo marcaremos como registrado.</div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[var(--bg-elev)] border-t border-[var(--line)] px-5 py-3 flex items-center justify-between">
          <button onClick={onClose} className="text-[13px] text-[var(--muted)] hover:text-[var(--ink)] underline">Cancelar</button>
          <button
            onClick={() => onSave({ ...form, status: "ok" })}
            className="h-10 px-5 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
            <Icon name="check" size={14}/> Guardar cambios
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

window.ExpenseModal = ExpenseModal;
