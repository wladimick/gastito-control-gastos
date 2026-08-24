import React, { useEffect, useMemo, useState } from 'react'
import ProjectionWithBalanceStatus from './ProjectionWithBalanceStatus'
import { fetchMercadoPagoStatus } from '../services/mercadoPagoService'
import { fetchSalarySlips } from '../services/salaryService'
import { monthKeyCL } from '../lib/financialDates'
import {
  coverReservePayables,
  withMercadoPagoFreeBalance,
  withVariableSalary,
} from '../lib/financialModel'

export default function ProjectionAudited(props) {
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

  const accounts = useMemo(
    () => withMercadoPagoFreeBalance(props.accounts || [], mpStatus),
    [props.accounts, mpStatus],
  )

  const payables = useMemo(() => coverReservePayables(
    props.payables || [],
    Number(mpStatus?.reserved_partition_balance || 0),
  ), [props.payables, mpStatus])

  const incomeList = useMemo(() => withVariableSalary(
    props.incomeList || [],
    salarySlips,
    monthKeyCL(),
    12,
    5,
  ), [props.incomeList, salarySlips])

  return (
    <ProjectionWithBalanceStatus
      {...props}
      accounts={accounts}
      payables={payables}
      incomeList={incomeList}
    />
  )
}
