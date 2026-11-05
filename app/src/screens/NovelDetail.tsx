import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NOVELS } from '../data/catalog';
import { useStore } from '../lib/store';
import {
  IconBack,
  IconStar,
  IconHeart,
  IconCheck,
  IconPlay,
} from '../components/Icons';

export default function NovelDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { isFavorite, dispatch, toast } = useStore();
  const n = NOVELS.find((x) => x.id === id);
  const [tab, setTab] = useState<'chapters' | 'about'>('chapters');

  if (!n) {
    return (
      <>
        <header className="topbar">
          <button className="icon-btn" onClick={() => nav(-1)}>
            <IconBack />
          </button>
          <div className="topbar-title">Not found</div>
        </header>
      </>
    );
  }

  const fav = isFavorite(n.id);
  const chapters = Array.from({ length: Math.min(40, n.chapters) }).map((_, i) => ({
    no: i + 1,
    title: ['Awakening', 'The First Trial', 'Blood Moon', 'Hidden Path', 'The Mentor', 'Storm Rising', 'Broken Chains', 'Ascension'][i % 8] + ` ${i + 1}`,
    date: `${1 + (i % 28)}d ago`,
  }));

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <IconBack />
        </button>
        <div className="topbar-title ellipsis">{n.title}</div>
        <button
          className="icon-btn"
          onClick={() => {
            dispatch({ type: 'toggleFav', id: n.id });
            toast(fav ? 'Removed from library' : 'Added to library');
          }}
          aria-label="Favorite"
        >
          {fav ? <IconCheck size={20} /> : <IconHeart size={20} />}
        </button>
      </header>

      <div className="scroll">
        <div className="novel-detail-head">
          <div className="novel-detail-cover" style={{ backgroundImage: `url(${n.cover})` }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2 }}>{n.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 6 }}>{n.author}</div>
            <div className="novel-stars" style={{ marginTop: 8, fontSize: 13 }}>
              <IconStar size={14} /> {n.rating.toFixed(1)}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {n.genres.map((g) => (
                <span key={g} className="chip">{g}</span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
              {n.chapters} chapters
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px' }}>
          <button
            className="btn btn-primary btn-block"
            onClick={() => toast('Opening reader…')}
          >
            <IconPlay size={17} /> Start Reading
          </button>
        </div>

        <div className="dl-tabs" style={{ marginTop: 16 }}>
          <button className={tab === 'chapters' ? 'active' : ''} onClick={() => setTab('chapters')}>
            Chapters
          </button>
          <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>
            About
          </button>
        </div>

        {tab === 'chapters' ? (
          <div style={{ marginTop: 6 }}>
            {chapters.map((c) => (
              <button
                key={c.no}
                className="chapter-row"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => toast(`Chapter ${c.no}`)}
              >
                <span className="num">{c.no}</span>
                <span className="ct ellipsis">{c.title}</span>
                <span className="cd">{c.date}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ padding: 16, color: 'var(--text-2)', fontSize: 13.5, lineHeight: 1.7 }}>
            {n.synopsis} The story unfolds across {n.chapters} chapters, weaving together intrigue,
            character growth, and high-stakes confrontations that keep readers turning pages late
            into the night.
          </div>
        )}
        <div style={{ height: 24 }} />
      </div>
    </>
  );
}
