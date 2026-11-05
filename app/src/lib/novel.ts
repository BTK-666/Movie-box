// Novel reading helpers.
//
// The guest backend exposes no novel service (NovelHub is a signed-in feature of
// the official client), so chapters are produced locally. The generator is
// deterministic: the same book and chapter always yield the same text, which
// keeps reading progress meaningful across sessions.

import type { Novel } from '../data/catalog';

const OPENERS = [
  'The wind carried a warning that no one else seemed to hear.',
  'Morning broke over the ridge like a blade drawn from its sheath.',
  'There are oaths that bind the tongue, and oaths that bind the soul.',
  'The hall fell silent the moment the doors were barred.',
  'Rain had been falling for three days, and still the river rose.',
  'Every road out of the valley was watched, and they all knew it.',
  'The letter had been written in a hand nobody living could claim.',
  'Steel remembers what the hand that wielded it tries to forget.',
  'The bell in the eastern tower rang once, and then refused to ring again.',
  'Snow had buried the pass, and with it any hope of an easy answer.',
  'The market emptied long before the sun went down.',
  'He had rehearsed this moment a thousand times, and still his hands betrayed him.',
  'The fire had burned all night, and no one had dared to sleep.',
  'A stranger arrived at the gate with nothing but a name and a question.',
  'The river ran red that morning, though no one would say why.',
  'She woke to the sound of something breaking far below the house.',
];

const MIDDLES = [
  'She counted her breaths, then her options, and found the second list shorter.',
  'He had spent a lifetime learning when to speak; this, he decided, was not one of those times.',
  'Somewhere below, the city went on with its business, oblivious to what had just been decided.',
  'The old man studied the map as though it might apologise for what it showed.',
  'A single misstep would cost more than pride, and pride was all they had left.',
  'They moved before the thought finished forming, which is how survivors are made.',
  'The wound was clean, which was somehow worse than if it had been ragged.',
  'Promises made in the dark have a way of finding the light.',
  'The corridor narrowed until two could not walk abreast, and the lamps grew thin.',
  'Every door they passed was locked, and every lock had been turned from the inside.',
  'He weighed the cost of honesty against the cost of silence, and chose neither.',
  'The blade was lighter than she remembered, and that frightened her more than the edge.',
  'Outside, the guards changed shifts, and the gap between them was exactly ninety seconds.',
  'She had learned to read faces the way others read weather, and this one promised a storm.',
  'The map ended where the mountains began, which told them everything and nothing.',
  'A name surfaced, unbidden, and with it a debt that had never been settled.',
  'The air carried iron and rain, and beneath it something older.',
  'He counted the footsteps behind him and did not like the number.',
  'The seal broke cleanly, as though it had been waiting to be opened.',
  'They had agreed on a signal, and neither of them used it.',
  'The wound in the wall was fresh, and the dust had not yet settled.',
  'She set the cup down without drinking, which he noticed and said nothing about.',
];

const CLOSERS = [
  'And so the first stone was cast, and the water would never be still again.',
  'By dawn, nothing about the arrangement would look like mercy.',
  'She did not look back, which was the only answer anyone needed.',
  'The gate closed behind them with a sound like a sentence being passed.',
  'Whatever came next, it would not come quietly.',
  'He kept the token close, and told himself it was only caution.',
  'The decision was made, and the making of it could not be undone.',
  'Somewhere far off, a door that had been closed for years began to open.',
  'They would remember this night, though not for the reasons they expected.',
  'The last light went out, and the work began in earnest.',
  'It was not an ending, but it would serve as one for now.',
  'And the debt, like all debts, found its way home.',
];

/** Small deterministic hash so chapter text is stable per (book, chapter). */
function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Chapter {
  no: number;
  title: string;
  paragraphs: string[];
  words: number;
}

const TITLE_WORDS = [
  'Awakening', 'The First Trial', 'Blood Moon', 'Hidden Path', 'The Mentor',
  'Storm Rising', 'Broken Chains', 'Ascension', 'The Long Road', 'Iron Vow',
  'Ashes and Rain', 'The Quiet Blade', 'Crossing Over', 'The Last Gate',
];

export function chapterTitle(novelId: string, no: number): string {
  const h = seedOf(`${novelId}:${no}`);
  return `${TITLE_WORDS[h % TITLE_WORDS.length]} ${no}`;
}

export function chapterOf(novel: Novel, no: number): Chapter {
  const h = seedOf(`${novel.id}:${no}:body`);
  const paragraphs: string[] = [];
  const count = 9 + (h % 5);

  paragraphs.push(OPENERS[h % OPENERS.length]);
  for (let i = 0; i < count; i++) {
    // Stride through the pool with co-prime steps so a chapter rarely repeats a
    // line, while staying fully deterministic for a given (book, chapter).
    const a = MIDDLES[(h + i * 7) % MIDDLES.length];
    const b = MIDDLES[(h + i * 11 + 5) % MIDDLES.length];
    const c = MIDDLES[(h + i * 17 + 9) % MIDDLES.length];
    const sentence = i % 3 === 2 ? `${a} ${b} ${c}` : `${a} ${b}`;
    paragraphs.push(sentence);
  }
  paragraphs.push(CLOSERS[h % CLOSERS.length]);

  const words = paragraphs.reduce((n, p) => n + p.split(/\s+/).length, 0);
  return { no, title: chapterTitle(novel.id, no), paragraphs, words };
}

/* ---------------- Reading progress (localStorage) ---------------- */

const KEY = 'mb-novel-progress';

type Progress = Record<string, { chapter: number; at: number }>;

function readAll(): Progress {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Progress;
  } catch {
    return {};
  }
}

export function getProgress(novelId: string): number {
  return readAll()[novelId]?.chapter ?? 1;
}

export function setProgress(novelId: string, chapter: number) {
  const all = readAll();
  all[novelId] = { chapter, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export function recentNovels(): { id: string; chapter: number; at: number }[] {
  return Object.entries(readAll())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.at - a.at);
}
