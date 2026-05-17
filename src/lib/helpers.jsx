import React from 'react'

export const fmtCLP = (n) => "$" + Math.round(n).toLocaleString("es-CL");
export const fmtCLPshort = (n) => {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000)     return "$" + Math.round(n / 1000) + "k";
  return "$" + n;
};
export const parseDate = (s) => new Date(s);
export const MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
export const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

export const relDate = (iso) => {
  const today = new Date();
  const d = new Date(iso);
  const diff = Math.round((new Date(today).setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff < 7)   return DIAS[new Date(iso).getDay()];
  const dx = new Date(iso);
  return `${dx.getDate()} ${MES[dx.getMonth()]}`;
};

export const timeOnly = (iso) => {
  const x = new Date(iso);
  return `${String(x.getHours()).padStart(2,"0")}:${String(x.getMinutes()).padStart(2,"0")}`;
};

export const monthOf = (iso) => {
  const x = new Date(iso);
  return `${MES[x.getMonth()]} ${x.getFullYear()}`;
};

export const sameMonth = (iso, ref) => {
  const a = new Date(iso); const b = new Date(ref);
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
};

export const Icon = ({ name, size = 18, className = "" }) => {
  const s = size;
  const props = {
    width: s, height: s, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round",
    className,
  };
  switch (name) {
    case "home":     return <svg {...props}><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>;
    case "list":     return <svg {...props}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
    case "chart":    return <svg {...props}><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>;
    case "settings": return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case "bot":      return <svg {...props}><rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><path d="M8 14h.01M16 14h.01"/><path d="M9 17h6"/></svg>;
    case "message":  return <svg {...props}><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>;
    case "alert":    return <svg {...props}><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.86a2 2 0 0 1 3.4 0l8.5 14.14a2 2 0 0 1-1.7 3H3.5a2 2 0 0 1-1.7-3z"/></svg>;
    case "search":   return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case "plus":     return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case "pencil":   return <svg {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>;
    case "trash":    return <svg {...props}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>;
    case "check":    return <svg {...props}><path d="M20 6L9 17l-5-5"/></svg>;
    case "x":        return <svg {...props}><path d="M18 6L6 18M6 6l12 12"/></svg>;
    case "filter":   return <svg {...props}><path d="M22 3H2l8 9.5V19l4 2v-8.5z"/></svg>;
    case "calendar": return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
    case "card":     return <svg {...props}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>;
    case "cash":     return <svg {...props}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>;
    case "menu":     return <svg {...props}><path d="M3 6h18M3 12h18M3 18h18"/></svg>;
    case "send":     return <svg {...props}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>;
    case "refresh":  return <svg {...props}><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>;
    case "link":     return <svg {...props}><path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 1 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 1 0 7 7l1.5-1.5"/></svg>;
    case "trend":    return <svg {...props}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>;
    case "wallet":   return <svg {...props}><path d="M20 12V8a2 2 0 0 0-2-2H5a3 3 0 0 1-3-3v15a3 3 0 0 0 3 3h13a2 2 0 0 0 2-2v-4"/><circle cx="17" cy="14" r="1.5"/></svg>;
    case "tag":      return <svg {...props}><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2"/></svg>;
    case "bank":     return <svg {...props}><path d="M3 10l9-6 9 6"/><path d="M5 10v9M9 10v9M15 10v9M19 10v9"/><path d="M3 21h18"/></svg>;
    case "info":     return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>;
    case "chevron":  return <svg {...props}><path d="M9 18l6-6-6-6"/></svg>;
    case "chevdown": return <svg {...props}><path d="M6 9l6 6 6-6"/></svg>;
    case "dot":      return <svg {...props}><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>;
    case "target":   return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>;
    case "repeat":   return <svg {...props}><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
    case "history":  return <svg {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>;
    case "scale":    return <svg {...props}><path d="M6 3v18"/><path d="M18 3v18"/><path d="M2 9h8"/><path d="M14 9h8"/><path d="M6 9l-3 6a3 3 0 0 0 6 0z"/><path d="M18 9l-3 6a3 3 0 0 0 6 0z"/></svg>;
    case "arrowdn":  return <svg {...props}><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>;
    case "arrowup":  return <svg {...props}><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>;
    case "income":   return <svg {...props}><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>;
    case "expense":  return <svg {...props}><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>;
    case "more":     return <svg {...props}><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></svg>;
    case "power":    return <svg {...props}><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/><path d="M12 2v10"/></svg>;
    case "layers":   return <svg {...props}><path d="M12 2l10 5-10 5L2 7z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/></svg>;
    case "users":    return <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "person":   return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case "savings":  return <svg {...props}><ellipse cx="12" cy="7" rx="8" ry="3"/><path d="M4 7v4c0 1.66 3.58 3 8 3s8-1.34 8-3V7"/><path d="M4 11v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4"/></svg>;
    default:         return null;
  }
};
