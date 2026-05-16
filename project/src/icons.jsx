/* Inline SVG icons — line, 1.5px stroke, 16px box by default */
const Icon = ({ name, size = 16, className = "", style = {} }) => {
  const s = size;
  const props = {
    width: s, height: s, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round",
    className, style, "aria-hidden": "true"
  };
  switch (name) {
    case "dashboard": return (
      <svg {...props}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>);
    case "list": return (
      <svg {...props}><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>);
    case "chart": return (
      <svg {...props}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>);
    case "bot": return (
      <svg {...props}><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/><path d="M2 13v2M22 13v2"/></svg>);
    case "inbox": return (
      <svg {...props}><path d="M3 13l2.5-7A2 2 0 017.4 5h9.2a2 2 0 011.9 1.4L21 13M3 13h5a2 2 0 002 2h4a2 2 0 002-2h5M3 13v5a2 2 0 002 2h14a2 2 0 002-2v-5"/></svg>);
    case "settings": return (
      <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>);
    case "search": return (
      <svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>);
    case "edit": return (
      <svg {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>);
    case "trash": return (
      <svg {...props}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>);
    case "check": return (
      <svg {...props}><path d="M4 12l5 5L20 6"/></svg>);
    case "check-circle": return (
      <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>);
    case "x": return (
      <svg {...props}><path d="M6 6l12 12M18 6l-12 12"/></svg>);
    case "plus": return (
      <svg {...props}><path d="M12 5v14M5 12h14"/></svg>);
    case "more": return (
      <svg {...props}><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>);
    case "filter": return (
      <svg {...props}><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></svg>);
    case "chevron-down": return (
      <svg {...props}><path d="M6 9l6 6 6-6"/></svg>);
    case "arrow-right": return (
      <svg {...props}><path d="M5 12h14M13 5l7 7-7 7"/></svg>);
    case "arrow-down-right": return (
      <svg {...props}><path d="M7 7l10 10M17 7v10H7"/></svg>);
    case "arrow-up-right": return (
      <svg {...props}><path d="M7 17L17 7M7 7h10v10"/></svg>);
    case "refresh": return (
      <svg {...props}><path d="M3 12a9 9 0 0115-6.7L21 8M21 4v4h-4M21 12a9 9 0 01-15 6.7L3 16M3 20v-4h4"/></svg>);
    case "power": return (
      <svg {...props}><path d="M12 3v9"/><path d="M5.6 7.6a8 8 0 1012.8 0"/></svg>);
    case "calendar": return (
      <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>);
    case "card": return (
      <svg {...props}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/></svg>);
    case "wallet": return (
      <svg {...props}><path d="M3 7a2 2 0 012-2h12a2 2 0 012 2v2H5a2 2 0 00-2 2V7z"/><rect x="3" y="9" width="18" height="11" rx="2"/><circle cx="17" cy="14.5" r="1.2"/></svg>);
    case "tag": return (
      <svg {...props}><path d="M3 11V4h7l11 11-7 7L3 11z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>);
    case "store": return (
      <svg {...props}><path d="M3 8l2-4h14l2 4M3 8v11a1 1 0 001 1h16a1 1 0 001-1V8M3 8h18M8 8v3a2 2 0 104 0V8M12 8v3a2 2 0 104 0V8"/></svg>);
    case "telegram": return (
      // generic paper-plane-ish bot icon — not Telegram's brand
      <svg {...props}><path d="M21 4L3 11l6 2 2 6 4-5 6-10z"/><path d="M9 13l8-7"/></svg>);
    case "key": return (
      <svg {...props}><circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M17 5l3 3M15 7l3 3"/></svg>);
    case "link": return (
      <svg {...props}><path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 10-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 105.66 5.66l1-1"/></svg>);
    case "globe": return (
      <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>);
    case "menu": return (
      <svg {...props}><path d="M4 6h16M4 12h16M4 18h16"/></svg>);
    case "alert": return (
      <svg {...props}><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.7L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.7a2 2 0 00-3.4 0z"/></svg>);
    case "info": return (
      <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>);
    case "play": return (
      <svg {...props}><path d="M6 4l14 8-14 8V4z"/></svg>);
    case "download": return (
      <svg {...props}><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>);
    case "copy": return (
      <svg {...props}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>);
    case "eye": return (
      <svg {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>);
    case "eye-off": return (
      <svg {...props}><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.5 6.5A17 17 0 002 12s3.5 7 10 7c1.4 0 2.6-.3 3.8-.7"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>);
    case "circle": return (
      <svg {...props}><circle cx="12" cy="12" r="9"/></svg>);
    case "flow": return (
      <svg {...props}><rect x="2" y="9" width="6" height="6" rx="1.5"/><rect x="16" y="9" width="6" height="6" rx="1.5"/><circle cx="12" cy="12" r="2"/><path d="M8 12h2M14 12h2"/></svg>);
    default: return (<svg {...props}><circle cx="12" cy="12" r="8"/></svg>);
  }
};

window.Icon = Icon;
