function monthDistance(left, right) {
  const [ly, lm] = String(left || '').slice(0, 7).split('-').map(Number)
  const [ry, rm] = String(right || '').slice(0, 7).split('-').map(Number)
  if (!ly || !lm || !ry || !rm) return null
  return Math.abs((ly - ry) * 12 + (lm - rm))
}

function sameBank(left, right) {
  const a = String(left?.bank || left?.bankId || '').toLowerCase()
  const b = String(right?.bank || right?.bankId || '').toLowerCase()
  return !a || !b || a === b
}

export function likelyCoveredByBank(manual, bankPlan) {
  if (!manual || !bankPlan || bankPlan.source === 'manual') return false
  if (!sameBank(manual, bankPlan)) return false
  if (Number(manual.installments || 0) !== Number(bankPlan.installments || 0)) return false

  const manualMonthly = Number(manual.monthlyAmount || 0)
  const bankMonthly = Number(bankPlan.monthlyAmount || 0)
  const monthlyTolerance = Math.max(5, Math.round(Math.max(manualMonthly, bankMonthly) * 0.01))
  if (Math.abs(manualMonthly - bankMonthly) > monthlyTolerance) return false

  const distance = monthDistance(manual.startMonth, bankPlan.startMonth)
  if (distance != null && distance > 2) return false

  const manualTotal = Number(manual.total || 0)
  const bankTotal = Number(bankPlan.total || 0)
  if (manualTotal > 0 && bankTotal > 0) {
    const totalTolerance = Math.max(5000, Math.round(Math.max(manualTotal, bankTotal) * 0.12))
    if (Math.abs(manualTotal - bankTotal) > totalTolerance) return false
  }

  return true
}

export function auditInstallmentPlans(plans = [], nowKey = new Date().toISOString().slice(0, 7)) {
  const bankPlans = (plans || []).filter(plan => plan && plan.source !== 'manual')
  const result = []

  for (const plan of (plans || [])) {
    if (!plan) continue
    if (plan.source !== 'manual') {
      result.push(plan)
      continue
    }

    if (bankPlans.some(bankPlan => likelyCoveredByBank(plan, bankPlan))) continue

    const occurrences = (plan.occurrences || []).filter(item => !item.monthKey || item.monthKey >= nowKey)
    const lastCalendarMonth = plan.startMonth && Number(plan.installments || 0) > 0
      ? (() => {
          const [year, month] = String(plan.startMonth).split('-').map(Number)
          const date = new Date(Date.UTC(year, month - 1 + Number(plan.installments || 1) - 1, 1))
          return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
        })()
      : ''

    result.push({
      ...plan,
      occurrences,
      staleManual: Boolean(lastCalendarMonth && lastCalendarMonth < nowKey),
      status: lastCalendarMonth && lastCalendarMonth < nowKey ? 'paid' : plan.status,
    })
  }

  return result
}

export function withStatementForecastFloors(plans = [], forecasts = []) {
  const amounts = new Map()
  for (const plan of (plans || [])) {
    for (const occurrence of (plan?.occurrences || [])) {
      const cardId = occurrence.cardId || plan.cardId
      const month = occurrence.monthKey
      const amount = Number(occurrence.amount || plan.monthlyAmount || 0)
      if (!cardId || !month || amount <= 0) continue
      const key = `${cardId}|${month}`
      amounts.set(key, (amounts.get(key) || 0) + amount)
    }
  }

  const topUps = []
  for (const forecast of (forecasts || [])) {
    if (forecast?.active === false) continue
    const cardId = forecast.cardId
    const month = forecast.cashMonth
    const floor = Number(forecast.amount || 0)
    if (!cardId || !month || floor <= 0) continue
    const known = amounts.get(`${cardId}|${month}`) || 0
    const difference = Math.max(0, floor - known)
    if (difference <= 0) continue
    topUps.push({
      id: `statement-forecast:${forecast.id || `${cardId}:${month}`}`,
      source: 'statement_forecast',
      bank: '',
      bankId: '',
      cardId,
      cardLabel: 'Piso informado por estado de cuenta',
      description: 'Ajuste a vencimientos futuros informados por el banco',
      category: 'otros',
      total: difference,
      installments: 1,
      paid: 0,
      monthlyAmount: difference,
      startMonth: month,
      status: 'active',
      editable: false,
      occurrences: [{
        id: `statement-forecast-occurrence:${forecast.id || `${cardId}:${month}`}`,
        source: 'statement_forecast',
        projected: true,
        confirmed: false,
        isPending: false,
        monthKey: month,
        dueDate: '',
        description: 'Piso futuro informado por estado de cuenta',
        amount: difference,
        installmentCurrent: 1,
        installmentTotal: 1,
        bankId: '',
        cardId,
        cardLabel: 'Proyección bancaria',
        category: 'otros',
        sharedWithNicol: false,
        originalAmount: difference,
        forecastFloor: floor,
        forecastKnown: known,
        forecastConfidence: forecast.confidence,
        forecastSourceFile: forecast.sourceFile,
      }],
    })
  }

  return [...(plans || []), ...topUps]
}
