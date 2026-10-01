/**
 * The STELLA SHOP catalogue. Every product is one of the code-built models in a colourway; the
 * photos are rendered from the same model at start-up (see studio.js).
 */

export const CURRENCY = { symbol: '$', code: 'USD' };
export const FREE_SHIPPING_FROM = 100;

export const money = (n) => `${CURRENCY.symbol}${n.toFixed(2)}`;

const SNEAKER_SIZES = ['39', '40', '41', '42', '43', '44', '45', '46'];

export const CATEGORIES = [
  { id: 'sneakers', name: 'Sneakers', blurb: 'High-tops and lows' },
  { id: 'caps', name: 'Caps', blurb: 'Six-panel classics' },
  { id: 'socks', name: 'Socks', blurb: 'Cushioned crews' },
  { id: 'bags', name: 'Bags', blurb: 'Heavy canvas totes' },
];

export const PRODUCTS = [
  {
    id: 'volt-hi-cobalt', name: 'Volt Rider Hi', colour: 'Cobalt / Cream', category: 'sneakers', price: 129, badge: 'New',
    rating: 4.8, reviews: 214, tint: '#e7ecfb', added: 9,
    blurb: 'Our signature high-top in full-grain leather, with a padded collar, a cushioned midsole and the STELLA sparkle stitched on both sides.',
    sizes: SNEAKER_SIZES,
    spec: { kind: 'sneaker', cw: { base: '#f4efe4', accent: '#2456e6', collar: '#1b1d24', panel: '#2456e6', mark: '#ffc93c', sole: '#fbfaf6', outsole: '#2456e6' } },
  },
  {
    id: 'volt-hi-ember', name: 'Volt Rider Hi', colour: 'Ember / Black', category: 'sneakers', price: 139,
    rating: 4.9, reviews: 167, tint: '#f8e6dc', added: 7,
    blurb: 'The high-top in a deep black leather with ember-orange overlays and a gum-toned outsole. Built for nights out.',
    sizes: SNEAKER_SIZES,
    spec: { kind: 'sneaker', cw: { base: '#26272c', accent: '#ff6a2b', collar: '#111216', panel: '#ff6a2b', mark: '#ffd9b8', keyline: '#111216', sole: '#f3ede2', outsole: '#b5703a', stitch: 'rgba(255,255,255,.45)' } },
  },
  {
    id: 'volt-hi-mint', name: 'Volt Rider Hi', colour: 'Mint / Cloud', category: 'sneakers', price: 129, compareAt: 159, badge: 'Sale',
    rating: 4.7, reviews: 98, tint: '#e2f4ee', added: 4,
    blurb: 'Soft mint suede overlays on a cloud-white base. A spring colourway at its lowest price of the season.',
    sizes: SNEAKER_SIZES,
    spec: { kind: 'sneaker', cw: { base: '#fbfbf8', accent: '#7fd8c0', collar: '#3d5a52', panel: '#7fd8c0', mark: '#3d5a52', keyline: '#3d5a52', sole: '#ffffff', outsole: '#7fd8c0' } },
  },
  {
    id: 'stella-low-cloud', name: 'Stella Low', colour: 'Cloud / Stone', category: 'sneakers', price: 109, badge: 'Bestseller',
    rating: 4.9, reviews: 532, tint: '#eeeeec', added: 2,
    blurb: 'The everyday low in tonal white and stone. Clean enough for the office, tough enough for the weekend.',
    sizes: SNEAKER_SIZES,
    spec: { kind: 'sneaker', low: true, cw: { base: '#fafaf7', accent: '#c9c4b8', collar: '#8f8a80', panel: '#e9e6df', mark: '#c9c4b8', keyline: '#8f8a80', sole: '#ffffff', outsole: '#c9c4b8', stitch: 'rgba(0,0,0,.25)' } },
  },
  {
    id: 'stella-low-sunset', name: 'Stella Low', colour: 'Sunset / Cream', category: 'sneakers', price: 109,
    rating: 4.6, reviews: 141, tint: '#fbe6e1', added: 6,
    blurb: 'Coral overlays, a cream base and a warm gum outsole. The colour of the last hour of light.',
    sizes: SNEAKER_SIZES,
    spec: { kind: 'sneaker', low: true, cw: { base: '#f6efe3', accent: '#ef6a52', collar: '#7a2f24', panel: '#ef6a52', mark: '#ffd166', keyline: '#7a2f24', sole: '#fbf6ec', outsole: '#c98a52' } },
  },
  {
    id: 'stella-low-night', name: 'Stella Low', colour: 'Midnight / Gold', category: 'sneakers', price: 119, badge: 'Limited',
    rating: 5.0, reviews: 61, tint: '#e2e4ef', added: 10,
    blurb: 'Midnight navy nubuck with gold details. Numbered pairs from the Night drop.',
    sizes: SNEAKER_SIZES,
    spec: { kind: 'sneaker', low: true, cw: { base: '#1d2340', accent: '#11152a', collar: '#0b0e1c', panel: '#2a3260', mark: '#e8b84a', keyline: '#0b0e1c', sole: '#f2ede0', outsole: '#e8b84a', lace: '#e8b84a', stitch: 'rgba(232,184,74,.6)' } },
  },
  {
    id: 'star-cap-black', name: 'Star Cap', colour: 'Washed Black', category: 'caps', price: 34,
    rating: 4.8, reviews: 203, tint: '#e9e9ea', added: 5,
    blurb: 'A six-panel cotton twill cap with an embroidered STELLA patch and an adjustable strap.',
    sizes: ['One size'],
    spec: { kind: 'cap', cw: { crown: '#2a2b30', brim: '#2a2b30', under: '#3b6b4f', patch: '#f4efe4', logo: '#2a2b30', stitch: 'rgba(255,255,255,.35)' } },
  },
  {
    id: 'star-cap-cream', name: 'Star Cap', colour: 'Cream / Cobalt', category: 'caps', price: 34, badge: 'New',
    rating: 4.7, reviews: 88, tint: '#f4f0e6', added: 8,
    blurb: 'Our cap in natural cream twill with a cobalt brim and a matching patch.',
    sizes: ['One size'],
    spec: { kind: 'cap', cw: { crown: '#f1ead9', brim: '#2456e6', under: '#2456e6', patch: '#2456e6', logo: '#f1ead9', button: '#2456e6', stitch: 'rgba(0,0,0,.25)' } },
  },
  {
    id: 'crew-socks-white', name: 'Crew Socks', colour: 'White / Red stripe · 2-pack', category: 'socks', price: 18,
    rating: 4.9, reviews: 410, tint: '#f6e9e8', added: 3,
    blurb: 'Cushioned combed-cotton crews with a ribbed cuff, sport stripes and a reinforced heel and toe.',
    sizes: ['S (36–39)', 'M (40–43)', 'L (44–47)'],
    spec: { kind: 'socks', cw: { body: '#f7f6f2', stripes: ['#e8432e', '#1b1d24'], heel: '#e8432e' } },
  },
  {
    id: 'crew-socks-black', name: 'Crew Socks', colour: 'Black / Gold stripe · 2-pack', category: 'socks', price: 18,
    rating: 4.8, reviews: 176, tint: '#ecebe6', added: 1,
    blurb: 'The same cushioned crews in black with gold stripes.',
    sizes: ['S (36–39)', 'M (40–43)', 'L (44–47)'],
    spec: { kind: 'socks', cw: { body: '#24252a', stripes: ['#e8b84a', '#f4efe4'], heel: '#e8b84a' } },
  },
  {
    id: 'tote-natural', name: 'Stella Tote', colour: 'Natural canvas', category: 'bags', price: 29,
    rating: 4.8, reviews: 122, tint: '#f1ece2', added: 2,
    blurb: '14 oz cotton canvas, long handles and a screen-printed sparkle. Fits a laptop and a pair of sneakers.',
    sizes: [],
    spec: { kind: 'tote', cw: { body: '#ece3d0', print: '#1b1d24', handle: '#d9cdb3' } },
  },
  {
    id: 'tote-black', name: 'Stella Tote', colour: 'Black canvas', category: 'bags', price: 29, compareAt: 35, badge: 'Sale',
    rating: 4.7, reviews: 74, tint: '#e7e6e3', added: 6,
    blurb: 'The tote in black canvas with a cream print.',
    sizes: [],
    spec: { kind: 'tote', cw: { body: '#25262b', print: '#f4efe4', handle: '#1a1b1f' } },
  },
];

export const byId = (id) => PRODUCTS.find((p) => p.id === id);
