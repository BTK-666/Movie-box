import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHANNELS } from '../data/catalog';
import { useStore } from '../lib/store';
import { IconBack, IconSearch, IconPlay, IconTv } from '../components/Icons';

export default function LiveTV() {
  const nav = useNavigate();
  const { toast } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');

  const cats = useMemo(() => ['All', ...Array.from(new Set(CHANNELS.map((c) => c.category)))], []);

  const list = CHANNELS.filter(
    (c) =>
      (cat === 'All' || c.category === cat) &&
      (q.trim() === '' || c.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav('/')} aria-label="Back">
          <IconBack />
        </button>
        <div className="topbar-title">Live TV</div>
        <button className="icon-btn" onClick={() => toast('Import M3U playlist')} aria-label="Import">
          <IconTv size={20} />
        </button>
      </header>

      <div className="live-head">
        <div className="search-bar" style={{ margin: 0 }}>
          <IconSearch size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search channels…" aria-label="Search channels" />
        </div>
      </div>

      <div className="chip-row" style={{ marginTop: 12 }}>
        {cats.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="scroll">
        <div className="channel-grid">
          {list.map((c) => (
            <button key={c.id} className="channel-card" style={{ textAlign: 'left' }} onClick={() => toast(`Tuning to ${c.name}…`)}>
              <div className="channel-logo" style={{ backgroundImage: `url(${c.logo})` }} />
              <div className="channel-info">
                <div className="channel-name ellipsis">{c.name}</div>
                <div className="channel-now ellipsis">{c.now}</div>
                <div className="channel-prog">
                  <div className="bar">
                    <i style={{ width: `${c.progress * 100}%` }} />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        {list.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>No channels found</div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </>
  );
}
