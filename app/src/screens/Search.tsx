import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Title } from '../data/catalog';
import { searchTitles as apiSearch, fetchTrending } from '../data/api';
import { rememberTitles, cachedTitles } from '../data/cache';
import { posterImage } from '../lib/img';
import { useAsync } from '../lib/useAsync';
import { useStore } from '../lib/store';
import {
  IconBack,
  IconSearch,
  IconClose,
  IconStar,
  IconFilter,
  IconHistory,
  IconTrash,
} from '../components/Icons';
import { EmptyState, Loading, ErrorState } from '../components/ui';

const GENRE_FILTERS = ['All', 'Action', 'Drama', 'Sci-Fi', 'Anime', 'Romance', 'Thriller', 'Crime'];
const RECENT_KEY = 'mb-recent-searches';

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export default function Search() {
  const nav = useNavigate();
  const { toast } = useStore();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [genre, setGenre] = useState('All');
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
  }, []);

  // Debounce so each keystroke doesn't fire a signed request.
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const { data: results, loading, error, reload } = useAsync(
    () => (debounced ? apiSearch(debounced) : Promise.resolve([] as Title[])),
    [debounced],
  );

  useEffect(() => {
    if (results?.length) rememberTitles(results);
  }, [results]);

  const trending = useAsync(() => fetchTrending(), []);
  const discover = useMemo(() => {
    const list = trending.data?.length ? trending.data : cachedTitles();
    return list.slice(0, 24);
  }, [trending.data]);

  const filtered = useMemo(() => {
    const list = results ?? [];
    return genre === 'All' ? list : list.filter((t) => t.genres.includes(genre));
  }, [results, genre]);

  const persist = (list: string[]) => {
    setRecent(list);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable */
    }
  };

  const commit = (term: string) => {
    setQ(term);
    setDebounced(term.trim());
    persist([term, ...recent.filter((x) => x !== term)].slice(0, 8));
  };

  const hasQuery = q.trim().length > 0;
  const showResults = debounced.length > 0;

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <IconBack />
        </button>
        <div className="topbar-title">Search</div>
        <button className="icon-btn" onClick={() => toast('Filters')} aria-label="Filter">
          <IconFilter size={20} />
        </button>
      </header>

      <div className="search-bar">
        <IconSearch size={19} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Movies, series, anime, genres…"
          onKeyDown={(e) => e.key === 'Enter' && hasQuery && commit(q)}
          aria-label="Search"
        />
        {hasQuery && (
          <button className="search-clear" onClick={() => setQ('')} aria-label="Clear">
            <IconClose size={18} />
          </button>
        )}
      </div>

      <div className="chip-row" style={{ marginTop: 12 }}>
        {GENRE_FILTERS.map((g) => (
          <button key={g} className={`chip ${genre === g ? 'active' : ''}`} onClick={() => setGenre(g)}>
            {g}
          </button>
        ))}
      </div>

      <div className="scroll">
        {showResults ? (
          <>
            {loading && !results?.length && <Loading label="Searching…" />}
            {error && <ErrorState message={error} onRetry={reload} />}
            {!loading && !error && filtered.length > 0 && (
              <div style={{ paddingTop: 8 }}>
                <div className="search-section" style={{ padding: '12px 16px 4px' }}>
                  <h4>{filtered.length} results</h4>
                </div>
                {filtered.map((t) => (
                  <ResultRow key={t.id} t={t} onOpen={() => nav(`/detail/${t.id}`)} />
                ))}
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <EmptyState
                icon={<IconSearch size={30} />}
                title="No results found"
                subtitle={`Nothing matched "${debounced}". Try a different title or genre.`}
              />
            )}
          </>
        ) : (
          <>
            {recent.length > 0 && (
              <div className="search-section">
                <div className="row" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: 0 }}>Recent</h4>
                  <span className="spacer" />
                  <button
                    className="section-more"
                    onClick={() => {
                      persist([]);
                      toast('Recent cleared');
                    }}
                  >
                    <IconTrash size={15} /> Clear
                  </button>
                </div>
                <div className="search-tags">
                  {recent.map((r) => (
                    <button key={r} className="chip" onClick={() => commit(r)}>
                      <IconHistory size={13} /> {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="search-section">
              <h4>Trending Searches</h4>
              <div className="search-tags">
                {['Inception', 'Avatar', 'Anime', 'K-Drama', 'Action', 'Sci-Fi', 'Thriller'].map((r) => (
                  <button key={r} className="chip" onClick={() => commit(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="search-section">
              <h4>Discover {genre !== 'All' ? `· ${genre}` : ''}</h4>
            </div>
            {trending.loading && !discover.length && <Loading label="Loading…" />}
            <div className="grid">
              {discover.map((t) => (
                <ResultPoster key={t.id} t={t} onOpen={() => nav(`/detail/${t.id}`)} />
              ))}
            </div>
          </>
        )}
        <div style={{ height: 24 }} />
      </div>
    </>
  );
}

function ResultRow({ t, onOpen }: { t: Title; onOpen: () => void }) {
  return (
    <button className="result-row" onClick={onOpen} style={{ width: '100%', textAlign: 'left' }}>
      <div className="result-poster" style={{ backgroundImage: `url(${posterImage(t.poster, 76)})` }} />
      <div className="result-body">
        <div className="result-title ellipsis">{t.title}</div>
        <div className="result-meta">
          {t.rating > 0 && (
            <span className="rating-pill">
              <IconStar size={11} /> {t.rating.toFixed(1)}
            </span>
          )}
          {t.year > 0 && <span>{t.year}</span>}
          <span>·</span>
          <span>{t.type === 'tv' ? 'Series' : 'Movie'}</span>
        </div>
        <div className="result-genres">
          {t.genres.slice(0, 3).map((g) => (
            <span key={g}>{g}</span>
          ))}
        </div>
      </div>
    </button>
  );
}

function ResultPoster({ t, onOpen }: { t: Title; onOpen: () => void }) {
  return (
    <button className="poster-card" onClick={onOpen} style={{ width: '100%' }}>
      <div className="poster-art" style={{ backgroundImage: `url(${posterImage(t.poster, Math.round((window.innerWidth - 44) / 2))})` }}>
        <span className="poster-badge">{t.type === 'tv' ? 'SERIES' : 'MOVIE'}</span>
      </div>
      <div className="poster-meta">
        <span className="poster-title ellipsis">{t.title}</span>
        <span className="poster-sub ellipsis">
          {t.year > 0 ? `${t.year} · ` : ''}
          {t.genres[0] ?? ''}
        </span>
      </div>
    </button>
  );
}
