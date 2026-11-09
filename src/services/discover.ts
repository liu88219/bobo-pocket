import { Spot, makeId } from '../types/pocket';
import { parseSpotDraft } from './spotParser';
import { distanceKm } from './mapLinks';

/**
 * 「探索」：找還沒收錄的店／景點
 * - 免金鑰引擎：OpenStreetMap Overpass API（依類別／料理／名稱關鍵字）＋ Nominatim 關鍵字保底
 * - 進階引擎（選填）：Google Places API (New) Text Search — 支援「板橋 適合慶生的餐廳」這種自然語句，含評分
 */

export interface DiscoverTheme {
  id: string;
  label: string;
  emoji: string;
  /** 建議對應的分類 id */
  categoryId: string;
  /** Overpass 篩選條件（多組 OR） */
  overpass: string[];
  /** Nominatim／Google 查詢用關鍵字 */
  keyword: string;
  /** 免金鑰引擎對此主題的支援度說明 */
  freeHint?: string;
}

const REST = '["amenity"~"^(restaurant|fast_food|food_court)$"]';
const CAFE = '["amenity"~"^(cafe|ice_cream)$"]';
const BAR = '["amenity"~"^(bar|pub|biergarten|nightclub)$"]';

export const DISCOVER_THEMES: DiscoverTheme[] = [
  { id: 'food', label: '美食', emoji: '🍜', categoryId: 'food', overpass: [REST], keyword: '美食 餐廳' },
  { id: 'pasta', label: '義大利麵', emoji: '🍝', categoryId: 'pasta', overpass: [`${REST}["cuisine"~"italian|pasta|pizza",i]`, `${REST}["name"~"義大利|義式|Pasta|Trattoria|Osteria|Pizzeria",i]`], keyword: '義大利麵' },
  { id: 'cafe', label: '咖啡廳', emoji: '☕', categoryId: 'cafe', overpass: [CAFE, `["shop"="coffee"]`], keyword: '咖啡廳' },
  { id: 'birthday', label: '慶生餐廳', emoji: '🥂', categoryId: 'birthday', overpass: [`${REST}["cuisine"~"steak|french|italian|fine_dining|teppanyaki|fusion|western",i]`, `${REST}["name"~"餐酒館|牛排|鐵板燒|Bistro|Steak|景觀|Buffet|吃到飽|Dining",i]`], keyword: '適合慶生的餐廳', freeHint: '免金鑰引擎以「牛排／餐酒館／鐵板燒／Buffet」等近似條件搜尋；要精準語意請用 Google 引擎或請管家找' },
  { id: 'cake', label: '生日蛋糕', emoji: '🎂', categoryId: 'cake', overpass: [`["shop"~"^(bakery|pastry|confectionery)$"]`, `["name"~"蛋糕|Cake|Pâtisserie|Patisserie|甜點",i]`], keyword: '生日蛋糕 蛋糕店' },
  { id: 'western', label: '西餐', emoji: '🥩', categoryId: 'western', overpass: [`${REST}["cuisine"~"steak|french|western|american|european|spanish|german",i]`, `${REST}["name"~"牛排|Steak|Bistro|餐酒館|洋食",i]`], keyword: '西餐 牛排' },
  { id: 'dessert', label: '甜點早午餐', emoji: '🥞', categoryId: 'dessert', overpass: [`${REST}["cuisine"~"dessert|brunch|breakfast|pancake|waffle|bubble_tea|ice_cream",i]`, `["shop"~"^(bakery|pastry|confectionery)$"]`, `${CAFE}["cuisine"~"dessert|cake|waffle",i]`], keyword: '甜點 早午餐' },
  { id: 'hotpot', label: '火鍋', emoji: '🍲', categoryId: 'hotpot', overpass: [`${REST}["cuisine"~"hotpot|hot_pot|shabu|sukiyaki",i]`, `${REST}["name"~"火鍋|鍋物|涮涮鍋|麻辣鍋|壽喜燒|Shabu",i]`], keyword: '火鍋' },
  { id: 'bbq', label: '燒肉', emoji: '🍖', categoryId: 'bbq', overpass: [`${REST}["cuisine"~"barbecue|bbq|yakiniku|korean_bbq|grill",i]`, `${REST}["name"~"燒肉|燒烤|烤肉|Yakiniku",i]`], keyword: '燒肉' },
  { id: 'burger', label: '漢堡', emoji: '🍔', categoryId: 'burger', overpass: [`["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"burger|american",i]`, `${REST}["name"~"漢堡|Burger",i]`], keyword: '漢堡' },
  { id: 'ramen', label: '拉麵／日料', emoji: '🍣', categoryId: 'food', overpass: [`${REST}["cuisine"~"ramen|japanese|sushi|izakaya|udon|donburi",i]`, `${REST}["name"~"拉麵|壽司|丼|日本料理|居酒屋",i]`], keyword: '拉麵 日本料理' },
  { id: 'korean', label: '韓式', emoji: '🥘', categoryId: 'food', overpass: [`${REST}["cuisine"~"korean",i]`, `${REST}["name"~"韓式|韓國|Korean",i]`], keyword: '韓式料理' },
  { id: 'thai', label: '泰式／東南亞', emoji: '🍛', categoryId: 'food', overpass: [`${REST}["cuisine"~"thai|vietnamese|indonesian|malaysian|singaporean",i]`, `${REST}["name"~"泰式|泰國|越南|南洋",i]`], keyword: '泰式料理' },
  { id: 'vegetarian', label: '素食／蔬食', emoji: '🥗', categoryId: 'food', overpass: [`${REST}["diet:vegetarian"="yes"]`, `${REST}["cuisine"~"vegetarian|vegan",i]`, `${REST}["name"~"素食|蔬食|Vegan",i]`], keyword: '素食 蔬食' },
  { id: 'izakaya', label: '居酒屋', emoji: '🏮', categoryId: 'izakaya', overpass: [`${REST}["cuisine"~"izakaya|yakitori|japanese",i]["name"~"居酒屋|串燒|燒鳥|酒場|Izakaya",i]`, `${REST}["cuisine"~"izakaya|yakitori",i]`, `${REST}["name"~"居酒屋|串燒|燒鳥|酒場|立吞|Izakaya",i]`, `${BAR}["name"~"居酒屋|酒場",i]`], keyword: '居酒屋' },
  { id: 'bistro', label: '餐酒館', emoji: '🍷', categoryId: 'bistro', overpass: [`${REST}["cuisine"~"bistro|french|tapas|wine|fusion",i]`, `${REST}["name"~"餐酒館|Bistro|Bistrot|Wine|Tapas|Brasserie|餐酒",i]`, `${BAR}["name"~"餐酒館|Bistro|Wine",i]`], keyword: '餐酒館' },
  { id: 'bar', label: '酒吧', emoji: '🍸', categoryId: 'bar', overpass: [BAR, `${REST}["name"~"Bar|酒吧|Lounge",i]`], keyword: '酒吧 調酒' },
  { id: 'late-night', label: '宵夜', emoji: '🍢', categoryId: 'late-night', overpass: [`${REST}["opening_hours"~"24/7|0[0-4]:[0-9][0-9]|2[3-4]:[0-9][0-9]"]`, `${REST}["name"~"熱炒|滷味|鹹酥雞|鹽酥雞|宵夜|深夜",i]`], keyword: '宵夜' },
  { id: 'spot', label: '景點', emoji: '🌿', categoryId: 'spot', overpass: [`["tourism"~"^(attraction|museum|gallery|viewpoint|artwork|theme_park|zoo|aquarium)$"]`, `["leisure"~"^(park|garden|nature_reserve)$"]`, `["historic"~"^(monument|temple|castle|building|heritage)$"]`], keyword: '景點' },
  { id: 'special-spot', label: '特別景點', emoji: '🎡', categoryId: 'special-spot', overpass: [`["tourism"~"^(viewpoint|artwork|theme_park|aquarium)$"]`, `["natural"~"^(waterfall|hot_spring|beach|peak)$"]`, `["name"~"秘境|步道|瀑布|夜景|觀景|天空|燈塔|溫泉",i]`], keyword: '特別景點 秘境' },
];

/** 雙北行政區中心點（探索時以半徑搜尋） */
export const DISTRICT_CENTERS: Record<string, { lat: number; lng: number; radius: number }> = {
  中正區: { lat: 25.0324, lng: 121.5199, radius: 2000 },
  大同區: { lat: 25.0632, lng: 121.513, radius: 1800 },
  中山區: { lat: 25.064, lng: 121.533, radius: 2600 },
  松山區: { lat: 25.05, lng: 121.557, radius: 2000 },
  大安區: { lat: 25.0264, lng: 121.5436, radius: 2400 },
  萬華區: { lat: 25.034, lng: 121.499, radius: 2000 },
  信義區: { lat: 25.033, lng: 121.567, radius: 2200 },
  士林區: { lat: 25.092, lng: 121.524, radius: 3200 },
  北投區: { lat: 25.132, lng: 121.502, radius: 3500 },
  內湖區: { lat: 25.069, lng: 121.589, radius: 3200 },
  南港區: { lat: 25.055, lng: 121.607, radius: 2800 },
  文山區: { lat: 24.989, lng: 121.57, radius: 3200 },
  板橋區: { lat: 25.012, lng: 121.462, radius: 2800 },
  三重區: { lat: 25.062, lng: 121.488, radius: 2400 },
  中和區: { lat: 24.999, lng: 121.499, radius: 2600 },
  永和區: { lat: 25.008, lng: 121.514, radius: 1600 },
  新莊區: { lat: 25.036, lng: 121.45, radius: 2800 },
  新店區: { lat: 24.968, lng: 121.542, radius: 3200 },
  土城區: { lat: 24.972, lng: 121.444, radius: 2600 },
  蘆洲區: { lat: 25.085, lng: 121.474, radius: 1800 },
  樹林區: { lat: 24.99, lng: 121.42, radius: 2800 },
  汐止區: { lat: 25.064, lng: 121.659, radius: 3200 },
  鶯歌區: { lat: 24.954, lng: 121.354, radius: 2400 },
  三峽區: { lat: 24.934, lng: 121.369, radius: 3000 },
  淡水區: { lat: 25.169, lng: 121.441, radius: 3200 },
  瑞芳區: { lat: 25.109, lng: 121.81, radius: 4000 },
  五股區: { lat: 25.083, lng: 121.438, radius: 2600 },
  泰山區: { lat: 25.059, lng: 121.43, radius: 2000 },
  林口區: { lat: 25.077, lng: 121.392, radius: 3200 },
  深坑區: { lat: 25.002, lng: 121.616, radius: 2200 },
  石碇區: { lat: 24.991, lng: 121.658, radius: 3500 },
  坪林區: { lat: 24.937, lng: 121.711, radius: 4000 },
  三芝區: { lat: 25.258, lng: 121.5, radius: 4000 },
  石門區: { lat: 25.29, lng: 121.568, radius: 4000 },
  八里區: { lat: 25.147, lng: 121.398, radius: 3200 },
  平溪區: { lat: 25.026, lng: 121.739, radius: 4500 },
  雙溪區: { lat: 25.034, lng: 121.866, radius: 4500 },
  貢寮區: { lat: 25.022, lng: 121.908, radius: 5000 },
  金山區: { lat: 25.222, lng: 121.636, radius: 4000 },
  萬里區: { lat: 25.179, lng: 121.689, radius: 4000 },
  烏來區: { lat: 24.865, lng: 121.55, radius: 5000 },
};

export interface DiscoverResult {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  typeLabel?: string;
  hours?: string;
  rating?: number;
  ratingCount?: number;
  priceHint?: string;
  website?: string;
  mapsUrl?: string;
  distanceKm?: number;
  engine: 'osm' | 'nominatim' | 'google';
}

export interface DiscoverQuery {
  center: { lat: number; lng: number };
  radius: number;
  theme: DiscoverTheme;
  keyword?: string;
  areaLabel: string;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    return await fetch(url, { ...init, signal: ctrl?.signal });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function escapeOverpassRegex(s: string): string {
  return s.replace(/[\\"]/g, '').replace(/[.*+?^${}()|[\]]/g, '\\$&');
}

export function buildOverpassQuery(q: DiscoverQuery): string {
  const { lat, lng } = q.center;
  const around = `(around:${Math.round(q.radius)},${lat.toFixed(5)},${lng.toFixed(5)})`;
  const kw = (q.keyword || '').trim();
  const filters = kw
    ? [`["name"~"${escapeOverpassRegex(kw)}",i]`, ...q.theme.overpass.map((f) => `${f}["name"~"${escapeOverpassRegex(kw)}",i]`)]
    : q.theme.overpass;
  const statements = filters.map((f) => `nwr${f}["name"]${around};`).join('\n  ');
  return `[out:json][timeout:25];\n(\n  ${statements}\n);\nout center tags 80;`;
}

const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function composeOsmAddress(tags: Record<string, string>): string | undefined {
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [tags['addr:city'], tags['addr:district'] || tags['addr:suburb'], tags['addr:street'], tags['addr:housenumber'] ? `${tags['addr:housenumber']}號` : ''].filter(Boolean);
  if (parts.length < 2) return undefined;
  return parts.join('').replace(/號號$/, '號');
}

function osmTypeLabel(tags: Record<string, string>): string | undefined {
  const cuisine = tags.cuisine ? tags.cuisine.split(';')[0].replace(/_/g, ' ') : '';
  const kind = tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.historic || tags.natural || '';
  return [kind, cuisine].filter(Boolean).join(' · ') || undefined;
}

export async function discoverViaOverpass(q: DiscoverQuery): Promise<DiscoverResult[]> {
  const body = `data=${encodeURIComponent(buildOverpassQuery(q))}`;
  let lastErr: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 28000);
      if (!res.ok) {
        lastErr = new Error(`Overpass ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { elements?: OverpassElement[] };
      const seen = new Set<string>();
      const out: DiscoverResult[] = [];
      for (const el of json.elements || []) {
        const tags = el.tags || {};
        const name = tags['name:zh-Hant'] || tags['name:zh'] || tags.name;
        if (!name) continue;
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;
        const key = name.toLowerCase().replace(/\s+/g, '');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          id: `osm-${el.type}-${el.id}`,
          name,
          address: composeOsmAddress(tags),
          lat,
          lng,
          typeLabel: osmTypeLabel(tags),
          hours: tags.opening_hours,
          website: tags.website || tags['contact:website'],
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&center=${lat},${lng}`,
          distanceKm: distanceKm(q.center.lat, q.center.lng, lat, lng),
          engine: 'osm',
        });
      }
      return out.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Overpass 無回應');
}

export async function discoverViaNominatim(q: DiscoverQuery): Promise<DiscoverResult[]> {
  const kw = [q.keyword, q.theme.keyword, q.areaLabel].filter(Boolean).join(' ');
  const d = 0.03;
  const viewbox = `${q.center.lng - d},${q.center.lat + d},${q.center.lng + d},${q.center.lat - d}`;
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=30&countrycodes=tw&accept-language=zh-TW&bounded=1&viewbox=${viewbox}&q=` +
    encodeURIComponent(kw);
  const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 12000);
  if (!res.ok) return [];
  const list = (await res.json()) as Array<{ place_id: number; lat: string; lon: string; display_name: string; name?: string; type?: string; category?: string }>;
  return list
    .filter((x) => x.name)
    .map((x) => {
      const lat = Number(x.lat);
      const lng = Number(x.lon);
      return {
        id: `nominatim-${x.place_id}`,
        name: x.name || x.display_name.split(',')[0],
        address: x.display_name.split(',').slice(0, 4).join(' ').trim(),
        lat,
        lng,
        typeLabel: [x.category, x.type].filter(Boolean).join(' · '),
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.name || '')}&center=${lat},${lng}`,
        distanceKm: distanceKm(q.center.lat, q.center.lng, lat, lng),
        engine: 'nominatim' as const,
      };
    })
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
}

const PLACES_KEY_STORAGE = 'bobopocket_places_key_v1';

export function loadPlacesKey(): string {
  try {
    return localStorage.getItem(PLACES_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function savePlacesKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(PLACES_KEY_STORAGE, key.trim());
    else localStorage.removeItem(PLACES_KEY_STORAGE);
  } catch {
    // ignore
  }
}

const PRICE_LEVEL_LABEL: Record<string, string> = {
  PRICE_LEVEL_FREE: '免費',
  PRICE_LEVEL_INEXPENSIVE: '$ 平價',
  PRICE_LEVEL_MODERATE: '$$ 中等',
  PRICE_LEVEL_EXPENSIVE: '$$$ 偏高',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$ 高價',
};

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryTypeDisplayName?: { text?: string };
  currentOpeningHours?: { weekdayDescriptions?: string[] };
  googleMapsUri?: string;
  websiteUri?: string;
}

export async function discoverViaGooglePlaces(q: DiscoverQuery, apiKey: string): Promise<DiscoverResult[]> {
  const textQuery = [q.areaLabel, q.keyword, q.theme.keyword].filter(Boolean).join(' ');
  const res = await fetchWithTimeout(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.primaryTypeDisplayName,places.currentOpeningHours.weekdayDescriptions,places.googleMapsUri,places.websiteUri',
      },
      body: JSON.stringify({
        textQuery,
        languageCode: 'zh-TW',
        regionCode: 'TW',
        maxResultCount: 20,
        locationBias: { circle: { center: { latitude: q.center.lat, longitude: q.center.lng }, radius: Math.min(50000, q.radius * 1.5) } },
      }),
    },
    15000
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Google Places ${res.status}${/API key|PERMISSION|referer/i.test(txt) ? '（請確認金鑰已啟用 Places API (New) 並允許此網域）' : ''}`);
  }
  const json = (await res.json()) as { places?: GooglePlace[] };
  return (json.places || [])
    .filter((p) => p.location && p.displayName?.text)
    .map((p) => {
      const lat = p.location!.latitude;
      const lng = p.location!.longitude;
      return {
        id: `google-${p.id}`,
        name: p.displayName!.text as string,
        address: p.formattedAddress?.replace(/^\d{3,6}/, '').trim(),
        lat,
        lng,
        typeLabel: p.primaryTypeDisplayName?.text,
        hours: p.currentOpeningHours?.weekdayDescriptions?.slice(0, 7).join('／'),
        rating: p.rating,
        ratingCount: p.userRatingCount,
        priceHint: p.priceLevel ? PRICE_LEVEL_LABEL[p.priceLevel] : undefined,
        website: p.websiteUri,
        mapsUrl: p.googleMapsUri,
        distanceKm: distanceKm(q.center.lat, q.center.lng, lat, lng),
        engine: 'google' as const,
      };
    });
}

/** 反查座標所在的縣市／行政區（僅「我附近」模式用一次） */
export async function reverseGeocodeArea(lat: number, lng: number): Promise<DiscoverArea> {
  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=zh-TW&lat=${lat}&lon=${lng}`,
      { headers: { Accept: 'application/json' } },
      9000
    );
    if (!res.ok) return {};
    const json = (await res.json()) as { address?: Record<string, string> };
    const a = json.address || {};
    const cityRaw = a.city || a.county || a.state || '';
    const city = /台北|臺北/.test(cityRaw) ? '台北市' : /新北/.test(cityRaw) ? '新北市' : cityRaw.replace(/臺/g, '台') || undefined;
    const districtRaw = a.city_district || a.suburb || a.town || a.district || '';
    const district = /區$/.test(districtRaw) ? districtRaw : undefined;
    return { city, district };
  } catch {
    return {};
  }
}

export interface DiscoverOutcome {
  results: DiscoverResult[];
  engine: 'google' | 'osm' | 'nominatim';
  note?: string;
}

export async function discoverPlaces(q: DiscoverQuery, googleKey?: string): Promise<DiscoverOutcome> {
  if (googleKey) {
    try {
      const results = await discoverViaGooglePlaces(q, googleKey);
      if (results.length > 0) return { results, engine: 'google' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google 引擎失敗';
      try {
        const osm = await discoverViaOverpass(q);
        return { results: osm, engine: 'osm', note: `${msg}，已改用免金鑰引擎` };
      } catch {
        return { results: [], engine: 'osm', note: msg };
      }
    }
  }
  try {
    const osm = await discoverViaOverpass(q);
    if (osm.length > 0) return { results: osm, engine: 'osm' };
  } catch {
    // fall through
  }
  const nom = await discoverViaNominatim(q);
  return { results: nom, engine: 'nominatim', note: nom.length === 0 ? '免費地圖資料裡沒有符合的店，試試其他主題或請管家找' : undefined };
}

export interface DiscoverArea {
  city?: string;
  district?: string;
}

export function discoverResultToSpot(r: DiscoverResult, categoryId: string, themeLabel: string, now = Date.now(), area?: DiscoverArea): Spot {
  const hasCityInAddress = Boolean(r.address && /(台北市|臺北市|新北市|[\u4e00-\u9fa5]{2}(市|縣))/.test(r.address));
  const addressForParse = r.address && !hasCityInAddress && area?.city ? `${area.city}${area.district || ''}${r.address}` : r.address || '';
  const parsed = parseSpotDraft({ text: `${r.name}\n${addressForParse}\n${area?.city || ''}${area?.district || ''}` });
  const sourceNote =
    r.engine === 'google'
      ? `Google 評分 ${r.rating ? `★${r.rating}` : '—'}${r.ratingCount ? `（${r.ratingCount} 則）` : ''}`
      : '來源 OpenStreetMap';
  return {
    id: makeId('spot'),
    name: r.name,
    category: categoryId,
    city: area?.city && (!parsed.district || parsed.city === area.city) ? area.city : parsed.city,
    district: parsed.district || area?.district,
    mrt: parsed.mrt,
    zone: parsed.zone,
    address: r.address && !hasCityInAddress && area?.city ? `${area.city}${area.district || ''}${r.address}` : r.address || parsed.address,
    lat: r.lat,
    lng: r.lng,
    hours: r.hours,
    priceHint: r.priceHint,
    tags: parsed.tags,
    highlights: [],
    summary: `探索「${themeLabel}」收錄・${sourceNote}${r.typeLabel ? `・${r.typeLabel}` : ''}`,
    source: { platform: 'googlemaps', url: r.mapsUrl },
    origin: 'personal',
    createdAt: now,
    updatedAt: now,
  };
}
