/**
 * 免金鑰定位：OpenStreetMap Nominatim（輕量個人使用；請勿連續高頻呼叫）
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

let lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = 1100 - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;
  await throttle();
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 9000) : null;
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tw&accept-language=zh-TW&q=` +
      encodeURIComponent(q);
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl?.signal });
    if (!res.ok) return null;
    const list = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!Array.isArray(list) || list.length === 0) return null;
    const lat = Number(list[0].lat);
    const lng = Number(list[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: list[0].display_name };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 先用完整地址，不行就退回「店名 + 行政區」、「捷運站」 */
export async function geocodeSpotSmart(params: {
  name?: string;
  address?: string;
  city?: string;
  district?: string;
  mrt?: string;
}): Promise<GeocodeResult | null> {
  const attempts: string[] = [];
  if (params.address) attempts.push(params.address.startsWith(params.city || '') ? params.address : `${params.city || ''}${params.address}`);
  if (params.name && params.district) attempts.push(`${params.name} ${params.city || ''}${params.district}`);
  if (params.mrt) attempts.push(`捷運${params.mrt} ${params.city || '台北市'}`);
  if (params.district) attempts.push(`${params.city || ''}${params.district}`);
  for (const q of attempts) {
    const hit = await geocodeAddress(q);
    if (hit) return hit;
  }
  return null;
}

/** 從 Google Maps 連結中擷取座標（@lat,lng 或 q=lat,lng） */
export function extractLatLngFromUrl(url: string): { lat: number; lng: number } | null {
  const m = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(url) || /[?&](?:q|query|ll)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(url);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
