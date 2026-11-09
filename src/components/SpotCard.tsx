import React from 'react';
import { MapPin, TrainFront, Bookmark, CheckCircle2 } from 'lucide-react';
import { ResolvedSpot } from '../types/pocket';
import { REVISIT_META, tagLabel } from '../data/categories';
import { PLATFORM_LABEL } from './ui';
import { useCategories } from './CategoryContext';

export const CategoryPill: React.FC<{ category: ResolvedSpot['category']; small?: boolean }> = ({ category, small = false }) => {
  const meta = useCategories().meta(category);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-black ${small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'}`}
      style={{ background: meta.bg, color: meta.fg }}
    >
      {meta.emoji} {meta.label}
    </span>
  );
};

export const CoverArea: React.FC<{ spot: ResolvedSpot; className?: string }> = ({ spot, className = 'h-36' }) => {
  const meta = useCategories().meta(spot.category);
  const photo = spot.coverThumb || spot.mark?.photoThumb;
  if (photo) {
    return (
      <div className={`relative w-full ${className} overflow-hidden bg-[#DEDCD3]`}>
        <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
      </div>
    );
  }
  return (
    <div
      className={`relative w-full ${className} flex items-center justify-center`}
      style={{ background: `linear-gradient(135deg, ${meta.bg} 0%, #EFECE4 100%)` }}
    >
      <span className="text-[44px] drop-shadow-sm select-none">{meta.emoji}</span>
    </div>
  );
};

export const SpotCard: React.FC<{
  spot: ResolvedSpot;
  onOpen: (spot: ResolvedSpot) => void;
  onToggleWant: (spot: ResolvedSpot) => void;
  onToggleVisited: (spot: ResolvedSpot) => void;
  distanceLabel?: string;
}> = ({ spot, onOpen, onToggleWant, onToggleVisited, distanceLabel }) => {
  const status = spot.mark?.status || 'none';
  const revisit = spot.mark?.revisit;
  const platform = spot.source?.platform;
  return (
    <article className="doodle-card overflow-hidden flex flex-col cursor-pointer active:scale-[0.99] transition-transform" onClick={() => onOpen(spot)}>
      <div className="relative">
        <CoverArea spot={spot} />
        <div className="absolute top-2 left-2 flex gap-1.5">
          <CategoryPill category={spot.category} small />
          {spot.isSeed && !spot.hidden && (
            <span className="rounded-full bg-[#FAF8F3]/90 text-[#8A7E70] text-[10.5px] font-bold px-2 py-0.5 border border-[#DDD7C9]">範例卡</span>
          )}
        </div>
        {platform && platform !== 'manual' && (
          <span className="absolute top-2 right-2 rounded-full bg-[#FAF8F3]/90 text-[11px] font-bold px-2 py-0.5 border border-[#DDD7C9]">
            {PLATFORM_LABEL[platform].emoji}
          </span>
        )}
        {distanceLabel && (
          <span className="absolute bottom-2 right-2 rounded-full bg-[#DCE5D2]/95 text-[#3F5A3A] text-[11px] font-black px-2 py-0.5 border border-[#C9D6BE]">📍 {distanceLabel}</span>
        )}
        {status !== 'none' && (
          <span
            className={`absolute bottom-2 left-2 rounded-full text-[11px] font-black px-2 py-0.5 border ${
              status === 'visited' ? 'bg-[#DCE5D2] text-[#3F5A3A] border-[#C9D6BE]' : 'bg-[#F2CA62] text-[#3F2E0C] border-[#E6BC52]'
            }`}
          >
            {status === 'visited' ? '✅ 已踩點' : '📌 想去'}
            {status === 'visited' && revisit ? ` ${REVISIT_META[revisit].emoji}` : ''}
          </span>
        )}
      </div>
      <div className="px-3.5 pt-3 pb-3 flex-1 flex flex-col gap-1.5">
        <h3 className="text-[15px] font-black leading-snug text-[#2D251E] line-clamp-2">{spot.name}</h3>
        <div className="flex items-center gap-1 text-[12px] text-[#5C5044] font-bold flex-wrap">
          <MapPin size={13} className="text-[#C48E63]" />
          <span>
            {spot.city}
            {spot.district ? `・${spot.district}` : ''}
          </span>
          {spot.mrt && (
            <>
              <TrainFront size={13} className="text-[#1E3158] ml-1" />
              <span>{spot.mrt}</span>
            </>
          )}
        </div>
        {(spot.highlights?.length > 0 || spot.summary) && (
          <p className="text-[12px] text-[#8A7E70] leading-snug line-clamp-2">
            {spot.highlights?.length > 0 ? `必點：${spot.highlights.slice(0, 3).join('、')}` : spot.summary}
          </p>
        )}
        {spot.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {spot.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-[#EFECE4] text-[#5C5044] text-[10.5px] font-bold px-2 py-0.5">
                {tagLabel(t)}
              </span>
            ))}
            {spot.tags.length > 3 && <span className="text-[10.5px] text-[#A79C8E] font-bold px-1">+{spot.tags.length - 3}</span>}
          </div>
        )}
        <div className="mt-auto pt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onToggleWant(spot)}
            className={`flex-1 inline-flex items-center justify-center gap-1 rounded-xl py-1.5 text-[12px] font-black border ${
              status === 'want' ? 'bg-[#F2CA62] border-[#E6BC52] text-[#3F2E0C]' : 'bg-[#FAF8F3] border-[#DDD7C9] text-[#5C5044]'
            }`}
          >
            <Bookmark size={14} /> 想去
          </button>
          <button
            type="button"
            onClick={() => onToggleVisited(spot)}
            className={`flex-1 inline-flex items-center justify-center gap-1 rounded-xl py-1.5 text-[12px] font-black border ${
              status === 'visited' ? 'bg-[#DCE5D2] border-[#C9D6BE] text-[#3F5A3A]' : 'bg-[#FAF8F3] border-[#DDD7C9] text-[#5C5044]'
            }`}
          >
            <CheckCircle2 size={14} /> 已踩點
          </button>
        </div>
      </div>
    </article>
  );
};
