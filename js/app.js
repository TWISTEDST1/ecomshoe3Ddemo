/**
 * STELLA SHOP storefront: catalogue grid with filters, search and sorting, a 3D quick view, a bag
 * and a wishlist kept in localStorage, and the hero / drop / about visuals. Product photos are
 * rendered from the 3D models when the page loads (studio.js), one product at a time so the page
 * stays responsive.
 */
import { PRODUCTS, CATEGORIES, FREE_SHIPPING_FROM, money, byId } from './products.js';
import { photograph, Viewer } from './studio.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------------------------------------
// State (bag and wishlist survive a reload)
// ---------------------------------------------------------------------------------------------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(`stella:${k}`)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`stella:${k}`, JSON.stringify(v)); } catch { /* private mode: keep it in memory */ } },
};
const state = {
  cart: store.get('cart', []).filter((l) => byId(l.id)),
  wish: new Set(store.get('wish', []).filter((id) => byId(id))),
  filter: 'all',
  sort: 'featured',
  query: '',
};
const photos = new Map(); // id -> { main, alt }

// ---------------------------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------------------------
const ANGLES = {
  sneaker: [{ y: -0.55, tilt: 0.28 }, { y: 2.6, tilt: 0.42 }],
  cap: [{ y: -0.5, tilt: 0.16 }, { y: 2.4, tilt: 0.3 }],
  socks: [{ y: 0.35, tilt: 1.0 }, { y: -0.5, tilt: 0.75 }],
  tote: [{ y: -0.4, tilt: 0.18 }, { y: 0.55, tilt: 0.24 }],
};
const PHOTO_SIZE = { w: 560, h: 700 };

async function shoot(p) {
  if (photos.has(p.id)) return photos.get(p.id);
  const [main, alt] = await photograph(p.spec, ANGLES[p.spec.kind].map((a) => ({ ...a, ...PHOTO_SIZE })));
  const pair = { main, alt };
  photos.set(p.id, pair);
  return pair;
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** Fills every <img data-photo="id"> (and data-photo-alt) on the page that has a photo now. */
function paintPhotos() {
  for (const img of $$('img[data-photo]')) {
    const ph = photos.get(img.dataset.photo);
    if (!ph) continue;
    const src = img.dataset.alt != null ? ph.alt : ph.main;
    if (img.getAttribute('src') !== src) img.src = src;
    img.closest('.loading')?.classList.remove('loading');
  }
}

async function shootAll() {
  // The products in view first (the grid's order), then the rest.
  for (const p of sorted(filtered())) { await shoot(p); paintPhotos(); await nextFrame(); }
  for (const p of PRODUCTS) { if (!photos.has(p.id)) { await shoot(p); paintPhotos(); await nextFrame(); } }
  const night = byId('stella-low-night');
  $('#dropImage').src = (await photograph(night.spec, [{ y: -0.5, tilt: 0.22, w: 900, h: 720, pad: 1.0 }]))[0];
}

// ---------------------------------------------------------------------------------------------
// Catalogue: filtering, sorting, rendering
// ---------------------------------------------------------------------------------------------
const FILTERS = [
  { id: 'all', name: 'All', test: () => true },
  { id: 'new', name: 'New in', test: (p) => p.added >= 7 },
  { id: 'sneakers', name: 'Sneakers', test: (p) => p.category === 'sneakers' },
  { id: 'accessories', name: 'Accessories', test: (p) => p.category !== 'sneakers' },
  { id: 'caps', name: 'Caps', test: (p) => p.category === 'caps' },
  { id: 'socks', name: 'Socks', test: (p) => p.category === 'socks' },
  { id: 'bags', name: 'Bags', test: (p) => p.category === 'bags' },
  { id: 'sale', name: 'Sale', test: (p) => !!p.compareAt },
];

function filtered() {
  const f = FILTERS.find((x) => x.id === state.filter) || FILTERS[0];
  const q = state.query.trim().toLowerCase();
  return PRODUCTS.filter((p) => f.test(p) && (!q || `${p.name} ${p.colour} ${p.category}`.toLowerCase().includes(q)));
}
function sorted(list) {
  const l = [...list];
  if (state.sort === 'low') l.sort((a, b) => a.price - b.price);
  if (state.sort === 'high') l.sort((a, b) => b.price - a.price);
  if (state.sort === 'new') l.sort((a, b) => b.added - a.added);
  if (state.sort === 'rating') l.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  return l;
}

function stars(r) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<svg class="${r >= i - 0.25 ? '' : 'off'}" aria-hidden="true"><use href="#i-star"/></svg>`;
  return `<span class="stars" aria-label="${r} out of 5">${s}</span>`;
}
const priceHtml = (p) => p.compareAt
  ? `<span class="price sale">${money(p.price)}<s>${money(p.compareAt)}</s></span>`
  : `<span class="price">${money(p.price)}</span>`;

function renderChips() {
  $('#chips').innerHTML = FILTERS.map((f) => {
    const n = PRODUCTS.filter(f.test).length;
    return `<button class="chip" role="tab" data-chip="${f.id}" aria-selected="${f.id === state.filter}">${f.name}<small>${n}</small></button>`;
  }).join('');
}

function renderGrid() {
  const list = sorted(filtered());
  $('#grid').innerHTML = list.map((p, i) => `
    <article class="card" style="animation-delay:${Math.min(i, 8) * 40}ms">
      <div class="card__frame ${photos.has(p.id) ? '' : 'loading'}" style="--tint:${p.tint}">
        <a class="card__media" href="#" data-quick="${p.id}" aria-label="${esc(p.name)}, ${esc(p.colour)}: quick view">
          <img class="main" data-photo="${p.id}" alt="${esc(p.name)} in ${esc(p.colour)}" width="560" height="700" loading="lazy">
          <img class="alt" data-photo="${p.id}" data-alt alt="" width="560" height="700" loading="lazy">
        </a>
        ${p.badge ? `<span class="badge badge--${p.badge}">${p.badge}</span>` : ''}
        <button class="icon-btn card__wish ${state.wish.has(p.id) ? 'on' : ''}" data-wish="${p.id}" aria-pressed="${state.wish.has(p.id)}" aria-label="Save ${esc(p.name)} to wishlist">${icon(state.wish.has(p.id) ? 'heart-fill' : 'heart')}</button>
        <div class="card__quick"><button class="btn btn--dark btn--block btn--small" data-quick="${p.id}">Quick view</button></div>
      </div>
      <div class="card__body">
        <div><a href="#" class="card__name" data-quick="${p.id}">${esc(p.name)}</a><div class="card__colour">${esc(p.colour)}</div></div>
        ${priceHtml(p)}
      </div>
      <div class="rating">${stars(p.rating)} ${p.rating.toFixed(1)} <span>(${p.reviews})</span></div>
    </article>`).join('');
  const f = FILTERS.find((x) => x.id === state.filter);
  $('#resultCount').textContent = `${list.length} ${list.length === 1 ? 'product' : 'products'}${state.filter !== 'all' ? ` · ${f.name}` : ''}${state.query ? ` · "${state.query}"` : ''}`;
  $('#empty').hidden = list.length > 0;
  $('#emptyTerm').textContent = state.query;
  paintPhotos();
}

function renderCategories() {
  const lead = { sneakers: 'volt-hi-cobalt', caps: 'star-cap-black', socks: 'crew-socks-white', bags: 'tote-natural' };
  $('#cats').innerHTML = CATEGORIES.map((c) => {
    const p = byId(lead[c.id]);
    return `<a class="cat" href="#shop" data-filter="${c.id}" style="background:${p.tint}">
      <img data-photo="${p.id}" alt="" width="640" height="800" loading="lazy">
      <div class="cat__label"><div><strong>${c.name}</strong><span>${c.blurb}</span></div><span class="cat__go">${icon('arrow')}</span></div>
    </a>`;
  }).join('');
  $('#aboutTiles').innerHTML = ['star-cap-cream', 'crew-socks-black'].map((id) => {
    const p = byId(id);
    return `<figure style="--tint:${p.tint}"><img data-photo="${p.id}" alt="${esc(p.name)}" width="640" height="800" loading="lazy"></figure>`;
  }).join('');
}

function setFilter(id, scroll) {
  if (!FILTERS.some((f) => f.id === id)) return;
  state.filter = id;
  renderChips();
  renderGrid();
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.filter === id));
  if (scroll) $('#shop').scrollIntoView({ behavior: 'smooth' });
}

// ---------------------------------------------------------------------------------------------
// Bag and wishlist
// ---------------------------------------------------------------------------------------------
const lineKey = (id, size) => `${id}|${size || ''}`;
function addToCart(id, size, qty = 1) {
  const key = lineKey(id, size);
  const line = state.cart.find((l) => l.key === key);
  if (line) line.qty = Math.min(10, line.qty + qty);
  else state.cart.push({ key, id, size, qty });
  saveCart();
  const p = byId(id);
  toast(`<img src="${photos.get(id)?.main || ''}" alt="" style="--tint:${p.tint}"><span><strong>Added to bag</strong><br>${esc(p.name)}${size ? ` · ${esc(size)}` : ''}</span><button data-open="cart">View bag</button>`);
}
function saveCart() {
  store.set('cart', state.cart);
  renderCart();
  const n = state.cart.reduce((s, l) => s + l.qty, 0);
  const c = $('#cartCount');
  c.hidden = n === 0;
  if (c.textContent !== String(n)) { c.textContent = n; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
}
function renderCart() {
  const sheet = $('#cart');
  sheet.classList.toggle('empty', state.cart.length === 0);
  $('#lines').innerHTML = state.cart.map((l) => {
    const p = byId(l.id);
    return `<li class="line">
      <img data-photo="${p.id}" alt="" style="--tint:${p.tint}" src="${photos.get(p.id)?.main || ''}">
      <div><div class="line__name">${esc(p.name)}</div><div class="line__meta">${esc(p.colour)}${l.size ? ` · Size ${esc(l.size)}` : ''}</div>
        <div class="qty"><button data-dec="${l.key}" aria-label="One less">−</button><span>${l.qty}</span><button data-inc="${l.key}" aria-label="One more">+</button></div></div>
      <div class="line__end"><strong>${money(p.price * l.qty)}</strong><button class="line__remove" data-remove="${l.key}">Remove</button></div>
    </li>`;
  }).join('');
  const subtotal = state.cart.reduce((s, l) => s + byId(l.id).price * l.qty, 0);
  $('#subtotal').textContent = money(subtotal);
  const left = FREE_SHIPPING_FROM - subtotal;
  $('#ship').classList.toggle('done', left <= 0);
  $('#shipText').innerHTML = left > 0 ? `You're <strong>${money(left)}</strong> away from free delivery.` : '<strong>You get free delivery.</strong> Nice.';
  $('#shipBar').style.width = `${Math.min(100, (subtotal / FREE_SHIPPING_FROM) * 100)}%`;
}
function changeQty(key, d) {
  const l = state.cart.find((x) => x.key === key);
  if (!l) return;
  l.qty += d;
  if (l.qty <= 0) state.cart = state.cart.filter((x) => x !== l);
  saveCart();
}

function toggleWish(id) {
  if (state.wish.has(id)) state.wish.delete(id); else state.wish.add(id);
  store.set('wish', [...state.wish]);
  const on = state.wish.has(id);
  for (const b of $$(`[data-wish="${id}"]`)) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = icon(on ? 'heart-fill' : 'heart'); }
  if (current?.id === id) syncQvWish();
  renderWish();
  if (on) toast(`<span><strong>Saved to your wishlist</strong></span><button data-open="wish">View</button>`);
}
function renderWish() {
  const n = state.wish.size, c = $('#wishCount');
  c.hidden = n === 0; c.textContent = n;
  $('#wish').classList.toggle('empty', n === 0);
  $('#wishLines').innerHTML = [...state.wish].map((id) => {
    const p = byId(id);
    return `<li class="line">
      <img data-photo="${p.id}" alt="" style="--tint:${p.tint}" src="${photos.get(p.id)?.main || ''}">
      <div><div class="line__name">${esc(p.name)}</div><div class="line__meta">${esc(p.colour)}</div><div style="margin-top:8px">${priceHtml(p)}</div></div>
      <div class="line__end"><button class="btn btn--small btn--dark" data-quick="${p.id}">View</button><button class="line__remove" data-wish="${p.id}">Remove</button></div>
    </li>`;
  }).join('');
}

// ---------------------------------------------------------------------------------------------
// Quick view
// ---------------------------------------------------------------------------------------------
let qvViewer = null, current = null, qvSize = null, qvQty = 1;
function openQuick(id) {
  const p = byId(id);
  if (!p) return;
  current = p; qvSize = p.sizes.length === 1 ? p.sizes[0] : null; qvQty = 1;
  $('#qvStage').style.setProperty('--tint', p.tint);
  $('#qv-badge').textContent = p.badge || p.category;
  $('#qv-name').textContent = p.name;
  $('#qv-colour').textContent = p.colour;
  const qp = $('#qv-price');
  qp.className = `qv__price${p.compareAt ? ' sale' : ''}`;
  qp.innerHTML = `${money(p.price)}${p.compareAt ? `<s>${money(p.compareAt)}</s>` : ''}`;
  $('#qv-rating').innerHTML = `${stars(p.rating)} ${p.rating.toFixed(1)} · ${p.reviews} reviews`;
  $('#qv-blurb').textContent = p.blurb;
  $('#qv-sizesWrap').hidden = p.sizes.length === 0;
  $('#qv-sizes').innerHTML = p.sizes.map((s) => `<button role="radio" aria-checked="${s === qvSize}" data-size="${esc(s)}">${esc(s)}</button>`).join('');
  $('#qv-sizeErr').hidden = true;
  $('#qty').textContent = qvQty;
  const ph = photos.get(p.id);
  const angles = ANGLES[p.spec.kind];
  $('#qvThumbs').innerHTML = ph ? ['main', 'alt'].map((k, i) => `<button class="${i ? '' : 'on'}" data-angle="${angles[i].y}" aria-label="View ${i ? 'back' : 'front'}"><img src="${ph[k]}" alt=""></button>`).join('') : '';
  syncQvWish();
  openLayer('quick');
  if (!qvViewer) qvViewer = new Viewer($('#qvCanvas'), { spin: 0.25, pad: 1.05, tilt: 0.3 });
  qvViewer.show(p.spec, angles[0].y);
}
function syncQvWish() {
  const on = state.wish.has(current.id), b = $('#qvWish');
  b.classList.toggle('on', on);
  b.innerHTML = icon(on ? 'heart-fill' : 'heart');
  b.setAttribute('aria-pressed', on);
}

// ---------------------------------------------------------------------------------------------
// Layers (drawers, modal), toast
// ---------------------------------------------------------------------------------------------
let lastFocus = null;
function openLayer(id) {
  $$('.sheet.open, .modal.open').forEach((el) => el.id !== id && closeLayer(el.id, true));
  const el = $(`#${id}`);
  lastFocus = document.activeElement;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => el.querySelector('[data-close]')?.focus(), 50);
  if (id === 'menu') $('#burger').setAttribute('aria-expanded', 'true');
}
function closeLayer(id, quiet) {
  const el = $(`#${id}`);
  if (!el.classList.contains('open')) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  if (!$('.sheet.open, .modal.open')) document.body.style.overflow = '';
  if (id === 'menu') $('#burger').setAttribute('aria-expanded', 'false');
  if (!quiet) lastFocus?.focus?.();
}
let toastTimer = 0;
function toast(html) {
  const t = $('#toast');
  t.innerHTML = html;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------------------------------------------------------------------------------------------
// Events (one delegated listener for the whole page)
// ---------------------------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  const t = e.target;
  const quick = t.closest('[data-quick]');
  if (quick) { e.preventDefault(); openQuick(quick.dataset.quick); return; }
  const wish = t.closest('[data-wish]');
  if (wish) { e.preventDefault(); toggleWish(wish.dataset.wish); return; }
  const filterLink = t.closest('[data-filter]');
  if (filterLink) {
    e.preventDefault();
    closeLayer('menu', true);
    setFilter(filterLink.dataset.filter, true);
    return;
  }
  const chip = t.closest('[data-chip]');
  if (chip) { setFilter(chip.dataset.chip, false); return; }
  const open = t.closest('[data-open]');
  if (open) { openLayer(open.dataset.open); return; }
  const close = t.closest('[data-close]');
  if (close) { const layer = close.closest('.sheet, .modal'); if (layer) closeLayer(layer.id); return; }
  if (t.matches('.sheet, .modal')) { closeLayer(t.id); return; }
  if (t.closest('[data-inc]')) return changeQty(t.closest('[data-inc]').dataset.inc, 1);
  if (t.closest('[data-dec]')) return changeQty(t.closest('[data-dec]').dataset.dec, -1);
  if (t.closest('[data-remove]')) { state.cart = state.cart.filter((l) => l.key !== t.closest('[data-remove]').dataset.remove); return saveCart(); }
  const size = t.closest('[data-size]');
  if (size) {
    qvSize = size.dataset.size;
    $$('#qv-sizes button').forEach((b) => b.setAttribute('aria-checked', b === size));
    $('#qv-sizeErr').hidden = true;
    return;
  }
  const angle = t.closest('[data-angle]');
  if (angle && qvViewer) {
    qvViewer.yaw = Number(angle.dataset.angle); qvViewer.vel = 0;
    $$('#qvThumbs button').forEach((b) => b.classList.toggle('on', b === angle));
  }
});

$('#openCart').addEventListener('click', () => openLayer('cart'));
$('#openWish').addEventListener('click', () => openLayer('wish'));
$('#burger').addEventListener('click', () => openLayer('menu'));
$('#qtyMinus').addEventListener('click', () => { qvQty = Math.max(1, qvQty - 1); $('#qty').textContent = qvQty; });
$('#qtyPlus').addEventListener('click', () => { qvQty = Math.min(10, qvQty + 1); $('#qty').textContent = qvQty; });
$('#qvWish').addEventListener('click', () => toggleWish(current.id));
$('#addToBag').addEventListener('click', () => {
  if (current.sizes.length && !qvSize) {
    $('#qv-sizeErr').hidden = false;
    const s = $('#qv-sizes'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake');
    return;
  }
  addToCart(current.id, qvSize, qvQty);
  closeLayer('quick');
});
$('#checkout').addEventListener('click', () => toast('<span><strong>This is a demo store.</strong><br>Checkout isn’t connected to payments.</span>'));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const top = $$('.sheet.open, .modal.open').pop();
  if (top) closeLayer(top.id);
});

let searchTimer = 0;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = e.target.value;
    renderGrid();
    if (state.query && window.scrollY < $('#shop').offsetTop - 200) $('#shop').scrollIntoView({ behavior: 'smooth' });
  }, 160);
});
$('#sort').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });

$('#newsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#newsEmail'), msg = $('#newsMsg');
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
  msg.className = `news__msg ${ok ? 'ok' : 'bad'}`;
  msg.textContent = ok ? 'You’re in. Your code STELLA10 is on its way.' : 'Please enter a valid email address.';
  if (ok) input.value = '';
});

const header = $('.header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// The Night drop closes at the end of this week (Sunday, 23:59 local time).
function tickCountdown() {
  const now = new Date(), end = new Date(now);
  end.setDate(now.getDate() + ((7 - now.getDay()) % 7));
  end.setHours(23, 59, 59, 0);
  let s = Math.max(0, Math.floor((end - now) / 1000));
  const parts = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
  for (const [u, v] of Object.entries(parts)) $(`[data-u="${u}"]`).textContent = String(v).padStart(2, '0');
}
setInterval(tickCountdown, 1000);
tickCountdown();

// ---------------------------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------------------------
$('#year').textContent = new Date().getFullYear();
$('#menuLinks').innerHTML = $$('.nav a').map((a) => a.outerHTML).join('');
renderChips();
renderGrid();
renderCategories();
saveCart();
renderWish();

const hero = new Viewer($('#heroCanvas'), { spin: 0.45, pad: 1.1, tilt: 0.24 });
hero.show(byId('volt-hi-cobalt').spec);

(async () => {
  await nextFrame();
  await shootAll();
  $('#heroThumb').src = photos.get('volt-hi-cobalt').main;
  paintPhotos();
  renderCart();
  renderWish();
  // Screenshot hook: ?at=shop jumps to a section once everything is drawn (?open=<id> opens quick view).
  const q = new URLSearchParams(location.search);
  if (q.get('at')) { document.documentElement.style.scrollBehavior = 'auto'; document.getElementById(q.get('at'))?.scrollIntoView(); }
  if (q.get('open')) openQuick(q.get('open'));
  if (q.get('bag')) { addToCart('volt-hi-cobalt', '42'); addToCart('crew-socks-white', 'M (40–43)', 2); openLayer('cart'); }
  // Tells screenshot tools the catalogue is ready.
  if (q.has('test')) console.log('BLOOMRESULT:' + encodeURIComponent(JSON.stringify({ kind: 'perf', photos: photos.size })));
})();

// Debug/test handle.
window.__stella = { state, photos, openQuick, setFilter };
