import { CategoryDef, RevisitLevel, VaultState } from '../types/pocket';

/**
 * 分類系統：預設 14 個主分類（Mona 指定），可在設定頁新增／改名／換 emoji／換色／排序。
 */

export const CATEGORY_PALETTE: Array<{ bg: string; fg: string; name: string }> = [
  { bg: '#F6DDB8', fg: '#7A4A1C', name: '焦糖' },
  { bg: '#E7D6C3', fg: '#5C3F2D', name: '奶茶' },
  { bg: '#F8E4D4', fg: '#9A4A3A', name: '蜜桃' },
  { bg: '#DCE5D2', fg: '#3F5A3A', name: '抹茶' },
  { bg: '#D9DEE8', fg: '#1E3158', name: '海軍藍' },
  { bg: '#F7E7A8', fg: '#6B5210', name: '奶油黃' },
  { bg: '#EAD9E3', fg: '#6E3F5C', name: '莓果' },
  { bg: '#D8E6E6', fg: '#2F5A5A', name: '薄荷' },
  { bg: '#E8DED0', fg: '#5C5044', name: '燕麥' },
  { bg: '#F2D5CC', fg: '#8A3B2E', name: '磚紅' },
];

const P = (i: number) => CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: 'food', label: '美食', emoji: '🍜', ...P(0) },
  { id: 'pasta', label: '義大利麵', emoji: '🍝', ...P(9) },
  { id: 'cafe', label: '咖啡廳', emoji: '☕', ...P(1) },
  { id: 'birthday', label: '慶生餐廳', emoji: '🥂', ...P(6) },
  { id: 'cake', label: '生日蛋糕', emoji: '🎂', ...P(2) },
  { id: 'western', label: '西餐', emoji: '🥩', ...P(8) },
  { id: 'dessert', label: '甜點早午餐', emoji: '🥞', ...P(5) },
  { id: 'hotpot', label: '火鍋', emoji: '🍲', ...P(9) },
  { id: 'bbq', label: '燒肉', emoji: '🍖', ...P(0) },
  { id: 'burger', label: '漢堡', emoji: '🍔', ...P(5) },
  { id: 'bar', label: '酒吧', emoji: '🍸', ...P(4) },
  { id: 'late-night', label: '宵夜', emoji: '🍢', ...P(7) },
  { id: 'spot', label: '景點', emoji: '🌿', ...P(3) },
  { id: 'special-spot', label: '特別景點', emoji: '🎡', ...P(6) },
];

/** 給 emoji 選擇器用的候選（食物／飲品／甜點／地點／活動／符號） */
export const EMOJI_CHOICES: string[] = [
  '🍜', '🍝', '🍛', '🍣', '🍱', '🍙', '🍚', '🍤', '🥟', '🥘', '🍲', '🫕', '🍢', '🍡', '🍥', '🥡',
  '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🌭', '🍕', '🥪', '🌮', '🌯', '🥙', '🧆', '🥚', '🍳', '🥞',
  '🧇', '🥐', '🥖', '🥯', '🍞', '🧀', '🥗', '🥬', '🥑', '🍅', '🌽', '🍠', '🍄', '🫘', '🍆', '🥦',
  '🍰', '🎂', '🧁', '🍮', '🍩', '🍪', '🍫', '🍬', '🍭', '🍦', '🍨', '🍧', '🍯', '🥧', '🍓', '🍑',
  '🍊', '🍋', '🍇', '🍉', '🍌', '🥭', '🍍', '🥝', '🍒', '🫐', '☕', '🧋', '🍵', '🥤', '🧃', '🥛',
  '🍺', '🍻', '🍷', '🍸', '🍹', '🍶', '🥂', '🍾', '🥃', '🧉', '🧊', '🌙', '⭐', '✨', '🎉', '🎈',
  '🎁', '💐', '🌸', '🌼', '🌻', '🌹', '🌿', '🍀', '🌳', '🌲', '🏞️', '🏔️', '⛰️', '🌋', '🏖️', '🌊',
  '🌅', '🌇', '🌃', '🎡', '🎢', '🎠', '🎪', '🏛️', '⛩️', '🏯', '🏰', '🗼', '🏙️', '🚉', '🚇', '🚲',
  '🛶', '⛺', '🏕️', '🎨', '🖼️', '🎭', '🎬', '🎤', '🎧', '📚', '📖', '🧸', '🐶', '🐱', '🐾', '🧺',
  '🛍️', '💅', '🧖', '♨️', '🛁', '💛', '🤎', '💜', '📍', '🗺️', '🧭', '🔖', '🏷️', '💰', '🎯', '🍽️',
];

export function resolveCategories(vault: Pick<VaultState, 'categories'> | null | undefined): CategoryDef[] {
  const list = vault?.categories;
  if (Array.isArray(list) && list.length > 0) return list;
  return DEFAULT_CATEGORIES;
}

const FALLBACK_META: CategoryDef = { id: 'unknown', label: '未分類', emoji: '📍', bg: '#E8DED0', fg: '#5C5044' };

export function categoryMeta(list: CategoryDef[], id: string): CategoryDef {
  return list.find((c) => c.id === id) || DEFAULT_CATEGORIES.find((c) => c.id === id) || { ...FALLBACK_META, id, label: id || FALLBACK_META.label };
}

export function makeCategoryId(label: string, existing: CategoryDef[]): string {
  const base = `cat-${label.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'new'}`;
  let id = base;
  let n = 2;
  while (existing.some((c) => c.id === id)) id = `${base}-${n++}`;
  return id;
}

/** 向下相容：舊版 5 分類 id 對應 */
export const LEGACY_CATEGORY_ALIAS: Record<string, string> = {
  'bar-night': 'bar',
};

export interface TagMeta {
  id: string;
  label: string;
  emoji: string;
  group: '跑咖必備' | '聚會出遊' | '預算氛圍';
}

export const TAGS: TagMeta[] = [
  { id: 'no-time-limit', label: '不限時', emoji: '⏳', group: '跑咖必備' },
  { id: 'outlet', label: '有插座', emoji: '🔌', group: '跑咖必備' },
  { id: 'work-friendly', label: '適合讀書辦公', emoji: '💻', group: '跑咖必備' },
  { id: 'wifi', label: '有 Wi-Fi', emoji: '📶', group: '跑咖必備' },
  { id: 'pet-friendly', label: '寵物友善', emoji: '🐶', group: '聚會出遊' },
  { id: 'rainy-indoor', label: '雨天室內備案', emoji: '☔', group: '聚會出遊' },
  { id: 'reservation', label: '需提前訂位', emoji: '📅', group: '聚會出遊' },
  { id: 'late-night', label: '營業到很晚', emoji: '🌙', group: '聚會出遊' },
  { id: 'photogenic', label: '空間好拍', emoji: '📸', group: '聚會出遊' },
  { id: 'queue', label: '排隊名店', emoji: '🧍', group: '聚會出遊' },
  { id: 'group', label: '適合多人聚餐', emoji: '👯', group: '聚會出遊' },
  { id: 'kids', label: '親子友善', emoji: '👶', group: '聚會出遊' },
  { id: 'celebration', label: '慶生／紀念日', emoji: '🎉', group: '聚會出遊' },
  { id: 'budget', label: '百元平價', emoji: '💰', group: '預算氛圍' },
  { id: 'date', label: '約會質感', emoji: '💛', group: '預算氛圍' },
  { id: 'splurge', label: '犒賞自己', emoji: '✨', group: '預算氛圍' },
  { id: 'vegetarian', label: '有素食', emoji: '🥗', group: '預算氛圍' },
  { id: 'old-house', label: '老宅老屋', emoji: '🏚️', group: '預算氛圍' },
  { id: 'view', label: '景觀夜景', emoji: '🌇', group: '預算氛圍' },
  { id: 'walk', label: '散步路線', emoji: '🚶', group: '預算氛圍' },
  { id: 'takeaway', label: '可外帶', emoji: '🥡', group: '預算氛圍' },
];

export const TAG_MAP: Record<string, TagMeta> = TAGS.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<string, TagMeta>
);

export function tagLabel(id: string): string {
  const meta = TAG_MAP[id];
  return meta ? `${meta.emoji} ${meta.label}` : `# ${id}`;
}

export const REVISIT_META: Record<RevisitLevel, { label: string; emoji: string; bg: string; fg: string }> = {
  love: { label: '必回訪愛店', emoji: '🔥', bg: '#F2CA62', fg: '#5A3E0E' },
  ok: { label: '順路可去', emoji: '👍', bg: '#E7D6C3', fg: '#5C3F2D' },
  avoid: { label: '一次店避雷', emoji: '💣', bg: '#E4DAD5', fg: '#8A4A40' },
};
