// The starting vocabulary: 60 everyday words taught in sets of 4. Each set
// mixes kinds of thing (an animal, a food, a toy, something at home) so the
// pictures in a set never look alike.
//
// Each word is [word, ARASAAC picture id]. The picture and the recorded voice
// are copied into media/ by tools/import-taptalk.mjs, from TapTalk's bundle.

export const SETS = [
  [['ball', 2269], ['dog', 2517], ['apple', 2462], ['car', 2339]],
  [['cat', 2406], ['banana', 2530], ['book', 2450], ['bed', 2304]],
  [['duck', 2563], ['shoes', 24801], ['bubbles', 6945], ['teddy', 4945]],
  [['milk', 2445], ['fish', 2520], ['bath', 2272], ['spoon', 2362]],
  [['horse', 2294], ['cake', 2502], ['train', 2603], ['coat', 27978]],
  [['pig', 2327], ['biscuit', 8312], ['bus', 2262], ['bowl', 3257]],
  [['cow', 2609], ['cheese', 2541], ['bike', 2277], ['towel', 2593]],
  [['sheep', 2489], ['egg', 2427], ['doll', 2482], ['kite', 2350]],
  [['bird', 2490], ['bread', 2494], ['balloon', 2407], ['tree', 3057]],
  [['rabbit', 2351], ['juice', 11461], ['blocks', 4921], ['sofa', 2571]],
  [['frog', 2543], ['yogurt', 2618], ['puzzle', 2540], ['water', 2248]],
  [['lion', 2449], ['strawberry', 2400], ['scooter', 2508], ['soap', 2964]],
  [['elephant', 2372], ['grapes', 3247], ['slide', 4759], ['pencil', 2440]],
  [['tiger', 2590], ['pizza', 2527], ['swing', 4608], ['scissors', 6664]],
  [['giraffe', 2437], ['sandwich', 2281], ['dinosaur', 2738], ['fork', 2588]],
].map((words, i) => ({ id: i + 1, name: `Set ${i + 1}`, words: words.map(([word, pic]) => ({ word, pic })) }));

export const ALL_WORDS = SETS.flatMap((s) => s.words);
export const slug = (word) => word.toLowerCase().replace(/[^a-z0-9]+/g, '-');
export const picUrl = (word) => `media/pics/${slug(word)}.png`;
export const aiUrl = (word) => `media/ai/${slug(word)}.jpg`; // made by tools/make-pictures.mjs
export const voiceUrl = (word) => `media/voice/${slug(word)}.mp3`;
