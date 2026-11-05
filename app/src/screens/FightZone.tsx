import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FIGHTS } from '../data/catalog';
import { IconPlay, IconBell, IconChevronRight } from '../components/Icons';
import { useStore } from '../lib/store';

export default function FightZone() {
  const nav = useNavigate();
  const { toast } = useStore();
  const live = FIGHTS.find((f) => f.live);
  const upcoming = FIGHTS.filter((f) => !f.live);

  return (
    <>
      <header className="topbar">
        <div className="topbar-spacer" />
        <div className="topbar-title">Fight Zone</div>
        <button className="icon-btn" onClick={() => toast('Event reminders on')} aria-label="Reminders">
          <IconBell size={20} />
        </button>
      </header>

      <div className="scroll">
        {live && (
          <div className="fight-hero" style={{ backgroundImage: `url(${live.thumb})` }}>
            <div className="fight-hero-body">
              <span className="live-tag">
                <i className="live-dot" /> LIVE
              </span>
              <div className="fight-title">{live.title}</div>
              <div className="fight-sub">{live.promotion} · {live.main}</div>
              <div className="hero-actions" style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={() => toast('Joining live stream…')}>
                  <IconPlay size={17} /> Watch Live
                </button>
                <button className="btn btn-ghost" onClick={() => toast('Reminder set')}>
                  <IconBell size={17} /> Remind
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="section-head" style={{ marginTop: 22 }}>
          <h3>Upcoming Fights</h3>
        </div>

        {upcoming.map((f) => (
          <div key={f.id} className="fight-card">
            <div className="fight-thumb" style={{ backgroundImage: `url(${f.thumb})` }}>
              <span className="tag chip" style={{ height: 20, fontSize: 10, padding: '0 7px' }}>
                {f.date}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }} className="ellipsis">
                {f.title}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }} className="ellipsis">
                {f.promotion}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }} className="ellipsis">
                {f.main}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                <button className="btn btn-primary" style={{ height: 30, fontSize: 12, padding: '0 12px' }} onClick={() => toast('Reminder set')}>
                  <IconBell size={14} /> Remind me
                </button>
                <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: '0 12px' }} onClick={() => toast('Details')}>
                  Details
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="me-group" style={{ marginTop: 8 }}>
          <button className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => toast('Fight archive')}>
            <span className="list-body"><span className="list-title">Fight Archive</span></span>
            <IconChevronRight size={18} />
          </button>
          <button className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => toast('Fighters')}>
            <span className="list-body"><span className="list-title">Top Fighters</span></span>
            <IconChevronRight size={18} />
          </button>
        </div>
        <div style={{ height: 24 }} />
      </div>
    </>
  );
}
