import React from 'react'
import DashboardFinancial from './DashboardFinancial'
import { Card, InfoTip } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'

export default function DashboardWithReimbursements(props) {
  const receivables = props.receivables || []
  const reimbursements = receivables.filter(item => item.reimbursement && item.status !== 'paid')
  const amount = reimbursements.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const overdue = reimbursements.filter(item => item.dueDate && String(item.dueDate).slice(0, 10) < new Date().toISOString().slice(0, 10)).length

  return (
    <div className="flex flex-col gap-5">
      <Card padding="p-4 md:p-5" className={amount > 0 ? 'border-emerald-200 bg-emerald-50/50' : ''}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center shrink-0">
              <Icon name="cash" size={17}/>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-emerald-800/70">A favor por rendiciones</div>
                <InfoTip content="Suma de rendiciones enviadas o aprobadas que la empresa todavía no te ha transferido. Mejora la proyección, pero no aumenta tu saldo disponible hasta que recibas el dinero."/>
              </div>
              <div className="font-mono text-[24px] md:text-[28px] font-bold mt-2 text-emerald-900">{fmtCLP(amount)}</div>
              <div className="text-[10.5px] text-emerald-900/65 mt-1 leading-relaxed">
                {reimbursements.length
                  ? `${reimbursements.length} rendición${reimbursements.length === 1 ? '' : 'es'} por cobrar${overdue ? ` · ${overdue} fuera de la fecha esperada` : ''}.`
                  : 'Cuando marques una rendición como rendida o aprobada, aparecerá aquí como dinero por cobrar.'}
              </div>
            </div>
          </div>
          <div className="flex flex-col md:items-end gap-2 shrink-0">
            <div className="text-[10px] text-[var(--muted)] max-w-xs md:text-right">
              No se suma a “Disponible operativo” hasta que marques la transferencia como reembolsada y actualices el saldo de la cuenta receptora.
            </div>
            <button type="button" onClick={() => props.setView?.('reimbursements')} className="h-9 px-3 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[10.5px] font-semibold">
              Ver rendiciones
            </button>
          </div>
        </div>
      </Card>

      <DashboardFinancial {...props}/>
    </div>
  )
}
