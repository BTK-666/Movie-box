// Maps MovieBox API payloads onto the app's own models.
//
// Shapes were taken from the MovieBox-TUI Rust adapter (src/providers/moviebox/adapt.rs)
// and confirmed against the live API.

import { client } from '../lib/moviebox';
import type { Episode, Rail, Title } from './catalog';
import { artwork, TITLE_BY_ID, episodesFor } from './catalog';

export interface Stream {
  id: string;
  url: string;
  resolution: number;
  quality: string;
  sizeBytes: number;
  sizeLabel: string;
  codec: string;
  direct: boolean;
}

export interface CastMember {
  id: string;
  name: string;
  character: string;
  avatar: string;
}

export interface MediaDetails {
  id: string;
  title: string;
  type: Title['type'];
  year: number;
  rating: number;
  genres: string[];
  synopsis: string;
  poster: string;
  backdrop: string;
  duration?: string;
  country?: string;
  language?: string;
  cast: CastMember[];
  seasons: number;
  episodeCounts: Record<number, number>;
  dubs: { language: string; label: string; subjectId: string }[];
}

export interface HomeData {
  heroes: Title[];
  rails: Rail[];
  titles: Record<string, Title>;
}

const year = (d?: string) => {
  const m = /(\d{4})/.exec(d ?? '');
  return m ? Number(m[1]) : 0;
};

const genresOf = (g?: string | string[]) =>
  Array.isArray(g)
    ? g
    : (g ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

const ratingOf = (v?: string | number) => {
  const n = typeof v === 'number' ? v : Number.parseFloat(v ?? '');
  return Number.isFinite(n) ? n : 0;
};

function posterOf(subject: any): string {
  const url =
    subject?.cover?.url ??
    subject?.coverUrl ??
    subject?.poster ??
    // Banner slides carry the artwork under `image` instead of `cover`.
    subject?.image?.url;
  return typeof url === 'string' && url.startsWith('http') ? url : artwork(String(subject?.subjectId ?? 'x'), 400, 600);
}

export function subjectToTitle(subject: any): Title {
  const isSeries = Number(subject?.subjectType ?? subject?.stype ?? 1) === 2;
  const id = String(subject?.subjectId ?? subject?.id ?? '');
  const poster = posterOf(subject);
  return {
    id,
    title: String(subject?.title ?? subject?.name ?? 'Unknown'),
    year: year(subject?.releaseDate ?? subject?.year),
    rating: ratingOf(subject?.imdbRatingValue ?? subject?.imdbRate ?? subject?.rating),
    genres: genresOf(subject?.genre ?? subject?.genres),
    type: isSeries ? 'tv' : 'movie',
    synopsis: String(subject?.description ?? ''),
    poster,
    backdrop: poster,
    duration: typeof subject?.duration === 'string' ? subject.duration : undefined,
    country: subject?.countryName,
    trending: Boolean(subject?.trending),
    newRelease: false,
  };
}

export function collectSubjects(payload: any): any[] {
  const out: any[] = [];
  const push = (s: any) => {
    if (s && (s.subjectId ?? s.id)) out.push(s);
  };
  for (const group of payload?.items ?? []) {
    for (const b of group?.banner?.banners ?? []) push(b.subject);
    for (const c of group?.customData?.items ?? []) {
      if (c?.subject) push(c.subject);
      else if (c?.deepLink) {
        const m = /id=(\d+)/.exec(c.deepLink);
        if (m) push({ subjectId: m[1], title: c.content, cover: c.image, subjectType: /subject_type=(\d+)/.exec(c.deepLink)?.[1] === '2' ? 2 : 1 });
      }
    }
    for (const s of group?.subjects ?? []) push(s);
    for (const r of group?.rankingListData?.items ?? []) for (const s of r?.subjects ?? []) push(s);
    for (const s of group?.appointmentList ?? []) push(s);
  }
  return out;
}

/**
 * Group types that are promotional rather than editorial. The API mixes paid
 * placements into the home feed (a Diwali activity banner, "Get Free Premium",
 * "Invite Friends", the MovieBoxTV download promo). The real client renders
 * those from its own native layouts, so the closest equivalent here is to drop
 * them instead of showing them as browsable titles.
 */
const PROMO_GROUP_TYPES = new Set(['SINGLE_IMAGE']);

/** Deep links that lead to an activity/web page instead of a title. */
const PROMO_DEEPLINK = /type=\/(member|web|profile)\//;

/** Copy that only ever appears on promotional placements. */
const PROMO_TITLE = /free premium|invite friends|install|join communities|watch on tv|download app|refer/i;

function isPromoGroup(group: any): boolean {
  if (PROMO_GROUP_TYPES.has(String(group?.type ?? ''))) return true;
  if (PROMO_TITLE.test(String(group?.title ?? ''))) return true;
  return false;
}

/** True when a banner slide points at a promo page rather than a subject. */
function isPromoBanner(b: any): boolean {
  if (b?.subject) return false;
  const link = String(b?.deepLink ?? '');
  if (PROMO_DEEPLINK.test(link)) return true;
  if (PROMO_TITLE.test(String(b?.content ?? ''))) return true;
  // Category links (type=/home/category) are real editorial collections.
  return !/\/movie\/detail/.test(link) && !/\/home\/category/.test(link);
}

function groupSubjects(group: any): any[] {
  const out: any[] = [];
  for (const b of group?.banner?.banners ?? []) if (b.subject) out.push(b.subject);
  for (const c of group?.customData?.items ?? []) {
    if (c?.subject) out.push(c.subject);
    else if (c?.deepLink) {
      const m = /id=(\d+)/.exec(c.deepLink);
      if (m) out.push({ subjectId: m[1], title: c.content, cover: c.image, subjectType: /subject_type=(\d+)/.exec(c.deepLink)?.[1] === '2' ? 2 : 1 });
    }
  }
  for (const s of group?.subjects ?? []) out.push(s);
  for (const r of group?.rankingListData?.items ?? []) for (const s of r?.subjects ?? []) out.push(s);
  for (const s of group?.appointmentList ?? []) out.push(s);
  return out;
}

/** Home page: hero banners plus one rail per content group the API returns. */
export async function fetchHome(tabId = '0'): Promise<HomeData> {
  const payload = await client.get<any>(`/wefeed-mobile-bff/tab-operating?page=1&tabId=${tabId}&version=`);

  const titles: Record<string, Title> = {};
  const rails: Rail[] = [];
  const heroes: Title[] = [];
  const heroSeen = new Set<string>();

  const remember = (subject: any): string | null => {
    const t = subjectToTitle(subject);
    if (!t.id) return null;
    if (!titles[t.id]) titles[t.id] = t;
    return t.id;
  };

  for (const group of payload?.items ?? []) {
    if (isPromoGroup(group)) continue;

    // The first banner group drives the hero carousel. Its slides often carry
    // only a subjectId plus artwork (no nested subject), so build the title from
    // the slide itself.
    if (group.type === 'BANNER' && !heroes.length) {
      for (const b of group.banner?.banners ?? []) {
        if (isPromoBanner(b)) continue;
        const id = String(b?.subjectId ?? '');
        if (!id || id === '0' || heroSeen.has(id)) continue;
        heroSeen.add(id);
        const t = subjectToTitle(b?.subject ?? { subjectId: id, title: b?.content, image: b?.image, subjectType: 1 });
        titles[t.id] = titles[t.id] ?? t;
        heroes.push(t);
        if (heroes.length >= 6) break;
      }
      if (heroes.length) continue;
    }

    const subjects = groupSubjects(group);
    if (!subjects.length) continue;

    const ids: string[] = [];
    for (const s of subjects) {
      const id = remember(s);
      if (id && !ids.includes(id)) ids.push(id);
    }
    if (!ids.length) continue;

    rails.push({
      id: String(group.opId ?? group.title ?? rails.length),
      title: String(group.title ?? 'More'),
      items: ids,
    });
  }

  return { heroes, rails, titles };
}

/** Banner slides that link to a title, used for the home hero carousel. */
export async function fetchHeroBanners(tabId = '0'): Promise<Title[]> {
  const payload = await client.get<any>(`/wefeed-mobile-bff/tab-operating?page=1&tabId=${tabId}&version=`);
  const group = (payload?.items ?? []).find((g: any) => g?.type === 'BANNER' && (g?.banner?.banners ?? []).length);
  const out: Title[] = [];
  const seen = new Set<string>();
  for (const b of group?.banner?.banners ?? []) {
    if (isPromoBanner(b)) continue;
    const id = String(b?.subjectId ?? '');
    if (!id || id === '0' || seen.has(id)) continue;
    seen.add(id);
    const subject = b?.subject ?? { subjectId: id, title: b?.content, cover: b?.image, subjectType: 1 };
    out.push(subjectToTitle(subject));
  }
  return out;
}

export async function searchTitles(query: string, page = 1): Promise<Title[]> {
  const payload = await client.post<any>('/wefeed-mobile-bff/subject-api/search/v2', {
    keyword: query,
    page,
    perPage: 15,
    subjectType: 0,
  });

  const subjects: any[] = [];
  for (const r of payload?.results ?? []) {
    for (const s of r?.subjects ?? []) subjects.push(s);
  }
  if (!subjects.length) {
    for (const s of payload?.list ?? []) subjects.push(s);
  }

  const seen = new Set<string>();
  const out: Title[] = [];
  for (const s of subjects) {
    const t = subjectToTitle(s);
    if (t.id && !seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

/** Suggestions for the search screen's empty state. */
export async function fetchTrending(): Promise<Title[]> {
  const home = await fetchHome('0');
  return Object.values(home.titles).slice(0, 12);
}

/** Builds details from the bundled catalog, used when the API has no such id. */
function localDetails(id: string): MediaDetails | null {
  const t = TITLE_BY_ID[id];
  if (!t) return null;
  const count = t.episodes ?? 0;
  return {
    ...t,
    cast: [],
    seasons: count > 0 ? 1 : 0,
    episodeCounts: count > 0 ? { 1: count } : {},
    dubs: [],
  };
}

export async function fetchDetails(id: string): Promise<MediaDetails> {
  const payload = await client
    .get<any>(`/wefeed-mobile-bff/subject-api/get?subjectId=${id}`)
    .catch((err) => {
      const local = localDetails(id);
      if (local) return { subject: local };
      throw err instanceof Error ? err : new Error('Failed to load this title.');
    });
  const subject = payload?.subject ?? payload;

  // A missing id comes back as `data: null`; treat it as not found rather than
  // rendering a placeholder titled "Unknown".
  if (!subject || !(subject.subjectId ?? subject.id)) {
    const local = localDetails(id);
    if (!local) throw new Error('This title is no longer available.');
    return local;
  }

  const isSeries = Number(subject?.subjectType ?? 1) === 2;
  const base = subjectToTitle(subject);

  const cast: CastMember[] = (subject?.staffList ?? []).slice(0, 20).map((s: any, i: number) => ({
    id: String(s?.staffId ?? i),
    name: String(s?.name ?? ''),
    character: String(s?.character ?? ''),
    avatar:
      typeof s?.avatarUrl === 'string' && s.avatarUrl.startsWith('http')
        ? s.avatarUrl
        : artwork(`cast${s?.staffId ?? i}`, 200, 200),
  }));

  const episodeCounts: Record<number, number> = {};
  let seasons = 0;

  if (isSeries) {
    try {
      const info = await client.get<any>(`/wefeed-mobile-bff/subject-api/season-info?subjectId=${id}`);
      for (const s of info?.seasons ?? []) {
        const se = Number(s?.se ?? 1);
        const count = Number(s?.maxEp ?? (s?.episodeNumbers?.length || 0));
        if (se > 0 && count > 0) {
          episodeCounts[se] = count;
          seasons = Math.max(seasons, se);
        }
      }
    } catch {
      const seNum = Number(subject?.seNum ?? 1);
      if (seNum > 0) {
        seasons = seNum;
        episodeCounts[1] = seNum;
      }
    }
  }

  const dubs = (subject?.dubs ?? []).map((d: any) => ({
    language: String(d?.lanName ?? d?.language ?? ''),
    label: String(d?.title ?? d?.lanName ?? ''),
    subjectId: String(d?.subjectId ?? ''),
  }));

  return {
    ...base,
    duration: typeof subject?.duration === 'string' ? subject.duration : undefined,
    country: subject?.countryName,
    language: subject?.language,
    cast,
    seasons,
    episodeCounts,
    dubs,
  };
}

export function episodesOf(details: MediaDetails, season: number): Episode[] {
  const n = details.episodeCounts[season] ?? 0;
  const out: Episode[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({
      id: `${details.id}-s${season}e${i}`,
      no: i,
      title: `Episode ${i}`,
      duration: '—',
      thumb: episodeThumb(details, i),
    });
  }
  return out;
}

const sizeLabel = (bytes: number) => {
  if (!bytes) return '';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
};

const qualityOf = (res: number) => (res >= 2160 ? '4K' : res ? `${res}p` : 'Auto');

/**
 * Promotional clips MovieBox serves instead of the real file.
 *
 * When a title is not licensed for the visitor tier the API returns a short
 * (~23 s) H.264 promo from `macdn.aoneroom.com/other/...` in place of the
 * movie. The hashes below are the fixed "upgrade" notices the official client
 * also filters (see `is_deprecation_notice_url` in the Rust TUI). These are
 * ads, never content, so they must never reach the player.
 */
const AD_URL_PATTERNS = [
  '1c7de0bd3393702d9191801f15f88f8d',
  '9a0461bc39da389663bf3dbb17091d3f',
  'b164fbfb4347792950bdfbfb563d39d9',
  '/notice.mp4',
];

export const isAdUrl = (url: string) => {
  const lower = url.toLowerCase();
  return (
    AD_URL_PATTERNS.some((p) => lower.includes(p)) ||
    (lower.includes('macdn.aoneroom.com') && lower.includes('/other/'))
  );
};

function toStream(item: any, fallbackRes = 0): Stream | null {
  const url = item?.resourceLink ?? item?.url ?? item?.downloadUrl;
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return null;

  const res = Number(item?.resolution ?? 0) || fallbackRes;
  const size = Number(item?.size ?? item?.firstSize ?? 0) || 0;
  return {
    id: String(item?.resourceId ?? url),
    url,
    resolution: res,
    quality: qualityOf(res),
    sizeBytes: size,
    sizeLabel: sizeLabel(size),
    codec: String(item?.codecName ?? ''),
    direct: !isAdUrl(url),
  };
}

const resolutionFromLink = (link?: string) => {
  const m = /(\d{3,4})[pP]/.exec(link ?? '');
  return m ? Number(m[1]) : 0;
};

/**
 * Resolves playable streams for a title.
 *
 * MovieBox returns real signed MP4s in `resourceDetectors[].downloadUrl` /
 * `resolutionList[]` and in `play-info`. Two traps:
 *
 * 1. `play-info` without `se`/`ep` returns nothing for series, and the
 *    per-episode `resource` listing is full of promo clips. Both are probed
 *    here with explicit season/episode so real files are found.
 * 2. When the title is not licensed for this tier the API hands back a 23 s
 *    promo instead of the movie. Those URLs are dropped outright — showing an
 *    ad is worse than showing "no source", so ads are never returned.
 */
export async function fetchStreams(id: string, season = 0, episode = 0): Promise<Stream[]> {
  const found: Stream[] = [];
  const seen = new Set<string>();

  const add = (s: Stream | null) => {
    if (!s || !s.direct) return; // ads never enter the list
    const key = s.url.split('?')[0];
    if (seen.has(key)) return;
    seen.add(key);
    found.push(s);
  };

  const detailsPromise = client
    .get<any>(`/wefeed-mobile-bff/subject-api/get?subjectId=${id}`)
    .catch(() => null);

  const playInfo = (se: number, ep: number) =>
    client
      .get<any>(
        se === 0 && ep === 0
          ? `/wefeed-mobile-bff/subject-api/play-info/v2?subjectId=${id}`
          : `/wefeed-mobile-bff/subject-api/play-info/v2?subjectId=${id}&se=${se}&ep=${ep}`,
      )
      .catch(() => null);

  const [details, plainPlayInfo] = await Promise.all([detailsPromise, playInfo(0, 0)]);

  const subject = details?.subject ?? details;

  for (const detector of subject?.resourceDetectors ?? []) {
    const list = detector?.resolutionList ?? [];
    if (list.length) {
      for (const item of list) add(toStream(item));
    } else if (detector?.downloadUrl) {
      add(toStream({ ...detector, resourceLink: detector.downloadUrl, resolution: resolutionFromLink(detector.resourceLink) }));
    }
  }

  const addPlayInfo = (payload: any) => {
    for (const s of payload?.streams ?? []) {
      add(
        toStream({
          resourceLink: s?.url,
          resolution: Number(String(s?.resolutions ?? '').split(',')[0]) || 0,
          size: s?.size,
          codecName: s?.codecName,
          resourceId: s?.id,
        }),
      );
    }
  };

  addPlayInfo(plainPlayInfo);

  // Series return nothing without se/ep. Probe the requested episode, and fall
  // back to the first couple of episodes so a movie-style call still resolves.
  if (!found.length) {
    const probes: Array<[number, number]> =
      season > 0 && episode > 0
        ? [[season, episode], [1, 1], [1, 2]]
        : [[1, 1], [1, 2]];
    for (const [se, ep] of probes) {
      addPlayInfo(await playInfo(se, ep));
      if (found.length) break;
    }
  }

  // Per-episode resource listing. The listing itself is mostly promo clips, but
  // the direct file is occasionally recoverable here.
  const listPath =
    season > 0 && episode > 0
      ? `/wefeed-mobile-bff/subject-api/resource/v2?subjectId=${id}&page=1&perPage=20&all=0&startPosition=1&endPosition=1&pagerMode=2&resolution=0&se=${season}&epFrom=${episode}&epTo=${episode}&isVip=true`
      : `/wefeed-mobile-bff/subject-api/resource?subjectId=${id}&page=1&perPage=20`;
  try {
    const res = await client.get<any>(listPath);
    for (const item of res?.list ?? []) {
      if (season > 0 && episode > 0 && (Number(item?.se) !== season || Number(item?.ep) !== episode)) continue;
      add(toStream(item));
    }
  } catch {
    /* keep whatever we already have */
  }

  // MovieBox mostly ships HEVC, which only decodes on devices with an HEVC
  // decoder. H.264 plays everywhere, so when both exist for the same resolution
  // the H.264 variant is offered first.
  const compat = (s: Stream) => (/h264|avc/i.test(s.codec) ? 0 : 1);
  return found.sort(
    (a, b) =>
      b.resolution - a.resolution ||
      compat(a) - compat(b) ||
      b.sizeBytes - a.sizeBytes,
  );
}

/* ------------------------------------------------------------------ */
/* Shorts, Live TV and category browsing                              */
/* ------------------------------------------------------------------ */

export interface ShortItem {
  id: string;
  title: string;
  author: string;
  avatar: string;
  cover: string;
  videoUrl: string;
  likes: number;
  comments: number;
  duration: number;
  groupName: string;
}

/** Shorts feed (`business/shorts`) — vertical videos with a real MP4 each. */
export async function fetchShorts(page = 1, perPage = 12): Promise<ShortItem[]> {
  const payload = await client.get<any>(
    `/wefeed-mobile-bff/business/shorts?page=${page}&perPage=${perPage}`,
  );
  const out: ShortItem[] = [];
  for (const it of payload?.items ?? []) {
    const media = it?.media ?? {};
    // Video renditions live in `media.video[]`; pick the richest definition.
    const renditions: any[] = Array.isArray(media?.video) ? media.video : [];
    const best = renditions
      .filter((v) => typeof v?.url === 'string' && v.url)
      .sort((a, b) => Number(b?.definition ?? 0) - Number(a?.definition ?? 0) || Number(b?.size ?? 0) - Number(a?.size ?? 0))[0];
    const url = best?.url ?? media?.url ?? it?.link;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) continue;
    const stat = it?.stat ?? {};
    out.push({
      id: String(it?.postId ?? url),
      title: String(it?.title || it?.content || 'Short'),
      author: String(it?.user?.nickname || it?.user?.username || 'MovieBox'),
      avatar: String(it?.user?.avatar ?? ''),
      cover: String(media?.cover?.url ?? it?.cover?.url ?? ''),
      videoUrl: url,
      likes: Number(stat.likeCount ?? stat.likes ?? stat.like ?? 0),
      comments: Number(stat.commentCount ?? stat.comments ?? stat.comment ?? 0),
      duration: Number(best?.duration ?? 0),
      groupName: String(it?.group?.name ?? ''),
    });
  }
  return out;
}

export interface LiveChannel {
  id: string;
  name: string;
  country: string;
  flag: string;
  logo: string;
  languages: string[];
  streams: { url: string; type: string }[];
}

const toChannel = (c: any): LiveChannel => ({
  id: String(c?.channelId ?? ''),
  name: String(c?.title ?? 'Channel'),
  country: String(c?.countryName ?? ''),
  flag: String(c?.countryFlag ?? ''),
  logo: String(c?.cover?.url ?? c?.countryFlagImage?.url ?? ''),
  languages: (c?.languageCodes ?? []).map(String),
  streams: (c?.streams ?? [])
    .filter((s: any) => typeof s?.url === 'string' && s.url)
    .map((s: any) => ({ url: String(s.url), type: String(s?.urlType ?? '') })),
});

/** Countries that have live channels. */
export async function fetchLiveCountries(): Promise<{ code: string; name: string; flag: string }[]> {
  const payload = await client.get<any>('/wefeed-mobile-bff/live/tv-country-list');
  return (payload?.items ?? [])
    .filter((c: any) => Number(c?.channelCount ?? 0) > 0 || c?.countryCode)
    .map((c: any) => ({
      code: String(c?.countryCode ?? ''),
      name: String(c?.countryName ?? ''),
      flag: String(c?.countryFlag ?? ''),
    }))
    .filter((c: any) => c.code);
}

/** Live channels for one country, with playable HLS URLs. */
export async function fetchLiveChannels(countryCode = 'IN', page = 1, perPage = 60): Promise<LiveChannel[]> {
  const payload = await client.get<any>(
    `/wefeed-mobile-bff/live/tv-channel-list-by-country?countryCode=${countryCode}&page=${page}&perPage=${perPage}`,
  );
  return (payload?.items ?? []).map(toChannel).filter((c: LiveChannel) => c.id);
}

/** Single channel lookup, used when a stream needs re-resolving. */
export async function fetchLiveChannel(channelId: string): Promise<LiveChannel | null> {
  const payload = await client.get<any>(`/wefeed-mobile-bff/live/tv-channel?channel_id=${channelId}`);
  if (!payload?.channelId) return null;
  return toChannel(payload);
}

export interface GenreFacet {
  id: string;
  name: string;
}

/** Genre facets the filter sheet offers for movies or series. */
export async function fetchGenreFacets(subjectType: 1 | 2 = 1): Promise<GenreFacet[]> {
  const payload = await client.get<any>(
    `/wefeed-mobile-bff/subject-api/filter-items?subjectType=${subjectType}`,
  );
  const list = payload?.typeList?.[0]?.items ?? [];
  const genre = list.find((i: any) => i?.filterType === 'genre');
  return (genre?.filterVals ?? []).map((name: string) => ({ id: name, name }));
}

/** Subject listing for one home tab, used by Browse. */
export async function fetchTabSubjects(tabId = '0'): Promise<Title[]> {
  const home = await fetchHome(tabId);
  return Object.values(home.titles);
}

/**
 * Episode thumbnails.
 *
 * The resource listing returns the same placeholder clip for every episode and
 * carries no artwork, so the closest real data is the series cover. Reusing it
 * per episode at least gives the grid a real image instead of generative art.
 */
export function episodeThumb(details: MediaDetails, ep: number): string {
  return details.poster || artwork(`${details.id}-e${ep}`, 400, 225);
}

export interface SportMatch {
  id: string;
  team1: string;
  team2: string;
  team1Logo: string;
  team2Logo: string;
  league: string;
  sport: string;
  startTime: number;
  timeDesc: string;
  live: boolean;
  status: string;
  playPath: string;
  score1: number | null;
  score2: number | null;
}

const toMatch = (m: any): SportMatch => {
  const live = /live|inprogress|playing/i.test(String(m?.statusLive ?? '')) || /live/i.test(String(m?.status ?? ''));
  return {
    id: String(m?.id ?? ''),
    team1: String(m?.team1?.name ?? 'TBD'),
    team2: String(m?.team2?.name ?? 'TBD'),
    team1Logo: String(m?.team1?.avatar ?? ''),
    team2Logo: String(m?.team2?.avatar ?? ''),
    league: String(m?.league?.name ?? m?.league?.leagueName ?? ''),
    sport: String(m?.type ?? m?.team1?.type ?? ''),
    startTime: Number(m?.startTime ?? 0),
    timeDesc: String(m?.timeDesc ?? ''),
    live,
    status: String(m?.status ?? ''),
    playPath: String(m?.playPath ?? ''),
    score1: Number.isFinite(Number(m?.matchResult?.team1Score ?? m?.teamMatchInfo1?.score))
      ? Number(m?.matchResult?.team1Score ?? m?.teamMatchInfo1?.score)
      : null,
    score2: Number.isFinite(Number(m?.matchResult?.team2Score ?? m?.teamMatchInfo2?.score))
      ? Number(m?.matchResult?.team2Score ?? m?.teamMatchInfo2?.score)
      : null,
  };
};

/** Live and upcoming sports fixtures, some with a playable HLS path. */
export async function fetchMatches(page = 1, perPage = 20): Promise<SportMatch[]> {
  const payload = await client.get<any>(
    `/wefeed-mobile-bff/sport/match-list?page=${page}&perPage=${perPage}`,
  );
  return (payload?.list ?? []).map(toMatch).filter((m: SportMatch) => m.id);
}

export interface SportNews {
  id: string;
  title: string;
  summary: string;
  image: string;
  source: string;
  url: string;
}

/** Sports headlines shown alongside the fixture list. */
export async function fetchSportNews(page = 1, perPage = 12): Promise<SportNews[]> {
  const payload = await client.get<any>(
    `/wefeed-mobile-bff/sport-news/trending?page=${page}&perPage=${perPage}`,
  );
  return (payload?.items ?? []).map((n: any) => ({
    id: String(n?.id ?? ''),
    title: String(n?.title ?? ''),
    summary: String(n?.summary ?? ''),
    image: String(n?.cover?.url ?? n?.image?.url ?? ''),
    source: String(n?.source ?? ''),
    url: String(n?.url ?? n?.link ?? ''),
  })).filter((n: SportNews) => n.id);
}
