import { Spot, makeId } from '../types/pocket';
import { parseSpotDraft } from './spotParser';

/**
 * 從 Google Maps「已儲存地點」搬家：
 * - Google Takeout → 地圖（您的地點）→ `Saved Places.json`（GeoJSON，含座標與地址）
 * - Google Takeout → 已儲存 → 各清單 `.csv`（Title, Note, URL, Comment；無座標）
 */

export interface ImportedPlace {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  url?: string;
  note?: string;
  savedAt?: number;
  listName?: string;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

export function parseTakeoutCsv(text: string, fileName = ''): ImportedPlace[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iTitle = col(['title', '標題', '名稱']);
  const iNote = col(['note', '備註']);
  const iUrl = col(['url', '網址']);
  const iComment = col(['comment', '留言', 'tags']);
  if (iTitle < 0 && iUrl < 0) return [];
  const listName = fileName.replace(/\.csv$/i, '').trim() || undefined;
  const out: ImportedPlace[] = [];
  for (const r of rows.slice(1)) {
    const name = (iTitle >= 0 ? r[iTitle] : '').trim();
    const url = (iUrl >= 0 ? r[iUrl] : '').trim();
    if (!name && !url) continue;
    const noteParts = [iNote >= 0 ? r[iNote] : '', iComment >= 0 ? r[iComment] : ''].map((x) => (x || '').trim()).filter(Boolean);
    out.push({
      name: name || decodeURIComponent((/\/maps\/(?:place|search)\/([^/]+)/.exec(url)?.[1] || '').replace(/\+/g, ' ')) || '未命名地點',
      url: url || undefined,
      note: noteParts.join('；') || undefined,
      listName,
    });
  }
  return out;
}

interface GeoJsonFeature {
  type?: string;
  geometry?: { type?: string; coordinates?: number[] };
  properties?: {
    date?: string;
    google_maps_url?: string;
    location?: { address?: string; name?: string; country_code?: string };
    Comment?: string;
    comment?: string;
    Title?: string;
    name?: string;
  };
}

export function parseTakeoutGeoJson(text: string): ImportedPlace[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const features = (data as { features?: GeoJsonFeature[] })?.features;
  if (!Array.isArray(features)) return [];
  const out: ImportedPlace[] = [];
  for (const f of features) {
    const coords = f.geometry?.coordinates;
    const props = f.properties || {};
    const lng = Array.isArray(coords) ? Number(coords[0]) : NaN;
    const lat = Array.isArray(coords) ? Number(coords[1]) : NaN;
    const name = (props.location?.name || props.Title || props.name || '').trim();
    const address = (props.location?.address || '').trim();
    if (!name && !address && !Number.isFinite(lat)) continue;
    out.push({
      name: name || address || '未命名地點',
      address: address || undefined,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      url: props.google_maps_url,
      note: (props.Comment || props.comment || '').trim() || undefined,
      savedAt: props.date ? Date.parse(props.date) || undefined : undefined,
    });
  }
  return out;
}

export function parseTakeoutFile(text: string, fileName: string): ImportedPlace[] {
  if (/\.json$/i.test(fileName) || text.trim().startsWith('{')) return parseTakeoutGeoJson(text);
  return parseTakeoutCsv(text, fileName);
}

export function normalizePlaceKey(name: string, address?: string): string {
  return `${name}|${address || ''}`.toLowerCase().replace(/\s+/g, '').replace(/臺/g, '台');
}

export function importedPlaceToSpot(p: ImportedPlace, now = Date.now()): Spot {
  const parsed = parseSpotDraft({ text: `${p.name}\n${p.address || ''}\n${p.note || ''}` });
  return {
    id: makeId('spot'),
    name: p.name.slice(0, 60),
    category: parsed.category,
    city: parsed.city,
    district: parsed.district,
    mrt: parsed.mrt,
    zone: parsed.zone,
    address: p.address || parsed.address,
    lat: p.lat,
    lng: p.lng,
    tags: parsed.tags,
    highlights: [],
    summary: [p.listName ? `來自 Google Maps 清單「${p.listName}」` : '從 Google Maps 已儲存地點匯入', p.note].filter(Boolean).join('・'),
    source: { platform: 'googlemaps', url: p.url },
    origin: 'personal',
    createdAt: p.savedAt || now,
    updatedAt: now,
  };
}
