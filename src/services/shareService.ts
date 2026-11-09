import LZString from 'lz-string';
import { Spot } from '../types/pocket';
import { writePermanentCloud, readPermanentCloud } from './cloudSync';

/**
 * 「分享給朋友挑店」唯讀精選清單：
 * 把挑選的店卡（公開資訊，不含個人筆記）壓縮後寫入公開雲端 KV，分享連結只帶短代碼（< 120 字元）。
 */

export interface SharePayload {
  v: 1;
  title: string;
  from: string;
  createdAt: number;
  spots: Array<
    Pick<
      Spot,
      | 'id'
      | 'name'
      | 'category'
      | 'city'
      | 'district'
      | 'mrt'
      | 'zone'
      | 'address'
      | 'lat'
      | 'lng'
      | 'hours'
      | 'priceHint'
      | 'tags'
      | 'highlights'
      | 'summary'
      | 'source'
      | 'coverThumb'
    >
  >;
}

const SHARE_PREFIX = 'bobopocket_share_v1_';
const SHARE_ENVELOPE = 'BPS1:';

function randomCode(len = 10): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function buildSharePayload(spots: Spot[], title: string, from: string): SharePayload {
  const slim = spots.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    city: s.city,
    district: s.district,
    mrt: s.mrt,
    zone: s.zone,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    hours: s.hours,
    priceHint: s.priceHint,
    tags: s.tags,
    highlights: s.highlights,
    summary: s.summary,
    source: s.source ? { platform: s.source.platform, url: s.source.url, author: s.source.author } : undefined,
    coverThumb: s.coverThumb,
  }));
  // 控制總量：若含圖超過 150k 字元，逐步移除封面圖
  let payload: SharePayload = { v: 1, title, from, createdAt: Date.now(), spots: slim };
  let json = JSON.stringify(payload);
  let idx = slim.length - 1;
  while (json.length > 150000 && idx >= 0) {
    slim[idx] = { ...slim[idx], coverThumb: undefined };
    payload = { ...payload, spots: slim };
    json = JSON.stringify(payload);
    idx--;
  }
  return payload;
}

export async function publishShare(payload: SharePayload): Promise<string | null> {
  const code = randomCode();
  const compressed = SHARE_ENVELOPE + LZString.compressToBase64(JSON.stringify(payload));
  const ok = await writePermanentCloud(`${SHARE_PREFIX}${code}`, compressed);
  return ok ? code : null;
}

export async function fetchShare(code: string): Promise<SharePayload | null> {
  const clean = code.replace(/[^a-z0-9]/gi, '').slice(0, 24);
  if (!clean) return null;
  const raw = await readPermanentCloud(`${SHARE_PREFIX}${clean}`);
  if (!raw || !raw.startsWith(SHARE_ENVELOPE)) return null;
  try {
    const json = LZString.decompressFromBase64(raw.slice(SHARE_ENVELOPE.length));
    if (!json) return null;
    const parsed = JSON.parse(json) as SharePayload;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.spots)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareUrl(code: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?share=${code}`;
}
