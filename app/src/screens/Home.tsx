import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HOME_TABS, RAILS, TITLES, TITLE_BY_ID, CONTINUE_WATCHING } from '../data/catalog';
import { useStore } from '../lib/store';
import { Rail, PosterCard, SectionHead } from '../components/ui';
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
  IconTv,
} from '../components/Icons';

const HERO_IDS = ['t01', 'tv01', 'an01', 't06', 'tv02'];

export default function Home() {
  const nav = useNavigate();
  const { state, toast, startDownload, isFavorite, dispatch } = useStore();
  const [tab, setTab] = useState('trending');
  const [heroIdx, setHeroIdx] = useState(0);
  const heroTimer = useRef<number | null>(null);

  const heroes = useMemo(() => HERO_IDS.map((id) => TITLE_BY_ID[id]), []);

  useEffect(() => {
    heroTimer.current = window.setInterval(() => {
      setHeroIdx((i) => (i + 1) % heroes.length);
    }, 5000);
    return () => {
      if (heroTimer.current) window.clearInterval(heroTimer.current);
    };
  }, [heroes.length]);

  const hero = heroes[heroIdx];

  const rails = RAILS[tab] ?? RAILS.trending;

  const progressMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of CONTINUE_WATCHING) m[c.id] = c.progress;
    return m;
  }, []);

  const continueItems = CONTINUE_WATCHING.map((c) => TITLE_BY_ID[c.id]).filter(Boolean);
  const trendItems = TITLES.filter((t) => t.trending).slice(0, 5);

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
        {/* Hero banner */}
        <div className="hero fade-in" style={{ backgroundImage: `url(${hero.backdrop})` }}>
          <div className="hero-body">
            <span className="hero-badge">
              <IconFire size={12} /> #{heroIdx + 1} TRENDING
            </span>
            <div className="hero-title">{hero.title}</div>
            <div className="hero-meta">
              <span className="rating-pill" style={{ color: '#ffd166' }}>
                <IconStar size={12} /> {hero.rating.toFixed(1)}
              </span>
              <span>{hero.year}</span>
              <i className="dot" />
              <span>{hero.genres.join(' · ')}</span>
              {hero.duration && (
                <>
                  <i className="dot" />
                  <span>{hero.duration}</span>
                </>
              )}
            </div>
            <div className="hero-actions">
              <button
                className="btn btn-primary"
                onClick={() => nav(`/player/${hero.id}`)}
              >
                <IconPlay size={17} /> Play
              </button>
              <button
                className="btn btn-ghost"
                onClick={() =>
                  isFavorite(hero.id)
                    ? dispatch({ type: 'toggleFav', id: hero.id })
                    : (dispatch({ type: 'toggleFav', id: hero.id }), toast('Added to My List'))
                }
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

        {/* Category tabs */}
        <div className="cat-tabs">
          {HOME_TABS.map((t) => (
            <button
              key={t.id}
              className={`chip ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>

        {tab === 'trending' && (
          <>
            {/* Continue watching */}
            <section className="rail">
              <SectionHead title="Continue Watching" onMore={() => nav('/history')} />
              <div className="rail-scroll">
                {continueItems.map((t) => (
                  <PosterCard
                    key={t.id}
                    t={t}
                    width={140}
                    showProgress
                    progress={progressMap[t.id]}
                    sub={
                      CONTINUE_WATCHING.find((c) => c.id === t.id)?.ep
                        ? `E${CONTINUE_WATCHING.find((c) => c.id === t.id)?.ep} · ${t.type === 'tv' ? 'Series' : t.type}`
                        : t.genres[0]
                    }
                  />
                ))}
              </div>
            </section>

            {/* Trending irregular grid */}
            <section className="rail">
              <SectionHead title="🔥 Trending Today" onMore={() => nav('/browse/trending')} />
              <div className="trend-grid">
                {trendItems.map((t, i) => (
                  <div key={t.id} className={i === 0 ? 'big' : ''}>
                    <button
                      className="trend-item"
                      style={{ backgroundImage: `url(${i === 0 ? t.backdrop : t.poster})` }}
                      onClick={() => nav(`/detail/${t.id}`)}
                    >
                      <div className="trend-body">
                        <div className="trend-name">{t.title}</div>
                        <div className="trend-sub">
                          ⭐ {t.rating.toFixed(1)} · {t.genres[0]}
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

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
          rails.map((r) => (
            <Rail
              key={r.id}
              title={r.title}
              items={r.items.map((id) => TITLE_BY_ID[id]).filter(Boolean)}
              onMore={() => nav(`/browse/${tab}`)}
              ranked={r.title.includes('Top 10')}
            />
          ))
        )}

        {tab === 'short' && (
          <section className="rail">
            <SectionHead title="Vertical Shorts" onMore={() => nav('/shorts')} />
            <div style={{ padding: '0 16px' }}>
              <button className="btn btn-primary btn-block" onClick={() => nav('/shorts')}>
                <IconPlay size={17} /> Watch Shorts
              </button>
            </div>
          </section>
        )}

        <div style={{ height: 28 }} />
      </div>
    </>
  );
}
