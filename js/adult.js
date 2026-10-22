// The grown-ups' area: progress for every word, photos, settings, backup.

import * as audio from './audio.js';
import * as store from './store.js';
import { ACTIVITIES, CHOICE_ACTIVITIES, SECURE_RUN, statuses } from './engine.js';
import { SETS } from './words.js';
import { h, show, card, refreshPhotos, hasPhoto, hasAiPictures, photoToJpeg } from './ui.js';
import { VERSION, BUILT } from './version.js';

const TABS = { progress: 'Progress', words: 'Words and photos', settings: 'Settings', backup: 'Backup', about: 'About' };
let tab = 'progress';

export async function open({ onClose }) {
  const body = h('div.adult-body');
  const nav = h('nav.tabs', {}, Object.entries(TABS).map(([id, name]) => h('button.tab', { type: 'button', 'aria-pressed': String(id === tab), onclick: () => { tab = id; open({ onClose }); } }, name)));
  show(h('div.adult', {},
    h('header.adult-top', {}, h('h1', {}, 'Grown-ups'), h('button.btn', { type: 'button', onclick: onClose }, 'Done')),
    nav, body));
  await ({ progress, words, settings, backup, about })[tab](body);
}

// ---------- Progress ----------

const STATUS_NAME = { new: 'New', practising: 'Practising', secure: 'Secure' };
const fmtDate = (t) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function progress(body) {
  const trials = await store.allTrials();
  const status = statuses(trials);
  const sessions = (await store.allSessions()).sort((a, b) => b.at - a.at);
  const current = await store.currentSet();

  const rows = [];
  for (const set of SETS) {
    const levels = {};
    for (const a of CHOICE_ACTIVITIES) levels[a] = await store.level(a, set.id);
    const stepper = (a) => h('span.stepper', {},
      h('button.step', { type: 'button', 'aria-label': 'Fewer pictures', disabled: levels[a] <= 1, onclick: async () => { await store.setLevel(a, set.id, levels[a] - 1); progress(body); } }, '−'),
      h('span', {}, levels[a]),
      h('button.step', { type: 'button', 'aria-label': 'More pictures', disabled: levels[a] >= 4, onclick: async () => { await store.setLevel(a, set.id, levels[a] + 1); progress(body); } }, '+'));
    rows.push(h('tr', { className: set.id === current ? 'current' : '' },
      h('th', {}, h('button.link', { type: 'button', onclick: async () => { await store.setCurrentSet(set.id); progress(body); } }, set.name)),
      set.words.map((w) => h('td.word-cell', {},
        h('span.word-name', {}, w.word),
        h('span.marks', {}, CHOICE_ACTIVITIES.map((a) => {
          const s = status[a][w.word] || 'new';
          return h(`span.mark.${s}`, { title: `${ACTIVITIES[a].name}: ${STATUS_NAME[s]}` }, ACTIVITIES[a].name[0]);
        })))),
      CHOICE_ACTIVITIES.map((a) => h('td.level', {}, stepper(a))),
    ));
  }

  body.replaceChildren(
    h('p.help', {}, `Each word shows M (Match) and F (Find): grey = new, amber = practising, green = secure (right first time, without help, ${SECURE_RUN} times running with 3 or 4 pictures). The numbers are how many pictures to choose from; WordSteps changes them after each session, or set them here. Tap a set’s name to make it the current set.`),
    h('div.table-wrap', {}, h('table.grid', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Set'), h('th', { colSpan: 4 }, 'Words'), h('th', {}, 'Match'), h('th', {}, 'Find'))),
      h('tbody', {}, rows))),
    h('h2', {}, 'Sessions'),
    sessions.length ? h('div.table-wrap', {}, h('table.sessions', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'When'), h('th', {}, 'Activity'), h('th', {}, 'Set'), h('th', {}, 'Pictures'), h('th', {}, 'Right first time'))),
      h('tbody', {}, sessions.slice(0, 50).map((s) => h('tr', {},
        h('td', {}, fmtDate(s.at)),
        h('td', {}, ACTIVITIES[s.activity].name + (s.early ? ' (stopped)' : '')),
        h('td', {}, `Set ${s.set}`),
        h('td', {}, s.choices ?? '–'),
        h('td', {}, s.score == null ? `${s.questions} pictures seen` : `${Math.round(s.score * s.questions)} of ${s.questions}`),
      ))))) : h('p.empty', {}, 'No sessions yet.'),
  );
}

// ---------- Words and photos ----------

async function words(body) {
  await refreshPhotos();
  const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
  let forWord = null;
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file || !forWord) return;
    try {
      await store.setPhoto(forWord, await photoToJpeg(file));
    } catch (err) {
      alert('That photo couldn’t be used: ' + err.message);
    }
    words(body);
  });

  body.replaceChildren(
    h('p.help', {}, 'Real photos of the child’s own things often work best. Tap a word to hear it; choose a photo to use instead of the symbol (it’s cropped to a square from the middle).'),
    input,
    ...SETS.map((set) => h('section.word-set', {},
      h('h2', {}, set.name),
      h('div.word-grid', {}, set.words.map(({ word }) => h('div.word-item', {},
        card(word, true, { onclick: () => audio.say(word) }),
        h('div.word-actions', {},
          h('button.btn.small', { type: 'button', onclick: () => { forWord = word; input.click(); } }, hasPhoto(word) ? 'Change photo' : 'Use a photo'),
          hasPhoto(word) ? h('button.btn.small.quiet', { type: 'button', onclick: async () => { await store.removePhoto(word); words(body); } }, 'Use symbol') : null,
        )))),
    )),
  );
}

// ---------- Settings ----------

async function settings(body) {
  const s = await store.settings();
  const save = async (k, v) => { s[k] = v; await store.saveSettings(s); };
  const toggle = (k, label, about) => h('label.setting', {},
    h('input', { type: 'checkbox', checked: s[k], onchange: (e) => save(k, e.target.checked) }),
    h('span', {}, h('b', {}, label), h('small', {}, about)));
  const choose = (k, label, about, opts) => h('label.setting', {},
    h('select', { onchange: (e) => save(k, Number(e.target.value)) }, opts.map(([v, t]) => h('option', { value: v, selected: s[k] === v }, t))),
    h('span', {}, h('b', {}, label), h('small', {}, about)));

  const pictures = h('label.setting', {},
    h('select', { onchange: async (e) => { await save('pictures', e.target.value); await refreshPhotos(); } },
      [['ai', 'AI pictures'], ['symbols', 'Symbols']].map(([v, t]) => h('option', { value: v, selected: s.pictures === v }, t))),
    h('span', {}, h('b', {}, 'Pictures'), h('small', {}, 'Photo-style AI pictures, or ARASAAC symbols. Your own photos are always used first.')));

  body.replaceChildren(h('div.settings', {},
    (await hasAiPictures()) ? pictures : null,
    toggle('showWord', 'Show the written word', 'Under each picture, in lower case, ready for reading later.'),
    toggle('rewards', 'Stars and chime', 'A chime and a star for each right answer, and stars at the end.'),
    choose('trials', 'Questions in a session', 'Match and Find. Short sessions work best.', [[4, '4'], [8, '8 (each word twice)'], [12, '12'], [16, '16']]),
    choose('promptAfter', 'Show the answer after', 'If nothing is tapped, the right picture pulses. A wrong tap always shows it.', [[3, '3 seconds'], [6, '6 seconds'], [10, '10 seconds'], [0, 'Never']]),
  ));
}

// ---------- Backup ----------

async function backup(body) {
  const msg = h('p.msg');
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    if (!confirm('Replace everything in WordSteps on this device with this backup?')) return;
    try {
      await store.restore(JSON.parse(await f.text()));
      await refreshPhotos();
      msg.textContent = 'Backup restored.';
    } catch (err) {
      msg.textContent = 'Couldn’t restore: ' + err.message;
    }
  });
  const save = async () => {
    const data = await store.backup();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const name = `wordsteps-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const f = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f] }); msg.textContent = 'Backup shared.'; return; } catch (err) { if (err.name === 'AbortError') return; }
    }
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a);
    a.click();
    a.remove();
    msg.textContent = 'Backup saved.';
  };
  body.replaceChildren(h('div.backup', {},
    h('p.help', {}, 'Progress, settings and photos are kept on this device only. Save a backup now and then (to Files, or email it to yourself), and restore it on a new device.'),
    h('div.row', {}, h('button.btn', { type: 'button', onclick: save }, 'Save a backup'), h('button.btn.quiet', { type: 'button', onclick: () => file.click() }, 'Restore a backup…')),
    file, msg));
}

// ---------- About ----------

async function about(body) {
  body.replaceChildren(h('div.about', {},
    h('p', {}, 'WordSteps teaches early words in small steps: look and listen first, then match identical pictures, then find a picture from its spoken word. Each set has 4 words; begin with 1 or 2 pictures to choose from and let the number grow as the child succeeds. Keep sessions short and fun, sit together, and say each word with the app.'),
    h('p', {}, 'Wrong taps are never marked wrong: the right picture is shown instead, so the child always finishes on a success.'),
    h('p.credit', {}, 'Pictograms by Sergio Palao, from ARASAAC (arasaac.org), Government of Aragón, licensed CC BY-NC-SA 4.0. Voice recorded with OpenAI.'),
    h('p', {}, h('a', { href: 'parents/', target: '_blank' }, 'WordSteps for parents: what it is, how to install it, and a short video')),
    h('p.credit', {}, `Version ${VERSION} · ${BUILT}`),
  ));
}
