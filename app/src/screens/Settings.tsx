import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, Settings as S } from '../lib/store';
import {
  IconBack,
  IconPlay,
  IconDownload,
  IconSubtitle,
  IconGlobe,
  IconMoon,
  IconSun,
  IconWifi,
  IconChevronRight,
} from '../components/Icons';
import { Sheet, SheetOption } from '../components/ui';

export default function Settings() {
  const nav = useNavigate();
  const { state, dispatch, toast, toggleTheme } = useStore();
  const s = state.settings;
  const [sheet, setSheet] = useState<null | 'player' | 'quality' | 'lang'>(null);

  const set = <K extends keyof S>(key: K, value: S[K]) => dispatch({ type: 'setSetting', key, value });

  const Switch = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button className={`switch ${on ? 'on' : ''}`} onClick={onClick} aria-label="Toggle" />
  );

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <IconBack />
        </button>
        <div className="topbar-title">Settings</div>
        <div className="topbar-spacer" />
      </header>

      <div className="scroll">
        <div className="set-group-title">Playback</div>
        <div className="set-group">
          <button className="set-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSheet('player')}>
            <span className="ic"><IconPlay size={19} /></span>
            <span className="set-label">Default Player</span>
            <span className="set-value">{s.player === 'builtin' ? 'Built-in' : s.player.toUpperCase()}</span>
            <IconChevronRight size={17} />
          </button>
          <button className="set-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSheet('quality')}>
            <span className="ic"><IconDownload size={19} /></span>
            <span className="set-label">Default Quality</span>
            <span className="set-value">{s.defaultQuality}</span>
            <IconChevronRight size={17} />
          </button>
          <div className="set-row">
            <span className="ic"><IconPlay size={19} /></span>
            <span className="set-label">Autoplay Next Episode</span>
            <Switch on={s.autoplayNext} onClick={() => set('autoplayNext', !s.autoplayNext)} />
          </div>
        </div>

        <div className="set-group-title">Downloads</div>
        <div className="set-group">
          <div className="set-row">
            <span className="ic"><IconWifi size={19} /></span>
            <span className="set-label">Wi-Fi Only Downloads</span>
            <Switch on={s.wifiOnlyDownload} onClick={() => set('wifiOnlyDownload', !s.wifiOnlyDownload)} />
          </div>
          <div className="set-row">
            <span className="ic"><IconDownload size={19} /></span>
            <span className="set-label">Data Saver</span>
            <Switch on={s.dataSaver} onClick={() => set('dataSaver', !s.dataSaver)} />
          </div>
        </div>

        <div className="set-group-title">Subtitles</div>
        <div className="set-group">
          <div className="set-row">
            <span className="ic"><IconSubtitle size={19} /></span>
            <span className="set-label">Enable Subtitles</span>
            <Switch on={s.subtitles} onClick={() => set('subtitles', !s.subtitles)} />
          </div>
          <button className="set-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSheet('lang')}>
            <span className="ic"><IconGlobe size={19} /></span>
            <span className="set-label">Subtitle Language</span>
            <span className="set-value">{s.subtitleLang}</span>
            <IconChevronRight size={17} />
          </button>
        </div>

        <div className="set-group-title">General</div>
        <div className="set-group">
          <div className="set-row">
            <span className="ic">{s.theme === 'dark' ? <IconMoon size={19} /> : <IconSun size={19} />}</span>
            <span className="set-label">Dark Theme</span>
            <Switch on={s.theme === 'dark'} onClick={toggleTheme} />
          </div>
          <div className="set-row">
            <span className="ic"><IconGlobe size={19} /></span>
            <span className="set-label">Region</span>
            <span className="set-value">{s.region}</span>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <button
            className="btn btn-outline btn-block"
            onClick={() => {
              toast('Cache cleared');
            }}
          >
            Clear Cache
          </button>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 11.5, padding: '4px 0 20px' }}>
          MovieBox+ v1.0.0 · Build 100
        </div>
      </div>

      {sheet === 'player' && (
        <Sheet title="Default Player" onClose={() => setSheet(null)}>
          {[
            { id: 'builtin', label: 'Built-in Player' },
            { id: 'vlc', label: 'VLC' },
            { id: 'mx', label: 'MX Player' },
            { id: 'mpv', label: 'mpv' },
          ].map((p) => (
            <SheetOption
              key={p.id}
              active={s.player === p.id}
              onClick={() => {
                set('player', p.id as S['player']);
                setSheet(null);
                toast(`Player: ${p.label}`);
              }}
            >
              {p.label}
            </SheetOption>
          ))}
        </Sheet>
      )}

      {sheet === 'quality' && (
        <Sheet title="Default Quality" onClose={() => setSheet(null)}>
          {['4K', '1080p', '720p', 'Auto'].map((q) => (
            <SheetOption
              key={q}
              active={s.defaultQuality === q}
              onClick={() => {
                set('defaultQuality', q as S['defaultQuality']);
                setSheet(null);
                toast(`Quality: ${q}`);
              }}
            >
              {q}
            </SheetOption>
          ))}
        </Sheet>
      )}

      {sheet === 'lang' && (
        <Sheet title="Subtitle Language" onClose={() => setSheet(null)}>
          {['English', 'हिन्दी', 'বাংলা', 'Español', 'العربية', '中文', 'Français'].map((l) => (
            <SheetOption
              key={l}
              active={s.subtitleLang === l}
              onClick={() => {
                set('subtitleLang', l);
                setSheet(null);
                toast(`Language: ${l}`);
              }}
            >
              {l}
            </SheetOption>
          ))}
        </Sheet>
      )}
    </>
  );
}
