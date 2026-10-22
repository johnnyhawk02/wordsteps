// Small helpers shared by the screens.

import * as store from './store.js';
import { picUrl, aiUrl, slug } from './words.js';

/** h('div.card', { onclick }, child, ...) */
export function h(tag, props = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') for (const [p, val] of Object.entries(v)) el.style.setProperty(p.startsWith('--') ? p : p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), val);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

export const app = () => document.getElementById('app');
export function show(...nodes) { app().replaceChildren(...nodes); }
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Which picture a word shows: a grown-up's photo first, then (when Settings
// chooses them) its AI picture, else its ARASAAC symbol.
const photoUrls = new Map();
let photoSet = null;
let aiSet = null; // slugs with an AI picture (media/ai/index.json)
let useAi = false;
export async function refreshPhotos() {
  for (const u of photoUrls.values()) URL.revokeObjectURL(u);
  photoUrls.clear();
  photoSet = new Set(await store.photoWords().catch(() => []));
  aiSet ??= new Set(await fetch('media/ai/index.json').then((r) => (r.ok ? r.json() : [])).catch(() => []));
  useAi = (await store.settings()).pictures === 'ai';
}
export const hasAiPictures = async () => { if (!aiSet) await refreshPhotos(); return aiSet.size > 0; };
export async function picSrc(word) {
  if (!photoSet) await refreshPhotos();
  if (!photoSet.has(word)) return useAi && aiSet.has(slug(word)) ? aiUrl(word) : picUrl(word);
  if (!photoUrls.has(word)) {
    const data = await store.getPhoto(word);
    if (!data) return picUrl(word);
    photoUrls.set(word, URL.createObjectURL(new Blob([data], { type: 'image/jpeg' })));
  }
  return photoUrls.get(word);
}
export const hasPhoto = (word) => photoSet?.has(word);

/** A picture card: the picture, and the written word when showWord is on. */
export function card(word, showWord, extra = {}) {
  const img = h('img', { alt: '', draggable: false });
  picSrc(word).then((src) => { img.src = src; img.classList.toggle('ai', src.includes('/ai/')); });
  // The inner box fills the button (Safari won't lay out a button's own
  // children as a flex box that fills it).
  return h('button.card', { type: 'button', ...extra, 'aria-label': word, className: showWord ? 'card has-word' : 'card' },
    h('span.card-in', {}, h('span.pic', {}, img), showWord ? h('span.word', {}, word) : null));
}

/**
 * A button that only works when held down (for grown-ups): a ring fills while
 * it's held and fn runs once it's full. A quick tap from a child does nothing.
 */
export function holdButton(label, icon, fn, ms = 1000) {
  let timer = null;
  const btn = h('button.hold', { type: 'button', 'aria-label': label, style: { '--hold': ms + 'ms' } }, h('span.ring'), h('span.icon', {}, icon));
  const cancel = () => { clearTimeout(timer); timer = null; btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.classList.add('holding');
    timer = setTimeout(() => { cancel(); fn(); }, ms);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, cancel);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  return btn;
}

/** Makes a square JPEG (800px) from a chosen photo, centred. */
export async function photoToJpeg(file) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const size = Math.min(800, side);
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  return blob.arrayBuffer();
}
