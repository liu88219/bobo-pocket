import React, { useEffect, useState } from 'react';
import { MapPin, TrainFront, Clock, Wallet, ExternalLink, Navigation, Pencil, EyeOff, Trash2, Share2, Camera, Loader2 } from 'lucide-react';
import { ResolvedSpot, PersonalMark, MarkStatus, RevisitLevel, getLocalDateKey } from '../types/pocket';
import { REVISIT_META, tagLabel } from '../data/categories';
import { buildGoogleMapsUrl } from '../services/spotParser';
import { processImageFile } from '../services/imageTools';
import { Modal, PLATFORM_LABEL, SectionTitle } from './ui';
import { CategoryPill, CoverArea } from './SpotCard';
import { MapView } from './MapView';

export interface MarkDraft {
  status: MarkStatus;
  revisit?: RevisitLevel;
  note: string;
  visitedAt: string;
  photoThumb?: string;
  photoHiRes?: string;
}

function markToDraft(m?: PersonalMark): MarkDraft {
  return {
    status: m?.status || 'none',
    revisit: m?.revisit,
    note: m?.note || '',
    visitedAt: m?.visitedAt || '',
    photoThumb: m?.photoThumb,
  };
}

export const SpotDetailSheet: React.FC<{
  spot: ResolvedSpot | null;
  onClose: () => void;
  onSaveMark: (spotId: string, draft: MarkDraft) => void;
  onEdit: (spot: ResolvedSpot) => void;
  onHideOrDelete: (spot: ResolvedSpot) => void;
  onShare: (spot: ResolvedSpot) => void;
  onToast: (msg: string) => void;
  loadHiResPhoto?: (spot: ResolvedSpot) => Promise<string | null>;
}> = ({ spot, onClose, onSaveMark, onEdit, onHideOrDelete, onShare, onToast, loadHiResPhoto }) => {
  const [draft, setDraft] = useState<MarkDraft>(markToDraft(spot?.mark));
  const [dirty, setDirty] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [hiRes, setHiRes] = useState<string | null>(null);

  useEffect(() => {
    setDraft(markToDraft(spot?.mark));
    setDirty(false);
    setHiRes(null);
    if (spot && loadHiResPhoto) {
      let active = true;
      loadHiResPhoto(spot).then((p) => {
        if (active && p) setHiRes(p);
      });
      return () => {
        active = false;
      };
    }
    return undefined;
  }, [spot?.id, spot?.mark?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spot) return null;

  const update = (patch: Partial<MarkDraft>) => {
    setDraft((p) => ({ ...p, ...patch }));
    setDirty(true);
  };

  const setStatus = (status: MarkStatus) => {
    const next: Partial<MarkDraft> = { status };
    if (status === 'visited' && !draft.visitedAt) next.visitedAt = getLocalDateKey();
    update(next);
  };

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    setImgBusy(true);
    try {
      const img = await processImageFile(file);
      update({ photoThumb: img.thumb, photoHiRes: img.hiRes, status: draft.status === 'none' ? 'visited' : draft.status, visitedAt: draft.visitedAt || getLocalDateKey() });
    } catch (err) {
      onToast(err instanceof Error ? err.message : '圖片處理失敗');
    } finally {
      setImgBusy(false);
    }
  };

  const save = () => {
    onSaveMark(spot.id, draft);
    setDirty(false);
  };

  const mapsUrl = buildGoogleMapsUrl(spot.name, spot.address, spot.lat, spot.lng);
  const platform = spot.source?.platform;
  const displayCover = hiRes || spot.coverThumb;

  return (
    <Modal
      open={Boolean(spot)}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="doodle-btn flex-1 bg-[#1E3158] text-white font-black py-3 inline-flex items-center justify-center gap-1.5 text-[14px]">
            <Navigation size={16} /> Google Maps
          </a>
          {spot.source?.url && (
            <a href={spot.source.url} target="_blank" rel="noreferrer" className="doodle-btn flex-1 bg-[#EFECE4] text-[#2D251E] font-black py-3 inline-flex items-center justify-center gap-1.5 text-[14px]">
              <ExternalLink size={16} /> 回看原短片
            </a>
          )}
          {dirty && (
            <button type="button" onClick={save} className="doodle-btn flex-1 bg-[#F2CA62] text-[#3F2E0C] font-black py-3 text-[14px]">
              💾 儲存
            </button>
          )}
        </div>
      }
    >
      <div className="-mx-5 -mt-4 relative">
        {displayCover ? (
          <div className="h-56 bg-[#DEDCD3] overflow-hidden">
            <img src={displayCover} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <CoverArea spot={spot} className="h-40" />
        )}
        <button type="button" onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[#FAF8F3]/90 border border-[#DDD7C9] font-black text-[#5C5044]" aria-label="關閉">
          ✕
        </button>
        <div className="absolute top-3 left-3 flex gap-1.5">
          <CategoryPill category={spot.category} />
          {spot.isSeed && <span className="rounded-full bg-[#FAF8F3]/90 text-[#8A7E70] text-[11px] font-bold px-2 py-1 border border-[#DDD7C9]">範例卡</span>}
        </div>
      </div>

      <div className="pt-4 flex flex-col gap-4">
        <div>
          <h2 className="text-[20px] font-black leading-tight text-[#2D251E]">{spot.name}</h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[13px] font-bold text-[#5C5044]">
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} className="text-[#C48E63]" />
              {spot.city}
              {spot.district ? `・${spot.district}` : ''}
              {spot.zone ? `・${spot.zone}` : ''}
            </span>
            {spot.mrt && (
              <span className="inline-flex items-center gap-1">
                <TrainFront size={14} className="text-[#1E3158]" />
                {spot.mrt}
              </span>
            )}
          </div>
          {spot.address && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(spot.address || '');
                  onToast('📋 已複製地址');
                } catch {
                  onToast(spot.address || '');
                }
              }}
              className="mt-1.5 text-left text-[13px] text-[#8A7E70] underline underline-offset-2 decoration-dotted"
            >
              {spot.address}
            </button>
          )}
        </div>

        {(spot.hours || spot.priceHint) && (
          <div className="grid grid-cols-1 gap-2">
            {spot.hours && (
              <div className="doodle-card-soft p-3 flex items-start gap-2 text-[13px] text-[#2D251E]">
                <Clock size={15} className="text-[#C48E63] mt-0.5 shrink-0" />
                <span>{spot.hours}</span>
              </div>
            )}
            {spot.priceHint && (
              <div className="doodle-card-soft p-3 flex items-start gap-2 text-[13px] text-[#2D251E]">
                <Wallet size={15} className="text-[#C48E63] mt-0.5 shrink-0" />
                <span>{spot.priceHint}</span>
              </div>
            )}
          </div>
        )}

        {spot.highlights?.length > 0 && (
          <div>
            <SectionTitle>必點／亮點</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {spot.highlights.map((h) => (
                <span key={h} className="rounded-full bg-[#F6DDB8] text-[#7A4A1C] text-[12.5px] font-black px-2.5 py-1">
                  ⭐ {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {spot.summary && (
          <div>
            <SectionTitle>為什麼想去</SectionTitle>
            <p className="text-[14px] leading-relaxed text-[#2D251E]">{spot.summary}</p>
          </div>
        )}

        {spot.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {spot.tags.map((t) => (
              <span key={t} className="rounded-full bg-[#EFECE4] text-[#5C5044] text-[12px] font-bold px-2.5 py-1">
                {tagLabel(t)}
              </span>
            ))}
          </div>
        )}

        {spot.source && (spot.source.url || spot.source.author || spot.source.caption) && platform && (
          <details className="doodle-card-soft p-3">
            <summary className="text-[13px] font-black text-[#5C5044] cursor-pointer">
              {PLATFORM_LABEL[platform].emoji} 來源：{PLATFORM_LABEL[platform].label}
              {spot.source.author ? `・@${spot.source.author}` : ''}
            </summary>
            {spot.source.caption && <p className="mt-2 text-[12.5px] text-[#5C5044] whitespace-pre-wrap leading-relaxed">{spot.source.caption}</p>}
          </details>
        )}

        {typeof spot.lat === 'number' && typeof spot.lng === 'number' && (
          <MapView spots={[spot]} className="h-44" focus={{ lat: spot.lat, lng: spot.lng, zoom: 15 }} />
        )}

        {/* 個人狀態 */}
        <div className="doodle-card p-4 flex flex-col gap-3">
          <SectionTitle>我的狀態</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['none', '🆕 未標記'],
                ['want', '📌 想去'],
                ['visited', '✅ 已踩點'],
              ] as Array<[MarkStatus, string]>
            ).map(([st, label]) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatus(st)}
                className={`rounded-xl py-2 text-[13px] font-black border ${
                  draft.status === st
                    ? st === 'visited'
                      ? 'bg-[#DCE5D2] border-[#C9D6BE] text-[#3F5A3A]'
                      : st === 'want'
                        ? 'bg-[#F2CA62] border-[#E6BC52] text-[#3F2E0C]'
                        : 'bg-[#2D251E] border-[#2D251E] text-[#FAF8F3]'
                    : 'bg-[#FAF8F3] border-[#DDD7C9] text-[#5C5044]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {draft.status === 'visited' && (
            <>
              <div>
                <label className="label-cream">回訪等級</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(REVISIT_META) as RevisitLevel[]).map((lv) => {
                    const meta = REVISIT_META[lv];
                    const active = draft.revisit === lv;
                    return (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => update({ revisit: active ? undefined : lv })}
                        className="rounded-xl py-2 text-[12.5px] font-black border"
                        style={active ? { background: meta.bg, color: meta.fg, borderColor: meta.bg } : { background: '#FAF8F3', color: '#5C5044', borderColor: '#DDD7C9' }}
                      >
                        {meta.emoji} {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="label-cream">踩點日期</label>
                <input type="date" value={draft.visitedAt} onChange={(e) => update({ visitedAt: e.target.value })} className="input-cream py-2" />
              </div>
            </>
          )}

          <div>
            <label className="label-cream">我的筆記（必點／避雷／下次想試）</label>
            <textarea value={draft.note} onChange={(e) => update({ note: e.target.value })} className="input-cream min-h-[72px]" placeholder="例如：肉桂捲要早點去不然會賣完；二樓靠窗位最好拍" />
          </div>

          <div className="flex items-center gap-3">
            {draft.photoThumb && <img src={draft.photoThumb} alt="" className="w-20 h-20 rounded-xl object-cover border border-[#DDD7C9]" />}
            <label className="doodle-btn inline-flex items-center gap-1.5 bg-[#EFECE4] text-[#5C5044] font-black py-2.5 px-3 text-[13px] cursor-pointer">
              {imgBusy ? <Loader2 size={15} className="spin-slow" /> : <Camera size={15} />} {draft.photoThumb ? '更換實拍照' : '加一張自己的實拍照'}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void handlePhoto(e.target.files?.[0] || null)} />
            </label>
            {draft.photoThumb && (
              <button type="button" onClick={() => update({ photoThumb: undefined, photoHiRes: undefined })} className="text-[12px] font-bold text-[#8A7E70] underline underline-offset-2">
                移除
              </button>
            )}
          </div>

          {dirty && (
            <button type="button" onClick={save} className="doodle-btn bg-[#F2CA62] text-[#3F2E0C] font-black py-2.5">
              💾 儲存我的狀態
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pb-2">
          <button type="button" onClick={() => onEdit(spot)} className="pill pill-idle">
            <Pencil size={13} /> 編輯店卡
          </button>
          <button type="button" onClick={() => onShare(spot)} className="pill pill-idle">
            <Share2 size={13} /> 分享這家
          </button>
          <button type="button" onClick={() => onHideOrDelete(spot)} className="pill pill-idle text-[#8A4A40]">
            {spot.origin === 'curated' ? (
              <>
                <EyeOff size={13} /> 隱藏範例卡
              </>
            ) : (
              <>
                <Trash2 size={13} /> 刪除店卡
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
