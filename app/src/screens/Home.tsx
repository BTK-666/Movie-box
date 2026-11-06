import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchHome } from '../data/api';
import { rememberTitles, getTitle } from '../data/cache';
import { backdropImage } from '../lib/img';
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
  IconTv,
} from '../components/Icons';

const TAB_CHIPS = [
  { id: 'trending', name: 'Trending' },
  { id: 'movie', name: 'Movies' },
  { id: 'tv', name: 'TV Series' },
  { id: 'live', name: 'Live TV' },
];

export default function Home() {
  const nav = useNavigate();
  const { state, toast, isFavorite, dispatch } = useStore();
  const [tab, setTab] = useState('trending');
  const [heroIdx, setHeroIdx] = useState(0);
  const heroTimer = useRef<number | null>(null);

  const { data, loading, error, reload } = useCachedAsync('home:0', () => fetchHome('0'), []);

  useEffect(() => {
    if (data) rememberTitles(Object.values(data.titles));
  }, [data]);

  const heroes = useMemo(() => (data?.heroes ?? []).slice(0, 6), [data]);

  const rails = useMemo(() => {
    const all = data?.rails ?? [];
    if (tab === 'movie') return all.filter((r) => /movie|cinema|hollywood|bollywood/i.test(r.title));
    if (tab === 'tv') return all.filter((r) => /tv|series|drama|anime/i.test(r.title));
    return all.slice(0, 6);
  }, [data, tab]);

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

        {hero && (
          <>
            <div className="hero fade-in" style={{ backgroundImage: `url(${backdropImage(hero.backdrop, window.innerWidth)})` }}>
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

        <div className="cat-tabs">
          {TAB_CHIPS.map((t) => (
            <button
              key={t.id}
              className={`chip ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>

        {tab === 'live' ? (
          <section className="rail">
            <SectionHead title="Live Channels" onMore={() => nav('/live')} />
            <div style={{ padding: '0 16px' }}>
              <button className="btn btn-primary btn-block" onClick={() => nav('/live')}>
                <IconTv size={18} /> Open Live TV
              </button>
            </div>
          </section>
        ) : (
          <>
            {tab === 'trending' && continueItems.length > 0 && (
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

            {rails.map((r) => (
              <Rail
                key={r.id}
                title={r.title}
                items={railItems(r.items)}
                onMore={() => nav(`/browse/${tab}`)}
              />
            ))}

            {!loading && !error && rails.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
                Nothing to show right now
              </div>
            )}
          </>
        )}

        <div style={{ height: 28 }} />
      </div>
    </>
  );
}
