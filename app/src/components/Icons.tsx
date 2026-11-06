import React from 'react';

type P = { size?: number; className?: string; strokeWidth?: number; fill?: string };
const base = (size = 22, sw = 1.9) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: sw,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconHome = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></svg>
);
export const IconBook = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 17.5h16" /></svg>
);
export const IconSword = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M14.5 3.5 20.5 3l-.5 6-9.6 9.6-4.6.6.6-4.6z" /><path d="m3 21 4-4" /><path d="m12 6 6 6" /></svg>
);
export const IconDownload = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 19.5h16" /></svg>
);
export const IconUser = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>
);
export const IconSearch = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconPlay = ({ size = 22, className, fill = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} className={className}><path d="M8 5.5v13l11-6.5z" /></svg>
);
export const IconPause = ({ size = 22, className, fill = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} className={className}><rect x="7" y="5" width="3.4" height="14" rx="1" /><rect x="13.6" y="5" width="3.4" height="14" rx="1" /></svg>
);
export const IconHeart = ({ size, className, fill = 'none' }: P) => (
  <svg {...base(size)} fill={fill} className={className}><path d="M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.6 12 20 12 20z" /></svg>
);
export const IconPlus = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
);
export const IconCheck = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconChevronRight = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="m9 5 7 7-7 7" /></svg>
);
export const IconChevronLeft = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="m15 5-7 7 7 7" /></svg>
);
export const IconBack = ({ size = 22, className }: P) => (
  <svg {...base(size)} className={className}><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></svg>
);
export const IconStar = ({ size = 14, className, fill = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} className={className}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
);
export const IconClose = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
);
export const IconMore = ({ size, className, fill = 'currentColor' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} className={className}><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
);
export const IconSettings = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></svg>
);
export const IconHistory = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3.5 4v4h4" /><path d="M12 8v4.5l3 1.8" /></svg>
);
export const IconBell = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10.5 20a2 2 0 0 0 3 0" /></svg>
);
export const IconGrid = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>
);
export const IconFilter = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></svg>
);
export const IconCast = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 17.5a4 4 0 0 1 4 4" /><path d="M3 13a8 8 0 0 1 8 8" /><path d="M3 9.5a12 12 0 0 1 12 12" /><path d="M3 6V5h18v14h-7" /></svg>
);
export const IconVolume = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 9.5h3l4-3.5v12l-4-3.5H4z" /><path d="M15 9a4 4 0 0 1 0 6" /><path d="M17.5 6.5a7.5 7.5 0 0 1 0 11" /></svg>
);
export const IconMute = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 9.5h3l4-3.5v12l-4-3.5H4z" /><path d="m16 10 5 5" /><path d="m21 10-5 5" /></svg>
);
export const IconFullscreen = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 9V4h5" /><path d="M20 15v5h-5" /><path d="M15 4h5v5" /><path d="M9 20H4v-5" /></svg>
);
export const IconSkip = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><path d="m5 5 9 7-9 7z" /><path d="M18 5v14" /></svg>
);
export const IconSkipBack = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><path d="m19 5-9 7 9 7z" /><path d="M6 5v14" /></svg>
);
export const IconSun = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5 3.5 3.5M20.5 20.5 19 19M19 5l1.5-1.5M3.5 20.5 5 19" /></svg>
);
export const IconMoon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" /></svg>
);
export const IconTv = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="m8 3 4 4 4-4" /></svg>
);
export const IconFire = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-1.6.7-3 1.5-4 .2 1 .9 1.8 1.8 2 0-3 .7-5.5 1.7-7z" /></svg>
);
export const IconTrash = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></svg>
);
export const IconRefresh = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M20 11a8 8 0 0 0-14-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14 4.5L20 16" /><path d="M20 20v-4h-4" /></svg>
);
export const IconPuzzle = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M10 3.5a2 2 0 0 1 4 0V5h2.5A1.5 1.5 0 0 1 18 6.5V9h1.5a2 2 0 0 1 0 4H18v2.5A1.5 1.5 0 0 1 16.5 17H14v1.5a2 2 0 0 1-4 0V17H7.5A1.5 1.5 0 0 1 6 15.5V13H4.5a2 2 0 0 1 0-4H6V6.5A1.5 1.5 0 0 1 7.5 5H10z" /></svg>
);
export const IconGlobe = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c2.5 2.5 2.5 14.5 0 17-2.5-2.5-2.5-14.5 0-17z" /></svg>
);
export const IconShield = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconWifi = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 9.5a12 12 0 0 1 16 0" /><path d="M6.5 13a8 8 0 0 1 11 0" /><path d="M9 16.5a4 4 0 0 1 6 0" /><circle cx="12" cy="20" r="0.6" fill="currentColor" /></svg>
);
export const IconSubtitle = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M6.5 14h4M13 14h4.5" /><path d="M6.5 10.5h3M12 10.5h5.5" /></svg>
);
export const IconShare = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" /></svg>
);
export const IconLogo = ({ size = 28, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff6a2b" />
        <stop offset="1" stopColor="#ff2d78" />
      </linearGradient>
    </defs>
    <rect x="2" y="5" width="20" height="14" rx="4" fill="url(#lg)" />
    <path d="M10 9.5v5l4.5-2.5z" fill="#fff" />
  </svg>
);

export const IconWifiOff = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M2 2l20 20" /><path d="M8.5 16.4a5 5 0 0 1 7 0" /><path d="M5 12.9a10 10 0 0 1 3.5-2.1" /><path d="M15.5 10.8A10 10 0 0 1 19 12.9" /><path d="M12 20h.01" /></svg>
);

export const IconInfo = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><circle cx="12" cy="8" r="0.7" fill="currentColor" stroke="none" /></svg>
);
export const IconChevronDown = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="m6 9.5 6 6 6-6" /></svg>
);
export const IconEye = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconLock = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4.5" y="10.5" width="15" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>
);
export const IconSquare = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4" y="4" width="16" height="16" rx="4" /></svg>
);
export const IconCheckSquare = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8.5 12.2 2.6 2.6 4.6-5" /></svg>
);
export const IconCloudDownload = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M7 16.5a4 4 0 0 1-.4-8 5.2 5.2 0 0 1 10 1.2A3.6 3.6 0 0 1 16.6 16" /><path d="M12 11.5v7" /><path d="m9.2 15.8 2.8 2.8 2.8-2.8" /></svg>
);

export const IconUnlock = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7.5A3.5 3.5 0 0 1 14.6 6" /></svg>
);export const IconFit = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 9V4h5" /><path d="M20 15v5h-5" /><path d="M15 4h5v5" /><path d="M9 20H4v-5" /></svg>
);
