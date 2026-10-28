/** 五行与干支基础规则：天干地支五行、阴阳、相生相克、十神推导，以及依日主旺衰给出的喜用/忌神方向。供八字细盘、流年流月、每日运势、六爻、合盘与起名等模块复用，避免重复定义。 */

/** 天干五行。 */
export const GAN_ELEMENT: Record<string, string> = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
/** 天干阴阳（true=阳干）。 */
export const GAN_YANG: Record<string, boolean> = { 甲: true, 丙: true, 戊: true, 庚: true, 壬: true, 乙: false, 丁: false, 己: false, 辛: false, 癸: false };
/** 地支五行。 */
export const ZHI_ELEMENT: Record<string, string> = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
/** 五行相生：木→火→土→金→水→木。 */
export const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 五行相克：木克土、火克金、土克水、金克木、水克火。 */
export const KE: Record<string, string> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };

/** 生我之五行（印星），无对应则返回空串。 */
export function parentOf(element: string): string {
  for (const k in SHENG) if (SHENG[k] === element) return k;
  return '';
}

/** 克我之五行（官杀），无对应则返回空串。 */
export function controllerOf(element: string): string {
  for (const k in KE) if (KE[k] === element) return k;
  return '';
}

/** 以日主天干为「我」，求他干对应的十神（比肩/劫财/食神/伤官/偏财/正财/七杀/正官/偏印/正印）。 */
export function shiShen(dayGan: string, targetGan: string): string {
  if (!dayGan || !targetGan) return '';
  const de = GAN_ELEMENT[dayGan], te = GAN_ELEMENT[targetGan], same = GAN_YANG[dayGan] === GAN_YANG[targetGan];
  if (de === te) return same ? '比肩' : '劫财';
  if (SHENG[de] === te) return same ? '食神' : '伤官';
  if (KE[de] === te) return same ? '偏财' : '正财';
  if (KE[te] === de) return same ? '七杀' : '正官';
  if (SHENG[te] === de) return same ? '偏印' : '正印';
  return '';
}

/** 某五行的生扶者：生我（印）+ 同我（比劫），用于身弱取用与每日运势的可留意五行。 */
export function supportive(element: string): string[] {
  const parent = parentOf(element);
  return parent ? [...new Set([parent, element])] : [element];
}

/** 身强档位（含偏强），用于区分喜用方向。 */
const STRONG_LEVELS = new Set(['身强', '偏强']);

/** 喜用/忌神方向：身弱喜印比（生我+同我），身强喜食伤财官（我生/我克/克我）；中和则取平衡、不偏不倚。 */
export function favorableElements(dayGan: string, level: string): { favorable: string[]; unfavorable: string[]; note: string } {
  const me = GAN_ELEMENT[dayGan] ?? '';
  const help = [...new Set([parentOf(me), me].filter(Boolean))];                       // 生我 + 同我
  const drain = [...new Set([SHENG[me], KE[me], controllerOf(me)].filter(Boolean))];  // 我生 + 我克 + 克我
  if (STRONG_LEVELS.has(level)) return { favorable: drain, unfavorable: help, note: '日主偏旺，宜以克、泄、耗（官杀/食伤/财）为用，忌再生扶。' };
  if (level === '身弱' || level === '偏弱') return { favorable: help, unfavorable: drain, note: '日主偏弱，宜以印、比劫生扶为用，忌再见克泄耗。' };
  return { favorable: help, unfavorable: drain, note: '日主中和，喜忌不显，生扶与克泄耗大致平衡，取用宜配合命局细节。' };
}