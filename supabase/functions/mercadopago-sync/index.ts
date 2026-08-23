import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_API = 'https://api.mercadopago.com'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function num(value: unknown): number {
  if (value == null || value === '') return 0
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function csvRows(text: string, separator = ';'): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (ch === separator && !quoted) {
      row.push(cell); cell = ''
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(v => v !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); if (row.some(v => v !== '')) rows.push(row) }
  if (!rows.length) return []
  const headers = rows[0].map(v => v.trim().replace(/^\ufeff/, ''))
  return rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])))
}

function normalizedText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function classify(recordType: string, description: string, credit: number, debit: number) {
  const d = normalizedText(description || '')
  if (recordType === 'initial_available_balance' || recordType === 'subtotal' || recordType === 'total' || recordType === 'available_balance') return 'other'
  if (credit > 0 && /(refund|shipping_cancel|mediation_cancel|cancel)/.test(d)) return 'refund'
  if (debit > 0 && /(withdrawal|payout|transfer)/.test(d)) return 'transfer_out'
  if (credit > 0 && /(withdrawal|payout|transfer)/.test(d)) return 'transfer_in'
  if (debit > 0 && /(fee|tax|impuesto|commission|comision|interest|interes)/.test(d)) return 'fee'
  if (debit > 0 && /credit_payment/.test(d)) return 'transfer_out'
  if (debit > 0 && /payment/.test(d)) return 'expense'
  if (credit > 0) return 'income'
  if (debit > 0) return 'other'
  return 'other'
}

async function mpFetch(path: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'authorization': `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  let body: any = text
  try { body = text ? JSON.parse(text) : null } catch {}
  if (!response.ok) {
    const error = new Error(`Mercado Pago ${response.status}: ${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`)
    ;(error as any).status = response.status
    throw error
  }
  return body
}

async function authorize(req: Request, supabase: any) {
  const cronToken = req.headers.get('x-gastito-cron-token') || ''
  if (cronToken) {
    const tokenHash = await sha256(cronToken)
    const { data, error } = await supabase.from('mercadopago_sync_auth').select('user_id, cron_token_hash')
    if (error) throw error
    const match = (data || []).find((row: any) => row.cron_token_hash === tokenHash)
    if (match) return { userId: match.user_id, trigger: 'cron' }
  }

  const auth = req.headers.get('authorization') || ''
  const jwt = auth.replace(/^Bearer\s+/i, '')
  if (jwt) {
    const { data, error } = await supabase.auth.getUser(jwt)
    if (!error && data?.user?.id) return { userId: data.user.id, trigger: 'manual' }
  }
  return null
}

async function ensureReportConfig(accessToken: string) {
  const configResponse = await fetch(`${MP_API}/v1/account/release_report/config`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
  })
  if (configResponse.ok) return
  if (configResponse.status !== 404) throw new Error(`No se pudo consultar configuración de reportes (${configResponse.status})`)

  const columns = [
    'DATE','SOURCE_ID','EXTERNAL_REFERENCE','RECORD_TYPE','DESCRIPTION',
    'NET_CREDIT_AMOUNT','NET_DEBIT_AMOUNT','GROSS_AMOUNT','MP_FEE_AMOUNT',
    'TAXES_AMOUNT','INSTALLMENTS','PAYMENT_METHOD','CURRENCY','BALANCE_AMOUNT',
  ].map(key => ({ key }))

  await mpFetch('/v1/account/release_report/config', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      columns,
      file_name_prefix: 'gastito-release-report',
      frequency: { hour: 0, value: 1, type: 'daily' },
      separator: ';',
      display_timezone: 'GMT-04',
      report_translation: 'es',
      include_withdrawal_at_end: true,
      execute_after_withdrawal: false,
    }),
  })
}

function paymentMerchant(payment: any, fallback: string) {
  return payment?.description || payment?.additional_info?.items?.[0]?.title || payment?.statement_descriptor || payment?.external_reference || fallback || 'Mercado Pago'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok')
  if (!['POST','GET'].includes(req.method)) return json({ error: 'method_not_allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  let runId: string | null = null
  let userId: string | null = null
  try {
    const caller = await authorize(req, supabase)
    if (!caller) return json({ error: 'unauthorized' }, 401)
    userId = caller.userId

    const { data: config, error: configError } = await supabase
      .from('mercadopago_sync_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (configError) throw configError
    if (!config || !config.enabled) return json({ status: 'disabled' })

    const { data: run, error: runError } = await supabase
      .from('mercadopago_sync_runs')
      .insert({ user_id: userId, trigger_source: caller.trigger, status: 'running' })
      .select('id').single()
    if (runError) throw runError
    runId = run.id

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || ''
    if (!accessToken) {
      await supabase.from('mercadopago_sync_config').update({
        credential_state: 'missing', status: 'credentials_missing', last_error: null, updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
      await supabase.from('mercadopago_sync_runs').update({ status: 'skipped', finished_at: new Date().toISOString(), metadata: { reason: 'missing_access_token' } }).eq('id', runId)
      return json({ status: 'credentials_missing' })
    }

    await supabase.from('mercadopago_sync_config').update({ status: 'syncing', last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId)

    let me: any
    try {
      me = await mpFetch('/users/me', accessToken)
    } catch (error) {
      if ((error as any).status === 401) {
        await supabase.from('mercadopago_sync_config').update({ credential_state: 'invalid', status: 'error', last_error: String(error), updated_at: new Date().toISOString() }).eq('user_id', userId)
      }
      throw error
    }

    await supabase.from('mercadopago_sync_config').update({ credential_state: 'configured', mp_user_id: String(me?.id || ''), updated_at: new Date().toISOString() }).eq('user_id', userId)
    await ensureReportConfig(accessToken)

    let rowsSeen = 0
    let rowsInserted = 0
    let expensesCreated = 0
    let latestBalance: number | null = null
    let processedFile: string | null = null

    const reports: any[] = await mpFetch('/v1/account/release_report/list', accessToken)
    const processed = (Array.isArray(reports) ? reports : [])
      .filter(item => item?.status === 'processed')
      .sort((a, b) => String(b.generation_date || b.last_modified || '').localeCompare(String(a.generation_date || a.last_modified || '')))

    if (processed.length) {
      let report = processed[0]
      if (!report.file_name && report.id) report = await mpFetch(`/v1/account/release_report/task/${encodeURIComponent(report.id)}`, accessToken)
      const fileName = report?.file_name || null
      if (fileName && fileName !== config.last_report_file) {
        const response = await fetch(`${MP_API}/v1/account/release_report/${encodeURIComponent(fileName)}`, {
          headers: { authorization: `Bearer ${accessToken}` },
        })
        if (!response.ok) throw new Error(`No se pudo descargar reporte ${fileName} (${response.status})`)
        const rows = csvRows(await response.text(), ';')
        rowsSeen = rows.length
        processedFile = fileName

        const paymentCache = new Map<string, any>()
        for (const row of rows) {
          const occurredAtRaw = row.DATE || row.FECHA || ''
          if (!occurredAtRaw) continue
          const recordType = row.RECORD_TYPE || ''
          const description = row.DESCRIPTION || ''
          const credit = num(row.NET_CREDIT_AMOUNT)
          const debit = num(row.NET_DEBIT_AMOUNT)
          const balance = row.BALANCE_AMOUNT !== undefined && row.BALANCE_AMOUNT !== '' ? num(row.BALANCE_AMOUNT) : null
          if (balance !== null) latestBalance = balance
          if (['initial_available_balance','subtotal','total'].includes(recordType)) continue

          const sourceId = row.SOURCE_ID || null
          let payment: any = null
          if (sourceId && normalizedText(description).includes('payment')) {
            if (!paymentCache.has(sourceId)) {
              try { paymentCache.set(sourceId, await mpFetch(`/v1/payments/${encodeURIComponent(sourceId)}`, accessToken)) }
              catch { paymentCache.set(sourceId, null) }
            }
            payment = paymentCache.get(sourceId)
          }

          const merchant = paymentMerchant(payment, description)
          let classification = classify(recordType, description, credit, debit)
          if (classification === 'income' && payment?.collector_id != null && String(payment.collector_id) !== String(me?.id || '')) classification = 'other'
          if (classification === 'expense' && payment?.collector_id != null && String(payment.collector_id) === String(me?.id || '')) classification = 'other'

          const movementKey = await sha256([
            occurredAtRaw, sourceId || '', row.EXTERNAL_REFERENCE || '', recordType, description,
            credit.toFixed(2), debit.toFixed(2), row.GROSS_AMOUNT || '', row.MP_FEE_AMOUNT || '', row.TAXES_AMOUNT || '',
          ].join('|'))

          let categoryId: string | null = null
          let reviewStatus = 'verified'
          if (classification === 'expense' || classification === 'fee') {
            const categoryDescription = classification === 'fee' ? 'Costos financieros' : merchant
            const { data: inferred } = await supabase.rpc('infer_expense_category_id', { p_user_id: userId, p_description: categoryDescription })
            categoryId = inferred || null
            if (categoryId) {
              const { data: cat } = await supabase.from('categories').select('label').eq('id', categoryId).maybeSingle()
              if (!cat || cat.label === 'Otros') reviewStatus = 'review_required'
            } else reviewStatus = 'review_required'
          } else if (classification === 'other') reviewStatus = 'review_required'

          const movementRow: any = {
            user_id: userId,
            account_id: config.account_id,
            movement_key: movementKey,
            source_id: sourceId,
            external_reference: row.EXTERNAL_REFERENCE || null,
            occurred_at: new Date(occurredAtRaw).toISOString(),
            record_type: recordType || null,
            description: description || null,
            merchant: merchant || null,
            net_credit_amount: credit,
            net_debit_amount: debit,
            gross_amount: row.GROSS_AMOUNT === '' ? null : num(row.GROSS_AMOUNT),
            mp_fee_amount: row.MP_FEE_AMOUNT === '' ? null : num(row.MP_FEE_AMOUNT),
            taxes_amount: row.TAXES_AMOUNT === '' ? null : num(row.TAXES_AMOUNT),
            balance_amount: balance,
            currency: row.CURRENCY || report.currency_id || 'CLP',
            payment_method: row.PAYMENT_METHOD || null,
            installments: row.INSTALLMENTS ? Number(row.INSTALLMENTS) : null,
            classification,
            category_id: categoryId,
            review_status: reviewStatus,
            report_file: fileName,
            raw_data: { report: row, payment: payment || null },
          }

          const { data: inserted, error: insertError } = await supabase
            .from('mercadopago_movements')
            .upsert(movementRow, { onConflict: 'user_id,movement_key', ignoreDuplicates: true })
            .select('id, expense_id')
            .maybeSingle()
          if (insertError) throw insertError
          if (!inserted?.id) continue
          rowsInserted++

          if ((classification === 'expense' || classification === 'fee') && debit > 0 && !inserted.expense_id) {
            const amount = Math.max(1, Math.round(debit))
            const expenseDescription = classification === 'fee' ? (merchant || description || 'Costo Mercado Pago') : (merchant || description || 'Compra Mercado Pago')
            const { data: expense, error: expenseError } = await supabase
              .from('expenses')
              .insert({
                user_id: userId,
                amount,
                description: expenseDescription.slice(0, 180),
                category_id: categoryId,
                bank_id: 'mercadopago',
                payment_method_id: 'transfer',
                card_type: 'debito',
                installments_count: 1,
                status: reviewStatus === 'review_required' ? 'revisar' : 'ok',
                expense_date: new Date(occurredAtRaw).toISOString(),
                notes: `Importado automáticamente desde Mercado Pago · operación ${sourceId || movementKey.slice(0, 12)}`,
                source: 'mercadopago',
              })
              .select('id').single()
            if (expenseError) throw expenseError
            expensesCreated++
            await supabase.from('mercadopago_movements').update({ expense_id: expense.id, updated_at: new Date().toISOString() }).eq('id', inserted.id)
          }
        }
      }
    }

    if (latestBalance !== null && config.account_id) {
      await supabase.from('accounts').update({ balance: Math.round(latestBalance), updated_at: new Date().toISOString() }).eq('id', config.account_id).eq('user_id', userId)
    }

    const now = new Date()
    const lastRequested = config.last_requested_at ? new Date(config.last_requested_at).getTime() : 0
    let requestedTask: any = null
    if (now.getTime() - lastRequested > 55 * 60 * 1000) {
      const begin = new Date(now.getTime() - Number(config.lookback_days || 4) * 86400000)
      requestedTask = await mpFetch('/v1/account/release_report', accessToken, {
        method: 'POST',
        body: JSON.stringify({ begin_date: begin.toISOString(), end_date: now.toISOString() }),
      })
    }

    const finishedAt = new Date().toISOString()
    await supabase.from('mercadopago_sync_config').update({
      status: 'ok', credential_state: 'configured', last_success_at: finishedAt, last_error: null,
      last_requested_at: requestedTask ? finishedAt : config.last_requested_at,
      last_report_task_id: requestedTask?.id ? String(requestedTask.id) : config.last_report_task_id,
      last_report_file: processedFile || config.last_report_file,
      last_balance: latestBalance ?? config.last_balance,
      last_balance_at: latestBalance !== null ? finishedAt : config.last_balance_at,
      updated_at: finishedAt,
    }).eq('user_id', userId)

    await supabase.from('mercadopago_sync_runs').update({
      status: 'ok', finished_at: finishedAt,
      report_task_id: requestedTask?.id ? String(requestedTask.id) : null,
      report_file: processedFile,
      rows_seen: rowsSeen,
      rows_inserted: rowsInserted,
      expenses_created: expensesCreated,
      balance: latestBalance,
      metadata: { mp_user_id: me?.id || null, requested_new_report: Boolean(requestedTask) },
    }).eq('id', runId)

    return json({ status: 'ok', rowsSeen, rowsInserted, expensesCreated, balance: latestBalance, reportFile: processedFile, requestedTaskId: requestedTask?.id || null })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('mercadopago-sync', error)
    const finishedAt = new Date().toISOString()
    if (runId) await supabase.from('mercadopago_sync_runs').update({ status: 'error', finished_at: finishedAt, error_message: message }).eq('id', runId)
    if (userId) await supabase.from('mercadopago_sync_config').update({ status: 'error', last_error: message, updated_at: finishedAt }).eq('user_id', userId)
    return json({ status: 'error', error: message }, 500)
  }
})
