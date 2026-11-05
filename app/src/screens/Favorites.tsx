import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { TITLE_BY_ID } from '../data/catalog';
import { PosterCard, EmptyState } from '../components/ui';
import { IconBack, IconHeart } from '../components/Icons';

export default function Favorites() {
  const nav = useNavigate();
  const { state } = useStore();
  const items = state.favorites.map((id) => TITLE_BY_ID[id]).filter(Boolean);

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <IconBack />
        </button>
        <div className="topbar-title">My List</div>
        <div className="topbar-spacer" />
      </header>

      <div className="scroll">
        {items.length ? (
          <div className="browse-grid">
            {items.map((t) => (
              <PosterCard key={t.id} t={t} width={0} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<IconHeart size={30} />}
            title="Your list is empty"
            subtitle="Tap the heart on any title to add it here."
            action={
              <button className="btn btn-primary" onClick={() => nav('/')}>
                Discover titles
              </button>
            }
          />
        )}
      </div>
    </>
  );
}
