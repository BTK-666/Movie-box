// MD5 (RFC 1321) and HMAC-MD5.
//
// The MovieBox API signs every request with HMAC-MD5, but the Web Crypto API
// deliberately omits MD5. This is a self-contained implementation so the app
// works in a browser and in the Android WebView without polyfills.

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const K = new Uint32Array(64);
for (let i = 0; i < 64; i++) {
  K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
}

function rotl(x: number, c: number) {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}

export function md5(input: Uint8Array): Uint8Array {
  const len = input.length;
  // Padded length: message + 0x80 + zeros + 8-byte length, rounded to 64 bytes.
  const paddedLen = (((len + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(paddedLen);
  buf.set(input);
  buf[len] = 0x80;

  const bitLenLo = (len << 3) >>> 0;
  const bitLenHi = Math.floor(len / 536870912) >>> 0;
  const dv = new DataView(buf.buffer);
  dv.setUint32(paddedLen - 8, bitLenLo, true);
  dv.setUint32(paddedLen - 4, bitLenHi, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Uint32Array(16);

  for (let off = 0; off < paddedLen; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[i])) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, a0, true);
  odv.setUint32(4, b0, true);
  odv.setUint32(8, c0, true);
  odv.setUint32(12, d0, true);
  return out;
}

export function md5Hex(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? utf8(input) : input;
  let hex = '';
  for (const b of md5(bytes)) hex += b.toString(16).padStart(2, '0');
  return hex;
}

const BLOCK = 64;

export function hmacMd5(key: Uint8Array, message: Uint8Array): Uint8Array {
  const k = key.length > BLOCK ? md5(key) : key;
  const padded = new Uint8Array(BLOCK);
  padded.set(k);

  const ipad = new Uint8Array(BLOCK);
  const opad = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) {
    ipad[i] = padded[i] ^ 0x36;
    opad[i] = padded[i] ^ 0x5c;
  }

  const inner = md5(concat(ipad, message));
  return md5(concat(opad, inner));
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function base64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
