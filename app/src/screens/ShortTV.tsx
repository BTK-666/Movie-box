import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchShorts, type ShortItem } from '../data/api';
import { optimizeImage } from '../lib/img';
import { useAsync } from '../lib/useAsync';
import { useStore } from '../lib/store';
import { Loading, ErrorState } from '../components/ui';
import {
  IconBack,
  IconHeart,
  IconPlus,
  IconShare,
  IconPlay,
  IconVolume,
  IconMute,
} from '../components/Icons';

export default function ShortTV() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { toast } = useStore();
  const [idx, setIdx] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const startY = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [page, setPage] = useState(1);
  const [extra, setExtra] = useState<ShortItem[]>([]);
  const { data, loading, error, reload } = useAsync(() => fetchShorts(1, 20), []);
  const list: ShortItem[] = useMemo(() => [...(data ?? []), ...extra], [data, extra]);
  const s = list[idx];

  // Deep link from the home rail: `/shorts?i=<index>`.
  const start = Number(sp.get('i'));
  useEffect(() => {
    if (Number.isFinite(start) && start > 0) setIdx(start);
  }, [start]);

  // Fetch the next page a little before the end so the feed never stalls.
  useEffect(() => {
    if (!list.length) return;
    if (idx < list.length - 3) return;
    let cancelled = false;
    const next = page + 1;
    fetchShorts(next, 20)
      .then((more) => {
        if (cancelled || !more.length) return;
        setExtra((prev) => {
          const seen = new Set([...(data ?? []), ...prev].map((x) => x.id));
          return [...prev, ...more.filter((m) => !seen.has(m.id))];
        });
        setPage(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idx, list.length, page, data]);

  const go = useCallback(
    (dir: number) => {
      setIdx((i) => Math.max(0, Math.min(list.length - 1, i + dir)));
    },
    [list.length],
  );

  // Autoplay the active short. The element is keyed by URL, so this only has to
  // kick playback off after a swipe.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => setPaused(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.videoUrl]);

  if (loading && !list.length) {
    return (
      <div className="shorts-wrap">
        <Loading label="Loading shorts…" />
      </div>
    );
  }

  if (error && !list.length) {
    return (
      <div className="shorts-wrap">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  if (!s) {
    return (
      <div className="shorts-wrap">
        <div className="empty">
          <div className="empty-title">No shorts available</div>
          <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => nav('/')}>
            Go home
          </button>
        </div>
      </div>
    );
  }

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <div className="shorts-wrap">
      <div
        className="short-slide"
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > 30) go(e.deltaY > 0 ? 1 : -1);
        }}
        onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
        onTouchEnd={(e) => {
          if (startY.current == null) return;
          const dy = e.changedTouches[0].clientY - startY.current;
          if (Math.abs(dy) > 50) go(dy < 0 ? 1 : -1);
          startY.current = null;
        }}
      >
        <video
          key={s.videoUrl}
          ref={videoRef}
          className="short-video"
          src={s.videoUrl}
          poster={optimizeImage(s.cover, 720)}
          playsInline
          loop
          muted={muted}
          preload="metadata"
          onClick={togglePlay}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onError={() => {
            // A dead short should not trap the user on a black screen.
            if (idx < list.length - 1) setIdx((i) => i + 1);
          }}
        />

        {paused && (
          <button className="short-pause" onClick={togglePlay} aria-label="Play">
            <IconPlay size={40} />
          </button>
        )}

        <div className="short-top">
          <button className="icon-btn" style={{ color: '#fff' }} onClick={() => nav('/')} aria-label="Back">
            <IconBack />
          </button>
          <span className="t">Shorts</span>
          <span className="spacer" />
          <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setMuted((m) => !m)} aria-label="Mute">
            {muted ? <IconMute size={20} /> : <IconVolume size={20} />}
          </button>
        </div>

        <div className="short-side">
          <button className="s" onClick={() => setLiked((l) => ({ ...l, [s.id]: !l[s.id] }))}>
            <span className="ic" style={{ color: liked[s.id] ? 'var(--accent-2)' : '#fff' }}>
              <IconHeart size={22} fill={liked[s.id] ? 'currentColor' : 'none'} />
            </span>
            {s.likes > 0 ? s.likes : liked[s.id] ? 'Liked' : 'Like'}
          </button>
          <button className="s" onClick={() => toast('Saved to My List')}>
            <span className="ic">
              <IconPlus size={22} />
            </span>
            Save
          </button>
          <button className="s" onClick={() => toast('Link copied')}>
            <span className="ic">
              <IconShare size={20} />
            </span>
            Share
          </button>
        </div>

        <div className="short-info">
          {s.groupName && <div className="short-show">{s.groupName}</div>}
          <div className="short-cap">{s.title}</div>
          <span className="short-ep">
            <IconPlay size={12} /> {s.author}
          </span>
        </div>

        <div className="short-progress">
          {list.slice(0, 12).map((_, i) => (
            <i key={i} className="on" style={{ ['--p' as any]: i < idx ? '100%' : i === idx ? '45%' : '0%' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
