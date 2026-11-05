import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { IconBack, IconPuzzle, IconPlus, IconCheck } from '../components/Icons';

export default function Addons() {
  const nav = useNavigate();
  const { state, dispatch, toast } = useStore();

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <IconBack />
        </button>
        <div className="topbar-title">Stremio Addons</div>
        <button className="icon-btn" onClick={() => toast('Add addon by URL')} aria-label="Add">
          <IconPlus size={20} />
        </button>
      </header>

      <div className="scroll">
        <div style={{ padding: '8px 16px 4px', fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
          Addons extend MovieBox+ with extra catalogs, metadata, and stream sources.
        </div>

        {state.addons.map((a) => (
          <div key={a.id} className="addon-card">
            <div className="addon-ic">
              <IconPuzzle size={22} />
            </div>
            <div className="addon-body">
              <div className="addon-name">{a.name}</div>
              <div className="addon-desc">{a.description}</div>
              <div className="addon-desc" style={{ marginTop: 3, opacity: 0.7 }}>
                v{a.version}
              </div>
            </div>
            <button
              className={`btn ${a.installed ? 'btn-outline' : 'btn-primary'}`}
              style={{ height: 34, fontSize: 12.5, padding: '0 14px' }}
              onClick={() => {
                dispatch({ type: 'toggleAddon', id: a.id });
                toast(a.installed ? `${a.name} removed` : `${a.name} installed`);
              }}
            >
              {a.installed ? <><IconCheck size={15} /> Installed</> : 'Install'}
            </button>
          </div>
        ))}

        <div style={{ padding: '16px', textAlign: 'center' }}>
          <button className="btn btn-outline" onClick={() => toast('Paste addon manifest URL')}>
            <IconPlus size={16} /> Add addon by URL
          </button>
        </div>
        <div style={{ height: 24 }} />
      </div>
    </>
  );
}
