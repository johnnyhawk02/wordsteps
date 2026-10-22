// Installing WordSteps and keeping it offline.
//
// Android (Chrome and friends) offers a real install prompt, which we keep
// for the Install button. iPad Safari has no prompt a page can trigger, so
// the button shows the Share → Add to Home Screen steps instead. Installing
// matters on iPad: Safari may clear a website's data if it isn't opened for a
// week or so, but not an app on the Home Screen.

import { h } from './ui.js';
import { VERSION } from './version.js';

let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
window.addEventListener('appinstalled', () => { deferred = null; });

export const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const safari = () => /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/.test(navigator.userAgent);

/** Ask the browser to keep our data even when space runs low (where it lets us). */
export async function persist() {
  try { return (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false; } catch { return false; }
}

/**
 * How much of WordSteps is saved on this device: { have, total } files from
 * the offline list (precache.js), or null where offline isn't supported.
 */
export async function offlineStatus() {
  if (!('caches' in window) || !navigator.serviceWorker) return null;
  try {
    const text = await (await fetch('precache.js', { cache: 'no-cache' })).text();
    const list = JSON.parse(text.match(/self\.PRECACHE = (\[[\s\S]*?\]);/)[1]);
    const cache = await caches.open('wordsteps-' + VERSION);
    let have = 0;
    for (const url of list) if (await cache.match(url, { ignoreSearch: true })) have++;
    return { have, total: list.length };
  } catch {
    return null;
  }
}

const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const icon = (svg) => { const s = h('span.share-icon'); s.innerHTML = svg; return s; };

/** The Install button's sheet: the real prompt where there is one, else the steps. */
export function openGuide() {
  const close = () => { overlay.remove(); };
  let body;
  if (deferred) {
    body = [
      h('p', {}, 'Put WordSteps on this tablet like an app. It opens full screen and works without Wi-Fi.'),
      h('button.btn', { type: 'button', onclick: async () => { const e = deferred; deferred = null; e.prompt(); await e.userChoice.catch(() => {}); close(); } }, 'Install WordSteps'),
    ];
  } else if (ios()) {
    body = [
      safari() ? null : h('p.warn', {}, 'On iPad this only works in Safari. Open this page in Safari first.'),
      h('ol.guide-steps', {},
        h('li', {}, 'Tap the ', h('b', {}, 'Share'), ' button ', icon(SHARE), ' at the top of Safari.'),
        h('li', {}, 'Scroll down and tap ', h('b', {}, 'Add to Home Screen'), '.'),
        h('li', {}, 'Tap ', h('b', {}, 'Add'), '. Then open WordSteps from its icon on the Home Screen.')),
      h('p.small', {}, 'Once it’s on the Home Screen, Safari keeps its progress and photos safe even if it isn’t opened for a while.'),
    ];
  } else {
    body = [
      h('ol.guide-steps', {},
        h('li', {}, 'Open the browser’s ', h('b', {}, 'menu'), ' (⋮ or ⋯).'),
        h('li', {}, 'Tap ', h('b', {}, 'Install app'), ' or ', h('b', {}, 'Add to Home screen'), '.')),
      h('p.small', {}, 'Chrome on Android tablets installs it best.'),
    ];
  }
  const overlay = h('div.overlay', { onclick: (e) => { if (e.target === overlay) close(); } },
    h('div.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Install WordSteps' },
      h('h2', {}, 'Install WordSteps'),
      body,
      h('button.btn.quiet', { type: 'button', onclick: close }, 'Close')));
  document.body.append(overlay);
}

/**
 * The home screen's corner: an Install button (until it's installed) and
 * whether everything is saved for offline. Updates itself while it's shown.
 */
export function corner() {
  const status = h('span.offline', { role: 'status' });
  const btn = installed() ? null : h('button.install', { type: 'button', onclick: openGuide }, 'Install');
  const box = h('div.corner', {}, status, btn);
  const check = async () => {
    if (!box.isConnected) return;
    const s = await offlineStatus();
    if (!s) { status.textContent = ''; return; }
    const ready = s.have === s.total;
    status.textContent = ready ? '✓ Ready offline' : navigator.onLine ? 'Saving for offline…' : 'Not saved for offline yet';
    status.classList.toggle('ready', ready);
    if (ready) persist(); else setTimeout(check, 2000);
  };
  setTimeout(check, 300);
  return box;
}
