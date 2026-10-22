// Copies each word's ARASAAC picture and its Coral recording from TapTalk
// (../taptalk) into media/, named after the word. Run after changing js/words.js:
//   node tools/import-taptalk.mjs
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync } from 'node:fs';
import { ALL_WORDS, picUrl, voiceUrl } from '../js/words.js';

const TAPTALK = '../taptalk/symbols';
const voiceFile = (text) => createHash('sha1').update(text.trim().toLowerCase()).digest('hex').slice(0, 20) + '.mp3';

const missing = [];
for (const { word, pic } of ALL_WORDS) {
  const from = { pic: `${TAPTALK}/arasaac/${pic}.png`, voice: `${TAPTALK}/voice/coral/${voiceFile(word)}` };
  if (existsSync(from.pic)) copyFileSync(from.pic, picUrl(word)); else missing.push(`${word} (picture)`);
  if (existsSync(from.voice)) copyFileSync(from.voice, voiceUrl(word)); else missing.push(`${word} (voice)`);
}
// Phrases the app says itself.
for (const text of ['all done', 'well done']) {
  const from = `${TAPTALK}/voice/coral/${voiceFile(text)}`;
  if (existsSync(from)) copyFileSync(from, voiceUrl(text)); else missing.push(`"${text}" (voice)`);
}
console.log(`${ALL_WORDS.length} words copied` + (missing.length ? `; missing: ${missing.join(', ')}` : ''));
