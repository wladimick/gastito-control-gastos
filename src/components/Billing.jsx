import React, { useState } from 'react'
import BillingBase from './BillingBase'
import BillingJsonImport from './BillingJsonImport'
import { fmtCLP } from '../lib/helpers'

export default function Billing({ creditCards = [] }) {
  const [showJsonImport, setShowJsonImport] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastImport, setLastImport] = useState(null)

  const handleImported = async result => {
    setLastImport(result?.summary || null)
    setRefreshKey(current => current + 1)
  }

  const imported = Number(lastImport?.imported || 0)
  const importedAmount = Number(lastImport?.imported_amount || 0)

  return (
    <div className="relative">
      <div className="max-w-6xl mx-auto px-4 lg:px-6 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
        {lastImport && imported > 0 && (
          <div className="sm:mr-auto rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10.5px] text-emerald-800">
            Última carga: <strong>{imported} {imported === 1 ? 'movimiento' : 'movimientos'}</strong>
            {importedAmount > 0 && <> · {fmtCLP(importedAmount)}</>}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowJsonImport(true)}
          className="h-9 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] text-[11px] font-semibold hover:bg-[var(--hover)] shadow-sm"
        >
          Importar JSON
        </button>
      </div>

      <div className="-mt-1">
        <BillingBase key={refreshKey} creditCards={creditCards}/>
      </div>

      {showJsonImport && (
        <BillingJsonImport
          creditCards={creditCards}
          onClose={() => setShowJsonImport(false)}
          onImported={handleImported}
        />
      )}
    </div>
  )
}
