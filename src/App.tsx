import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Settings, Cloud, CloudOff, Dices, Share2, Map as MapIcon, Inbox, LayoutGrid } from 'lucide-react';
import {
  VaultState,
  ResolvedSpot,
  InboxItem,
  PersonalMark,
  MarkStatus,
  Spot,
  SpotOverride,
  makeId,
  getLocalDateKey,
} from './types/pocket';
import {
  requestPersistentStorage,
  loadLocalVaultSync,
  loadLocalVaultState,
  saveLocalVaultState,
  loadRememberedPasscodeSync,
  loadRememberedPasscode,
  saveRememberedPasscode,
  syncWithCloudVault,
  subscribeRealtimeRelay,
  mergeVaultStates,
  saveLocalPhoto,
  getLocalPhoto,
  deleteLocalPhoto,
  hydrateSinglePhoto,
} from './services/cloudSync';
import { deriveVaultIdentity } from './services/cryptoVault';
import { resolveAllSpots, applyFilters, sortSpots, SpotFilters, DEFAULT_FILTERS } from './services/spotResolver';
import { CATEGORY_MAP } from './data/categories';
import { Toast } from './components/ui';
import { FilterBar } from './components/FilterBar';
import { SpotCard } from './components/SpotCard';
import { MapView } from './components/MapView';
import { InboxView } from './components/InboxView';
import { QuickAddModal, QuickAddPrefill, QuickAddResult } from './components/QuickAddModal';
import { SpotFormModal, SpotFormDraft, emptyDraft, spotToDraft, draftToSpot } from './components/SpotFormModal';
import { SpotDetailSheet, MarkDraft } from './components/SpotDetailSheet';
import { RandomPickerModal } from './components/RandomPickerModal';
import { ShareComposerModal, ShareView } from './components/ShareViews';
import { SettingsModal } from './components/SettingsModal';
import { HeroBanner, DuoStage, QuokkaMapBadge } from './components/QuokkaBoboArt';

type View = 'pocket' | 'map' | 'inbox';

function readUrlParams(): { share?: string; add?: string; text?: string; view?: View; spot?: string } {
  try {
    const p = new URLSearchParams(window.location.search);
    const rawView = p.get('view');
    const view: View | undefined = rawView === 'map' || rawView === 'inbox' || rawView === 'pocket' ? rawView : undefined;
    return {
      share: p.get('share') || undefined,
      add: p.get('add') || undefined,
      text: p.get('text') || undefined,
      view,
      spot: p.get('spot') || undefined,
    };
  } catch {
    return {};
  }
}

function cleanUrlParams(): void {
  try {
    window.history.replaceState({}, '', `${window.location.pathname}`);
  } catch {
    // ignore
  }
}

export const App: React.FC = () => {
  const [urlParams] = useState(() => readUrlParams());
  const [shareCode, setShareCode] = useState<string | undefined>(urlParams.share);

  const [vault, setVault] = useState<VaultState>(() => loadLocalVaultSync());
  const [passcode, setPasscode] = useState<string>(() => loadRememberedPasscodeSync());
  const [fingerprintBadge, setFingerprintBadge] = useState('');
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [booted, setBooted] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [view, setView] = useState<View>(urlParams.view || 'pocket');
  const [filters, setFilters] = useState<SpotFilters>(DEFAULT_FILTERS);

  const [quickAddOpen, setQuickAddOpen] = useState<boolean>(() => Boolean(urlParams.add || urlParams.text));
  const [quickAddPrefill, setQuickAddPrefill] = useState<QuickAddPrefill | null>(() =>
    urlParams.add || urlParams.text ? { url: urlParams.add, text: urlParams.text } : null
  );
  const [formDraft, setFormDraft] = useState<SpotFormDraft | null>(null);
  const [formFromInbox, setFormFromInbox] = useState<string | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | null>(urlParams.spot || null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [randomOpen, setRandomOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePreselected, setSharePreselected] = useState<string[]>([]);

  const vaultRef = useRef(vault);
  vaultRef.current = vault;
  const passcodeRef = useRef(passcode);
  passcodeRef.current = passcode;
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef<{ pass: string; forcePush: boolean; showToast: boolean } | null>(null);

  const showToast = useCallback((msg: string) => setToastMsg(msg), []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(''), 3200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // ---------- Cloud sync orchestration ----------
  const triggerCloudSync = useCallback(
    async (baseState: VaultState, pass: string, showSuccessToast = false, forcePush = false) => {
      const cleanPass = pass.trim();
      if (!cleanPass) return baseState;
      if (syncInFlightRef.current) {
        pendingSyncRef.current = {
          pass: cleanPass,
          forcePush: Boolean(pendingSyncRef.current?.forcePush || forcePush),
          showToast: Boolean(pendingSyncRef.current?.showToast || showSuccessToast),
        };
        return vaultRef.current;
      }
      syncInFlightRef.current = true;
      setSyncBusy(true);
      let latestMerged = mergeVaultStates(vaultRef.current, baseState);
      try {
        const outcome = await syncWithCloudVault(latestMerged, cleanPass, forcePush);
        if (outcome.fingerprintBadge) setFingerprintBadge(outcome.fingerprintBadge);
        if (outcome.matchedPasscode && outcome.matchedPasscode !== cleanPass) {
          setPasscode(outcome.matchedPasscode);
          passcodeRef.current = outcome.matchedPasscode;
          void saveRememberedPasscode(outcome.matchedPasscode);
        }
        setVault((prev) => {
          const safeMerged = mergeVaultStates(prev, outcome.mergedState);
          latestMerged = safeMerged;
          vaultRef.current = safeMerged;
          void saveLocalVaultState(safeMerged);
          return safeMerged;
        });
        if (outcome.ok) {
          setHasUnsyncedChanges(false);
          if (showSuccessToast) showToast('☁️ Bobo 已同步最新雙雲端保險箱！');
        } else {
          if (forcePush) setHasUnsyncedChanges(true);
          if (showSuccessToast && outcome.errorMessage) showToast(`⚠️ ${outcome.errorMessage}`);
        }
      } finally {
        syncInFlightRef.current = false;
        setSyncBusy(false);
        const next = pendingSyncRef.current;
        if (next) {
          pendingSyncRef.current = null;
          void triggerCloudSync(vaultRef.current, next.pass, next.showToast, next.forcePush);
        }
      }
      return latestMerged;
    },
    [showToast]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      await requestPersistentStorage();
      const [localState, savedPass] = await Promise.all([loadLocalVaultState(), loadRememberedPasscode()]);
      if (!mounted) return;
      let bootState = localState;
      setVault((prev) => {
        bootState = mergeVaultStates(prev, localState);
        vaultRef.current = bootState;
        return bootState;
      });
      if (savedPass) {
        setPasscode(savedPass);
        passcodeRef.current = savedPass;
      }
      setBooted(true);
      if (savedPass) await triggerCloudSync(bootState, savedPass, false, !bootState.isUneditedDefault);
    })();
    return () => {
      mounted = false;
    };
  }, [triggerCloudSync]);

  useEffect(() => {
    const clean = passcode.trim();
    if (!clean) {
      setFingerprintBadge('');
      return;
    }
    let active = true;
    deriveVaultIdentity(clean)
      .then((id) => {
        if (active) setFingerprintBadge(id.fingerprintBadge);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [passcode]);

  useEffect(() => {
    if (!booted || !passcode.trim()) return;
    const wake = () => {
      if (document.visibilityState === 'visible') void triggerCloudSync(vaultRef.current, passcodeRef.current, false, hasUnsyncedChanges);
    };
    const onFocus = () => void triggerCloudSync(vaultRef.current, passcodeRef.current, false, hasUnsyncedChanges);
    const onOnline = () => void triggerCloudSync(vaultRef.current, passcodeRef.current, false, true);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    const unsub = subscribeRealtimeRelay(passcode, () => void triggerCloudSync(vaultRef.current, passcodeRef.current, false, false));
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      unsub();
    };
  }, [booted, passcode, hasUnsyncedChanges, triggerCloudSync]);

  useEffect(() => {
    if (!hasUnsyncedChanges || !passcode.trim()) return;
    const timer = window.setInterval(() => void triggerCloudSync(vaultRef.current, passcodeRef.current, false, true), 15000);
    return () => clearInterval(timer);
  }, [hasUnsyncedChanges, passcode, triggerCloudSync]);

  const commitVaultUpdate = useCallback(
    (updater: (prev: VaultState) => VaultState) => {
      setVault((prev) => {
        const now = Date.now();
        const next = { ...updater(prev), updatedAt: now, isUneditedDefault: false };
        vaultRef.current = next;
        void saveLocalVaultState(next);
        if (passcodeRef.current.trim()) void triggerCloudSync(next, passcodeRef.current, false, true);
        return next;
      });
    },
    [triggerCloudSync]
  );

  // ---------- Deep links (?add= from iOS Shortcut, ?view=, ?spot=) ----------
  useEffect(() => {
    if (urlParams.add || urlParams.text || urlParams.view || urlParams.spot) cleanUrlParams();
  }, [urlParams.add, urlParams.text, urlParams.view, urlParams.spot]);

  // ---------- Derived ----------
  const allSpots = useMemo(() => resolveAllSpots(vault), [vault]);
  const filteredSpots = useMemo(() => sortSpots(applyFilters(allSpots, filters)), [allSpots, filters]);
  const detailSpot = useMemo(() => (detailId ? resolveAllSpots(vault, true).find((s) => s.id === detailId) || null : null), [detailId, vault]);
  const stats = useMemo(() => {
    let want = 0;
    let visited = 0;
    for (const s of allSpots) {
      if (s.mark?.status === 'want') want++;
      if (s.mark?.status === 'visited') visited++;
    }
    return { total: allSpots.length, want, visited };
  }, [allSpots]);

  const scopeLabel = useMemo(() => {
    const parts: string[] = [filters.city];
    if (filters.category !== 'all') parts.push(CATEGORY_MAP[filters.category].label);
    if (filters.status === 'want') parts.push('想去');
    if (filters.status === 'visited') parts.push('已踩點');
    if (filters.district) parts.push(filters.district);
    if (filters.mrt) parts.push(filters.mrt);
    return parts.join('・');
  }, [filters]);

  // ---------- Handlers ----------
  const setMark = useCallback(
    (spotId: string, patch: Partial<PersonalMark>) => {
      commitVaultUpdate((prev) => {
        const now = Date.now();
        const existing = prev.marks[spotId];
        const next: PersonalMark = {
          ...(existing || { spotId, status: 'none' as MarkStatus }),
          ...patch,
          spotId,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        return { ...prev, marks: { ...prev.marks, [spotId]: next } };
      });
    },
    [commitVaultUpdate]
  );

  const toggleStatus = useCallback(
    (spot: ResolvedSpot, target: MarkStatus) => {
      const current = spot.mark?.status || 'none';
      const next: MarkStatus = current === target ? 'none' : target;
      const patch: Partial<PersonalMark> = { status: next };
      if (next === 'visited' && !spot.mark?.visitedAt) patch.visitedAt = getLocalDateKey();
      setMark(spot.id, patch);
      showToast(next === 'want' ? '📌 已加入想去清單' : next === 'visited' ? '✅ 已標記踩點！記得回來寫筆記' : '已取消標記');
    },
    [setMark, showToast]
  );

  const handleSaveMark = useCallback(
    (spotId: string, draft: MarkDraft) => {
      if (draft.photoHiRes) void saveLocalPhoto('mark', spotId, draft.photoHiRes);
      if (!draft.photoThumb) void deleteLocalPhoto('mark', spotId);
      setMark(spotId, {
        status: draft.status,
        revisit: draft.status === 'visited' ? draft.revisit : undefined,
        note: draft.note.trim() || undefined,
        visitedAt: draft.status === 'visited' ? draft.visitedAt || getLocalDateKey() : undefined,
        photoThumb: draft.photoThumb,
        hasLocalHiResPhoto: Boolean(draft.photoThumb),
      });
      showToast('💾 已儲存妳的狀態與筆記');
    },
    [setMark, showToast]
  );

  const handleSaveSpotDraft = useCallback(
    (draft: SpotFormDraft) => {
      const now = Date.now();
      const spot = draftToSpot(draft, now);
      if (draft.coverHiRes) void saveLocalPhoto('spot', spot.id, draft.coverHiRes);
      if (!draft.coverThumb) void deleteLocalPhoto('spot', spot.id);
      const fromInbox = formFromInbox;
      commitVaultUpdate((prev) => {
        let next = prev;
        if (draft.origin === 'curated' && draft.id) {
          const { id: _id, origin: _o, createdAt: _c, updatedAt: _u, isSeed: _s, ...fields } = spot;
          const ov: SpotOverride = { ...fields, updatedAt: now };
          next = { ...next, overrides: { ...next.overrides, [draft.id]: ov } };
        } else {
          const others = next.personalSpots.filter((s) => s.id !== spot.id);
          next = { ...next, personalSpots: [spot, ...others] };
        }
        if (fromInbox) {
          next = {
            ...next,
            inbox: next.inbox.filter((it) => it.id !== fromInbox),
            deletedIds: { ...next.deletedIds, [fromInbox]: now },
          };
        }
        return next;
      });
      if (fromInbox) void deleteLocalPhoto('inbox', fromInbox);
      setFormDraft(null);
      setFormFromInbox(undefined);
      setDetailId(spot.id);
      showToast(draft.id ? '💾 店卡已更新' : '🤎 新店卡收進口袋囉！');
    },
    [commitVaultUpdate, formFromInbox, showToast]
  );

  const handleHideOrDelete = useCallback(
    (spot: ResolvedSpot) => {
      const now = Date.now();
      if (spot.origin === 'curated') {
        if (!window.confirm(`隱藏範例卡「${spot.name}」？之後可在設定頁還原。`)) return;
        commitVaultUpdate((prev) => ({ ...prev, curatedVisibility: { ...prev.curatedVisibility, [spot.id]: { hidden: true, updatedAt: now } } }));
        showToast('🙈 已隱藏範例卡');
      } else {
        if (!window.confirm(`刪除店卡「${spot.name}」？此動作會同步到所有裝置。`)) return;
        commitVaultUpdate((prev) => ({
          ...prev,
          personalSpots: prev.personalSpots.filter((s) => s.id !== spot.id),
          deletedIds: { ...prev.deletedIds, [spot.id]: now },
        }));
        void deleteLocalPhoto('spot', spot.id);
        showToast('🗑️ 店卡已刪除');
      }
      setDetailId(null);
    },
    [commitVaultUpdate, showToast]
  );

  const handleUnhideCurated = useCallback(
    (id: string) => {
      commitVaultUpdate((prev) => ({ ...prev, curatedVisibility: { ...prev.curatedVisibility, [id]: { hidden: false, updatedAt: Date.now() } } }));
      showToast('已還原範例卡');
    },
    [commitVaultUpdate, showToast]
  );

  const handleSaveInbox = useCallback(
    (item: Omit<InboxItem, 'createdAt' | 'updatedAt'> & { hiRes?: string }) => {
      const now = Date.now();
      const { hiRes, ...rest } = item;
      if (hiRes) void saveLocalPhoto('inbox', item.id, hiRes);
      commitVaultUpdate((prev) => {
        const existing = prev.inbox.find((it) => it.id === item.id);
        const next: InboxItem = { ...rest, createdAt: existing?.createdAt || now, updatedAt: now };
        return { ...prev, inbox: [next, ...prev.inbox.filter((it) => it.id !== item.id)] };
      });
      setQuickAddOpen(false);
      setQuickAddPrefill(null);
      setView('inbox');
      showToast('📥 已丟進收件匣，有空再整理～');
    },
    [commitVaultUpdate, showToast]
  );

  const handleDeleteInbox = useCallback(
    (item: InboxItem) => {
      commitVaultUpdate((prev) => ({
        ...prev,
        inbox: prev.inbox.filter((it) => it.id !== item.id),
        deletedIds: { ...prev.deletedIds, [item.id]: Date.now() },
      }));
      void deleteLocalPhoto('inbox', item.id);
    },
    [commitVaultUpdate]
  );

  const handleQuickAddParsed = useCallback(
    (result: QuickAddResult) => {
      setQuickAddOpen(false);
      setQuickAddPrefill(null);
      setFormFromInbox(result.fromInboxId);
      setFormDraft(result.draft);
      if (result.parsed.detected.length > 0) showToast(`✨ 偵測到：${result.parsed.detected.slice(0, 3).join('、')}`);
      else showToast('沒抓到太多資訊，幫 Bobo 補一下店名和地區吧');
    },
    [showToast]
  );

  const openEdit = useCallback((spot: ResolvedSpot) => {
    const base: Spot = { ...spot };
    setFormFromInbox(undefined);
    setFormDraft(spotToDraft(base));
    setDetailId(null);
  }, []);

  const handleBindPasscode = async (rawPass: string): Promise<{ ok: boolean; msg: string }> => {
    const clean = rawPass.trim();
    if (!clean) return { ok: false, msg: '請輸入通行碼喔' };
    setSyncBusy(true);
    const outcome = await syncWithCloudVault(vaultRef.current, clean, !vaultRef.current.isUneditedDefault);
    setSyncBusy(false);
    const resolvedPass = outcome.matchedPasscode || clean;
    if (outcome.fingerprintBadge) setFingerprintBadge(outcome.fingerprintBadge);
    if (outcome.ok || outcome.pulledFromCloud) {
      setPasscode(resolvedPass);
      passcodeRef.current = resolvedPass;
      await saveRememberedPasscode(resolvedPass);
      setHasUnsyncedChanges(!outcome.ok);
      setVault((prev) => {
        const safe = mergeVaultStates(prev, outcome.mergedState);
        vaultRef.current = safe;
        void saveLocalVaultState(safe);
        return safe;
      });
      showToast('🔐 通行碼已綁定，Safari 與主畫面 App 開始自動同步 ✨');
      return {
        ok: true,
        msg: outcome.pulledFromCloud
          ? `✅ 已拉取並合併雲端保險箱（${outcome.mergedState.personalSpots.length} 張個人店卡、${Object.keys(outcome.mergedState.marks).length} 個標記）`
          : '✅ 已建立專屬加密雲端空間並啟動同步！',
      };
    }
    return { ok: false, msg: outcome.errorMessage || '同步連線失敗，請確認通行碼是否正確' };
  };

  const handleUnbind = () => {
    if (!window.confirm('解除綁定後此裝置不再同步（雲端資料不會刪除），確定嗎？')) return;
    setPasscode('');
    passcodeRef.current = '';
    void saveRememberedPasscode('');
    setFingerprintBadge('');
    showToast('已解除綁定');
  };

  const handleRestoreSnapshot = (state: VaultState) => {
    if (!window.confirm('用這份本機快照合併目前資料？（不會刪除現有紀錄）')) return;
    commitVaultUpdate((prev) => mergeVaultStates(prev, { ...state, isUneditedDefault: false }));
    showToast('🛟 已合併快照');
  };

  const handleImportBackup = (state: VaultState) => {
    commitVaultUpdate((prev) => mergeVaultStates(prev, { ...state, isUneditedDefault: false }));
    showToast('📦 備份已匯入並合併');
  };

  const handleSetNickname = (name: string) => {
    commitVaultUpdate((prev) => ({ ...prev, profile: { ...prev.profile, nickname: name }, settingsUpdatedAt: Date.now() }));
    showToast('已儲存暱稱');
  };

  const loadHiResPhoto = useCallback(
    async (spot: ResolvedSpot): Promise<string | null> => {
      if (spot.origin !== 'personal') return null;
      const local = await getLocalPhoto('spot', spot.id);
      if (local) return local;
      if (!spot.hasCoverPhoto && !spot.coverThumb) return null;
      return hydrateSinglePhoto('spot', spot.id, passcodeRef.current);
    },
    []
  );

  const openShareFor = (ids: string[]) => {
    setSharePreselected(ids);
    setDetailId(null);
    setShareOpen(true);
  };

  // ---------- Share (read-only) route ----------
  if (shareCode) {
    return (
      <ShareView
        code={shareCode}
        onOpenApp={() => {
          cleanUrlParams();
          setShareCode(undefined);
        }}
      />
    );
  }

  const cloudChip = passcode ? (
    <button type="button" onClick={() => void triggerCloudSync(vaultRef.current, passcodeRef.current, true, hasUnsyncedChanges)} className={`pill ${hasUnsyncedChanges ? 'bg-[#F8E4D4] text-[#9A4A3A] border border-[#EBCDB9]' : 'pill-idle'}`}>
      <Cloud size={13} className={syncBusy ? 'spin-slow' : ''} /> {syncBusy ? '同步中' : hasUnsyncedChanges ? '待同步' : '已同步'}
      {fingerprintBadge && <span className="opacity-80 ml-0.5">{fingerprintBadge.split(' ')[0]}</span>}
    </button>
  ) : (
    <button type="button" onClick={() => setSettingsOpen(true)} className="pill bg-[#F8E4D4] text-[#9A4A3A] border border-[#EBCDB9]">
      <CloudOff size={13} /> 未綁定雲端
    </button>
  );

  return (
    <div className="min-h-screen pb-[calc(env(safe-area-inset-bottom)+96px)]">
      <header className="sticky top-0 z-30 bg-[#ECE8DF]/92 backdrop-blur border-b border-[#E3DED2]">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <img src="./icon-192.png?v=1" alt="" className="w-9 h-9 rounded-xl border border-[#DDD7C9]" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-black leading-tight">BoboPocket</h1>
            <p className="text-[11px] font-bold text-[#8A7E70] truncate">Quokka & BOBO 的雙北口袋名單</p>
          </div>
          {cloudChip}
          <button type="button" onClick={() => setSettingsOpen(true)} className="w-9 h-9 rounded-full bg-[#FAF8F3] border border-[#DDD7C9] flex items-center justify-center text-[#5C5044]" aria-label="設定">
            <Settings size={17} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-4 flex flex-col gap-4">
        {view !== 'inbox' && (
          <>
            {view === 'pocket' && (
              <section className="relative">
                <HeroBanner className="h-40 sm:h-56 lg:h-64" />
                <div className="absolute inset-0 flex flex-col justify-start p-3 sm:p-4">
                  <div className="inline-flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#FAF8F3]/92 border border-[#DDD7C9] px-2.5 py-1 text-[12px] font-black text-[#2D251E]">🗂️ {stats.total} 家口袋名單</span>
                    <span className="rounded-full bg-[#F2CA62]/95 border border-[#E6BC52] px-2.5 py-1 text-[12px] font-black text-[#3F2E0C]">📌 想去 {stats.want}</span>
                    <span className="rounded-full bg-[#DCE5D2]/95 border border-[#C9D6BE] px-2.5 py-1 text-[12px] font-black text-[#3F5A3A]">✅ 已踩點 {stats.visited}</span>
                  </div>
                </div>
              </section>
            )}
            <FilterBar filters={filters} onChange={setFilters} allSpots={allSpots} />
          </>
        )}

        {view === 'pocket' && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-bold text-[#8A7E70]">
                {filteredSpots.length} 家 · {scopeLabel}
              </p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => openShareFor(filteredSpots.slice(0, 8).map((s) => s.id))} className="pill pill-idle">
                  <Share2 size={13} /> 分享精選
                </button>
                <button type="button" onClick={() => setRandomOpen(true)} className="pill pill-butter">
                  <Dices size={13} /> 抽一家
                </button>
              </div>
            </div>
            {filteredSpots.length === 0 ? (
              <div className="doodle-card p-6 flex flex-col items-center text-center gap-3">
                <DuoStage className="w-full max-w-[280px] h-auto" />
                <h3 className="text-[16px] font-black">這裡還空空的 🤎</h3>
                <p className="text-[13px] text-[#5C5044] leading-relaxed">換個篩選條件，或按右下角「＋ 收錄」貼上 IG／Threads 短片連結，Bobo 幫妳整理成店卡！</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddPrefill(null);
                    setQuickAddOpen(true);
                  }}
                  className="doodle-btn bg-[#F2CA62] text-[#3F2E0C] font-black px-5 py-2.5 text-[14px]"
                >
                  ✨ 快速收錄
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredSpots.map((s) => (
                  <SpotCard key={s.id} spot={s} onOpen={(sp) => setDetailId(sp.id)} onToggleWant={(sp) => toggleStatus(sp, 'want')} onToggleVisited={(sp) => toggleStatus(sp, 'visited')} />
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'map' && (
          <section className="flex flex-col gap-3">
            <MapView spots={filteredSpots} onSelect={(s) => setDetailId(s.id)} className="h-[58vh] min-h-[360px]" />
            {filteredSpots.some((s) => typeof s.lat !== 'number') && (
              <div className="doodle-card-soft p-3 text-[12.5px] text-[#5C5044]">
                有 {filteredSpots.filter((s) => typeof s.lat !== 'number').length} 張店卡尚未定位（打開店卡 → 編輯 → 📍 定位 即可顯示在地圖上）：
                <span className="font-bold"> {filteredSpots.filter((s) => typeof s.lat !== 'number').map((s) => s.name).slice(0, 6).join('、')}</span>
              </div>
            )}
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
              {filteredSpots.map((s) => (
                <button key={s.id} type="button" onClick={() => setDetailId(s.id)} className="doodle-card shrink-0 w-44 p-3 text-left">
                  <span className="block text-[11px] font-black text-[#8A7E70]">
                    {CATEGORY_MAP[s.category].emoji} {s.district || s.city}
                    {s.mrt ? `・${s.mrt}` : ''}
                  </span>
                  <span className="block text-[13.5px] font-black truncate">{s.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === 'inbox' && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <QuokkaMapBadge className="w-12 h-12" />
              <div>
                <h2 className="text-[17px] font-black">📥 智慧收件匣</h2>
                <p className="text-[12.5px] text-[#8A7E70] font-bold">先存再說，有空再解析；或複製清單交給 Bobo 管家</p>
              </div>
            </div>
            <InboxView
              items={vault.inbox}
              onParse={(it) => {
                setQuickAddPrefill({ url: it.url, text: it.text, screenshotThumb: it.screenshotThumb, inboxId: it.id });
                setQuickAddOpen(true);
              }}
              onDelete={handleDeleteInbox}
              onToast={showToast}
              onOpenQuickAdd={() => {
                setQuickAddPrefill(null);
                setQuickAddOpen(true);
              }}
            />
          </section>
        )}
      </main>

      {/* FAB */}
      <button
        type="button"
        onClick={() => {
          setQuickAddPrefill(null);
          setQuickAddOpen(true);
        }}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 doodle-btn bg-[#F2CA62] text-[#3F2E0C] font-black px-4 py-3 inline-flex items-center gap-1.5 shadow-pop"
      >
        <Plus size={18} /> 收錄
      </button>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#FAF8F3]/95 backdrop-blur border-t border-[#DDD7C9]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-3">
          {(
            [
              ['pocket', '口袋', <LayoutGrid key="p" size={20} />],
              ['map', '地圖', <MapIcon key="m" size={20} />],
              ['inbox', `收件匣${vault.inbox.length ? ` (${vault.inbox.length})` : ''}`, <Inbox key="i" size={20} />],
            ] as Array<[View, string, React.ReactNode]>
          ).map(([key, label, icon]) => (
            <button key={key} type="button" onClick={() => setView(key)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11.5px] font-black ${view === key ? 'text-[#2D251E]' : 'text-[#A79C8E]'}`}>
              <span className={`w-10 h-7 rounded-full flex items-center justify-center ${view === key ? 'bg-[#F2CA62]' : ''}`}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Modals */}
      <QuickAddModal open={quickAddOpen} prefill={quickAddPrefill} onClose={() => setQuickAddOpen(false)} onParsed={handleQuickAddParsed} onSaveInbox={handleSaveInbox} onToast={showToast} />

      {formDraft && (
        <SpotFormModal
          open={Boolean(formDraft)}
          initial={formDraft}
          title={formDraft.id ? '✏️ 編輯店卡' : '✨ 確認新店卡'}
          onCancel={() => {
            setFormDraft(null);
            setFormFromInbox(undefined);
          }}
          onSave={handleSaveSpotDraft}
          onToast={showToast}
        />
      )}

      <SpotDetailSheet
        spot={detailSpot}
        onClose={() => setDetailId(null)}
        onSaveMark={handleSaveMark}
        onEdit={openEdit}
        onHideOrDelete={handleHideOrDelete}
        onShare={(s) => openShareFor([s.id])}
        onToast={showToast}
        loadHiResPhoto={loadHiResPhoto}
      />

      <RandomPickerModal
        open={randomOpen}
        candidates={filteredSpots}
        scopeLabel={scopeLabel}
        onClose={() => setRandomOpen(false)}
        onOpenSpot={(s) => {
          setRandomOpen(false);
          setDetailId(s.id);
        }}
      />

      <ShareComposerModal open={shareOpen} spots={filteredSpots.length > 0 ? filteredSpots : allSpots} preselectedIds={sharePreselected} nickname={vault.profile.nickname} onClose={() => setShareOpen(false)} onToast={showToast} />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        vault={vault}
        passcode={passcode}
        fingerprintBadge={fingerprintBadge}
        syncBusy={syncBusy}
        hasUnsynced={hasUnsyncedChanges}
        onBindPasscode={handleBindPasscode}
        onUnbind={handleUnbind}
        onSyncNow={() => void triggerCloudSync(vaultRef.current, passcodeRef.current, true, true)}
        onRestoreSnapshot={handleRestoreSnapshot}
        onImportBackup={handleImportBackup}
        onUnhideCurated={handleUnhideCurated}
        onSetNickname={handleSetNickname}
        onToast={showToast}
      />

      <Toast message={toastMsg} />
    </div>
  );
};
