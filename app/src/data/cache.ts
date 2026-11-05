// Shared cache of titles fetched from the API.
//
// Screens navigate by id (e.g. /detail/<subjectId>), so any title fetched while
// browsing Home or Search must stay resolvable without a second round trip.

import { TITLE_BY_ID, type Title } from '../data/catalog';
import type { MediaDetails } from '../data/api';

const titles = new Map<string, Title>();
const details = new Map<string, MediaDetails>();

export function rememberTitle(t: Title) {
  if (t?.id) titles.set(t.id, t);
}

export function rememberTitles(list: Title[]) {
  for (const t of list) rememberTitle(t);
}

/** API-cached title first, then the bundled catalog for ids saved before the API existed. */
export function getTitle(id: string): Title | undefined {
  return titles.get(id) ?? TITLE_BY_ID[id];
}

export function rememberDetails(d: MediaDetails) {
  if (d?.id) details.set(d.id, d);
}

export function getDetails(id: string): MediaDetails | undefined {
  return details.get(id);
}

export function cachedTitles(): Title[] {
  return [...titles.values()];
}
