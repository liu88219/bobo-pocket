import { describe, it, expect } from 'vitest';
import { parseSpotDraft, detectPlatform, extractFirstUrl, buildGoogleMapsUrl } from '../services/spotParser';
import { mergeVaultStates, parseVaultJson, compactStateForCloud, buildTextDbFormBody, hasUserRecords } from '../services/cloudSync';
import { createInitialVaultState, Spot, VaultState } from '../types/pocket';
import { resolveAllSpots, applyFilters, DEFAULT_FILTERS } from '../services/spotResolver';
import { CURATED_SPOTS } from '../data/curatedSpots';
import { METRO_STATIONS, findStation, districtToCity } from '../data/taipeiGeo';
import { TAGS, TAG_MAP } from '../data/categories';
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

  it('沒有任何資訊時給安全預設', () => {
    const d = parseSpotDraft({ text: '' });
    expect(d.city).toBe('台北市');
    expect(d.category).toBe('food');
    expect(d.name).toBe('');
  });

  it('detectPlatform / extractFirstUrl / buildGoogleMapsUrl', () => {
    expect(detectPlatform('https://www.instagram.com/reel/x')).toBe('instagram');
    expect(detectPlatform('https://www.threads.com/@a/post/b')).toBe('threads');
    expect(detectPlatform('https://maps.app.goo.gl/abc')).toBe('googlemaps');
    expect(detectPlatform('https://youtube.com/shorts/x')).toBe('youtube');
    expect(detectPlatform(undefined)).toBe('manual');
    expect(extractFirstUrl('看這個 https://www.threads.net/@a/post/b 超好吃')).toBe('https://www.threads.net/@a/post/b');
    expect(buildGoogleMapsUrl('Fika Fika', '台北市中山區伊通街33號', 25.05, 121.53)).toContain('query=');
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

  it('範例卡資料完整、Tag 皆已定義', () => {
    expect(CURATED_SPOTS.length).toBeGreaterThanOrEqual(6);
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
    const seedId = CURATED_SPOTS[0].id;
    const vault: VaultState = {
      ...base,
      isUneditedDefault: false,
      updatedAt: 1,
      overrides: { [seedId]: { name: '改名了', updatedAt: 1 } },
      curatedVisibility: { [CURATED_SPOTS[1].id]: { hidden: true, updatedAt: 1 } },
      personalSpots: [personalSpot({ id: 'p1', name: '我的店', city: '新北市', district: '板橋區', mrt: '府中站', tags: ['outlet'] })],
      marks: { p1: { spotId: 'p1', status: 'want', createdAt: 1, updatedAt: 1 } },
    };
    const all = resolveAllSpots(vault);
    expect(all.find((s) => s.id === seedId)?.name).toBe('改名了');
    expect(all.find((s) => s.id === CURATED_SPOTS[1].id)).toBeUndefined();
    expect(all.find((s) => s.id === 'p1')?.mark?.status).toBe('want');

    const wantOnly = applyFilters(all, { ...DEFAULT_FILTERS, status: 'want' });
    expect(wantOnly.map((s) => s.id)).toEqual(['p1']);
    const ntp = applyFilters(all, { ...DEFAULT_FILTERS, city: '新北市', mrt: '府中站' });
    expect(ntp.some((s) => s.id === 'p1')).toBe(true);
    const q = applyFilters(all, { ...DEFAULT_FILTERS, query: '我的店' });
    expect(q).toHaveLength(1);
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
    const payload = buildSharePayload(spots, 't', 'mona');
    expect(JSON.stringify(payload).length).toBeLessThanOrEqual(150000);
    expect(payload.spots.length).toBe(4);
  });
});
