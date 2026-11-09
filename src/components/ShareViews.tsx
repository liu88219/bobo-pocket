import React, { useEffect, useState } from 'react';
import { Share2, Copy, Loader2, Navigation, ExternalLink } from 'lucide-react';
import { ResolvedSpot, Spot } from '../types/pocket';
import { CATEGORY_MAP, tagLabel } from '../data/categories';
import { buildSharePayload, publishShare, buildShareUrl, fetchShare, SharePayload } from '../services/shareService';
import { buildGoogleMapsUrl } from '../services/spotParser';
import { Modal, copyToClipboard, Chip } from './ui';
import { MapView } from './MapView';
import { HeroBanner } from './QuokkaBoboArt';

export const ShareComposerModal: React.FC<{
  open: boolean;
  spots: ResolvedSpot[];
  preselectedIds: string[];
  nickname: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}> = ({ open, spots, preselectedIds, nickname, onClose, onToast }) => {
  const [selected, setSelected] = useState<string[]>(preselectedIds);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');

  useEffect(() => {
    if (open) {
      setSelected(preselectedIds);
      setTitle('');
      setLink('');
      setBusy(false);
    }
  }, [open, preselectedIds]);

  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const publish = async () => {
    const chosen = spots.filter((s) => selected.includes(s.id));
    if (chosen.length === 0) {
      onToast('先勾選至少一家店卡');
      return;
    }
    setBusy(true);
    try {
      const payload = buildSharePayload(chosen, title.trim() || `${nickname || 'Mona'} 的口袋精選`, nickname || 'Mona');
      const code = await publishShare(payload);
      if (!code) {
        onToast('雲端暫時忙碌，請稍後再試');
        return;
      }
      const url = buildShareUrl(code);
      setLink(url);
      const ok = await copyToClipboard(url);
      onToast(ok ? '🔗 分享連結已複製！' : '🔗 分享連結已產生');
      if (navigator.share) {
        try {
          await navigator.share({ title: payload.title, url });
        } catch {
          // user cancelled
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="🔗 分享精選給朋友挑店"
      subtitle="產生唯讀清單連結（不含妳的私人筆記），丟 LINE 讓朋友選"
      footer={
        <button type="button" onClick={() => void publish()} disabled={busy || selected.length === 0} className="doodle-btn w-full bg-[#F2CA62] text-[#3F2E0C] font-black py-3 inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
          {busy ? <Loader2 size={16} className="spin-slow" /> : <Share2 size={16} />} 產生分享連結（{selected.length} 家）
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-cream" placeholder="清單標題，例如：週六中山站聚餐候選 🍽️" />
        {link && (
          <div className="doodle-card-soft p-3 flex items-center gap-2">
            <span className="text-[12.5px] font-bold text-[#1E3158] truncate flex-1">{link}</span>
            <button type="button" onClick={async () => onToast((await copyToClipboard(link)) ? '已複製' : '複製失敗')} className="pill pill-idle">
              <Copy size={13} /> 複製
            </button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-[#8A7E70]">目前清單（依篩選結果）</span>
          <div className="flex gap-1.5">
            <Chip onClick={() => setSelected(spots.map((s) => s.id))}>全選</Chip>
            <Chip onClick={() => setSelected([])}>清空</Chip>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {spots.map((s) => {
            const on = selected.includes(s.id);
            return (
              <button key={s.id} type="button" onClick={() => toggle(s.id)} className={`doodle-card p-3 text-left flex items-center gap-3 ${on ? 'ring-2 ring-[#F2CA62]' : ''}`}>
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[13px] font-black ${on ? 'bg-[#F2CA62] border-[#E6BC52] text-[#3F2E0C]' : 'border-[#DDD7C9] text-transparent'}`}>✓</span>
                <span className="text-xl">{CATEGORY_MAP[s.category].emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-black truncate">{s.name}</span>
                  <span className="block text-[12px] text-[#8A7E70] font-bold truncate">
                    {s.city}
                    {s.district ? `・${s.district}` : ''}
                    {s.mrt ? `・${s.mrt}` : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

/** 朋友打開 ?share=code 看到的唯讀頁 */
export const ShareView: React.FC<{ code: string; onOpenApp: () => void }> = ({ code, onOpenApp }) => {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    let active = true;
    fetchShare(code).then((p) => {
      if (!active) return;
      setPayload(p);
      setState(p ? 'ok' : 'missing');
    });
    return () => {
      active = false;
    };
  }, [code]);

  const spots: ResolvedSpot[] = (payload?.spots || []).map((s) => ({
    ...(s as Spot),
    tags: s.tags || [],
    highlights: s.highlights || [],
    origin: 'curated',
    createdAt: payload?.createdAt || 0,
    updatedAt: payload?.createdAt || 0,
    hidden: false,
  }));

  return (
    <div className="min-h-screen bg-[#ECE8DF] text-[#2D251E] font-rounded">
      <div className="max-w-xl mx-auto px-4 py-5 flex flex-col gap-4">
        <HeroBanner className="h-32" small />
        {state === 'loading' && <p className="text-center text-[14px] font-bold text-[#8A7E70]">載入精選清單中…</p>}
        {state === 'missing' && (
          <div className="doodle-card p-5 text-center">
            <p className="font-black">找不到這份清單 🥲</p>
            <p className="text-[13px] text-[#8A7E70] mt-1">連結可能不完整，請再向分享者要一次。</p>
          </div>
        )}
        {payload && (
          <>
            <div>
              <h1 className="text-[22px] font-black">{payload.title}</h1>
              <p className="text-[13px] font-bold text-[#8A7E70]">由 {payload.from} 用 BoboPocket 分享・共 {spots.length} 家</p>
            </div>
            {spots.some((s) => typeof s.lat === 'number') && <MapView spots={spots} className="h-64" />}
            <div className="flex flex-col gap-3">
              {spots.map((s) => (
                <div key={s.id} className="doodle-card overflow-hidden">
                  {s.coverThumb && <img src={s.coverThumb} alt="" className="w-full h-44 object-cover" />}
                  <div className="p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-1 text-[12px] font-black" style={{ background: CATEGORY_MAP[s.category].bg, color: CATEGORY_MAP[s.category].fg }}>
                        {CATEGORY_MAP[s.category].emoji} {CATEGORY_MAP[s.category].label}
                      </span>
                      <span className="text-[12.5px] font-bold text-[#8A7E70]">
                        {s.city}
                        {s.district ? `・${s.district}` : ''}
                        {s.mrt ? `・${s.mrt}` : ''}
                      </span>
                    </div>
                    <h2 className="text-[17px] font-black">{s.name}</h2>
                    {s.highlights.length > 0 && <p className="text-[13px] text-[#5C5044]">⭐ {s.highlights.join('、')}</p>}
                    {s.summary && <p className="text-[13px] text-[#2D251E] leading-relaxed">{s.summary}</p>}
                    {s.hours && <p className="text-[12.5px] text-[#8A7E70]">🕒 {s.hours}</p>}
                    {s.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.tags.map((t) => (
                          <span key={t} className="rounded-full bg-[#EFECE4] text-[#5C5044] text-[11px] font-bold px-2 py-0.5">
                            {tagLabel(t)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <a href={buildGoogleMapsUrl(s.name, s.address, s.lat, s.lng)} target="_blank" rel="noreferrer" className="doodle-btn flex-1 bg-[#1E3158] text-white font-black py-2.5 text-[13px] inline-flex items-center justify-center gap-1">
                        <Navigation size={14} /> Google Maps
                      </a>
                      {s.source?.url && (
                        <a href={s.source.url} target="_blank" rel="noreferrer" className="doodle-btn flex-1 bg-[#EFECE4] text-[#2D251E] font-black py-2.5 text-[13px] inline-flex items-center justify-center gap-1">
                          <ExternalLink size={14} /> 原短片
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <button type="button" onClick={onOpenApp} className="doodle-btn bg-[#F2CA62] text-[#3F2E0C] font-black py-3">
          🤎 我也要建立自己的 BoboPocket
        </button>
      </div>
    </div>
  );
};
