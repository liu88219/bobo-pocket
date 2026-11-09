import { Spot } from '../types/pocket';

/**
 * 公開層「精選口袋名單」— 由 Bobo 管家（Jetski）透過 git 直接維護。
 *
 * 🤎 想新增店家：把 IG / Threads / Google Maps 連結＋文案或截圖丟到對話，
 *    管家會查證店名、地址、捷運站、座標後補進這個陣列（origin: 'curated'）。
 * 🗑️ 2025-11-09：依 Mona 指示，第一版的 8 張範例卡已全部移除。
 * 🥂 2025-11-09：Mona 委託「板橋適合慶生的餐廳」— 管家上網查證 8 家（地址／樓層／營業時間／包廂／必點）。
 *    座標以建物／車站定位為準（± 100 公尺），可在店卡「編輯 → 地圖微調」。
 */

const CURATED_BUILD_TS = 1762670000000;

export function curated(
  partial: Omit<Spot, 'origin' | 'createdAt' | 'updatedAt' | 'highlights' | 'tags'> & {
    highlights?: string[];
    tags?: string[];
    createdAt?: number;
    updatedAt?: number;
  }
): Spot {
  return {
    highlights: [],
    tags: [],
    ...partial,
    origin: 'curated',
    createdAt: partial.createdAt || CURATED_BUILD_TS,
    updatedAt: partial.updatedAt || partial.createdAt || CURATED_BUILD_TS,
  };
}

const BQ_BIRTHDAY_TS = 1762678800000; // 2025-11-09 板橋慶生餐廳批次

export const CURATED_SPOTS: Spot[] = [
  curated({
    id: 'cur-bq-wangyue-lou-mega50',
    name: '望月樓（Mega 50・百揚大樓 48F）',
    category: 'birthday',
    city: '新北市',
    district: '板橋區',
    mrt: '板橋站',
    zone: '板橋府中・新板特區',
    address: '新北市板橋區新站路16號48樓（百揚大樓）',
    lat: 25.0131,
    lng: 121.4672,
    hours: '午餐 11:30–14:30／晚餐 18:00–21:30（訂位 02-7705-9703）',
    priceHint: '人均約 $1,200–2,500；景觀包廂低消午 $24,000 起／晚 $32,000 起',
    tags: ['celebration', 'view', 'reservation', 'group', 'splurge'],
    highlights: ['片皮鴨', '港式點心', '高空景觀包廂（板橋廳約 20 人）'],
    summary:
      '新北第一高樓 48 樓的國際飯店級粵菜，大片落地窗看雙北夜景，重視儀式感的慶生、長輩大壽首選。同棟 49F Asia 49 與 50F Café 已於 2026 年歇業，望月樓仍正常營業。',
    source: { platform: 'web', url: 'https://www.mega50.com.tw/' },
    createdAt: BQ_BIRTHDAY_TS,
  }),
  curated({
    id: 'cur-bq-jiayan-caesar-park',
    name: '家宴中餐廳（板橋凱撒大飯店 3F）',
    category: 'birthday',
    city: '新北市',
    district: '板橋區',
    mrt: '板橋站',
    zone: '板橋府中・新板特區',
    address: '新北市板橋區縣民大道二段8號3樓',
    lat: 25.0116,
    lng: 121.4627,
    hours: '午餐 11:30–14:30（最後點餐 13:30）／晚餐 17:30–21:30（最後點餐 20:30）',
    priceHint: '人均約 $1,000–2,000；小包廂低消約 $8,000 起、大包廂約 $25,000 起',
    tags: ['celebration', 'reservation', 'group', 'kids', 'splurge'],
    highlights: ['烤鴨', '東坡肉', '江浙本幫菜', '多款 8–22 人包廂（可打通）'],
    summary: '米其林入選的飯店江浙菜，板橋車站旁交通最方便；包廂選擇多、低消彈性，家族慶生、多人聚餐很有面子。',
    source: { platform: 'web', url: 'https://banqiao.caesarpark.com.tw/' },
    createdAt: BQ_BIRTHDAY_TS,
  }),
  curated({
    id: 'cur-bq-lao-kanpai-megacity',
    name: '老乾杯 板橋大遠百店（11F）',
    category: 'birthday',
    city: '新北市',
    district: '板橋區',
    mrt: '板橋站',
    zone: '板橋府中・新板特區',
    address: '新北市板橋區新站路28號11樓（Mega City 板橋大遠百）',
    lat: 25.0137,
    lng: 121.4669,
    hours: '週一至週五 11:00–15:00、17:00–23:00／週六日 11:00–23:00（02-2952-6466）',
    priceHint: '人均約 $1,500–3,000',
    tags: ['celebration', 'date', 'reservation', 'splurge', 'group'],
    highlights: ['現切冷藏和牛肋眼牛排（桌邊代烤）', '頂級和牛燒肉', '半包廂沙發座'],
    summary: '想用頂級和牛慶祝生日或紀念日的首選：沉穩木質調、半包廂隱密性佳，桌邊服務切肉代烤儀式感滿點。',
    source: { platform: 'web', url: 'https://www.kanpai.com.tw/' },
    createdAt: BQ_BIRTHDAY_TS,
  }),
  curated({
    id: 'cur-bq-pin33-teppanyaki',
    name: '品33 Teppanyaki 板橋旗艦店',
    category: 'birthday',
    city: '新北市',
    district: '板橋區',
    mrt: '板新站',
    zone: '板橋府中・新板特區',
    address: '新北市板橋區中山路一段293-1號B1',
    lat: 25.0125,
    lng: 121.47,
    hours: '週一至週六 午宴 11:30–14:00（最後接客 13:00）／晚宴 17:30–21:30（最後接客 19:30）；週日依公告（02-8953-0333）',
    priceHint: '全包廂預約制；包廂低消午宴約 $15,000 起／晚宴約 $30,000 起',
    tags: ['celebration', 'reservation', 'group', 'splurge'],
    highlights: ['頂級鐵板料理＋鍋物', '附 KTV 歡唱設備與獨立洗手間的包廂（金斯曼／伊莉莎／三一廳）'],
    summary: '板新站附近的高規格鐵板燒，全包廂制、部分包廂直接附 KTV，一邊吃鐵板燒一邊唱歌慶生不受鄰桌打擾。',
    source: { platform: 'web', url: 'https://www.pin33.com.tw/' },
    createdAt: BQ_BIRTHDAY_TS,
  }),
  curated({
    id: 'cur-bq-abv-fuzhong-rooftop',
    name: 'ABV 閣樓餐酒館 板橋府中店（12F 頂樓）',
    category: 'birthday',
    city: '新北市',
    district: '板橋區',
    mrt: '府中站',
    zone: '板橋府中・新板特區',
    address: '新北市板橋區府中路67號12樓（美麗殿商旅頂樓，府中站 1 號出口步行約 2 分鐘）',
    lat: 25.01,
    lng: 121.4588,
    hours: '每日 12:00–01:30（最後點餐約 23:30；02-2969-9989）',
    priceHint: '人均約 $700–1,200',
    tags: ['celebration', 'view', 'late-night', 'date', 'group', 'photogenic'],
    highlights: ['頂樓戶外露台看板橋夜景', '世界精釀啤酒（侍酒師推薦）', '歐陸料理與義大利麵'],
    summary: '府中商圈高樓層景觀餐酒館，360 度環景與戶外露台入夜超浪漫；生日、姊妹聚會、小酌都剛好，記得訂位時備註慶生。',
    source: { platform: 'web', url: 'https://www.abv.com.tw/' },
    createdAt: BQ_BIRTHDAY_TS,
  }),
  curated({
    id: 'cur-bq-moon-bistro',
    name: '月餐酒館 Moon Bistro',
    category: 'birthday',
    city: '新北市',
    district: '板橋區',
    mrt: '府中站',
    zone: '板橋府中・新板特區',
    address: '新北市板橋區中山路一段35號2樓（府中站步行約 2 分鐘）',
    lat: 25.0092,
    lng: 121.462,
    hours: '週日至週四 18:00–02:00／週五、週六 18:00–02:30',
    priceHint: '人均約 $600–1,000',
    tags: ['celebration', 'late-night', 'date', 'group'],
    highlights: ['浮誇大容量調酒', '當月壽星招待 SHOT 盤（依店家活動）', '營業到凌晨'],
    summary: '低調有質感的板橋人氣餐酒館，對壽星很友善，適合晚餐後續攤慶生、慢步調談心的夜生活。',
    source: { platform: 'googlemaps', url: 'https://www.google.com/maps/search/?api=1&query=月餐酒館+Moon+Bistro+板橋' },
    createdAt: BQ_BIRTHDAY_TS,
  }),
  curated({
    id: 'cur-bq-laiba-sunset',
    name: '來吧 Sunset 南洋餐酒館',
    category: 'birthday',
    city: '新北市',
    district: '板橋區',
    mrt: '板橋站',
    zone: '板橋府中・新板特區',
    address: '新北市板橋區縣民大道二段122號（板橋車站／大遠百步行約 5–8 分鐘）',
    lat: 25.0117,
    lng: 121.4685,
    hours: '18:00–02:00（建議先電話 02-2963-2270 確認／訂位）',
    priceHint: '人均約 $600–1,000（常有調酒暢飲方案）',
    tags: ['celebration', 'photogenic', 'group', 'late-night', 'date'],
    highlights: ['泰台創意料理', '特色調酒無限暢飲方案', '南洋渡假風空間好拍'],
    summary: 'Google 評價極高的南洋風餐酒館，氣氛放鬆歡樂、照片好看，年輕朋友群熱鬧慶生的高 CP 選擇。',
    source: { platform: 'googlemaps', url: 'https://www.google.com/maps/search/?api=1&query=來吧+Sunset+板橋' },
    createdAt: BQ_BIRTHDAY_TS,
  }),
  curated({
    id: 'cur-bq-beef-house-fuzhong',
    name: '牛室炙燒牛排 板橋府中店',
    category: 'birthday',
    city: '新北市',
    district: '板橋區',
    mrt: '府中站',
    zone: '板橋府中・新板特區',
    address: '新北市板橋區館前東路26號2樓（府中站 2 號出口步行約 3–5 分鐘）',
    lat: 25.0074,
    lng: 121.4612,
    hours: '平日 11:00–15:30（最後收客 14:00）、17:00–22:00（最後收客 20:30）／假日 11:00–22:00',
    priceHint: '排餐約 $390 起（含近百道自助吧吃到飽，+10% 服務費，限時 90 分鐘）',
    tags: ['celebration', 'budget', 'group', 'kids', 'reservation'],
    highlights: ['原塊炙燒牛排', '手工現烤披薩自助吧', '炸物、港點、霜淇淋吃到飽'],
    summary: '預算平實又能大口吃肉、熱熱鬧鬧的慶生選擇；自助吧超豐富、人氣很高，建議線上先訂位。',
    source: { platform: 'googlemaps', url: 'https://www.google.com/maps/search/?api=1&query=牛室炙燒牛排+板橋府中店' },
    createdAt: BQ_BIRTHDAY_TS,
  }),
];

export const CURATED_SPOT_IDS = new Set(CURATED_SPOTS.map((s) => s.id));
