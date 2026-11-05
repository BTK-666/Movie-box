import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMatches, fetchSportNews, type SportMatch, type SportNews } from '../data/api';
import { optimizeImage } from '../lib/img';
import { useAsync } from '../lib/useAsync';
import { useStore } from '../lib/store';
import { Loading, ErrorState } from '../components/ui';
import { IconBack, IconPlay, IconBell, IconFire } from '../components/Icons';

function whenLabel(m: SportMatch): string {
  if (m.live) return 'LIVE NOW';
  if (m.timeDesc) return m.timeDesc;
  if (!m.startTime) return '';
  const d = new Date(m.startTime);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function FightZone() {
  const nav = useNavigate();
  const { toast } = useStore();
  const [tab, setTab] = useState<'matches' | 'news'>('matches');
  const [playing, setPlaying] = useState<SportMatch | null>(null);

  const matches = useAsync(() => fetchMatches(1, 30), []);
  const news = useAsync(() => fetchSportNews(1, 15), []);

  const list = matches.data ?? [];
  const live = useMemo(() => list.filter((m) => m.live), [list]);
  const upcoming = useMemo(() => list.filter((m) => !m.live), [list]);

  const watch = (m: SportMatch) => {
    if (!m.playPath) {
      toast('No stream published for this match yet');
      return;
    }
    setPlaying(m);
  };

  const MatchCard = ({ m }: { m: SportMatch }) => (
    <div className="match-card">
      <div className="match-league ellipsis">
        {m.live && (
          <span className="live-tag">
            <i className="live-dot" /> LIVE
          </span>
        )}
        {m.league || m.sport}
      </div>
      <div className="match-teams">
        <div className="match-team">
          <div className="match-logo" style={{ backgroundImage: `url(${optimizeImage(m.team1Logo, 96)})` }} />
          <span className="ellipsis">{m.team1}</span>
        </div>
        <div className="match-score">
          {m.score1 != null && m.score2 != null ? `${m.score1} – ${m.score2}` : 'vs'}
        </div>
        <div className="match-team">
          <div className="match-logo" style={{ backgroundImage: `url(${optimizeImage(m.team2Logo, 96)})` }} />
          <span className="ellipsis">{m.team2}</span>
        </div>
      </div>
      <div className="match-foot">
        <span className="match-when">{whenLabel(m)}</span>
        <button className="btn btn-primary" style={{ height: 30, fontSize: 12, padding: '0 12px' }} onClick={() => watch(m)}>
          <IconPlay size={14} /> {m.live ? 'Watch' : 'Stream'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav('/')} aria-label="Back">
          <IconBack />
        </button>
        <div className="topbar-title">Fight Zone</div>
        <button className="icon-btn" onClick={() => toast('Event reminders on')} aria-label="Reminders">
          <IconBell size={20} />
        </button>
      </header>

      <div className="dl-tabs" style={{ marginTop: 8 }}>
        <button className={tab === 'matches' ? 'active' : ''} onClick={() => setTab('matches')}>
          Matches
        </button>
        <button className={tab === 'news' ? 'active' : ''} onClick={() => setTab('news')}>
          News
        </button>
      </div>

      <div className="scroll">
        {tab === 'matches' ? (
          <>
            {matches.loading && !list.length && <Loading label="Loading fixtures…" />}
            {matches.error && !list.length && <ErrorState message={matches.error} onRetry={matches.reload} />}

            {live.length > 0 && (
              <>
                <div className="section-head" style={{ marginTop: 14 }}>
                  <h3>
                    <IconFire size={14} /> Live Now
                  </h3>
                </div>
                {live.map((m) => (
                  <MatchCard key={m.id} m={m} />
                ))}
              </>
            )}

            {upcoming.length > 0 && (
              <>
                <div className="section-head" style={{ marginTop: 18 }}>
                  <h3>Upcoming</h3>
                </div>
                {upcoming.map((m) => (
                  <MatchCard key={m.id} m={m} />
                ))}
              </>
            )}

            {!matches.loading && !matches.error && list.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>No fixtures right now</div>
            )}
          </>
        ) : (
          <>
            {news.loading && !news.data?.length && <Loading label="Loading news…" />}
            {news.error && !news.data?.length && <ErrorState message={news.error} onRetry={news.reload} />}
            {(news.data ?? []).map((n: SportNews) => (
              <button key={n.id} className="news-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => toast('Opening article…')}>
                {n.image && <div className="news-thumb" style={{ backgroundImage: `url(${optimizeImage(n.image, 200)})` }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="news-title clamp2">{n.title}</div>
                  {n.summary && <div className="news-sum clamp2">{n.summary}</div>}
                  {n.source && <div className="news-src">{n.source}</div>}
                </div>
              </button>
            ))}
          </>
        )}
        <div style={{ height: 24 }} />
      </div>

      {playing && (
        <div className="player live-player">
          <div className="player-stage">
            <video
              className="video-el"
              src={playing.playPath}
              autoPlay
              playsInline
              controls
              onError={() => toast('This match stream is unavailable')}
            />
            <div className="player-controls">
              <div className="player-top">
                <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setPlaying(null)} aria-label="Close">
                  <IconBack />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="player-title ellipsis">
                    {playing.team1} vs {playing.team2}
                  </div>
                  <div className="player-sub ellipsis">{playing.league || playing.sport}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
