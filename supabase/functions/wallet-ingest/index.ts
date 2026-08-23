import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-gastito-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(Math.abs(value))
    return rounded > 0 ? rounded : null
  }
  let text = String(value ?? '').trim()
  if (!text) return null
  text = text.replace(/\s/g, '').replace(/[^0-9,.-]/g, '')
  if (!text) return null

  const thousands = /^-?\d{1,3}([.,]\d{3})+$/.test(text)
  if (thousands) {
    const n = Number(text.replace(/[.,]/g, ''))
    return Number.isFinite(n) && n !== 0 ? Math.round(Math.abs(n)) : null
  }

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  const lastSep = Math.max(lastComma, lastDot)
  if (lastSep >= 0 && text.length - lastSep - 1 <= 2) {
    const normalized = text.slice(0, lastSep).replace(/[.,]/g, '') + '.' + text.slice(lastSep + 1)
    const n = Number(normalized)
    return Number.isFinite(n) && n !== 0 ? Math.round(Math.abs(n)) : null
  }

  const n = Number(text.replace(/[.,]/g, ''))
  return Number.isFinite(n) && n !== 0 ? Math.round(Math.abs(n)) : null
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function readPayload(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get('content-type') || ''
  if (type.includes('application/json')) return await req.json()
  if (type.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData()
    return Object.fromEntries(form.entries())
  }
  const text = await req.text()
  if (!text.trim()) return {}
  try { return JSON.parse(text) } catch { return { raw: text } }
}

function resolveCard(cards: any[], hint: string) {
  const n = normalize(hint)
  if (!n) return null

  let card = cards.find(c => c.last_four && n.includes(String(c.last_four)))
  if (card) return card

  if (/\bcmr\b|falabella/.test(n)) {
    card = cards.find(c => c.bank_id === 'falabella')
    if (card) return card
  }
  if (/banco de chile|banco chile|\bbchile\b|\bchile\b/.test(n)) {
    card = cards.find(c => c.bank_id === 'bchile')
    if (card) return card
  }

  card = cards.find(c => n.includes(normalize(c.name)))
  return card || null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  try {
    const rawToken = req.headers.get('x-gastito-token')?.trim()
    if (!rawToken) return json({ ok: false, error: 'missing_token' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const tokenHash = await sha256Hex(rawToken)
    const { data: tokenRow, error: tokenError } = await supabase
      .from('wallet_ingest_tokens')
      .select('id, user_id, active')
      .eq('token_hash', tokenHash)
      .eq('active', true)
      .maybeSingle()

    if (tokenError) {
      console.error('wallet token lookup', tokenError)
      return json({ ok: false, error: 'token_lookup_failed' }, 500)
    }
    if (!tokenRow) return json({ ok: false, error: 'invalid_token' }, 401)

    const payload = await readPayload(req)
    const amount = parseAmount(payload.amount ?? payload.Amount)
    const merchant = String(payload.merchant ?? payload.Merchant ?? payload.name ?? payload.Name ?? '').trim()
    const walletName = String(payload.name ?? payload.Name ?? merchant).trim() || null
    const cardHint = String(payload.card ?? payload.Card ?? payload.card_name ?? payload.cardName ?? payload.card_alias ?? '').trim()
    const currency = String(payload.currency ?? payload.Currency ?? 'CLP').trim().toUpperCase() || 'CLP'

    if (!amount) return json({ ok: false, error: 'invalid_amount', received: payload.amount ?? null }, 422)
    if (!merchant) return json({ ok: false, error: 'missing_merchant' }, 422)
    if (!cardHint) return json({ ok: false, error: 'missing_card' }, 422)

    const { data: cards, error: cardsError } = await supabase
      .from('credit_cards')
      .select('id, name, bank_id, last_four')
      .eq('user_id', tokenRow.user_id)
      .eq('is_active', true)

    if (cardsError) return json({ ok: false, error: 'card_lookup_failed' }, 500)
    const card = resolveCard(cards || [], cardHint)
    if (!card) return json({ ok: false, error: 'unknown_card', card: cardHint }, 422)

    let occurredAt = new Date().toISOString()
    const suppliedDate = payload.occurred_at ?? payload.occurredAt ?? payload.date
    if (suppliedDate) {
      const parsedDate = new Date(String(suppliedDate))
      if (!Number.isNaN(parsedDate.getTime())) occurredAt = parsedDate.toISOString()
    }

    const merchantKey = normalize(merchant).slice(0, 160)
    const eventTime = new Date(occurredAt).getTime()
    const since = new Date(eventTime - 10 * 60_000).toISOString()
    const until = new Date(eventTime + 10 * 60_000).toISOString()

    const { data: duplicate } = await supabase
      .from('wallet_ingest_events')
      .select('id, expense_id, category_id, status')
      .eq('user_id', tokenRow.user_id)
      .eq('credit_card_id', card.id)
      .eq('merchant_key', merchantKey)
      .eq('amount', amount)
      .gte('occurred_at', since)
      .lte('occurred_at', until)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (duplicate) {
      await supabase.from('wallet_ingest_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow.id)
      return json({ ok: true, duplicate: true, eventId: duplicate.id, expenseId: duplicate.expense_id })
    }

    const { data: categoryId, error: categoryError } = await supabase.rpc('infer_expense_category_id', {
      p_user_id: tokenRow.user_id,
      p_description: merchant,
    })
    if (categoryError) console.error('category inference', categoryError)

    let categoryLabel = 'Otros'
    if (categoryId) {
      const { data: category } = await supabase.from('categories').select('label').eq('id', categoryId).maybeSingle()
      if (category?.label) categoryLabel = category.label
    }
    const needsReview = categoryLabel === 'Otros'

    const expenseNotes = [
      'Apple Wallet · importación automática desde Atajos.',
      `Tarjeta: ${card.name}${card.last_four ? ` •••• ${card.last_four}` : ''}.`,
      walletName && walletName !== merchant ? `Nombre Wallet: ${walletName}.` : null,
      'Se asume 1 cuota; la conciliación del estado de cuenta prevalece si la compra fue en cuotas.',
    ].filter(Boolean).join(' ')

    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        user_id: tokenRow.user_id,
        amount,
        description: merchant.slice(0, 240),
        category_id: categoryId || null,
        bank_id: card.bank_id,
        payment_method_id: 'tarjeta',
        card_type: 'credito',
        installments_count: 1,
        status: needsReview ? 'revisar' : 'ok',
        expense_date: occurredAt,
        notes: expenseNotes,
        source: 'manual',
      })
      .select('id')
      .single()

    if (expenseError || !expense) {
      console.error('wallet expense insert', expenseError)
      return json({ ok: false, error: 'expense_insert_failed', detail: expenseError?.message }, 500)
    }

    const bucket = Math.floor(eventTime / (10 * 60_000))
    const fingerprint = await sha256Hex(`${tokenRow.user_id}|${card.id}|${merchantKey}|${amount}|${bucket}`)

    const { data: event, error: eventError } = await supabase
      .from('wallet_ingest_events')
      .insert({
        user_id: tokenRow.user_id,
        token_id: tokenRow.id,
        credit_card_id: card.id,
        bank_id: card.bank_id,
        card_hint: cardHint,
        merchant,
        merchant_key: merchantKey,
        wallet_name: walletName,
        amount,
        currency,
        occurred_at: occurredAt,
        fingerprint,
        category_id: categoryId || null,
        expense_id: expense.id,
        status: needsReview ? 'review' : 'accepted',
        raw_payload: payload,
      })
      .select('id')
      .single()

    if (eventError) console.error('wallet event insert', eventError)

    await supabase.from('wallet_ingest_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow.id)

    return json({
      ok: true,
      duplicate: false,
      eventId: event?.id ?? null,
      expenseId: expense.id,
      amount,
      merchant,
      card: card.name,
      lastFour: card.last_four,
      category: categoryLabel,
      review: needsReview,
    })
  } catch (error) {
    console.error('wallet-ingest error', error)
    return json({ ok: false, error: 'internal_error' }, 500)
  }
})
