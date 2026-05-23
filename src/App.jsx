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
import AdminPanel from './components/AdminPanel'
import UserProfile from './components/UserProfile'
import Savings from './components/Savings'
import Accounts from './components/Accounts'
import Projection from './components/Projection'
import BotChat from './components/BotChat'
import { Icon } from './lib/helpers'
import {
  EXPENSES, UNPARSED, BUDGETS, RECURRING, INSTALLMENT_DEBTS,
  AUDIT_LOG, BOT_CHAT,
} from './data'
import { supabase, isConfigured } from './lib/supabase'
import { signOut } from './services/authService'
import { fetchExpenses, createExpense, updateExpense, removeExpense, patchExpense } from './services/expensesService'
import {
  fetchRecurring, fetchIncome, fetchReceivables, fetchPayables,
  createRecurring, updateRecurring, patchRecurring, removeRecurring,
  createItem, updateItem,
} from './services/recurringService'
import { fetchMySettings } from './services/userSettingsService'
import { fetchInstallments, createInstallment, updateInstallment, patchInstallment, removeInstallment } from './services/installmentsService'
import { fetchBudgets, upsertBudget } from './services/budgetsService'
import { fetchUnparsedMessages, fetchLastBotMessage } from './services/telegramMessagesService'
import { fetchAuditLog } from './services/auditService'
import { fetchCurrentRole } from './services/adminService'
import { fetchGoals, createGoal, updateGoal, removeGoal, addMovement } from './services/savingsService'
import { fetchAccounts, createAccount, updateAccount, removeAccount } from './services/accountsService'
import { fetchMyCards, createCard, updateCard, removeCard } from './services/creditCardsService'
import Login, { NewPasswordForm } from './components/Login'

const IS_REAL = isConfigured

export default function App() {
  // ── Auth ────────────────────────────────────────────────────
  const [session,    setSession]    = useState(null)
  const [authReady,  setAuthReady]  = useState(!IS_REAL)
  const [userRole,   setUserRole]   = useState('user')
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    if (!IS_REAL) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (_e === 'PASSWORD_RECOVERY') setIsRecovery(true)
      else setIsRecovery(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load role after session established
  useEffect(() => {
    if (!IS_REAL || !session) return
    fetchCurrentRole().then(role => setUserRole(role)).catch(() => setUserRole('user'))
  }, [session])

  const handleSignOut = async () => {
    await signOut()
    setUserRole('user')
    setExpenses(IS_REAL ? [] : EXPENSES)
    setExpensesSource(IS_REAL ? 'loading' : 'demo')
    setRecurringList(IS_REAL ? [] : RECURRING)
    setIncomeList([])
    setReceivablesList([])
    setPayablesList([])
    setUserSettings(null)
    setInstallmentDebts(IS_REAL ? [] : INSTALLMENT_DEBTS)
    setBudgets(IS_REAL ? {} : BUDGETS)
    setUnparsed(IS_REAL ? [] : UNPARSED)
    setAuditLog(IS_REAL ? [] : AUDIT_LOG)
    setLastBotMessage(null)
    setSavingsGoals([])
    setAccounts([])
    setCreditCards([])
  }
  // ────────────────────────────────────────────────────────────

  const [view, setView]       = useState('dashboard')
  const [editing, setEditing] = useState(null)
  const [botStatus, setBotStatus] = useState('online')
  const [chatOpen, setChatOpen]   = useState(false)

  // ── Expenses ────────────────────────────────────────────────
  const [expenses, setExpenses]           = useState(IS_REAL ? [] : EXPENSES)
  const [expensesSource, setExpensesSource] = useState(IS_REAL ? 'loading' : 'demo')

  useEffect(() => {
    if (!IS_REAL || !session) return
    let cancelled = false
    setExpensesSource('loading')
    fetchExpenses()
      .then(data => { if (!cancelled) { setExpenses(data); setExpensesSource('supabase') } })
      .catch(err  => { if (!cancelled) { console.error('fetchExpenses:', err); setExpensesSource('error') } })
    return () => { cancelled = true }
  }, [session])

  // ── Recurring ───────────────────────────────────────────────
  const [recurringList, setRecurringList] = useState(IS_REAL ? [] : RECURRING)

  useEffect(() => {
    if (!IS_REAL || !session) return
    fetchRecurring()
      .then(data => { if (data) setRecurringList(data) })
      .catch(err  => console.error('fetchRecurring:', err))
  }, [session])

  // ── Income / Receivables / Payables ─────────────────────────
  const [incomeList,      setIncomeList]      = useState([])
  const [receivablesList, setReceivablesList] = useState([])
  const [payablesList,    setPayablesList]    = useState([])

  useEffect(() => {
    if (!IS_REAL || !session) return
    fetchIncome()
      .then(data => { if (data) setIncomeList(data) })
      .catch(err  => console.error('fetchIncome:', err))
    fetchReceivables()
      .then(data => { if (data) setReceivablesList(data) })
      .catch(err  => console.error('fetchReceivables:', err))
    fetchPayables()
      .then(data => { if (data) setPayablesList(data) })
      .catch(err  => console.error('fetchPayables:', err))
  }, [session])

  // ── User settings (for salary day, etc.) ─────────────────────
  const [userSettings, setUserSettings] = useState(null)

  useEffect(() => {
    if (!IS_REAL || !session) return
    fetchMySettings()
      .then(s => { if (s) setUserSettings(s) })
      .catch(() => {})
  }, [session])

  // ── Installments ────────────────────────────────────────────
  const [installmentDebts, setInstallmentDebts] = useState(IS_REAL ? [] : INSTALLMENT_DEBTS)

  useEffect(() => {
    if (!IS_REAL || !session) return
    fetchInstallments()
      .then(data => { if (data) setInstallmentDebts(data) })
      .catch(err  => console.error('fetchInstallments:', err))
  }, [session])

  // ── Budgets ─────────────────────────────────────────────────
  const [budgets, setBudgets] = useState(IS_REAL ? {} : BUDGETS)

  useEffect(() => {
    if (!IS_REAL || !session) return
    fetchBudgets()
      .then(data => { if (data) setBudgets(data) })
      .catch(err  => console.error('fetchBudgets:', err))
  }, [session])

  // ── Unparsed messages ────────────────────────────────────────
  const [unparsed, setUnparsed] = useState(IS_REAL ? [] : UNPARSED)

  useEffect(() => {
    if (!IS_REAL || !session) return
    fetchUnparsedMessages()
      .then(data => { if (data) setUnparsed(data) })
      .catch(err  => console.error('fetchUnparsedMessages:', err))
  }, [session])

  // ── Last bot message ─────────────────────────────────────────
  const [lastBotMessage, setLastBotMessage] = useState(IS_REAL ? null : BOT_CHAT[BOT_CHAT.length - 2])

  useEffect(() => {
    if (!IS_REAL || !session) return
    fetchLastBotMessage()
      .then(msg => { if (msg) setLastBotMessage(msg) })
      .catch(() => {})
  }, [session])

  // ── Accounts & Credit Cards ──────────────────────────────────
  const [accounts,    setAccounts]    = useState([])
  const [creditCards, setCreditCards] = useState([])

  useEffect(() => {
    if (!IS_REAL || !session) return
    fetchAccounts()
      .then(data => setAccounts(data))
      .catch(err  => console.error('fetchAccounts:', err))
    fetchMyCards()
      .then(data => setCreditCards(data))
      .catch(err  => console.error('fetchMyCards:', err))
  }, [session])

  const onCreateAccount = async (a) => {
    const created = await createAccount(a, session.user.id)
    setAccounts(prev => [...prev, created])
  }
  const onUpdateAccount = async (a) => {
    const updated = await updateAccount(a)
    setAccounts(prev => prev.map(x => x.id === updated.id ? updated : x))
  }
  const onDeleteAccount = async (id) => {
    await removeAccount(id)
    setAccounts(prev => prev.filter(x => x.id !== id))
  }

  const onCreateCard = async (c) => {
    const created = await createCard(c, session.user.id)
    setCreditCards(prev => [...prev, created])
  }
  const onUpdateCard = async (c) => {
    const updated = await updateCard(c)
    setCreditCards(prev => prev.map(x => x.id === updated.id ? updated : x))
  }
  const onDeleteCard = async (id) => {
    await removeCard(id)
    setCreditCards(prev => prev.filter(x => x.id !== id))
  }

  // ── Savings ──────────────────────────────────────────────────
  const [savingsGoals, setSavingsGoals] = useState([])

  useEffect(() => {
    if (!IS_REAL || !session) return
    fetchGoals()
      .then(data => setSavingsGoals(data))
      .catch(err  => console.error('fetchGoals:', err))
  }, [session])

  // ── Audit log ─────────────────────────────────────────────────
  const [auditLog, setAuditLog] = useState(IS_REAL ? [] : AUDIT_LOG)

  useEffect(() => {
    if (!IS_REAL || !session) return
    fetchAuditLog()
      .then(data => { if (data) setAuditLog(data) })
      .catch(err  => console.error('fetchAuditLog:', err))
  }, [session])

  // Local audit (session-only; Supabase audit_logs are written by backend triggers)
  const audit = (action, target, summary, actor = 'user') => {
    setAuditLog(prev => [{
      id: 'a' + Date.now(), at: new Date().toISOString(),
      actor, action, target, summary,
    }, ...prev])
  }

  const navigate = (v) => { setView(v); window.scrollTo(0, 0) }

  // ── Expense CRUD ─────────────────────────────────────────────
  const handleNewExpense = () => {
    setEditing({
      id: null, amount: '', description: '', category: 'otros',
      bank: 'bchile', method: 'tarjeta', type: 'debito',
      installments: 1, status: 'ok', date: new Date().toISOString(), notes: '',
    })
  }

  const onSaveExpense = async (e) => {
    try {
      if (IS_REAL && session) {
        if (e.id === null) {
          const created = await createExpense(e, session.user.id)
          setExpenses(prev => [created, ...prev])
          audit('expense.created', created.id, `Registrado: ${created.description} — $${created.amount.toLocaleString('es-CL')}`)
        } else {
          const updated = await updateExpense(e)
          setExpenses(prev => prev.map(x => x.id === updated.id ? updated : x))
          audit('expense.edited', updated.id, `Editado: ${updated.description} — $${updated.amount.toLocaleString('es-CL')}`)
        }
      } else {
        if (e.id === null) {
          const demo = { ...e, id: 'e' + Date.now() }
          setExpenses(prev => [demo, ...prev])
        } else {
          setExpenses(prev => prev.map(x => x.id === e.id ? e : x))
        }
      }
      setEditing(null)
    } catch (err) {
      console.error('onSaveExpense:', err)
      alert('Error al guardar el gasto: ' + err.message)
    }
  }

  const onDeleteExpense = async (id) => {
    const e = expenses.find(x => x.id === id)
    if (!window.confirm('¿Eliminar este gasto?')) return
    try {
      if (IS_REAL && session) await removeExpense(id)
      setExpenses(prev => prev.filter(x => x.id !== id))
      if (e) audit('expense.deleted', id, `Eliminado: ${e.description} — $${e.amount.toLocaleString('es-CL')}`)
    } catch (err) {
      console.error('onDeleteExpense:', err)
      alert('Error al eliminar: ' + err.message)
    }
  }

  const onToggleStatus = async (id) => {
    const e = expenses.find(x => x.id === id)
    if (!e) return
    const newStatus = e.status === 'ok' ? 'revisar' : 'ok'
    try {
      if (IS_REAL && session) await patchExpense(id, { status: newStatus })
      setExpenses(prev => prev.map(x => x.id === id ? { ...x, status: newStatus } : x))
      audit(
        newStatus === 'revisar' ? 'expense.flagged' : 'expense.edited', id,
        newStatus === 'revisar' ? `Marcado para revisar: ${e.description}` : `Marcado como revisado: ${e.description}`
      )
    } catch (err) { console.error('onToggleStatus:', err) }
  }

  // ── Recurring CRUD ───────────────────────────────────────────
  const onCreateRecurring = async (r) => {
    try {
      if (IS_REAL && session) {
        const created = await createRecurring(r, session.user.id)
        setRecurringList(prev => [...prev, created])
        audit('recurring.created', created.id, `Recurrente creado: ${created.name} — $${created.amount.toLocaleString('es-CL')}`)
      } else {
        setRecurringList(prev => [...prev, { ...r, id: 'rc' + Date.now() }])
      }
    } catch (err) { console.error('onCreateRecurring:', err); alert(err.message) }
  }

  const onUpdateRecurring = async (r) => {
    try {
      if (IS_REAL && session) {
        const updated = await updateRecurring(r)
        setRecurringList(prev => prev.map(x => x.id === updated.id ? updated : x))
      } else {
        setRecurringList(prev => prev.map(x => x.id === r.id ? r : x))
      }
    } catch (err) { console.error('onUpdateRecurring:', err); alert(err.message) }
  }

  const onDeleteRecurring = async (id) => {
    if (!window.confirm('¿Eliminar este gasto recurrente?')) return
    try {
      if (IS_REAL && session) await removeRecurring(id)
      setRecurringList(prev => prev.filter(x => x.id !== id))
    } catch (err) { console.error('onDeleteRecurring:', err); alert(err.message) }
  }

  // ── Income CRUD ──────────────────────────────────────────────
  const onCreateIncome = async (r) => {
    try {
      if (IS_REAL && session) {
        const created = await createItem(r, session.user.id, 'income')
        setIncomeList(prev => [...prev, created])
      } else {
        setIncomeList(prev => [...prev, { ...r, id: 'inc' + Date.now() }])
      }
    } catch (err) { console.error('onCreateIncome:', err); alert(err.message) }
  }

  const onUpdateIncome = async (r) => {
    try {
      if (IS_REAL && session) {
        const updated = await updateItem(r)
        setIncomeList(prev => prev.map(x => x.id === updated.id ? updated : x))
      } else {
        setIncomeList(prev => prev.map(x => x.id === r.id ? r : x))
      }
    } catch (err) { console.error('onUpdateIncome:', err); alert(err.message) }
  }

  const onDeleteIncome = async (id) => {
    if (!window.confirm('¿Eliminar este ingreso recurrente?')) return
    try {
      if (IS_REAL && session) await removeRecurring(id)
      setIncomeList(prev => prev.filter(x => x.id !== id))
    } catch (err) { console.error('onDeleteIncome:', err); alert(err.message) }
  }

  // ── Receivables CRUD ─────────────────────────────────────────
  const onCreateReceivable = async (r) => {
    try {
      if (IS_REAL && session) {
        const created = await createItem(r, session.user.id, 'receivable')
        setReceivablesList(prev => [...prev, created])
      } else {
        setReceivablesList(prev => [...prev, { ...r, id: 'rec' + Date.now(), status: 'pending' }])
      }
    } catch (err) { console.error('onCreateReceivable:', err); alert(err.message) }
  }

  const onUpdateReceivable = async (r) => {
    try {
      if (IS_REAL && session) {
        const updated = await updateItem(r)
        setReceivablesList(prev => prev.map(x => x.id === updated.id ? updated : x))
      } else {
        setReceivablesList(prev => prev.map(x => x.id === r.id ? r : x))
      }
    } catch (err) { console.error('onUpdateReceivable:', err); alert(err.message) }
  }

  const onDeleteReceivable = async (id) => {
    if (!window.confirm('¿Eliminar este por cobrar?')) return
    try {
      if (IS_REAL && session) await removeRecurring(id)
      setReceivablesList(prev => prev.filter(x => x.id !== id))
    } catch (err) { console.error('onDeleteReceivable:', err); alert(err.message) }
  }

  const onMarkReceivablePaid = async (id) => {
    const paidAt = new Date().toISOString()
    try {
      if (IS_REAL && session) await patchRecurring(id, { status: 'paid', paid_at: paidAt })
      setReceivablesList(prev => prev.map(x => x.id === id ? { ...x, status: 'paid', paidAt } : x))
    } catch (err) { console.error('onMarkReceivablePaid:', err); alert(err.message) }
  }

  // ── Payables CRUD ─────────────────────────────────────────────
  const onCreatePayable = async (r) => {
    try {
      if (IS_REAL && session) {
        const created = await createItem(r, session.user.id, 'payable')
        setPayablesList(prev => [...prev, created])
      } else {
        setPayablesList(prev => [...prev, { ...r, id: 'pay' + Date.now(), status: 'pending' }])
      }
    } catch (err) { console.error('onCreatePayable:', err); alert(err.message) }
  }

  const onUpdatePayable = async (r) => {
    try {
      if (IS_REAL && session) {
        const updated = await updateItem(r)
        setPayablesList(prev => prev.map(x => x.id === updated.id ? updated : x))
      } else {
        setPayablesList(prev => prev.map(x => x.id === r.id ? r : x))
      }
    } catch (err) { console.error('onUpdatePayable:', err); alert(err.message) }
  }

  const onDeletePayable = async (id) => {
    if (!window.confirm('¿Eliminar este por pagar?')) return
    try {
      if (IS_REAL && session) await removeRecurring(id)
      setPayablesList(prev => prev.filter(x => x.id !== id))
    } catch (err) { console.error('onDeletePayable:', err); alert(err.message) }
  }

  const onMarkPayablePaid = async (id) => {
    const paidAt = new Date().toISOString()
    try {
      if (IS_REAL && session) await patchRecurring(id, { status: 'paid', paid_at: paidAt })
      setPayablesList(prev => prev.map(x => x.id === id ? { ...x, status: 'paid', paidAt } : x))
    } catch (err) { console.error('onMarkPayablePaid:', err); alert(err.message) }
  }

  // ── Savings CRUD ─────────────────────────────────────────────
  const onCreateGoal = async (goal) => {
    const created = await createGoal(goal, session.user.id)
    setSavingsGoals(prev => [created, ...prev])
  }

  const onUpdateGoal = async (goal) => {
    const updated = await updateGoal(goal)
    setSavingsGoals(prev => prev.map(g => g.id === updated.id ? updated : g))
  }

  const onDeleteGoal = async (id) => {
    await removeGoal(id)
    setSavingsGoals(prev => prev.filter(g => g.id !== id))
  }

  const onAddMovement = async (goalId, amount, type, note) => {
    const updated = await addMovement(goalId, session.user.id, amount, type, note)
    setSavingsGoals(prev => prev.map(g => g.id === updated.id ? updated : g))
  }

  const onSetRecurring = async (newList) => {
    // Called by Recurring component for toggle/charge operations
    for (const r of newList) {
      const old = recurringList.find(o => o.id === r.id)
      if (!old) continue
      if (old.active !== r.active) {
        audit('expense.edited', r.id, `${r.name}: ${r.active ? 'activado' : 'pausado'}`)
        if (IS_REAL && session) {
          patchRecurring(r.id, { active: r.active }).catch(err => console.error('patchRecurring:', err))
        }
      }
      if (old.lastChargedMonth !== r.lastChargedMonth && r.lastChargedMonth) {
        audit('recurring.charged', r.id, `Cargo recurrente: ${r.name} — $${r.amount.toLocaleString('es-CL')}`, 'user')
        if (IS_REAL && session) {
          patchRecurring(r.id, { last_charged_month: r.lastChargedMonth }).catch(err => console.error('patchRecurring:', err))
          // Also create an expense
          createExpense({
            amount: r.amount, description: r.name, category: r.category,
            bank: r.bank, method: r.method, type: r.type,
            installments: 1, status: 'ok', date: new Date().toISOString(), notes: 'Generado desde recurrente',
          }, session.user.id)
            .then(created => setExpenses(prev => [created, ...prev]))
            .catch(err => console.error('createExpense from recurring:', err))
        } else {
          const newExp = {
            id: 'e' + Date.now() + r.id, amount: r.amount, description: r.name,
            category: r.category, bank: r.bank, method: r.method, type: r.type,
            installments: 1, status: 'ok', date: new Date().toISOString(), notes: 'Generado desde recurrente',
          }
          setExpenses(prev => [newExp, ...prev])
        }
      }
    }
    setRecurringList(newList)
  }

  // ── Installments CRUD ────────────────────────────────────────
  const onCreateInstallment = async (d) => {
    try {
      if (IS_REAL && session) {
        const created = await createInstallment(d, session.user.id)
        setInstallmentDebts(prev => [...prev, created])
      } else {
        setInstallmentDebts(prev => [...prev, { ...d, id: 'ic' + Date.now(), status: 'active' }])
      }
    } catch (err) { console.error('onCreateInstallment:', err); alert(err.message) }
  }

  const onUpdateInstallment = async (d) => {
    try {
      if (IS_REAL && session) {
        const updated = await updateInstallment(d)
        setInstallmentDebts(prev => prev.map(x => x.id === updated.id ? updated : x))
      } else {
        setInstallmentDebts(prev => prev.map(x => x.id === d.id ? d : x))
      }
    } catch (err) { console.error('onUpdateInstallment:', err); alert(err.message) }
  }

  const onDeleteInstallment = async (id) => {
    if (!window.confirm('¿Eliminar esta cuota?')) return
    try {
      if (IS_REAL && session) await removeInstallment(id)
      setInstallmentDebts(prev => prev.filter(x => x.id !== id))
    } catch (err) { console.error('onDeleteInstallment:', err); alert(err.message) }
  }

  const onSetDebts = async (newDebts) => {
    for (const d of newDebts) {
      const old = installmentDebts.find(o => o.id === d.id)
      if (!old || old.paid === d.paid) continue
      if (IS_REAL && session) {
        patchInstallment(d.id, { paid_installments: d.paid }).catch(err => console.error('patchInstallment:', err))
      }
    }
    setInstallmentDebts(newDebts)
  }

  // ── Budgets CRUD ─────────────────────────────────────────────
  const onSetBudgets = async (newBudgets) => {
    for (const k of Object.keys(newBudgets)) {
      if (newBudgets[k] !== budgets[k]) {
        audit('budget.updated', k, `Presupuesto: $${(budgets[k] || 0).toLocaleString('es-CL')} → $${newBudgets[k].toLocaleString('es-CL')}`)
        if (IS_REAL && session) {
          upsertBudget(k, newBudgets[k], session.user.id).catch(err => console.error('upsertBudget:', err))
        }
      }
    }
    setBudgets(newBudgets)
  }

  // ── Unparsed messages ────────────────────────────────────────
  const onResolveUnparsed = async (msgId, draft) => {
    try {
      const base = {
        amount: Number(draft.amount) || 0,
        description: draft.description || 'Mensaje completado',
        category: draft.category || 'otros',
        bank: draft.bank || 'bchile',
        method: draft.method || 'tarjeta',
        type: draft.type || 'debito',
        installments: Number(draft.installments) || 1,
        status: 'ok',
        date: draft.date || new Date().toISOString(),
        notes: draft.notes || '',
      }
      if (IS_REAL && session) {
        const created = await createExpense(base, session.user.id)
        setExpenses(prev => [created, ...prev])
        audit('expense.created', created.id, `Gasto registrado manualmente: ${created.description} — $${created.amount.toLocaleString('es-CL')}`)
      } else {
        const newExp = { ...base, id: 'e' + Date.now() }
        setExpenses(prev => [newExp, ...prev])
        audit('expense.created', newExp.id, `Gasto registrado manualmente: ${newExp.description}`)
      }
      setUnparsed(prev => prev.filter(u => u.id !== msgId))
    } catch (err) {
      console.error('onResolveUnparsed:', err)
      alert('Error al registrar el gasto: ' + err.message)
    }
  }

  const onDiscardUnparsed = (id) => {
    setUnparsed(prev => prev.filter(u => u.id !== id))
    audit('unparsed', id, 'Mensaje descartado')
  }

  // ── Loading / Login screens ──────────────────────────────────
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--line)] border-t-[var(--ink)] animate-spin"/>
      </div>
    )
  }
  if (IS_REAL && isRecovery) return <NewPasswordForm onComplete={() => setIsRecovery(false)}/>
  if (IS_REAL && !session)  return <Login/>

  return (
    <>
      <Layout view={view} setView={navigate} botStatus={botStatus} onOpenChat={() => setChatOpen(true)}
              onSignOut={IS_REAL ? handleSignOut : undefined}
              userEmail={session?.user?.email}
              isSuperAdmin={userRole === 'super_admin'}
              unparsedCount={unparsed.length}>
        {view === 'dashboard' && (
          <Dashboard
            expenses={expenses}
            setView={navigate}
            budgets={budgets}
            recurring={recurringList}
            income={incomeList}
            receivables={receivablesList}
            installmentDebts={installmentDebts}
            botStatus={botStatus}
            lastBotMessage={lastBotMessage}
            openChat={() => setChatOpen(true)}
            accounts={accounts}
            creditCards={creditCards}
            userSettings={userSettings}
          />
        )}
        {view === 'expenses' && (
          <>
            {expensesSource === 'loading' && (
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
        {view === 'accounts' && IS_REAL && session && (
          <Accounts
            accounts={accounts}
            creditCards={creditCards}
            expenses={expenses}
            recurringList={recurringList}
            installmentDebts={installmentDebts}
            onCreateAccount={onCreateAccount}
            onUpdateAccount={onUpdateAccount}
            onDeleteAccount={onDeleteAccount}
            onCreateCard={onCreateCard}
            onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
          />
        )}
        {view === 'budgets' && (
          <Budgets expenses={expenses} budgets={budgets} setBudgets={onSetBudgets}/>
        )}
        {view === 'savings' && IS_REAL && session && (
          <Savings
            goals={savingsGoals}
            onCreateGoal={onCreateGoal}
            onUpdateGoal={onUpdateGoal}
            onDeleteGoal={onDeleteGoal}
            onAddMovement={onAddMovement}
            userId={session.user.id}
          />
        )}
        {view === 'recurring' && (
          <Recurring
            recurring={recurringList}
            setRecurring={onSetRecurring}
            onCreateRecurring={onCreateRecurring}
            onUpdateRecurring={onUpdateRecurring}
            onDeleteRecurring={onDeleteRecurring}
            incomeList={incomeList}
            onCreateIncome={onCreateIncome}
            onUpdateIncome={onUpdateIncome}
            onDeleteIncome={onDeleteIncome}
            receivablesList={receivablesList}
            onCreateReceivable={onCreateReceivable}
            onUpdateReceivable={onUpdateReceivable}
            onDeleteReceivable={onDeleteReceivable}
            onMarkReceivablePaid={onMarkReceivablePaid}
            payablesList={payablesList}
            onCreatePayable={onCreatePayable}
            onUpdatePayable={onUpdatePayable}
            onDeletePayable={onDeletePayable}
            onMarkPayablePaid={onMarkPayablePaid}
            salaryPaymentDay={userSettings?.salary_payment_day ?? null}
          />
        )}
        {view === 'installments' && (
          <Installments
            debts={installmentDebts}
            setDebts={onSetDebts}
            recurring={recurringList}
            onCreateInstallment={IS_REAL && session ? onCreateInstallment : null}
            onUpdateInstallment={IS_REAL && session ? onUpdateInstallment : null}
            onDeleteInstallment={IS_REAL && session ? onDeleteInstallment : null}
          />
        )}
        {view === 'reports' && <Reports
          expenses={expenses}
          installmentDebts={installmentDebts}
          recurringList={recurringList}
          incomeList={incomeList}
          accounts={accounts}
          userSettings={userSettings}
        />}
        {view === 'projection' && (
          <Projection
            accounts={accounts}
            recurringList={recurringList}
            incomeList={incomeList}
            receivables={receivablesList}
            installmentDebts={installmentDebts}
          />
        )}
        {view === 'comparison' && <Comparison expenses={expenses}/>}
        {view === 'unparsed' && (
          <UnparsedMessages
            unparsed={unparsed}
            onResolve={onResolveUnparsed}
            onDiscard={onDiscardUnparsed}
          />
        )}
        {view === 'telegram' && (
          <TelegramSettings
            botStatus={botStatus}
            setBotStatus={setBotStatus}
            lastBotMessage={lastBotMessage}
          />
        )}
        {view === 'audit' && <Audit entries={auditLog}/>}
        {view === 'profile' && IS_REAL && session && (
          <UserProfile userId={session.user.id} userEmail={session.user.email}/>
        )}
        {view === 'admin' && userRole === 'super_admin' && IS_REAL && session && (
          <AdminPanel adminUserId={session.user.id}/>
        )}
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
  )
}
