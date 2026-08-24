import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { financialHelpFor } from '../lib/financialHelp'
import { Icon, fmtCLP } from '../lib/helpers'
import { CATEGORIES } from '../data'


export function InfoTip({ content, label = 'Explicar este dato' }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 12, top: 12, above: false })
  const triggerRef = useRef(null)
  const tooltipRef = useRef(null)
  const tooltipId = useRef(`gastito-help-${Math.random().toString(36).slice(2)}`)

  const updatePosition = () => {
    const trigger = triggerRef.current
    if (!trigger || typeof window === 'undefined') return
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(288, window.innerWidth - 24)
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2))
    const above = window.innerHeight - rect.bottom < 170 && rect.top > 180
    setPosition({
      left,
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
      width,
    })
  }

  useEffect(() => {
    if (!open) return undefined
    updatePosition()

    const closeOnOutside = event => {
      if (triggerRef.current?.contains(event.target) || tooltipRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    const reposition = () => updatePosition()

    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  if (!content) return null

  const toggle = event => {
    event.preventDefault()
    event.stopPropagation()
    setOpen(value => !value)
  }

  const tooltip = open && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId.current}
          role="tooltip"
          className="fixed z-[140] rounded-xl border border-[#2A2A28] bg-[#151514] px-3.5 py-3 text-left text-white shadow-2xl"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            transform: position.above ? 'translateY(-100%)' : 'none',
          }}
        >
          <div className="text-[9px] uppercase tracking-[0.12em] text-white/50 font-bold">¿Qué significa?</div>
          <div className="mt-1.5 text-[11px] leading-relaxed text-white/88 normal-case tracking-normal font-normal">{content}</div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId.current : undefined}
        onClick={toggle}
        onPointerDown={event => event.stopPropagation()}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={event => {
          if (!tooltipRef.current?.contains(event.relatedTarget)) setOpen(false)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') toggle(event)
          if (event.key === 'Escape') setOpen(false)
        }}
        className="inline-grid w-[17px] h-[17px] shrink-0 place-items-center rounded-full border border-current/25 text-[10px] font-bold leading-none opacity-65 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-current/20 cursor-help normal-case tracking-normal"
      >
        i
      </span>
      {tooltip}
    </>
  )
}

export function Card({ children, className = '', padding = 'p-5' }) {
  return (
    <div className={`bg-[var(--bg-elev)] border border-[var(--line)] rounded-2xl shadow-[0_1px_0_rgba(20,20,18,0.02)] ${padding} ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, accent, icon, tone = 'default', info }) {
  const help = info || financialHelpFor(label);
  const toneClass = tone === 'dark'
    ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent'
    : tone === 'violet'
      ? 'bg-violet-50 text-violet-950 border-violet-100'
      : ''
  return (
    <Card padding="p-4 md:p-5" className={toneClass}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5"><div className="text-[10px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>{help && <InfoTip content={help}/>}</div>
        {icon && <div className="opacity-55"><Icon name={icon} size={15}/></div>}
      </div>
      <div className="mt-3 font-mono text-[24px] md:text-[28px] font-semibold tracking-tight leading-none">{value}</div>
      {sub && <div className="mt-2 text-[11px] opacity-65 leading-relaxed">{sub}</div>}
      {accent != null && (
        <div className="mt-3 h-1.5 rounded-full bg-black/5 overflow-hidden">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(0, Math.min(100, accent))}%` }}/>
        </div>
      )}
    </Card>
  )
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-[var(--hover)] text-[var(--ink-2)]',
    ok: 'bg-[var(--accent-soft)] text-[var(--accent-ink)]',
    warn: 'bg-[var(--amber-soft)] text-[var(--amber-ink)]',
    info: 'bg-[#E8F1FB] text-[#23568E]',
    muted: 'bg-transparent text-[var(--muted)] border border-[var(--line)]',
    dark: 'bg-[var(--ink)] text-[var(--bg)]',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

export function IconBtn({ name, label, onClick, tone = 'ghost', title }) {
  const tones = {
    ghost: 'border border-transparent hover:bg-[var(--hover)] text-[var(--ink-2)]',
    outline: 'border border-[var(--line)] hover:bg-[var(--hover)] text-[var(--ink-2)]',
    danger: 'border border-transparent hover:bg-[#FDECEC] text-[#A02828]',
    ok: 'border border-transparent hover:bg-[var(--accent-soft)] text-[var(--accent-ink)]',
  }
  return (
    <button type="button" onClick={onClick} title={title || label} aria-label={label}
      className={`w-11 h-11 grid place-items-center rounded-xl transition-colors ${tones[tone]}`}>
      <Icon name={name} size={14}/>
    </button>
  )
}

export function CatChip({ catId, size = 'sm' }) {
  const category = CATEGORIES.find(item => item.id === catId) || CATEGORIES.find(item => item.id === 'otros')
  const spacing = size === 'sm' ? 'text-[10px] px-2 py-1' : 'text-xs px-2.5 py-1.5'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${spacing}`}
      style={{ background: `${category.color}1A`, color: 'var(--ink)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: category.color }}/>
      {category.label}
    </span>
  )
}

export function BarRow({ label, value, max, color = 'var(--ink)', right }) {
  const width = max ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
      <div className="min-w-0">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="truncate">{label}</span>
          <span className="text-[var(--muted)] font-mono text-[10px]">{right}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }}/>
        </div>
      </div>
      <div className="font-mono text-[12px] tabular-nums tracking-tight">{fmtCLP(value)}</div>
    </div>
  )
}

export function Select({ value, onChange, options, placeholder, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={event => onChange(event.target.value)}
        className="w-full appearance-none h-10 pl-3 pr-8 bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl text-[11px] focus:outline-none focus:border-[var(--ink)]">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"><Icon name="chevdown" size={13}/></span>
    </div>
  )
}

export function BankLogo({ bank, size = 'md' }) {
  const dimensions = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'
  if (bank?.logoUrl) {
    return <img src={bank.logoUrl} alt={bank.label || ''} className={`${dimensions} rounded-lg object-contain border border-[var(--line)] bg-white p-0.5 shrink-0`}/>
  }
  const letter = (bank?.label || '?')[0].toUpperCase()
  const background = bank?.color ? `${bank.color}20` : 'var(--hover)'
  const foreground = bank?.color || 'var(--ink-2)'
  return (
    <div className={`${dimensions} rounded-lg grid place-items-center shrink-0 font-bold`}
      style={{ background, color: foreground, border: `1.5px solid ${foreground}30` }}>
      <span className={size === 'sm' ? 'text-[9px]' : 'text-[11px]'}>{letter}</span>
    </div>
  )
}

export function TextInput({ value, onChange, placeholder, type = 'text', icon, className = '' }) {
  return (
    <div className={`relative flex items-center ${className}`}>
      {icon && <span className="absolute left-3 text-[var(--muted)]"><Icon name={icon} size={14}/></span>}
      <input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}
        className={`w-full h-10 bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl text-[11px] focus:outline-none focus:border-[var(--ink)] ${icon ? 'pl-9' : 'pl-3'} pr-3`}/>
    </div>
  )
}

export function PageIntro({ eyebrow, description, actions }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        {eyebrow && <div className="text-[10px] uppercase tracking-[.12em] font-bold text-[var(--muted)]">{eyebrow}</div>}
        {description && <p className="text-[11px] text-[var(--muted)] mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <Card padding="p-10" className="text-center">
      <div className="text-[26px]">{icon}</div>
      <div className="text-[13px] font-semibold mt-3">{title}</div>
      {description && <div className="text-[10.5px] text-[var(--muted)] mt-1">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}
