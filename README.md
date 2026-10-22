# WordSteps

An early word learning app for tablets (a PWA), for a grown-up and a child to
use together. It follows the small-steps teaching approach used by
programmes such as See and Learn, but with its own words, pictures and voice.

- **Sets of 4 words**: 15 starting sets (60 everyday words), each mixing kinds of
  thing so the pictures never look alike.
- **Activities**, in teaching order:
  - **Look and listen**: each picture, big, with its word spoken.
  - **Match**: tap the picture that's the same as the one at the top.
  - **Find**: hear a word and find its picture.
- **Errorless**: a wrong tap is never marked wrong. The right picture pulses
  (and Find says the word again), and the same happens if nothing is tapped
  for a few seconds.
- **Small steps**: Match and Find start with 2 pictures to choose from. After
  each session the number goes up (score of 85% or more right first time) or
  down (under 50%), between 1 and 4.
- **Records**: every answer is saved. A word is *secure* after 6 answers in a
  row that were right first time, without help, with 3 or 4 pictures to choose
  from.
- **Grown-ups** (hold the gear for 1 second):
  - progress for every word, with levels you can set yourself
  - sessions
  - your own photos for words
  - settings
  - backup and restore
- A session is stopped by holding the ✕ for 1 second, so a child's tap does nothing.

Everything is kept on the device (IndexedDB) and works offline once installed
(Share → Add to Home Screen on iPad).

## Files

- `js/words.js` holds the sets.
- `js/engine.js` holds the teaching rules.
- `js/session.js` holds the activity screens.
- `js/adult.js` holds the grown-ups' area.
- `js/store.js` handles storage.
- `js/audio.js` handles sound.
- `media/` holds the pictures and voice, copied from TapTalk (`../taptalk`) by
  `node tools/import-taptalk.mjs`.

Photo-style AI pictures for every word are in `media/ai/`. They were made with
`node tools/make-pictures.mjs`, which uses OpenAI's cheapest image model
(gpt-image-1-mini, low quality, about $0.005 each). It asks for the key in the
terminal and skips words that already have a picture: delete a picture to make
it again. Settings → Pictures switches between AI pictures and symbols.

After changing any file run `node tools/build-precache.mjs`. It rebuilds the
offline file list and the version shown top right.

Run it locally with `python3 -m http.server 8650` (the `wordsteps` entry in
`~/Developer/.claude/launch.json`).

Pictograms by Sergio Palao, from [ARASAAC](https://arasaac.org), CC BY-NC-SA 4.0.
