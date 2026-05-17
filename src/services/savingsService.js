import { supabase, isConfigured } from '../lib/supabase'

function mapGoal(row) {
  return {
    id:            row.id,
    name:          row.name,
    targetAmount:  Number(row.target_amount),
    currentAmount: Number(row.current_amount),
    targetDate:    row.target_date ?? null,
    status:        row.status,
    createdAt:     row.created_at,
  }
}

export async function fetchGoals() {
  if (!isConfigured) return []
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapGoal)
}

export async function createGoal(goal, userId) {
  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id:       userId,
      name:          goal.name.trim(),
      target_amount: Number(goal.targetAmount),
      current_amount: 0,
      target_date:   goal.targetDate || null,
      status:        'active',
    })
    .select().single()
  if (error) throw error
  return mapGoal(data)
}

export async function updateGoal(goal) {
  const { data, error } = await supabase
    .from('savings_goals')
    .update({
      name:          goal.name.trim(),
      target_amount: Number(goal.targetAmount),
      target_date:   goal.targetDate || null,
    })
    .eq('id', goal.id)
    .select().single()
  if (error) throw error
  return mapGoal(data)
}

export async function removeGoal(id) {
  const { error } = await supabase.from('savings_goals').delete().eq('id', id)
  if (error) throw error
}

export async function addMovement(goalId, userId, amount, type, note) {
  const num = Number(amount)
  if (num <= 0) throw new Error('El monto debe ser mayor a 0')

  const { data: goal, error: fetchErr } = await supabase
    .from('savings_goals').select('current_amount').eq('id', goalId).single()
  if (fetchErr) throw fetchErr

  const current = Number(goal.current_amount)
  if (type === 'withdrawal' && current < num) {
    throw new Error(`No puedes retirar más de lo ahorrado ($${current.toLocaleString('es-CL')})`)
  }

  const newAmount = Math.max(0, current + (type === 'deposit' ? num : -num))

  const { error: movErr } = await supabase
    .from('savings_movements')
    .insert({ goal_id: goalId, user_id: userId, amount: num, type, note: note || null })
  if (movErr) throw movErr

  const { data, error } = await supabase
    .from('savings_goals')
    .update({ current_amount: newAmount })
    .eq('id', goalId)
    .select().single()
  if (error) throw error
  return mapGoal(data)
}
