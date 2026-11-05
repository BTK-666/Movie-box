import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { NOVELS } from '../data/catalog';
import { chapterOf, chapterTitle, getProgress, setProgress } from '../lib/novel';
import { IconBack, IconChevronRight } from '../components/Icons';

export default function NovelReader() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();

  const novel = useMemo(() => NOVELS.find((n) => n.id === id), [id]);
  const start = Number(sp.get('ch')) || getProgress(id);
  const [no, setNo] = useState(Math.max(1, start));

  const chapter = useMemo(() => (novel ? chapterOf(novel, no) : null), [novel, no]);

  useEffect(() => {
    if (novel) setProgress(novel.id, no);
    document.querySelectorAll('.scroll').forEach((el) => {
      (el as HTMLElement).scrollTop = 0;
    });
  }, [novel, no]);

  if (!novel || !chapter) {
    return (
      <>
        <header className="topbar">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
            <IconBack />
          </button>
          <div className="topbar-title">Not found</div>
        </header>
      </>
    );
  }

  const hasPrev = no > 1;
  const hasNext = no < novel.chapters;
  const nextTitle = hasNext ? chapterTitle(novel.id, no + 1) : '';

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <IconBack />
        </button>
        <div className="topbar-title ellipsis">{novel.title}</div>
        <span className="topbar-spacer" />
      </header>

      <div className="scroll">
        <div className="reader">
          <div className="reader-ch">Chapter {no}</div>
          <h1 className="reader-title">{chapter.title}</h1>
          <div className="reader-meta">
            {novel.author} · {chapter.words} words
          </div>

          <article className="reader-body">
            {chapter.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>

          <div className="reader-nav">
            <button className="btn btn-outline" disabled={!hasPrev} onClick={() => setNo((n) => Math.max(1, n - 1))}>
              Previous
            </button>
            <button className="btn btn-primary" disabled={!hasNext} onClick={() => setNo((n) => n + 1)}>
              {hasNext ? 'Next chapter' : 'The end'}
            </button>
          </div>

          {hasNext && (
            <button className="reader-next" onClick={() => setNo((n) => n + 1)}>
              <div>
                <div className="reader-next-label">Up next</div>
                <div className="reader-next-title ellipsis">{nextTitle}</div>
              </div>
              <IconChevronRight size={18} />
            </button>
          )}
        </div>
        <div style={{ height: 28 }} />
      </div>
    </>
  );
}
