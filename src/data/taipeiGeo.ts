/**
 * 雙北地理字典：縣市、行政區、捷運站、商圈
 * 給「智慧收件匣」規則引擎與篩選器共用（零額度、零伺服器）。
 */

export const PRIMARY_CITIES = ['台北市', '新北市'] as const;
export type PrimaryCity = (typeof PRIMARY_CITIES)[number];

export const OTHER_CITIES = [
  '基隆市',
  '桃園市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '台中市',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '台南市',
  '高雄市',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '台東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
  '海外',
] as const;

export const TAIPEI_DISTRICTS = [
  '中正區',
  '大同區',
  '中山區',
  '松山區',
  '大安區',
  '萬華區',
  '信義區',
  '士林區',
  '北投區',
  '內湖區',
  '南港區',
  '文山區',
] as const;

export const NEW_TAIPEI_DISTRICTS = [
  '板橋區',
  '三重區',
  '中和區',
  '永和區',
  '新莊區',
  '新店區',
  '土城區',
  '蘆洲區',
  '樹林區',
  '汐止區',
  '鶯歌區',
  '三峽區',
  '淡水區',
  '瑞芳區',
  '五股區',
  '泰山區',
  '林口區',
  '深坑區',
  '石碇區',
  '坪林區',
  '三芝區',
  '石門區',
  '八里區',
  '平溪區',
  '雙溪區',
  '貢寮區',
  '金山區',
  '萬里區',
  '烏來區',
] as const;

export const DISTRICTS_BY_CITY: Record<string, readonly string[]> = {
  台北市: TAIPEI_DISTRICTS,
  新北市: NEW_TAIPEI_DISTRICTS,
};

export type MetroLine = 'BR' | 'R' | 'G' | 'O' | 'BL' | 'Y';

export const METRO_LINE_META: Record<MetroLine, { name: string; color: string }> = {
  BR: { name: '文湖線', color: '#C48E63' },
  R: { name: '淡水信義線', color: '#C83D33' },
  G: { name: '松山新店線', color: '#5E8C61' },
  O: { name: '中和新蘆線', color: '#E2A33B' },
  BL: { name: '板南線', color: '#1E3158' },
  Y: { name: '環狀線', color: '#D8B64B' },
};

export interface MetroStation {
  /** 不含「站」字 */
  name: string;
  lines: MetroLine[];
  city: '台北市' | '新北市';
  district: string;
}

const S = (
  name: string,
  lines: MetroLine[],
  city: '台北市' | '新北市',
  district: string
): MetroStation => ({ name, lines, city, district });

export const METRO_STATIONS: MetroStation[] = [
  // 文湖線
  S('動物園', ['BR'], '台北市', '文山區'),
  S('木柵', ['BR'], '台北市', '文山區'),
  S('萬芳社區', ['BR'], '台北市', '文山區'),
  S('萬芳醫院', ['BR'], '台北市', '文山區'),
  S('辛亥', ['BR'], '台北市', '文山區'),
  S('麟光', ['BR'], '台北市', '大安區'),
  S('六張犁', ['BR'], '台北市', '大安區'),
  S('科技大樓', ['BR'], '台北市', '大安區'),
  S('大安', ['BR', 'R'], '台北市', '大安區'),
  S('忠孝復興', ['BR', 'BL'], '台北市', '大安區'),
  S('南京復興', ['BR', 'G'], '台北市', '松山區'),
  S('中山國中', ['BR'], '台北市', '中山區'),
  S('松山機場', ['BR'], '台北市', '松山區'),
  S('大直', ['BR'], '台北市', '中山區'),
  S('劍南路', ['BR'], '台北市', '中山區'),
  S('西湖', ['BR'], '台北市', '內湖區'),
  S('港墘', ['BR'], '台北市', '內湖區'),
  S('文德', ['BR'], '台北市', '內湖區'),
  S('內湖', ['BR'], '台北市', '內湖區'),
  S('大湖公園', ['BR'], '台北市', '內湖區'),
  S('葫洲', ['BR'], '台北市', '內湖區'),
  S('東湖', ['BR'], '台北市', '內湖區'),
  S('南港軟體園區', ['BR'], '台北市', '南港區'),
  S('南港展覽館', ['BR', 'BL'], '台北市', '南港區'),
  // 淡水信義線
  S('淡水', ['R'], '新北市', '淡水區'),
  S('紅樹林', ['R'], '新北市', '淡水區'),
  S('竹圍', ['R'], '新北市', '淡水區'),
  S('關渡', ['R'], '台北市', '北投區'),
  S('忠義', ['R'], '台北市', '北投區'),
  S('復興崗', ['R'], '台北市', '北投區'),
  S('北投', ['R'], '台北市', '北投區'),
  S('新北投', ['R'], '台北市', '北投區'),
  S('奇岩', ['R'], '台北市', '北投區'),
  S('唭哩岸', ['R'], '台北市', '北投區'),
  S('石牌', ['R'], '台北市', '北投區'),
  S('明德', ['R'], '台北市', '北投區'),
  S('芝山', ['R'], '台北市', '士林區'),
  S('士林', ['R'], '台北市', '士林區'),
  S('劍潭', ['R'], '台北市', '士林區'),
  S('圓山', ['R'], '台北市', '中山區'),
  S('民權西路', ['R', 'O'], '台北市', '中山區'),
  S('雙連', ['R'], '台北市', '中山區'),
  S('中山', ['R', 'G'], '台北市', '中山區'),
  S('台北車站', ['R', 'BL'], '台北市', '中正區'),
  S('台大醫院', ['R'], '台北市', '中正區'),
  S('中正紀念堂', ['R', 'G'], '台北市', '中正區'),
  S('東門', ['R', 'O'], '台北市', '大安區'),
  S('大安森林公園', ['R'], '台北市', '大安區'),
  S('信義安和', ['R'], '台北市', '大安區'),
  S('台北101/世貿', ['R'], '台北市', '信義區'),
  S('象山', ['R'], '台北市', '信義區'),
  // 松山新店線
  S('松山', ['G'], '台北市', '松山區'),
  S('南京三民', ['G'], '台北市', '松山區'),
  S('台北小巨蛋', ['G'], '台北市', '松山區'),
  S('松江南京', ['G', 'O'], '台北市', '中山區'),
  S('北門', ['G'], '台北市', '大同區'),
  S('西門', ['G', 'BL'], '台北市', '萬華區'),
  S('小南門', ['G'], '台北市', '中正區'),
  S('古亭', ['G', 'O'], '台北市', '中正區'),
  S('台電大樓', ['G'], '台北市', '中正區'),
  S('公館', ['G'], '台北市', '中正區'),
  S('萬隆', ['G'], '台北市', '文山區'),
  S('景美', ['G'], '台北市', '文山區'),
  S('大坪林', ['G', 'Y'], '新北市', '新店區'),
  S('七張', ['G'], '新北市', '新店區'),
  S('小碧潭', ['G'], '新北市', '新店區'),
  S('新店區公所', ['G'], '新北市', '新店區'),
  S('新店', ['G'], '新北市', '新店區'),
  // 中和新蘆線
  S('南勢角', ['O'], '新北市', '中和區'),
  S('景安', ['O', 'Y'], '新北市', '中和區'),
  S('永安市場', ['O'], '新北市', '中和區'),
  S('頂溪', ['O'], '新北市', '永和區'),
  S('忠孝新生', ['O', 'BL'], '台北市', '中正區'),
  S('行天宮', ['O'], '台北市', '中山區'),
  S('中山國小', ['O'], '台北市', '中山區'),
  S('大橋頭', ['O'], '台北市', '大同區'),
  S('台北橋', ['O'], '新北市', '三重區'),
  S('菜寮', ['O'], '新北市', '三重區'),
  S('三重', ['O'], '新北市', '三重區'),
  S('先嗇宮', ['O'], '新北市', '三重區'),
  S('頭前庄', ['O', 'Y'], '新北市', '新莊區'),
  S('新莊', ['O'], '新北市', '新莊區'),
  S('輔大', ['O'], '新北市', '新莊區'),
  S('丹鳳', ['O'], '新北市', '新莊區'),
  S('迴龍', ['O'], '新北市', '新莊區'),
  S('三重國小', ['O'], '新北市', '三重區'),
  S('三和國中', ['O'], '新北市', '三重區'),
  S('徐匯中學', ['O'], '新北市', '蘆洲區'),
  S('三民高中', ['O'], '新北市', '蘆洲區'),
  S('蘆洲', ['O'], '新北市', '蘆洲區'),
  // 板南線
  S('頂埔', ['BL'], '新北市', '土城區'),
  S('永寧', ['BL'], '新北市', '土城區'),
  S('土城', ['BL'], '新北市', '土城區'),
  S('海山', ['BL'], '新北市', '土城區'),
  S('亞東醫院', ['BL'], '新北市', '板橋區'),
  S('府中', ['BL'], '新北市', '板橋區'),
  S('板橋', ['BL', 'Y'], '新北市', '板橋區'),
  S('新埔', ['BL'], '新北市', '板橋區'),
  S('江子翠', ['BL'], '新北市', '板橋區'),
  S('龍山寺', ['BL'], '台北市', '萬華區'),
  S('善導寺', ['BL'], '台北市', '中正區'),
  S('忠孝敦化', ['BL'], '台北市', '大安區'),
  S('國父紀念館', ['BL'], '台北市', '信義區'),
  S('市政府', ['BL'], '台北市', '信義區'),
  S('永春', ['BL'], '台北市', '信義區'),
  S('後山埤', ['BL'], '台北市', '南港區'),
  S('昆陽', ['BL'], '台北市', '南港區'),
  S('南港', ['BL'], '台北市', '南港區'),
  // 環狀線
  S('十四張', ['Y'], '新北市', '新店區'),
  S('秀朗橋', ['Y'], '新北市', '中和區'),
  S('景平', ['Y'], '新北市', '中和區'),
  S('中和', ['Y'], '新北市', '中和區'),
  S('橋和', ['Y'], '新北市', '中和區'),
  S('中原', ['Y'], '新北市', '中和區'),
  S('板新', ['Y'], '新北市', '板橋區'),
  S('新埔民生', ['Y'], '新北市', '板橋區'),
  S('幸福', ['Y'], '新北市', '新莊區'),
  S('新北產業園區', ['Y'], '新北市', '新莊區'),
];

export const METRO_STATION_NAMES: string[] = METRO_STATIONS.map((s) => `${s.name}站`);

export function findStation(nameWithOrWithoutSuffix: string): MetroStation | undefined {
  const clean = nameWithOrWithoutSuffix.replace(/站$/, '').replace(/^捷運/, '').trim();
  return METRO_STATIONS.find((s) => s.name === clean);
}

export interface ZoneArea {
  name: string;
  /** 關鍵字（出現任一即命中） */
  keywords: string[];
  city: '台北市' | '新北市';
  district: string;
  /** 代表捷運站（含「站」字；無捷運則留空） */
  mrt?: string;
}

export const ZONES: ZoneArea[] = [
  { name: '赤峰街・中山商圈', keywords: ['赤峰街', '中山商圈', '南西', '條通', '中山站'], city: '台北市', district: '中山區', mrt: '中山站' },
  { name: '東區・忠孝敦化', keywords: ['東區', '忠孝敦化', '敦南', '延吉街', '大安路'], city: '台北市', district: '大安區', mrt: '忠孝敦化站' },
  { name: '信義商圈', keywords: ['信義商圈', '信義區', '101', '市政府', '松高路', '松壽路'], city: '台北市', district: '信義區', mrt: '市政府站' },
  { name: '永康街・東門', keywords: ['永康街', '麗水街', '東門', '金華街', '青田街'], city: '台北市', district: '大安區', mrt: '東門站' },
  { name: '公館・溫州街', keywords: ['公館', '溫州街', '台大', '汀州路', '羅斯福路四段'], city: '台北市', district: '中正區', mrt: '公館站' },
  { name: '師大・古亭', keywords: ['師大', '古亭', '泰順街', '龍泉街', '雲和街'], city: '台北市', district: '大安區', mrt: '台電大樓站' },
  { name: '西門町', keywords: ['西門町', '西門', '萬華', '艋舺', '剝皮寮'], city: '台北市', district: '萬華區', mrt: '西門站' },
  { name: '大稻埕・迪化街', keywords: ['大稻埕', '迪化街', '永樂市場', '北門'], city: '台北市', district: '大同區', mrt: '北門站' },
  { name: '華山・忠孝新生', keywords: ['華山', '忠孝新生', '八德路一段', '光華商場'], city: '台北市', district: '中正區', mrt: '忠孝新生站' },
  { name: '松菸・民生社區', keywords: ['松菸', '松山文創', '民生社區', '富錦街', '國父紀念館'], city: '台北市', district: '松山區', mrt: '國父紀念館站' },
  { name: '天母', keywords: ['天母', '芝山'], city: '台北市', district: '士林區', mrt: '芝山站' },
  { name: '士林・劍潭', keywords: ['士林夜市', '士林', '劍潭', '陽明山'], city: '台北市', district: '士林區', mrt: '劍潭站' },
  { name: '北投溫泉', keywords: ['北投', '新北投', '北投溫泉'], city: '台北市', district: '北投區', mrt: '新北投站' },
  { name: '內湖・大直', keywords: ['內湖', '大直', '美麗華', '港墘', '西湖'], city: '台北市', district: '內湖區', mrt: '西湖站' },
  { name: '貓空・木柵', keywords: ['貓空', '木柵', '動物園', '指南宮'], city: '台北市', district: '文山區', mrt: '動物園站' },
  { name: '板橋府中・新板特區', keywords: ['板橋', '府中', '新板', '江子翠', '新埔'], city: '新北市', district: '板橋區', mrt: '府中站' },
  { name: '永和・頂溪', keywords: ['永和', '頂溪', '樂華夜市'], city: '新北市', district: '永和區', mrt: '頂溪站' },
  { name: '中和・四號公園', keywords: ['中和', '四號公園', '永安市場', '景安', '南勢角'], city: '新北市', district: '中和區', mrt: '永安市場站' },
  { name: '淡水老街・漁人碼頭', keywords: ['淡水', '漁人碼頭', '紅毛城', '紅樹林'], city: '新北市', district: '淡水區', mrt: '淡水站' },
  { name: '新店・碧潭', keywords: ['新店', '碧潭', '大坪林'], city: '新北市', district: '新店區', mrt: '新店站' },
  { name: '三重・蘆洲', keywords: ['三重', '蘆洲', '台北橋', '菜寮'], city: '新北市', district: '三重區', mrt: '三重站' },
  { name: '新莊・輔大', keywords: ['新莊', '輔大', '頭前庄', '新莊廟街'], city: '新北市', district: '新莊區', mrt: '新莊站' },
  { name: '土城・頂埔', keywords: ['土城', '頂埔', '海山', '永寧'], city: '新北市', district: '土城區', mrt: '土城站' },
  { name: '三峽老街', keywords: ['三峽'], city: '新北市', district: '三峽區' },
  { name: '鶯歌老街', keywords: ['鶯歌'], city: '新北市', district: '鶯歌區' },
  { name: '九份・金瓜石', keywords: ['九份', '金瓜石', '瑞芳'], city: '新北市', district: '瑞芳區' },
  { name: '汐止', keywords: ['汐止'], city: '新北市', district: '汐止區' },
  { name: '林口', keywords: ['林口', '三井 outlet', '林口三井'], city: '新北市', district: '林口區' },
  { name: '烏來', keywords: ['烏來'], city: '新北市', district: '烏來區' },
  { name: '平溪・十分', keywords: ['平溪', '十分', '菁桐'], city: '新北市', district: '平溪區' },
  { name: '金山・萬里', keywords: ['金山', '萬里', '野柳'], city: '新北市', district: '金山區' },
  { name: '八里', keywords: ['八里', '左岸'], city: '新北市', district: '八里區' },
  { name: '深坑老街', keywords: ['深坑'], city: '新北市', district: '深坑區' },
];

/** 其他縣市關鍵字 → 縣市名 */
export const OTHER_CITY_KEYWORDS: Array<{ city: string; keywords: string[] }> = [
  { city: '基隆市', keywords: ['基隆', '正濱', '和平島'] },
  { city: '桃園市', keywords: ['桃園', '中壢', '大溪', '龍潭', '楊梅', '平鎮', '八德', '蘆竹', '龜山'] },
  { city: '新竹市', keywords: ['新竹市', '新竹', '竹北', '竹東', '關西', '內灣'] },
  { city: '苗栗縣', keywords: ['苗栗', '三義', '南庄', '頭份', '竹南'] },
  { city: '台中市', keywords: ['台中', '臺中', '逢甲', '審計新村', '勤美', '草悟道', '西屯', '北屯', '南屯'] },
  { city: '彰化縣', keywords: ['彰化', '鹿港', '員林'] },
  { city: '南投縣', keywords: ['南投', '日月潭', '清境', '埔里', '溪頭'] },
  { city: '雲林縣', keywords: ['雲林', '斗六', '北港', '虎尾'] },
  { city: '嘉義市', keywords: ['嘉義', '阿里山', '檜意森活村'] },
  { city: '台南市', keywords: ['台南', '臺南', '安平', '神農街', '國華街'] },
  { city: '高雄市', keywords: ['高雄', '駁二', '美濃', '旗津', '左營', '鹽埕'] },
  { city: '屏東縣', keywords: ['屏東', '墾丁', '恆春', '小琉球', '潮州'] },
  { city: '宜蘭縣', keywords: ['宜蘭', '礁溪', '羅東', '頭城', '冬山', '蘇澳', '員山'] },
  { city: '花蓮縣', keywords: ['花蓮', '太魯閣', '七星潭', '壽豐', '瑞穗'] },
  { city: '台東縣', keywords: ['台東', '臺東', '池上', '鹿野', '都蘭', '綠島', '蘭嶼'] },
  { city: '澎湖縣', keywords: ['澎湖', '馬公'] },
  { city: '金門縣', keywords: ['金門'] },
  { city: '連江縣', keywords: ['馬祖', '連江'] },
];

export function districtToCity(district: string): string | undefined {
  if ((TAIPEI_DISTRICTS as readonly string[]).includes(district)) return '台北市';
  if ((NEW_TAIPEI_DISTRICTS as readonly string[]).includes(district)) return '新北市';
  return undefined;
}

/** 常見同名行政區消歧（如「中山」在雙北沒有重複，但「中正」只在台北；板橋等只在新北） */
export function districtsForCity(city: string): readonly string[] {
  return DISTRICTS_BY_CITY[city] || [];
}

export function stationsForCity(city: string): MetroStation[] {
  return METRO_STATIONS.filter((s) => s.city === city);
}

export function stationsForDistrict(district: string): MetroStation[] {
  return METRO_STATIONS.filter((s) => s.district === district);
}
