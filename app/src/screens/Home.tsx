import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchHome, fetchShorts, type ShortItem } from '../data/api';
import type { Rail as RailData } from '../data/catalog';
import { rememberTitles, getTitle } from '../data/cache';
import { backdropImage, optimizeImage } from '../lib/img';
import { useCachedAsync } from '../lib/useAsync';
import { useStore } from '../lib/store';
import { Rail, PosterCard, SectionHead, Loading, ErrorState } from '../components/ui';
import {
  IconLogo,
  IconSearch,
  IconBell,
  IconCast,
  IconPlay,
  IconPlus,
  IconCheck,
  IconStar,
  IconFire,
  IconChevronRight,
} from '../components/Icons';

/**
 * Home categories, mirroring the reference build: Football / Trending / Movie /
 * Anime / Cricket / TV. Each maps to a tabId on the tab-operating endpoint.
 * Several ids return the same generic feed, which is why they are grouped by
 * what the backend actually serves rather than by label.
 */
const CATEGORIES: { id: string; name: string; tabId: string }[] = [
  { id: 'football', name: 'Football', tabId: '7' },
  { id: 'trending', name: 'Trending', tabId: '0' },
  { id: 'movie', name: 'Movie', tabId: '2' },
  { id: 'anime', name: 'Anime', tabId: '8' },
  { id: 'cricket', name: 'Cricket', tabId: '13' },
  { id: 'tv', name: 'TV', tabId: '5' },
];

/** Sub-chips under a "TOP Movies" style rail, like the reference design. */
const RAIL_SUBS: Record<string, string[]> = {
  movie: ['Bollywood', 'South Indian', 'Hollywood', 'New'],
  tv: ['Indian Drama', 'Reality-TV', 'Anime', 'Asian Drama', 'Western'],
};

/**
 * "Hot Short TV" rail — the vertical short-drama feed the official client
 * surfaces on the home page. Cards open the immersive shorts player.
 */
function HotShortsRail({ onOpen }: { onOpen: (index: number) => void }) {
  const { data } = useCachedAsync('home:shorts', () => fetchShorts(1, 12), []);
  const items: ShortItem[] = data ?? [];
  if (!items.length) return null;
  return (
    <section className="rail">
      <div className="section-head">
        <h3>
          <IconFire size={15} /> Hot Short TV
        </h3>
        <button className="section-more" onClick={() => onOpen(0)}>
          Watch all <IconChevronRight size={15} />
        </button>
      </div>
      <div className="rail-scroll">
        {items.map((s, i) => (
          <button key={s.id} className="short-card" onClick={() => onOpen(i)} aria-label={s.title}>
            <span
              className="short-card-art"
              style={{ backgroundImage: `url(${optimizeImage(s.cover, 220)})` }}
            >
              <span className="short-card-play">
                <IconPlay size={16} />
              </span>
              {s.duration > 0 && <span className="short-card-dur">{fmtShort(s.duration)}</span>}
            </span>
            <span className="short-card-title clamp2">{s.title || s.groupName || 'Short'}</span>
            <span className="short-card-sub ellipsis">{s.author || 'Short Drama'}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const fmtShort = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function Home() {
  const nav = useNavigate();
  const { state, toast, isFavorite, dispatch } = useStore();
  const [cat, setCat] = useState('trending');
  const [sub, setSub] = useState<Record<string, string>>({});
  const [heroIdx, setHeroIdx] = useState(0);
  const heroTimer = useRef<number | null>(null);

  const activeCat = CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[1];
  const { data, loading, error, reload } = useCachedAsync(
    `home:${activeCat.tabId}`,
    () => fetchHome(activeCat.tabId),
    [activeCat.tabId],
  );

  useEffect(() => {
    if (data) rememberTitles(Object.values(data.titles));
  }, [data]);

  const heroes = useMemo(() => (data?.heroes ?? []).slice(0, 6), [data]);
  const rails = useMemo(() => {
    const base = (data?.rails ?? []).filter((r) => r.items.length > 0);
    if (cat !== 'trending') return base;

    // The reference home puts "TOP Movies" and "Top Series" at the top, built
    // from the catalogue's highest-rated titles rather than a named feed the
    // backend does not expose.
    const all = Object.values(data?.titles ?? {});
    const byRating = (list: any[]) =>
      [...list].sort((a, b) => b.rating - a.rating || b.year - a.year).slice(0, 12).map((t) => t.id);
    const movies = byRating(all.filter((t) => t.type === 'movie' && t.rating > 0));
    const series = byRating(all.filter((t) => t.type === 'tv' && t.rating > 0));

    const derived: RailData[] = [];
    if (movies.length) derived.push({ id: 'top-movies', title: 'TOP Movies', items: movies });
    if (series.length) derived.push({ id: 'top-series', title: 'Top Series', items: series });
    return [...derived, ...base];
  }, [data, cat]);

  useEffect(() => {
    setHeroIdx(0);
  }, [activeCat.tabId]);

  useEffect(() => {
    if (heroes.length < 2) return;
    heroTimer.current = window.setInterval(() => {
      setHeroIdx((i) => (i + 1) % heroes.length);
    }, 6000);
    return () => {
      if (heroTimer.current) window.clearInterval(heroTimer.current);
    };
  }, [heroes.length]);

  const hero = heroes.length ? heroes[heroIdx % heroes.length] : undefined;

  const titleById = (id: string) => getTitle(id);
  const railItems = (ids: string[]) =>
    ids.map((id) => data?.titles[id]).filter(Boolean) as any[];

  // Only the "TOP Movies" / "Top Series" rails carry the sub-category chips,
  // matching the reference design; the rest stay as plain poster rails.
  const subKeyFor = (railTitle: string) =>
    /^top\s*series|^top\s*tv/i.test(railTitle)
      ? 'tv'
      : /^top\s*movies/i.test(railTitle)
        ? 'movie'
        : '';

  const continueItems = state.history
    .map((h) => ({ h, t: titleById(h.titleId) }))
    .filter((x) => Boolean(x.t))
    .slice(0, 10);

  return (
    <>
      <header className="home-header">
        <div className="home-logo">
          <IconLogo size={26} />
          <span>
            Movie<span className="grad-text">Box</span>+
          </span>
        </div>
        <div className="home-actions">
          <button className="icon-btn" aria-label="Cast" onClick={() => toast('No devices found')}>
            <IconCast size={22} />
          </button>
          <button className="icon-btn" aria-label="Notifications" onClick={() => toast('No new notifications')}>
            <IconBell size={22} />
          </button>
          <button className="icon-btn" aria-label="Search" onClick={() => nav('/search')}>
            <IconSearch size={22} />
          </button>
        </div>
      </header>

      <div className="scroll">
        {loading && !data && <Loading label="Loading catalog…" />}
        {error && !data && <ErrorState message={error} onRetry={reload} />}

        <div className="cat-tabs" role="tablist" aria-label="Categories">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={cat === c.id}
              className={`chip ${cat === c.id ? 'active' : ''}`}
              onClick={() => setCat(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {hero && (
          <>
            <div
              className="hero fade-in"
              style={{ backgroundImage: `url(${backdropImage(hero.backdrop, window.innerWidth)})` }}
            >
              <div className="hero-body">
                <span className="hero-badge">
                  <IconFire size={12} /> #{heroIdx + 1} TRENDING
                </span>
                <div className="hero-title">{hero.title}</div>
                <div className="hero-meta">
                  {hero.rating > 0 && (
                    <span className="rating-pill" style={{ color: '#ffd166' }}>
                      <IconStar size={12} /> {hero.rating.toFixed(1)}
                    </span>
                  )}
                  {hero.year > 0 && <span>{hero.year}</span>}
                  {hero.genres.length > 0 && (
                    <>
                      <i className="dot" />
                      <span>{hero.genres.slice(0, 3).join(' · ')}</span>
                    </>
                  )}
                  {hero.duration && (
                    <>
                      <i className="dot" />
                      <span>{hero.duration}</span>
                    </>
                  )}
                </div>
                <div className="hero-actions">
                  <button className="btn btn-primary" onClick={() => nav(`/detail/${hero.id}?play=1`)}>
                    <IconPlay size={17} /> Play
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      const wasFav = isFavorite(hero.id);
                      dispatch({ type: 'toggleFav', id: hero.id });
                      if (!wasFav) toast('Added to My List');
                    }}
                  >
                    {isFavorite(hero.id) ? <IconCheck size={17} /> : <IconPlus size={17} />}
                    {isFavorite(hero.id) ? 'In List' : 'My List'}
                  </button>
                </div>
              </div>
            </div>
            <div className="hero-dots">
              {heroes.map((_, i) => (
                <i key={i} className={i === heroIdx ? 'on' : ''} onClick={() => setHeroIdx(i)} />
              ))}
            </div>
          </>
        )}

        {cat === 'trending' && continueItems.length > 0 && (
          <section className="rail">
            <SectionHead title="Continue Watching" onMore={() => nav('/history')} />
            <div className="rail-scroll">
              {continueItems.map(({ h, t }) => (
                <PosterCard
                  key={`${t!.id}-${h.episode ?? 'main'}`}
                  t={t!}
                  width={140}
                  showProgress
                  progress={h.progress}
                  sub={h.episode ? `E${h.episode}` : t!.genres[0]}
                />
              ))}
            </div>
          </section>
        )}

        {cat === 'trending' && !rails.some((r) => /hot\s*short/i.test(r.title)) && (
          <HotShortsRail onOpen={(i) => nav(`/shorts?i=${i}`)} />
        )}

        {rails.map((r) => {
          const key = subKeyFor(r.title);
          const subs = key ? RAIL_SUBS[key] : undefined;
          const picked = key ? sub[r.id] : undefined;
          let items = railItems(r.items);
          if (picked) {
            const filtered = items.filter((t: any) =>
              t.genres.some((g: string) => g.toLowerCase() === picked.toLowerCase()),
            );
            if (filtered.length) items = filtered;
          }
          return (
            <section className="rail" key={r.id}>
              <SectionHead title={r.title} onMore={() => nav(`/browse/${cat}`)} />
              {subs && (
                <div className="rail-subs">
                  {subs.map((s) => (
                    <button
                      key={s}
                      className={`chip sm ${picked === s ? 'active' : ''}`}
                      onClick={() =>
                        setSub((prev) => ({ ...prev, [r.id]: prev[r.id] === s ? '' : s }))
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="rail-scroll">
                {items.map((t, i) => (
                  <PosterCard key={t.id + i} t={t} width={122} />
                ))}
              </div>
            </section>
          );
        })}

        {!loading && !error && rails.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
            Nothing to show right now
          </div>
        )}

        <div style={{ height: 28 }} />
      </div>
    </>
  );
}
