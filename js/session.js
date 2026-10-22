// A teaching session, full screen: nothing on it reacts except the pictures,
// and a grown-up leaves by holding the corner button.
//
// Errorless: a wrong tap does nothing to the picture tapped; instead the right
// picture gently pulses (and in Find the word is said again). If nothing is
// tapped for a while the same prompt appears. The child always ends on a
// right answer.

import * as audio from './audio.js';
import * as store from './store.js';
import { ACTIVITIES, choices, nextLevel, order, rightFirstTime } from './engine.js';
import { h, show, wait, card, holdButton } from './ui.js';

const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const svg = (markup) => { const s = h('span.svg'); s.innerHTML = markup; return s; };

export async function run({ activity, set, settings, level, onExit }) {
  const words = set.words.map((w) => w.word);
  audio.preload(words);
  const n = activity === 'look' ? words.length * 2 : settings.trials;
  const queue = order(words, n);
  const trials = [];
  let stopped = false;

  const progress = h('div.progress', {}, queue.map(() => h('span.dot')));
  const stage = h('div.stage');
  const exit = holdButton('Hold to stop', '✕', () => { stopped = true; audio.stop(); finish(true); });
  show(h('div.session', { 'data-activity': activity }, h('div.topbar', {}, exit, progress), stage));

  const mark = (i, star) => {
    const dot = progress.children[i];
    dot.classList.add('done');
    if (star && settings.rewards) dot.classList.add('star');
  };

  let finished = false;
  async function finish(early) {
    if (finished) return;
    finished = true;
    const session = { activity, set: set.id, at: Date.now(), questions: activity === 'look' ? queue.length : trials.length, early, choices: activity === 'look' ? null : level };
    if (activity !== 'look') session.score = rightFirstTime(trials);
    let next = level;
    if (!early && activity !== 'look') {
      next = nextLevel(level, trials);
      await store.setLevel(activity, set.id, next);
    }
    if (trials.length || (activity === 'look' && !early)) await store.saveSession(session, trials);
    if (early) onExit();
    else done({ activity, stars: session.questions, level, next, onExit, settings });
  }

  for (let i = 0; i < queue.length && !stopped; i++) {
    const word = queue[i];
    if (activity === 'look') await lookAt(stage, word, settings);
    else trials.push(await ask(stage, activity, word, choices(word, words, level), settings));
    if (stopped) return;
    mark(i, true);
  }
  if (!stopped) finish(false);
}

// ---------- Look and listen ----------

function lookAt(stage, word, settings) {
  return new Promise((resolve) => {
    const big = card(word, settings.showWord, { onclick: () => audio.say(word) });
    big.classList.add('big');
    const next = h('button.next', { type: 'button', 'aria-label': 'Next', onclick: () => resolve() }, svg(NEXT));
    stage.replaceChildren(h('div.look', {}, big, next));
    wait(250).then(() => audio.say(word));
  });
}

// ---------- Match and Find ----------

function ask(stage, activity, word, options, settings) {
  return new Promise((resolve) => {
    const started = Date.now();
    let taps = 0, firstTry = true, prompted = false, answered = false, promptTimer = null;

    const target = activity === 'match'
      ? h('div.slot', {}, card(word, settings.showWord, { tabIndex: -1, disabled: true }))
      : h('button.speaker', { type: 'button', 'aria-label': 'Say it again', onclick: () => audio.say(word) }, svg(SPEAKER));
    const cards = options.map((w) => card(w, settings.showWord));
    const right = cards[options.indexOf(word)];
    const row = h('div.choices', { style: { '--n': options.length } }, cards);
    stage.replaceChildren(h('div.ask', {}, h('div.target', {}, target), row));

    const prompt = () => {
      if (answered || !stage.isConnected) return;
      prompted = true;
      right.classList.remove('pulse');
      void right.offsetWidth; // restart the animation
      right.classList.add('pulse');
      if (activity === 'find') audio.say(word);
    };
    const armPrompt = () => {
      clearTimeout(promptTimer);
      if (settings.promptAfter > 0) promptTimer = setTimeout(prompt, settings.promptAfter * 1000);
    };

    cards.forEach((c, i) => c.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      if (answered) return;
      taps++;
      if (options[i] !== word) { firstTry = false; prompt(); armPrompt(); return; }
      answered = true;
      clearTimeout(promptTimer);
      row.classList.add('answered');
      c.classList.remove('pulse');
      c.classList.add('right');
      if (activity === 'match') flyTo(c, target.firstChild);
      if (settings.rewards) audio.chime();
      await wait(settings.rewards ? 350 : 0);
      await audio.say(word);
      await wait(600);
      resolve({ activity, word, choices: options.length, firstTry, prompted, taps, ms: Date.now() - started, at: Date.now() });
    }));

    if (activity === 'find') wait(400).then(() => { if (!answered) audio.say(word); });
    armPrompt();
  });
}

// The chosen picture slides onto the one it matches.
function flyTo(from, to) {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  from.style.transform = `translate(${dx}px, ${dy}px) scale(${b.width / a.width})`;
  from.classList.add('flying');
  to.parentElement.classList.add('matched');
}

// ---------- All done ----------

function done({ activity, stars, level, next, onExit, settings }) {
  const note = activity === 'look' ? '' : next > level ? `Next time: ${next} pictures` : next < level ? `Next time: ${next} picture${next > 1 ? 's' : ''}` : '';
  const home = h('button.big-btn', { type: 'button', onclick: onExit }, 'Home');
  show(h('div.done', {},
    settings.rewards ? h('div.burst', {}, Array.from({ length: Math.min(stars, 12) }, (_, i) => h('span.burst-star', { style: { '--i': i, '--n': Math.min(stars, 12) } }, '★'))) : null,
    h('div.big-star', {}, '★'),
    h('h1', {}, 'All done!'),
    home,
    note ? h('p.note', {}, note) : null,
  ));
  if (settings.rewards) audio.chime();
  audio.say('all done');
}

export const activityName = (a) => ACTIVITIES[a].name;
