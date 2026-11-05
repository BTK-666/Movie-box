import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TITLE_BY_ID,
  episodesFor,
  RAILS,
  TITLES,
  Title,
} from '../data/catalog';
import { useStore } from '../lib/store';
import { artwork } from '../data/catalog';
import {
  IconBack,
  IconPlay,
  IconDownload,
  IconHeart,
  IconPlus,
  IconCheck,
  IconStar,
  IconShare,
  IconCast,
  IconMore,
  IconSubtitle,
} from '../components/Icons';
import { Rail, Sheet, SheetOption, Confirm } from '../components/ui';

export default function Detail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { isFavorite, dispatch, toast, startDownload, state } = useStore();
  const t = TITLE_BY_ID[id];
  const [sheet, setSheet] = useState<null | 'quality' | 'subtitle'>(null);
  const [confirmDl, setConfirmDl] = useState(false);
  const [quality, setQuality] = useState('1080p');
  const [subLang, setSubLang] = useState('Off');
  const [expanded, setExpanded] = useState(false);

  const eps = useMemo(() => (t && t.episodes ? episodesFor(t) : []), [t]);

  if (!t) {
    return (
      <>
        <header className="topbar">
          <button className="icon-btn" onClick={() => nav(-1)}>
            <IconBack />
          </button>
          <div className="topbar-title">Not found</div>
        </header>
        <div className="scroll center" style={{ flex: 1, color: 'var(--text-3)' }}>
          Title not found
        </div>
      </>
    );
  }

  const fav = isFavorite(t.id);
  const inHistory = state.history.find((h) => h.titleId === t.id);
  const resume = inHistory ? inHistory.progress : 0;

  const similar = TITLES.filter(
    (x) => x.id !== t.id && x.genres.some((g) => t.genres.includes(g)),
  ).slice(0, 10);

  const cast = Array.from({ length: 8 }).map((_, i) => ({
    name: ['R. Steele', 'M. Okonkwo', 'A. Chen', 'L. Moreau', 'J. Park', 'S. Rahman', 'E. Novak', 'D. Cruz'][i],
    img: artwork(`cast${t.id}${i}`, 200, 200),
  }));

  const doDownload = () => {
    startDownload(t.id, { quality: quality as any });
    setConfirmDl(false);
  };

  return (
    <>
      <div className="scroll">
        <div className="detail-hero" style={{ backgroundImage: `url(${t.backdrop})` }}>
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
            <span className="rating-pill">
              <IconStar size={12} /> {t.rating.toFixed(1)}
            </span>
            <span>{t.year}</span>
            <i className="dot" style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-3)' }} />
            <span>{t.episodes ? `${t.episodes} Episodes` : t.duration}</span>
            <span className="pill">{t.quality}</span>
            <span className="pill">{t.type === 'tv' ? 'Series' : t.type === 'anime' ? 'Anime' : 'Movie'}</span>
          </div>

          <div className="detail-genres">
            {t.genres.map((g) => (
              <span key={g} className="chip">
                {g}
              </span>
            ))}
          </div>

          <div className="detail-synopsis clamp3" style={expanded ? { WebkitLineClamp: 'unset' } : undefined}>
            {t.synopsis} {t.synopsis} Set against a richly drawn world, the story builds toward a confrontation that will redefine everything the characters believed about loyalty, power, and the price of truth.
          </div>
          <button
            style={{ color: 'var(--accent-2)', fontSize: 12.5, fontWeight: 700, marginTop: 6 }}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>

          <div className="detail-actions">
            <button className="btn btn-primary" onClick={() => nav(`/player/${t.id}`)}>
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

          {/* Episodes */}
          {eps.length > 0 && (
            <>
              <div className="ep-head">
                <h3>Episodes</h3>
                <button
                  className="section-more"
                  onClick={() => {
                    startDownload(t.id, { episode: 1 });
                    toast('Downloading all episodes');
                  }}
                >
                  <IconDownload size={14} /> Download all
                </button>
              </div>
              <div className="ep-list">
                {eps.slice(0, 12).map((e) => {
                  const isCurrent = inHistory?.episode === e.no;
                  return (
                    <div key={e.id} className={`ep-row ${isCurrent ? 'active' : ''}`}>
                      <button
                        className="ep-thumb"
                        style={{ backgroundImage: `url(${e.thumb})` }}
                        onClick={() => nav(`/player/${t.id}?ep=${e.no}`)}
                        aria-label={`Play episode ${e.no}`}
                      >
                        <span className="poster-play" style={{ opacity: 1, width: 32, height: 32 }}>
                          <IconPlay size={15} />
                        </span>
                        {isCurrent && resume > 0 && (
                          <span className="pbar">
                            <i style={{ width: `${resume * 100}%` }} />
                          </span>
                        )}
                      </button>
                      <div className="ep-info">
                        <div className="ep-no">Episode {e.no}</div>
                        <div className="ep-name ellipsis">{e.title}</div>
                        <div className="ep-dur">{e.duration}</div>
                      </div>
                      <button
                        className="ep-dl"
                        onClick={() => startDownload(t.id, { episode: e.no })}
                        aria-label={`Download episode ${e.no}`}
                      >
                        <IconDownload size={20} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {eps.length > 12 && (
                <button
                  className="btn btn-outline btn-block"
                  style={{ marginTop: 12 }}
                  onClick={() => toast(`All ${eps.length} episodes listed`)}
                >
                  View all {eps.length} episodes
                </button>
              )}
            </>
          )}

          {/* Cast */}
          <div className="ep-head">
            <h3>Cast</h3>
          </div>
          <div className="cast-row">
            {cast.map((c) => (
              <div key={c.name} className="cast">
                <div className="cast-img" style={{ backgroundImage: `url(${c.img})` }} />
                <span className="cast-name">{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        <Rail
          title="More Like This"
          items={similar}
          onMore={() => nav(`/browse/${t.type}`)}
        />
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
          message={`Download "${t.title}" in ${quality}? ${t.episodes ? 'All episodes will be queued.' : ''}`}
          confirmLabel="Download"
          onConfirm={doDownload}
          onCancel={() => setConfirmDl(false)}
        />
      )}
    </>
  );
}
