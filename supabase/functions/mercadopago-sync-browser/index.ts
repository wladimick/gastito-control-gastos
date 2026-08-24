import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-gastito-cron-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}
const MP_API = 'https://api.mercadopago.com'

function out(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function num(value: unknown) {
  if (value == null || value === '') return 0
  const n = Number(String(value).trim().replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function csvRows(text: string, separator = ';') {
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

function norm(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function isoSeconds(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

async function mpFetch(path: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  let body: any = text
  try { body = text ? JSON.parse(text) : null } catch {}
  if (!response.ok) throw new Error(`Mercado Pago ${response.status}: ${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`)
  return body
}

async function resolveCaller(req: Request, supabase: any) {
  const cronToken = req.headers.get('x-gastito-cron-token') || ''
  if (cronToken) {
    const hash = await sha256(cronToken)
    const { data, error } = await supabase.from('mercadopago_sync_auth').select('user_id').eq('cron_token_hash', hash).maybeSingle()
    if (error) throw error
    if (data?.user_id) return { userId: data.user_id, trigger: 'cron' }
  }
  const auth = req.headers.get('authorization') || ''
  if (auth) {
    const jwt = auth.replace(/^Bearer\s+/i, '')
    const { data, error } = await supabase.auth.getUser(jwt)
    if (!error && data?.user?.id) return { userId: data.user.id, trigger: 'manual' }
  }
  return null
}

function classify(description: string, credit: number, debit: number, payment: any) {
  const d = norm(description)
  const op = norm(payment?.operation_type)
  if (['reserve_for_payment','reserve_for_payout','initial_available_balance','total','subtotal'].includes(d)) return 'skip'
  if (d === 'payment') {
    if (/transfer|partition/.test(op)) return debit > 0 ? 'transfer_out' : credit > 0 ? 'transfer_in' : 'other'
    return debit > 0 ? 'expense' : credit > 0 ? 'income' : 'other'
  }
  if (/^payout|withdrawal|money_transfer/.test(d)) return debit > 0 ? 'transfer_out' : credit > 0 ? 'transfer_in' : 'other'
  if (/refund|cancel|chargeback/.test(d) && credit > 0) return 'refund'
  if (/fee|tax|impuesto|commission|comision|interest|interes/.test(d) && debit > 0) return 'fee'
  if ((d === 'cashback' || d === 'asset_management') && credit > 0) return 'income'
  return 'other'
}

function merchantName(description: string, payment: any, classification: string) {
  if (classification === 'transfer_in' || classification === 'transfer_out') return 'Transferencia Mercado Pago'
  return payment?.description || payment?.additional_info?.items?.[0]?.title || payment?.statement_descriptor || description || 'Mercado Pago'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return out({ error: 'method_not_allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  let runId: string | null = null
  let userId: string | null = null
  try {
    const caller = await resolveCaller(req, supabase)
    if (!caller) return out({ error: 'unauthorized' }, 401)
    userId = caller.userId

    const { data: config, error: configError } = await supabase.from('mercadopago_sync_config').select('*').eq('user_id', userId).maybeSingle()
    if (configError) throw configError
    if (!config?.enabled) return out({ status: 'disabled' })

    const { data: run, error: runError } = await supabase.from('mercadopago_sync_runs').insert({ user_id: userId, trigger_source: caller.trigger, status: 'running' }).select('id').single()
    if (runError) throw runError
    runId = run.id

    const { data: accessToken, error: tokenError } = await supabase.rpc('get_mercadopago_access_token')
    if (tokenError || !accessToken) throw tokenError || new Error('missing_access_token')

    await supabase.from('mercadopago_sync_config').update({ status: 'syncing', last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId)

    const me = await mpFetch('/users/me', accessToken)
    await supabase.from('mercadopago_sync_config').update({ credential_state: 'configured', mp_user_id: String(me?.id || ''), updated_at: new Date().toISOString() }).eq('user_id', userId)

    const reports = await mpFetch('/v1/account/release_report/list', accessToken)
    const readyReports = (Array.isArray(reports) ? reports : [])
      .filter((r: any) => r?.file_name && ['enabled','processed'].includes(String(r?.status || '').toLowerCase()))
      .sort((a: any, b: any) => String(b.date_created || b.generation_date || b.last_modified || '').localeCompare(String(a.date_created || a.generation_date || a.last_modified || '')))

    let rowsSeen = 0
    let rowsInserted = 0
    let expensesCreated = 0
    let latestBalance: number | null = config.last_balance == null ? null : Number(config.last_balance)
    let processedFile: string | null = null

    const latest = readyReports[0] || null
    if (latest?.file_name && latest.file_name !== config.last_report_file) {
      const fileName = String(latest.file_name)
      const fileResponse = await fetch(`${MP_API}/v1/account/release_report/${encodeURIComponent(fileName)}`, { headers: { authorization: `Bearer ${accessToken}` } })
      if (!fileResponse.ok) throw new Error(`No se pudo descargar reporte ${fileName} (${fileResponse.status})`)
      const rows = csvRows(await fileResponse.text(), ';')
      rowsSeen = rows.length
      processedFile = fileName
      const paymentCache = new Map<string, any>()

      for (const row of rows) {
        const occurredRaw = row.DATE || ''
        if (!occurredRaw) continue
        const description = row.DESCRIPTION || ''
        const credit = num(row.NET_CREDIT_AMOUNT)
        const debit = num(row.NET_DEBIT_AMOUNT)
        const balance = row.BALANCE_AMOUNT !== '' && row.BALANCE_AMOUNT != null ? num(row.BALANCE_AMOUNT) : null
        if (balance !== null) latestBalance = balance
        const sourceId = row.SOURCE_ID || null

        let payment: any = null
        if (sourceId && norm(description) === 'payment') {
          if (!paymentCache.has(sourceId)) {
            try { paymentCache.set(sourceId, await mpFetch(`/v1/payments/${encodeURIComponent(sourceId)}`, accessToken)) }
            catch { paymentCache.set(sourceId, null) }
          }
          payment = paymentCache.get(sourceId)
        }

        const classification = classify(description, credit, debit, payment)
        if (classification === 'skip') continue
        const merchant = merchantName(description, payment, classification)
        const movementKey = await sha256([occurredRaw, sourceId || '', row.EXTERNAL_REFERENCE || '', row.RECORD_TYPE || '', description, credit.toFixed(2), debit.toFixed(2), row.GROSS_AMOUNT || '', row.MP_FEE_AMOUNT || '', row.TAXES_AMOUNT || ''].join('|'))

        const { data: existing } = await supabase.from('mercadopago_movements').select('id, expense_id').eq('user_id', userId).eq('movement_key', movementKey).maybeSingle()
        if (existing?.id) continue

        let categoryId: string | null = null
        let reviewStatus = classification === 'other' ? 'review_required' : 'verified'

        const merchantNormalized = norm(merchant)
        if (merchantNormalized) {
          const { data: savedRule } = await supabase
            .from('mercadopago_category_rules')
            .select('category_id')
            .eq('user_id', userId)
            .eq('merchant_normalized', merchantNormalized)
            .eq('active', true)
            .maybeSingle()
          if (savedRule?.category_id) categoryId = savedRule.category_id
        }

        if (!categoryId && (classification === 'transfer_in' || classification === 'transfer_out')) {
          const { data: transferCategory } = await supabase
            .from('categories')
            .select('id')
            .is('user_id', null)
            .eq('label', 'Transferencias')
            .maybeSingle()
          categoryId = transferCategory?.id || null
        }

        if (!categoryId && classification === 'income' && ['cashback', 'asset_management'].includes(norm(description))) {
          const { data: savingsCategory } = await supabase
            .from('categories')
            .select('id')
            .is('user_id', null)
            .eq('label', 'Ahorro')
            .maybeSingle()
          categoryId = savingsCategory?.id || null
        }

        if (!categoryId && (classification === 'expense' || classification === 'fee')) {
          const { data: inferred } = await supabase.rpc('infer_expense_category_id', { p_user_id: userId, p_description: merchant })
          categoryId = inferred || null
          if (categoryId) {
            const { data: cat } = await supabase.from('categories').select('label').eq('id', categoryId).maybeSingle()
            if (!cat || cat.label === 'Otros') reviewStatus = 'review_required'
          } else reviewStatus = 'review_required'
        }

        if (categoryId && classification !== 'other') reviewStatus = 'verified'

        const { data: movement, error: movementError } = await supabase.from('mercadopago_movements').insert({
          user_id: userId, account_id: config.account_id, movement_key: movementKey, source_id: sourceId,
          external_reference: row.EXTERNAL_REFERENCE || null, occurred_at: new Date(occurredRaw).toISOString(),
          record_type: row.RECORD_TYPE || null, description: description || null, merchant,
          net_credit_amount: credit, net_debit_amount: debit,
          gross_amount: row.GROSS_AMOUNT === '' ? null : num(row.GROSS_AMOUNT),
          mp_fee_amount: row.MP_FEE_AMOUNT === '' ? null : num(row.MP_FEE_AMOUNT),
          taxes_amount: row.TAXES_AMOUNT === '' ? null : num(row.TAXES_AMOUNT),
          balance_amount: balance, currency: row.CURRENCY || latest.currency_id || 'CLP',
          payment_method: row.PAYMENT_METHOD || payment?.payment_method_id || null,
          installments: row.INSTALLMENTS ? Number(row.INSTALLMENTS) : null,
          classification, category_id: categoryId, review_status: reviewStatus, report_file: fileName,
          raw_data: { report: row, payment: payment || null },
        }).select('id').single()
        if (movementError) throw movementError
        rowsInserted++

        if ((classification === 'expense' || classification === 'fee') && debit > 0) {
          const { data: expense, error: expenseError } = await supabase.from('expenses').insert({
            user_id: userId, amount: Math.max(1, Math.round(debit)), description: merchant.slice(0, 180),
            category_id: categoryId, bank_id: 'mercadopago', payment_method_id: 'transfer', card_type: 'debito',
            installments_count: 1, status: reviewStatus === 'review_required' ? 'revisar' : 'ok',
            expense_date: new Date(occurredRaw).toISOString(),
            notes: `Importado automáticamente desde Mercado Pago · operación ${sourceId || movementKey.slice(0, 12)}`,
            source: 'mercadopago',
          }).select('id').single()
          if (expenseError) throw expenseError
          expensesCreated++
          await supabase.from('mercadopago_movements').update({ expense_id: expense.id, updated_at: new Date().toISOString() }).eq('id', movement.id)
        }
      }
    }

    if (latestBalance !== null && config.account_id) {
      await supabase.from('accounts').update({ balance: Math.round(latestBalance), updated_at: new Date().toISOString() }).eq('id', config.account_id).eq('user_id', userId)
    }

    const now = new Date()
    const previousRequestedMs = config.last_requested_at ? new Date(config.last_requested_at).getTime() : 0
    const requestDue = !previousRequestedMs || now.getTime() - previousRequestedMs > 55 * 60 * 1000
    let requestedTask: any = null
    if (requestDue) {
      const begin = new Date(now.getTime() - Number(config.lookback_days || 4) * 86400000)
      requestedTask = await mpFetch('/v1/account/release_report', accessToken, { method: 'POST', body: JSON.stringify({ begin_date: isoSeconds(begin), end_date: isoSeconds(now) }) })
    }

    const finishedAt = new Date().toISOString()
    await supabase.from('mercadopago_sync_config').update({
      status: 'ok', credential_state: 'configured', last_success_at: finishedAt, last_error: null,
      last_requested_at: requestedTask ? finishedAt : config.last_requested_at,
      last_report_task_id: requestedTask?.id ? String(requestedTask.id) : config.last_report_task_id,
      last_report_file: processedFile || config.last_report_file,
      last_balance: latestBalance, last_balance_at: latestBalance !== null ? finishedAt : config.last_balance_at,
      updated_at: finishedAt,
    }).eq('user_id', userId)

    await supabase.from('mercadopago_sync_runs').update({
      status: 'ok', finished_at: finishedAt, report_task_id: requestedTask?.id ? String(requestedTask.id) : null,
      report_file: processedFile, rows_seen: rowsSeen, rows_inserted: rowsInserted, expenses_created: expensesCreated,
      balance: latestBalance, metadata: { mp_user_id: me?.id || null, requested_new_report: Boolean(requestedTask), latest_list_status: latest?.status || null },
    }).eq('id', runId)

    return out({ status: 'ok', rowsSeen, rowsInserted, expensesCreated, balance: latestBalance, reportFile: processedFile, requestedTaskId: requestedTask?.id || null })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('mercadopago-sync-browser', error)
    const finishedAt = new Date().toISOString()
    if (runId) await supabase.from('mercadopago_sync_runs').update({ status: 'error', finished_at: finishedAt, error_message: message }).eq('id', runId)
    if (userId) await supabase.from('mercadopago_sync_config').update({ status: 'error', last_error: message, updated_at: finishedAt }).eq('user_id', userId)
    return out({ status: 'error', error: message }, 500)
  }
})
