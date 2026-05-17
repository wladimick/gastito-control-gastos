// Supabase Edge Function — Telegram Webhook
// Secrets requeridos (supabase secrets set ...):
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_WEBHOOK_SECRET  (opcional pero recomendado)
// Disponibles automáticamente:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Tipos ──────────────────────────────────────────────────
interface TgUser  { id: number; username?: string; first_name?: string }
interface TgChat  { id: number }
interface TgMsg   { message_id: number; from: TgUser; chat: TgChat; text?: string; date: number }
interface TgUpdate { message?: TgMsg }
interface Category { id: string; label: string }

interface ParsedExpense {
  amount:        number | null
  description:   string
  categoryId:    string | null
  categoryLabel: string
  cardType:      'debito' | 'credito' | null
  bankId:        string | null
  expenseDate:   string
}

// ─── Helpers ────────────────────────────────────────────────
async function sendMessage(chatId: number, text: string): Promise<void> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) { console.warn('TELEGRAM_BOT_TOKEN no configurado'); return }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text }),
    })
  } catch (e) { console.error('sendMessage error:', e) }
}

function fmtCLP(n: number): string {
  return `$${n.toLocaleString('es-CL')}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d.getDate()} de ${m[d.getMonth()]}`
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// ─── Parser de gastos ────────────────────────────────────────
const CAT_KEYWORDS: Record<string, string[]> = {
  'Bencina':       ['bencina','gasolina','combustible','copec','shell','petrobras','terpel'],
  'Supermercado':  ['supermercado','lider','jumbo','walmart','tottus','unimarc','santa isabel','acuenta',
                    'carne','carniceria','verdura','fruta','panaderia','pan','abarrotes'],
  'Comida':        ['comida','almuerzo','cena','desayuno','restauran','restaurant','cafe','pizza','sushi',
                    'rappi','pedidosya','mcdonalds','empanada','sandwich'],
  'Farmacia':      ['farmacia','remedios','medicamentos','pastillas','salcobrand','ahumada','cruz verde'],
  'Transporte':    ['metro','uber','taxi','cabify','bus','micro','transporte','bip','pasaje','aeropuerto'],
  'Suscripciones': ['netflix','spotify','amazon','disney','youtube','hbo','suscripcion'],
  'Hogar':         ['hogar','arriendo','luz','agua','gas','internet','cable','mantencion'],
}

// Ordenado de más específico a más genérico para evitar falsos positivos por substring.
// "mp" omitido — demasiado ambiguo (está en "compré", "ejemplo", etc.)
const BANK_KEYWORDS: Record<string, string> = {
  // ── Falabella / FPay / CMR ───────────────────────────────────
  'falabella pay':       'fpay',       // antes de 'falabella' a solas
  'banco falabella':     'falabella',
  'cmr':                 'falabella',  // tarjeta CMR = Falabella
  'fpay':                'fpay',
  'falabella':           'falabella',
  // ── Banco Chile ──────────────────────────────────────────────
  'banco de chile':      'bchile',
  'banco chile':         'bchile',
  'bchile':              'bchile',
  'chile':               'bchile',
  // ── Banco Estado ─────────────────────────────────────────────
  'cuenta rut':          'bestado',
  'cuentarut':           'bestado',
  'banco estado':        'bestado',
  'bestado':             'bestado',
  'estado':              'bestado',
  // ── Santander ────────────────────────────────────────────────
  'santander':           'santander',
  // ── BCI ──────────────────────────────────────────────────────
  'banco bci':           'bci',
  'bci':                 'bci',
  // ── Itaú ─────────────────────────────────────────────────────
  'itau':                'itau',
  'itaú':                'itau',
  // ── Scotiabank ───────────────────────────────────────────────
  'scotiabank':          'scotiabank',
  'scotia':              'scotiabank',
  // ── Security ─────────────────────────────────────────────────
  'banco security':      'security',
  'security':            'security',
  // ── Ripley ───────────────────────────────────────────────────
  'banco ripley':        'ripley',
  'ripley':              'ripley',
  // ── Consorcio ────────────────────────────────────────────────
  'consorcio':           'consorcio',
  // ── BICE ─────────────────────────────────────────────────────
  'banco bice':          'bice',
  'bice':                'bice',
  // ── Internacional ────────────────────────────────────────────
  'banco internacional':  'internacional',
  // ── Coopeuch ─────────────────────────────────────────────────
  'coopeuch':            'coopeuch',
  // ── Mach (billetera BCI) ──────────────────────────────────────
  'match':               'mach',      // typo frecuente de "mach"
  'mach':                'mach',
  // ── Tenpo ────────────────────────────────────────────────────
  'tenpo':               'tenpo',
  // ── MercadoPago ──────────────────────────────────────────────
  'mercado pago':        'mercadopago',
  'mercadopago':         'mercadopago',
  // ── Chek (Walmart) ───────────────────────────────────────────
  'chek':                'chek',
  'check':               'chek',
  // ── Global66 ─────────────────────────────────────────────────
  'global 66':           'global66',
  'global66':            'global66',
  // ── Tapp / Caja Los Andes ────────────────────────────────────
  'caja los andes':      'tapp',
  'los andes':           'tapp',
  'tapp':                'tapp',
  // ── Los Héroes ───────────────────────────────────────────────
  'los heroes':          'losheroes',
  'los héroes':          'losheroes',
  'losheroes':           'losheroes',
  // ── Khipu ────────────────────────────────────────────────────
  'khipu':               'khipu',
}

// Parsea montos CLP. El punto es separador de miles, no decimal.
// Pruebas:
//   "Gaste 11130 en carne en supermercado el día de ayer con crédito banco Falabella" → 11130
//   "Gaste 1.940 ayer en pan con banco Falabella"                                     → 1940
//   "Gasté 12.500 en bencina hoy con crédito Banco Chile"                             → 12500
//   "8990 supermercado debito"                                                         → 8990
//   "$11.130"  → 11130  |  "11,130"  → 11130  |  "11 130"  → 11130  |  "111.300" → 111300
function parseAmount(text: string): number | null {
  const t = text.replace(/\$/g, '').replace(/ /g, ' ')

  // 1. Punto como separador de miles: 11.130 / 1.940 / 111.300
  const dotThousands = t.match(/\b(\d{1,3}(?:\.\d{3})+)\b/)
  if (dotThousands) {
    const n = parseInt(dotThousands[1].replace(/\./g, ''), 10)
    if (n > 0) return n
  }

  // 2. Coma como separador de miles: 11,130
  const commaThousands = t.match(/\b(\d{1,3}(?:,\d{3})+)\b/)
  if (commaThousands) {
    const n = parseInt(commaThousands[1].replace(/,/g, ''), 10)
    if (n > 0) return n
  }

  // 3. Espacio como separador de miles: 11 130
  const spaceThousands = t.match(/\b(\d{1,3}(?: \d{3})+)\b/)
  if (spaceThousands) {
    const n = parseInt(spaceThousands[1].replace(/ /g, ''), 10)
    if (n > 0) return n
  }

  // 4. Entero sin separador de 4+ dígitos: 11130, 8990
  const longInt = t.match(/\b(\d{4,})\b/)
  if (longInt) {
    const n = parseInt(longInt[1], 10)
    if (n > 0) return n
  }

  // 5. Entero corto de 3 dígitos: 990, 500
  const shortInt = t.match(/\b(\d{3})\b/)
  if (shortInt) {
    const n = parseInt(shortInt[1], 10)
    if (n > 0) return n
  }

  return null
}

function parseExpense(text: string, categories: Category[]): ParsedExpense {
  const lower = stripAccents(text.toLowerCase())
  const amount = parseAmount(text)

  // Categoría
  let categoryId: string | null = null
  let categoryLabel = 'Otros'
  for (const [label, keywords] of Object.entries(CAT_KEYWORDS)) {
    if (keywords.some(k => lower.includes(stripAccents(k)))) {
      const cat = categories.find(c => c.label === label)
      if (cat) { categoryId = cat.id; categoryLabel = label; break }
    }
  }
  if (!categoryId) {
    const otros = categories.find(c => c.label === 'Otros')
    if (otros) categoryId = otros.id
  }

  // Tipo de tarjeta
  const cardType: 'credito' | 'debito' | null =
    /credito|credit/.test(lower) ? 'credito' :
    /debito|debit/.test(lower)   ? 'debito'  : null

  // Banco
  let bankId: string | null = null
  for (const [kw, id] of Object.entries(BANK_KEYWORDS)) {
    if (lower.includes(stripAccents(kw))) { bankId = id; break }
  }

  // Fecha
  let expenseDate = new Date().toISOString()
  if (lower.includes('ayer')) {
    const d = new Date(); d.setDate(d.getDate() - 1); expenseDate = d.toISOString()
  } else if (lower.includes('anteayer')) {
    const d = new Date(); d.setDate(d.getDate() - 2); expenseDate = d.toISOString()
  }

  const description = text.length > 100 ? text.slice(0, 97) + '…' : text

  return { amount, description, categoryId, categoryLabel, cardType, bankId, expenseDate }
}

// ─── Handler principal ───────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    // Validar secret del webhook
    const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
    if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
      return new Response('Unauthorized', { status: 401 })
    }

    const update: TgUpdate = await req.json()
    const msg = update.message
    if (!msg?.text) return new Response('ok')

    const chatId           = msg.chat.id
    const telegramUserId   = msg.from.id
    const telegramUsername = msg.from.username ?? ''
    const text             = msg.text.trim()
    const messageId        = msg.message_id

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── /start ────────────────────────────────────────────────
    if (text === '/start') {
      await sendMessage(chatId,
        '👋 Hola! Soy @gastito_bot.\n\n' +
        'Para vincular tu cuenta:\n' +
        '1. Abre la app → Telegram\n' +
        '2. Genera un código de vinculación\n' +
        '3. Escribe aquí: /vincular CÓDIGO\n\n' +
        'Luego registra gastos con mensajes como:\n' +
        '"Gasté 12.500 en bencina con crédito Banco Chile"'
      )
      return new Response('ok')
    }

    // ── /vincular CODE ────────────────────────────────────────
    if (text.toLowerCase().startsWith('/vincular')) {
      const code = text.split(/\s+/)[1]?.toUpperCase()
      if (!code) {
        await sendMessage(chatId, '❌ Falta el código.\nEjemplo: /vincular ABC123')
        return new Response('ok')
      }

      const { data: linkCode } = await supabase
        .from('linking_codes')
        .select('user_id, expires_at')
        .eq('code', code)
        .single()

      if (!linkCode) {
        await sendMessage(chatId, '❌ Código no encontrado o ya usado. Genera uno nuevo en la app.')
        return new Response('ok')
      }

      if (new Date(linkCode.expires_at) < new Date()) {
        await supabase.from('linking_codes').delete().eq('code', code)
        await sendMessage(chatId, '❌ El código expiró (15 min). Genera uno nuevo en la app.')
        return new Response('ok')
      }

      const { error: linkErr } = await supabase
        .from('telegram_accounts')
        .upsert({
          user_id:          linkCode.user_id,
          telegram_user_id: telegramUserId,
          telegram_username: telegramUsername,
          chat_id:          chatId,
          is_active:        true,
        }, { onConflict: 'telegram_user_id' })

      if (linkErr) {
        console.error('upsert telegram_accounts:', linkErr)
        await sendMessage(chatId, '❌ Error al vincular. Intenta de nuevo.')
        return new Response('ok')
      }

      await supabase.from('linking_codes').delete().eq('code', code)
      await sendMessage(chatId,
        '✅ ¡Cuenta vinculada!\n\n' +
        'Registra gastos escribiendo:\n' +
        '"Gasté 12.500 en bencina hoy con crédito Banco Chile"\n\n' +
        'Comandos: /hoy /mes /ayuda'
      )
      return new Response('ok')
    }

    // ── /hoy ──────────────────────────────────────────────────
    if (text === '/hoy') {
      const { data: acc } = await supabase
        .from('telegram_accounts').select('user_id')
        .eq('telegram_user_id', telegramUserId).single()
      if (!acc) { await sendMessage(chatId, '❌ Cuenta no vinculada. Escribe /start.'); return new Response('ok') }

      const start = new Date(); start.setHours(0, 0, 0, 0)
      const { data: exps } = await supabase
        .from('expenses').select('amount, description')
        .eq('user_id', acc.user_id).gte('expense_date', start.toISOString())

      const total = exps?.reduce((s, e) => s + e.amount, 0) ?? 0
      const n     = exps?.length ?? 0
      const lines = exps?.slice(0, 5).map(e => `• ${e.description}: ${fmtCLP(e.amount)}`).join('\n') ?? ''
      await sendMessage(chatId, `📊 Hoy — ${n} gasto${n !== 1 ? 's' : ''}: ${fmtCLP(total)}\n${lines}`)
      return new Response('ok')
    }

    // ── /mes ──────────────────────────────────────────────────
    if (text === '/mes') {
      const { data: acc } = await supabase
        .from('telegram_accounts').select('user_id')
        .eq('telegram_user_id', telegramUserId).single()
      if (!acc) { await sendMessage(chatId, '❌ Cuenta no vinculada.'); return new Response('ok') }

      const now   = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const { data: exps } = await supabase
        .from('expenses').select('amount')
        .eq('user_id', acc.user_id).gte('expense_date', start.toISOString())

      const total = exps?.reduce((s, e) => s + e.amount, 0) ?? 0
      const n     = exps?.length ?? 0
      await sendMessage(chatId,
        `📅 ${now.toLocaleString('es-CL', { month: 'long', year: 'numeric' })}\n` +
        `${n} gastos · ${fmtCLP(total)}`
      )
      return new Response('ok')
    }

    // ── /ayuda ────────────────────────────────────────────────
    if (text === '/ayuda') {
      await sendMessage(chatId,
        '📌 Formatos aceptados:\n\n' +
        '"Gasté 12.500 en bencina con crédito Banco Chile"\n' +
        '"8.990 supermercado ayer débito"\n' +
        '"45.000 cena crédito Santander"\n' +
        '"19.990 farmacia débito"\n\n' +
        'Comandos:\n' +
        '/hoy — resumen del día\n' +
        '/mes — resumen del mes\n' +
        '/ayuda — esta ayuda'
      )
      return new Response('ok')
    }

    // ── Mensaje de gasto ──────────────────────────────────────
    const { data: account } = await supabase
      .from('telegram_accounts').select('id, user_id')
      .eq('telegram_user_id', telegramUserId).single()

    if (!account) {
      await sendMessage(chatId, '❌ Cuenta no vinculada. Escribe /start para comenzar.')
      return new Response('ok')
    }

    const userId     = account.user_id
    const receivedAt = new Date(msg.date * 1000).toISOString()

    // Guardar mensaje crudo
    const { data: savedMsg, error: msgErr } = await supabase
      .from('telegram_messages')
      .insert({
        user_id:             userId,
        telegram_account_id: account.id,
        telegram_message_id: messageId,
        chat_id:             chatId,
        text,
        received_at:         receivedAt,
        parsed:              false,
        raw_json:            msg,
      })
      .select('id').single()

    if (msgErr || !savedMsg) {
      console.error('insert telegram_messages:', msgErr)
      return new Response('ok')
    }

    // Cargar categorías globales para el parser
    const { data: categories } = await supabase
      .from('categories').select('id, label').is('user_id', null)

    const parsed = parseExpense(text, categories ?? [])

    if (!parsed.amount) {
      await supabase.from('telegram_messages')
        .update({ parse_error: 'No se detectó monto' }).eq('id', savedMsg.id)
      await sendMessage(chatId,
        '🤔 No entendí el monto.\n\n' +
        'Ejemplo:\n"Gasté 12.500 en bencina con crédito Banco Chile"'
      )
      return new Response('ok')
    }

    // Insertar gasto
    const { data: expense, error: expErr } = await supabase
      .from('expenses')
      .insert({
        user_id:            userId,
        amount:             parsed.amount,
        description:        parsed.description,
        category_id:        parsed.categoryId,
        bank_id:            parsed.bankId,
        payment_method_id:  'tarjeta',
        card_type:          parsed.cardType,
        installments_count: 1,
        status:             'ok',
        expense_date:       parsed.expenseDate,
        notes:              '',
        source:             'telegram',
        telegram_message_id: savedMsg.id,
      })
      .select('id').single()

    if (expErr || !expense) {
      console.error('insert expenses:', expErr)
      await supabase.from('telegram_messages')
        .update({ parse_error: expErr?.message ?? 'Error al guardar' }).eq('id', savedMsg.id)
      await sendMessage(chatId, '❌ Error al guardar el gasto. Intenta de nuevo.')
      return new Response('ok')
    }

    // Marcar mensaje como parseado
    await supabase.from('telegram_messages')
      .update({ parsed: true, expense_id: expense.id })
      .eq('id', savedMsg.id)

    await sendMessage(chatId,
      `✅ Registrado\n` +
      `${fmtCLP(parsed.amount)} · ${parsed.categoryLabel}\n` +
      `📅 ${fmtDate(parsed.expenseDate)}` +
      (parsed.bankId ? `\n🏦 ${parsed.bankId}` : '') +
      (parsed.cardType ? ` · ${parsed.cardType}` : '')
    )
    return new Response('ok')

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('ok') // Siempre 200 para que Telegram no reintente
  }
})
