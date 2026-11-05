import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getTitle } from '../data/cache';
import { IconBack, IconPlay, IconHistory, IconTrash } from '../components/Icons';
import { EmptyState, Confirm } from '../components/ui';

export default function HistoryScreen() {
  const nav = useNavigate();
  const { state, dispatch, toast } = useStore();
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <IconBack />
        </button>
        <div className="topbar-title">Watch History</div>
        {state.history.length > 0 && (
          <button className="icon-btn" onClick={() => setConfirm(true)} aria-label="Clear">
            <IconTrash size={20} />
          </button>
        )}
      </header>

      <div className="scroll">
        {state.history.length ? (
          <div style={{ paddingTop: 10 }}>
            {state.history.map((h) => {
              const t = getTitle(h.titleId);
              if (!t) return null;
              return (
                <button
                  key={h.id}
                  className="hist-row"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => nav(`/player/${t.id}${h.episode ? `?ep=${h.episode}` : ''}`)}
                >
                  <div className="hist-thumb" style={{ backgroundImage: `url(${t.backdrop})` }}>
                    <span className="pbar"><i style={{ width: `${h.progress * 100}%` }} /></span>
                  </div>
                  <div className="hist-body">
                    <div className="hist-title ellipsis">{t.title}</div>
                    <div className="hist-sub">
                      {h.episode ? `Episode ${h.episode} · ` : ''}
                      {Math.round(h.progress * 100)}% watched
                    </div>
                  </div>
                  <IconPlay size={20} />
                </button>
              );
            })}
            <div style={{ height: 20 }} />
          </div>
        ) : (
          <EmptyState icon={<IconHistory size={30} />} title="No watch history" subtitle="Start watching to build your history." />
        )}
      </div>

      {confirm && (
        <Confirm
          title="Clear history?"
          message="All watch history will be removed."
          confirmLabel="Clear"
          danger
          onConfirm={() => {
            dispatch({ type: 'clearHistory' });
            setConfirm(false);
            toast('History cleared');
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </>
  );
}
