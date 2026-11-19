(() => {
  const R = document.querySelector('haus-visualisierung-panel').shadowRoot;
  const main = R.querySelector('.main'); const out = [];
  // Kandidaten: Icons, Textknoten-Elemente (Blätter mit Text), Buttons
  const els = [...main.querySelectorAll('ha-icon, button, span, b, small, .tname, .person, img')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden'; });
  const leaf = els.filter(e => e.tagName === 'HA-ICON' || (e.children.length === 0 && e.textContent.trim()));
  const desc = (e) => { let s = e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''); const p = e.closest('[class]') ; const card = e.closest('.rtile,.rchip,.chip,.ebar,.alerts,.secttitle,.person,.hright,.hbar,.topbar'); return s + (e.getAttribute('icon') ? `[${e.getAttribute('icon')}]` : '') + (e.textContent.trim() ? `"${e.textContent.trim().slice(0,20)}"` : '') + (card ? ' in ' + card.className.split(' ')[0] : ''); };
  for (let i = 0; i < leaf.length; i++) for (let j = i + 1; j < leaf.length; j++) {
    const a = leaf[i], b = leaf[j];
    if (a.contains(b) || b.contains(a)) continue;
    if (a.closest('.persons.stack') && b.closest('.persons.stack')) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ix > 3 && iy > 3) out.push(`${desc(a)}  ×  ${desc(b)}  (${Math.round(ix)}×${Math.round(iy)})`);
  }
  // Überlauf: Inhalte, die aus ihrer Karte ragen
  for (const c of main.querySelectorAll('.rtile,.chip,.rchip,.alerts,.ebar,.glass')) { if (c.scrollWidth > c.clientWidth + 2 && getComputedStyle(c).overflowX !== 'auto') out.push(`Überlauf ${c.className.split(' ').slice(0,2).join('.')} ${c.scrollWidth}>${c.clientWidth}`); }
  return out;
})()
