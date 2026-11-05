export type MediaType = 'movie' | 'tv' | 'anime' | 'short' | 'live' | 'novel';

export interface Title {
  id: string;
  title: string;
  year: number;
  rating: number;
  genres: string[];
  type: MediaType;
  synopsis: string;
  poster: string;
  backdrop: string;
  duration?: string;
  episodes?: number;
  quality?: '4K' | '1080p' | '720p';
  trending?: boolean;
  newRelease?: boolean;
  country?: string;
}

export interface Episode {
  id: string;
  no: number;
  title: string;
  duration: string;
  thumb: string;
  progress?: number; // 0..1
}

export interface Rail {
  id: string;
  title: string;
  items: string[];
}

export interface CategoryTab {
  id: string;
  name: string;
}

export interface Novel {
  id: string;
  title: string;
  author: string;
  cover: string;
  chapters: number;
  rating: number;
  genres: string[];
  synopsis: string;
}

export interface Channel {
  id: string;
  name: string;
  logo: string;
  category: string;
  now: string;
  progress: number;
}

export interface FightEvent {
  id: string;
  title: string;
  promotion: string;
  date: string;
  thumb: string;
  live: boolean;
  main: string;
}

export interface ShortVideo {
  id: string;
  title: string;
  show: string;
  thumb: string;
  likes: string;
  episode: number;
}

/** UTF-8 safe base64 (btoa alone breaks on non-Latin1 input). */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64 = (str: string) => {
  const bytes = new TextEncoder().encode(str);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : B64[b2 & 63];
  }
  return out;
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const PALETTES: [string, string, string][] = [
  ['#ff6a2b', '#ff2d78', '#2a0d1a'],
  ['#3a7bff', '#00d4ff', '#071a2b'],
  ['#8b5cf6', '#ec4899', '#1a0a24'],
  ['#00c896', '#0ea5e9', '#04231d'],
  ['#f59e0b', '#ef4444', '#2a1206'],
  ['#22d3ee', '#a78bfa', '#0a1a2a'],
  ['#f43f5e', '#7c3aed', '#24091a'],
  ['#84cc16', '#14b8a6', '#12210a'],
  ['#eab308', '#f97316', '#2a1c04'],
  ['#6366f1', '#22d3ee', '#0b0f2a'],
];

/** Deterministic, offline-safe generative artwork as an inline SVG data URI. */
const art = (seed: string, w: number, h: number) => {
  const n = hash(seed);
  const [c1, c2, bg] = PALETTES[n % PALETTES.length];
  const angle = n % 360;
  const cx = 25 + (n % 50);
  const cy = 20 + ((n >> 3) % 55);
  const r1 = Math.round(Math.min(w, h) * (0.42 + ((n >> 5) % 30) / 100));
  const r2 = Math.round(Math.min(w, h) * (0.22 + ((n >> 7) % 26) / 100));
  const op = 0.55 + ((n >> 9) % 30) / 100;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>` +
    `<linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>` +
    `</linearGradient>` +
    `<radialGradient id="v" cx="50%" cy="40%" r="75%">` +
    `<stop offset="0" stop-color="${bg}" stop-opacity="0"/><stop offset="1" stop-color="${bg}" stop-opacity="0.85"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="${bg}"/>` +
    `<rect width="${w}" height="${h}" fill="url(#g)" opacity="${op.toFixed(2)}"/>` +
    `<circle cx="${(cx / 100) * w}" cy="${(cy / 100) * h}" r="${r1}" fill="${c1}" opacity="0.5"/>` +
    `<circle cx="${((100 - cx) / 100) * w}" cy="${((100 - cy) / 100) * h}" r="${r2}" fill="#ffffff" opacity="0.18"/>` +
    `<rect width="${w}" height="${h}" fill="url(#v)"/>` +
    `</svg>`;
  // base64 keeps the CSS url() token intact; percent-encoded SVG with
  // gradient defs is rejected by Chromium's CSS parser.
  return `data:image/svg+xml;base64,${base64(svg)}`;
};

const img = (seed: string, w = 400, h = 600) => art(seed, w, h);

const wide = (seed: string, w = 800, h = 450) => art(seed, w, h);

/** Public helper so any screen can render offline-safe artwork. */
export const artwork = (seed: string, w = 200, h = 200) => art(seed, w, h);

const poster = (seed: string, w = 400, h = 600) => img(seed, w, h);
const backdrop = (seed: string) => wide(seed);

function make(
  id: string,
  title: string,
  opts: Partial<Title> = {},
): Title {
  return {
    id,
    title,
    year: opts.year ?? 2024,
    rating: opts.rating ?? 7.5,
    genres: opts.genres ?? ['Action', 'Adventure'],
    type: opts.type ?? 'movie',
    synopsis:
      opts.synopsis ??
      'A gripping story that follows unlikely heroes as they confront impossible odds, uncover hidden truths, and fight for what matters most.',
    poster: poster(id),
    backdrop: backdrop(id),
    duration: opts.duration,
    episodes: opts.episodes,
    quality: opts.quality ?? '1080p',
    trending: opts.trending,
    newRelease: opts.newRelease,
    country: opts.country,
  };
}

export const TITLES: Title[] = [
  make('t01', 'Shadow Protocol', { year: 2025, rating: 8.7, genres: ['Action', 'Thriller'], quality: '4K', trending: true, newRelease: true, duration: '2h 08m' }),
  make('t02', 'Neon Horizon', { year: 2024, rating: 8.1, genres: ['Sci-Fi', 'Drama'], quality: '4K', trending: true, duration: '1h 54m' }),
  make('t03', 'The Last Ember', { year: 2025, rating: 7.9, genres: ['Fantasy', 'Adventure'], trending: true, duration: '2h 21m' }),
  make('t04', 'Crimson Tide Rising', { year: 2023, rating: 8.3, genres: ['Crime', 'Drama'], duration: '1h 47m' }),
  make('t05', 'Silent Frequency', { year: 2024, rating: 7.4, genres: ['Mystery', 'Sci-Fi'], duration: '1h 38m' }),
  make('t06', 'Kingdom of Ash', { year: 2025, rating: 8.9, genres: ['Drama', 'History'], quality: '4K', trending: true, newRelease: true, duration: '2h 45m' }),
  make('t07', 'Midnight Runners', { year: 2024, rating: 7.1, genres: ['Action', 'Comedy'], duration: '1h 52m' }),
  make('t08', 'Echoes of Tomorrow', { year: 2025, rating: 8.5, genres: ['Sci-Fi', 'Romance'], quality: '4K', newRelease: true, duration: '2h 02m' }),
  make('t09', 'The Vanishing Point', { year: 2023, rating: 7.7, genres: ['Thriller', 'Mystery'], duration: '1h 59m' }),
  make('t10', 'Solar Dynasty', { year: 2024, rating: 8.0, genres: ['Sci-Fi', 'Action'], duration: '2h 14m' }),
  make('t11', 'Whispers in the Fog', { year: 2025, rating: 7.6, genres: ['Horror', 'Mystery'], newRelease: true, duration: '1h 44m' }),
  make('t12', 'Iron Verdict', { year: 2024, rating: 8.2, genres: ['Action', 'Crime'], duration: '2h 06m' }),
  make('t13', 'Paper Moons', { year: 2023, rating: 7.3, genres: ['Drama', 'Romance'], duration: '1h 41m' }),
  make('t14', 'Gravity Well', { year: 2025, rating: 8.4, genres: ['Sci-Fi', 'Thriller'], quality: '4K', newRelease: true, duration: '2h 17m' }),
  make('t15', 'The Grand Heist', { year: 2024, rating: 7.8, genres: ['Crime', 'Comedy'], duration: '1h 56m' }),
  make('t16', 'Aurora Rising', { year: 2025, rating: 8.6, genres: ['Fantasy', 'Action'], quality: '4K', trending: true, duration: '2h 32m' }),
  make('t17', 'Deep Current', { year: 2023, rating: 7.2, genres: ['Adventure', 'Drama'], duration: '2h 04m' }),
  make('t18', 'Fractured Light', { year: 2024, rating: 8.1, genres: ['Drama', 'Mystery'], duration: '1h 49m' }),
  make('t19', 'Steel Covenant', { year: 2025, rating: 7.9, genres: ['Action', 'War'], newRelease: true, duration: '2h 19m' }),
  make('t20', 'Lunar Bloom', { year: 2024, rating: 7.5, genres: ['Animation', 'Family'], duration: '1h 36m' }),

  // TV
  make('tv01', 'Broken Empire', { type: 'tv', year: 2024, rating: 9.1, genres: ['Drama', 'Crime'], episodes: 8, quality: '4K', trending: true, newRelease: true, country: 'US' }),
  make('tv02', 'The Hollow Crown Chronicles', { type: 'tv', year: 2025, rating: 8.8, genres: ['Fantasy', 'Drama'], episodes: 10, quality: '4K', trending: true, country: 'UK' }),
  make('tv03', 'Zero Day Protocol', { type: 'tv', year: 2024, rating: 8.4, genres: ['Thriller', 'Sci-Fi'], episodes: 6, country: 'US' }),
  make('tv04', 'Seoul Nights', { type: 'tv', year: 2025, rating: 8.6, genres: ['Romance', 'Drama'], episodes: 16, country: 'KR', newRelease: true }),
  make('tv05', 'Detective Rao', { type: 'tv', year: 2024, rating: 8.2, genres: ['Crime', 'Mystery'], episodes: 12, country: 'IN' }),
  make('tv06', 'The Silent Ward', { type: 'tv', year: 2023, rating: 7.9, genres: ['Horror', 'Mystery'], episodes: 8, country: 'US' }),
  make('tv07', 'Tokyo Requiem', { type: 'tv', year: 2025, rating: 8.7, genres: ['Anime', 'Action'], episodes: 24, country: 'JP', newRelease: true }),
  make('tv08', 'Highland Legacy', { type: 'tv', year: 2024, rating: 8.0, genres: ['History', 'Drama'], episodes: 8, country: 'UK' }),

  // Anime
  make('an01', 'Blade of the Crimson Moon', { type: 'anime', year: 2025, rating: 9.0, genres: ['Anime', 'Action'], episodes: 12, quality: '4K', trending: true, newRelease: true, country: 'JP' }),
  make('an02', 'Spirit Academy', { type: 'anime', year: 2024, rating: 8.5, genres: ['Anime', 'Fantasy'], episodes: 24, country: 'JP' }),
  make('an03', 'Mecha Genesis Zero', { type: 'anime', year: 2025, rating: 8.8, genres: ['Anime', 'Sci-Fi'], episodes: 13, country: 'JP', newRelease: true }),
  make('an04', 'Cherry Blossom Diary', { type: 'anime', year: 2023, rating: 8.1, genres: ['Anime', 'Romance'], episodes: 12, country: 'JP' }),
  make('an05', 'Dragon Pact Rebirth', { type: 'anime', year: 2025, rating: 8.9, genres: ['Anime', 'Adventure'], episodes: 26, country: 'JP', trending: true }),

  // Shorts
  make('sh01', 'CEO\'s Secret Bride', { type: 'short', year: 2025, rating: 7.8, genres: ['Romance', 'Drama'], episodes: 80, newRelease: true }),
  make('sh02', 'Reborn as the Heiress', { type: 'short', year: 2025, rating: 8.2, genres: ['Drama', 'Fantasy'], episodes: 96, trending: true }),
  make('sh03', 'The Billionaire\'s Revenge', { type: 'short', year: 2024, rating: 7.5, genres: ['Drama'], episodes: 72 }),
  make('sh04', 'My Werewolf Roommate', { type: 'short', year: 2025, rating: 7.9, genres: ['Romance', 'Fantasy'], episodes: 60, newRelease: true }),
];

export const TITLE_BY_ID: Record<string, Title> = Object.fromEntries(
  TITLES.map((t) => [t.id, t]),
);

export const HOME_TABS: CategoryTab[] = [
  { id: 'trending', name: 'Trending' },
  { id: 'movie', name: 'Movie' },
  { id: 'tv', name: 'TV' },
  { id: 'short', name: 'ShortTV' },
  { id: 'live', name: 'Live' },
  { id: 'anime', name: 'Anime' },
  { id: 'kids', name: 'Kids' },
  { id: 'education', name: 'Education' },
  { id: 'music', name: 'Music' },
];

export const RAILS: Record<string, Rail[]> = {
  trending: [
    { id: 'r1', title: '🔥 Trending Now', items: ['t01', 'tv01', 'an01', 't06', 'tv02', 'an05', 't16', 't03'] },
    { id: 'r2', title: 'New Releases', items: ['t08', 't14', 'tv04', 'an03', 'sh02', 't11', 't19', 't09'] },
    { id: 'r3', title: 'Top 10 in Your Area', items: ['t01', 'tv01', 't06', 'an01', 't16', 'tv02', 't10', 't12', 'an05', 't03'] },
    { id: 'r4', title: 'Because you watched Shadow Protocol', items: ['t02', 't05', 't09', 't14', 't18', 'tv03'] },
  ],
  movie: [
    { id: 'm1', title: 'Blockbuster Movies', items: ['t01', 't03', 't06', 't10', 't12', 't16', 't19', 't20'] },
    { id: 'm2', title: 'Action & Adventure', items: ['t07', 't12', 't16', 't19', 't03', 't17'] },
    { id: 'm3', title: 'Sci-Fi Collection', items: ['t02', 't05', 't08', 't10', 't14'] },
    { id: 'm4', title: 'Critically Acclaimed', items: ['t04', 't13', 't18', 't06', 't09'] },
  ],
  tv: [
    { id: 't1', title: 'Binge-Worthy Series', items: ['tv01', 'tv02', 'tv04', 'tv05', 'tv07', 'tv08'] },
    { id: 't2', title: 'Crime & Mystery', items: ['tv05', 'tv03', 'tv06', 'tv01'] },
    { id: 't3', title: 'K-Drama Picks', items: ['tv04', 'tv02', 'tv08'] },
  ],
  anime: [
    { id: 'a1', title: 'Top Anime', items: ['an01', 'an05', 'an03', 'an02', 'an04'] },
    { id: 'a2', title: 'Simulcast Season', items: ['an01', 'an03', 'an05'] },
    { id: 'a3', title: 'Classics', items: ['an02', 'an04'] },
  ],
  short: [
    { id: 's1', title: 'Trending Shorts', items: ['sh02', 'sh01', 'sh04', 'sh03'] },
    { id: 's2', title: 'Romance', items: ['sh01', 'sh04'] },
    { id: 's3', title: 'Revenge & Drama', items: ['sh03', 'sh02'] },
  ],
  kids: [
    { id: 'k1', title: 'For Kids', items: ['t20', 'an04', 'an02'] },
  ],
  education: [
    { id: 'e1', title: 'Learn Something New', items: ['t18', 'tv08', 't04'] },
  ],
  music: [
    { id: 'mu1', title: 'Music & Concerts', items: ['tv08', 't13', 't20'] },
  ],
  live: [],
};

export const NOVELS: Novel[] = [
  { id: 'n1', title: 'The Immortal Ascension', author: 'Lin Wei', cover: poster('n1'), chapters: 1284, rating: 4.8, genres: ['Xianxia', 'Action'], synopsis: 'A mortal boy defies the heavens to walk the path of immortals.' },
  { id: 'n2', title: 'CEO, Please Let Go', author: 'Su Ran', cover: poster('n2'), chapters: 642, rating: 4.6, genres: ['Romance', 'Drama'], synopsis: 'A contract marriage spirals into something neither expected.' },
  { id: 'n3', title: 'Reborn in the Apocalypse', author: 'Zhao Kun', cover: poster('n3'), chapters: 890, rating: 4.7, genres: ['Sci-Fi', 'Survival'], synopsis: 'He returns to day zero with one chance to rewrite everything.' },
  { id: 'n4', title: 'Academy of Shadows', author: 'Mira Cole', cover: poster('n4'), chapters: 410, rating: 4.5, genres: ['Fantasy', 'Academy'], synopsis: 'Magic school hides a secret older than the world itself.' },
  { id: 'n5', title: 'The Sword Saint Returns', author: 'Han Jae', cover: poster('n5'), chapters: 720, rating: 4.9, genres: ['Martial Arts', 'Adventure'], synopsis: 'The strongest swordsman is reborn in a world that forgot him.' },
  { id: 'n6', title: 'My Vampire Husband', author: 'Elena Rose', cover: poster('n6'), chapters: 355, rating: 4.4, genres: ['Romance', 'Supernatural'], synopsis: 'She married a stranger. He has been alive for nine centuries.' },
];

export const CHANNELS: Channel[] = [
  { id: 'c1', name: 'Sports 24', logo: poster('c1', 200, 200), category: 'Sports', now: 'Champions League: Final', progress: 0.42 },
  { id: 'c2', name: 'Global News', logo: poster('c2', 200, 200), category: 'News', now: 'Prime Time Report', progress: 0.68 },
  { id: 'c3', name: 'Cinema One', logo: poster('c3', 200, 200), category: 'Movies', now: 'Shadow Protocol', progress: 0.21 },
  { id: 'c4', name: 'Kids Zone', logo: poster('c4', 200, 200), category: 'Kids', now: 'Lunar Bloom', progress: 0.55 },
  { id: 'c5', name: 'Music Hits', logo: poster('c5', 200, 200), category: 'Music', now: 'Top 20 Countdown', progress: 0.33 },
  { id: 'c6', name: 'Docu World', logo: poster('c6', 200, 200), category: 'Documentary', now: 'Deep Current', progress: 0.77 },
  { id: 'c7', name: 'Anime Plus', logo: poster('c7', 200, 200), category: 'Anime', now: 'Mecha Genesis Zero', progress: 0.12 },
  { id: 'c8', name: 'Movie Classics', logo: poster('c8', 200, 200), category: 'Movies', now: 'Paper Moons', progress: 0.88 },
];

export const FIGHTS: FightEvent[] = [
  { id: 'f1', title: 'Global Championship 42', promotion: 'Premier Combat', date: 'LIVE NOW', thumb: wide('f1'), live: true, main: 'R. Steele vs M. Okonkwo' },
  { id: 'f2', title: 'Fight Night: Bangkok', promotion: 'Muay Elite', date: 'Sat 9:00 PM', thumb: wide('f2'), live: false, main: 'N. Chai vs P. Somchai' },
  { id: 'f3', title: 'Heavyweight Clash', promotion: 'World Boxing', date: 'Sun 11:30 PM', thumb: wide('f3'), live: false, main: 'T. Fury vs D. Wilder Jr.' },
  { id: 'f4', title: 'Grapple Masters 8', promotion: 'BJJ Pro', date: 'Fri 8:00 PM', thumb: wide('f4'), live: false, main: 'A. Silva vs J. Gracie' },
];

export const SHORTS: ShortVideo[] = [
  { id: 'sv1', title: 'She reveals the truth!', show: 'CEO\'s Secret Bride', thumb: img('sv1', 400, 700), likes: '1.2M', episode: 12 },
  { id: 'sv2', title: 'The slap heard around the world', show: 'Reborn as the Heiress', thumb: img('sv2', 400, 700), likes: '890K', episode: 34 },
  { id: 'sv3', title: 'He was the CEO all along', show: 'The Billionaire\'s Revenge', thumb: img('sv3', 400, 700), likes: '2.1M', episode: 5 },
  { id: 'sv4', title: 'Moonlight confession', show: 'My Werewolf Roommate', thumb: img('sv4', 400, 700), likes: '640K', episode: 21 },
  { id: 'sv5', title: 'Grandmother\'s secret letter', show: 'Reborn as the Heiress', thumb: img('sv5', 400, 700), likes: '1.5M', episode: 60 },
];

export function episodesFor(t: Title): Episode[] {
  const n = t.episodes ?? 1;
  const out: Episode[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({
      id: `${t.id}-e${i}`,
      no: i,
      title: `Episode ${i}`,
      duration: `${38 + (i % 5) * 2}m`,
      thumb: wide(`${t.id}-e${i}`),
    });
  }
  return out;
}

export function searchTitles(q: string): Title[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return TITLES.filter(
    (t) =>
      t.title.toLowerCase().includes(s) ||
      t.genres.some((g) => g.toLowerCase().includes(s)),
  );
}

export const CONTINUE_WATCHING: { id: string; progress: number; ep?: number }[] = [
  { id: 't01', progress: 0.35 },
  { id: 'tv01', progress: 0.62, ep: 3 },
  { id: 'an01', progress: 0.18, ep: 2 },
  { id: 't06', progress: 0.81 },
];
