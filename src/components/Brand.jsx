import React from 'react'

export function GastitoIcon({ size = 40, light = false }) {
  const navy  = '#1B2B3A'
  const bg    = light ? navy : 'transparent'
  const gFill  = light ? 'white' : navy
  const gPunch = light ? navy   : 'white'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="9" fill={bg}/>
      <circle cx="20" cy="20" r="13" fill={gFill}/>
      <circle cx="20" cy="20" r="7.5" fill={gPunch}/>
      <rect x="20" y="7" width="13" height="26" fill={gPunch}/>
      <rect x="20" y="17" width="12" height="6" fill={gFill}/>
      <polygon points="20,7 33,7 33,17" fill="#3DD68C"/>
    </svg>
  )
}

export function GastitoLogo({ light = false, size = 'md', className = '' }) {
  const color = light ? '#FFFFFF' : '#1B2B3A'
  const configs = {
    sm: { iconSize: 28, fontSize: 18 },
    md: { iconSize: 36, fontSize: 22 },
    lg: { iconSize: 48, fontSize: 30 },
  }
  const { iconSize, fontSize } = configs[size] ?? configs.md
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <GastitoIcon size={iconSize} light={light}/>
      <span style={{ fontFamily: "'Manrope', system-ui, sans-serif", fontSize, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>
        Gastito
      </span>
    </div>
  )
}
