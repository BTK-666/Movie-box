import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Title } from '../data/catalog';
import { posterImage, backdropImage } from '../lib/img';
import { LazyArt } from '../lib/lazy';
import { IconStar, IconPlay, IconChevronRight, IconClose, IconWifiOff } from './Icons';

/* ---------- Poster card ---------- */
export function PosterCard({
  t,
  width = 122,
  showRank,
  rank,
  showProgress,
  progress,
  sub,
}: {
  t: Title;
  width?: number;
  showRank?: boolean;
  rank?: number;
  showProgress?: boolean;
  progress?: number;
  sub?: string;
}) {
  const nav = useNavigate();
  // `width={0}` is the grid variant: cards fill their column, so the rendered
  // pixel width is roughly half the viewport.
  const cssWidth = width > 0 ? width : Math.round((window.innerWidth - 44) / 2);
  const poster = posterImage(t.poster, cssWidth);
  return (
    <button
      className="poster-card"
      style={{ width: width > 0 ? width : undefined }}
      onClick={() => nav(`/detail/${t.id}`)}
      aria-label={t.title}
    >
      <LazyArt className="poster-art" src={poster}>
        {t.quality && <span className="poster-badge">{t.quality}</span>}
        {t.newRelease && !showRank && <span className="poster-new">NEW</span>}
        {showRank && (
          <span className="poster-rank">
            <b>{rank}</b>
          </span>
        )}
        {showProgress && progress != null && (
          <div className="poster-progress">
            <i style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        )}
        <span className="poster-play">
          <IconPlay size={18} />
        </span>
      </LazyArt>
      <div className="poster-meta">
        <span className="poster-title ellipsis">{t.title}</span>
        <span className="poster-sub ellipsis">
          {sub ?? `${t.year} · ${t.genres[0]}`}
        </span>
      </div>
    </button>
  );
}

/* ---------- Rating pill ---------- */
export function Rating({ value }: { value: number }) {
  return (
    <span className="rating-pill">
      <IconStar size={12} /> {value.toFixed(1)}
    </span>
  );
}

/* ---------- Section header ---------- */
export function SectionHead({
  title,
  onMore,
}: {
  title: string;
  onMore?: () => void;
}) {
  return (
    <div className="section-head">
      <h3>{title}</h3>
      {onMore && (
        <button className="section-more" onClick={onMore}>
          More <IconChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

/* ---------- Rail (horizontal scroller) ---------- */
export function Rail({
  title,
  items,
  onMore,
  cardWidth = 122,
  ranked,
  progressMap,
}: {
  title: string;
  items: Title[];
  onMore?: () => void;
  cardWidth?: number;
  ranked?: boolean;
  progressMap?: Record<string, number>;
}) {
  return (
    <section className="rail">
      <SectionHead title={title} onMore={onMore} />
      <div className="rail-scroll">
        {items.map((t, i) => (
          <PosterCard
            key={t.id + i}
            t={t}
            width={ranked ? 150 : cardWidth}
            showRank={ranked}
            rank={i + 1}
            showProgress={progressMap?.[t.id] != null}
            progress={progressMap?.[t.id]}
          />
        ))}
      </div>
    </section>
  );
}

/* ---------- Bottom sheet ---------- */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog">
        <div className="sheet-grip" />
        {title && <div className="sheet-title">{title}</div>}
        {children}
      </div>
    </>
  );
}

/* ---------- Sheet option ---------- */
export function SheetOption({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className={`sheet-item ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {subtitle && <div className="empty-sub">{subtitle}</div>}
      {action}
    </div>
  );
}

/* ---------- Async states ---------- */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <IconWifiOff />
      </div>
      <div className="empty-title">Couldn&apos;t load</div>
      <div className="empty-sub">{message}</div>
      {onRetry && (
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/* ---------- Top bar ---------- */
export function TopBar({
  title,
  onBack,
  right,
  transparent,
}: {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  transparent?: boolean;
}) {
  return (
    <header className={`topbar ${transparent ? 'transparent' : ''}`}>
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <IconChevronRight size={22} className="flip" />
        </button>
      ) : (
        <span className="topbar-spacer" />
      )}
      {title && <div className="topbar-title ellipsis">{title}</div>}
      <div className="topbar-right">{right}</div>
    </header>
  );
}

/* ---------- Confirm dialog ---------- */
export function Confirm({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  danger,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <>
      <div className="scrim" onClick={onCancel} />
      <div className="dialog" role="dialog">
        <div className="dialog-title">{title}</div>
        {message && <div className="dialog-msg">{message}</div>}
        <div className="dialog-actions">
          <button className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.id}
          className={value === o.id ? 'active' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
