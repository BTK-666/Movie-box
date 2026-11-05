// MovieBox API client.
//
// Ported from the MovieBox-TUI Rust provider (src/providers/moviebox). Every
// request is signed with x-client-token and x-tr-signature; the signing scheme
// is reproduced exactly from crypto.rs so the same backend accepts us.

import { hmacMd5, md5Hex, base64, utf8 } from './md5';

const HOST_POOL = [
  'https://api6.aoneroom.com',
  'https://api5.aoneroom.com',
  'https://api4.aoneroom.com',
  'https://api4sg.aoneroom.com',
  'https://api3.aoneroom.com',
  'https://api6sg.aoneroom.com',
  'https://api.inmoviebox.com',
];

const RETRY_STATUS = new Set([403, 406, 407, 429, 500, 502, 503, 504]);

// Signing secret baked into the MovieBox Android client.
const SECRET = new Uint8Array([
  0xef, 0xa8, 0x91, 0x97, 0x4e, 0xec, 0xd3, 0x14, 0x8d, 0xf6, 0x3a, 0xa6,
  0x11, 0x60, 0x2d, 0xef, 0xd1, 0x01, 0x25, 0x9b, 0xa5, 0x21, 0x02, 0x2c,
  0x57, 0xae, 0x05, 0x66, 0xbd, 0x8e,
]);

const SIGNATURE_BODY_MAX_BYTES = 102400;
const ACCEPT = 'application/json';
const CONTENT_TYPE = 'application/json';

const ANDROID_VERSIONS: [string, string][] = [
  ['9', 'PQ3A.190605.03081104'],
  ['10', 'QP1A.191005.007.A3'],
  ['11', 'RP1A.200720.011'],
  ['12', 'S1B.220414.015'],
  ['13', 'TQ2A.230405.003'],
];
const DEVICES: [string, string][] = [
  ['23078RKD5C', 'Redmi'],
  ['2201117TY', 'Redmi'],
  ['22101316G', 'Redmi'],
  ['M2012K11AG', 'Redmi'],
];
const VERSION_CODES = [50020117, 50020118, 50020119, 50020120, 50020121];
const NETWORKS = ['NETWORK_WIFI', 'NETWORK_MOBILE'];
const TIMEZONES = ['Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'America/New_York', 'Europe/London'];
const IP_PREFIXES = ['103.241', '49.36', '117.195', '106.198', '122.162', '157.32', '182.70', '103.58', '27.60', '59.90'];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function randomHex(len: number) {
  let s = '';
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

function randomUuid() {
  return `${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`;
}

export function generateClientIdentity() {
  const android = pick(ANDROID_VERSIONS);
  const device = pick(DEVICES);
  const versionCode = pick(VERSION_CODES);

  const userAgent =
    `com.community.oneroom/${versionCode} (Linux; U; Android ${android[0]}; en_US; ` +
    `${device[0]}; Build/${android[1]}; Cronet/135.0.7012.3)`;

  const clientInfo = JSON.stringify({
    package_name: 'com.community.oneroom',
    version_name: '4.0.01.0813.03',
    version_code: versionCode,
    os: 'android',
    os_version: android[0],
    install_ch: 'ps',
    device_id: randomHex(32),
    install_store: 'ps',
    gaid: randomUuid(),
    brand: device[1],
    model: device[0],
    system_language: 'en',
    net: pick(NETWORKS),
    region: 'US',
    timezone: pick(TIMEZONES),
    sp_code: '40401',
    'X-Play-Mode': '2',
  });

  const spoofedIp = `${pick(IP_PREFIXES)}.${1 + Math.floor(Math.random() * 253)}.${1 + Math.floor(Math.random() * 253)}`;

  return { userAgent, clientInfo, spoofedIp };
}

export function generateXClientToken(ts: number) {
  const tsStr = String(ts);
  const reversed = tsStr.split('').reverse().join('');
  return `${tsStr},${md5Hex(reversed)}`;
}

function sortedQueryString(url: URL): string {
  const pairs: string[] = [];
  url.searchParams.forEach((v, k) => pairs.push(`${k}=${v}`));
  pairs.sort((a, b) => {
    const ka = a.slice(0, a.indexOf('='));
    const kb = b.slice(0, b.indexOf('='));
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return pairs.join('&');
}

export function buildCanonicalString(
  method: string,
  accept: string | undefined,
  contentType: string | undefined,
  url: string,
  body: string | undefined,
  timestampMs: number,
) {
  const parsed = new URL(url);
  const query = sortedQueryString(parsed);
  const canonicalUrl = query ? `${parsed.pathname}?${query}` : parsed.pathname;

  let bodyHash = '';
  let bodyLength = '';
  if (body !== undefined) {
    const bytes = utf8(body);
    const truncated = bytes.length > SIGNATURE_BODY_MAX_BYTES ? bytes.subarray(0, SIGNATURE_BODY_MAX_BYTES) : bytes;
    bodyHash = md5Hex(truncated);
    bodyLength = String(bytes.length);
  }

  return [
    method.toUpperCase(),
    accept ?? '',
    contentType ?? '',
    bodyLength,
    timestampMs,
    bodyHash,
    canonicalUrl,
  ].join('\n');
}

export function generateXTrSignature(
  method: string,
  accept: string | undefined,
  contentType: string | undefined,
  url: string,
  body: string | undefined,
  timestampMs: number,
) {
  const canonical = buildCanonicalString(method, accept, contentType, url, body, timestampMs);
  const sig = base64(hmacMd5(SECRET, utf8(canonical)));
  return `${timestampMs}|2|${sig}`;
}

export interface Session {
  token: string;
  uid?: string;
  expiresAt?: number;
}

export class MovieBoxError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'MovieBoxError';
    this.status = status;
  }
}

export class MovieBoxClient {
  private identity = generateClientIdentity();
  private session: Session | null = null;
  private hostIndex = 0;
  private initPromise: Promise<Session> | null = null;

  private buildHeaders(method: string, url: string, body: string | undefined, token?: string) {
    const ts = Date.now();
    const headers: Record<string, string> = {
      'user-agent': this.identity.userAgent,
      accept: ACCEPT,
      'content-type': CONTENT_TYPE,
      connection: 'keep-alive',
      'x-client-token': generateXClientToken(ts),
      'x-tr-signature': generateXTrSignature(method, ACCEPT, CONTENT_TYPE, url, body, ts),
      'x-client-info': this.identity.clientInfo,
      'x-client-status': '0',
      'x-forwarded-for': this.identity.spoofedIp,
    };
    if (token) headers.authorization = `Bearer ${token}`;
    return headers;
  }

  private async parse(resp: Response) {
    if (!resp.ok) throw new MovieBoxError(`HTTP ${resp.status}`, resp.status);
    const json = await resp.json();
    return json && typeof json === 'object' && 'data' in json ? json.data : json;
  }

  private async requestHosts(
    method: string,
    pathAndQuery: string,
    body: string | undefined,
    token: string | undefined,
  ) {
    const start = this.hostIndex;
    let backoff = 50;
    let lastError: unknown = null;

    for (let i = 0; i < HOST_POOL.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, backoff));
      backoff = 50;

      const idx = (start + i) % HOST_POOL.length;
      const base = HOST_POOL[idx];
      const url = base + pathAndQuery;

      try {
        const resp = await fetch(url, {
          method,
          headers: this.buildHeaders(method, url, body, token),
          body,
        });

        if (RETRY_STATUS.has(resp.status)) {
          this.hostIndex = (idx + 1) % HOST_POOL.length;
          const retryAfter = Number(resp.headers.get('retry-after'));
          if (resp.status === 429 && retryAfter) backoff = Math.min(retryAfter * 1000, 3000);
          lastError = new MovieBoxError(`HTTP ${resp.status}`, resp.status);
          continue;
        }

        this.hostIndex = idx;
        return await this.parse(resp);
      } catch (err) {
        lastError = err;
        this.hostIndex = (idx + 1) % HOST_POOL.length;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new MovieBoxError('All hosts exhausted');
  }

  private async ensureSession(): Promise<Session> {
    if (this.session && (!this.session.expiresAt || this.session.expiresAt > Date.now())) {
      return this.session;
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const data = await this.requestHosts('POST', '/wefeed-mobile-bff/user-api/visitor-login', '{}', undefined);
      const token = data?.token;
      if (!token) throw new MovieBoxError('Missing token');
      const session: Session = {
        token,
        uid: String(data?.uid ?? data?.userId ?? ''),
        expiresAt: Date.now() + 30 * 60 * 1000,
      };
      this.session = session;
      return session;
    })();

    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async request(method: string, pathAndQuery: string, body?: unknown) {
    const bodyStr = body === undefined ? undefined : JSON.stringify(body);

    try {
      const session = await this.ensureSession();
      return await this.requestHosts(method, pathAndQuery, bodyStr, session.token);
    } catch (err) {
      const status = (err as MovieBoxError)?.status;
      if (status === 401 || status === 403) {
        this.session = null;
        const session = await this.ensureSession();
        return await this.requestHosts(method, pathAndQuery, bodyStr, session.token);
      }
      throw err;
    }
  }

  get<T = any>(pathAndQuery: string): Promise<T> {
    return this.request('GET', pathAndQuery) as Promise<T>;
  }

  post<T = any>(pathAndQuery: string, body: unknown): Promise<T> {
    return this.request('POST', pathAndQuery, body) as Promise<T>;
  }

  reset() {
    this.session = null;
    this.identity = generateClientIdentity();
  }

  get userAgent() {
    return this.identity.userAgent;
  }
}

export const client = new MovieBoxClient();

export { HOST_POOL, SECRET };
