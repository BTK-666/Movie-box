// Deferred artwork.
//
// The feed is poster-heavy: a single home render can request 60+ CDN images.
// Loading them all at once wastes data and starves the video pipeline, so the
// background image is only attached once the element is near the viewport.
// A data URI is already local and is applied immediately.

import React, { useEffect, useRef, useState } from 'react';

export function useInView<T extends HTMLElement>(rootMargin = '300px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}

/** A div that paints `src` only when it scrolls near the viewport. */
export function LazyArt({
  src,
  className,
  style,
  children,
}: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const immediate = !src || src.startsWith('data:');
  const show = immediate || inView;
  return (
    <div
      ref={ref}
      className={className}
      style={{ ...style, backgroundImage: show && src ? `url(${src})` : undefined }}
    >
      {children}
    </div>
  );
}
