import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, DownloadItem } from '../lib/store';
import { getTitle } from '../data/cache';
import {
  IconBack,
  IconPlay,
  IconPause,
  IconTrash,
  IconDownload,
  IconHistory,
  IconMore,
  IconCheck,
} from '../components/Icons';
import { EmptyState, Segmented, Confirm } from '../components/ui';

type Tab = 'downloading' | 'done' | 'history';

export default function Downloads() {
  const nav = useNavigate();
  const { state, dispatch, toast } = useStore();
  const [tab, setTab] = useState<Tab>('downloading');
  const [confirmClear, setConfirmClear] = useState(false);

  const downloading = state.downloads.filter(
    (d) => d.status === 'downloading' || d.status === 'paused' || d.status === 'failed',
  );
  const done = state.downloads.filter((d) => d.status === 'done');
  const history = state.history;

  const list = tab === 'downloading' ? downloading : tab === 'done' ? done : [];

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav('/')} aria-label="Home">
          <IconBack />
        </button>
        <div className="topbar-title">Downloads</div>
        <button
          className="icon-btn"
          onClick={() => (tab === 'history' ? setConfirmClear(true) : toast('Sorted'))}
          aria-label="More"
        >
          <IconMore size={20} />
        </button>
      </header>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: 'downloading', label: `Downloading${downloading.length ? ` (${downloading.length})` : ''}` },
          { id: 'done', label: 'Downloaded' },
          { id: 'history', label: 'History' },
        ]}
      />

      <div className="scroll">
        {tab === 'history' ? (
          history.length ? (
            <div style={{ paddingTop: 10 }}>
              {history.map((h) => {
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
                      <span className="pbar">
                        <i style={{ width: `${h.progress * 100}%` }} />
                      </span>
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
            <EmptyState
              icon={<IconHistory size={30} />}
              title="No watch history"
              subtitle="Titles you play will show up here."
            />
          )
        ) : list.length ? (
          <div style={{ paddingTop: 6 }}>
            {list.map((d) => (
              <DownloadCard key={d.id} d={d} />
            ))}
            <div style={{ height: 20 }} />
          </div>
        ) : (
          <EmptyState
            icon={<IconDownload size={30} />}
            title={tab === 'done' ? 'No downloads yet' : 'Nothing downloading'}
            subtitle={
              tab === 'done'
                ? 'Downloaded titles will appear here for offline viewing.'
                : 'Start a download from any title to see progress here.'
            }
            action={
              <button className="btn btn-primary" onClick={() => nav('/')}>
                Browse titles
              </button>
            }
          />
        )}
      </div>

      {confirmClear && (
        <Confirm
          title="Clear watch history?"
          message="This will remove all watch history entries."
          confirmLabel="Clear"
          danger
          onConfirm={() => {
            dispatch({ type: 'clearHistory' });
            setConfirmClear(false);
            toast('History cleared');
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </>
  );
}

function DownloadCard({ d }: { d: DownloadItem }) {
  const nav = useNavigate();
  const { dispatch, toast } = useStore();
  const t = getTitle(d.titleId);
  const pct = Math.round(d.progress * 100);

  return (
    <div className="dl-card">
      <div className="dl-top">
        <div
          className="dl-thumb"
          style={{ backgroundImage: `url(${t?.poster})` }}
          onClick={() => t && nav(`/detail/${t.id}`)}
        >
          <span className="qc">{d.quality}</span>
        </div>
        <div className="dl-body">
          <div className="dl-name ellipsis">{d.label}</div>
          <div className="dl-meta">
            {d.size} · {d.status === 'done' ? 'Completed' : d.status === 'paused' ? 'Paused' : d.speed}
            {d.status === 'downloading' && d.eta ? ` · ${d.eta} left` : ''}
          </div>
          <div className="dl-prog">
            <div className="bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <span className="dl-pct">{d.status === 'done' ? '✓' : `${pct}%`}</span>
          </div>
        </div>
      </div>
      <div className="dl-actions">
        {d.status === 'done' ? (
          <button onClick={() => t && nav(`/player/${t.id}${d.episode ? `?ep=${d.episode}` : ''}`)}>
            <IconPlay size={15} /> Play
          </button>
        ) : d.status === 'paused' ? (
          <button
            onClick={() => {
              dispatch({ type: 'updateDownload', id: d.id, patch: { status: 'downloading' } });
              toast('Resumed');
            }}
          >
            <IconPlay size={15} /> Resume
          </button>
        ) : (
          <button
            onClick={() => {
              dispatch({ type: 'updateDownload', id: d.id, patch: { status: 'paused' } });
              toast('Paused');
            }}
          >
            <IconPause size={15} /> Pause
          </button>
        )}
        <button
          className="danger"
          onClick={() => {
            dispatch({ type: 'removeDownload', id: d.id });
            toast('Removed');
          }}
        >
          <IconTrash size={15} /> Remove
        </button>
      </div>
    </div>
  );
}
