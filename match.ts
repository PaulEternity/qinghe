/** 双人合盘纯规则分析：基于双方日主五行生克、旺衰喜用与十神关系给出结构化参考；不依赖模型，结果为民俗与象征性提示，非关系结局的确定性判断。 */
import { GAN_ELEMENT, SHENG, KE, shiShen, favorableElements } from './wuxing.ts';

/** 合盘一方所需的最小信息（由 bazi() 结果的 dayMaster 与 strength 投影而来）。 */
export interface MatchParty {
  dayMaster: { gan: string; element: string; yinYang: '阳' | '阴' };
  strength: { level: string };
}

/** 五行关系方向：以 a 为主体看待与 b 的生克。 */
function relationDirection(a: string, b: string): string {
  if (a === b) return '同气';
  if (SHENG[a] === b) return '生';    // a 生 b
  if (SHENG[b] === a) return '被生';  // b 生 a
  if (KE[a] === b) return '克';       // a 克 b
  if (KE[b] === a) return '被克';     // b 克 a
  return '中性';
}

/** 五行关系的中文解释，措辞中性、不作吉凶断言。 */
const REL_TEXT: Record<string, string> = {
  同气: '同气相求，节奏相近',
  生: '倾向付出与带动',
  被生: '易感到滋养与支持',
  克: '主见上更占主导',
  被克: '相处中需更多调试与让步',
};

/** 计算双人合盘：双方喜用/忌神、五行生克方向与十神对照，并提炼互补与需磨合点。 */
export function calculateMatch(a: MatchParty, b: MatchParty) {
  const aGan = a.dayMaster.gan, bGan = b.dayMaster.gan;
  const aEl = a.dayMaster.element || GAN_ELEMENT[aGan] || '';
  const bEl = b.dayMaster.element || GAN_ELEMENT[bGan] || '';
  const aFav = favorableElements(aGan, a.strength.level);
  const bFav = favorableElements(bGan, b.strength.level);

  // 双向五行关系（aToB 与 bToA 对称，如 a 生 b 则 b 为「被生」）。
  const aToB = relationDirection(aEl, bEl);
  const bToA = relationDirection(bEl, aEl);

  // 十神对照：aOfB 表示「以你为日主、对方是你的十神」，bOfA 反之。
  const aOfB = shiShen(aGan, bGan);
  const bOfA = shiShen(bGan, aGan);

  // 提炼互补与磨合点：以对方日主五行是否命中自己的喜用/忌神为准。
  const highlights: string[] = [];
  highlights.push(`日主五行：你${aEl}、对方${bEl}，${REL_TEXT[aToB] || '生克关系不显'}。`);
  if (aFav.favorable.includes(bEl)) highlights.push(`对方日主属${bEl}，恰在你喜用之列，易带来补充与支持。`);
  if (aFav.unfavorable.includes(bEl)) highlights.push(`对方日主属${bEl}，落在你忌神之列，相处需在节奏上多加磨合。`);
  if (bFav.favorable.includes(aEl)) highlights.push(`你的日主属${aEl}，正是对方的喜用，你能给对方带去支持。`);
  if (bFav.unfavorable.includes(aEl)) highlights.push(`你的日主属${aEl}，属对方的忌神，宜留意彼此的能量消耗。`);
  if (aOfB && bOfA) highlights.push(`十神上，对方相对你为「${aOfB}」，你相对对方为「${bOfA}」。`);

  return {
    rules: { version: 'match-v1', note: '合盘以双方日主五行生克、旺衰喜用与十神关系为依据，属民俗与象征性参考，不构成对关系结果与吉凶的确定性判断。' },
    a: { gan: aGan, element: aEl, yinYang: a.dayMaster.yinYang, level: a.strength.level, favorable: aFav.favorable, unfavorable: aFav.unfavorable },
    b: { gan: bGan, element: bEl, yinYang: b.dayMaster.yinYang, level: b.strength.level, favorable: bFav.favorable, unfavorable: bFav.unfavorable },
    elementRelation: { aToB, bToA, summary: `你${aEl}，对方${bEl}：${REL_TEXT[aToB] || '生克关系不显'}。` },
    shishen: { aOfB, bOfA },
    highlights,
  };
}