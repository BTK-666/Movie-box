import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  IconHome,
  IconBook,
  IconSword,
  IconDownload,
  IconUser,
} from './Icons';
import { useStore } from '../lib/store';

const TABS: { to: string; label: string; icon: (p: any) => JSX.Element; exact?: boolean; badgeKey?: string }[] = [
  { to: '/', label: 'Home', icon: IconHome, exact: true },
  { to: '/novels', label: 'NovelHub', icon: IconBook },
  { to: '/fight', label: 'Fight Zone', icon: IconSword },
  { to: '/downloads', label: 'Downloads', icon: IconDownload, badgeKey: 'downloads' },
  { to: '/me', label: 'Me', icon: IconUser },
];

export default function BottomNav() {
  const loc = useLocation();
  const { state } = useStore();
  const activeDownloads = state.downloads.filter((d) => d.status === 'downloading').length;

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map((t) => {
        const active = t.exact ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
        const Icon = t.icon;
        const badge =
          t.badgeKey === 'downloads' && activeDownloads > 0 ? activeDownloads : 0;
        return (
          <NavLink
            key={t.to}
            to={t.to}
            className={`nav-item ${active ? 'active' : ''}`}
            aria-label={t.label}
          >
            <span className="nav-icon">
              <Icon size={23} />
              {badge > 0 && <i className="nav-badge">{badge}</i>}
            </span>
            <span className="nav-label">{t.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
