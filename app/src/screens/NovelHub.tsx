import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NOVELS } from '../data/catalog';
import { IconSearch, IconStar, IconChevronRight } from '../components/Icons';

const GENRES = ['All', 'Xianxia', 'Romance', 'Sci-Fi', 'Fantasy', 'Martial Arts'];

export default function NovelHub() {
  const nav = useNavigate();
  const [genre, setGenre] = useState('All');
  const [q, setQ] = useState('');

  const list = NOVELS.filter(
    (n) =>
      (genre === 'All' || n.genres.includes(genre)) &&
      (q.trim() === '' || n.title.toLowerCase().includes(q.toLowerCase())),
  );

  const featured = NOVELS[0];

  return (
    <>
      <header className="topbar">
        <div className="topbar-spacer" />
        <div className="topbar-title">NovelHub</div>
        <button className="icon-btn" onClick={() => nav('/search')} aria-label="Search">
          <IconSearch size={20} />
        </button>
      </header>

      <div className="scroll">
        <div
          className="hero"
          style={{ backgroundImage: `url(${featured.cover})`, aspectRatio: '16/9' }}
          onClick={() => nav(`/novels/${featured.id}`)}
        >
          <div className="hero-body">
            <span className="hero-badge">FEATURED NOVEL</span>
            <div className="hero-title">{featured.title}</div>
            <div className="hero-meta">
              <span>{featured.author}</span>
              <i className="dot" />
              <span>{featured.chapters} chapters</span>
            </div>
          </div>
        </div>

        <div className="chip-row" style={{ marginTop: 16 }}>
          {GENRES.map((g) => (
            <button key={g} className={`chip ${genre === g ? 'active' : ''}`} onClick={() => setGenre(g)}>
              {g}
            </button>
          ))}
        </div>

        <div className="novel-grid">
          {list.map((n) => (
            <button key={n.id} className="novel-card" style={{ textAlign: 'left' }} onClick={() => nav(`/novels/${n.id}`)}>
              <div className="novel-cover" style={{ backgroundImage: `url(${n.cover})` }} />
              <div className="novel-info">
                <div className="novel-title clamp2">{n.title}</div>
                <div className="novel-author ellipsis">{n.author}</div>
                <div className="novel-stars">
                  <IconStar size={11} /> {n.rating.toFixed(1)}
                </div>
                <div className="novel-ch">{n.chapters} ch</div>
              </div>
            </button>
          ))}
        </div>
        {list.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>No novels found</div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </>
  );
}
