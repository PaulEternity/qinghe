/** 太阳星座匹配：以用户确认的星座生成固定文化参考，不计算星盘或关系概率。 */
type Element = '火象' | '土象' | '风象' | '水象';
type Modality = '基本宫' | '固定宫' | '变动宫';

/** 星座资料只描述传统象征；不根据日期近似值推断交界日星座。 */
interface Sign { id: string; name: string; symbol: string; element: Element; modality: Modality }
export const ZODIAC_SIGNS: readonly Sign[] = [
  {id:'aries',name:'白羊座',symbol:'♈',element:'火象',modality:'基本宫'},
  {id:'taurus',name:'金牛座',symbol:'♉',element:'土象',modality:'固定宫'},
  {id:'gemini',name:'双子座',symbol:'♊',element:'风象',modality:'变动宫'},
  {id:'cancer',name:'巨蟹座',symbol:'♋',element:'水象',modality:'基本宫'},
  {id:'leo',name:'狮子座',symbol:'♌',element:'火象',modality:'固定宫'},
  {id:'virgo',name:'处女座',symbol:'♍',element:'土象',modality:'变动宫'},
  {id:'libra',name:'天秤座',symbol:'♎',element:'风象',modality:'基本宫'},
  {id:'scorpio',name:'天蝎座',symbol:'♏',element:'水象',modality:'固定宫'},
  {id:'sagittarius',name:'射手座',symbol:'♐',element:'火象',modality:'变动宫'},
  {id:'capricorn',name:'摩羯座',symbol:'♑',element:'土象',modality:'基本宫'},
  {id:'aquarius',name:'水瓶座',symbol:'♒',element:'风象',modality:'固定宫'},
  {id:'pisces',name:'双鱼座',symbol:'♓',element:'水象',modality:'变动宫'}
];

export const ZODIAC_ELEMENTS: Record<Element, string> = {
  火象:'白羊、狮子、射手：传统上象征热情、行动与表达，交流时也要给彼此留出倾听的空间。',
  土象:'金牛、处女、摩羯：传统上象征务实、稳定与积累，交流时也可主动表达感受。',
  风象:'双子、天秤、水瓶：传统上象征思考、交流与自由，约定落地行动有助于建立信任。',
  水象:'巨蟹、天蝎、双鱼：传统上象征情绪、共情与联结，直接说出需求比让对方猜更有效。'
};

/** 每种无序元素组合都有优势、磨合点及可执行建议；交换双方不改变规则。 */
const PAIRS: Record<string, {theme: string; strength: string; friction: string; advice: string}> = {
  '火象/火象':{theme:'同元素 · 行动共鸣',strength:'容易在热情和尝试新事物上找到共同语言。',friction:'都想迅速表达时，容易忽略对方的节奏。',advice:'轮流表达，冲突时先暂停，再约定下一步。'},
  '土象/土象':{theme:'同元素 · 稳定共鸣',strength:'容易围绕日常安排和长期计划建立默契。',friction:'双方都坚持熟悉方式时，调整可能变慢。',advice:'保留稳定约定，也定期一起尝试一件小变化。'},
  '风象/风象':{theme:'同元素 · 交流共鸣',strength:'容易通过讨论、分享观点和兴趣保持连接。',friction:'想法很多时，行动与情绪回应可能跟不上。',advice:'把讨论变成一项具体约定，也问问彼此的感受。'},
  '水象/水象':{theme:'同元素 · 感受共鸣',strength:'容易把关心、陪伴和情感回应放在重要位置。',friction:'彼此猜测情绪时，误解可能逐渐积累。',advice:'明确说出需要的支持，避免用沉默测试关系。'},
  '火象/风象':{theme:'不同元素 · 灵感与行动',strength:'传统上视为相互带动：想法与行动可以互相激发。',friction:'行动速度与讨论空间的需求可能不同。',advice:'先确认共同目标，再约定何时讨论、何时行动。'},
  '土象/水象':{theme:'不同元素 · 安定与关怀',strength:'传统上视为相互支持：实际照顾与情感回应可以互补。',friction:'解决问题与先被理解的需求可能错位。',advice:'先问对方希望被倾听还是一起找办法。'},
  '火象/土象':{theme:'不同元素 · 推进与规划',strength:'尝试的动力与落实的耐心可以相互补充。',friction:'对速度、风险与准备程度的偏好可能不同。',advice:'把新计划拆成小步，约定预算、时间和复盘点。'},
  '火象/水象':{theme:'不同元素 · 表达与感受',strength:'直接表达与细腻回应可以带来不同视角。',friction:'直率表达可能被理解为忽略感受。',advice:'表达观点前先确认感受，需求用具体话说清楚。'},
  '土象/风象':{theme:'不同元素 · 落实与探索',strength:'稳定执行与开放思路可以共同完善计划。',friction:'对确定性和自由度的期待可能不同。',advice:'区分必须遵守的约定和可以自由调整的空间。'},
  '风象/水象':{theme:'不同元素 · 思考与共情',strength:'观点交流与感受分享可以拓宽彼此的理解。',friction:'讲道理与需要情绪回应的时机可能错开。',advice:'先复述对方的感受，再分享分析与建议。'}
};
const ELEMENT_ORDER: Element[] = ['火象','土象','风象','水象'];
const MODALITIES: Record<Modality, string> = {
  基本宫:'倾向发起与推动，适合协商谁先带领、如何轮换。',
  固定宫:'倾向保持与坚持，适合约定何时坚持、何时调整。',
  变动宫:'倾向适应与变化，适合约定哪些承诺需要稳定执行。'
};

/** 只接受服务端白名单 ID，避免客户端伪造星座属性或把任意文本当计算依据。 */
export function matchZodiac(signA: unknown, signB: unknown) {
  const personA = ZODIAC_SIGNS.find(sign => sign.id === signA);
  const personB = ZODIAC_SIGNS.find(sign => sign.id === signB);
  if (!personA || !personB) throw new Error('请选择两个人的有效星座');
  // 排序后查询无序组合，确保交换双方仍得到相同的匹配依据。
  const key = [personA.element,personB.element].sort((a,b)=>ELEMENT_ORDER.indexOf(a)-ELEMENT_ORDER.indexOf(b)).join('/');
  return {
    personA: {...personA}, personB: {...personB},
    elements: {a:ZODIAC_ELEMENTS[personA.element],b:ZODIAC_ELEMENTS[personB.element]},
    pairing: {...PAIRS[key]},
    rhythm: {a:MODALITIES[personA.modality],b:MODALITIES[personB.modality],summary:personA.modality===personB.modality?'双方节奏相近，留意同一种倾向被放大。':'双方节奏不同，可协商由谁发起、落实及调整。'},
    rules: {version:1,method:'用户确认太阳星座；按传统四元素与基本/固定/变动三模式生成固定参考。',limit:'仅供娱乐与交流参考，不是完整合盘；未计算月亮、上升、行星相位或出生星盘，不代表真实人格、关系质量或成功概率。'}
  };
}
