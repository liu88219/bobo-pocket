import React, { useEffect, useState } from 'react';
import { Dices } from 'lucide-react';
import { ResolvedSpot } from '../types/pocket';
import { CATEGORY_MAP } from '../data/categories';
import { Modal } from './ui';
import { DuoStage } from './QuokkaBoboArt';

export const RandomPickerModal: React.FC<{
  open: boolean;
  candidates: ResolvedSpot[];
  scopeLabel: string;
  onClose: () => void;
  onOpenSpot: (spot: ResolvedSpot) => void;
}> = ({ open, candidates, scopeLabel, onClose, onOpenSpot }) => {
  const [rolling, setRolling] = useState(false);
  const [current, setCurrent] = useState<ResolvedSpot | null>(null);
  const [result, setResult] = useState<ResolvedSpot | null>(null);

  useEffect(() => {
    if (!open) {
      setRolling(false);
      setCurrent(null);
      setResult(null);
    }
  }, [open]);

  const roll = () => {
    if (candidates.length === 0) return;
    setRolling(true);
    setResult(null);
    let ticks = 0;
    const total = 18 + Math.floor(Math.random() * 8);
    const step = () => {
      ticks++;
      setCurrent(candidates[Math.floor(Math.random() * candidates.length)]);
      if (ticks < total) {
        setTimeout(step, 60 + ticks * 14);
      } else {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        setCurrent(picked);
        setResult(picked);
        setRolling(false);
      }
    };
    step();
  };

  const shown = result || current;

  return (
    <Modal open={open} onClose={onClose} title="🎲 今天去哪裡？" subtitle={`從「${scopeLabel}」共 ${candidates.length} 家裡抽一家`}>
      <div className="flex flex-col items-center gap-4 py-2">
        <DuoStage className="w-full max-w-[300px] h-auto" cheer={Boolean(result)} />
        <div className="doodle-card w-full p-5 text-center min-h-[120px] flex flex-col items-center justify-center gap-1">
          {shown ? (
            <>
              <span className="text-[13px] font-black text-[#8A7E70]">
                {CATEGORY_MAP[shown.category].emoji} {CATEGORY_MAP[shown.category].label}・{shown.city}
                {shown.district ? ` ${shown.district}` : ''}
              </span>
              <span className={`text-[20px] font-black text-[#2D251E] ${rolling ? 'opacity-70' : ''}`}>{shown.name}</span>
              {!rolling && shown.mrt && <span className="text-[12.5px] font-bold text-[#1E3158]">🚇 {shown.mrt}</span>}
            </>
          ) : candidates.length === 0 ? (
            <span className="text-[14px] font-bold text-[#8A7E70]">目前篩選條件下沒有店卡，換個條件再抽～</span>
          ) : (
            <span className="text-[14px] font-bold text-[#8A7E70]">按下去讓 Quokka 幫妳決定！</span>
          )}
        </div>
        <div className="flex gap-2 w-full">
          <button type="button" onClick={roll} disabled={rolling || candidates.length === 0} className="doodle-btn flex-1 bg-[#F2CA62] text-[#3F2E0C] font-black py-3 inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Dices size={18} /> {result ? '再抽一次' : '抽一家！'}
          </button>
          {result && (
            <button type="button" onClick={() => onOpenSpot(result)} className="doodle-btn flex-1 bg-[#2D251E] text-[#FAF8F3] font-black py-3">
              就去這家 →
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
