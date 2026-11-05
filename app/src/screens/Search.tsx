import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchTitles, TITLES, Title } from '../data/catalog';
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
import { EmptyState } from '../components/ui';

const TRENDING_SEARCHES = [
  'Shadow Protocol',
  'Broken Empire',
  'Anime',
  'K-Drama',
  'Action',
  'Sci-Fi',
  'ShortTV',
  'Thriller',
];

const GENRE_FILTERS = ['All', 'Action', 'Drama', 'Sci-Fi', 'Anime', 'Romance', 'Thriller', 'Crime'];

export default function Search() {
  const nav = useNavigate();
  const { state, dispatch, toast } = useStore();
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('All');
  const [recent, setRecent] = useState<string[]>(['Shadow Protocol', 'Anime']);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
  }, []);

  const results = useMemo(() => {
    let r = q.trim() ? searchTitles(q) : [];
    if (genre !== 'All') r = r.filter((t) => t.genres.includes(genre));
    return r;
  }, [q, genre]);

  const discover = useMemo(() => {
    let list = TITLES.filter((t) => t.trending || t.newRelease);
    if (genre !== 'All') list = list.filter((t) => t.genres.includes(genre));
    return list.slice(0, 24);
  }, [genre]);

  const commit = (term: string) => {
    setQ(term);
    setRecent((r) => [term, ...r.filter((x) => x !== term)].slice(0, 8));
  };

  const hasQuery = q.trim().length > 0;

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
        {hasQuery ? (
          results.length > 0 ? (
            <div style={{ paddingTop: 8 }}>
              <div className="search-section" style={{ padding: '12px 16px 4px' }}>
                <h4>{results.length} results</h4>
              </div>
              {results.map((t) => (
                <ResultRow key={t.id} t={t} onOpen={() => nav(`/detail/${t.id}`)} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<IconSearch size={30} />}
              title="No results found"
              subtitle={`Nothing matched "${q}". Try a different title or genre.`}
            />
          )
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
                      setRecent([]);
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
                {TRENDING_SEARCHES.map((r) => (
                  <button key={r} className="chip" onClick={() => commit(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="search-section">
              <h4>Discover {genre !== 'All' ? `· ${genre}` : ''}</h4>
            </div>
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
      <div className="result-poster" style={{ backgroundImage: `url(${t.poster})` }} />
      <div className="result-body">
        <div className="result-title ellipsis">{t.title}</div>
        <div className="result-meta">
          <span className="rating-pill">
            <IconStar size={11} /> {t.rating.toFixed(1)}
          </span>
          <span>{t.year}</span>
          <span>·</span>
          <span>{t.episodes ? `${t.episodes} ep` : t.duration}</span>
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
      <div className="poster-art" style={{ backgroundImage: `url(${t.poster})` }}>
        {t.quality && <span className="poster-badge">{t.quality}</span>}
      </div>
      <div className="poster-meta">
        <span className="poster-title ellipsis">{t.title}</span>
        <span className="poster-sub ellipsis">
          {t.year} · {t.genres[0]}
        </span>
      </div>
    </button>
  );
}
