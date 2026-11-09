import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Inbox, Link2, ImagePlus, ScanText, Loader2, Film, ClipboardPaste } from 'lucide-react';
import { InboxItem } from '../types/pocket';
import { fetchLinkPreview, LinkPreview } from '../services/linkPreview';
import { parseSpotDraft, extractFirstUrl, ParsedDraft } from '../services/spotParser';
import { processImageFile, recognizeTextFromImage, extractVideoFrames } from '../services/imageTools';
import { Modal, PLATFORM_LABEL } from './ui';
import { SpotFormDraft, emptyDraft } from './SpotFormModal';
import { QuokkaMapBadge } from './QuokkaBoboArt';

export interface QuickAddResult {
  draft: SpotFormDraft;
  parsed: ParsedDraft;
  /** 若來自收件匣，建檔後要刪掉的項目 */
  fromInboxId?: string;
}

export interface QuickAddPrefill {
  url?: string;
  text?: string;
  screenshotThumb?: string;
  inboxId?: string;
}

export const QuickAddModal: React.FC<{
  open: boolean;
  prefill?: QuickAddPrefill | null;
  onClose: () => void;
  onParsed: (result: QuickAddResult) => void;
  onSaveInbox: (item: Omit<InboxItem, 'createdAt' | 'updatedAt'> & { hiRes?: string }) => void;
  onToast: (msg: string) => void;
}> = ({ open, prefill, onClose, onParsed, onSaveInbox, onToast }) => {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [shot, setShot] = useState<{ thumb: string; hiRes?: string } | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrBusy, setOcrBusy] = useState('');
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [frames, setFrames] = useState<string[]>([]);
  const lastPreviewUrl = useRef('');

  useEffect(() => {
    if (!open) return;
    setUrl(prefill?.url || '');
    setText(prefill?.text || '');
    setShot(prefill?.screenshotThumb ? { thumb: prefill.screenshotThumb } : null);
    setOcrText('');
    setOcrBusy('');
    setPreview(null);
    setFrames([]);
    lastPreviewUrl.current = '';
  }, [open, prefill]);

  // 文字欄位若含網址，自動拆出到網址欄
  useEffect(() => {
    if (!url && text) {
      const found = extractFirstUrl(text);
      if (found) setUrl(found);
    }
  }, [text, url]);

  // 自動抓取連結預覽（去抖動）
  useEffect(() => {
    const clean = url.trim();
    if (!open || !/^https?:\/\//i.test(clean) || clean === lastPreviewUrl.current) return;
    const timer = window.setTimeout(async () => {
      lastPreviewUrl.current = clean;
      setPreviewBusy(true);
      try {
        const p = await fetchLinkPreview(clean);
        setPreview(p);
        if (p.imageDataUrl && !shot) setShot({ thumb: p.imageDataUrl });
      } finally {
        setPreviewBusy(false);
      }
    }, 650);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, open]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.type.startsWith('video/')) {
      setOcrBusy('擷取短片畫格中…');
      try {
        const fr = await extractVideoFrames(file, 3);
        if (fr.length === 0) {
          onToast('無法讀取這支影片，改用截圖試試 📸');
        } else {
          setFrames(fr);
          setShot({ thumb: fr[Math.min(1, fr.length - 1)] });
          onToast('已擷取 3 張畫格，可點選一張當封面，再按「辨識截圖文字」');
        }
      } finally {
        setOcrBusy('');
      }
      return;
    }
    try {
      const img = await processImageFile(file);
      setShot({ thumb: img.thumb, hiRes: img.hiRes });
      setFrames([]);
    } catch (err) {
      onToast(err instanceof Error ? err.message : '圖片處理失敗');
    }
  };

  const handleOcr = async () => {
    if (!shot) return;
    setOcrBusy('準備辨識…');
    try {
      const t = await recognizeTextFromImage(shot.hiRes || shot.thumb, (m) => setOcrBusy(m));
      if (!t) onToast('沒辨識到文字，可能是純畫面截圖；直接貼文案也可以');
      setOcrText(t);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'OCR 失敗');
    } finally {
      setOcrBusy('');
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const clip = (await navigator.clipboard.readText()).trim();
      if (!clip) {
        onToast('剪貼簿是空的');
        return;
      }
      const found = extractFirstUrl(clip);
      if (found && !url) setUrl(found);
      const remaining = found ? clip.replace(found, '').trim() : clip;
      if (remaining) setText((prev) => (prev ? `${prev}\n${remaining}` : remaining));
      onToast('📋 已貼上剪貼簿內容');
    } catch {
      onToast('無法讀取剪貼簿，請長按輸入框手動貼上');
    }
  };

  const runParse = () => {
    const parsed = parseSpotDraft({
      url: url.trim() || undefined,
      text: text.trim() || undefined,
      ocrText: ocrText || undefined,
      previewTitle: preview?.title,
      previewDescription: preview?.description,
      previewAuthor: preview?.author,
      previewName: preview?.placeName,
      previewAddress: preview?.address,
      previewLat: preview?.lat,
      previewLng: preview?.lng,
    });
    const draft: SpotFormDraft = {
      ...emptyDraft(),
      name: parsed.name,
      category: parsed.category,
      city: parsed.city,
      district: parsed.district || '',
      mrt: parsed.mrt || '',
      zone: parsed.zone || '',
      address: parsed.address || '',
      lat: parsed.lat,
      lng: parsed.lng,
      hours: parsed.hours || '',
      priceHint: parsed.priceHint || '',
      tags: parsed.tags,
      highlightsText: parsed.highlights.join('、'),
      summary: parsed.summary,
      sourceUrl: url.trim(),
      sourceAuthor: parsed.author || '',
      caption: parsed.caption,
      coverThumb: shot?.thumb,
      coverHiRes: shot?.hiRes,
    };
    onParsed({ draft, parsed, fromInboxId: prefill?.inboxId });
  };

  const saveToInbox = () => {
    if (!url.trim() && !text.trim() && !shot) {
      onToast('先貼個連結、文案或截圖吧～');
      return;
    }
    onSaveInbox({
      id: prefill?.inboxId || `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: url.trim() || undefined,
      text: text.trim() || undefined,
      screenshotThumb: shot?.thumb,
      hasLocalHiResPhoto: Boolean(shot?.hiRes),
      hiRes: shot?.hiRes,
    });
  };

  const hasAnything = Boolean(url.trim() || text.trim() || shot || ocrText);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="✨ 快速收錄"
      subtitle="貼上 IG／Threads 連結＋文案或截圖，Bobo 會自動整理成店卡"
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={saveToInbox} className="doodle-btn flex-1 bg-[#EFECE4] text-[#5C5044] font-black py-3 inline-flex items-center justify-center gap-1.5">
            <Inbox size={16} /> 先丟收件匣
          </button>
          <button
            type="button"
            disabled={!hasAnything}
            onClick={runParse}
            className="doodle-btn flex-[1.6] bg-[#F2CA62] text-[#3F2E0C] font-black py-3 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles size={16} /> 解析成店卡
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 doodle-card-soft p-3">
          <QuokkaMapBadge className="w-14 h-14 shrink-0" />
          <p className="text-[12.5px] text-[#5C5044] leading-snug">
            IG 常擋登入牆，<b>順手「複製貼文文字」或截一張有店名的畫面</b>貼進來最準；Threads 多半可直接抓到。<b>Google Maps／Apple 地圖「分享」</b>的連結＋文字也可以直接貼！
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label-cream !mb-0">連結（IG／Threads／Google Maps／Apple 地圖）</label>
            <button type="button" onClick={() => void pasteFromClipboard()} className="pill pill-butter !py-1">
              <ClipboardPaste size={13} /> 貼上剪貼簿
            </button>
          </div>
          <div className="relative">
            <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A79C8E]" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input-cream pl-10"
              placeholder="https://www.instagram.com/reel/…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
            />
            {previewBusy && <Loader2 size={16} className="spin-slow absolute right-3.5 top-1/2 -translate-y-1/2 text-[#C48E63]" />}
          </div>
          {preview && (preview.title || preview.description) && (
            <div className="mt-2 doodle-card-soft p-2.5 flex gap-2.5">
              {preview.imageDataUrl && <img src={preview.imageDataUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />}
              <div className="min-w-0">
                <p className="text-[11px] font-black text-[#8A7E70]">
                  {PLATFORM_LABEL[preview.platform].emoji} {PLATFORM_LABEL[preview.platform].label} 預覽{preview.author ? `・@${preview.author}` : ''}
                </p>
                <p className="text-[12.5px] font-bold text-[#2D251E] line-clamp-1">{preview.title}</p>
                <p className="text-[12px] text-[#5C5044] line-clamp-2">{preview.description}</p>
              </div>
            </div>
          )}
          {preview && (preview.platform === 'googlemaps' || preview.platform === 'applemaps') && typeof preview.lat === 'number' && (
            <p className="text-[11.5px] text-[#3F5A3A] font-bold mt-1.5">📍 已從地圖連結取得座標 {preview.lat.toFixed(4)}, {preview.lng?.toFixed(4)}</p>
          )}
          {!previewBusy && preview && !preview.title && !preview.description && url && (
            <p className="text-[11.5px] text-[#8A7E70] mt-1.5">
              {preview.platform === 'googlemaps'
                ? '短網址抓不到座標也沒關係：Google Maps 分享文字裡的店名＋地址會自動解析，再按「定位」即可'
                : '抓不到公開預覽（可能被登入牆擋住）— 貼文案或上傳截圖一樣能解析 👇'}
            </p>
          )}
        </div>

        <div>
          <label className="label-cream">貼文文案／自己的備註</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input-cream min-h-[110px]"
            placeholder={'例如：\n中山站巷弄裡的日式老宅咖啡廳☕️ 不限時有插座\n必點肉桂捲和燕麥拿鐵\n📍台北市中山區赤峰街xx號'}
          />
        </div>

        <div>
          <label className="label-cream">截圖／短片畫面（選填）</label>
          <div className="flex gap-2 items-start">
            <label className="doodle-btn inline-flex items-center gap-1.5 bg-[#EFECE4] text-[#5C5044] font-black py-2.5 px-3 text-[13px] cursor-pointer">
              <ImagePlus size={15} /> 截圖
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0] || null)} />
            </label>
            <label className="doodle-btn inline-flex items-center gap-1.5 bg-[#EFECE4] text-[#5C5044] font-black py-2.5 px-3 text-[13px] cursor-pointer">
              <Film size={15} /> 短片檔
              <input type="file" accept="video/*" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0] || null)} />
            </label>
            {shot && (
              <button type="button" onClick={() => void handleOcr()} disabled={Boolean(ocrBusy)} className="doodle-btn inline-flex items-center gap-1.5 bg-[#1E3158] text-white font-black py-2.5 px-3 text-[13px] disabled:opacity-60">
                {ocrBusy ? <Loader2 size={15} className="spin-slow" /> : <ScanText size={15} />} 辨識截圖文字
              </button>
            )}
          </div>
          {ocrBusy && <p className="text-[11.5px] text-[#8A7E70] mt-1.5">{ocrBusy}</p>}
          {frames.length > 0 && (
            <div className="flex gap-2 mt-2">
              {frames.map((f, i) => (
                <button key={i} type="button" onClick={() => setShot({ thumb: f })} className={`rounded-xl overflow-hidden border-2 ${shot?.thumb === f ? 'border-[#F2CA62]' : 'border-transparent'}`}>
                  <img src={f} alt="" className="w-20 h-20 object-cover" />
                </button>
              ))}
            </div>
          )}
          {shot && frames.length === 0 && (
            <div className="mt-2 flex items-start gap-2">
              <img src={shot.thumb} alt="" className="w-24 h-24 rounded-xl object-cover border border-[#DDD7C9]" />
              <button type="button" onClick={() => setShot(null)} className="text-[12px] font-bold text-[#8A7E70] underline underline-offset-2 mt-1">
                移除
              </button>
            </div>
          )}
          {ocrText && (
            <div className="mt-2">
              <label className="label-cream">辨識出的文字（可修正）</label>
              <textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)} className="input-cream min-h-[80px] text-[13px]" />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
