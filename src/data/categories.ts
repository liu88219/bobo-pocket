import { SpotCategory, RevisitLevel } from '../types/pocket';

export interface CategoryMeta {
  id: SpotCategory;
  label: string;
  emoji: string;
  /** 卡片膠囊底色 */
  bg: string;
  fg: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'food', label: '美食', emoji: '🍜', bg: '#F6DDB8', fg: '#7A4A1C' },
  { id: 'cafe', label: '咖啡廳', emoji: '☕', bg: '#E7D6C3', fg: '#5C3F2D' },
  { id: 'dessert', label: '甜點早午餐', emoji: '🍰', bg: '#F8E4D4', fg: '#9A4A3A' },
  { id: 'spot', label: '景點散步', emoji: '🌿', bg: '#DCE5D2', fg: '#3F5A3A' },
  { id: 'bar', label: '酒吧宵夜', emoji: '🍸', bg: '#D9DEE8', fg: '#1E3158' },
];

export const CATEGORY_MAP: Record<SpotCategory, CategoryMeta> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<SpotCategory, CategoryMeta>
);

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
