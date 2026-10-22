// WordSteps: early word learning in small steps, for a grown-up and a child
// to use together on a tablet. The home screen picks a set of 4 words and an
// activity; the grown-ups' area (hold the gear) has progress, photos,
// settings and backups.

import * as audio from './audio.js';
import * as store from './store.js';
import * as session from './session.js';
import * as adult from './adult.js';
import * as install from './install.js';
import { ACTIVITIES, statuses } from './engine.js';
import { SETS } from './words.js';
import { h, show, card, holdButton } from './ui.js';
import { VERSION } from './version.js';

const GEAR = '⚙︎';
const ICONS = { look: '👀', match: '🧩', find: '🔎' };

// The first touch anywhere starts sound (iPad needs a tap first).
document.addEventListener('pointerdown', audio.unlock, { once: true, capture: true });
// No pinch or double-tap zoom, no long-press menus, in child mode.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

export async function home() {
  const settings = await store.settings();
  const setId = await store.currentSet();
  const set = SETS.find((s) => s.id === setId) || SETS[0];
  const status = statuses(await store.allTrials());
  const secure = set.words.every((w) => status.find[w.word] === 'secure');

  const levels = {};
  for (const a of ['match', 'find']) levels[a] = await store.level(a, set.id);

  const pick = async (id) => { await store.setCurrentSet(id); home(); };
  const prev = h('button.arrow', { type: 'button', 'aria-label': 'Previous set', disabled: set.id === 1, onclick: () => pick(set.id - 1) }, '‹');
  const next = h('button.arrow', { type: 'button', 'aria-label': 'Next set', disabled: set.id === SETS.length, onclick: () => pick(set.id + 1) }, '›');

  const start = async (activity) => {
    audio.unlock();
    const s = await store.settings();
    const level = activity === 'look' ? null : await store.level(activity, set.id);
    session.run({ activity, set, settings: s, level, onExit: home });
  };

  const tiles = Object.entries(ACTIVITIES).map(([id, a]) => h('button.activity', { type: 'button', onclick: () => start(id) },
    h('span.activity-icon', {}, ICONS[id]),
    h('span.activity-name', {}, a.name),
    h('span.activity-about', {}, a.about),
    id === 'look' ? null : h('span.activity-level', {}, `${levels[id]} picture${levels[id] > 1 ? 's' : ''}`),
  ));

  show(h('div.home', {},
    h('header.home-top', {},
      h('div.brand', {}, 'WordSteps'),
      install.corner(),
      h('div.version', {}, VERSION),
      holdButton('Hold for grown-ups', GEAR, () => adult.open({ onClose: home })),
    ),
    h('section.set', {},
      prev,
      h('div.set-middle', {},
        h('div.set-name', {}, set.name, secure ? h('span.secure', { title: 'All 4 words secure' }, ' ✓') : null),
        h('div.set-words', {}, set.words.map((w) => card(w.word, settings.showWord, { tabIndex: -1, onclick: () => audio.say(w.word) }))),
      ),
      next,
    ),
    h('section.activities', {}, tiles),
  ));
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
home().then(() => {
  // The parents' page links here with ?install to show how to install it.
  if (new URLSearchParams(location.search).has('install') && !install.installed()) install.openGuide();
});
