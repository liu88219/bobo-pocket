import { Spot } from '../types/pocket';

/**
 * 公開層「精選口袋名單」— 由 Bobo 管家（Jetski）透過 git 直接維護。
 *
 * 🤎 想新增店家：把 IG / Threads / Google Maps 連結＋文案或截圖丟到對話，
 *    管家會查證店名、地址、捷運站、座標後補進這個陣列（origin: 'curated'）。
 * 🗑️ 2025-11-09：依 Mona 指示，第一版的 8 張範例卡已全部移除，從空白開始。
 */

const CURATED_BUILD_TS = 1762670000000;

export function curated(
  partial: Omit<Spot, 'origin' | 'createdAt' | 'updatedAt' | 'highlights' | 'tags'> & {
    highlights?: string[];
    tags?: string[];
    createdAt?: number;
    updatedAt?: number;
  }
): Spot {
  return {
    highlights: [],
    tags: [],
    ...partial,
    origin: 'curated',
    createdAt: partial.createdAt || CURATED_BUILD_TS,
    updatedAt: partial.updatedAt || partial.createdAt || CURATED_BUILD_TS,
  };
}

export const CURATED_SPOTS: Spot[] = [];

export const CURATED_SPOT_IDS = new Set(CURATED_SPOTS.map((s) => s.id));
