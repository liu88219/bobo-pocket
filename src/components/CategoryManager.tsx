import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Check } from 'lucide-react';
import { CategoryDef } from '../types/pocket';
import { EMOJI_CHOICES, CATEGORY_PALETTE, makeCategoryId, DEFAULT_CATEGORIES } from '../data/categories';
import { SectionTitle } from './ui';

export const EmojiPicker: React.FC<{ value: string; onPick: (emoji: string) => void }> = ({ value, onPick }) => {
  const [custom, setCustom] = useState('');
  return (
    <div className="doodle-card-soft p-2.5 fade-in">
      <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 max-h-48 overflow-y-auto no-scrollbar">
        {EMOJI_CHOICES.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className={`h-9 rounded-xl text-[20px] flex items-center justify-center ${value === e ? 'bg-[#F2CA62] ring-2 ring-[#E6BC52]' : 'bg-[#FAF8F3] hover:bg-[#F4F1EA]'}`}
            aria-label={e}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="input-cream py-1.5 text-[14px]"
          placeholder="或貼上任何 emoji 🫶"
        />
        <button
          type="button"
          onClick={() => {
            const first = Array.from(custom.trim())[0];
            if (first) onPick(custom.trim().slice(0, 4));
          }}
          className="doodle-btn bg-[#EFECE4] text-[#5C5044] font-black px-3 text-[12.5px]"
        >
          使用
        </button>
      </div>
    </div>
  );
};

export const CategoryManager: React.FC<{
  categories: CategoryDef[];
  usageCount: (id: string) => number;
  onChange: (next: CategoryDef[]) => void;
  onDelete: (id: string) => void;
  onToast: (msg: string) => void;
}> = ({ categories, usageCount, onChange, onDelete, onToast }) => {
  const [editingEmojiFor, setEditingEmojiFor] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newEmoji, setNewEmoji] = useState('🍽️');
  const [showNewPicker, setShowNewPicker] = useState(false);

  const update = (id: string, patch: Partial<CategoryDef>) => onChange(categories.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= categories.length) return;
    const next = [...categories];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const add = () => {
    const label = newLabel.trim();
    if (!label) {
      onToast('先輸入分類名稱');
      return;
    }
    if (categories.some((c) => c.label === label)) {
      onToast('已經有同名分類囉');
      return;
    }
    const palette = CATEGORY_PALETTE[categories.length % CATEGORY_PALETTE.length];
    onChange([...categories, { id: makeCategoryId(label, categories), label, emoji: newEmoji || '🍽️', bg: palette.bg, fg: palette.fg }]);
    setNewLabel('');
    setShowNewPicker(false);
    onToast(`✨ 已新增分類「${newEmoji} ${label}」`);
  };

  return (
    <section className="doodle-card p-4 flex flex-col gap-3">
      <SectionTitle
        right={
          <button
            type="button"
            onClick={() => {
              if (window.confirm('恢復成預設 16 個分類？（妳自訂的分類會被移除，店卡不會刪除）')) onChange(DEFAULT_CATEGORIES);
            }}
            className="text-[11.5px] font-bold text-[#8A7E70] underline underline-offset-2"
          >
            恢復預設
          </button>
        }
      >
        🏷️ 主分類管理（改名・換 emoji・換色・排序）
      </SectionTitle>
      <div className="flex flex-col gap-2">
        {categories.map((c, idx) => (
          <div key={c.id} className="doodle-card-soft p-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setEditingEmojiFor(editingEmojiFor === c.id ? null : c.id)} className="w-10 h-10 rounded-xl text-[22px] flex items-center justify-center border border-[#DDD7C9]" style={{ background: c.bg }} aria-label="更換 emoji">
                {c.emoji}
              </button>
              <input value={c.label} onChange={(e) => update(c.id, { label: e.target.value })} className="input-cream py-1.5 text-[14px] flex-1" />
              <span className="text-[11px] font-bold text-[#8A7E70] whitespace-nowrap">{usageCount(c.id)} 張</span>
              <div className="flex flex-col">
                <button type="button" onClick={() => move(idx, -1)} className="text-[#8A7E70] disabled:opacity-30" disabled={idx === 0} aria-label="上移">
                  <ArrowUp size={14} />
                </button>
                <button type="button" onClick={() => move(idx, 1)} className="text-[#8A7E70] disabled:opacity-30" disabled={idx === categories.length - 1} aria-label="下移">
                  <ArrowDown size={14} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (categories.length <= 1) {
                    onToast('至少保留一個分類');
                    return;
                  }
                  const n = usageCount(c.id);
                  if (window.confirm(n > 0 ? `刪除「${c.label}」？其 ${n} 張店卡會改到第一個分類。` : `刪除分類「${c.label}」？`)) onDelete(c.id);
                }}
                className="text-[#8A4A40]"
                aria-label="刪除"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {editingEmojiFor === c.id && (
              <>
                <EmojiPicker
                  value={c.emoji}
                  onPick={(e) => {
                    update(c.id, { emoji: e });
                    setEditingEmojiFor(null);
                  }}
                />
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11.5px] font-bold text-[#8A7E70]">底色：</span>
                  {CATEGORY_PALETTE.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => update(c.id, { bg: p.bg, fg: p.fg })}
                      className="w-7 h-7 rounded-full border-2 flex items-center justify-center"
                      style={{ background: p.bg, borderColor: c.bg === p.bg ? p.fg : '#DDD7C9', color: p.fg }}
                      aria-label={p.name}
                      title={p.name}
                    >
                      {c.bg === p.bg && <Check size={13} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="doodle-card-soft p-2.5 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowNewPicker((v) => !v)} className="w-10 h-10 rounded-xl text-[22px] flex items-center justify-center border border-[#DDD7C9] bg-[#FAF8F3]" aria-label="選 emoji">
            {newEmoji}
          </button>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="input-cream py-1.5 text-[14px] flex-1" placeholder="新增分類，例如：早午餐、手搖飲、露營" onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button type="button" onClick={add} className="doodle-btn bg-[#F2CA62] text-[#3F2E0C] font-black px-3 py-2 text-[13px] inline-flex items-center gap-1">
            <Plus size={14} /> 新增
          </button>
        </div>
        {showNewPicker && (
          <EmojiPicker
            value={newEmoji}
            onPick={(e) => {
              setNewEmoji(e);
              setShowNewPicker(false);
            }}
          />
        )}
      </div>
    </section>
  );
};
