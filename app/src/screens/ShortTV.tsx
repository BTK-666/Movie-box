import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SHORTS } from '../data/catalog';
import { useStore } from '../lib/store';
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
  const { toast } = useStore();
  const [idx, setIdx] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [muted, setMuted] = useState(false);
  const [prog, setProg] = useState(0);
  const startY = useRef<number | null>(null);

  const s = SHORTS[idx];

  const go = (dir: number) => {
    const next = Math.max(0, Math.min(SHORTS.length - 1, idx + dir));
    setIdx(next);
    setProg(0);
  };

  React.useEffect(() => {
    const iv = window.setInterval(() => {
      setProg((p) => (p >= 100 ? (go(1), 0) : p + 2));
    }, 120);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  return (
    <div className="shorts-wrap">
      <div
        className="short-slide"
        style={{ backgroundImage: `url(${s.thumb})` }}
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
            {liked[s.id] ? 'Liked' : s.likes}
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
          <button className="s" onClick={() => nav(`/detail/${'sh0' + ((idx % 4) + 1)}`)}>
            <span className="ic">
              <IconPlay size={20} />
            </span>
            Full
          </button>
        </div>

        <div className="short-info">
          <div className="short-show">{s.show}</div>
          <div className="short-cap">{s.title}</div>
          <span className="short-ep">
            <IconPlay size={12} /> Episode {s.episode}
          </span>
        </div>

        <div className="short-progress">
          {SHORTS.map((_, i) => (
            <i key={i} className="on" style={{ ['--p' as any]: i < idx ? '100%' : i === idx ? `${prog}%` : '0%' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
