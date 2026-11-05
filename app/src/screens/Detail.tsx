import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchDetails, episodesOf, type MediaDetails } from '../data/api';
import { getTitle, getDetails, rememberDetails, rememberTitle } from '../data/cache';
import { useCachedAsync } from '../lib/useAsync';
import { backdropImage, posterImage, optimizeImage } from '../lib/img';
import { useStore } from '../lib/store';
import {
  IconBack,
  IconPlay,
  IconDownload,
  IconHeart,
  IconCheck,
  IconStar,
  IconShare,
  IconCast,
  IconMore,
  IconSubtitle,
} from '../components/Icons';
import { Sheet, SheetOption, Confirm, Loading, ErrorState, Rail } from '../components/ui';

export default function Detail() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { isFavorite, dispatch, toast, startDownload, state } = useStore();

  const [sheet, setSheet] = useState<null | 'quality' | 'subtitle'>(null);
  const [confirmDl, setConfirmDl] = useState(false);
  const [quality, setQuality] = useState('1080p');
  const [subLang, setSubLang] = useState('Off');
  const [expanded, setExpanded] = useState(false);
  const [season, setSeason] = useState(Number(sp.get('se')) || 1);

  const cached = getDetails(id);
  const { data, loading, error, reload } = useCachedAsync(`detail:${id}`, () => fetchDetails(id), [id], 10 * 60 * 1000);

  useEffect(() => {
    if (data) {
      rememberDetails(data);
      rememberTitle(data);
    }
  }, [data]);

  const t: MediaDetails | undefined = data ?? cached;
  const eps = useMemo(() => (t && t.seasons > 0 ? episodesOf(t, season) : []), [t, season]);

  if (loading && !t) {
    return (
      <>
        <header className="topbar">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
            <IconBack />
          </button>
          <div className="topbar-title">Loading</div>
        </header>
        <Loading label="Loading details…" />
      </>
    );
  }

  if (!t) {
    return (
      <>
        <header className="topbar">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
            <IconBack />
          </button>
          <div className="topbar-title">Not found</div>
        </header>
        <div className="scroll" style={{ flex: 1 }}>
          {error ? <ErrorState message={error} onRetry={reload} /> : <Loading />}
        </div>
      </>
    );
  }

  const fav = isFavorite(t.id);
  const inHistory = state.history.find((h) => h.titleId === t.id);
  const resume = inHistory?.progress ?? 0;
  const isSeries = t.seasons > 0;

  const playUrl = isSeries ? `/player/${t.id}?se=${season}&ep=1` : `/player/${t.id}`;

  const doDownload = () => {
    startDownload(t.id, { quality: quality as any });
    setConfirmDl(false);
  };

  return (
    <>
      <div className="scroll">
        <div className="detail-hero" style={{ backgroundImage: `url(${backdropImage(t.backdrop, window.innerWidth)})` }}>
          <button className="detail-back" onClick={() => nav(-1)} aria-label="Back">
            <IconBack />
          </button>
          <div className="detail-head-actions">
            <button className="icon-btn" onClick={() => toast('Casting…')} aria-label="Cast">
              <IconCast size={20} />
            </button>
            <button className="icon-btn" onClick={() => toast('Link copied')} aria-label="Share">
              <IconShare size={20} />
            </button>
          </div>
        </div>

        <div className="detail-body fade-in">
          <div className="detail-title">{t.title}</div>
          <div className="detail-meta">
            {t.rating > 0 && (
              <span className="rating-pill">
                <IconStar size={12} /> {t.rating.toFixed(1)}
              </span>
            )}
            {t.year > 0 && <span>{t.year}</span>}
            {t.duration && <span>{t.duration}</span>}
            {isSeries && (
              <span className="pill">
                {t.seasons} Season{t.seasons > 1 ? 's' : ''}
              </span>
            )}
            <span className="pill">{isSeries ? 'Series' : 'Movie'}</span>
          </div>

          {t.genres.length > 0 && (
            <div className="detail-genres">
              {t.genres.map((g) => (
                <span key={g} className="chip">
                  {g}
                </span>
              ))}
            </div>
          )}

          {t.synopsis && (
            <>
              <div
                className="detail-synopsis clamp3"
                style={expanded ? { WebkitLineClamp: 'unset' } : undefined}
              >
                {t.synopsis}
              </div>
              <button
                style={{ color: 'var(--accent-2)', fontSize: 12.5, fontWeight: 700, marginTop: 6 }}
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            </>
          )}

          <div className="detail-actions">
            <button className="btn btn-primary" onClick={() => nav(playUrl)}>
              <IconPlay size={17} /> {resume > 0 ? `Resume ${Math.round(resume * 100)}%` : 'Play'}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmDl(true)}>
              <IconDownload size={17} /> Download
            </button>
          </div>

          <div className="detail-icon-actions">
            <button
              className={`act ${fav ? 'active' : ''}`}
              onClick={() => {
                dispatch({ type: 'toggleFav', id: t.id });
                toast(fav ? 'Removed from My List' : 'Added to My List');
              }}
            >
              {fav ? <IconCheck size={19} /> : <IconHeart size={19} />} My List
            </button>
            <button className="act" onClick={() => setSheet('quality')}>
              <IconSubtitle size={19} /> Quality
            </button>
            <button className="act" onClick={() => setSheet('subtitle')}>
              <IconSubtitle size={19} /> Subtitles
            </button>
            <button className="act" onClick={() => toast('Reported')}>
              <IconMore size={19} /> More
            </button>
          </div>

          {isSeries && (
            <>
              <div className="ep-head">
                <h3>Episodes</h3>
              </div>

              {t.seasons > 1 && (
                <div className="season-row">
                  {Array.from({ length: t.seasons }, (_, i) => i + 1).map((s) => (
                    <button
                      key={s}
                      className={`chip ${season === s ? 'active' : ''}`}
                      onClick={() => setSeason(s)}
                    >
                      Season {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="ep-grid">
                {eps.map((e) => {
                  const isCurrent = inHistory?.episode === e.no;
                  return (
                    <button
                      key={e.id}
                      className={`ep-card ${isCurrent ? 'on' : ''}`}
                      onClick={() => nav(`/player/${t.id}?se=${season}&ep=${e.no}`)}
                    >
                      <div className="ep-thumb" style={{ backgroundImage: `url(${optimizeImage(e.thumb, 320)})` }} />
                      <div className="ep-meta">
                        <div className="ep-no">Episode {e.no}</div>
                        <div className="ep-dur">
                          {e.duration}
                          {isCurrent && resume > 0 ? ` · ${Math.round(resume * 100)}%` : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {eps.length === 0 && (
                <div style={{ padding: '0 16px 12px', color: 'var(--text-3)', fontSize: 13 }}>
                  No episodes listed for this season.
                </div>
              )}
            </>
          )}

          {t.cast.length > 0 && (
            <>
              <div className="ep-head">
                <h3>Cast</h3>
              </div>
              <div className="cast-row">
                {t.cast.map((c, i) => (
                  <div key={`${c.id}-${i}`} className="cast">
                    <div className="cast-img" style={{ backgroundImage: `url(${optimizeImage(c.avatar, 160)})` }} />
                    <span className="cast-name">{c.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ height: 28 }} />
      </div>

      {sheet === 'quality' && (
        <Sheet title="Stream Quality" onClose={() => setSheet(null)}>
          {['4K', '1080p', '720p', '480p', 'Auto'].map((q) => (
            <SheetOption
              key={q}
              active={quality === q}
              onClick={() => {
                setQuality(q);
                setSheet(null);
                toast(`Quality set to ${q}`);
              }}
            >
              {q}
            </SheetOption>
          ))}
        </Sheet>
      )}

      {sheet === 'subtitle' && (
        <Sheet title="Subtitles" onClose={() => setSheet(null)}>
          {['Off', 'English', 'हिन्दी', 'বাংলা', 'Español', 'العربية', '中文'].map((s) => (
            <SheetOption
              key={s}
              active={subLang === s}
              onClick={() => {
                setSubLang(s);
                setSheet(null);
                toast(s === 'Off' ? 'Subtitles off' : `Subtitles: ${s}`);
              }}
            >
              {s}
            </SheetOption>
          ))}
        </Sheet>
      )}

      {confirmDl && (
        <Confirm
          title="Download"
          message={`Download "${t.title}" in ${quality}? ${isSeries ? 'Episodes will be queued.' : ''}`}
          confirmLabel="Download"
          onConfirm={doDownload}
          onCancel={() => setConfirmDl(false)}
        />
      )}
    </>
  );
}
