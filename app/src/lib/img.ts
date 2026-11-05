// Image URL optimisation for the MovieBox CDNs.
//
// The CDNs are Alibaba OSS buckets, so `x-oss-process` is honoured. Artwork
// arrives at full resolution (a single banner can be 4 MB), which is what made
// the first paint so slow; asking OSS for the size we actually render cuts the
// bytes by roughly 40x. Only aoneroom hosts support the transform — anything
// else is passed through untouched.

const OSS_HOST = /(^|\.)aoneroom\.com$/;

/** Smallest width we accept before falling back to the original URL. */
const MIN_WIDTH = 80;

export function optimizeImage(url: string | undefined, width: number, quality = 72): string {
  if (!url || !/^https?:\/\//.test(url)) return url ?? '';

  // Data URIs and already-processed URLs are left alone.
  if (url.includes('x-oss-process')) return url;

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return url;
  }
  if (!OSS_HOST.test(host)) return url;

  const w = Math.max(MIN_WIDTH, Math.round(width));
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}x-oss-process=image/resize,w_${w}/quality,q_${quality}`;
}

/** Poster-shaped (2:3) artwork for a card of the given CSS width. */
export function posterImage(url: string | undefined, cssWidth: number, dpr = 2): string {
  return optimizeImage(url, cssWidth * dpr);
}

/** Wide (16:9) artwork for heroes and backdrops. */
export function backdropImage(url: string | undefined, cssWidth: number, dpr = 2): string {
  return optimizeImage(url, cssWidth * dpr, 70);
}
