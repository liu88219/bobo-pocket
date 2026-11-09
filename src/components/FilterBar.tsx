import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X, LocateFixed, Loader2 } from 'lucide-react';
import { SpotFilters, DEFAULT_FILTERS } from '../services/spotResolver';
import { CATEGORIES, TAGS } from '../data/categories';
import { ResolvedSpot } from '../types/pocket';
import { PRIMARY_CITIES, districtsForCity, stationsForCity, METRO_LINE_META } from '../data/taipeiGeo';
import { Chip } from './ui';

export const FilterBar: React.FC<{
  filters: SpotFilters;
  onChange: (next: SpotFilters) => void;
  allSpots: ResolvedSpot[];
  nearbyOn?: boolean;
  nearbyBusy?: boolean;
  onToggleNearby?: () => void;
}> = ({ filters, onChange, allSpots, nearbyOn = false, nearbyBusy = false, onToggleNearby }) => {
  const [showMore, setShowMore] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { 全部: allSpots.length, 台北市: 0, 新北市: 0, 其他: 0 };
    for (const s of allSpots) {
      if (s.city === '台北市') c['台北市']++;
      else if (s.city === '新北市') c['新北市']++;
      else c['其他']++;
    }
    return c;
  }, [allSpots]);

  const hasOther = counts['其他'] > 0;

  const districtOptions = useMemo(() => {
    if (filters.city === '台北市' || filters.city === '新北市') return districtsForCity(filters.city);
    const set = new Set<string>();
    for (const s of allSpots) if (s.district) set.add(s.district);
    return Array.from(set);
  }, [filters.city, allSpots]);

  const stationOptions = useMemo(() => {
    const base = filters.city === '台北市' || filters.city === '新北市' ? stationsForCity(filters.city) : [];
    const used = new Set(allSpots.map((s) => s.mrt).filter(Boolean) as string[]);
    const usedList = Array.from(used);
    if (base.length === 0) return usedList.map((n) => ({ name: n, label: n }));
    const filtered = filters.district ? base.filter((s) => s.district === filters.district) : base;
    return filtered.map((s) => ({
      name: `${s.name}站`,
      label: `${s.name}站 ${s.lines.map((l) => METRO_LINE_META[l].name.slice(0, 2)).join('/')}`,
    }));
  }, [filters.city, filters.district, allSpots]);

  const activeExtra = (filters.district ? 1 : 0) + (filters.mrt ? 1 : 0) + filters.tags.length;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {['全部', ...PRIMARY_CITIES, ...(hasOther ? ['其他'] : [])].map((city) => (
          <Chip
            key={city}
            active={filters.city === city}
            onClick={() => onChange({ ...filters, city, district: undefined, mrt: undefined })}
          >
            {city === '全部' ? '🗂️ 全部' : city === '其他' ? '✈️ 其他縣市' : city === '台北市' ? '🏙️ 台北市' : '🌉 新北市'}
            <span className="opacity-70">{counts[city] ?? 0}</span>
          </Chip>
        ))}
        {onToggleNearby && (
          <button type="button" onClick={onToggleNearby} className={`pill ${nearbyOn ? 'bg-[#DCE5D2] text-[#3F5A3A] border border-[#C9D6BE]' : 'pill-idle'}`}>
            {nearbyBusy ? <Loader2 size={13} className="spin-slow" /> : <LocateFixed size={13} />} 我附近
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A79C8E]" />
        <input
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="搜尋店名、捷運站、必點、筆記…"
          className="input-cream pl-10 pr-10 py-2.5"
          autoCapitalize="none"
          autoCorrect="off"
        />
        {filters.query && (
          <button type="button" onClick={() => onChange({ ...filters, query: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A79C8E]" aria-label="清除">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        <Chip active={filters.category === 'all'} onClick={() => onChange({ ...filters, category: 'all' })}>
          全部分類
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={filters.category === c.id} onClick={() => onChange({ ...filters, category: filters.category === c.id ? 'all' : c.id })}>
            {c.emoji} {c.label}
          </Chip>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 items-center">
        <Chip active={filters.status === 'all'} onClick={() => onChange({ ...filters, status: 'all' })}>
          全部狀態
        </Chip>
        <Chip tone="butter" active={filters.status === 'want'} onClick={() => onChange({ ...filters, status: filters.status === 'want' ? 'all' : 'want' })}>
          📌 想去
        </Chip>
        <Chip active={filters.status === 'visited'} onClick={() => onChange({ ...filters, status: filters.status === 'visited' ? 'all' : 'visited' })}>
          ✅ 已踩點
        </Chip>
        <Chip active={filters.status === 'none'} onClick={() => onChange({ ...filters, status: filters.status === 'none' ? 'all' : 'none' })}>
          🆕 未標記
        </Chip>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className={`pill ${showMore || activeExtra > 0 ? 'pill-active' : 'pill-idle'} ml-auto`}
        >
          <SlidersHorizontal size={13} /> 更多篩選{activeExtra > 0 ? ` (${activeExtra})` : ''}
        </button>
      </div>

      {showMore && (
        <div className="doodle-card-soft p-3 flex flex-col gap-3 fade-in">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label-cream">行政區</label>
              <select
                value={filters.district || ''}
                onChange={(e) => onChange({ ...filters, district: e.target.value || undefined, mrt: undefined })}
                className="input-cream py-2 text-[14px]"
              >
                <option value="">全部行政區</option>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-cream">捷運站</label>
              <select
                value={filters.mrt || ''}
                onChange={(e) => onChange({ ...filters, mrt: e.target.value || undefined })}
                className="input-cream py-2 text-[14px]"
              >
                <option value="">全部捷運站</option>
                {stationOptions.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label-cream">情境標籤（可複選）</label>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => {
                const active = filters.tags.includes(t.id);
                return (
                  <Chip
                    key={t.id}
                    active={active}
                    tone="butter"
                    onClick={() =>
                      onChange({
                        ...filters,
                        tags: active ? filters.tags.filter((x) => x !== t.id) : [...filters.tags, t.id],
                      })
                    }
                  >
                    {t.emoji} {t.label}
                  </Chip>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange({ ...DEFAULT_FILTERS, city: filters.city });
              setShowMore(false);
            }}
            className="self-end text-[12.5px] font-bold text-[#8A7E70] underline underline-offset-2"
          >
            清除篩選
          </button>
        </div>
      )}
    </div>
  );
};
