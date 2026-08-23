import React from 'react'

const BRAND = {
  mercadopago: {
    label: 'Mercado Pago',
    bg: '#FFFFFF',
    fg: '#009EE3',
    border: '#E6E7E3',
    accent: '#FFE600',
    image: 'https://cdn.simpleicons.org/mercadopago/00B1EA',
    fallback: 'MP',
  },
  falabella: {
    label: 'CMR Falabella',
    bg: '#35A936',
    fg: '#FFFFFF',
    border: '#2D922F',
    accent: '#35A936',
    fallback: 'CMR',
  },
  bchile: {
    label: 'Banco de Chile',
    bg: '#003B7A',
    fg: '#FFFFFF',
    border: '#003366',
    accent: '#003B7A',
    fallback: 'BCh',
  },
  bancoestado: {
    label: 'BancoEstado',
    bg: '#FFFFFF',
    fg: '#005BAA',
    border: '#DCE5EE',
    accent: '#F58220',
    fallback: 'BE',
  },
  paypal: {
    label: 'PayPal',
    bg: '#F2F6FF',
    fg: '#003087',
    border: '#DCE6FA',
    accent: '#003087',
    image: 'https://cdn.simpleicons.org/paypal/003087',
    fallback: 'P',
  },
  shopify: {
    label: 'Shopify',
    bg: '#F1F8EC',
    fg: '#5E8E3E',
    border: '#DCEACC',
    accent: '#7AB55C',
    image: 'https://cdn.simpleicons.org/shopify/7AB55C',
    fallback: 'S',
  },
  receivables: {
    label: 'Me deben',
    bg: '#F4F0FF',
    fg: '#6D4CC7',
    border: '#E3D9FF',
    accent: '#7C5CCE',
    fallback: '$',
  },
  accounts: {
    label: 'Cuentas',
    bg: '#F1F1EE',
    fg: '#171715',
    border: '#E2E2DD',
    accent: '#171715',
    fallback: '$',
  },
}

export function brandForCard(card) {
  const key = String(card?.bank || card?.bankId || card?.bank_id || card?.name || '').toLowerCase()
  if (key.includes('falabella') || key.includes('cmr')) return 'falabella'
  if (key.includes('bchile') || key.includes('banco de chile') || key.includes('chile')) return 'bchile'
  if (key.includes('bancoestado') || key.includes('banco estado') || key.includes('cuenta rut')) return 'bancoestado'
  return 'accounts'
}

export function brandMeta(name) {
  return BRAND[name] || BRAND.accounts
}

export default function FinancialBrand({ brand = 'accounts', size = 'md', label = false, className = '' }) {
  const meta = brandMeta(brand)
  const box = size === 'sm' ? 'w-7 h-7 rounded-lg' : size === 'lg' ? 'w-12 h-12 rounded-2xl' : 'w-9 h-9 rounded-xl'
  const imageSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'
  const textSize = size === 'sm' ? 'text-[8px]' : size === 'lg' ? 'text-[12px]' : 'text-[9px]'

  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>
      <span
        className={`${box} shrink-0 grid place-items-center overflow-hidden border shadow-[0_1px_0_rgba(0,0,0,0.03)]`}
        style={{ backgroundColor: meta.bg, color: meta.fg, borderColor: meta.border }}
        aria-label={meta.label}
      >
        {meta.image
          ? <img src={meta.image} alt="" className={`${imageSize} object-contain`} loading="lazy"/>
          : <span className={`${textSize} font-extrabold tracking-[-0.04em]`}>{meta.fallback}</span>}
      </span>
      {label && <span className="truncate text-[11.5px] font-semibold">{meta.label}</span>}
    </span>
  )
}
