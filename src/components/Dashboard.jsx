import React from 'react'
import { Card, StatCard, Badge, BarRow } from './ui'
import { Icon, fmtCLP, fmtCLPshort, relDate, timeOnly, MES } from '../lib/helpers'
import { CATEGORIES } from '../data'
import { useBanks } from '../services/banksService'

export default function Dashboard({ expenses, setView, openChat, botStatus, lastBotMessage, installmentDebts = [], recurring = [], accounts = [], creditCards = [] }) {
  const banks = useBanks()
  const today = new Date()

  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  })
  const total = thisMonth.reduce((s, e) => s + e.amount, 0)
  const avg   = thisMonth.length ? total / thisMonth.length : 0

  // Previous month for delta
  const prevM = today.getMonth() === 0 ? 11 : today.getMonth() - 1
  const prevY = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
  const lastMonthTotal = expenses.filter(e => {
    const d = new Date(e.date)
    return d.getMonth() === prevM && d.getFullYear() === prevY
  }).reduce((s, e) => s + e.amount, 0)
  const delta    = lastMonthTotal ? ((total - lastMonthTotal) / lastMonthTotal) * 100 : 0
  const deltaStr = lastMonthTotal ? (delta > 0 ? '+' : '') + delta.toFixed(0) + '%' : null

  const byCat = {}
  thisMonth.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount })
  const catsArr = Object.entries(byCat).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v)
  const maxCat  = catsArr[0]?.v || 1

  const byMethod = { debito: 0, credito: 0, efectivo: 0 }
  thisMonth.forEach(e => {
    if (e.method === 'efectivo') byMethod.efectivo += e.amount
    else if (e.type === 'debito') byMethod.debito += e.amount
    else byMethod.credito += e.amount
  })
  const topMethod = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0]
  const methodLabel = thisMonth.length === 0 ? '—' : { debito: 'Débito', credito: 'Crédito', efectivo: 'Efectivo' }[topMethod[0]]

  const byBank = {}
  thisMonth.forEach(e => { byBank[e.bank] = (byBank[e.bank] || 0) + e.amount })

  const AUTO_PAY_DAY = 5
  const activeDebts = installmentDebts.filter(d => d.status === 'active')
  const totalRemainingDebt  = activeDebts.reduce((s, d) => s + d.monthlyAmount * (d.installments - d.paid), 0)
  const cuotasThisMonth     = activeDebts.reduce((s, d) => s + d.monthlyAmount, 0)
  const cuotasNextMonth     = activeDebts.filter(d => d.paid + 1 < d.installments).reduce((s, d) => s + d.monthlyAmount, 0)
  const alreadyChargedThisMonth = today.getDate() >= AUTO_PAY_DAY
  const nextChargeDate = alreadyChargedThisMonth
    ? new Date(today.getFullYear(), today.getMonth() + 1, AUTO_PAY_DAY)
    : new Date(today.getFullYear(), today.getMonth(), AUTO_PAY_DAY)
  const daysToCharge = Math.round((nextChargeDate - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)

  const recent = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6)
  const daysIn = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayNow = today.getDate()
  const proj   = dayNow > 0 ? (total / dayNow) * daysIn : 0

  const byDay = {}
  thisMonth.forEach(e => {
    const d = new Date(e.date).getDate()
    byDay[d] = (byDay[d] || 0) + e.amount
  })
  const maxDay = Math.max(1, ...Object.values(byDay))

  const monthLabel = `${MES[today.getMonth()]} ${today.getFullYear()}`
  const topCat = CATEGORIES.find(c => c.id === catsArr[0]?.id)

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <Card padding="p-5 md:p-6" className="relative overflow-hidden">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
            <Icon name="calendar" size={13}/> {monthLabel}
          </div>
          <div className="mt-3 flex items-end gap-3 flex-wrap">
            <div className="font-mono text-[40px] md:text-[52px] tracking-tight leading-none">{fmtCLP(total)}</div>
            {deltaStr && (
              <div className={`mb-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium
                ${delta < 0 ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'bg-[var(--amber-soft)] text-[var(--amber-ink)]'}`}>
                <Icon name="trend" size={12}/> {deltaStr} vs {MES[prevM]}
              </div>
            )}
          </div>
          <div className="mt-2 text-[13px] text-[var(--muted)]">
            Proyección fin de mes ≈ <span className="font-mono text-[var(--ink-2)]">{fmtCLP(proj)}</span> · {thisMonth.length} gastos registrados
          </div>

          <div className="mt-5 grid grid-cols-[repeat(31,minmax(0,1fr))] gap-[3px]">
            {Array.from({ length: daysIn }).map((_, i) => {
              const day       = i + 1
              const v         = byDay[day] || 0
              const intensity = v / maxDay
              const isToday   = day === dayNow
              return (
                <div key={i}
                     className={`h-7 rounded-[3px] ${isToday ? 'outline outline-1 outline-[var(--ink)]' : ''}`}
                     style={{ background: v ? `oklch(0.62 0.13 165 / ${0.18 + intensity * 0.72})` : 'var(--line)' }}
                     title={`Día ${day}: ${fmtCLP(v)}`}/>
              )
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--muted)] font-mono">
            <span>1</span><span>15</span><span>{daysIn}</span>
          </div>
        </Card>

        <Card padding="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] flex items-center gap-2">
                <Icon name="bot" size={13}/> Bot de Telegram
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${botStatus === 'online' ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`}></span>
                <span className="font-medium">{botStatus === 'online' ? 'Conectado' : 'Desconectado'}</span>
                <span className="text-[12px] text-[var(--muted)]">· @gastito_bot</span>
              </div>
            </div>
            <Badge tone={botStatus === 'online' ? 'ok' : 'warn'}>{botStatus === 'online' ? 'Activo' : 'Off'}</Badge>
          </div>

          {lastBotMessage ? (
            <div className="mt-4 rounded-lg bg-[var(--bg)] border border-[var(--line)] p-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Último mensaje</div>
              <div className="mt-1.5 text-[13px] leading-snug">"{lastBotMessage.text}"</div>
              <div className="mt-2 text-[11px] text-[var(--muted)] font-mono">{relDate(lastBotMessage.at)} · {timeOnly(lastBotMessage.at)}</div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-[var(--bg)] border border-[var(--line)] p-3 text-center text-[12px] text-[var(--muted)]">
              Sin mensajes recibidos aún
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={openChat}
              className="h-9 inline-flex items-center justify-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium">
              <Icon name="send" size={14}/> Probar
            </button>
            <button onClick={() => setView('telegram')}
              className="h-9 inline-flex items-center justify-center gap-2 rounded-md border border-[var(--line)] text-[13px] text-[var(--ink-2)] hover:bg-[var(--hover)]">
              <Icon name="settings" size={14}/> Ajustes
            </button>
          </div>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Gastos del mes"  value={thisMonth.length}        sub={`promedio diario: ${fmtCLPshort(dayNow > 0 ? total / dayNow : 0)}`} icon="list"/>
        <StatCard label="Gasto promedio"  value={fmtCLP(avg)}             sub="por transacción"                                                     icon="wallet"/>
        <StatCard label="Medio más usado" value={methodLabel}             sub={thisMonth.length ? `${fmtCLP(topMethod[1])} este mes` : 'sin datos'} icon="card"/>
        <StatCard label="Categoría top"   value={topCat?.label ?? '—'}   sub={topCat ? `${fmtCLP(catsArr[0]?.v ?? 0)} acumulado` : 'sin gastos'}  icon="tag"/>
      </div>

      {/* Flujo de caja — solo si hay cuentas configuradas */}
      {accounts.length > 0 && (() => {
        const totalAvailable = accounts.filter(a => a.active).reduce((s, a) => s + (a.balance ?? 0), 0)
        const primaryCard = creditCards.find(c => c.isActive !== false)
        const billingDay  = Number(primaryCard?.billingDay ?? 20)
        const paymentDay  = Number(primaryCard?.paymentDueDay ?? 5)
        const cycleStart  = today.getDate() >= billingDay
          ? new Date(today.getFullYear(), today.getMonth(), billingDay)
          : new Date(today.getFullYear(), today.getMonth() - 1, billingDay)
        const cycleCredit = thisMonth.filter(e => e.type === 'credito' && new Date(e.date) >= cycleStart)
          .reduce((s, e) => s + e.amount, 0)
        const recurringTotal = (recurring ?? []).filter(r => r.active && r.kind !== 'income')
          .reduce((s, r) => s + r.amount, 0)
        const freeBalance = totalAvailable - cycleCredit - recurringTotal - cuotasThisMonth
        let nextPayDate = new Date(today.getFullYear(), today.getMonth(), paymentDay)
        if (nextPayDate <= today) nextPayDate = new Date(today.getFullYear(), today.getMonth() + 1, paymentDay)
        const daysToPayment = Math.ceil((nextPayDate - today) / 86400000)
        const netColor = freeBalance >= 0 ? 'text-[var(--accent-ink)]' : 'text-[#A02828]'
        return (
          <Card padding="p-0">
            <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[12px] font-semibold tracking-tight">
                <Icon name="wallet" size={14}/> Flujo de caja
              </div>
              <button onClick={() => setView('accounts')} className="text-[12px] text-[var(--ink-2)] hover:underline inline-flex items-center gap-1">
                Ver detalle <Icon name="chevron" size={12}/>
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[var(--line)]">
              {[
                { label: 'Disponible',         value: fmtCLP(totalAvailable),  sub: `${accounts.filter(a=>a.active).length} cuentas`, color: 'text-[var(--accent-ink)]' },
                { label: 'Crédito ciclo',       value: fmtCLP(cycleCredit),     sub: `pago en ${daysToPayment}d · día ${paymentDay}`, color: '' },
                { label: 'Compromisos fijos',   value: fmtCLP(recurringTotal + cuotasThisMonth), sub: 'recurrentes + cuotas', color: '' },
                { label: 'Saldo libre est.',    value: fmtCLP(freeBalance),     sub: freeBalance >= 0 ? 'después de compromisos' : '⚠ déficit', color: netColor },
              ].map((item, i) => (
                <div key={i} className="px-5 py-3.5">
                  <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--muted)]">{item.label}</div>
                  <div className={`mt-1.5 font-mono text-[18px] tracking-tight leading-none ${item.color}`}>{item.value}</div>
                  <div className="mt-1 text-[11px] text-[var(--muted)]">{item.sub}</div>
                </div>
              ))}
            </div>
          </Card>
        )
      })()}

      {/* Cuotas activas — solo si hay datos */}
      {activeDebts.length > 0 && (
        <Card padding="p-0">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--line)] flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-[var(--ink)] text-[var(--bg)] grid place-items-center">
                <Icon name="layers" size={16}/>
              </div>
              <div>
                <div className="font-semibold tracking-tight">Cuotas activas</div>
                <div className="text-[12px] text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                  <Icon name="repeat" size={11}/>
                  Auto-pago día <span className="font-mono">{AUTO_PAY_DAY}</span>
                  <span>·</span>
                  <span>próximo en {daysToCharge} días</span>
                </div>
              </div>
            </div>
            <button onClick={() => setView('installments')}
              className="text-[12px] text-[var(--ink-2)] hover:underline inline-flex items-center gap-1">
              Ver detalle <Icon name="chevron" size={12}/>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--line)]">
            <div className="px-5 py-4">
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--muted)]">Este mes</div>
              <div className="mt-2 font-mono text-[22px] tracking-tight leading-none">{fmtCLP(cuotasThisMonth)}</div>
              <div className="mt-1.5 text-[11.5px] text-[var(--muted)]">{activeDebts.length} cuotas · día {AUTO_PAY_DAY}</div>
            </div>
            <div className="px-5 py-4">
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--muted)]">Próximo mes</div>
              <div className="mt-2 font-mono text-[22px] tracking-tight leading-none">{fmtCLP(cuotasNextMonth)}</div>
              <div className="mt-1.5 text-[11.5px] text-[var(--muted)]">estimado</div>
            </div>
            <div className="px-5 py-4">
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--muted)]">Deuda restante</div>
              <div className="mt-2 font-mono text-[22px] tracking-tight leading-none">{fmtCLP(totalRemainingDebt)}</div>
              <div className="mt-1.5 text-[11.5px] text-[var(--muted)]">total por pagar</div>
            </div>
          </div>

          <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {activeDebts.slice(0, 4).map(d => {
              const cat = CATEGORIES.find(c => c.id === d.category) ?? CATEGORIES.find(c => c.id === 'otros') ?? CATEGORIES[0]
              return (
                <li key={d.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md grid place-items-center text-[13px] shrink-0" style={{ background: (cat.color ?? '#888') + '20' }}>{cat.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium truncate">{d.description}</span>
                      <span className="text-[10.5px] font-mono px-1.5 py-[2px] rounded bg-[var(--hover)] text-[var(--ink-2)]">{d.paid}/{d.installments}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-[3px]">
                      {Array.from({ length: d.installments }).map((_, i) => (
                        <div key={i} className="flex-1 h-1 rounded-sm" style={{ background: i < d.paid ? 'var(--ink)' : 'var(--line)' }}/>
                      ))}
                    </div>
                  </div>
                  <div className="font-mono text-[13px] tabular-nums shrink-0">{fmtCLP(d.monthlyAmount)}</div>
                </li>
              )
            })}
            {activeDebts.length > 4 && (
              <li className="px-5 py-2.5 text-[12px] text-[var(--muted)] text-center">+ {activeDebts.length - 4} más</li>
            )}
          </ul>
        </Card>
      )}

      {/* Últimos gastos + por categoría + medios */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr_1fr] gap-4">
        <Card padding="p-0">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--line)]">
            <div>
              <div className="font-semibold tracking-tight">Últimos gastos</div>
              <div className="text-[12px] text-[var(--muted)] mt-0.5">Registrados desde Telegram y manuales</div>
            </div>
            <button onClick={() => setView('expenses')} className="text-[12px] text-[var(--ink-2)] hover:underline inline-flex items-center gap-1">
              Ver todos <Icon name="chevron" size={12}/>
            </button>
          </div>
          {recent.length > 0 ? (
            <ul className="divide-y divide-[var(--line)]">
              {recent.map(e => {
                const cat  = CATEGORIES.find(c => c.id === e.category) ?? CATEGORIES.find(c => c.id === 'otros') ?? CATEGORIES[0]
                return (
                  <li key={e.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md grid place-items-center text-[14px]" style={{ background: (cat.color ?? '#888') + '20' }}>
                      {cat.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-medium truncate">{e.description}</span>
                        {e.status === 'revisar' && <Badge tone="warn">revisar</Badge>}
                      </div>
                      <div className="text-[11.5px] text-[var(--muted)] mt-0.5 flex items-center gap-1.5">
                        <span>{relDate(e.date)} · {timeOnly(e.date)}</span>
                        <span>·</span>
                        <span>{banks.find(b => b.id === e.bank)?.label}</span>
                        {e.installments > 1 && <><span>·</span><span>{e.installments} cuotas</span></>}
                      </div>
                    </div>
                    <div className="font-mono text-[14px] tabular-nums shrink-0">{fmtCLP(e.amount)}</div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center text-[13px] text-[var(--muted)]">
              Sin gastos registrados aún.{' '}
              <button onClick={() => setView('expenses')} className="underline text-[var(--ink-2)]">Registrar uno</button>
            </div>
          )}
        </Card>

        <Card padding="p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold tracking-tight">Por categoría</div>
            <Badge tone="muted">{catsArr.length}</Badge>
          </div>
          {catsArr.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3.5">
              {catsArr.slice(0, 6).map(c => {
                const cat = CATEGORIES.find(x => x.id === c.id) ?? CATEGORIES[0]
                return (
                  <BarRow key={c.id}
                    label={<span className="inline-flex items-center gap-2"><span>{cat.icon}</span>{cat.label}</span>}
                    value={c.v} max={maxCat} color={cat.color}
                    right={total > 0 ? Math.round((c.v / total) * 100) + '%' : '0%'}
                  />
                )
              })}
            </div>
          ) : (
            <div className="mt-8 text-center text-[13px] text-[var(--muted)]">Sin gastos este mes</div>
          )}
        </Card>

        <Card padding="p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold tracking-tight">Medios de pago</div>
            <Badge tone="muted">{thisMonth.length} ops</Badge>
          </div>
          {thisMonth.length > 0 ? (
            <>
              <div className="mt-4 flex flex-col gap-3.5">
                {[
                  { key: 'credito', label: 'Crédito', icon: 'card' },
                  { key: 'debito',  label: 'Débito',  icon: 'card' },
                  { key: 'efectivo',label: 'Efectivo',icon: 'cash' },
                ].map(m => (
                  <BarRow key={m.key}
                    label={<span className="inline-flex items-center gap-2"><Icon name={m.icon} size={13}/> {m.label}</span>}
                    value={byMethod[m.key]}
                    max={Math.max(1, ...Object.values(byMethod))}
                    color={m.key === 'credito' ? 'var(--ink)' : m.key === 'debito' ? 'var(--accent)' : '#C9A227'}
                    right={total > 0 ? Math.round((byMethod[m.key] / total) * 100) + '%' : '0%'}
                  />
                ))}
              </div>
              <div className="mt-5 pt-5 border-t border-[var(--line)]">
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Por banco</div>
                <div className="mt-3 flex flex-col gap-2.5">
                  {Object.entries(byBank).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, v]) => {
                    const b = banks.find(x => x.id === id)
                    return (
                      <div key={id} className="flex items-center justify-between text-[13px]">
                        <span className="inline-flex items-center gap-2 text-[var(--ink-2)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-2)]"></span>{b?.label ?? id}
                        </span>
                        <span className="font-mono tabular-nums">{fmtCLP(v)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-8 text-center text-[13px] text-[var(--muted)]">Sin operaciones este mes</div>
          )}
        </Card>
      </div>
    </div>
  )
}
