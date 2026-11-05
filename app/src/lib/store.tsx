import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { TITLE_BY_ID, artwork } from '../data/catalog';
import { getTitle } from '../data/cache';

export type Theme = 'dark' | 'light';

export interface DownloadItem {
  id: string;
  titleId: string;
  episode?: number;
  label: string;
  quality: '4K' | '1080p' | '720p' | '480p';
  size: string;
  progress: number; // 0..1
  status: 'downloading' | 'paused' | 'done' | 'failed';
  speed?: string;
  eta?: string;
}

export interface HistoryItem {
  id: string;
  titleId: string;
  episode?: number;
  progress: number;
  watchedAt: number;
}

export interface Addon {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  version: string;
}

export interface Settings {
  theme: Theme;
  player: 'builtin' | 'vlc' | 'mx' | 'mpv';
  autoPlay: boolean;
  defaultQuality: '4K' | '1080p' | '720p' | 'Auto';
  autoplayNext: boolean;
  wifiOnlyDownload: boolean;
  subtitles: boolean;
  subtitleLang: string;
  notifications: boolean;
  dataSaver: boolean;
  kidsMode: boolean;
  region: string;
}

interface State {
  favorites: string[];
  downloads: DownloadItem[];
  history: HistoryItem[];
  addons: Addon[];
  settings: Settings;
  profile: { name: string; email: string; avatar: string; plan: string };
}

type Action =
  | { type: 'toggleFav'; id: string }
  | { type: 'addDownload'; item: DownloadItem }
  | { type: 'updateDownload'; id: string; patch: Partial<DownloadItem> }
  | { type: 'removeDownload'; id: string }
  | { type: 'pushHistory'; item: HistoryItem }
  | { type: 'toggleAddon'; id: string }
  | { type: 'setSetting'; key: keyof Settings; value: any }
  | { type: 'clearHistory' }
  | { type: 'clearDownloads' };

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  player: 'builtin',
  autoPlay: true,
  defaultQuality: '1080p',
  autoplayNext: true,
  wifiOnlyDownload: true,
  subtitles: true,
  subtitleLang: 'English',
  notifications: true,
  dataSaver: false,
  kidsMode: false,
  region: 'India',
};

const DEFAULT_ADDONS: Addon[] = [
  { id: 'ad1', name: 'Cinemeta', description: 'Metadata for movies and series', installed: true, version: '3.0.14' },
  { id: 'ad2', name: 'Torrentio', description: 'Streams from multiple sources', installed: true, version: '0.0.14' },
  { id: 'ad3', name: 'OpenSubtitles v3', description: 'Subtitles in 40+ languages', installed: true, version: '1.0.2' },
  { id: 'ad4', name: 'Anime Kitsu', description: 'Anime catalog and metadata', installed: false, version: '1.4.0' },
  { id: 'ad5', name: 'WatchHub', description: 'Official streaming links', installed: false, version: '2.1.0' },
  { id: 'ad6', name: 'LocalFiles', description: 'Play media from device storage', installed: false, version: '1.0.0' },
];

const initialState: State = {
  // A fresh install starts empty; My List, Downloads and History fill up as the
  // user browses the live catalog.
  favorites: [],
  downloads: [],
  history: [],
  addons: DEFAULT_ADDONS,
  settings: DEFAULT_SETTINGS,
  profile: {
    name: 'Guest User',
    email: 'guest@moviebox.app',
    avatar: artwork('avatar', 200, 200),
    plan: 'Free',
  },
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'toggleFav':
      return {
        ...state,
        favorites: state.favorites.includes(action.id)
          ? state.favorites.filter((x) => x !== action.id)
          : [action.id, ...state.favorites],
      };
    case 'addDownload':
      return { ...state, downloads: [action.item, ...state.downloads] };
    case 'updateDownload':
      return {
        ...state,
        downloads: state.downloads.map((d) =>
          d.id === action.id ? { ...d, ...action.patch } : d,
        ),
      };
    case 'removeDownload':
      return { ...state, downloads: state.downloads.filter((d) => d.id !== action.id) };
    case 'pushHistory': {
      const rest = state.history.filter(
        (h) => !(h.titleId === action.item.titleId && h.episode === action.item.episode),
      );
      return { ...state, history: [action.item, ...rest].slice(0, 60) };
    }
    case 'toggleAddon':
      return {
        ...state,
        addons: state.addons.map((a) =>
          a.id === action.id ? { ...a, installed: !a.installed } : a,
        ),
      };
    case 'setSetting':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };
    case 'clearHistory':
      return { ...state, history: [] };
    case 'clearDownloads':
      return { ...state, downloads: [] };
    default:
      return state;
  }
}

interface StoreCtx {
  state: State;
  dispatch: React.Dispatch<Action>;
  isFavorite: (id: string) => boolean;
  toast: (msg: string) => void;
  toastMsg: string | null;
  toggleTheme: () => void;
  startDownload: (titleId: string, opts?: { episode?: number; quality?: Settings['defaultQuality'] }) => void;
  fmt: (n: number) => string;
}

const PERSIST_KEY = 'mb-store-v1';

type Persisted = Pick<State, 'favorites' | 'downloads' | 'history' | 'addons' | 'settings' | 'profile'>;

function loadPersisted(): State {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw) as Partial<Persisted>;
    return {
      ...initialState,
      ...saved,
      // Merge settings so keys added in a later build still get defaults.
      settings: { ...initialState.settings, ...(saved.settings ?? {}) },
      profile: { ...initialState.profile, ...(saved.profile ?? {}) },
    };
  } catch {
    return initialState;
  }
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadPersisted);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(null), 2000);
  }, []);

  useEffect(() => {
    try {
      const { favorites, downloads, history, addons, settings, profile } = state;
      localStorage.setItem(PERSIST_KEY, JSON.stringify({ favorites, downloads, history, addons, settings, profile }));
    } catch {
      /* storage full or unavailable */
    }
  }, [state]);

  const isFavorite = useCallback((id: string) => state.favorites.includes(id), [state.favorites]);

  const toggleTheme = useCallback(() => {
    const next = state.settings.theme === 'dark' ? 'light' : 'dark';
    dispatch({ type: 'setSetting', key: 'theme', value: next });
  }, [state.settings.theme]);

  const fmt = useCallback((n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }, []);

  const startDownload = useCallback(
    (titleId: string, opts?: { episode?: number; quality?: Settings['defaultQuality'] }) => {
      const t = getTitle(titleId);
      if (!t) return;
      const q = (opts?.quality && opts.quality !== 'Auto' ? opts.quality : state.settings.defaultQuality === 'Auto' ? '1080p' : state.settings.defaultQuality) as DownloadItem['quality'];
      const sizeGb = q === '4K' ? 3.2 : q === '1080p' ? 1.4 : q === '720p' ? 0.7 : 0.35;
      const id = `d${Date.now()}`;
      dispatch({
        type: 'addDownload',
        item: {
          id,
          titleId,
          episode: opts?.episode,
          label: t.title + (opts?.episode ? ` — E${opts.episode}` : ''),
          quality: q,
          size: sizeGb >= 1 ? `${sizeGb.toFixed(1)} GB` : `${Math.round(sizeGb * 1000)} MB`,
          progress: 0,
          status: 'downloading',
          speed: '3.4 MB/s',
          eta: 'calculating…',
        },
      });
      toast('Download started');
    },
    [state.settings.defaultQuality, toast],
  );

  // simulate download progress for active items
  useEffect(() => {
    const iv = window.setInterval(() => {
      const active = state.downloads.filter((d) => d.status === 'downloading');
      if (!active.length) return;
      for (const d of active) {
        const step = 0.03 + Math.random() * 0.05;
        const next = Math.min(1, d.progress + step);
        dispatch({
          type: 'updateDownload',
          id: d.id,
          patch: next >= 1
            ? { progress: 1, status: 'done', speed: undefined, eta: undefined }
            : { progress: next, speed: `${(2 + Math.random() * 6).toFixed(1)} MB/s` },
        });
      }
    }, 1000);
    return () => window.clearInterval(iv);
  }, [state.downloads]);

  // apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.settings.theme === 'dark' ? '#0a0a0f' : '#f5f5f8');
  }, [state.settings.theme]);

  const value = useMemo<StoreCtx>(
    () => ({ state, dispatch, isFavorite, toast, toastMsg, toggleTheme, startDownload, fmt }),
    [state, isFavorite, toast, toastMsg, toggleTheme, startDownload, fmt],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore must be used within StoreProvider');
  return c;
}
