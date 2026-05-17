import React, { useState } from 'react'
import { Card, StatCard, Badge, IconBtn } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'

const BLANK_GOAL = { name: '', targetAmount: '', targetDate: '' }
const BLANK_MOV  = { amount: '', note: '' }

function GoalForm({ goal, onSave, onCancel, saving }) {
  const [draft, setDraft] = useState(
    goal ? { name: goal.name, targetAmount: goal.targetAmount, targetDate: goal.targetDate ?? '' }
         : { ...BLANK_GOAL }
  )
  const set = (k, v) => setDraft(p => ({ ...p, [k]: v }))
  const valid = draft.name.trim() && Number(draft.targetAmount) > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Nombre</label>
          <input value={draft.name} onChange={e => set('name', e.target.value)}
            placeholder="Ej: Vacaciones" autoFocus
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Monto objetivo</label>
          <input type="number" value={draft.targetAmount} onChange={e => set('targetAmount', e.target.value)}
            placeholder="500000" min={1}
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">
            Fecha objetivo <span className="normal-case tracking-normal text-[10px]">(opcional)</span>
          </label>
          <input type="date" value={draft.targetDate || ''} onChange={e => set('targetDate', e.target.value)}
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => onSave(draft)} disabled={!valid || saving}
          className="h-8 px-4 bg-[var(--ink)] text-[var(--bg)] rounded-md text-[12px] font-medium disabled:opacity-50">
          {saving ? 'Guardando…' : goal?.id ? 'Guardar cambios' : 'Crear meta'}
        </button>
        <button onClick={onCancel}
          className="h-8 px-3 border border-[var(--line)] rounded-md text-[12px] text-[var(--ink-2)] hover:bg-[var(--hover)]">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function MovementForm({ type, currentAmount, onSave, onCancel, saving, error }) {
  const [draft, setDraft] = useState({ ...BLANK_MOV })
  const set = (k, v) => setDraft(p => ({ ...p, [k]: v }))
  const num   = Number(draft.amount)
  const valid = num > 0 && (type === 'deposit' || num <= currentAmount)

  return (
    <div className="flex flex-col gap-3">
      <div className={`text-[12px] font-medium ${type === 'deposit' ? 'text-[#27AE60]' : 'text-[#E07A5F]'}`}>
        {type === 'deposit' ? '↑ Agregar aporte' : '↓ Retirar monto'}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">Monto</label>
          <input type="number" value={draft.amount} onChange={e => set('amount', e.target.value)}
            placeholder="0" min={1} autoFocus
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
          {type === 'withdrawal' && (
            <div className="text-[11px] text-[var(--muted)] mt-1">Disponible: {fmtCLP(currentAmount)}</div>
          )}
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">
            Nota <span className="normal-case tracking-normal text-[10px]">(opcional)</span>
          </label>
          <input value={draft.note} onChange={e => set('note', e.target.value)}
            placeholder="Ej: Bono de trabajo"
            className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
        </div>
      </div>
      {error && (
        <div className="text-[12px] text-[#A02828] bg-[#FDECEC] rounded-md px-3 py-2">{error}</div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => onSave(draft)} disabled={!valid || saving}
          className="h-8 px-4 bg-[var(--ink)] text-[var(--bg)] rounded-md text-[12px] font-medium disabled:opacity-50">
          {saving ? 'Guardando…' : type === 'deposit' ? 'Agregar aporte' : 'Retirar'}
        </button>
        <button onClick={onCancel}
          className="h-8 px-3 border border-[var(--line)] rounded-md text-[12px] text-[var(--ink-2)] hover:bg-[var(--hover)]">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function Savings({ goals, onCreateGoal, onUpdateGoal, onDeleteGoal, onAddMovement }) {
  const [goalForm,  setGoalForm]  = useState(null)  // null | BLANK_GOAL | existing goal
  const [movForm,   setMovForm]   = useState(null)  // null | { goalId, type }
  const [savingGoal, setSavingGoal] = useState(false)
  const [savingMov,  setSavingMov]  = useState(false)
  const [movError,   setMovError]   = useState(null)

  const totalSaved   = goals.reduce((s, g) => s + g.currentAmount, 0)
  const activeGoals  = goals.filter(g => g.status === 'active')
  const avgProgress  = activeGoals.length
    ? Math.round(activeGoals.reduce((s, g) =>
        s + Math.min(100, g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0), 0
      ) / activeGoals.length)
    : 0

  const handleSaveGoal = async (draft) => {
    setSavingGoal(true)
    try {
      if (goalForm?.id) {
        await onUpdateGoal({ ...goalForm, ...draft })
      } else {
        await onCreateGoal(draft)
      }
      setGoalForm(null)
    } catch (err) { alert(err.message) }
    finally { setSavingGoal(false) }
  }

  const handleSaveMov = async (draft) => {
    if (!movForm) return
    setSavingMov(true)
    setMovError(null)
    try {
      await onAddMovement(movForm.goalId, draft.amount, movForm.type, draft.note)
      setMovForm(null)
    } catch (err) { setMovError(err.message) }
    finally { setSavingMov(false) }
  }

  const handleDeleteGoal = async (id) => {
    if (!window.confirm('¿Eliminar esta meta y todos sus movimientos?')) return
    try { await onDeleteGoal(id) }
    catch (err) { alert(err.message) }
  }

  const openMov = (goalId, type) => {
    const same = movForm?.goalId === goalId && movForm?.type === type
    setMovForm(same ? null : { goalId, type })
    setMovError(null)
    setGoalForm(null)
  }

  const openEdit = (goal) => {
    const same = goalForm?.id === goal.id
    setGoalForm(same ? null : goal)
    setMovForm(null)
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total ahorrado"    value={fmtCLP(totalSaved)}        icon="savings"/>
        <StatCard label="Metas activas"     value={activeGoals.length}         icon="target"/>
        <StatCard label="Progreso promedio" value={`${avgProgress}%`} accent={avgProgress} icon="chart"/>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold tracking-tight">Mis metas</h2>
        {!goalForm && (
          <button
            onClick={() => { setGoalForm(BLANK_GOAL); setMovForm(null) }}
            className="h-9 px-4 inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--bg)] rounded-lg text-[13px] font-medium hover:opacity-90">
            <Icon name="plus" size={14}/> Nueva meta
          </button>
        )}
      </div>

      {/* New goal inline form */}
      {goalForm && !goalForm.id && (
        <Card padding="p-5">
          <div className="font-medium text-[14px] mb-4">Nueva meta de ahorro</div>
          <GoalForm goal={null} onSave={handleSaveGoal} onCancel={() => setGoalForm(null)} saving={savingGoal}/>
        </Card>
      )}

      {/* Empty state */}
      {goals.length === 0 && !goalForm && (
        <Card>
          <div className="py-14 text-center">
            <div className="text-[38px] mb-3">🐷</div>
            <div className="font-semibold text-[15px] tracking-tight">Aún no tienes metas de ahorro</div>
            <div className="text-[13px] text-[var(--muted)] mt-1.5 mb-5">
              Crea tu primera meta para empezar a ahorrar con un objetivo claro.
            </div>
            <button onClick={() => setGoalForm(BLANK_GOAL)}
              className="h-9 px-5 inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--bg)] rounded-lg text-[13px] font-medium">
              <Icon name="plus" size={14}/> Crear primera meta
            </button>
          </div>
        </Card>
      )}

      {/* Goal cards */}
      <div className="flex flex-col gap-4">
        {goals.map(goal => {
          const progress = goal.targetAmount > 0
            ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
            : 0
          const done      = progress >= 100
          const isEditing = goalForm?.id === goal.id
          const isMovDep  = movForm?.goalId === goal.id && movForm.type === 'deposit'
          const isMovWith = movForm?.goalId === goal.id && movForm.type === 'withdrawal'

          return (
            <Card key={goal.id} padding="p-0">
              <div className="px-5 pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[14px] tracking-tight">{goal.name}</span>
                      {done         && <Badge tone="ok">✓ Completada</Badge>}
                      {goal.status === 'paused' && <Badge tone="warn">Pausada</Badge>}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--muted)]">
                      {fmtCLP(goal.currentAmount)} de {fmtCLP(goal.targetAmount)}
                      {goal.targetDate && (
                        <> · Meta:{' '}
                          {new Date(goal.targetDate + 'T12:00:00').toLocaleDateString('es-CL', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => openMov(goal.id, 'deposit')}
                      className={`h-8 px-2 inline-flex items-center gap-1 rounded-md text-[11.5px] font-medium transition
                        ${isMovDep ? 'bg-[#27AE60]/10 text-[#27AE60]' : 'hover:bg-[var(--hover)] text-[#27AE60]'}`}>
                      <Icon name="plus" size={12}/> Aporte
                    </button>
                    <button
                      onClick={() => openMov(goal.id, 'withdrawal')}
                      className={`h-8 px-2 inline-flex items-center gap-1 rounded-md text-[11.5px] font-medium transition
                        ${isMovWith ? 'bg-[#E07A5F]/10 text-[#E07A5F]' : 'hover:bg-[var(--hover)] text-[#E07A5F]'}`}>
                      <Icon name="arrowdn" size={12}/> Retirar
                    </button>
                    <IconBtn name="pencil" label="Editar" onClick={() => openEdit(goal)}/>
                    <IconBtn name="trash"  label="Eliminar" tone="danger" onClick={() => handleDeleteGoal(goal.id)}/>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)] mb-1.5">
                    <span>{Math.round(progress)}% completado</span>
                    {!done && <span>Faltan {fmtCLP(Math.max(0, goal.targetAmount - goal.currentAmount))}</span>}
                  </div>
                  <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-[#27AE60]' : 'bg-[var(--ink)]'}`}
                      style={{ width: Math.max(0, progress) + '%' }}/>
                  </div>
                </div>
              </div>

              {/* Edit form */}
              {isEditing && (
                <div className="px-5 pb-5 border-t border-[var(--line)] pt-4">
                  <GoalForm goal={goal} onSave={handleSaveGoal} onCancel={() => setGoalForm(null)} saving={savingGoal}/>
                </div>
              )}

              {/* Movement form */}
              {(isMovDep || isMovWith) && (
                <div className="px-5 pb-5 border-t border-[var(--line)] pt-4">
                  <MovementForm
                    type={movForm.type}
                    currentAmount={goal.currentAmount}
                    onSave={handleSaveMov}
                    onCancel={() => { setMovForm(null); setMovError(null) }}
                    saving={savingMov}
                    error={movError}
                  />
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
