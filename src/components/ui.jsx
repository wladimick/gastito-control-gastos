import React from 'react'
import { Icon, fmtCLP, fmtCLPshort } from '../lib/helpers'
import { CATEGORIES } from '../data'

export function Card({ children, className = "", padding = "p-5" }) {
  return (
    <div className={`bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl ${padding} ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, accent, icon }) {
  return (
    <Card padding="p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</div>
        {icon && <div className="text-[var(--muted)]"><Icon name={icon} size={16}/></div>}
      </div>
      <div className="mt-3 font-mono text-[26px] md:text-[30px] tracking-tight leading-none">{value}</div>
      {sub && <div className="mt-2 text-[12px] text-[var(--muted)]">{sub}</div>}
      {accent && <div className="mt-3 h-[3px] rounded-full bg-[var(--line)] overflow-hidden">
        <div className="h-full bg-[var(--accent)]" style={{ width: accent + "%" }}/>
      </div>}
    </Card>
  );
}

export function Badge({ children, tone = "neutral", className = "" }) {
  const tones = {
    neutral: "bg-[var(--hover)] text-[var(--ink-2)]",
    ok:      "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
    warn:    "bg-[var(--amber-soft)] text-[var(--amber-ink)]",
    info:    "bg-[#E6EEF8] text-[#1E4E8A]",
    muted:   "bg-transparent text-[var(--muted)] border border-[var(--line)]",
    dark:    "bg-[var(--ink)] text-[var(--bg)]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-[3px] rounded ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function IconBtn({ name, label, onClick, tone = "ghost", title }) {
  const tones = {
    ghost:   "border border-transparent hover:bg-[var(--hover)] text-[var(--ink-2)]",
    outline: "border border-[var(--line)] hover:bg-[var(--hover)] text-[var(--ink-2)]",
    danger:  "border border-transparent hover:bg-[#FDECEC] text-[#A02828]",
    ok:      "border border-transparent hover:bg-[var(--accent-soft)] text-[var(--accent-ink)]",
  };
  return (
    <button onClick={onClick} title={title || label} aria-label={label}
      className={`w-8 h-8 grid place-items-center rounded-md ${tones[tone]}`}>
      <Icon name={name} size={15}/>
    </button>
  );
}

export function CatChip({ catId, size = "sm" }) {
  const cat = CATEGORIES.find(c => c.id === catId) || CATEGORIES[7];
  const s = size === "sm" ? "text-[11px] px-1.5 py-[2px]" : "text-xs px-2 py-1";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded ${s}`}
          style={{ background: cat.color + "1A", color: "var(--ink)" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }}></span>
      {cat.label}
    </span>
  );
}

export function BarRow({ label, value, max, color = "var(--ink)", right }) {
  const w = max ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
      <div className="min-w-0">
        <div className="flex items-center justify-between text-[12px] mb-1.5">
          <span className="truncate">{label}</span>
          <span className="text-[var(--muted)] font-mono text-[11px]">{right}</span>
        </div>
        <div className="h-[6px] rounded-full bg-[var(--line)] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: w + "%", background: color }}></div>
        </div>
      </div>
      <div className="font-mono text-[13px] tabular-nums tracking-tight">{fmtCLP(value)}</div>
    </div>
  );
}

export function Select({ value, onChange, options, placeholder, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none h-9 pl-3 pr-8 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)]">
        <Icon name="chevdown" size={14}/>
      </span>
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, type = "text", icon, className = "" }) {
  return (
    <div className={`relative flex items-center ${className}`}>
      {icon && <span className="absolute left-2.5 text-[var(--muted)]"><Icon name={icon} size={15}/></span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-9 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)] ${icon ? "pl-8" : "pl-3"} pr-3`}
      />
    </div>
  );
}
