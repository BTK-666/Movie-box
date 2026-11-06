import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  fetchDetails,
  fetchUgcCollection,
  fetchTrending,
  type MediaDetails,
  type UgcEpisode,
} from '../data/api';
import { getDetails, rememberDetails, rememberTitle } from '../data/cache';
import { useCachedAsync, useAsync } from '../lib/useAsync';
import { backdropImage, optimizeImage } from '../lib/img';
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
  IconEye,
  IconInfo,
  IconChevronDown,
  IconFullscreen,
} from '../components/Icons';
import { Sheet, SheetOption, Loading, ErrorState, Rail } from '../components/ui';
import DownloadSheet from '../components/DownloadSheet';
import VideoPlayer from '../components/VideoPlayer';
import type { Title } from '../data/catalog';

export default function Detail() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { isFavorite, dispatch, toast, startDownload } = useStore();

  const [sheet, setSheet] = useState<null | 'quality' | 'subtitle' | 'download' | 'info' | 'season' | 'lang'>(
    null,
  );
  const [quality, setQuality] = useState('1080p');
  const [subLang, setSubLang] = useState('Off');
  const [expanded, setExpanded] = useState(false);
  const [season, setSeason] = useState(Number(sp.get('se')) || 1);
  const [dub, setDub] = useState(0);
  const [resolution, setResolution] = useState(0);
  const [feed, setFeed] = useState<'forYou' | 'comments'>('forYou');

  // Inline playback, YouTube-style: the hero turns into a 16:9 player and the
  // rest of the page stays below it. Fullscreen rotates to landscape.
  const [playing, setPlaying] = useState(false);
  const [playEp, setPlayEp] = useState(0);

  // Arriving from a "Play" button (?play=1) starts the inline player as soon as
  // the episode list resolves, without a second tap.
  const autoplayWanted = sp.get('play') === '1';
  const [autoplayDone, setAutoplayDone] = useState(false);

  const cached = getDetails(id);
  const { data, loading, error, reload } = useCachedAsync(`detail:${id}`, () => fetchDetails(id), [id], 10 * 60 * 1000);

  useEffect(() => {
    if (data) {
      rememberDetails(data);
      rememberTitle(data);
    }
  }, [data]);

  const t: MediaDetails | undefined = data ?? cached;
  const isSeries = !!t && t.seasons > 0;

  // Real per-episode files, sizes and durations live in the UGC collection.
  const { data: ugc, loading: ugcLoading } = useAsync(
    () => (isSeries ? fetchUgcCollection(id, season) : Promise.resolve(null)),
    [id, season, isSeries],
  );

  const episodes: UgcEpisode[] = useMemo(() => ugc?.episodes ?? [], [ugc]);
  const seasons = useMemo(() => {
    const n = t?.seasons ?? 0;
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [t?.seasons]);

  const resolutions = useMemo(() => {
    const fromEps = new Set<number>();
    for (const e of episodes) for (const r of e.resources) if (r.resolution) fromEps.add(r.resolution);
    const list = [...fromEps].sort((a, b) => b - a);
    return list.length ? list : [1080, 720, 480, 360];
  }, [episodes]);

  // Track the picker until the user touches it, so a late-arriving episode list
  // can raise the default to the highest resolution actually on offer.
  const [resPinned, setResPinned] = useState(false);
  useEffect(() => {
    if (resPinned) return;
    if (resolution === 0 || !resolutions.includes(resolution)) setResolution(resolutions[0]);
  }, [resolutions, resolution, resPinned]);

  // Kick off inline playback for a ?play=1 arrival. A series normally waits for
  // the episode list so it can start at episode 1 with a real source, but if the
  // list never arrives (offline, region block) it still starts rather than
  // leaving the user on a dead detail page.
  useEffect(() => {
    if (!autoplayWanted || autoplayDone || !t) return;
    if (isSeries && episodes.length === 0 && ugcLoading) return;
    setPlayEp(isSeries ? episodes[0]?.no ?? 1 : 0);
    setPlaying(true);
    setAutoplayDone(true);
  }, [autoplayWanted, autoplayDone, t, isSeries, episodes, ugcLoading]);

  // "For you" rail: mainstream titles that are not the current one.
  const { data: related } = useAsync<Title[]>(
    () => fetchTrending(),
    [id],
  );
  const forYou = useMemo(() => {
    const seen = new Set<string>();
    return (related ?? [])
      .filter((x) => {
        if (x.id === id || !x.poster || seen.has(x.title)) return false;
        seen.add(x.title);
        return true;
      })
      .slice(0, 12);
  }, [related, id]);

  const cast = useMemo(() => {
    const seen = new Set<string>();
    return (t?.cast ?? []).filter((c) => {
      const k = c.name.trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [t?.cast]);

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
  const playUrl = isSeries
    ? `/player/${t.id}?se=${season}&ep=1&res=${resolution}`
    : `/player/${t.id}?res=${resolution}`;

  const startPlay = () => {
    setPlayEp(isSeries ? 1 : 0);
    setPlaying(true);
  };

  const playEpisode = (ep: UgcEpisode) => {
    setPlayEp(ep.no);
    setSeason(ep.season);
    setPlaying(true);
  };

  const openFullPlayer = () => {
    if (!playing) return;
    nav(playUrl);
  };

  const doDownload = (list: UgcEpisode[], res: number) => {
    for (const ep of list) {
      const r = ep.resources.find((x) => x.resolution === res) ?? ep.resources[0];
      startDownload(t.id, {
        episode: ep.no,
        season: ep.season,
        quality: res >= 2160 ? '4K' : (`${res}p` as '1080p' | '720p' | '480p'),
        size: r?.sizeLabel,
        label: `${t.title} — S${String(ep.season).padStart(2, '0')}E${String(ep.no).padStart(2, '0')}`,
      });
    }
    setSheet(null);
    toast(list.length > 1 ? `${list.length} episodes queued` : 'Download started');
  };

  return (
    <>
      <div className="scroll">
        {playing ? (
          <div className="detail-inline-player">
            <VideoPlayer
              key={`${t.id}-${season}-${playEp}`}
              titleId={t.id}
              season={isSeries ? season : 0}
              episode={playEp}
              requestedRes={resolution}
              variant="inline"
              onBack={() => setPlaying(false)}
              onNext={
                isSeries && episodes.some((e) => e.no === playEp + 1)
                  ? () => setPlayEp((n) => n + 1)
                  : undefined
              }
            />
          </div>
        ) : (
          <div
            className="detail-hero"
            style={{ backgroundImage: `url(${backdropImage(t.backdrop, window.innerWidth)})` }}
          >
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
        )}

        <div className="detail-body fade-in">
          <div className="detail-title-row">
            <div className="detail-title">{t.title}</div>
            <button className="info-btn" onClick={() => setSheet('info')}>
              Info <IconInfo size={13} />
            </button>
          </div>

          <div className="detail-meta">
            {t.rating > 0 && (
              <span className="rating-pill">
                <IconStar size={12} /> {t.rating.toFixed(1)}
              </span>
            )}
            {t.year > 0 && <span>{t.year}</span>}
            {t.country && <span>{t.country}</span>}
            <span>{isSeries ? 'Series' : 'Movie'}</span>
            {isSeries && (
              <span className="pill">
                {t.seasons} season{t.seasons > 1 ? 's' : ''}
              </span>
            )}
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

          <div className="detail-actions">
            <button className="btn btn-primary" onClick={startPlay}>
              <IconPlay size={17} /> {playing ? 'Playing' : isSeries ? 'Play S1 E1' : 'Play'}
            </button>
            {playing && (
              <button className="btn btn-ghost" onClick={openFullPlayer}>
                <IconFullscreen size={17} /> Full screen
              </button>
            )}
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
            <button className="act" onClick={() => toast('Link copied')}>
              <IconShare size={19} /> Share
            </button>
            <button className="act" onClick={() => setSheet('download')}>
              <IconDownload size={19} /> Download
            </button>
            <button className="act" onClick={() => setSheet('quality')}>
              <IconEye size={19} /> View
            </button>
          </div>

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

          <div className="detail-resource-line">
            {ugc?.uploader ? `Resources Uploaded by ${ugc.uploader}` : 'Resources'}
          </div>

          <div className="detail-selects">
            {t.dubs.length > 0 && (
              <button className="chip select-chip" onClick={() => setSheet('lang')}>
                {t.dubs[dub]?.label || t.dubs[dub]?.language || 'Original Audio'} <IconChevronDown size={13} />
              </button>
            )}
            {isSeries && seasons.length > 0 && (
              <button className="chip select-chip" onClick={() => setSheet('season')}>
                Season {String(season).padStart(2, '0')} <IconChevronDown size={13} />
              </button>
            )}
          </div>

          {isSeries && (
            <>
              <div className="season-row">
                {seasons.map((s) => (
                  <button
                    key={s}
                    className={`chip ${season === s ? 'active' : ''}`}
                    onClick={() => setSeason(s)}
                  >
                    Season {s}
                  </button>
                ))}
              </div>

              <div className="ep-chips">
                <button className="ep-chip all" onClick={() => setSheet('download')}>
                  All
                </button>
                {episodes.slice(0, 24).map((ep) => (
                  <button key={ep.id} className="ep-chip" onClick={() => playEpisode(ep)}>
                    {String(ep.no).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="detail-feed">
            <div className="feed-tabs">
              <button
                className={`feed-tab ${feed === 'forYou' ? 'active' : ''}`}
                onClick={() => setFeed('forYou')}
              >
                For you
              </button>
              <button
                className={`feed-tab ${feed === 'comments' ? 'active' : ''}`}
                onClick={() => setFeed('comments')}
              >
                Comments{forYou.length > 0 ? '(99+)' : ''}
              </button>
            </div>
            {feed === 'forYou' ? (
              forYou.length > 0 ? (
                <Rail title="" items={forYou} />
              ) : (
                <div className="feed-empty">Nothing to recommend yet</div>
              )
            ) : (
              <div className="feed-empty">
                Comments are not available for this title right now.
              </div>
            )}
          </div>

          {cast.length > 0 && (
            <>
              <div className="ep-head">
                <h3>Cast</h3>
              </div>
              <div className="cast-row">
                {cast.map((c, i) => (
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

      {sheet === 'download' && (
        <DownloadSheet
          title={t.title}
          uploader={ugc?.uploader}
          seasons={seasons}
          season={season}
          onSeason={setSeason}
          dubs={t.dubs}
          dub={dub}
          onDub={setDub}
          episodes={episodes}
          loading={ugcLoading}
          resolutions={resolutions}
          resolution={resolution}
          onResolution={(r) => { setResPinned(true); setResolution(r); }}
          onClose={() => setSheet(null)}
          onDownload={doDownload}
        />
      )}

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

      {sheet === 'season' && (
        <Sheet title="Select Season" onClose={() => setSheet(null)}>
          {seasons.map((s) => (
            <SheetOption
              key={s}
              active={season === s}
              onClick={() => {
                setSeason(s);
                setSheet(null);
              }}
            >
              Season {String(s).padStart(2, '0')}
            </SheetOption>
          ))}
        </Sheet>
      )}

      {sheet === 'lang' && (
        <Sheet title="Select Language" onClose={() => setSheet(null)}>
          {t.dubs.map((d, i) => (
            <SheetOption
              key={`${d.subjectId}-${i}`}
              active={dub === i}
              onClick={() => {
                setDub(i);
                setSheet(null);
              }}
            >
              {d.label || d.language || 'Original Audio'}
            </SheetOption>
          ))}
        </Sheet>
      )}

      {sheet === 'info' && (
        <Sheet title="Info" onClose={() => setSheet(null)}>
          <div className="sheet-info">
            <div className="sheet-info-row">
              <span>Type</span>
              <b>{isSeries ? `Series · ${t.seasons} season${t.seasons > 1 ? 's' : ''}` : 'Movie'}</b>
            </div>
            {t.year > 0 && (
              <div className="sheet-info-row">
                <span>Year</span>
                <b>{t.year}</b>
              </div>
            )}
            {t.country && (
              <div className="sheet-info-row">
                <span>Country</span>
                <b>{t.country}</b>
              </div>
            )}
            {t.duration && (
              <div className="sheet-info-row">
                <span>Duration</span>
                <b>{t.duration}</b>
              </div>
            )}
            {t.genres.length > 0 && (
              <div className="sheet-info-row">
                <span>Genres</span>
                <b>{t.genres.join(', ')}</b>
              </div>
            )}
            {ugc?.uploader && (
              <div className="sheet-info-row">
                <span>Uploaded by</span>
                <b>{ugc.uploader}</b>
              </div>
            )}
            <div className="sheet-info-row">
              <span>Audio</span>
              <b>{t.dubs.length ? t.dubs.map((d) => d.label || d.language).join(', ') : 'Original'}</b>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
