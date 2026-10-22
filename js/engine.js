// The teaching rules, kept apart from the screens so they're easy to change.
//
// A session asks about each word in the set the same number of times, in a
// shuffled order that never asks the same word twice running. Choices come
// from the same set: 1 picture (errorless, just tap it) up to all 4.
//
// "Right first time" means the first tap was right and no prompt was needed.
// After a session the level goes up when nearly every answer was right first
// time, and down when fewer than half were, so the child mostly succeeds.

export const ACTIVITIES = {
  look: { name: 'Look and listen', about: 'See each picture and hear its word' },
  match: { name: 'Match', about: 'Put the picture with the one that’s the same' },
  find: { name: 'Find', about: 'Hear a word and find its picture' },
};
export const CHOICE_ACTIVITIES = ['match', 'find'];

export function shuffle(a) {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The order of words for a session of n questions. */
export function order(words, n) {
  const out = [];
  let pool = [];
  while (out.length < n) {
    if (!pool.length) pool = shuffle(words);
    // Never the same word twice running (swap it with a later one).
    if (out.length && pool[0] === out[out.length - 1] && pool.length > 1) [pool[0], pool[1]] = [pool[1], pool[0]];
    out.push(pool.shift());
  }
  return out;
}

/** The pictures to choose from: the target plus distractors, shuffled. */
export function choices(target, words, n) {
  const others = shuffle(words.filter((w) => w !== target)).slice(0, Math.max(0, n - 1));
  return shuffle([target, ...others]);
}

export function rightFirstTime(trials) {
  return trials.length ? trials.filter((t) => t.firstTry && !t.prompted).length / trials.length : 0;
}

export function nextLevel(level, trials) {
  const score = rightFirstTime(trials);
  if (score >= 0.85) return Math.min(4, level + 1);
  if (score < 0.5) return Math.max(1, level - 1);
  return level;
}

// A word is secure in an activity when its last 6 answers were all right first
// time with at least 3 pictures to choose from.
export const SECURE_RUN = 6;
export function wordStatus(trials) {
  if (!trials.length) return 'new';
  const last = trials.slice(-SECURE_RUN);
  if (last.length === SECURE_RUN && last.every((t) => t.firstTry && !t.prompted && t.choices >= 3)) return 'secure';
  return 'practising';
}

/** status[activity][word] from every trial ever saved (oldest first). */
export function statuses(trials) {
  const by = {};
  for (const t of trials.sort((a, b) => a.id - b.id)) ((by[t.activity] ??= {})[t.word] ??= []).push(t);
  const out = {};
  for (const a of CHOICE_ACTIVITIES) {
    out[a] = {};
    for (const [word, ts] of Object.entries(by[a] || {})) out[a][word] = wordStatus(ts);
  }
  return out;
}
