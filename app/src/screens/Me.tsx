import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import {
  IconChevronRight,
  IconHeart,
  IconHistory,
  IconDownload,
  IconSettings,
  IconPuzzle,
  IconBell,
  IconMoon,
  IconSun,
  IconShield,
  IconGlobe,
  IconUser,
  IconGrid,
} from '../components/Icons';
import { Sheet, SheetOption } from '../components/ui';

export default function Me() {
  const nav = useNavigate();
  const { state, toggleTheme, toast, dispatch } = useStore();
  const [sheet, setSheet] = useState<null | 'region'>(null);
  const { profile, settings, favorites, downloads, history } = state;

  const rows = [
    { icon: <IconHistory size={20} />, label: 'Watch History', value: `${history.length}`, to: '/history' },
    { icon: <IconHeart size={20} />, label: 'My List', value: `${favorites.length}`, to: '/favorites' },
    { icon: <IconDownload size={20} />, label: 'Downloads', value: `${downloads.length}`, to: '/downloads' },
    { icon: <IconGrid size={20} />, label: 'My Room', value: '', action: () => toast('My Room') },
  ];

  const prefRows = [
    { icon: <IconPuzzle size={20} />, label: 'Stremio Addons', value: `${state.addons.filter((a) => a.installed).length} active`, to: '/addons' },
    { icon: <IconBell size={20} />, label: 'Notifications', value: settings.notifications ? 'On' : 'Off', action: () => dispatch({ type: 'setSetting', key: 'notifications', value: !settings.notifications }) },
    { icon: <IconGlobe size={20} />, label: 'Region', value: settings.region, action: () => setSheet('region') },
    { icon: <IconShield size={20} />, label: 'Kids Mode', value: settings.kidsMode ? 'On' : 'Off', action: () => { dispatch({ type: 'setSetting', key: 'kidsMode', value: !settings.kidsMode }); toast(settings.kidsMode ? 'Kids mode off' : 'Kids mode on'); } },
    { icon: settings.theme === 'dark' ? <IconMoon size={20} /> : <IconSun size={20} />, label: 'Appearance', value: settings.theme === 'dark' ? 'Dark' : 'Light', action: toggleTheme },
    { icon: <IconSettings size={20} />, label: 'Settings', value: '', to: '/settings' },
  ];

  return (
    <>
      <div className="scroll">
        <div className="me-head">
          <div className="me-avatar" style={{ backgroundImage: `url(${profile.avatar})` }} />
          <div className="me-name">{profile.name}</div>
          <div className="me-mail">{profile.email}</div>
          <span className="me-plan">★ {profile.plan} Plan</span>
        </div>

        <div className="me-stats">
          <button className="me-stat" onClick={() => nav('/history')}>
            <b>{history.length}</b>
            <span>Watched</span>
          </button>
          <button className="me-stat" onClick={() => nav('/favorites')}>
            <b>{favorites.length}</b>
            <span>My List</span>
          </button>
          <button className="me-stat" onClick={() => nav('/downloads')}>
            <b>{downloads.length}</b>
            <span>Downloads</span>
          </button>
        </div>

        <div className="me-banner">
          <IconUser size={26} />
          <div style={{ flex: 1 }}>
            <b>Sign in to sync</b>
            <div><span>Keep your list and history across devices</span></div>
          </div>
          <IconChevronRight size={20} />
        </div>

        <div className="me-group">
          {rows.map((r) => (
            <button
              key={r.label}
              className="list-row"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => (r.to ? nav(r.to) : r.action?.())}
            >
              <span className="ic" style={{ color: 'var(--text-2)', display: 'grid', placeItems: 'center' }}>{r.icon}</span>
              <span className="list-body">
                <span className="list-title">{r.label}</span>
              </span>
              {r.value && <span className="list-sub">{r.value}</span>}
              <IconChevronRight size={18} />
            </button>
          ))}
        </div>

        <div className="me-group">
          {prefRows.map((r) => (
            <button
              key={r.label}
              className="list-row"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => (r.to ? nav(r.to) : r.action?.())}
            >
              <span className="ic" style={{ color: 'var(--text-2)', display: 'grid', placeItems: 'center' }}>{r.icon}</span>
              <span className="list-body">
                <span className="list-title">{r.label}</span>
              </span>
              <span className="list-sub">{r.value}</span>
              <IconChevronRight size={18} />
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 11.5, padding: '24px 0 12px' }}>
          MovieBox+ · v1.0.0
        </div>
        <div style={{ height: 16 }} />
      </div>

      {sheet === 'region' && (
        <Sheet title="Select Region" onClose={() => setSheet(null)}>
          {['India', 'United States', 'United Kingdom', 'Japan', 'Korea', 'Bangladesh', 'Global'].map((r) => (
            <SheetOption
              key={r}
              active={settings.region === r}
              onClick={() => {
                dispatch({ type: 'setSetting', key: 'region', value: r });
                setSheet(null);
                toast(`Region: ${r}`);
              }}
            >
              {r}
            </SheetOption>
          ))}
        </Sheet>
      )}
    </>
  );
}
