import { SpotCategory, SourcePlatform } from '../types/pocket';
import {
  METRO_STATIONS,
  ZONES,
  TAIPEI_DISTRICTS,
  NEW_TAIPEI_DISTRICTS,
  OTHER_CITY_KEYWORDS,
  districtToCity,
  findStation,
} from '../data/taipeiGeo';

/**
 * 智慧收件匣「雙北規則引擎」：純前端、零額度、毫秒級
 * 從 IG / Threads 文案、連結預覽、截圖 OCR 文字中推斷店名、縣市、行政區、捷運站、分類、標籤、營業時間等。
 */

export interface ParseInput {
  url?: string;
  text?: string;
  ocrText?: string;
  previewTitle?: string;
  previewDescription?: string;
  previewAuthor?: string;
}

export interface ParsedDraft {
  name: string;
  category: SpotCategory;
  city: string;
  district?: string;
  mrt?: string;
  zone?: string;
  address?: string;
  hours?: string;
  priceHint?: string;
  tags: string[];
  highlights: string[];
  summary: string;
  platform: SourcePlatform;
  author?: string;
  caption: string;
  confidence: { name: number; location: number; category: number };
  /** 給 UI 顯示「偵測到…」的摘要 */
  detected: string[];
}

export function detectPlatform(url?: string): SourcePlatform {
  if (!url) return 'manual';
  const u = url.toLowerCase();
  if (/instagram\.com|instagr\.am/.test(u)) return 'instagram';
  if (/threads\.(net|com)/.test(u)) return 'threads';
  if (/tiktok\.com/.test(u)) return 'tiktok';
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/facebook\.com|fb\.com|fb\.watch/.test(u)) return 'facebook';
  if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google/.test(u)) return 'googlemaps';
  return 'web';
}

export function extractFirstUrl(text: string): string | undefined {
  const m = /(https?:\/\/[^\s<>"'）)]+)/i.exec(text || '');
  return m ? m[1] : undefined;
}

export function normalizeText(raw: string): string {
  return (raw || '')
    .normalize('NFKC')
    .replace(/臺/g, '台')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu;

function stripDecor(s: string): string {
  return s
    .replace(EMOJI_RE, '')
    .replace(/#[^\s#]+/g, '')
    .replace(/@[A-Za-z0-9_.]+/g, '')
    .replace(/[|｜│]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const CITY_PATTERNS: Array<{ city: string; re: RegExp }> = [
  { city: '台北市', re: /台北|北市|taipei/i },
  { city: '新北市', re: /新北|new taipei/i },
];

const ADDRESS_RE =
  /((?:台北市|新北市|[\u4e00-\u9fa5]{2}(?:市|縣))?(?:[\u4e00-\u9fa5]{1,3}(?:區|鄉|鎮))?[\u4e00-\u9fa5A-Za-z0-9]{1,10}?(?:路|街|大道|巷)(?:[一二三四五六七八九十\d]+段)?(?:\d+巷)?(?:\d+弄)?\d+(?:[-－之]\d+)?號(?:\s*(?:B?\d+樓|[一二三四五六七八九十]+樓|地下\d*樓))?(?:之\d+)?)/;

const STATION_ALTERNATION = METRO_STATIONS.map((s) => s.name.replace(/[/]/g, '\\/'))
  .sort((a, b) => b.length - a.length)
  .join('|');
const STATION_RE = new RegExp(`(?:捷運\\s*)?(${STATION_ALTERNATION})(?:站|捷運站)`, 'g');
const STATION_LOOSE_RE = new RegExp(`捷運\\s*(${STATION_ALTERNATION})`, 'g');

const ALL_DISTRICTS = [...TAIPEI_DISTRICTS, ...NEW_TAIPEI_DISTRICTS];
const DISTRICT_RE = new RegExp(`(${ALL_DISTRICTS.join('|')})`, 'g');

interface KeywordRule {
  re: RegExp;
  weight: number;
}

const CATEGORY_RULES: Record<SpotCategory, KeywordRule[]> = {
  cafe: [
    { re: /咖啡廳|咖啡店|咖啡館|cafe|café|coffee|手沖|拿鐵|latte|美式|dirty|燕麥奶|咖啡/i, weight: 3 },
    { re: /跑咖|讀書|辦公|不限時|插座|wifi/i, weight: 1 },
  ],
  dessert: [
    { re: /甜點|蛋糕|可麗露|肉桂捲|司康|布丁|千層|泡芙|塔|冰淇淋|雪花冰|刨冰|gelato|dessert|甜品|鬆餅|舒芙蕾|早午餐|brunch|吐司|貝果|麵包店|烘焙/i, weight: 3 },
    { re: /下午茶|茶點/i, weight: 2 },
  ],
  bar: [
    { re: /酒吧|bar\b|調酒|cocktail|居酒屋|精釀|啤酒|清酒|威士忌|深夜食堂|宵夜|消夜|熱炒|燒烤攤|串燒/i, weight: 3 },
    { re: /微醺|小酌|喝一杯/i, weight: 2 },
  ],
  spot: [
    { re: /展覽|特展|美術館|博物館|景點|步道|公園|老街|夜景|古蹟|園區|市集|散步|野餐|溫泉|海邊|碼頭|瀑布|賞花|露營|農場|打卡景點|一日遊|半日遊|秘境/i, weight: 3 },
    { re: /拍照|好拍|風景|看海|爬山|登山/i, weight: 1 },
  ],
  food: [
    { re: /火鍋|燒肉|拉麵|壽司|義大利麵|義式|牛排|小吃|便當|牛肉麵|滷肉飯|雞排|鹽酥雞|餐廳|餐酒館|丼飯|定食|日料|日式|韓式|泰式|港式|越南|越式|中餐|台菜|熱炒|麻辣|麵店|水餃|鍋貼|早餐店|豆漿|燒餅|油條|漢堡|披薩|pizza|炸雞|吃到飽|buffet|合菜|海鮮|餃子|米粉|肉圓|蚵仔煎|夜市|美食|好吃|必吃|午餐|晚餐|餐點|套餐/i, weight: 2 },
  ],
};

const TAG_RULES: Array<{ id: string; re: RegExp }> = [
  { id: 'no-time-limit', re: /不限時|無限時|沒有限時|不趕人/i },
  { id: 'outlet', re: /插座|充電/i },
  { id: 'work-friendly', re: /讀書|辦公|工作|筆電|遠端|自習|寫稿|wfh/i },
  { id: 'wifi', re: /wifi|wi-fi|無線網路/i },
  { id: 'pet-friendly', re: /寵物友善|可帶寵物|毛小孩|狗狗友善|貓咪店|店貓|店狗/i },
  { id: 'rainy-indoor', re: /雨天|室內|下雨|雨備/i },
  { id: 'reservation', re: /訂位|預約|預訂|需預約|建議訂位|inline|線上訂位/i },
  { id: 'late-night', re: /宵夜|消夜|深夜|營業到|凌晨|24小時|24h|半夜/i },
  { id: 'photogenic', re: /好拍|網美|ig打卡|打卡|拍照|美照|氛圍感|很有氛圍|超美/i },
  { id: 'queue', re: /排隊|人潮|很多人|超夯|爆紅|名店|排很久|現場候位/i },
  { id: 'group', re: /聚餐|多人|聚會|包廂|家庭聚|公司聚|慶生/i },
  { id: 'kids', re: /親子|小孩|兒童|嬰兒|寶寶|推車/i },
  { id: 'budget', re: /平價|便宜|銅板|百元|cp值|cp 值|划算|高cp/i },
  { id: 'date', re: /約會|情侶|浪漫|紀念日|燭光/i },
  { id: 'splurge', re: /犒賞|奢華|高級|fine dining|米其林|無菜單|omakase|頂級/i },
  { id: 'vegetarian', re: /素食|蔬食|全素|vegan|素的/i },
  { id: 'old-house', re: /老宅|老屋|老房子|日式老宅|古厝|洋樓|舊宅/i },
  { id: 'view', re: /夜景|景觀|view|看海|河景|山景|101景|百萬夜景|海景/i },
  { id: 'walk', re: /散步|步道|走走|漫步|健行|小旅行|一日遊/i },
  { id: 'takeaway', re: /外帶|外送|uber eats|foodpanda|可外帶/i },
];

const GENERIC_HASHTAG_RE =
  /美食|咖啡|cafe|coffee|甜點|景點|台北|新北|taipei|food|foodie|旅遊|打卡|推薦|探店|吃貨|必吃|必去|好吃|下午茶|早午餐|brunch|dessert|travel|日常|生活|vlog|reels|threads|ig|fyp|viral/i;

function inferCategory(corpus: string): { category: SpotCategory; score: number } {
  let best: SpotCategory = 'food';
  let bestScore = 0;
  (Object.keys(CATEGORY_RULES) as SpotCategory[]).forEach((cat) => {
    let score = 0;
    for (const rule of CATEGORY_RULES[cat]) {
      const matches = corpus.match(new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g'));
      if (matches) score += Math.min(3, matches.length) * rule.weight;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  });
  return { category: best, score: bestScore };
}

function inferTags(corpus: string): string[] {
  const out: string[] = [];
  for (const rule of TAG_RULES) {
    if (rule.re.test(corpus)) out.push(rule.id);
  }
  return out.slice(0, 7);
}

function inferHours(corpus: string): string | undefined {
  const parts: string[] = [];
  const timeRe = /(\d{1,2})[:：.](\d{2})\s*[-~–—至到]\s*(\d{1,2})[:：.](\d{2})/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = timeRe.exec(corpus)) !== null && parts.length < 2) {
    const s = `${m[1].padStart(2, '0')}:${m[2]}–${m[3].padStart(2, '0')}:${m[4]}`;
    if (!seen.has(s)) {
      seen.add(s);
      parts.push(s);
    }
  }
  const offRe = /(?:每?[週周]|星期|禮拜)([一二三四五六日天](?:[、,，及和]\s*(?:[週周]|星期|禮拜)?[一二三四五六日天])*)\s*(?:固定)?(?:公休|店休|休息|休假)/;
  const off = offRe.exec(corpus);
  if (off) parts.push(`週${off[1].replace(/[週周星期禮拜\s]/g, '')}公休`);
  else if (/全年無休|無公休/.test(corpus)) parts.push('全年無休');
  if (parts.length === 0) {
    const line = /營業時間[:：]?\s*([^\n]{3,40})/.exec(corpus);
    if (line) return line[1].trim();
    return undefined;
  }
  return parts.join('／');
}

function inferPrice(corpus: string): string | undefined {
  const m =
    /(人均|均消|低消|客單|價位|消費|預算)[^\d$]{0,8}\$?\s*(\d{2,5})(?:\s*[-~–至到]\s*\$?\s*(\d{2,5}))?/.exec(corpus);
  if (m) {
    const label = m[1] === '低消' ? '低消' : '人均約';
    return m[3] ? `${label} $${m[2]}–${m[3]}` : `${label} $${m[2]}`;
  }
  const dollar = /(?:NT\$|NTD|\$)\s*(\d{2,4})(?:\s*[-~–]\s*\$?(\d{2,4}))?/.exec(corpus);
  if (dollar) return dollar[2] ? `約 $${dollar[1]}–${dollar[2]}` : `約 $${dollar[1]}`;
  return undefined;
}

function splitHighlightSegment(raw: string): string[] {
  const primary = stripDecor(raw)
    .split(/[、,，/／+＋]|還有|以及/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const seg of primary) {
    const sub = seg.split(/和|跟|與/).map((s) => s.trim());
    if (sub.length > 1 && sub.every((s) => s.length >= 2)) out.push(...sub);
    else out.push(seg);
  }
  return out.map((s) => s.replace(/^(有|是|的|：|:)/, '').trim()).filter((s) => s.length >= 2 && s.length <= 14);
}

function inferHighlights(corpus: string): string[] {
  const out: string[] = [];
  const re = /(?:必點|必吃|必喝|推薦|招牌|推推|首推|私心推|點了|我們點)[:：是]?\s*([^\n。！!]{2,60})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(corpus)) !== null && out.length < 6) {
    for (const s of splitHighlightSegment(m[1])) {
      if (!out.includes(s)) out.push(s);
      if (out.length >= 6) break;
    }
  }
  return out;
}

function pickName(
  lines: string[],
  corpus: string,
  previewTitle: string | undefined,
  platform: SourcePlatform
): { name: string; confidence: number } {
  const explicit =
    /(?:店名|店家|餐廳|這家店|這間店|地點|📍|location)[:：\s]+([^\n｜|│#@]{2,30})/i.exec(corpus) ||
    /【([^】\n]{2,30})】/.exec(corpus) ||
    /『([^』\n]{2,30})』/.exec(corpus);
  if (explicit) {
    const n = cleanName(explicit[1]);
    if (n.length >= 2) return { name: n, confidence: 0.9 };
  }
  const quoted = /「([^」\n]{2,24})」/.exec(corpus);
  if (quoted) {
    const n = cleanName(quoted[1]);
    if (n.length >= 2 && !/^(真的|超級|非常|好|很)/.test(n)) return { name: n, confidence: 0.6 };
  }
  for (const line of lines) {
    const cleaned = cleanName(line.split(/[｜|│/／•·・]|\s[-—–]\s/)[0]);
    if (cleaned.length >= 2 && cleaned.length <= 28 && !/^https?:/i.test(cleaned)) {
      return { name: cleaned, confidence: 0.45 };
    }
  }
  const hashtags = corpus.match(/#([^\s#]{2,20})/g) || [];
  for (const h of hashtags) {
    const t = h.slice(1);
    if (!GENERIC_HASHTAG_RE.test(t) && !ALL_DISTRICTS.some((d) => t.includes(d.replace('區', '')))) {
      return { name: t, confidence: 0.35 };
    }
  }
  if (previewTitle && platform !== 'instagram' && platform !== 'threads') {
    const t = cleanName(previewTitle.split(/[｜|│-]/)[0]);
    if (t.length >= 2) return { name: t, confidence: 0.4 };
  }
  return { name: '', confidence: 0 };
}

function cleanName(raw: string): string {
  return stripDecor(raw)
    .replace(/^[\s:：\-–—・•·]+/, '')
    .replace(/[\s:：\-–—・•·。.,，!！?？]+$/, '')
    .replace(/^(推薦|分享|台北|新北|雙北)\s*/, '')
    .trim()
    .slice(0, 30);
}

function inferAuthor(url: string | undefined, corpus: string, previewAuthor?: string, previewTitle?: string): string | undefined {
  if (previewAuthor) return previewAuthor.replace(/^@/, '');
  if (url) {
    const th = /threads\.(?:net|com)\/@([A-Za-z0-9_.]+)/.exec(url);
    if (th) return th[1];
    const ig = /instagram\.com\/([A-Za-z0-9_.]+)\/(?:reel|p)\//.exec(url);
    if (ig && !['reel', 'reels', 'p', 'tv', 'stories', 'explore'].includes(ig[1])) return ig[1];
  }
  if (previewTitle) {
    const m = /\(@([A-Za-z0-9_.]+)\)/.exec(previewTitle) || /^([^()\n]{1,40}?) on (?:Instagram|Threads)/.exec(previewTitle);
    if (m) return m[1].trim();
  }
  const handle = /(?:^|\s)@([A-Za-z0-9_.]{3,30})/.exec(corpus);
  return handle ? handle[1] : undefined;
}

export function parseSpotDraft(input: ParseInput): ParsedDraft {
  const platform = detectPlatform(input.url);
  const text = normalizeText(input.text || '');
  const preview = normalizeText([input.previewTitle || '', input.previewDescription || ''].join('\n'));
  const ocr = normalizeText(input.ocrText || '');
  const corpus = [text, preview, ocr].filter(Boolean).join('\n');
  const detected: string[] = [];

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^https?:/i.test(l) && !/^#/.test(l));

  // --- 地址 ---
  let address: string | undefined;
  const addrMatch = ADDRESS_RE.exec(corpus);
  if (addrMatch) {
    address = addrMatch[1].replace(/\s+/g, '');
    detected.push(`地址 ${address}`);
  }

  // --- 縣市／行政區 ---
  let city = '';
  let district: string | undefined;
  let locationConfidence = 0;

  const districtMatches = Array.from(corpus.matchAll(DISTRICT_RE)).map((m) => m[1]);
  if (address) {
    const dm = /([\u4e00-\u9fa5]{1,3}區)/.exec(address);
    if (dm && districtToCity(dm[1])) {
      district = dm[1];
      city = districtToCity(dm[1]) || '';
      locationConfidence = 0.95;
    }
    const cm = /^(台北市|新北市)/.exec(address);
    if (cm) {
      city = cm[1];
      locationConfidence = Math.max(locationConfidence, 0.9);
    }
  }
  if (!district && districtMatches.length > 0) {
    district = districtMatches[0];
    city = city || districtToCity(district) || '';
    locationConfidence = Math.max(locationConfidence, 0.8);
  }

  // --- 捷運站 ---
  let mrt: string | undefined;
  const stationHit = STATION_RE.exec(corpus) || STATION_LOOSE_RE.exec(corpus);
  STATION_RE.lastIndex = 0;
  STATION_LOOSE_RE.lastIndex = 0;
  if (stationHit) {
    const st = findStation(stationHit[1]);
    if (st) {
      mrt = `${st.name}站`;
      if (!district) district = st.district;
      if (!city) city = st.city;
      locationConfidence = Math.max(locationConfidence, 0.7);
      detected.push(`捷運 ${mrt}`);
    }
  }

  // --- 其他縣市（在沒有雙北地址／行政區／捷運站證據時，明確縣市關鍵字優先於商圈模糊比對） ---
  const lowerCorpus = corpus.toLowerCase();
  let otherCity: string | undefined;
  if (!city) {
    const dualNorthHint = CITY_PATTERNS.some((cp) => cp.re.test(corpus));
    for (const oc of OTHER_CITY_KEYWORDS) {
      if (oc.keywords.some((k) => lowerCorpus.includes(k.toLowerCase()))) {
        otherCity = oc.city;
        break;
      }
    }
    if (otherCity && !dualNorthHint) {
      city = otherCity;
      locationConfidence = Math.max(locationConfidence, 0.45);
    }
  }

  // --- 商圈 ---
  let zone: string | undefined;
  if (!otherCity || city === '台北市' || city === '新北市') {
    for (const z of ZONES) {
      if (z.keywords.some((k) => lowerCorpus.includes(k.toLowerCase()))) {
        zone = z.name;
        if (!city) city = z.city;
        if (!district) district = z.district;
        if (!mrt && z.mrt) mrt = z.mrt;
        locationConfidence = Math.max(locationConfidence, 0.55);
        break;
      }
    }
  }

  // --- 縣市關鍵字保底 ---
  if (!city) {
    for (const cp of CITY_PATTERNS) {
      if (cp.re.test(corpus)) {
        city = cp.city;
        locationConfidence = Math.max(locationConfidence, 0.4);
        break;
      }
    }
  }
  if (!city && otherCity) {
    city = otherCity;
    locationConfidence = Math.max(locationConfidence, 0.4);
  }
  if (!city) city = '台北市';
  if (district) detected.push(`${city} ${district}`);
  else if (locationConfidence > 0) detected.push(city);

  // --- 分類／標籤 ---
  const cat = inferCategory(corpus);
  const tags = inferTags(corpus);
  if (cat.score > 0) detected.push(`分類：${cat.category}`);

  // --- 名稱 ---
  const nameHit = pickName(lines, corpus, input.previewTitle, platform);
  if (nameHit.name) detected.push(`店名「${nameHit.name}」`);

  // --- 其他欄位 ---
  const hours = inferHours(corpus);
  const priceHint = inferPrice(corpus);
  const highlights = inferHighlights(corpus);
  const author = inferAuthor(input.url, corpus, input.previewAuthor, input.previewTitle);

  const summaryLines = lines.map((l) => stripDecor(l)).filter((l) => l.length >= 4);
  const summary = (summaryLines.slice(0, 2).join(' ') || stripDecor(preview).slice(0, 100)).slice(0, 120);
  const caption = (text || preview).slice(0, 600);

  return {
    name: nameHit.name,
    category: cat.category,
    city,
    district,
    mrt,
    zone,
    address,
    hours,
    priceHint,
    tags,
    highlights,
    summary,
    platform,
    author,
    caption,
    confidence: {
      name: nameHit.confidence,
      location: locationConfidence,
      category: Math.min(1, cat.score / 6),
    },
    detected,
  };
}

export function buildGoogleMapsUrl(name: string, address?: string, lat?: number, lng?: number): string {
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address || ''}`.trim())}&center=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address || ''}`.trim())}`;
}
