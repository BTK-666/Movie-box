import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TITLE_BY_ID } from '../data/catalog';
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
import { Sheet, SheetOption } from '../components/ui';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Player() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { dispatch, toast } = useStore();
  const t = TITLE_BY_ID[id];

  const [playing, setPlaying] = useState(true);
  const [pos, setPos] = useState(12);
  const [muted, setMuted] = useState(false);
  const [controls, setControls] = useState(true);
  const [locked, setLocked] = useState(false);
  const [sheet, setSheet] = useState<null | 'quality' | 'speed' | 'subtitle'>(null);
  const [quality, setQuality] = useState('1080p');
  const [speed, setSpeed] = useState('1x');
  const [subLang, setSubLang] = useState('English');
  const hideTimer = useRef<number | null>(null);

  const total = t ? (t.type === 'movie' ? 7200 : 2700) : 3600;
  const ep = sp.get('ep');

  useEffect(() => {
    if (!playing) return;
    const iv = window.setInterval(() => setPos((p) => Math.min(total, p + 1)), 1000);
    return () => window.clearInterval(iv);
  }, [playing, total]);

  useEffect(() => {
    if (!t) return;
    const item = {
      id: `${t.id}-${ep ?? 'main'}`,
      titleId: t.id,
      episode: ep ? Number(ep) : undefined,
      progress: 0,
      watchedAt: Date.now(),
    };
    dispatch({ type: 'pushHistory', item });
    return () => {
      dispatch({
        type: 'pushHistory',
        item: { ...item, progress: pos / total, watchedAt: Date.now() },
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (controls && playing) {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setControls(false), 3500);
    } else if (!playing) {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    }
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [controls, playing]);

  if (!t) return <div className="player center">Not found</div>;

  const pct = (pos / total) * 100;

  return (
    <div className="player">
      <div
        className="player-stage"
        onClick={() => {
          if (locked) return;
          setControls((c) => !c);
        }}
      >
        <div className="video" style={{ backgroundImage: `url(${t.backdrop})` }} />

        <div
          className={`player-controls ${controls && !locked ? '' : 'hidden'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="player-top">
            <button className="icon-btn" style={{ color: '#fff' }} onClick={() => nav(-1)} aria-label="Back">
              <IconBack />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="player-title ellipsis">
                {t.title} {ep ? `· E${ep}` : ''}
              </div>
              <div className="player-sub ellipsis">
                {quality} · {speed} · {subLang !== 'Off' ? subLang : 'No subtitles'}
              </div>
            </div>
            <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setSheet('subtitle')} aria-label="Subtitles">
              <IconSubtitle size={20} />
            </button>
          </div>

          <div className="player-center">
            <button className="pc" onClick={() => setPos((p) => Math.max(0, p - 10))} aria-label="Back 10s">
              <IconSkipBack size={24} />
            </button>
            <button className="pc main" onClick={() => setPlaying((p) => !p)} aria-label="Play/pause">
              {playing ? <IconPause size={28} /> : <IconPlay size={28} />}
            </button>
            <button className="pc" onClick={() => setPos((p) => Math.min(total, p + 10))} aria-label="Forward 10s">
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
                  setPos(((e.clientX - r.left) / r.width) * total);
                }}
              >
                <i style={{ width: `${pct}%` }} />
                <b style={{ left: `${pct}%` }} />
              </div>
              <span>-{fmt(total - pos)}</span>
            </div>
            <div className="player-tools">
              <button className="pt" onClick={() => setSheet('quality')}>
                {quality}
              </button>
              <button className="pt" onClick={() => setSheet('speed')}>
                {speed}
              </button>
              <button className="pt" onClick={() => setMuted((m) => !m)} aria-label="Mute">
                {muted ? <IconMute size={17} /> : <IconVolume size={17} />}
              </button>
              <span className="spacer" />
              <button className="pt" onClick={() => toast('Casting…')} aria-label="Cast">
                <IconCast size={17} />
              </button>
              <button className="pt" onClick={() => setSheet('quality')} aria-label="Settings">
                <IconSettings size={17} />
              </button>
              <button className="pt" onClick={() => toast('Fullscreen')} aria-label="Fullscreen">
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
          {['4K', '1080p', '720p', '480p', 'Auto'].map((q) => (
            <SheetOption key={q} active={quality === q} onClick={() => { setQuality(q); setSheet(null); toast(`Quality: ${q}`); }}>
              {q}
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
