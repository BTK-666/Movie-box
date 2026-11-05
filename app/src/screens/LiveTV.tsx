import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLiveCountries, fetchLiveChannels, type LiveChannel } from '../data/api';
import { optimizeImage } from '../lib/img';
import { useAsync } from '../lib/useAsync';
import { useStore } from '../lib/store';
import { Loading, ErrorState, Sheet, SheetOption } from '../components/ui';
import { IconBack, IconSearch, IconPlay, IconTv } from '../components/Icons';

export default function LiveTV() {
  const nav = useNavigate();
  const { toast } = useStore();
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('IN');
  const [picking, setPicking] = useState(false);
  const [playing, setPlaying] = useState<LiveChannel | null>(null);

  const countries = useAsync(() => fetchLiveCountries(), []);
  const channels = useAsync(() => fetchLiveChannels(country, 1, 80), [country]);

  const list = useMemo(() => {
    const all = channels.data ?? [];
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((c) => c.name.toLowerCase().includes(needle)) : all;
  }, [channels.data, q]);

  const countryName = countries.data?.find((c) => c.code === country);

  const play = (c: LiveChannel) => {
    const stream = c.streams.find((s) => /hls|m3u8/i.test(s.type) || /\.m3u8/i.test(s.url)) ?? c.streams[0];
    if (!stream) {
      toast('No stream available for this channel');
      return;
    }
    setPlaying({ ...c, streams: [stream] });
  };

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav('/')} aria-label="Back">
          <IconBack />
        </button>
        <div className="topbar-title">Live TV</div>
        <button className="icon-btn" onClick={() => setPicking(true)} aria-label="Country">
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
        <button className="chip active" onClick={() => setPicking(true)}>
          {countryName ? `${countryName.flag} ${countryName.name}` : country}
        </button>
        <span className="chip">{list.length} channels</span>
      </div>

      <div className="scroll">
        {channels.loading && !list.length && <Loading label="Loading channels…" />}
        {channels.error && !list.length && <ErrorState message={channels.error} onRetry={channels.reload} />}

        <div className="channel-grid">
          {list.map((c) => (
            <button key={c.id} className="channel-card" style={{ textAlign: 'left' }} onClick={() => play(c)}>
              <div
                className="channel-logo"
                style={{
                  backgroundImage: `url(${optimizeImage(c.logo || c.flag, 200)})`,
                }}
              />
              <div className="channel-info">
                <div className="channel-name ellipsis">{c.name}</div>
                <div className="channel-now ellipsis">
                  {c.flag} {c.country}
                  {c.languages.length ? ` · ${c.languages.join(', ')}` : ''}
                </div>
                <div className="channel-prog">
                  <span className="live-tag" style={{ fontSize: 9.5 }}>
                    <i className="live-dot" /> LIVE
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {!channels.loading && !channels.error && list.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>No channels found</div>
        )}
        <div style={{ height: 20 }} />
      </div>

      {playing && (
        <div className="player live-player">
          <div className="player-stage">
            <video
              className="video-el"
              src={playing.streams[0].url}
              autoPlay
              playsInline
              controls
              onError={() => toast('This channel is offline right now')}
            />
            <div className="player-controls">
              <div className="player-top">
                <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setPlaying(null)} aria-label="Close">
                  <IconBack />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="player-title ellipsis">{playing.name}</div>
                  <div className="player-sub ellipsis">
                    {playing.flag} {playing.country} · LIVE
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {picking && (
        <Sheet title="Choose country" onClose={() => setPicking(false)}>
          {(countries.data ?? []).map((c) => (
            <SheetOption
              key={c.code}
              active={c.code === country}
              onClick={() => {
                setCountry(c.code);
                setPicking(false);
              }}
            >
              {c.flag} {c.name}
            </SheetOption>
          ))}
          {countries.loading && <div className="sheet-empty">Loading…</div>}
        </Sheet>
      )}
    </>
  );
}
