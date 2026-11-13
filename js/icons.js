const paths = {
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  'layout-dashboard': '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  'credit-card': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  'calendar-days': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/>',
  'chart-no-axes-column': '<path d="M8 20v-8M13 20V4M18 20v-12"/>',
  'settings-2': '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  'lock-keyhole': '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'wallet': '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M16 14h5M3 9h18"/>',
  'calendar-clock': '<path d="M8 2v4M16 2v4M3 10h18M21 13V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7"/><circle cx="18" cy="18" r="4"/><path d="M18 16v2l1 1"/>',
  'layers-2': '<rect x="2" y="2" width="13" height="13" rx="2"/><path d="M8 19h11a2 2 0 0 0 2-2V8"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
  'arrow-right': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  'lightbulb': '<path d="M9 18h6m-5 4h4M9 14c-2-2-3-3-3-6a6 6 0 0 1 12 0c0 3-1 4-3 6l-1 2h-4z"/>',
  'clock-alert': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5m0 4v.01"/>',
  'search': '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'download': '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  'upload': '<path d="M12 17V5m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  'menu': '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  'pencil': '<path d="m14 5 5 5M4 20l4-.8L20 7a2 2 0 0 0-3-3L4.8 16z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7"/>',
  inbox: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l2 3h4l2-3h5"/>'
};

export function icon(name) {
  const body = paths[name] || paths.inbox;
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((element) => {
    element.outerHTML = icon(element.dataset.icon);
  });
}
