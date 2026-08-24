import React, { useEffect, useMemo, useState } from 'react'
import DashboardWithReimbursements from './DashboardWithReimbursements'
import { fetchMercadoPagoStatus } from '../services/mercadoPagoService'
import { fetchSalarySlips } from '../services/salaryService'
import { monthKeyCL } from '../lib/financialDates'
import { addSalaryMonths } from '../lib/salaryModel'
import { dashboardReservePayables, withVariableSalary } from '../lib/financialModel'

export default function DashboardAudited(props) {
  const [mpStatus, setMpStatus] = useState(null)
  const [salarySlips, setSalarySlips] = useState([])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([fetchMercadoPagoStatus(), fetchSalarySlips()]).then(([mpResult, salaryResult]) => {
      if (cancelled) return
      if (mpResult.status === 'fulfilled') setMpStatus(mpResult.value || null)
      if (salaryResult.status === 'fulfilled') setSalarySlips(salaryResult.value || [])
    })
    return () => { cancelled = true }
  }, [])

  const nextCashMonth = addSalaryMonths(monthKeyCL(), 1)
  const income = useMemo(() => withVariableSalary(
    props.income || [],
    salarySlips,
    nextCashMonth,
    1,
    Number(props.userSettings?.salary_payment_day || 5),
  ), [props.income, props.userSettings, salarySlips, nextCashMonth])

  const payables = useMemo(
    () => dashboardReservePayables(props.payables || [], mpStatus),
    [props.payables, mpStatus],
  )

  return <DashboardWithReimbursements {...props} income={income} payables={payables}/>
}
