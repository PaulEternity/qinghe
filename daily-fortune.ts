/** 每日运势计算模块：依据出生年月日推日主，结合今日干支给出传统参考；不依赖模型。 */
import lunar from 'lunar-javascript';

/** 天干五行与阴阳，用于十神推导。 */
const GAN_WUXING: Record<string,string> = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
/** 天干阴阳（true=阳干）。 */
const GAN_YANG: Record<string,boolean> = {甲:true,丙:true,戊:true,庚:true,壬:true,乙:false,丁:false,己:false,辛:false,癸:false};
/** 地支五行。 */
const ZHI_WUXING: Record<string,string> = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
/** 五行相生与相克（用于十神与生扶判断）。 */
const SHENG: Record<string,string> = {水:'木',木:'火',火:'土',土:'金',金:'水'};
const KE: Record<string,string> = {水:'火',火:'金',金:'木',木:'土',土:'水'};
/** 五行对民俗颜色、数字与方位，仅作象征性参考。 */
const WUXING_COLOR: Record<string,string> = {金:'白',木:'青',水:'黑',火:'红',土:'黄'};
const WUXING_NUMBER: Record<string,string> = {金:'4、9',木:'3、8',水:'1、6',火:'2、7',土:'5、0'};
const WUXING_DIRECTION: Record<string,string> = {金:'西',木:'东',水:'北',火:'南',土:'中'};

/** 以日主天干为「我」，求他干对应的十神。 */
function shishen(dayGan: string, otherGan: string): string {
  const me=GAN_WUXING[dayGan], he=GAN_WUXING[otherGan];
  const sameYin=GAN_YANG[dayGan]===GAN_YANG[otherGan];
  if(me===he)return sameYin?'比肩':'劫财';
  if(SHENG[he]===me)return sameYin?'偏印':'正印';
  if(SHENG[me]===he)return sameYin?'食神':'伤官';
  if(KE[he]===me)return sameYin?'七杀':'正官';
  if(KE[me]===he)return sameYin?'偏财':'正财';
  return '';
}

/** 十神对应的今日提示，措辞保持非确定性、不对现实结果作承诺。 */
const GUIDANCE: Record<string,string> = {
  比肩:'今日气场与自身相类，宜按自己的节奏行事，也可与同伴协作；不宜勉强迎合他人、逞强斗气。',
  劫财:'今日宜量入为出、守住边界；合作与分享能带来助力，但要留意不必要的开销与比较。',
  食神:'今日利于表达、创意与放松身心，适合把想法说清楚、做出来；注意言语分寸，避免过度消耗。',
  伤官:'今日才思较外露，宜用于创作与复盘，忌口快伤人、与规则硬碰；表达前多想一步。',
  偏财:'今日心思易落在机会与收益上，宜踏实推进具体事务；忌冲动投入或追逐不确定的捷径。',
  正财:'今日适合处理实务、理财与日常事务，稳扎稳打更容易见效；注意劳逸平衡，别只顾眼前。',
  七杀:'今日宜自律、守时、应对压力，把难题拆解后逐个处理；避免与人硬碰或逞一时之勇。',
  正官:'今日宜守规矩、讲分寸，按计划推进更容易顺利；留意职责与承诺，别过度应酬。',
  偏印:'今日适合独处思考、学点新东西或寻求专业支持；忌钻牛角尖、过度猜疑。',
  正印:'今日宜静心学习、复盘与求助长辈或可信之人；给自己留一点缓冲，不必急于求成。',
};

/** 返回某个五行的生扶者（生我 + 同我），用于给出可留意的五行领域。 */
function supportive(dayElement: string): string[] {
  const parent=Object.keys(SHENG).find(k=>SHENG[k]===dayElement);
  return parent?[...new Set([parent, dayElement])]:[dayElement];
}

/** 计算某一日的每日运势；birthday 为 'YYYY-MM-DD'，gender 仅存档、暂不参与计算。 */
export function calculateDailyFortune(birthday: string, gender?: string) {
  if(typeof birthday!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(birthday))throw new Error('出生日期格式无效');
  const [by,bm,bd]=birthday.split('-').map(Number);
  const birthEc=lunar.Solar.fromYmd(by,bm,bd).getLunar().getEightChar();
  const dayGan=birthEc.getDayGan(), dayElement=GAN_WUXING[dayGan];
  // 今日取服务器 UTC+8 日期，不接收客户端传入避免伪造。
  const now=new Date(Date.now()+8*3600000);
  const ty=now.getUTCFullYear(), tm=now.getUTCMonth()+1, td=now.getUTCDate();
  const today=lunar.Solar.fromYmd(ty,tm,td).getLunar();
  const dayGanZhi=today.getDayInGanZhi();
  const todayGan=dayGanZhi[0], todayZhi=dayGanZhi[1], todayElement=ZHI_WUXING[todayZhi];
  const relation=shishen(dayGan, todayGan);
  const favorable=supportive(dayElement);
  const supports=favorable.map((e: string)=>`${e}（${WUXING_COLOR[e]}色系）`).join('、');
  return {
    date:`${ty}-${String(tm).padStart(2,'0')}-${String(td).padStart(2,'0')}`,
    lunarDate:today.toString(),
    yearGanZhi:today.getYearInGanZhi(),
    monthGanZhi:today.getMonthInGanZhi(),
    dayGanZhi,
    dayMaster:dayGan,
    dayMasterElement:dayElement,
    relation,
    todayElement,
    luckyColor:WUXING_COLOR[todayElement],
    luckyNumbers:WUXING_NUMBER[todayElement],
    luckyDirection:WUXING_DIRECTION[todayElement],
    favorable:supports,
    guidance:GUIDANCE[relation]||'今日宜按自己的节奏行事，量力而为、顺其自然。',
    gender:gender||'',
    rules:{version:'daily-fortune-v1',note:`今日干支与农历为程序按 UTC+8 日期排出；「${relation}」为今日日干相对你日主（${dayGan}）的十神，幸运色/数字/方位为今日日支五行（${todayElement}）的民俗对应，生扶五行按「生我 + 同我」简化给出，非严谨八字喜用神。以上均为民俗与象征性参考，不作确定性吉凶或现实决策依据。`},
  };
}