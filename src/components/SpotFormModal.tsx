import React, { useMemo, useState } from 'react';
import { LocateFixed, ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { Spot, SpotCategory, SourcePlatform, makeId } from '../types/pocket';
import { CATEGORIES, TAGS } from '../data/categories';
import { PRIMARY_CITIES, OTHER_CITIES, districtsForCity, stationsForCity, ZONES } from '../data/taipeiGeo';
import { geocodeSpotSmart, extractLatLngFromUrl } from '../services/geocode';
import { processImageFile } from '../services/imageTools';
import { detectPlatform } from '../services/spotParser';
import { Modal, Chip } from './ui';
import { MapView } from './MapView';

export interface SpotFormDraft {
  id?: string;
  name: string;
  category: SpotCategory;
  city: string;
  district: string;
  mrt: string;
  zone: string;
  address: string;
  lat?: number;
  lng?: number;
  hours: string;
  priceHint: string;
  tags: string[];
  highlightsText: string;
  summary: string;
  sourceUrl: string;
  sourceAuthor: string;
  caption: string;
  coverThumb?: string;
  coverHiRes?: string;
  origin: 'curated' | 'personal';
  isSeed?: boolean;
  createdAt?: number;
}

export function emptyDraft(): SpotFormDraft {
  return {
    name: '',
    category: 'food',
    city: '台北市',
    district: '',
    mrt: '',
    zone: '',
    address: '',
    hours: '',
    priceHint: '',
    tags: [],
    highlightsText: '',
    summary: '',
    sourceUrl: '',
    sourceAuthor: '',
    caption: '',
    origin: 'personal',
  };
}

export function spotToDraft(s: Spot): SpotFormDraft {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    city: s.city,
    district: s.district || '',
    mrt: s.mrt || '',
    zone: s.zone || '',
    address: s.address || '',
    lat: s.lat,
    lng: s.lng,
    hours: s.hours || '',
    priceHint: s.priceHint || '',
    tags: [...s.tags],
    highlightsText: (s.highlights || []).join('、'),
    summary: s.summary || '',
    sourceUrl: s.source?.url || '',
    sourceAuthor: s.source?.author || '',
    caption: s.source?.caption || '',
    coverThumb: s.coverThumb,
    origin: s.origin,
    isSeed: s.isSeed,
    createdAt: s.createdAt,
  };
}

export function draftToSpot(d: SpotFormDraft, now = Date.now()): Spot {
  const platform: SourcePlatform = d.sourceUrl ? detectPlatform(d.sourceUrl) : 'manual';
  const highlights = d.highlightsText
    .split(/[、,，\n/]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  return {
    id: d.id || makeId('spot'),
    name: d.name.trim(),
    category: d.category,
    city: d.city.trim() || '台北市',
    district: d.district.trim() || undefined,
    mrt: d.mrt.trim() || undefined,
    zone: d.zone.trim() || undefined,
    address: d.address.trim() || undefined,
    lat: typeof d.lat === 'number' && Number.isFinite(d.lat) ? d.lat : undefined,
    lng: typeof d.lng === 'number' && Number.isFinite(d.lng) ? d.lng : undefined,
    hours: d.hours.trim() || undefined,
    priceHint: d.priceHint.trim() || undefined,
    tags: d.tags,
    highlights,
    summary: d.summary.trim() || undefined,
    source:
      d.sourceUrl || d.sourceAuthor || d.caption
        ? { platform, url: d.sourceUrl.trim() || undefined, author: d.sourceAuthor.trim() || undefined, caption: d.caption.trim().slice(0, 600) || undefined }
        : undefined,
    coverThumb: d.coverThumb,
    hasCoverPhoto: Boolean(d.coverThumb),
    origin: d.origin,
    isSeed: d.isSeed,
    createdAt: d.createdAt || now,
    updatedAt: now,
  };
}

export const SpotFormModal: React.FC<{
  open: boolean;
  initial: SpotFormDraft;
  title?: string;
  onCancel: () => void;
  onSave: (draft: SpotFormDraft) => void;
  onToast: (msg: string) => void;
}> = ({ open, initial, title = '✍️ 店家資料', onCancel, onSave, onToast }) => {
  const [d, setD] = useState<SpotFormDraft>(initial);
  const [locating, setLocating] = useState(false);
  const [showPinMap, setShowPinMap] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);

  // Reset when a different initial comes in
  const initialKey = useMemo(() => JSON.stringify({ id: initial.id, n: initial.name, u: initial.sourceUrl, c: initial.coverThumb?.length }), [initial]);
  const [lastKey, setLastKey] = useState(initialKey);
  if (lastKey !== initialKey) {
    setLastKey(initialKey);
    setD(initial);
  }

  const isPrimary = d.city === '台北市' || d.city === '新北市';
  const districts = districtsForCity(d.city);
  const stations = isPrimary
    ? [...stationsForCity(d.city)].sort((a, b) => {
        const am = d.district && a.district === d.district ? 0 : 1;
        const bm = d.district && b.district === d.district ? 0 : 1;
        return am - bm;
      })
    : [];
  const zones = ZONES.filter((z) => z.city === d.city);

  const set = <K extends keyof SpotFormDraft>(k: K, v: SpotFormDraft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const handleLocate = async () => {
    setLocating(true);
    try {
      const fromUrl = d.sourceUrl ? extractLatLngFromUrl(d.sourceUrl) : null;
      if (fromUrl) {
        setD((p) => ({ ...p, lat: fromUrl.lat, lng: fromUrl.lng }));
        onToast('📍 已從 Google Maps 連結取得座標');
        return;
      }
      const hit = await geocodeSpotSmart({ name: d.name, address: d.address, city: d.city, district: d.district, mrt: d.mrt });
      if (hit) {
        setD((p) => ({ ...p, lat: Number(hit.lat.toFixed(6)), lng: Number(hit.lng.toFixed(6)) }));
        onToast('📍 定位完成！可打開地圖微調大頭針');
        setShowPinMap(true);
      } else {
        onToast('找不到座標，試試補上完整地址或直接在地圖上點選位置');
        setShowPinMap(true);
        if (typeof d.lat !== 'number') setD((p) => ({ ...p, lat: 25.04, lng: 121.53 }));
      }
    } finally {
      setLocating(false);
    }
  };

  const handleCover = async (file: File | null) => {
    if (!file) return;
    setImgBusy(true);
    try {
      const img = await processImageFile(file);
      setD((p) => ({ ...p, coverThumb: img.thumb, coverHiRes: img.hiRes }));
    } catch (err) {
      onToast(err instanceof Error ? err.message : '圖片處理失敗');
    } finally {
      setImgBusy(false);
    }
  };

  const canSave = d.name.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      subtitle={d.origin === 'curated' ? '這是精選範例卡，妳的修改只會存在自己的保險箱' : '存檔後會自動同步到雙雲端保險箱'}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="doodle-btn flex-1 bg-[#EFECE4] text-[#5C5044] font-black py-3">
            取消
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(d)}
            className="doodle-btn flex-[2] bg-[#F2CA62] text-[#3F2E0C] font-black py-3 disabled:opacity-50"
          >
            💾 儲存店卡
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 items-start">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#DEDCD3] border border-[#DDD7C9] shrink-0 flex items-center justify-center relative">
            {d.coverThumb ? <img src={d.coverThumb} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl">{CATEGORIES.find((c) => c.id === d.category)?.emoji}</span>}
            {imgBusy && (
              <div className="absolute inset-0 bg-[#FAF8F3]/70 flex items-center justify-center">
                <Loader2 className="spin-slow text-[#C48E63]" />
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <label className="doodle-btn inline-flex items-center justify-center gap-1.5 bg-[#EFECE4] text-[#5C5044] font-black py-2 text-[13px] cursor-pointer">
              <ImagePlus size={15} /> {d.coverThumb ? '更換封面' : '上傳封面／截圖'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleCover(e.target.files?.[0] || null)} />
            </label>
            {d.coverThumb && (
              <button type="button" onClick={() => setD((p) => ({ ...p, coverThumb: undefined, coverHiRes: undefined }))} className="inline-flex items-center justify-center gap-1 text-[12px] font-bold text-[#8A7E70]">
                <Trash2 size={13} /> 移除封面
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="label-cream">店名／地點名稱 *</label>
          <input value={d.name} onChange={(e) => set('name', e.target.value)} className="input-cream" placeholder="例如：Fika Fika Cafe" />
        </div>

        <div>
          <label className="label-cream">分類</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <Chip key={c.id} active={d.category === c.id} onClick={() => set('category', c.id)}>
                {c.emoji} {c.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label-cream">縣市</label>
            <select value={d.city} onChange={(e) => setD((p) => ({ ...p, city: e.target.value, district: '', mrt: '', zone: '' }))} className="input-cream py-2.5">
              {PRIMARY_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <optgroup label="其他縣市">
                {OTHER_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="label-cream">行政區</label>
            {isPrimary ? (
              <select value={d.district} onChange={(e) => set('district', e.target.value)} className="input-cream py-2.5">
                <option value="">未選擇</option>
                {districts.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            ) : (
              <input value={d.district} onChange={(e) => set('district', e.target.value)} className="input-cream" placeholder="例如：中壢區" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label-cream">最近捷運站</label>
            {isPrimary ? (
              <select value={d.mrt} onChange={(e) => set('mrt', e.target.value)} className="input-cream py-2.5">
                <option value="">無／未選擇</option>
                {stations.map((s) => (
                  <option key={s.name} value={`${s.name}站`}>
                    {s.name}站（{s.district}）
                  </option>
                ))}
              </select>
            ) : (
              <input value={d.mrt} onChange={(e) => set('mrt', e.target.value)} className="input-cream" placeholder="車站／交通方式" />
            )}
          </div>
          <div>
            <label className="label-cream">商圈／地帶</label>
            {isPrimary && zones.length > 0 ? (
              <select value={d.zone} onChange={(e) => set('zone', e.target.value)} className="input-cream py-2.5">
                <option value="">未選擇</option>
                {zones.map((z) => (
                  <option key={z.name} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
            ) : (
              <input value={d.zone} onChange={(e) => set('zone', e.target.value)} className="input-cream" placeholder="例如：審計新村" />
            )}
          </div>
        </div>

        <div>
          <label className="label-cream">地址</label>
          <div className="flex gap-2">
            <input value={d.address} onChange={(e) => set('address', e.target.value)} className="input-cream" placeholder="台北市中山區伊通街33號" />
            <button type="button" onClick={() => void handleLocate()} disabled={locating} className="doodle-btn shrink-0 bg-[#C48E63] text-white font-black px-3 text-[13px] inline-flex items-center gap-1 disabled:opacity-60">
              {locating ? <Loader2 size={15} className="spin-slow" /> : <LocateFixed size={15} />} 定位
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11.5px] text-[#8A7E70] font-bold">
              {typeof d.lat === 'number' && typeof d.lng === 'number' ? `📍 ${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}` : '尚未定位（地圖模式需要座標）'}
            </span>
            <button type="button" onClick={() => setShowPinMap((v) => !v)} className="text-[12px] font-bold text-[#1E3158] underline underline-offset-2">
              {showPinMap ? '收起地圖' : '在地圖上微調'}
            </button>
          </div>
          {showPinMap && (
            <div className="mt-2">
              <MapView
                spots={[]}
                className="h-56"
                focus={typeof d.lat === 'number' && typeof d.lng === 'number' ? { lat: d.lat, lng: d.lng, zoom: 16 } : { lat: 25.04, lng: 121.53, zoom: 12 }}
                draggablePin={{
                  lat: typeof d.lat === 'number' ? d.lat : 25.04,
                  lng: typeof d.lng === 'number' ? d.lng : 121.53,
                  onMove: (lat, lng) => setD((p) => ({ ...p, lat, lng })),
                }}
              />
              <p className="text-[11.5px] text-[#8A7E70] mt-1">點地圖或拖曳 📍 即可修正位置</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label-cream">營業時間</label>
            <input value={d.hours} onChange={(e) => set('hours', e.target.value)} className="input-cream" placeholder="11:00–20:00／週一公休" />
          </div>
          <div>
            <label className="label-cream">價位</label>
            <input value={d.priceHint} onChange={(e) => set('priceHint', e.target.value)} className="input-cream" placeholder="人均約 $300" />
          </div>
        </div>

        <div>
          <label className="label-cream">必點／亮點（用「、」分隔）</label>
          <input value={d.highlightsText} onChange={(e) => set('highlightsText', e.target.value)} className="input-cream" placeholder="肉桂捲、手沖、燕麥拿鐵" />
        </div>

        <div>
          <label className="label-cream">為什麼想去／短片重點</label>
          <textarea value={d.summary} onChange={(e) => set('summary', e.target.value)} className="input-cream min-h-[72px]" placeholder="一句話記下吸引妳的點" />
        </div>

        <div>
          <label className="label-cream">情境標籤</label>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => {
              const active = d.tags.includes(t.id);
              return (
                <Chip key={t.id} active={active} tone="butter" onClick={() => set('tags', active ? d.tags.filter((x) => x !== t.id) : [...d.tags, t.id])}>
                  {t.emoji} {t.label}
                </Chip>
              );
            })}
          </div>
        </div>

        <details className="doodle-card-soft p-3" open={Boolean(d.sourceUrl)}>
          <summary className="text-[13px] font-black text-[#5C5044] cursor-pointer">▶️ 原始短片來源（IG／Threads 連結、作者、文案）</summary>
          <div className="flex flex-col gap-2 mt-2">
            <input value={d.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} className="input-cream" placeholder="https://www.instagram.com/reel/…" autoCapitalize="none" autoCorrect="off" />
            <input value={d.sourceAuthor} onChange={(e) => set('sourceAuthor', e.target.value)} className="input-cream" placeholder="創作者帳號（選填）" autoCapitalize="none" />
            <textarea value={d.caption} onChange={(e) => set('caption', e.target.value)} className="input-cream min-h-[64px]" placeholder="貼文文案摘錄（選填，最多 600 字）" />
          </div>
        </details>
      </div>
    </Modal>
  );
};
