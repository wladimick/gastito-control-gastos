import React, { useMemo, useState } from 'react'
import { fmtCLP } from '../lib/helpers'
import {
  commitBillingJsonImport,
  previewBillingJsonImport,
} from '../services/billingJsonImportService'

const STATUS_META = {
  ready: { label: 'Listo', className: 'bg-emerald-50 text-emerald-700' },
  duplicate: { label: 'Duplicado', className: 'bg-slate-100 text-slate-600' },
  error: { label: 'Error', className: 'bg-red-50 text-red-700' },
  imported: { label: 'Importado', className: 'bg-blue-50 text-blue-700' },
}

const EXAMPLE = `{
  "bank": "falabella",
  "card": "cmr",
  "source": "cmr_digital_manual_json",
  "transactions": [
    {
      "date": "2026-09-01",
      "description": "Comercio ejemplo",
      "amount": 12990,
      "installment_current": 1,
      "installment_total": 1
    }
  ]
}`

function cardLabel(card) {
  const name = card?.name || card?.nickname || card?.alias || 'Tarjeta'
  const lastFour = card?.lastFour || card?.last_four
  return lastFour ? `${name} ·•••• ${lastFour}` : name
}

function findDefaultCard(cards) {
  const active = cards.filter(card => card?.isActive !== false && card?.is_active !== false)
  return active.find(card => {
    const haystack = `${card?.name || ''} ${card?.bank || card?.bank_id || ''}`.toLowerCase()
    return haystack.includes('cmr') || haystack.includes('falabella')
  }) || active[0] || cards[0] || null
}

function PreviewRow({ item }) {
  const meta = STATUS_META[item.status] || STATUS_META.error
  const installmentTotal = Number(item.installment_total || item.normalized?.installment_total || 1)
  const installmentCurrent = Number(item.installment_current || item.normalized?.installment_current || 1)
  const date = item.date || item.normalized?.date || '—'
  const description = item.description || item.normalized?.description || 'Movimiento inválido'
  const amount = Number(item.amount ?? item.normalized?.amount ?? 0)
  const message = item.message || item.errors?.join(' ')

  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)_auto] sm:grid-cols-[82px_minmax(0,1fr)_110px_110px] gap-2 items-start px-3 py-3 border-t border-[var(--line)] first:border-t-0">
      <div className="text-[10.5px] text-[var(--muted)] pt-0.5">{date}</div>
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold leading-snug break-words">{description}</div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${meta.className}`}>{meta.label}</span>
          {installmentTotal > 1 && (
            <span className="rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 text-[9.5px] font-semibold">
              Cuota {installmentCurrent}/{installmentTotal}
            </span>
          )}
          {item.cycle_key && (
            <span className="rounded-full bg-[var(--soft)] text-[var(--muted)] px-2 py-0.5 text-[9.5px] font-semibold">
              Ciclo {item.cycle_key}
            </span>
          )}
        </div>
        {message && <div className="text-[10px] text-red-700 mt-1.5 leading-relaxed">{message}</div>}
      </div>
      <div className="font-mono text-[11.5px] font-bold text-right whitespace-nowrap sm:order-none">
        {amount > 0 ? fmtCLP(amount) : '—'}
      </div>
      <div className="hidden sm:block text-right text-[10px] text-[var(--muted)] pt-0.5">
        Fila {item.row || '—'}
      </div>
    </div>
  )
}

export default function BillingJsonImport({ creditCards = [], onClose, onImported }) {
  const defaultCard = useMemo(() => findDefaultCard(creditCards), [creditCards])
  const [cardId, setCardId] = useState(defaultCard?.id || '')
  const [json, setJson] = useState('')
  const [parsed, setParsed] = useState(null)
  const [serverPreview, setServerPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(null)

  const localErrors = parsed?.items?.filter(item => item.status === 'error') || []
  const serverItems = serverPreview?.items || []
  const previewItems = useMemo(() => {
    if (!parsed) return []
    const localErrorRows = new Map(localErrors.map(item => [item.row, item]))
    const serverRows = new Map(serverItems.map(item => [Number(item.row), item]))

    return parsed.items.map(item => {
      if (localErrorRows.has(item.row)) return item
      return serverRows.get(item.row) || { ...item, status: 'ready' }
    })
  }, [parsed, localErrors, serverItems])

  const ready = Number(serverPreview?.summary?.ready || 0)
  const duplicates = Number(serverPreview?.summary?.duplicates || 0)
  const serverErrors = Number(serverPreview?.summary?.errors || 0)
  const errors = localErrors.length + serverErrors

  const resetPreview = () => {
    setParsed(null)
    setServerPreview(null)
    setError('')
    setSuccess(null)
  }

  const handleJsonChange = event => {
    setJson(event.target.value)
    resetPreview()
  }

  const handleValidate = async () => {
    setBusy(true)
    setError('')
    setSuccess(null)
    try {
      const result = await previewBillingJsonImport({ creditCardId: cardId, json })
      setParsed(result.parsed)
      setServerPreview(result.server)
      if (result.parsed.rootError) setError(result.parsed.rootError)
      else if (!result.server && result.parsed.totals.errors > 0) {
        setError('Corrige los movimientos marcados con error antes de importar.')
      }
    } catch (validationError) {
      setError(validationError.message || 'No fue posible validar el JSON.')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    if (!parsed || !serverPreview || ready < 1 || errors > 0) return
    setBusy(true)
    setError('')
    setSuccess(null)
    try {
      const result = await commitBillingJsonImport({ creditCardId: cardId, parsed })
      setServerPreview(result)
      setSuccess(result.summary || {})
      if (onImported) await onImported(result)
    } catch (importError) {
      setError(importError.message || 'No fue posible importar los movimientos.')
    } finally {
      setBusy(false)
    }
  }

  const importedCount = Number(success?.imported || 0)
  const importedAmount = Number(success?.imported_amount || 0)

  return (
    <div className="fixed inset-0 z-[100] bg-black/45 p-3 sm:p-6 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Importar movimientos por JSON">
      <div className="w-full max-w-4xl max-h-[94vh] rounded-t-3xl sm:rounded-3xl bg-[var(--bg-elev)] border border-[var(--line)] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-[var(--line)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[9.5px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Facturación</div>
            <h2 className="text-[18px] font-bold mt-1">Importar movimientos por JSON</h2>
            <p className="text-[11px] text-[var(--muted)] mt-1 max-w-2xl">
              Primero valida y revisa la previsualización. Gastito no guarda nada hasta que confirmes la importación.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="w-9 h-9 shrink-0 rounded-full border border-[var(--line)] text-[17px] hover:bg-[var(--hover)] disabled:opacity-40" aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-4 sm:px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.1em] font-bold text-[var(--muted)]">Tarjeta destino</label>
              <select
                value={cardId}
                onChange={event => { setCardId(event.target.value); resetPreview() }}
                className="mt-1.5 w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="">Selecciona una tarjeta</option>
                {creditCards.filter(card => card?.isActive !== false && card?.is_active !== false).map(card => (
                  <option key={card.id} value={card.id}>{cardLabel(card)}</option>
                ))}
              </select>
              <div className="rounded-xl bg-[var(--soft)] p-3 mt-3 text-[10.5px] text-[var(--muted)] leading-relaxed">
                Se consideran duplicados los movimientos con la misma tarjeta, fecha, monto y descripción normalizada.
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-[10px] uppercase tracking-[0.1em] font-bold text-[var(--muted)]">JSON</label>
                <button type="button" onClick={() => { setJson(EXAMPLE); resetPreview() }} className="text-[10px] font-semibold underline text-[var(--muted)] hover:text-[var(--ink)]">
                  Ver ejemplo
                </button>
              </div>
              <textarea
                value={json}
                onChange={handleJsonChange}
                spellCheck="false"
                placeholder="Pega aquí el JSON con tus movimientos…"
                className="mt-1.5 w-full min-h-[230px] rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 font-mono text-[11px] leading-relaxed outline-none focus:ring-1 focus:ring-[var(--accent)] resize-y"
              />
              <div className="text-[9.5px] text-[var(--muted)] mt-1.5">
                Campos requeridos: <code>date</code>, <code>description</code>, <code>amount</code>. Cuotas: <code>installment_current</code> y <code>installment_total</code>.
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-red-700">{error}</div>
          )}

          {success && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[11px] text-emerald-800">
              <strong>{importedCount} {importedCount === 1 ? 'movimiento importado' : 'movimientos importados'}</strong>
              {importedAmount > 0 && <> por {fmtCLP(importedAmount)}</>}.
              {Number(success.duplicates || 0) > 0 && <> Se omitieron {success.duplicates} duplicados.</>}
            </div>
          )}

          {parsed && (
            <section className="mt-4 rounded-2xl border border-[var(--line)] overflow-hidden">
              <div className="px-3 sm:px-4 py-3 bg-[var(--soft)] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-[var(--muted)]">Previsualización</div>
                  <div className="text-[11px] mt-0.5">{parsed.totals.rows} movimientos detectados · {fmtCLP(parsed.totals.amount)}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[10px] font-semibold">{ready} listos</span>
                  <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 text-[10px] font-semibold">{duplicates} duplicados</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${errors ? 'bg-red-50 text-red-700' : 'bg-[var(--bg)] text-[var(--muted)]'}`}>{errors} errores</span>
                </div>
              </div>
              <div className="max-h-[330px] overflow-y-auto bg-[var(--bg-elev)]">
                {previewItems.map(item => <PreviewRow key={`row-${item.row}`} item={item}/>)}
              </div>
            </section>
          )}
        </div>

        <div className="px-4 sm:px-5 py-3.5 border-t border-[var(--line)] bg-[var(--bg-elev)] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-[9.5px] text-[var(--muted)]">
            La validación no modifica tu facturación.
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="h-10 px-4 rounded-xl border border-[var(--line)] text-[11px] font-semibold hover:bg-[var(--hover)] disabled:opacity-40">
              {success ? 'Cerrar' : 'Cancelar'}
            </button>
            {!success && (
              <>
                <button type="button" onClick={handleValidate} disabled={busy || !cardId || !json.trim()} className="h-10 px-4 rounded-xl border border-[var(--line)] text-[11px] font-semibold hover:bg-[var(--hover)] disabled:opacity-40">
                  {busy ? 'Procesando…' : 'Validar'}
                </button>
                <button type="button" onClick={handleImport} disabled={busy || ready < 1 || errors > 0} className="h-10 px-4 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold disabled:opacity-40">
                  Importar {ready > 0 ? `${ready} ${ready === 1 ? 'movimiento' : 'movimientos'}` : ''}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
