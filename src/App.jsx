import React, { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import ExpensesList from './components/ExpensesList'
import ExpenseModal from './components/ExpenseModal'
import Budgets from './components/Budgets'
import Recurring from './components/Recurring'
import Installments from './components/Installments'
import Reports from './components/Reports'
import Comparison from './components/Comparison'
import UnparsedMessages from './components/UnparsedMessages'
import TelegramSettings from './components/TelegramSettings'
import Audit from './components/Audit'
import BotChat from './components/BotChat'
import { Icon } from './lib/helpers'
import {
  EXPENSES, UNPARSED, BUDGETS, RECURRING, INSTALLMENT_DEBTS,
  AUDIT_LOG, INCOME, RECEIVABLES, BOT_CHAT,
} from './data'
import { supabase, isConfigured } from './lib/supabase'
import { signOut } from './services/authService'
import { fetchExpenses, createExpense, updateExpense, removeExpense, patchExpense } from './services/expensesService'
import Login from './components/Login'

export default function App() {
  // ── Auth ────────────────────────────────────────────────────
  const [session, setSession]   = useState(null);
  const [authReady, setAuthReady] = useState(!isConfigured); // listo inmediatamente si no hay Supabase

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setExpenses(isConfigured ? [] : EXPENSES);
    setExpensesSource(isConfigured ? "loading" : "demo");
  };
  // ────────────────────────────────────────────────────────────

  const [view, setView]                   = useState("dashboard");
  const [expenses, setExpenses]           = useState(isConfigured ? [] : EXPENSES);
  const [expensesSource, setExpensesSource] = useState(isConfigured ? "loading" : "demo"); // "demo" | "loading" | "supabase" | "error"
  const [unparsed, setUnparsed]           = useState(UNPARSED);
  const [budgets, setBudgets]             = useState(BUDGETS);
  const [recurring, setRecurring]         = useState(RECURRING);
  const [installmentDebts, setInstallmentDebts] = useState(INSTALLMENT_DEBTS);
  const [auditLog, setAuditLog]           = useState(AUDIT_LOG);
  const [editing, setEditing]             = useState(null);
  const [botStatus, setBotStatus]         = useState("online");
  const [chatOpen, setChatOpen]           = useState(false);

  const lastBotMessage = BOT_CHAT[BOT_CHAT.length - 2];

  // Carga gastos desde Supabase solo cuando hay sesión activa.
  useEffect(() => {
    if (!isConfigured || !session) return
    let cancelled = false
    setExpensesSource("loading")
    fetchExpenses()
      .then(data => {
        if (cancelled) return
        // data es [] o array con gastos — nunca null cuando isConfigured es true
        setExpenses(data)
        setExpensesSource("supabase")
      })
      .catch(err => {
        if (cancelled) return
        console.error("[Supabase] fetchExpenses error:", err.message)
        setExpensesSource("error")
      })
    return () => { cancelled = true }
  }, [session]);

  const audit = (action, target, summary, actor = "user") => {
    setAuditLog(prev => [{
      id: "a" + Date.now(),
      at: new Date().toISOString(),
      actor, action, target, summary,
    }, ...prev]);
  };

  const navigate = (v) => { setView(v); window.scrollTo(0, 0); };

  const handleNewExpense = () => {
    setEditing({
      id: null,
      amount: 0,
      description: '',
      category: 'otros',
      bank: 'bchile',
      method: 'tarjeta',
      type: 'debito',
      installments: 1,
      status: 'ok',
      date: new Date().toISOString(),
      notes: '',
    });
  };

  const onSaveExpense = async (e) => {
    try {
      if (isConfigured && session) {
        if (e.id === null) {
          const created = await createExpense(e, session.user.id);
          setExpenses(prev => [created, ...prev]);
          audit("expense.created", created.id, `Registrado: ${created.description} — $${created.amount.toLocaleString("es-CL")}`);
        } else {
          const updated = await updateExpense(e);
          setExpenses(prev => prev.map(x => x.id === updated.id ? updated : x));
          audit("expense.edited", updated.id, `Editado: ${updated.description} — $${updated.amount.toLocaleString("es-CL")}`);
        }
      } else {
        // Modo demo — solo actualiza estado local
        if (e.id === null) {
          const demo = { ...e, id: "e" + Date.now() };
          setExpenses(prev => [demo, ...prev]);
        } else {
          setExpenses(prev => prev.map(x => x.id === e.id ? e : x));
        }
      }
      setEditing(null);
    } catch (err) {
      console.error("onSaveExpense error:", err);
      alert("Error al guardar el gasto: " + err.message);
    }
  };

  const onDeleteExpense = async (id) => {
    const e = expenses.find(x => x.id === id);
    if (!window.confirm("¿Eliminar este gasto?")) return;
    try {
      if (isConfigured && session) {
        await removeExpense(id);
      }
      setExpenses(prev => prev.filter(x => x.id !== id));
      if (e) audit("expense.deleted", id, `Eliminado: ${e.description} — $${e.amount.toLocaleString("es-CL")}`);
    } catch (err) {
      console.error("onDeleteExpense error:", err);
      alert("Error al eliminar: " + err.message);
    }
  };

  const onToggleStatus = async (id) => {
    const e = expenses.find(x => x.id === id);
    if (!e) return;
    const newStatus = e.status === "ok" ? "revisar" : "ok";
    try {
      if (isConfigured && session) {
        await patchExpense(id, { status: newStatus });
      }
      setExpenses(prev => prev.map(x => x.id === id ? { ...x, status: newStatus } : x));
      audit(
        newStatus === "revisar" ? "expense.flagged" : "expense.edited",
        id,
        newStatus === "revisar" ? `Marcado para revisar: ${e.description}` : `Marcado como revisado: ${e.description}`
      );
    } catch (err) {
      console.error("onToggleStatus error:", err);
    }
  };

  const onResolveUnparsed = (msgId, draft) => {
    const newExpense = {
      id: "e" + Date.now(),
      amount: Number(draft.amount) || 0,
      description: draft.description || "Mensaje completado",
      category: draft.category || "otros",
      bank: draft.bank || "bchile",
      method: draft.method || "tarjeta",
      type: draft.type || "debito",
      installments: Number(draft.installments) || 1,
      status: "ok",
      date: draft.date || new Date().toISOString(),
      notes: draft.notes || "",
    };
    setExpenses(prev => [newExpense, ...prev]);
    setUnparsed(prev => prev.filter(u => u.id !== msgId));
    audit("expense.created", newExpense.id, `Gasto registrado manualmente: ${newExpense.description} — $${newExpense.amount.toLocaleString("es-CL")}`);
  };

  const onDiscardUnparsed = (id) => {
    setUnparsed(prev => prev.filter(u => u.id !== id));
    audit("unparsed", id, "Mensaje descartado");
  };

  const onSetBudgets = (newBudgets) => {
    Object.keys(newBudgets).forEach(k => {
      if (newBudgets[k] !== budgets[k]) {
        audit("budget.updated", k, `Presupuesto: $${(budgets[k] || 0).toLocaleString("es-CL")} → $${newBudgets[k].toLocaleString("es-CL")}`);
      }
    });
    setBudgets(newBudgets);
  };

  const onSetRecurring = (newRec) => {
    newRec.forEach(r => {
      const old = recurring.find(o => o.id === r.id);
      if (!old) return;
      if (old.lastChargedMonth !== r.lastChargedMonth && r.lastChargedMonth) {
        audit("recurring.charged", r.id, `Cargo recurrente: ${r.name} — $${r.amount.toLocaleString("es-CL")}`, "user");
        const newExpense = {
          id: "e" + Date.now() + r.id,
          amount: r.amount,
          description: r.name,
          category: r.category,
          bank: r.bank,
          method: r.method,
          type: r.type,
          installments: 1,
          status: "ok",
          date: new Date().toISOString(),
          notes: "Generado desde recurrente",
        };
        setExpenses(prev => [newExpense, ...prev]);
      }
      if (old.active !== r.active) {
        audit("expense.edited", r.id, `${r.name}: ${r.active ? "activado" : "pausado"}`);
      }
    });
    setRecurring(newRec);
  };

  // Pantalla de carga mientras Supabase verifica la sesión
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--line)] border-t-[var(--ink)] animate-spin"/>
      </div>
    );
  }

  // Pantalla de login si Supabase está configurado pero no hay sesión
  if (isConfigured && !session) return <Login/>;

  return (
    <>
      <Layout view={view} setView={navigate} botStatus={botStatus} onOpenChat={() => setChatOpen(true)}
              onSignOut={isConfigured ? handleSignOut : undefined}
              userEmail={session?.user?.email}>
        {view === "dashboard" && (
          <Dashboard
            expenses={expenses}
            setView={navigate}
            budgets={budgets}
            recurring={recurring}
            income={INCOME}
            receivables={RECEIVABLES}
            installmentDebts={installmentDebts}
            botStatus={botStatus}
            lastBotMessage={lastBotMessage}
            openChat={() => setChatOpen(true)}
          />
        )}
        {view === "expenses" && (
          <>
            {expensesSource === "loading" && (
              <div className="h-0.5 w-full bg-[var(--line)] overflow-hidden mb-[-2px]">
                <div className="h-full bg-[var(--accent)] animate-pulse w-1/2"/>
              </div>
            )}
            <ExpensesList
              expenses={expenses}
              onEdit={setEditing}
              onDelete={onDeleteExpense}
              onToggleStatus={onToggleStatus}
              onNew={handleNewExpense}
              dataSource={expensesSource}
            />
          </>
        )}
        {view === "budgets" && (
          <Budgets expenses={expenses} budgets={budgets} setBudgets={onSetBudgets}/>
        )}
        {view === "recurring" && (
          <Recurring
            recurring={recurring}
            setRecurring={onSetRecurring}
            income={INCOME}
            receivables={RECEIVABLES}
          />
        )}
        {view === "installments" && (
          <Installments debts={installmentDebts} setDebts={setInstallmentDebts}/>
        )}
        {view === "reports" && <Reports expenses={expenses}/>}
        {view === "comparison" && <Comparison expenses={expenses}/>}
        {view === "unparsed" && (
          <UnparsedMessages
            unparsed={unparsed}
            onResolve={onResolveUnparsed}
            onDiscard={onDiscardUnparsed}
          />
        )}
        {view === "telegram" && (
          <TelegramSettings
            botStatus={botStatus}
            setBotStatus={setBotStatus}
            lastBotMessage={lastBotMessage}
          />
        )}
        {view === "audit" && <Audit entries={auditLog}/>}
      </Layout>

      {editing && (
        <ExpenseModal expense={editing} onClose={() => setEditing(null)} onSave={onSaveExpense}/>
      )}

      <BotChat open={chatOpen} onClose={() => setChatOpen(false)} onMessage={() => {}}/>

      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="lg:hidden fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full bg-[var(--ink)] text-[var(--bg)] grid place-items-center shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
          aria-label="Abrir chat con bot">
          <Icon name="bot" size={18}/>
        </button>
      )}
    </>
  );
}
