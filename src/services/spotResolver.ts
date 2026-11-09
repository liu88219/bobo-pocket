import { CURATED_SPOTS } from '../data/curatedSpots';
import { ResolvedSpot, Spot, VaultState, SpotCategory, MarkStatus } from '../types/pocket';

/**
 * 將公開層 curated 卡片（套用個人覆寫／隱藏）與私有層 personal 卡片合併成前台顯示清單
 */
export function resolveAllSpots(vault: VaultState, includeHidden = false, curatedList: Spot[] = CURATED_SPOTS): ResolvedSpot[] {
  const curated: ResolvedSpot[] = curatedList.map((base) => {
    const ov = vault.overrides[base.id];
    const hidden = Boolean(vault.curatedVisibility[base.id]?.hidden);
    const merged: Spot = ov ? { ...base, ...stripUndefined(ov), id: base.id, origin: 'curated', createdAt: base.createdAt } : base;
    return { ...merged, mark: vault.marks[base.id], hidden };
  });
  const personal: ResolvedSpot[] = vault.personalSpots.map((s) => ({
    ...s,
    mark: vault.marks[s.id],
    hidden: false,
  }));
  const all = [...personal, ...curated];
  return includeHidden ? all : all.filter((s) => !s.hidden);
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export interface SpotFilters {
  city: string; // '全部' | '台北市' | '新北市' | '其他'
  category: SpotCategory | 'all';
  status: MarkStatus | 'all';
  district?: string;
  mrt?: string;
  tags: string[];
  query: string;
}

export const DEFAULT_FILTERS: SpotFilters = {
  city: '全部',
  category: 'all',
  status: 'all',
  tags: [],
  query: '',
};

export function applyFilters(spots: ResolvedSpot[], f: SpotFilters): ResolvedSpot[] {
  const q = f.query.trim().toLowerCase();
  return spots.filter((s) => {
    if (f.city !== '全部') {
      if (f.city === '其他') {
        if (s.city === '台北市' || s.city === '新北市') return false;
      } else if (s.city !== f.city) return false;
    }
    if (f.category !== 'all' && s.category !== f.category) return false;
    if (f.status !== 'all') {
      const st = s.mark?.status || 'none';
      if (st !== f.status) return false;
    }
    if (f.district && s.district !== f.district) return false;
    if (f.mrt && s.mrt !== f.mrt) return false;
    if (f.tags.length > 0 && !f.tags.every((t) => s.tags.includes(t))) return false;
    if (q) {
      const hay = [
        s.name,
        s.city,
        s.district,
        s.mrt,
        s.zone,
        s.address,
        s.summary,
        s.mark?.note,
        ...(s.highlights || []),
        ...(s.tags || []),
        s.source?.author,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortSpots(spots: ResolvedSpot[]): ResolvedSpot[] {
  return [...spots].sort((a, b) => {
    const am = a.mark?.updatedAt || 0;
    const bm = b.mark?.updatedAt || 0;
    return Math.max(b.updatedAt, bm) - Math.max(a.updatedAt, am);
  });
}
