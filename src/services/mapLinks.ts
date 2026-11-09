/**
 * 手機地圖整合：Google Maps／Apple 地圖 開啟・導航連結，以及「分享連結」反向解析
 */

export interface MapShareInfo {
  provider: 'google' | 'apple' | null;
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  /** 短網址（maps.app.goo.gl）需先經代理展開才能取得座標 */
  isShortLink: boolean;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
}

function hasCoords(lat?: number, lng?: number): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
}

export function googleMapsViewUrl(name: string, address?: string, lat?: number, lng?: number): string {
  const query = encodeURIComponent(`${name} ${address || ''}`.trim());
  if (hasCoords(lat, lng)) return `https://www.google.com/maps/search/?api=1&query=${query}&center=${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function googleMapsDirectionsUrl(name: string, address?: string, lat?: number, lng?: number): string {
  const dest = hasCoords(lat, lng) ? `${lat},${lng}` : `${name} ${address || ''}`.trim();
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=transit`;
}

export function appleMapsViewUrl(name: string, address?: string, lat?: number, lng?: number): string {
  const q = encodeURIComponent(name);
  if (hasCoords(lat, lng)) return `https://maps.apple.com/?q=${q}&ll=${lat},${lng}`;
  return `https://maps.apple.com/?q=${encodeURIComponent(`${name} ${address || ''}`.trim())}`;
}

export function appleMapsDirectionsUrl(name: string, address?: string, lat?: number, lng?: number): string {
  if (hasCoords(lat, lng)) return `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(name)}&dirflg=r`;
  return `https://maps.apple.com/?daddr=${encodeURIComponent(`${name} ${address || ''}`.trim())}&dirflg=r`;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

function num(s: string | null | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** 解析 Google Maps／Apple 地圖「分享」連結中可直接讀到的店名、地址、座標 */
export function parseMapShareUrl(rawUrl: string): MapShareInfo {
  const url = (rawUrl || '').trim();
  const info: MapShareInfo = { provider: null, isShortLink: false };
  if (!url) return info;

  if (/maps\.apple\.com|^maps:\/\//i.test(url)) {
    info.provider = 'apple';
    let params: URLSearchParams;
    try {
      params = new URL(url.replace(/^maps:\/\//i, 'https://maps.apple.com/')).searchParams;
    } catch {
      return info;
    }
    const ll = params.get('ll') || params.get('sll');
    if (ll) {
      const [a, b] = ll.split(',');
      const lat = num(a);
      const lng = num(b);
      if (hasCoords(lat, lng)) {
        info.lat = lat;
        info.lng = lng;
      }
    }
    const name = params.get('name') || params.get('q');
    if (name && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(name)) info.name = safeDecode(name);
    const address = params.get('address');
    if (address) info.address = safeDecode(address);
    return info;
  }

  if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google/i.test(url)) {
    info.provider = 'google';
    info.isShortLink = /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);
    const exact = /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(url);
    const at = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(url);
    const q = /[?&](?:q|query|ll|destination|center)=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i.exec(url);
    const hit = exact || at || q;
    if (hit) {
      const lat = num(hit[1]);
      const lng = num(hit[2]);
      if (hasCoords(lat, lng)) {
        info.lat = lat;
        info.lng = lng;
      }
    }
    const place = /\/maps\/place\/([^/@?]+)/.exec(url);
    if (place) {
      const n = safeDecode(place[1]).trim();
      if (n && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(n)) info.name = n;
    } else {
      const qName = /[?&](?:q|query)=([^&]+)/i.exec(url);
      if (qName) {
        const n = safeDecode(qName[1]).trim();
        if (n && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(n)) info.name = n;
      }
    }
    return info;
  }
  return info;
}

/** 從 Google Maps 地點頁 HTML（經代理取得）盡力擷取店名・地址・座標 */
export function extractPlaceFromGoogleHtml(html: string): Partial<MapShareInfo> {
  const out: Partial<MapShareInfo> = {};
  if (!html) return out;
  const og =
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html) ||
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i.exec(html);
  if (og && og[1].trim()) {
    const [name, ...rest] = og[1].split(' · ');
    out.name = name.trim();
    if (rest.length > 0) out.address = rest.join(' · ').trim();
  }
  if (!out.name) {
    const t = /<title>([^<]{1,120}?)(?: - Google (?:地圖|Maps))?<\/title>/i.exec(html);
    if (t && t[1].trim()) out.name = t[1].trim();
  }
  const exact = /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(html);
  const canonical = /rel=["']canonical["'][^>]+href=["'][^"']*@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/i.exec(html);
  const center = /staticmap\?center=(-?\d{1,2}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/i.exec(html);
  const hit = exact || canonical || center;
  if (hit) {
    const lat = Number(hit[1]);
    const lng = Number(hit[2]);
    if (hasCoords(lat, lng)) {
      out.lat = lat;
      out.lng = lng;
    }
  }
  return out;
}

/** Haversine 距離（公里） */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(10, Math.round(km * 1000 / 10) * 10)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function getCurrentPosition(timeoutMs = 9000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}
