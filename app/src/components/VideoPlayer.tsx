import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchStreams, fetchUgcCollection, isAdUrl, type Stream } from '../data/api';
import { getTitle } from '../data/cache';
import { useAsync } from '../lib/useAsync';
import { useStore } from '../lib/store';
import { lockLandscape, unlockOrientation } from '../lib/orientation';
import {
  IconBack,
  IconPlay,
  IconPause,
  IconSkip,
  IconSkipBack,
  IconVolume,
  IconMute,
  IconFullscreen,
  IconSubtitle,
  IconSettings,
  IconCast,
  IconLock,
  IconUnlock,
  IconGlobe,
  IconFit,
} from './Icons';
import { Sheet, SheetOption } from './ui';

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

export interface VideoPlayerProps {
  titleId: string;
  season?: number;
  episode?: number;
  /** Resolution the user picked on the detail screen, honoured before anything else. */
  requestedRes?: number;
  /** `inline` keeps a 16:9 box in the page flow; `full` fills the viewport. */
  variant?: 'inline' | 'full';
  onBack?: () => void;
  /** Called when the user taps the stage in inline mode (e.g. to collapse it). */
  onNext?: () => void;
  /** Start playing as soon as a source resolves. */
  autoPlay?: boolean;
}

/**
 * The one video surface used by both the detail page (inline) and the player
 * route (full). Fullscreen is a state toggle rather than only the Fullscreen
 * API: inside the Android WebView the API is unreliable, but a fixed-position
 * overlay plus an orientation lock always rotates to landscape.
 */
export default function VideoPlayer({
  titleId,
  season = 0,
  episode = 0,
  requestedRes = 0,
  variant = 'full',
  onBack,
  onNext,
  autoPlay = true,
}: VideoPlayerProps) {
  const { dispatch, toast } = useStore();
  const title = getTitle(titleId);

  const { data: streams, loading, error, reload } = useAsync(
    () => fetchStreams(titleId, season, episode),
    [titleId, season, episode],
  );

  const { data: ugc } = useAsync(
    () => (episode ? fetchUgcCollection(titleId, season) : Promise.resolve(null)),
    [titleId, season, episode],
  );
  const nextEp = useMemo(() => ugc?.episodes.find((e) => e.no === episode + 1), [ugc, episode]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimer = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [total, setTotal] = useState(0);
  const [muted, setMuted] = useState(false);
  const [controls, setControls] = useState(true);
  const [locked, setLocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(variant === 'full');
  const [sheet, setSheet] = useState<null | 'quality' | 'speed' | 'subtitle'>(null);
  const [speed, setSpeed] = useState('1x');
  const [subLang, setSubLang] = useState('Off');
  const [failed, setFailed] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const triedRef = useRef<Set<string>>(new Set());
  const [hevcOk, setHevcOk] = useState<boolean | null>(null);

  // MovieBox ships most titles as HEVC (h265), which only decodes where the
  // device has an HEVC decoder. Probe once so we can prefer a source the device
  // can actually play instead of letting the first one fail.
  useEffect(() => {
    const v = document.createElement('video');
    const canHevc = v.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"');
    const canAvc = v.canPlayType('video/mp4; codecs="avc1.42E01E"');
    setHevcOk(canHevc !== '' ? true : canAvc !== '' ? false : null);
  }, []);

  // fetchStreams already drops promos, but a cached payload from an older build
  // could still carry one. An ad must never be played.
  const sorted = useMemo(() => {
    const list = (streams ?? []).filter((s) => !isAdUrl(s.url));
    const compat = (s: Stream) => (/h264|avc/i.test(s.codec) ? 0 : 1);
    const rank = (s: Stream) =>
      (requestedRes > 0 ? Math.abs(s.resolution - requestedRes) : 0) * 1000 +
      (hevcOk === false ? compat(s) : 0) * 100 -
      s.resolution / 100;
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [streams, hevcOk, requestedRes]);
  const current: Stream | undefined = sorted[activeIdx] ?? sorted[0];
  const streamUrl = current?.url;

  // The source order changes once the HEVC probe finishes; restart from the new
  // best source instead of keeping a stale index.
  useEffect(() => {
    setActiveIdx(0);
    triedRef.current.clear();
    setFailed(false);
  }, [streams, hevcOk]);

  // HEVC-only titles can fail on devices without an HEVC decoder; fall through
  // to the next source before giving up.
  const onSourceError = useCallback(() => {
    const s = sorted[activeIdx];
    if (s) triedRef.current.add(s.id);
    const next = sorted.findIndex((x, i) => i !== activeIdx && !triedRef.current.has(x.id));
    if (next >= 0) {
      toast('Switching source…');
      setActiveIdx(next);
    } else {
      setFailed(true);
    }
  }, [sorted, activeIdx, toast]);

  // History is written once per title/episode, not on every position tick.
  const historyRef = useRef({ id: '', progress: 0 });
  useEffect(() => {
    if (!title) return;
    historyRef.current = { id: title.id, progress: 0 };
    dispatch({
      type: 'pushHistory',
      item: {
        id: `${title.id}-${season}-${episode}`,
        titleId: title.id,
        episode: episode || undefined,
        progress: 0,
        watchedAt: Date.now(),
      },
    });
    return () => {
      dispatch({
        type: 'pushHistory',
        item: {
          id: `${title.id}-${season}-${episode}`,
          titleId: title.id,
          episode: episode || undefined,
          progress: historyRef.current.progress,
          watchedAt: Date.now(),
        },
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title?.id, season, episode]);

  useEffect(() => {
    if (!streamUrl) return;
    setFailed(false);
    const v = videoRef.current;
    if (!v) return;
    v.load();
    if (!autoPlay) return;
    const p = v.play();
    if (p && typeof p.catch === 'function') {
      p.then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [streamUrl, autoPlay]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const rate = Number.parseFloat(speed);
    v.playbackRate = Number.isFinite(rate) ? rate : 1;
  }, [speed, streamUrl]);

  useEffect(() => {
    if (controls && playing && !locked) {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setControls(false), 3500);
    }
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [controls, playing, locked]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => toast('Playback blocked'));
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [toast]);

  const seekBy = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || total, v.currentTime + delta));
  };

  const seekToFraction = (f: number) => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration || total;
    if (d > 0) v.currentTime = Math.max(0, Math.min(1, f)) * d;
  };

  const enterFullscreen = useCallback(async () => {
    setFullscreen(true);
    await lockLandscape();
    try {
      await stageRef.current?.requestFullscreen?.();
    } catch {
      /* the fixed-position overlay is the fallback */
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    setFullscreen(variant === 'full');
    await unlockOrientation();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }, [variant]);

  // Keep the state in step when fullscreen is left with the system gesture or
  // the hardware back button.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && variant === 'inline') {
        setFullscreen(false);
        void unlockOrientation();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [variant]);

  // Never leave the device rotated after the player goes away.
  useEffect(() => () => void unlockOrientation(), []);

  if (!title) return <div className="vp center">Not found</div>;

  const pct = total > 0 ? (pos / total) * 100 : 0;
  const label = episode ? `${title.title} · S${season} E${episode}` : title.title;

  // Only cover the video while loading or when there is nothing to play; a
  // transient decode hiccup should not hide a working stream behind an overlay.
  const blocking = loading || error || !current;
  const notice = loading
    ? 'Loading stream…'
    : error
      ? error
      : !current
        ? 'This title has no playable source on this tier'
        : failed
          ? 'This source failed to load — try another quality'
          : null;

  const classes = ['vp', `vp-${variant}`];
  if (fullscreen) classes.push('vp-fs');

  return (
    <div className={classes.join(' ')}>
      <div
        ref={stageRef}
        className="vp-stage"
        onClick={() => {
          if (locked) return;
          setControls((c) => !c);
        }}
      >
        <video
          ref={videoRef}
          className="vp-el"
          style={{ objectFit: fit }}
          src={streamUrl}
          poster={title.backdrop}
          playsInline
          muted={muted}
          preload="metadata"
          onLoadedMetadata={(e) => setTotal(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setPos(t);
            if (historyRef.current.id === title.id) {
              const d = e.currentTarget.duration || 0;
              historyRef.current.progress = d > 0 ? t / d : 0;
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={onSourceError}
        />

        {!playing && !blocking && !failed && (
          <button className="vp-bigplay" onClick={togglePlay} aria-label="Play">
            <IconPlay size={30} />
          </button>
        )}

        {notice && (blocking || failed) && (
          <div className={`vp-overlay${blocking ? '' : ' soft'}`}>
            {error ? (
              <button className="btn btn-ghost" onClick={reload}>
                Retry
              </button>
            ) : (
              <>
                {loading && <span className="spinner" />}
                <span>{notice}</span>
                {!loading && !error && !current && (
                  <button className="btn btn-ghost" onClick={() => (onBack ? onBack() : undefined)}>
                    Go back
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div
          className={`vp-controls ${controls && !locked ? '' : 'hidden'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="vp-top">
            <button className="icon-btn" style={{ color: '#fff' }} onClick={onBack} aria-label="Back">
              <IconBack />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vp-title ellipsis">{label}</div>
              <div className="vp-sub ellipsis">
                {current
                  ? `${current.quality}${current.sizeLabel ? ` · ${current.sizeLabel}` : ''} · ${speed}`
                  : '—'}
                {subLang !== 'Off' ? ` · ${subLang}` : ' · No subtitles'}
              </div>
            </div>
            {onNext && nextEp && (
              <button className="vp-next" onClick={onNext}>
                Next <IconSkip size={14} />
              </button>
            )}
            <button
              className="icon-btn"
              style={{ color: '#fff' }}
              onClick={() => setSheet('subtitle')}
              aria-label="Subtitles"
            >
              <IconSubtitle size={20} />
            </button>
          </div>

          <div className="vp-center">
            <button className="pc" onClick={() => seekBy(-10)} aria-label="Back 10s">
              <IconSkipBack size={24} />
            </button>
            <button className="pc main" onClick={togglePlay} aria-label="Play/pause">
              {playing ? <IconPause size={28} /> : <IconPlay size={28} />}
            </button>
            <button className="pc" onClick={() => seekBy(10)} aria-label="Forward 10s">
              <IconSkip size={24} />
            </button>
          </div>

          <div className="vp-bottom">
            <div className="vp-scrub">
              <span>{fmt(pos)}</span>
              <div
                className="track"
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  seekToFraction((e.clientX - r.left) / r.width);
                }}
              >
                <i style={{ width: `${pct}%` }} />
                <b style={{ left: `${pct}%` }} />
              </div>
              <span>{fmt(total)}</span>
            </div>
            <div className="vp-tools">
              <button className="pt" onClick={() => setSheet('quality')}>
                {current?.quality ?? 'Auto'}
              </button>
              <button className="pt" onClick={() => setSheet('speed')}>
                {speed}
              </button>
              <button
                className="pt"
                onClick={() => setFit((f) => (f === 'contain' ? 'cover' : 'contain'))}
                aria-label="Fit"
              >
                <IconFit size={16} /> Fit
              </button>
              <button className="pt" onClick={() => setSheet('subtitle')} aria-label="Language">
                <IconGlobe size={16} /> Language
              </button>
              <button
                className="pt"
                onClick={() => {
                  const v = videoRef.current;
                  const next = !muted;
                  setMuted(next);
                  if (v) v.muted = next;
                }}
                aria-label="Mute"
              >
                {muted ? <IconMute size={17} /> : <IconVolume size={17} />}
              </button>
              <span className="spacer" />
              <button className="pt" onClick={() => toast('Casting…')} aria-label="Cast">
                <IconCast size={17} />
              </button>
              <button className="pt" onClick={() => setSheet('quality')} aria-label="Settings">
                <IconSettings size={17} />
              </button>
              <button
                className="pt"
                onClick={() => (fullscreen ? void exitFullscreen() : void enterFullscreen())}
                aria-label="Fullscreen"
              >
                <IconFullscreen size={17} />
              </button>
            </div>
          </div>
        </div>

        {controls && (
          <div className="vp-lock">
            <button onClick={() => setLocked((l) => !l)} aria-label="Lock">
              {locked ? <IconLock size={20} /> : <IconUnlock size={20} />}
            </button>
            {!locked && <span className="vp-lock-hint">Tap to Lock</span>}
          </div>
        )}
      </div>

      {sheet === 'quality' && (
        <Sheet title="Quality" onClose={() => setSheet(null)}>
          {sorted.length === 0 && <div className="sheet-empty">No sources available</div>}
          {sorted.map((s) => (
            <SheetOption
              key={s.id}
              active={current?.id === s.id}
              onClick={() => {
                setActiveIdx(sorted.indexOf(s));
                setFailed(false);
                setSheet(null);
                toast(`Quality: ${s.quality}`);
              }}
            >
              {s.quality}
              {s.sizeLabel ? ` · ${s.sizeLabel}` : ''}
              {s.codec ? ` · ${s.codec}` : ''}
            </SheetOption>
          ))}
        </Sheet>
      )}
      {sheet === 'speed' && (
        <Sheet title="Playback Speed" onClose={() => setSheet(null)}>
          {['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'].map((s) => (
            <SheetOption
              key={s}
              active={speed === s}
              onClick={() => {
                setSpeed(s);
                setSheet(null);
                toast(`Speed: ${s}`);
              }}
            >
              {s}
            </SheetOption>
          ))}
        </Sheet>
      )}
      {sheet === 'subtitle' && (
        <Sheet title="Subtitles" onClose={() => setSheet(null)}>
          {['Off', 'English', 'हिन्दी', 'বাংলা', 'Español', 'العربية'].map((s) => (
            <SheetOption
              key={s}
              active={subLang === s}
              onClick={() => {
                setSubLang(s);
                setSheet(null);
              }}
            >
              {s}
            </SheetOption>
          ))}
        </Sheet>
      )}
    </div>
  );
}
