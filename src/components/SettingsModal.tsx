import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw, Download, Upload, LifeBuoy, Smartphone, Loader2, MapPinned, LocateFixed } from 'lucide-react';
import { VaultState } from '../types/pocket';
import { CURATED_SPOTS } from '../data/curatedSpots';
import { listLocalHistorySnapshots, LocalHistorySnapshot, exportBackupJson, parseVaultJson } from '../services/cloudSync';
import { parseTakeoutFile, ImportedPlace } from '../services/importers';
import { Modal, SectionTitle, formatDateTime, copyToClipboard } from './ui';
import { MarshBadge } from './QuokkaBoboArt';

export const SettingsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  vault: VaultState;
  passcode: string;
  fingerprintBadge: string;
  syncBusy: boolean;
  hasUnsynced: boolean;
  onBindPasscode: (pass: string) => Promise<{ ok: boolean; msg: string }>;
  onUnbind: () => void;
  onSyncNow: () => void;
  onRestoreSnapshot: (state: VaultState) => void;
  onImportBackup: (state: VaultState) => void;
  onUnhideCurated: (id: string) => void;
  onSetNickname: (name: string) => void;
  onToast: (msg: string) => void;
  onImportPlaces: (places: ImportedPlace[]) => { added: number; skipped: number };
  unlocatedCount: number;
  onBatchGeocode: (onProgress: (done: number, total: number) => void) => Promise<{ located: number; failed: number }>;
}> = ({ open, onClose, vault, passcode, fingerprintBadge, syncBusy, hasUnsynced, onBindPasscode, onUnbind, onSyncNow, onRestoreSnapshot, onImportBackup, onUnhideCurated, onSetNickname, onToast, onImportPlaces, unlocatedCount, onBatchGeocode }) => {
  const [passInput, setPassInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [binding, setBinding] = useState(false);
  const [bindMsg, setBindMsg] = useState('');
  const [snaps, setSnaps] = useState<LocalHistorySnapshot[]>([]);
  const [nick, setNick] = useState(vault.profile.nickname || '');
  const [importMsg, setImportMsg] = useState('');
  const [geoProgress, setGeoProgress] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassInput('');
    setBindMsg('');
    setNick(vault.profile.nickname || '');
    void listLocalHistorySnapshots().then(setSnaps);
  }, [open, vault.profile.nickname]);

  const hiddenCurated = CURATED_SPOTS.filter((s) => vault.curatedVisibility[s.id]?.hidden);
  const appUrl = `${window.location.origin}${window.location.pathname}`;

  const bind = async () => {
    setBinding(true);
    const res = await onBindPasscode(passInput);
    setBindMsg(res.msg);
    setBinding(false);
    if (res.ok) setPassInput('');
  };

  const importTakeout = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let all: ImportedPlace[] = [];
    for (const f of Array.from(files)) {
      try {
        const txt = await f.text();
        all = all.concat(parseTakeoutFile(txt, f.name));
      } catch {
        // skip unreadable file
      }
    }
    if (all.length === 0) {
      setImportMsg('沒有讀到地點：請選 Takeout 的 Saved Places.json 或清單 .csv');
      return;
    }
    const res = onImportPlaces(all);
    setImportMsg(`✅ 匯入 ${res.added} 筆（略過重複 ${res.skipped} 筆）。沒有座標的店卡可用下方「一鍵定位」補齊。`);
  };

  const runBatchGeocode = async () => {
    setGeoBusy(true);
    setGeoProgress('開始定位…');
    try {
      const res = await onBatchGeocode((done, total) => setGeoProgress(`定位中 ${done}/${total}（每筆約 1 秒）`));
      setGeoProgress(`完成：成功 ${res.located} 筆，找不到 ${res.failed} 筆（可打開店卡手動在地圖點選）`);
    } finally {
      setGeoBusy(false);
    }
  };

  const importFile = async (file: File | null) => {
    if (!file) return;
    try {
      const txt = await file.text();
      const st = parseVaultJson(txt);
      if (!st) {
        onToast('這不是 BoboPocket 的備份檔');
        return;
      }
      onImportBackup(st);
    } catch {
      onToast('讀取備份失敗');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="⚙️ 設定與雲端保險箱" subtitle="通行碼綁定後，Safari ↔ 主畫面 App ↔ 電腦都會自動同步">
      <div className="flex flex-col gap-5">
        <section className="doodle-card p-4 flex flex-col gap-3">
          <SectionTitle right={fingerprintBadge ? <span className="text-[12px] font-black text-[#5C5044]">雲端印記 {fingerprintBadge}</span> : null}>☁️ 雲端通行碼</SectionTitle>
          {passcode ? (
            <>
              <p className="text-[13px] text-[#2D251E] leading-relaxed">
                已綁定通行碼，資料以 AES-GCM 加密後同步至雙永久雲端。
                {hasUnsynced ? <b className="text-[#8A4A40]"> 目前有待同步變更（已存本機保險箱，會自動重試）。</b> : <b className="text-[#3F5A3A]"> 目前狀態：已同步 ✅</b>}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={onSyncNow} disabled={syncBusy} className="doodle-btn flex-1 bg-[#F2CA62] text-[#3F2E0C] font-black py-2.5 inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                  {syncBusy ? <Loader2 size={15} className="spin-slow" /> : <RefreshCw size={15} />} 🔄 立即雲端同步
                </button>
                <button type="button" onClick={onUnbind} className="doodle-btn bg-[#EFECE4] text-[#5C5044] font-black py-2.5 px-3 text-[13px]">
                  解除綁定
                </button>
              </div>
              <p className="text-[11.5px] text-[#8A7E70]">在其他瀏覽器或手機輸入同一組通行碼，看到相同「雲端印記」就代表連到同一個保險箱。</p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-[#2D251E] leading-relaxed">
                設定一組只有妳知道的通行碼（建議 8 碼以上）。iPhone「加入主畫面」與 Safari 是各自獨立的儲存空間，<b>綁定後才會互通</b>。
              </p>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={passInput}
                  onChange={(e) => setPassInput(e.target.value)}
                  className="input-cream pr-11"
                  placeholder="輸入通行碼"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void bind();
                  }}
                />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A7E70]" aria-label="顯示／隱藏">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button type="button" onClick={() => void bind()} disabled={binding || !passInput.trim()} className="doodle-btn bg-[#F2CA62] text-[#3F2E0C] font-black py-2.5 inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                {binding ? <Loader2 size={15} className="spin-slow" /> : '🔐'} 綁定並開始同步
              </button>
            </>
          )}
          {bindMsg && <p className="text-[12.5px] font-bold text-[#5C5044]">{bindMsg}</p>}
        </section>

        <section className="doodle-card p-4 flex flex-col gap-2">
          <SectionTitle>🙋 暱稱（分享清單時顯示）</SectionTitle>
          <div className="flex gap-2">
            <input value={nick} onChange={(e) => setNick(e.target.value)} className="input-cream" placeholder="Mona" />
            <button type="button" onClick={() => onSetNickname(nick.trim())} className="doodle-btn bg-[#EFECE4] text-[#5C5044] font-black px-4 text-[13px]">
              儲存
            </button>
          </div>
        </section>

        <section className="doodle-card p-4 flex flex-col gap-3">
          <SectionTitle>📲 iPhone 捷徑：IG／Threads／Google Maps 分享 → 一鍵收錄</SectionTitle>
          <ol className="text-[13px] text-[#2D251E] leading-relaxed list-decimal pl-5 flex flex-col gap-1">
            <li>打開「捷徑」App → 新增捷徑 → 右上角 ⓘ 勾選「顯示於分享工作表」，接受類型選「URL」與「文字」。</li>
            <li>加入動作「取得輸入內容的 URL」。</li>
            <li>加入動作「要求輸入」（提示：貼上文案，選填）。</li>
            <li>
              加入動作「開啟 URL」，內容填：
              <code className="block mt-1 bg-[#EFECE4] rounded-xl px-2 py-1.5 text-[11.5px] break-all">{appUrl}?add=[URL]&text=[已提供的輸入]</code>
              （把 [URL] 與 [已提供的輸入] 換成對應的變數）
            </li>
            <li>之後在 IG／Threads 按「分享 → 捷徑名稱」就會直接打開快速收錄並預填 ✨</li>
            <li>
              <b>Google Maps／Apple 地圖</b>的地點頁也能「分享 → 同一個捷徑」：分享文字裡的店名＋地址會自動解析，座標也會一起帶入（Apple 地圖）或按一下「定位」補齊。
            </li>
          </ol>
          <button type="button" onClick={async () => onToast((await copyToClipboard(`${appUrl}?add=`)) ? '已複製 App 網址前綴' : appUrl)} className="pill pill-idle self-start">
            <Smartphone size={13} /> 複製 App 網址
          </button>
        </section>

        <section className="doodle-card p-4 flex flex-col gap-3">
          <SectionTitle>🗺️ 從 Google Maps 已儲存地點搬家</SectionTitle>
          <p className="text-[13px] text-[#2D251E] leading-relaxed">
            手機 Google Maps 的「已儲存」清單無法被網頁直接讀取，但可以一次搬過來：
            <br />
            ① 到 <b>takeout.google.com</b> 只勾選「地圖（您的地點）」與「已儲存」→ 匯出 → 下載 zip
            <br />
            ② 解壓後把 <b>Saved Places.json</b>（含座標）或各清單 <b>.csv</b> 選進來（可多選）
          </p>
          <label className="doodle-btn inline-flex items-center justify-center gap-1.5 bg-[#F2CA62] text-[#3F2E0C] font-black py-2.5 text-[13px] cursor-pointer">
            <MapPinned size={15} /> 選擇 Takeout 檔案匯入
            <input type="file" accept=".json,.csv,application/json,text/csv" multiple className="hidden" onChange={(e) => void importTakeout(e.target.files)} />
          </label>
          {importMsg && <p className="text-[12.5px] font-bold text-[#5C5044]">{importMsg}</p>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void runBatchGeocode()} disabled={geoBusy || unlocatedCount === 0} className="doodle-btn flex-1 bg-[#EFECE4] text-[#5C5044] font-black py-2.5 inline-flex items-center justify-center gap-1.5 text-[13px] disabled:opacity-50">
              {geoBusy ? <Loader2 size={15} className="spin-slow" /> : <LocateFixed size={15} />} 一鍵定位尚未定位的店卡（{unlocatedCount}）
            </button>
          </div>
          {geoProgress && <p className="text-[12px] text-[#8A7E70] font-bold">{geoProgress}</p>}
        </section>

        <section className="doodle-card p-4 flex flex-col gap-3">
          <SectionTitle>🛟 備份與救援</SectionTitle>
          <div className="flex gap-2">
            <button type="button" onClick={() => exportBackupJson(vault)} className="doodle-btn flex-1 bg-[#EFECE4] text-[#5C5044] font-black py-2.5 inline-flex items-center justify-center gap-1.5 text-[13px]">
              <Download size={15} /> 下載 .json 備份
            </button>
            <label className="doodle-btn flex-1 bg-[#EFECE4] text-[#5C5044] font-black py-2.5 inline-flex items-center justify-center gap-1.5 text-[13px] cursor-pointer">
              <Upload size={15} /> 匯入備份
              <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div>
            <p className="text-[12.5px] font-black text-[#8A7E70] mb-1.5 inline-flex items-center gap-1">
              <LifeBuoy size={13} /> 本機歷史快照救援（最近 8 份）
            </p>
            {snaps.length === 0 ? (
              <p className="text-[12.5px] text-[#8A7E70]">尚無快照（有資料變更後會自動建立）</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {snaps.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const st = parseVaultJson(s.stateJson);
                      if (st) onRestoreSnapshot(st);
                    }}
                    className="doodle-card-soft px-3 py-2 text-left text-[12.5px] font-bold text-[#2D251E] flex items-center justify-between"
                  >
                    <span>{formatDateTime(s.savedAt)}</span>
                    <span className="text-[#8A7E70]">
                      {s.spotCount} 店卡・{s.markCount} 標記・{s.inboxCount} 收件
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {hiddenCurated.length > 0 && (
          <section className="doodle-card p-4 flex flex-col gap-2">
            <SectionTitle>🙈 已隱藏的精選卡</SectionTitle>
            {hiddenCurated.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-[13px] font-bold">
                <span className="truncate">{s.name}</span>
                <button type="button" onClick={() => onUnhideCurated(s.id)} className="pill pill-idle">
                  還原
                </button>
              </div>
            ))}
          </section>
        )}

        <section className="flex items-start gap-2 text-[11.5px] text-[#8A7E70] leading-relaxed pb-2">
          <MarshBadge className="w-5 h-5 mt-0.5 shrink-0" />
          <p>
            BoboPocket 由 Quokka & BOBO 陪妳收集雙北口袋名單 🤎 精選卡由 Bobo 管家透過 GitHub 維護；個人店卡、想去／已踩點與筆記只存在妳的加密保險箱。地圖資料 © OpenStreetMap 貢獻者。
          </p>
        </section>
      </div>
    </Modal>
  );
};
