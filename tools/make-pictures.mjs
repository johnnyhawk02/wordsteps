// Makes a clear photo-style picture for each word with OpenAI's cheapest image
// model (gpt-image-1-mini, low quality: about $0.005 each, ~$0.30 for all 60),
// into media/ai/. Words that already have one are skipped, so it's safe to
// run again; delete a picture to make it again.
//
//   node tools/make-pictures.mjs              every word
//   node tools/make-pictures.mjs dog swing    just these words
//
// Asks for the OpenAI API key without showing it (or reads OPENAI_API_KEY);
// the key is never saved. Options: MODEL=… QUALITY=low|medium|high.
// Afterwards run: node tools/build-precache.mjs

import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { ALL_WORDS, slug } from '../js/words.js';

const OUT = 'media/ai';
const MODEL = process.env.MODEL || 'gpt-image-1-mini';
const QUALITY = process.env.QUALITY || 'low';
const AT_ONCE = 4;

const STYLE = 'A clear, bright photograph of a single everyday object for teaching a young child its name. '
  + 'Only the one subject, whole and centred, filling most of the frame, seen from the side or front in its most typical form. '
  + 'Plain pure white background, soft even light, no shadows to speak of, no other objects, no people unless the subject needs one, '
  + 'no text, letters, logos or numbers.';

// Words whose first pictures were unclear get a fuller description.
const HINTS = {
  cake: 'a round birthday cake with white icing, colourful sprinkles and lit candles',
  bath: 'a white bathtub full of blue water and bubbles, seen from slightly above so the water shows, with a rubber duck in it',
};

async function askKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  process.stdout.write('OpenAI API key (hidden, press Return when done): ');
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  let key = '';
  for await (const chunk of process.stdin) {
    for (const ch of chunk.toString()) {
      if (ch === '\r' || ch === '\n') { process.stdin.setRawMode?.(false); process.stdin.pause(); process.stdout.write('\n'); return key.trim(); }
      if (ch === '\u0003') process.exit(1); // Ctrl-C
      if (ch === '\u007f') key = key.slice(0, -1); else key += ch;
    }
  }
  return key.trim();
}

// New accounts may make only 20 pictures a minute: wait as long as OpenAI asks, then try again.
async function makeOne(key, word, tries = 6) {
  try {
    return await request(key, word);
  } catch (err) {
    const wait = /rate limit/i.test(err.message) && Number(err.message.match(/try again in ([\d.]+)s/i)?.[1] ?? 20);
    if (!wait || tries <= 1) throw err;
    await new Promise((r) => setTimeout(r, (wait + 1 + Math.random() * 3) * 1000));
    return makeOne(key, word, tries - 1);
  }
}

async function request(key, word) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, prompt: `${STYLE}\nSubject: ${HINTS[word] || word}.`, n: 1, size: '1024x1024',
      quality: QUALITY, output_format: 'jpeg', output_compression: 80,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message || `OpenAI said ${res.status}`);
  return Buffer.from(body.data[0].b64_json, 'base64');
}

const asked = process.argv.slice(2).map((w) => w.toLowerCase());
const wanted = ALL_WORDS.map((w) => w.word)
  .filter((w) => !asked.length || asked.includes(w))
  .filter((w) => !existsSync(`${OUT}/${slug(w)}.jpg`));
if (!wanted.length) { console.log('Every word already has a picture.'); process.exit(0); }
console.log(`${wanted.length} pictures to make with ${MODEL} (${QUALITY}), about $${(wanted.length * 0.005).toFixed(2)}.`);

const key = await askKey();
if (!key) { console.error('No key given.'); process.exit(1); }

mkdirSync(OUT, { recursive: true });
const queue = [...wanted];
let done = 0, failed = 0;
await Promise.all(Array.from({ length: AT_ONCE }, async () => {
  for (let w = queue.shift(); w; w = queue.shift()) {
    try {
      writeFileSync(`${OUT}/${slug(w)}.jpg`, await makeOne(key, w));
      console.log(`✓ ${++done}/${wanted.length} ${w}`);
    } catch (err) {
      failed++;
      console.log(`✗ ${w}: ${err.message}`);
      if (/billing|quota|api key|verified|model/i.test(err.message)) queue.length = 0; // no point carrying on
    }
  }
}));

// The list the app reads to know which words have one.
const have = readdirSync(OUT).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)).sort();
writeFileSync(`${OUT}/index.json`, JSON.stringify(have));
console.log(`\n${done} made, ${failed} failed; ${have.length} words have an AI picture.` + (done ? ' Now run: node tools/build-precache.mjs' : ''));
