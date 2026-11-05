import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Title } from '../data/catalog';
import { fetchHome } from '../data/api';
import { rememberTitles } from '../data/cache';
import { useCachedAsync } from '../lib/useAsync';
import { PosterCard, Loading, ErrorState } from '../components/ui';
import { IconBack, IconFilter } from '../components/Icons';

const GENRES = ['All', 'Action', 'Drama', 'Sci-Fi', 'Thriller', 'Crime', 'Romance', 'Fantasy', 'Horror', 'Comedy', 'Adventure', 'Animation'];
const SORTS = ['Popular', 'Top Rated', 'Newest', 'A-Z'];

// tabId 0 = home/trending, 1 = TV series, 2 = movies.
const TAB_FOR_KIND: Record<string, string> = { movie: '2', tv: '1', anime: '1', trending: '0' };

export default function Browse() {
  const { kind = 'trending' } = useParams();
  const nav = useNavigate();
  const [genre, setGenre] = useState('All');
  const [sort, setSort] = useState('Popular');

  const tabId = TAB_FOR_KIND[kind] ?? '0';
  const { data, loading, error, reload } = useCachedAsync(`home:${tabId}`, () => fetchHome(tabId), [tabId]);

  useEffect(() => {
    if (data) rememberTitles(Object.values(data.titles));
  }, [data]);

  const base = useMemo(() => {
    const all = Object.values(data?.titles ?? {});
    if (kind === 'movie') return all.filter((t) => t.type === 'movie');
    if (kind === 'tv') return all.filter((t) => t.type === 'tv');
    if (kind === 'anime') return all.filter((t) => /anime|animation/i.test(t.genres.join(' ')));
    return all;
  }, [data, kind]);

  const list = useMemo(() => {
    let l = genre === 'All' ? base : base.filter((t) => t.genres.some((g) => g.toLowerCase() === genre.toLowerCase()));
    if (sort === 'Top Rated') l = [...l].sort((a, b) => b.rating - a.rating);
    else if (sort === 'Newest') l = [...l].sort((a, b) => b.year - a.year);
    else if (sort === 'A-Z') l = [...l].sort((a, b) => a.title.localeCompare(b.title));
    return l;
  }, [base, genre, sort]);

  const title =
    kind === 'movie' ? 'Movies' : kind === 'tv' ? 'TV Series' : kind === 'anime' ? 'Anime' : kind === 'short' ? 'ShortTV' : 'Trending';

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <IconBack />
        </button>
        <div className="topbar-title">{title}</div>
        <button
          className="icon-btn"
          onClick={() => setSort((s) => SORTS[(SORTS.indexOf(s) + 1) % SORTS.length])}
          aria-label="Sort"
        >
          <IconFilter size={20} />
        </button>
      </header>

      <div className="chip-row">
        {GENRES.map((g) => (
          <button key={g} className={`chip ${genre === g ? 'active' : ''}`} onClick={() => setGenre(g)}>
            {g}
          </button>
        ))}
      </div>

      <div className="browse-head">
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {loading && !base.length ? 'Loading…' : `${list.length} titles · sorted by ${sort}`}
        </span>
      </div>

      <div className="scroll">
        {loading && !base.length && <Loading label="Loading titles…" />}
        {error && !base.length && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && (
          <div className="browse-grid">
            {list.map((t) => (
              <PosterCard key={t.id} t={t} width={0} />
            ))}
          </div>
        )}
        {!loading && !error && list.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
            {base.length === 0 ? 'No titles found' : `Nothing in ${genre}`}
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </>
  );
}
