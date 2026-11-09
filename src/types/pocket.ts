/**
 * BoboPocket 核心資料型別
 *
 * 兩層資料架構：
 * 1. Curated（公開層）：存放在 repo 內 `src/data/curatedSpots.ts`，由 Bobo 管家（Jetski）透過 git 直接維護。
 * 2. Vault（私有層）：個人新增的店家、想去／已踩點標記、收件匣草稿、對 curated 卡片的覆寫與隱藏，
 *    透過通行碼加密同步至雙永久雲端 KV（textdb.online + textdb.dev）。
 */

/** 分類 id（可由使用者自訂新增，預設見 data/categories.ts） */
export type SpotCategory = string;

export interface CategoryDef {
  id: string;
  label: string;
  emoji: string;
  bg: string;
  fg: string;
}

export type SourcePlatform =
  | 'instagram'
  | 'threads'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'googlemaps'
  | 'applemaps'
  | 'web'
  | 'manual';

export type MarkStatus = 'none' | 'want' | 'visited';

export type RevisitLevel = 'love' | 'ok' | 'avoid';

export interface SpotSource {
  platform: SourcePlatform;
  url?: string;
  author?: string;
  /** 原始貼文文案摘錄（最多保留 600 字） */
  caption?: string;
}

export interface Spot {
  id: string;
  name: string;
  category: SpotCategory;
  /** 例如 '台北市' / '新北市' / '桃園市' / '東京' */
  city: string;
  /** 例如 '中山區' */
  district?: string;
  /** 最近捷運站（含「站」字），例如 '松江南京站' */
  mrt?: string;
  /** 商圈／地帶，例如 '赤峰街・中山商圈' */
  zone?: string;
  address?: string;
  lat?: number;
  lng?: number;
  hours?: string;
  priceHint?: string;
  tags: string[];
  /** 必點／亮點 */
  highlights: string[];
  /** 為什麼想去／短片重點 */
  summary?: string;
  source?: SpotSource;
  /** 封面縮圖（<= ~45KB data URL；雲端另以加密分片同步） */
  coverThumb?: string;
  hasCoverPhoto?: boolean;
  origin: 'curated' | 'personal';
  isSeed?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PersonalMark {
  spotId: string;
  status: MarkStatus;
  revisit?: RevisitLevel;
  rating?: number;
  note?: string;
  visitedAt?: string;
  photoThumb?: string;
  hasLocalHiResPhoto?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InboxItem {
  id: string;
  url?: string;
  text?: string;
  screenshotThumb?: string;
  hasLocalHiResPhoto?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SpotOverride extends Partial<Omit<Spot, 'id' | 'origin' | 'createdAt'>> {
  updatedAt: number;
}

export interface CuratedVisibility {
  hidden: boolean;
  updatedAt: number;
}

export interface PocketProfile {
  nickname: string;
  homeCity: string;
}

export interface VaultState {
  version: 1;
  updatedAt: number;
  settingsUpdatedAt: number;
  isUneditedDefault: boolean;
  profile: PocketProfile;
  personalSpots: Spot[];
  overrides: Record<string, SpotOverride>;
  marks: Record<string, PersonalMark>;
  inbox: InboxItem[];
  curatedVisibility: Record<string, CuratedVisibility>;
  customTags: string[];
  /** 使用者自訂的分類清單（undefined = 使用預設） */
  categories?: CategoryDef[];
  categoriesUpdatedAt?: number;
  deletedIds: Record<string, number>;
}

export function createInitialVaultState(): VaultState {
  return {
    version: 1,
    updatedAt: 0,
    settingsUpdatedAt: 0,
    isUneditedDefault: true,
    profile: { nickname: '', homeCity: '台北市' },
    personalSpots: [],
    overrides: {},
    marks: {},
    inbox: [],
    curatedVisibility: {},
    customTags: [],
    deletedIds: {},
  };
}

export function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

export function getLocalDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 前台實際顯示用的合併結果（curated + override / personal + mark） */
export interface ResolvedSpot extends Spot {
  mark?: PersonalMark;
  hidden: boolean;
}
