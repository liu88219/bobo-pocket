import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { SourcePlatform } from '../types/pocket';

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ open, onClose, title, subtitle, children, footer, wide = false }) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2D251E]/35 backdrop-blur-[2px] fade-in" onClick={onClose}>
      <div
        className={`sheet-enter w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[94vh] sm:max-h-[90vh] flex flex-col bg-[#FAF8F3] rounded-t-[1.8rem] sm:rounded-[1.8rem] border border-[#DDD7C9] shadow-pop overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#E7E1D4]">
            <div className="min-w-0">
              {title && <h2 className="text-[17px] font-black text-[#2D251E] leading-tight">{title}</h2>}
              {subtitle && <p className="text-[12.5px] text-[#8A7E70] mt-0.5 leading-snug">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-full bg-[#EFECE4] text-[#5C5044] flex items-center justify-center hover:bg-[#E7E1D4]"
              aria-label="關閉"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
        {footer && <div className="px-5 py-3 border-t border-[#E7E1D4] bg-[#FAF8F3]">{footer}</div>}
      </div>
    </div>
  );
};

export const Toast: React.FC<{ message: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-[60] max-w-[92vw] fade-in">
      <div className="rounded-2xl bg-[#2D251E] text-[#FAF8F3] text-[13.5px] font-bold px-4 py-3 shadow-pop">{message}</div>
    </div>
  );
};

export const Chip: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  tone?: 'idle' | 'butter';
  className?: string;
}> = ({ active = false, onClick, children, tone = 'idle', className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`pill ${active ? (tone === 'butter' ? 'pill-butter' : 'pill-active') : 'pill-idle'} ${className}`}
  >
    {children}
  </button>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-[13px] font-black tracking-wide text-[#8A7E70]">{children}</h3>
    {right}
  </div>
);

export const PLATFORM_LABEL: Record<SourcePlatform, { label: string; emoji: string }> = {
  instagram: { label: 'Instagram', emoji: '📸' },
  threads: { label: 'Threads', emoji: '🧵' },
  tiktok: { label: 'TikTok', emoji: '🎵' },
  youtube: { label: 'YouTube', emoji: '▶️' },
  facebook: { label: 'Facebook', emoji: '📘' },
  googlemaps: { label: 'Google Maps', emoji: '🗺️' },
  applemaps: { label: 'Apple 地圖', emoji: '🍎' },
  web: { label: '網頁', emoji: '🔗' },
  manual: { label: '手動建立', emoji: '✍️' },
};

export function formatDateTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}/${mm}/${dd} ${hh}:${mi}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
