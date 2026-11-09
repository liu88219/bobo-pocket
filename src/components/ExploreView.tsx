import React, { useMemo, useState } from 'react';
import { Search, Loader2, Plus, Check, ExternalLink, LocateFixed, Bot, Star } from 'lucide-react';
import { ResolvedSpot } from '../types/pocket';
import { PRIMARY_CITIES, districtsForCity, stationsForCity } from '../data/taipeiGeo';
import { DISCOVER_THEMES, DISTRICT_CENTERS, DiscoverResult, DiscoverTheme, DiscoverArea, discoverPlaces, loadPlacesKey, reverseGeocodeArea } from '../services/discover';
import { geocodeAddress } from '../services/geocode';
import { getCurrentPosition, formatDistance } from '../services/mapLinks';
import { Chip, copyToClipboard } from './ui';
import { useCategories } from './CategoryContext';
import { BoboCupBadge } from './QuokkaBoboArt';

type AreaMode = 'district' | 'station' | 'nearby';

function normName(s: string): string {
  return s.toLowerCase().replace(/[\s（）()【】\-・·]/g, '');
}

export const ExploreView: React.FC<{
  existingSpots: ResolvedSpot[];
  onAddResults: (results: DiscoverResult[], categoryId: string, themeLabel: string, area: DiscoverArea) => void;
  onToast: (msg: string) => void;
  onOpenSettings: () => void;
}> = ({ existingSpots, onAddResults, onToast, onOpenSettings }) => {
  const { list: categories } = useCategories();
  const [city, setCity] = useState<string>('新北市');
  const [areaMode, setAreaMode] = useState<AreaMode>('district');
  const [district, setDistrict] = useState<string>('板橋區');
  const [station, setStation] = useState<string>('');
  const [theme, setTheme] = useState<DiscoverTheme>(DISCOVER_THEMES[0]);
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<string>(DISCOVER_THEMES[0].categoryId);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<DiscoverResult[]>([]);
  const [engineNote, setEngineNote] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchedLabel, setSearchedLabel] = useState('');
  const [searchedArea, setSearchedArea] = useState<DiscoverArea>({});

  const hasGoogleKey = Boolean(loadPlacesKey());
  const existingNames = useMemo(() => new Set(existingSpots.map((s) => normName(s.name))), [existingSpots]);

  const districts = districtsForCity(city);
  const stations = stationsForCity(city);

  const pickTheme = (t: DiscoverTheme) => {
    setTheme(t);
    if (categories.some((c) => c.id === t.categoryId)) setCategoryId(t.categoryId);
  };

  const resolveCenter = async (): Promise<{ lat: number; lng: number; radius: number; label: string; area: DiscoverArea } | null> => {
    if (areaMode === 'nearby') {
      const pos = await getCurrentPosition();
      if (!pos) {
        onToast('抓不到目前位置，請允許定位或改用行政區搜尋');
        return null;
      }
      const area = await reverseGeocodeArea(pos.lat, pos.lng);
      return { ...pos, radius: 1500, label: area.district ? `我附近（${area.district}）` : '我附近', area };
    }
    if (areaMode === 'station') {
      if (!station) {
        onToast('先選一個捷運站');
        return null;
      }
      const st = stations.find((x) => `${x.name}站` === station);
      const hit = await geocodeAddress(`捷運${station} ${city}`);
      if (!hit) {
        onToast('找不到車站位置，改用行政區試試');
        return null;
      }
      return { lat: hit.lat, lng: hit.lng, radius: 1200, label: `${station}周邊`, area: { city: st?.city || city, district: st?.district } };
    }
    const c = DISTRICT_CENTERS[district];
    if (!c) {
      onToast('先選一個行政區');
      return null;
    }
    return { ...c, label: `${city}${district}`, area: { city, district } };
  };

  const run = async () => {
    setBusy(true);
    setEngineNote('');
    setSelected(new Set());
    try {
      const center = await resolveCenter();
      if (!center) return;
      const outcome = await discoverPlaces(
        { center: { lat: center.lat, lng: center.lng }, radius: center.radius, theme, keyword: keyword.trim() || undefined, areaLabel: center.label },
        hasGoogleKey ? loadPlacesKey() : undefined
      );
      setResults(outcome.results);
      setSearchedArea(center.area);
      setSearchedLabel(`${center.label}・${theme.label}${keyword.trim() ? `・${keyword.trim()}` : ''}`);
      const engineLabel = outcome.engine === 'google' ? 'Google 地點' : outcome.engine === 'osm' ? 'OpenStreetMap' : 'Nominatim';
      setEngineNote([`引擎：${engineLabel}`, outcome.note, !hasGoogleKey && theme.freeHint].filter(Boolean).join('・'));
      if (outcome.results.length === 0) onToast('沒有找到結果，換個主題或半徑看看');
    } catch (err) {
      onToast(err instanceof Error ? err.message : '探索失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addOne = (r: DiscoverResult) => {
    onAddResults([r], categoryId, theme.label, searchedArea);
  };

  const addSelected = () => {
    const picked = results.filter((r) => selected.has(r.id));
    if (picked.length === 0) {
      onToast('先勾選要收錄的店');
      return;
    }
    onAddResults(picked, categoryId, theme.label, searchedArea);
    setSelected(new Set());
  };

  const askManager = async () => {
    const area = areaMode === 'nearby' ? '我附近' : areaMode === 'station' ? `${station}周邊` : `${city}${district}`;
    const text = `🤎 BoboPocket 探索委託：請 Bobo 管家幫我找「${area}」的「${theme.label}${keyword.trim() ? `・${keyword.trim()}` : ''}」推薦 5～8 家（附地址、捷運站、營業時間、必點），查證後收進 BoboPocket 精選層（分類：${categories.find((c) => c.id === categoryId)?.label || theme.label}）。`;
    const ok = await copyToClipboard(text);
    onToast(ok ? '📋 已複製委託文字，貼給 Bobo 管家就會幫妳查證建檔' : text);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <BoboCupBadge className="w-12 h-12" />
        <div>
          <h2 className="text-[17px] font-black">🔎 探索未收錄的好店</h2>
          <p className="text-[12.5px] text-[#8A7E70] font-bold">選地區＋主題，找到後一鍵收進口袋（免金鑰：OpenStreetMap；可選 Google 引擎更準）</p>
        </div>
      </div>

      <section className="doodle-card p-4 flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          <Chip active={areaMode === 'district'} onClick={() => setAreaMode('district')}>
            🏙️ 行政區
          </Chip>
          <Chip active={areaMode === 'station'} onClick={() => setAreaMode('station')}>
            🚇 捷運站
          </Chip>
          <Chip active={areaMode === 'nearby'} onClick={() => setAreaMode('nearby')}>
            <LocateFixed size={13} /> 我附近
          </Chip>
        </div>
        {areaMode !== 'nearby' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label-cream">縣市</label>
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setDistrict(districtsForCity(e.target.value)[0] || '');
                  setStation('');
                }}
                className="input-cream py-2.5"
              >
                {PRIMARY_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-cream">{areaMode === 'district' ? '行政區' : '捷運站'}</label>
              {areaMode === 'district' ? (
                <select value={district} onChange={(e) => setDistrict(e.target.value)} className="input-cream py-2.5">
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <select value={station} onChange={(e) => setStation(e.target.value)} className="input-cream py-2.5">
                  <option value="">選擇車站</option>
                  {stations.map((s) => (
                    <option key={s.name} value={`${s.name}站`}>
                      {s.name}站（{s.district}）
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="label-cream">主題</label>
          <div className="flex flex-wrap gap-1.5">
            {DISCOVER_THEMES.map((t) => (
              <Chip key={t.id} active={theme.id === t.id} tone="butter" onClick={() => pickTheme(t)}>
                {t.emoji} {t.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <label className="label-cream">關鍵字（選填，例如：景觀、包廂、不限時）</label>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="input-cream" placeholder="留空就依主題搜尋" />
          </div>
          <button type="button" onClick={() => void run()} disabled={busy} className="doodle-btn bg-[#F2CA62] text-[#3F2E0C] font-black px-4 py-3 inline-flex items-center gap-1.5 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="spin-slow" /> : <Search size={16} />} 探索
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#8A7E70]">
            收錄到分類：
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input-cream !w-auto py-1 px-2 text-[12.5px]">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={onOpenSettings} className="text-[12px] font-bold text-[#1E3158] underline underline-offset-2">
            {hasGoogleKey ? '✅ 已啟用 Google 引擎' : '啟用 Google 引擎（更準、有評分）'}
          </button>
        </div>
      </section>

      {engineNote && <p className="text-[12px] text-[#8A7E70] font-bold leading-snug">{engineNote}</p>}

      {results.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-[#5C5044]">
              {searchedLabel}・{results.length} 筆
            </p>
            <button type="button" onClick={addSelected} disabled={selected.size === 0} className="pill pill-butter disabled:opacity-50">
              <Plus size={13} /> 收錄已勾選（{selected.size}）
            </button>
          </div>
          {results.map((r) => {
            const already = existingNames.has(normName(r.name));
            const on = selected.has(r.id);
            return (
              <div key={r.id} className={`doodle-card p-3.5 flex gap-3 ${on ? 'ring-2 ring-[#F2CA62]' : ''}`}>
                <button type="button" onClick={() => toggle(r.id)} className={`shrink-0 w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center ${on ? 'bg-[#F2CA62] border-[#E6BC52] text-[#3F2E0C]' : 'border-[#DDD7C9] text-transparent'}`} aria-label="勾選">
                  <Check size={14} />
                </button>
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-black leading-snug">{r.name}</h3>
                    {already && <span className="rounded-full bg-[#DCE5D2] text-[#3F5A3A] text-[10.5px] font-black px-2 py-0.5">已收錄</span>}
                    {typeof r.rating === 'number' && (
                      <span className="inline-flex items-center gap-0.5 text-[12px] font-black text-[#9A6B12]">
                        <Star size={12} fill="#F2CA62" stroke="#C48E63" /> {r.rating}
                        {r.ratingCount ? <span className="text-[#8A7E70] font-bold">（{r.ratingCount}）</span> : null}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#8A7E70] font-bold">
                    {[r.typeLabel, r.priceHint, typeof r.distanceKm === 'number' ? `距中心 ${formatDistance(r.distanceKm)}` : ''].filter(Boolean).join('・')}
                  </p>
                  {r.address && <p className="text-[12.5px] text-[#5C5044]">{r.address}</p>}
                  {r.hours && <p className="text-[11.5px] text-[#8A7E70] line-clamp-1">🕒 {r.hours}</p>}
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => addOne(r)} disabled={already} className="pill pill-butter disabled:opacity-50">
                      <Plus size={13} /> {already ? '已在口袋' : '收錄'}
                    </button>
                    {r.mapsUrl && (
                      <a href={r.mapsUrl} target="_blank" rel="noreferrer" className="pill pill-idle">
                        <ExternalLink size={13} /> 看地圖
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="doodle-card-soft p-3.5 flex items-start gap-3">
        <Bot size={18} className="text-[#C48E63] mt-0.5 shrink-0" />
        <div className="text-[12.5px] text-[#5C5044] leading-relaxed flex-1">
          <b>想要「板橋適合慶生、有包廂、評價好」這種精準需求？</b>
          <br />
          免費地圖資料只能依類別找；按下方複製委託文字貼給 Bobo 管家，我會上網查證評價、地址、捷運站後直接幫妳建成精選卡。
          <div className="mt-2">
            <button type="button" onClick={() => void askManager()} className="pill pill-idle">
              📋 複製「請管家找」委託文字
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
