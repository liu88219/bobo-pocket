import { describe, it, expect } from 'vitest';
import { parseSpotDraft, detectPlatform, extractFirstUrl } from '../services/spotParser';
import { parseMapShareUrl, extractPlaceFromGoogleHtml, googleMapsViewUrl, appleMapsDirectionsUrl, distanceKm, formatDistance } from '../services/mapLinks';
import { parseCsv, parseTakeoutCsv, parseTakeoutGeoJson, importedPlaceToSpot, normalizePlaceKey } from '../services/importers';
import { mergeVaultStates, parseVaultJson, compactStateForCloud, buildTextDbFormBody, hasUserRecords } from '../services/cloudSync';
import { createInitialVaultState, Spot, VaultState } from '../types/pocket';
import { resolveAllSpots, applyFilters, DEFAULT_FILTERS } from '../services/spotResolver';
import { CURATED_SPOTS } from '../data/curatedSpots';
import { METRO_STATIONS, findStation, districtToCity } from '../data/taipeiGeo';
import { TAGS, TAG_MAP, DEFAULT_CATEGORIES, categoryMeta, makeCategoryId, resolveCategories } from '../data/categories';
import { buildOverpassQuery, discoverResultToSpot, DISCOVER_THEMES, DISTRICT_CENTERS } from '../services/discover';
import { parseOpenGraph } from '../services/linkPreview';
import { buildSharePayload } from '../services/shareService';

function personalSpot(partial: Partial<Spot> & { id: string; name: string }): Spot {
  return {
    category: 'cafe',
    city: '台北市',
    tags: [],
    highlights: [],
    origin: 'personal',
    createdAt: 1000,
    updatedAt: 1000,
    ...partial,
  };
}

describe('雙北規則引擎 parseSpotDraft', () => {
  it('從 IG 文案推斷店名、行政區、捷運站、分類與標籤', () => {
    const text = `中山站巷弄裡的日式老宅咖啡廳☕️ 不限時有插座超適合讀書\n必點肉桂捲和燕麥拿鐵\n📍台北市中山區赤峰街41巷3號\n營業時間 11:00-19:00 週二公休\n#台北咖啡廳 #赤峰街`;
    const d = parseSpotDraft({ url: 'https://www.instagram.com/reel/abc123/', text });
    expect(d.platform).toBe('instagram');
    expect(d.city).toBe('台北市');
    expect(d.district).toBe('中山區');
    expect(d.mrt).toBe('中山站');
    expect(d.zone).toBe('赤峰街・中山商圈');
    expect(d.address).toBe('台北市中山區赤峰街41巷3號');
    expect(d.category).toBe('cafe');
    expect(d.tags).toEqual(expect.arrayContaining(['no-time-limit', 'outlet', 'work-friendly', 'old-house']));
    expect(d.hours).toContain('11:00–19:00');
    expect(d.hours).toContain('週二公休');
    expect(d.highlights).toEqual(expect.arrayContaining(['肉桂捲', '燕麥拿鐵']));
    expect(d.name.length).toBeGreaterThan(1);
  });

  it('明確「店名：」優先，並能辨識新北行政區與景點分類', () => {
    const d = parseSpotDraft({
      url: 'https://www.threads.net/@foodie_tw/post/XYZ',
      text: '店名：好日子甜點店\n永和頂溪站走路 3 分鐘，週末排隊名店，草莓千層必吃！人均 250',
    });
    expect(d.platform).toBe('threads');
    expect(d.author).toBe('foodie_tw');
    expect(d.name).toBe('好日子甜點店');
    expect(d.city).toBe('新北市');
    expect(d.district).toBe('永和區');
    expect(d.mrt).toBe('頂溪站');
    expect(d.category).toBe('dessert');
    expect(d.tags).toContain('queue');
    expect(d.priceHint).toBe('人均約 $250');
  });

  it('景點與其他縣市：九份／宜蘭', () => {
    const a = parseSpotDraft({ text: '九份老街夜景真的美，阿柑姨芋圓必吃，平日下午去最剛好' });
    expect(a.city).toBe('新北市');
    expect(a.district).toBe('瑞芳區');
    expect(a.category).toBe('spot');
    const b = parseSpotDraft({ text: '宜蘭礁溪溫泉小旅行 不用訂位的隱藏咖啡廳' });
    expect(b.city).toBe('宜蘭縣');
  });

  it('新主分類：火鍋／燒肉／慶生餐廳／生日蛋糕／漢堡／宵夜', () => {
    expect(parseSpotDraft({ text: '板橋超好吃的麻辣鍋物，湯頭一絕' }).category).toBe('hotpot');
    expect(parseSpotDraft({ text: '和牛燒肉吃到飽 燒肉控必衝' }).category).toBe('bbq');
    const bd = parseSpotDraft({ text: '台北慶生餐廳推薦！有包廂、壽星送蛋糕，適合生日聚餐' });
    expect(bd.category).toBe('birthday');
    expect(bd.tags).toContain('celebration');
    expect(parseSpotDraft({ text: '客製化生日蛋糕 造型蛋糕預訂 中和' }).category).toBe('cake');
    expect(parseSpotDraft({ text: '永和手工漢堡 Burger 超juicy' }).category).toBe('burger');
    expect(parseSpotDraft({ text: '三重宵夜場 鹹酥雞配啤酒 開到凌晨' }).category).toBe('late-night');
  });

  it('沒有任何資訊時給安全預設', () => {
    const d = parseSpotDraft({ text: '' });
    expect(d.city).toBe('台北市');
    expect(d.category).toBe('food');
    expect(d.name).toBe('');
  });

  it('detectPlatform / extractFirstUrl', () => {
    expect(detectPlatform('https://www.instagram.com/reel/x')).toBe('instagram');
    expect(detectPlatform('https://www.threads.com/@a/post/b')).toBe('threads');
    expect(detectPlatform('https://maps.app.goo.gl/abc')).toBe('googlemaps');
    expect(detectPlatform('https://maps.apple.com/?ll=25.05,121.53&q=Cafe')).toBe('applemaps');
    expect(detectPlatform('https://youtube.com/shorts/x')).toBe('youtube');
    expect(detectPlatform(undefined)).toBe('manual');
    expect(extractFirstUrl('看這個 https://www.threads.net/@a/post/b 超好吃')).toBe('https://www.threads.net/@a/post/b');
  });

  it('Google Maps 分享文字＋連結 → 店名、地址、座標', () => {
    const d = parseSpotDraft({
      url: 'https://www.google.com/maps/place/Fika+Fika+Cafe/@25.0505,121.5334,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d25.0505123!4d121.5334456',
      text: 'Fika Fika Cafe\n台北市中山區伊通街33號\nhttps://maps.app.goo.gl/xxxx',
    });
    expect(d.platform).toBe('googlemaps');
    expect(d.name).toBe('Fika Fika Cafe');
    expect(d.address).toBe('台北市中山區伊通街33號');
    expect(d.district).toBe('中山區');
    expect(d.lat).toBeCloseTo(25.0505123, 5);
    expect(d.lng).toBeCloseTo(121.5334456, 5);
  });

  it('Apple 地圖連結 → 座標與名稱', () => {
    const d = parseSpotDraft({ url: 'https://maps.apple.com/?address=台北市大安區永康街15號&ll=25.0333,121.5297&q=思慕昔&t=m' });
    expect(d.platform).toBe('applemaps');
    expect(d.name).toBe('思慕昔');
    expect(d.lat).toBeCloseTo(25.0333, 4);
    expect(d.address).toContain('永康街15號');
    expect(d.city).toBe('台北市');
    expect(d.district).toBe('大安區');
  });
});

describe('mapLinks', () => {
  it('parseMapShareUrl 解析各種 Google／Apple 連結', () => {
    const g = parseMapShareUrl('https://maps.app.goo.gl/AbCdEf');
    expect(g.provider).toBe('google');
    expect(g.isShortLink).toBe(true);
    const q = parseMapShareUrl('https://www.google.com/maps?q=25.0442,121.5249');
    expect(q.lat).toBeCloseTo(25.0442, 4);
    const a = parseMapShareUrl('maps://?ll=25.1,121.5&q=%E6%B7%A1%E6%B0%B4');
    expect(a.provider).toBe('apple');
    expect(a.name).toBe('淡水');
    expect(parseMapShareUrl('https://example.com').provider).toBeNull();
  });

  it('extractPlaceFromGoogleHtml 讀 og:title 與 !3d!4d', () => {
    const html = '<html><head><meta content="阜杭豆漿 · 台北市中正區忠孝東路一段108號2樓" property="og:title"><link rel="canonical" href="https://www.google.com/maps/place/x/@25.0442,121.5249,17z/data=!3d25.04424!4d121.52494"></head></html>';
    const r = extractPlaceFromGoogleHtml(html);
    expect(r.name).toBe('阜杭豆漿');
    expect(r.address).toContain('忠孝東路一段108號');
    expect(r.lat).toBeCloseTo(25.04424, 5);
  });

  it('開啟／導航連結與距離格式', () => {
    expect(googleMapsViewUrl('Fika Fika', '台北市中山區伊通街33號', 25.05, 121.53)).toContain('query=');
    expect(appleMapsDirectionsUrl('x', undefined, 25.05, 121.53)).toContain('daddr=25.05,121.53');
    expect(distanceKm(25.0505, 121.5334, 25.0442, 121.5249)).toBeGreaterThan(0.9);
    expect(formatDistance(0.42)).toBe('420 m');
    expect(formatDistance(2.345)).toBe('2.3 km');
  });
});

describe('Google Maps Takeout 匯入', () => {
  it('parseCsv 處理引號與換行', () => {
    const rows = parseCsv('Title,Note,URL,Comment\n"好吃, 的店","第一行\n第二行",https://x.y/z,\n');
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe('好吃, 的店');
    expect(rows[1][1]).toBe('第一行\n第二行');
  });

  it('parseTakeoutCsv / parseTakeoutGeoJson / importedPlaceToSpot', () => {
    const csv = parseTakeoutCsv('Title,Note,URL,Comment\nFika Fika Cafe,,https://www.google.com/maps/place/Fika+Fika+Cafe/data=!4m2!3m1!1s0x1,\n', '想去的地點.csv');
    expect(csv).toHaveLength(1);
    expect(csv[0].listName).toBe('想去的地點');
    const geo = parseTakeoutGeoJson(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [121.5249, 25.0442] }, properties: { date: '2025-01-01T00:00:00Z', google_maps_url: 'http://maps.google.com/?cid=1', location: { address: '台北市中正區忠孝東路一段108號2樓', name: '阜杭豆漿', country_code: 'TW' } } },
        ],
      })
    );
    expect(geo).toHaveLength(1);
    expect(geo[0].lat).toBeCloseTo(25.0442, 4);
    const spot = importedPlaceToSpot(geo[0], 5000);
    expect(spot.origin).toBe('personal');
    expect(spot.city).toBe('台北市');
    expect(spot.district).toBe('中正區');
    expect(spot.source?.platform).toBe('googlemaps');
    expect(normalizePlaceKey('阜杭 豆漿', '臺北市')).toBe(normalizePlaceKey('阜杭豆漿', '台北市'));
  });
});

describe('地理字典', () => {
  it('捷運站查詢與行政區對應', () => {
    expect(findStation('松江南京站')?.district).toBe('中山區');
    expect(findStation('捷運府中')?.city).toBe('新北市');
    expect(districtToCity('板橋區')).toBe('新北市');
    expect(districtToCity('大安區')).toBe('台北市');
    const names = METRO_STATIONS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('精選卡（若有）資料完整、Tag 皆已定義', () => {
    for (const s of CURATED_SPOTS) {
      expect(s.origin).toBe('curated');
      expect(typeof s.lat).toBe('number');
      expect(typeof s.lng).toBe('number');
      for (const t of s.tags) expect(TAG_MAP[t], `tag ${t} on ${s.name}`).toBeDefined();
    }
    expect(new Set(TAGS.map((t) => t.id)).size).toBe(TAGS.length);
  });
});

describe('雲端保險箱合併 mergeVaultStates', () => {
  it('空白預設狀態不可覆蓋已編輯的雲端資料', () => {
    const blank = createInitialVaultState();
    const remote: VaultState = { ...createInitialVaultState(), isUneditedDefault: false, updatedAt: 5000, personalSpots: [personalSpot({ id: 'a', name: 'A' })] };
    const merged = mergeVaultStates(blank, remote);
    expect(merged.personalSpots).toHaveLength(1);
    expect(merged.isUneditedDefault).toBe(false);
  });

  it('墓碑刪除不會復活舊店卡，LWW 以 updatedAt 為準', () => {
    const local: VaultState = {
      ...createInitialVaultState(),
      isUneditedDefault: false,
      updatedAt: 9000,
      personalSpots: [personalSpot({ id: 'b', name: 'B-new', updatedAt: 8000 })],
      deletedIds: { a: 7000 },
    };
    const remote: VaultState = {
      ...createInitialVaultState(),
      isUneditedDefault: false,
      updatedAt: 6000,
      personalSpots: [personalSpot({ id: 'a', name: 'A' }), personalSpot({ id: 'b', name: 'B-old', updatedAt: 2000, coverThumb: 'data:image/jpeg;base64,xx' })],
    };
    const merged = mergeVaultStates(local, remote);
    expect(merged.personalSpots.map((s) => s.id)).toEqual(['b']);
    expect(merged.personalSpots[0].name).toBe('B-new');
    expect(merged.personalSpots[0].coverThumb).toBe('data:image/jpeg;base64,xx');
    expect(merged.deletedIds.a).toBe(7000);
  });

  it('marks / overrides / curatedVisibility 採最後寫入優先', () => {
    const local: VaultState = {
      ...createInitialVaultState(),
      isUneditedDefault: false,
      updatedAt: 3000,
      marks: { s1: { spotId: 's1', status: 'want', createdAt: 1000, updatedAt: 3000 } },
      curatedVisibility: { c1: { hidden: true, updatedAt: 1000 } },
      overrides: { c1: { name: 'local', updatedAt: 1000 } },
    };
    const remote: VaultState = {
      ...createInitialVaultState(),
      isUneditedDefault: false,
      updatedAt: 2000,
      marks: { s1: { spotId: 's1', status: 'visited', note: 'old', createdAt: 1000, updatedAt: 2000 } },
      curatedVisibility: { c1: { hidden: false, updatedAt: 2000 } },
      overrides: { c1: { name: 'remote', updatedAt: 2000 } },
    };
    const merged = mergeVaultStates(local, remote);
    expect(merged.marks.s1.status).toBe('want');
    expect(merged.curatedVisibility.c1.hidden).toBe(false);
    expect(merged.overrides.c1.name).toBe('remote');
  });

  it('parseVaultJson 向下相容缺欄位，compactStateForCloud 只保留前 8 張縮圖', () => {
    const parsed = parseVaultJson(JSON.stringify({ version: 1, personalSpots: [{ id: 'x', name: 'X' }] }));
    expect(parsed?.marks).toEqual({});
    expect(parsed?.inbox).toEqual([]);
    const spots = Array.from({ length: 12 }, (_, i) => personalSpot({ id: `s${i}`, name: `S${i}`, coverThumb: 'data:image/jpeg;base64,abc', updatedAt: 1000 + i }));
    const compact = compactStateForCloud({ ...createInitialVaultState(), personalSpots: spots });
    expect(compact.personalSpots.filter((s) => s.coverThumb).length).toBe(8);
    expect(compact.personalSpots.every((s) => s.hasCoverPhoto)).toBe(true);
  });

  it('textdb form body 會把 + 編碼成 %2B', () => {
    expect(buildTextDbFormBody('k', 'a+b c')).toBe('key=k&value=a%2Bb+c');
  });

  it('hasUserRecords 偵測各種個人資料', () => {
    expect(hasUserRecords(createInitialVaultState())).toBe(false);
    expect(hasUserRecords({ ...createInitialVaultState(), marks: { a: { spotId: 'a', status: 'want', createdAt: 1, updatedAt: 1 } } })).toBe(true);
  });
});

describe('spotResolver', () => {
  it('合併 curated 覆寫與隱藏、personal 卡片與篩選', () => {
    const base = createInitialVaultState();
    const curatedList: Spot[] = [
      { ...personalSpot({ id: 'c1', name: '精選一' }), origin: 'curated' },
      { ...personalSpot({ id: 'c2', name: '精選二' }), origin: 'curated' },
    ];
    const vault: VaultState = {
      ...base,
      isUneditedDefault: false,
      updatedAt: 1,
      overrides: { c1: { name: '改名了', updatedAt: 1 } },
      curatedVisibility: { c2: { hidden: true, updatedAt: 1 } },
      personalSpots: [personalSpot({ id: 'p1', name: '我的店', city: '新北市', district: '板橋區', mrt: '府中站', tags: ['outlet'] })],
      marks: { p1: { spotId: 'p1', status: 'want', createdAt: 1, updatedAt: 1 } },
    };
    const all = resolveAllSpots(vault, false, curatedList);
    expect(all.find((s) => s.id === 'c1')?.name).toBe('改名了');
    expect(all.find((s) => s.id === 'c2')).toBeUndefined();
    expect(all.find((s) => s.id === 'p1')?.mark?.status).toBe('want');

    const wantOnly = applyFilters(all, { ...DEFAULT_FILTERS, status: 'want' });
    expect(wantOnly.map((s) => s.id)).toEqual(['p1']);
    const ntp = applyFilters(all, { ...DEFAULT_FILTERS, city: '新北市', mrt: '府中站' });
    expect(ntp.some((s) => s.id === 'p1')).toBe(true);
    const q = applyFilters(all, { ...DEFAULT_FILTERS, query: '我的店' });
    expect(q).toHaveLength(1);
  });
});

describe('分類系統', () => {
  it('預設 14 分類、id 不重複，categoryMeta 有保底', () => {
    expect(DEFAULT_CATEGORIES.length).toBe(14);
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.id)).size).toBe(DEFAULT_CATEGORIES.length);
    expect(categoryMeta(DEFAULT_CATEGORIES, 'hotpot').label).toBe('火鍋');
    expect(categoryMeta([], 'cafe').label).toBe('咖啡廳');
    expect(categoryMeta(DEFAULT_CATEGORIES, 'nope').emoji).toBe('📍');
    expect(makeCategoryId('手搖飲', DEFAULT_CATEGORIES)).toBe('cat-手搖飲');
    expect(resolveCategories({ categories: undefined })).toBe(DEFAULT_CATEGORIES);
  });

  it('自訂分類採最後寫入優先同步', () => {
    const local: VaultState = { ...createInitialVaultState(), isUneditedDefault: false, updatedAt: 2, categories: [{ id: 'x', label: 'X', emoji: '🍜', bg: '#fff', fg: '#000' }], categoriesUpdatedAt: 2 };
    const remote: VaultState = { ...createInitialVaultState(), isUneditedDefault: false, updatedAt: 3, categories: [{ id: 'y', label: 'Y', emoji: '☕', bg: '#fff', fg: '#000' }], categoriesUpdatedAt: 3 };
    expect(mergeVaultStates(local, remote).categories?.[0].id).toBe('y');
    expect(mergeVaultStates(remote, local).categories?.[0].id).toBe('y');
    expect(hasUserRecords(local)).toBe(true);
  });
});

describe('探索 discover', () => {
  it('buildOverpassQuery 產生合法查詢，主題皆對應存在的分類', () => {
    const theme = DISCOVER_THEMES.find((t) => t.id === 'hotpot')!;
    const q = buildOverpassQuery({ center: { lat: 25.012, lng: 121.462 }, radius: 2800, theme, keyword: '麻辣', areaLabel: '板橋區' });
    expect(q).toContain('[out:json]');
    expect(q).toContain('around:2800,25.01200,121.46200');
    expect(q).toContain('麻辣');
    for (const t of DISCOVER_THEMES) expect(DEFAULT_CATEGORIES.some((c) => c.id === t.categoryId), t.id).toBe(true);
    expect(Object.keys(DISTRICT_CENTERS).length).toBeGreaterThanOrEqual(41);
  });

  it('discoverResultToSpot 推斷縣市／行政區並帶座標', () => {
    const spot = discoverResultToSpot(
      { id: 'osm-node-1', name: '某某火鍋', address: '新北市板橋區文化路一段100號', lat: 25.01, lng: 121.46, engine: 'osm', typeLabel: 'restaurant · hotpot' },
      'hotpot',
      '火鍋',
      7000
    );
    expect(spot.category).toBe('hotpot');
    expect(spot.city).toBe('新北市');
    expect(spot.district).toBe('板橋區');
    expect(spot.lat).toBe(25.01);
    expect(spot.summary).toContain('火鍋');
    const osmShort = discoverResultToSpot({ id: 'osm-node-2', name: '辣九天麻辣火鍋', address: '文化路一段126號', lat: 25.02, lng: 121.47, engine: 'osm' }, 'hotpot', '火鍋', 7000, { city: '新北市', district: '板橋區' });
    expect(osmShort.city).toBe('新北市');
    expect(osmShort.district).toBe('板橋區');
    expect(osmShort.address).toBe('新北市板橋區文化路一段126號');
  });
});

describe('linkPreview / share', () => {
  it('parseOpenGraph 讀取 og 標籤', () => {
    const html = `<html><head><meta property="og:title" content="Cafe &amp; Co (@cafe) on Threads"><meta content="好喝 ☕" property="og:description"><meta property="og:image" content="https://x/y.jpg"></head></html>`;
    const og = parseOpenGraph(html);
    expect(og.title).toBe('Cafe & Co (@cafe) on Threads');
    expect(og.description).toBe('好喝 ☕');
    expect(og.image).toBe('https://x/y.jpg');
  });

  it('buildSharePayload 在超量時移除封面圖', () => {
    const big = 'data:image/jpeg;base64,' + 'a'.repeat(60000);
    const spots = Array.from({ length: 4 }, (_, i) => personalSpot({ id: `s${i}`, name: `S${i}`, coverThumb: big }));
    const payload = buildSharePayload(spots, 't', 'mona', DEFAULT_CATEGORIES);
    expect(JSON.stringify(payload).length).toBeLessThanOrEqual(150000);
    expect(payload.spots.length).toBe(4);
    expect(payload.categories?.map((c) => c.id)).toEqual(['cafe']);
  });
});
