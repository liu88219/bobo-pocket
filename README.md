# BoboPocket 🗺️🤎

**Quokka & BOBO 的雙北美食／咖啡廳／景點口袋名單 PWA**
IG・Threads 短片「智慧收件匣」 × 互動地圖 × 想去／已踩點 × 跨裝置加密雲端同步

🔗 線上版本：https://liu88219.github.io/bobo-pocket/

---

## ✨ 功能

| 模組 | 說明 |
| --- | --- |
| 🗂️ 口袋卡片牆 | 台北市／新北市優先（其他縣市隨時擴充），行政區 ↔ 捷運站／商圈雙篩選、5 大分類、情境標籤、關鍵字搜尋 |
| ✨ 快速收錄（方案 B 智慧收件匣） | 貼 IG／Threads／YouTube／**Google Maps／Apple 地圖** 連結＋文案或截圖／短片檔 → 盡力抓公開預覽 → **雙北規則引擎**（零額度）解析店名、行政區、捷運站、分類、Tag、營業時間、必點、座標 → 可選瀏覽器本地 OCR；「📋 貼上剪貼簿」一鍵帶入 |
| 📥 收件匣 | 先丟再說；之後「解析成店卡」或「複製清單給 Bobo 管家」一次建檔 |
| 🗺️ 地圖模式 | Leaflet + OpenStreetMap 奶油色調底圖（免金鑰），Nominatim 免費定位＋手動拖曳大頭針；「📍 我附近」依 GPS 距離排序並顯示藍點 |
| 📱 手機地圖整合 | 店卡「用地圖打開」：Google Maps／Apple 地圖 查看・導航；設定頁可一次匯入 Google Maps「已儲存地點」（Takeout GeoJSON／CSV）並一鍵批次定位 |
| 📌 想去 → ✅ 已踩點 | 回訪等級 🔥／👍／💣、筆記、踩點日期、自己的實拍照 |
| 🎲 今天去哪裡 | 依目前篩選條件隨機抽一家 |
| 🔗 分享精選 | 產生唯讀清單短連結（不含私人筆記）丟 LINE 給朋友挑店 |
| ☁️ 雲端保險箱 | 通行碼 SHA-256 衍生金鑰 + PBKDF2/AES-GCM 加密 → textdb.online + textdb.dev 雙永久 KV；ntfy.sh 即時喚醒；防空白覆蓋合併、墓碑、IndexedDB 歷史快照、.json 備份 |
| 📲 iOS 捷徑 | `?add=<url>&text=<caption>` 深連結，IG／Threads 分享 → 一鍵預填快速收錄 |

## 🧱 兩層資料架構

1. **Curated（公開層）**：`src/data/curatedSpots.ts` — 精選店卡，由 Bobo 管家（Jetski）透過 git 維護（目前為空白，範例卡已依 Mona 指示移除）。把 IG／Threads／Google Maps 連結＋文案或截圖丟到對話，管家查證地址、捷運站、座標後補進這裡。
2. **Vault（私有層）**：個人新增的店卡、想去／已踩點、筆記、照片、收件匣、對 curated 卡片的覆寫與隱藏 → 加密後同步雲端。

## 🛠️ 開發

```bash
npm install
npm run dev      # 本機開發
npm test         # vitest
npm run build    # tsc -b && vite build
```

推送到 `main` 後由 GitHub Actions 自動部署至 GitHub Pages。

## 🙏 資料來源

地圖 © [OpenStreetMap](https://www.openstreetmap.org/copyright) 貢獻者；定位 Nominatim。
