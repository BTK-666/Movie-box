import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchStreams, isAdUrl, type Stream } from '../data/api';
import { getTitle } from '../data/cache';
import { useAsync } from '../lib/useAsync';
import { useStore } from '../lib/store';
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
} from '../components/Icons';
import { Sheet, SheetOption, Loading, ErrorState } from '../components/ui';

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Player() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { dispatch, toast } = useStore();

  const season = Number(sp.get('se')) || 0;
  const episode = Number(sp.get('ep')) || 0;
  const title = getTitle(id);

  const { data: streams, loading, error, reload } = useAsync(
    () => fetchStreams(id, season, episode),
    [id, season, episode],
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimer = useRef<number | null>(null);

  const [playing, setPlaying] = useState(true);
  const [pos, setPos] = useState(0);
  const [total, setTotal] = useState(0);
  const [muted, setMuted] = useState(false);
  const [controls, setControls] = useState(true);
  const [locked, setLocked] = useState(false);
  const [sheet, setSheet] = useState<null | 'quality' | 'speed' | 'subtitle'>(null);
  const [speed, setSpeed] = useState('1x');
  const [subLang, setSubLang] = useState('Off');
  const [failed, setFailed] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const triedRef = useRef<Set<string>>(new Set());
  const [hevcOk, setHevcOk] = useState<boolean | null>(null);

  // MovieBox ships most titles as HEVC (h265), which only decodes where the
  // device has an HEVC decoder. Probe once so we can prefer a source the device
  // can actually play instead of letting the first one fail.
  useEffect(() => {
    const v = document.createElement('video');
    const hevc = 'video/mp4; codecs="hvc1.1.6.L93.B0"';
    const avc = 'video/mp4; codecs="avc1.42E01E"';
    const canHevc = v.canPlayType(hevc);
    const canAvc = v.canPlayType(avc);
    setHevcOk(canHevc !== '' ? true : canAvc !== '' ? false : null);
  }, []);

  // Belt and braces: fetchStreams already drops promos, but a cached payload
  // from an older build could still carry one. An ad must never be played.
  const sorted = useMemo(() => {
    const list = (streams ?? []).filter((s) => !isAdUrl(s.url));
    if (hevcOk === false) {
      // No HEVC decoder: put H.264 first, keeping the resolution order inside
      // each codec group.
      const rank = (s: Stream) => (/h264|avc/i.test(s.codec) ? 0 : 1);
      return [...list].sort((a, b) => rank(a) - rank(b) || b.resolution - a.resolution);
    }
    return list;
  }, [streams, hevcOk]);
  const current: Stream | undefined = sorted[activeIdx] ?? sorted[0];

  const streamUrl = current?.url;

  // The source order can change once the HEVC probe finishes; restart from the
  // new best source instead of keeping a stale index.
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
      toast(`Switching source…`);
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
    const p = v.play();
    if (p && typeof p.catch === 'function') {
      p.then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [streamUrl]);

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

  if (!title) return <div className="player center">Not found</div>;

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

  return (
    <div className="player">
      <div
        className="player-stage"
        onClick={() => {
          if (locked) return;
          setControls((c) => !c);
        }}
      >
        <video
          ref={videoRef}
          className="video-el"
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

        {notice && (blocking || failed) && (
          <div className={`player-overlay${blocking ? '' : ' soft'}`}>
            {error ? (
              <ErrorState message={error} onRetry={reload} />
            ) : (
              <>
                {loading && <span className="spinner" />}
                <span>{notice}</span>
                {!loading && !error && !current && (
                  <button className="btn btn-ghost" onClick={() => nav(-1)}>
                    Go back
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div
          className={`player-controls ${controls && !locked ? '' : 'hidden'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="player-top">
            <button className="icon-btn" style={{ color: '#fff' }} onClick={() => nav(-1)} aria-label="Back">
              <IconBack />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="player-title ellipsis">{label}</div>
              <div className="player-sub ellipsis">
                {current ? `${current.quality}${current.sizeLabel ? ` · ${current.sizeLabel}` : ''} · ${speed}` : '—'}
                {subLang !== 'Off' ? ` · ${subLang}` : ' · No subtitles'}
              </div>
            </div>
            <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setSheet('subtitle')} aria-label="Subtitles">
              <IconSubtitle size={20} />
            </button>
          </div>

          <div className="player-center">
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

          <div className="player-bottom">
            <div className="player-scrub">
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
              <span>-{fmt(Math.max(0, total - pos))}</span>
            </div>
            <div className="player-tools">
              <button className="pt" onClick={() => setSheet('quality')}>
                {current?.quality ?? 'Auto'}
              </button>
              <button className="pt" onClick={() => setSheet('speed')}>
                {speed}
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
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                  else v.requestFullscreen?.().catch(() => toast('Fullscreen unavailable'));
                }}
                aria-label="Fullscreen"
              >
                <IconFullscreen size={17} />
              </button>
            </div>
          </div>
        </div>

        {controls && (
          <div className="player-lock">
            <button onClick={() => setLocked((l) => !l)} aria-label="Lock">
              {locked ? '🔒' : '🔓'}
            </button>
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
            <SheetOption key={s} active={speed === s} onClick={() => { setSpeed(s); setSheet(null); toast(`Speed: ${s}`); }}>
              {s}
            </SheetOption>
          ))}
        </Sheet>
      )}
      {sheet === 'subtitle' && (
        <Sheet title="Subtitles" onClose={() => setSheet(null)}>
          {['Off', 'English', 'हिन्दी', 'বাংলা', 'Español', 'العربية'].map((s) => (
            <SheetOption key={s} active={subLang === s} onClick={() => { setSubLang(s); setSheet(null); }}>
              {s}
            </SheetOption>
          ))}
        </Sheet>
      )}
    </div>
  );
}
