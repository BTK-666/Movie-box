/**
 * Downloads sheet — mirrors the reference design: uploader credit, dub and
 * season pickers, a resolution selector, and the episode list with per-episode
 * size/duration, plus a Select-all / Download footer.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { fmtDuration, type UgcEpisode } from '../data/api';
import {
  IconClose,
  IconCloudDownload,
  IconChevronDown,
  IconCheckSquare,
  IconSquare,
  IconInfo,
} from './Icons';
import { Sheet } from './ui';

export interface DownloadSheetProps {
  title: string;
  uploader?: string;
  seasons: number[];
  season: number;
  onSeason: (s: number) => void;
  dubs: { label: string }[];
  dub: number;
  onDub: (i: number) => void;
  episodes: UgcEpisode[];
  resolutions: number[];
  resolution: number;
  onResolution: (r: number) => void;
  onClose: () => void;
  onDownload: (episodes: UgcEpisode[], resolution: number) => void;
}

export default function DownloadSheet({
  title,
  uploader,
  seasons,
  season,
  onSeason,
  dubs,
  dub,
  onDub,
  episodes,
  resolutions,
  resolution,
  onResolution,
  onClose,
  onDownload,
}: DownloadSheetProps) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Default to everything so a single tap on Download grabs the season.
  useEffect(() => {
    setPicked(new Set(episodes.map((e) => e.id)));
  }, [episodes]);

  const allOn = episodes.length > 0 && picked.size === episodes.length;
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const chosen = useMemo(() => episodes.filter((e) => picked.has(e.id)), [episodes, picked]);

  const sizeFor = (ep: UgcEpisode) => {
    const r = ep.resources.find((x) => x.resolution === resolution) ?? ep.resources[0];
    return r?.sizeLabel ?? ep.sizeLabel;
  };

  return (
    <Sheet title="" onClose={onClose}>
      <div className="dl-sheet">
        <div className="dl-sheet-head">
          <h3>Download</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={20} />
          </button>
        </div>

        <div className="dl-sheet-sub">
          {uploader ? (
            <>
              <span className="ellipsis">
                Resources Uploaded by {uploader} <IconInfo size={12} />
              </span>
            </>
          ) : (
            <span className="ellipsis">{title}</span>
          )}
        </div>

        <div className="dl-sheet-selects">
          {dubs.length > 0 && (
            <button className="chip select-chip" onClick={() => onDub((dub + 1) % dubs.length)}>
              {dubs[dub]?.label || 'Original'} <IconChevronDown size={13} />
            </button>
          )}
          {seasons.length > 0 && (
            <button
              className="chip select-chip"
              onClick={() => {
                const i = seasons.indexOf(season);
                onSeason(seasons[(i + 1) % seasons.length]);
              }}
            >
              Season {String(season).padStart(2, '0')} <IconChevronDown size={13} />
            </button>
          )}
        </div>

        {resolutions.length > 0 && (
          <div className="dl-res-row">
            {resolutions.map((r) => (
              <button
                key={r}
                className={`dl-res ${resolution === r ? 'on' : ''}`}
                onClick={() => onResolution(r)}
              >
                {r >= 2160 ? '4K' : `${r}P`}
              </button>
            ))}
          </div>
        )}

        <div className="dl-ep-list">
          {episodes.map((ep) => {
            const on = picked.has(ep.id);
            return (
              <button key={ep.id} className="dl-ep" onClick={() => toggle(ep.id)}>
                <span className="dl-ep-check">{on ? <IconCheckSquare size={19} /> : <IconSquare size={19} />}</span>
                <span className="dl-ep-body">
                  <span className="dl-ep-title">
                    S{String(ep.season).padStart(2, '0')} E{String(ep.no).padStart(2, '0')}
                  </span>
                  <span className="dl-ep-meta">
                    {sizeFor(ep) || '—'}
                    {fmtDuration(ep.durationSec) ? ` | ${fmtDuration(ep.durationSec)}` : ''}
                  </span>
                </span>
              </button>
            );
          })}
          {episodes.length === 0 && <div className="dl-sheet-empty">No downloadable episodes for this season.</div>}
        </div>

        <div className="dl-sheet-foot">
          <button
            className="dl-selectall"
            onClick={() => setPicked(allOn ? new Set() : new Set(episodes.map((e) => e.id)))}
          >
            <span className={`dl-box ${allOn ? 'on' : ''}`}>{allOn ? <IconCheckSquare size={17} /> : <IconSquare size={17} />}</span>
            Select All
          </button>
          <button
            className="btn btn-primary dl-go"
            disabled={chosen.length === 0}
            onClick={() => onDownload(chosen, resolution)}
          >
            <IconCloudDownload size={17} /> Download{chosen.length ? ` (${chosen.length})` : ''}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
