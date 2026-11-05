import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TITLES, TITLE_BY_ID } from '../data/catalog';
import { PosterCard } from '../components/ui';
import { IconBack, IconFilter } from '../components/Icons';

const GENRES = ['All', 'Action', 'Drama', 'Sci-Fi', 'Thriller', 'Crime', 'Anime', 'Romance', 'Fantasy'];
const SORTS = ['Popular', 'Top Rated', 'Newest', 'A-Z'];

export default function Browse() {
  const { kind = 'trending' } = useParams();
  const nav = useNavigate();
  const [genre, setGenre] = useState('All');
  const [sort, setSort] = useState('Popular');

  const base = useMemo(() => {
    if (kind === 'movie') return TITLES.filter((t) => t.type === 'movie');
    if (kind === 'tv') return TITLES.filter((t) => t.type === 'tv');
    if (kind === 'anime') return TITLES.filter((t) => t.type === 'anime');
    if (kind === 'short') return TITLES.filter((t) => t.type === 'short');
    return TITLES.filter((t) => t.trending || t.newRelease);
  }, [kind]);

  const list = useMemo(() => {
    let l = base.filter((t) => genre === 'All' || t.genres.includes(genre));
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
        <button className="icon-btn" onClick={() => setSort((s) => SORTS[(SORTS.indexOf(s) + 1) % SORTS.length])} aria-label="Sort">
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
          {list.length} titles · sorted by {sort}
        </span>
      </div>

      <div className="scroll">
        <div className="browse-grid">
          {list.map((t) => (
            <PosterCard key={t.id} t={t} width={0} />
          ))}
        </div>
        {list.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>No titles found</div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </>
  );
}
