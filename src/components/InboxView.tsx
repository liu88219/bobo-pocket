import React from 'react';
import { Sparkles, Trash2, ClipboardCopy, ExternalLink } from 'lucide-react';
import { InboxItem } from '../types/pocket';
import { detectPlatform } from '../services/spotParser';
import { PLATFORM_LABEL, formatDateTime, copyToClipboard } from './ui';
import { BoboCupBadge } from './QuokkaBoboArt';

export function inboxToText(items: InboxItem[]): string {
  const lines = items.map((it, i) => {
    const parts = [`${i + 1}. ${it.url || '(無連結)'}`];
    if (it.text) parts.push(`   文案：${it.text.replace(/\s+/g, ' ').slice(0, 300)}`);
    if (it.screenshotThumb) parts.push('   （附截圖）');
    return parts.join('\n');
  });
  return `🤎 BoboPocket 收件匣（${items.length} 筆）— 請 Bobo 管家幫我整理成店卡：\n${lines.join('\n')}`;
}

export const InboxView: React.FC<{
  items: InboxItem[];
  onParse: (item: InboxItem) => void;
  onDelete: (item: InboxItem) => void;
  onToast: (msg: string) => void;
  onOpenQuickAdd: () => void;
}> = ({ items, onParse, onDelete, onToast, onOpenQuickAdd }) => {
  if (items.length === 0) {
    return (
      <div className="doodle-card p-6 flex flex-col items-center text-center gap-3">
        <BoboCupBadge className="w-24 h-24" />
        <h3 className="text-[16px] font-black">收件匣是空的 ☕</h3>
        <p className="text-[13px] text-[#5C5044] leading-relaxed">
          滑到喜歡的店先丟進來，有空再按「解析成店卡」；
          <br />
          或一鍵複製清單貼給 Bobo 管家，幫妳查證地址、捷運站後一次建檔。
        </p>
        <button type="button" onClick={onOpenQuickAdd} className="doodle-btn bg-[#F2CA62] text-[#3F2E0C] font-black px-5 py-2.5 text-[14px]">
          ✨ 收錄第一筆
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-[#8A7E70]">{items.length} 筆待整理</p>
        <button
          type="button"
          onClick={async () => {
            const ok = await copyToClipboard(inboxToText(items));
            onToast(ok ? '📋 已複製收件匣清單，貼給 Bobo 管家即可一次建檔' : '複製失敗，請手動選取');
          }}
          className="pill pill-idle"
        >
          <ClipboardCopy size={13} /> 複製清單給管家
        </button>
      </div>
      {items.map((it) => {
        const platform = detectPlatform(it.url);
        return (
          <div key={it.id} className="doodle-card p-3.5 flex gap-3">
            {it.screenshotThumb ? (
              <img src={it.screenshotThumb} alt="" className="w-20 h-20 rounded-xl object-cover border border-[#DDD7C9] shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-[#EFECE4] flex items-center justify-center text-2xl shrink-0">{PLATFORM_LABEL[platform].emoji}</div>
            )}
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <p className="text-[11.5px] font-black text-[#8A7E70]">
                {PLATFORM_LABEL[platform].emoji} {PLATFORM_LABEL[platform].label}・{formatDateTime(it.createdAt)}
              </p>
              {it.url && (
                <a href={it.url} target="_blank" rel="noreferrer" className="text-[12.5px] text-[#1E3158] font-bold underline underline-offset-2 truncate inline-flex items-center gap-1">
                  <ExternalLink size={12} /> {it.url.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              )}
              {it.text && <p className="text-[13px] text-[#2D251E] line-clamp-2 leading-snug">{it.text}</p>}
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => onParse(it)} className="pill pill-butter">
                  <Sparkles size={13} /> 解析成店卡
                </button>
                <button type="button" onClick={() => onDelete(it)} className="pill pill-idle text-[#8A4A40]">
                  <Trash2 size={13} /> 刪除
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
