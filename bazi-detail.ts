/** 八字细盘纯规则计算：日主旺衰评分与常见神煞。不依赖模型与随机抽取，结果仅供排盘展示与解读上下文，非确定性吉凶判定。 */

/** 单柱核心信息：天干、地支、地支藏干，用于旺衰与神煞判定。 */
export interface BaziPillarInput {
  gan: string;
  zhi: string;
  hideGan: string[];
}

/** 旺衰与神煞计算的输入：日主天干 + 四柱（年、月、日、时）。 */
export interface BaziDetailInput {
  dayGan: string;
  pillars: BaziPillarInput[];
}

/** 单个神煞在命局中的落点。 */
export interface ShenSha {
  name: string;
  desc: string;
  locations: { branch: string; pillar: string }[];
}

/** 日主旺衰评分结果。 */
export interface Strength {
  score: number;
  level: string;
  factors: string[];
  note: string;
}

/** 八字细盘计算结果。 */
export interface BaziDetail {
  dayMaster: { gan: string; element: string; yinYang: '阳' | '阴' };
  strength: Strength;
  shensha: ShenSha[];
}

/** 天干五行。 */
const GAN_ELEMENT: Record<string, string> = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
/** 天干阴阳（true=阳干）。 */
const GAN_YANG: Record<string, boolean> = { 甲: true, 丙: true, 戊: true, 庚: true, 壬: true, 乙: false, 丁: false, 己: false, 辛: false, 癸: false };
/** 地支五行。 */
const ZHI_ELEMENT: Record<string, string> = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
/** 五行相生：木→火→土→金→水→木。 */
const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 五行相克：木克土、火克金、土克水、金克木、水克火。 */
const KE: Record<string, string> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };

const PILLAR_NAMES = ['年柱', '月柱', '日柱', '时柱'];

/** 返回某五行相对日主的生扶/克泄强度权重（正=帮扶，负=削弱）。 */
function relationWeight(me: string, element: string): number {
  if (element === me) return 1;            // 同我：比劫
  if (SHENG[element] === me) return 0.75;  // 生我：印
  if (SHENG[me] === element) return -0.75; // 我生：食伤（泄）
  if (KE[me] === element) return -0.5;     // 我克：财（耗）
  if (KE[element] === me) return -1;       // 克我：官杀（克）
  return 0;
}

/** 关系的中文描述，用于旺衰因子可读呈现。 */
function relationName(me: string, element: string): string {
  if (element === me) return '与日主同气';
  if (SHENG[element] === me) return '生扶日主';
  if (SHENG[me] === element) return '日主所生（泄气）';
  if (KE[me] === element) return '日主所克（耗气）';
  if (KE[element] === me) return '克制日主';
  return '中性';
}

/** 依据「月令 + 天干 + 地支藏干」三分的生扶与克泄简化评分，归入身强/偏强/中和/偏弱/身弱五档。 */
function dayMasterStrength(dayGan: string, pillars: BaziPillarInput[]): Strength {
  const me = GAN_ELEMENT[dayGan];
  const monthZhi = pillars[1]?.zhi ?? '';
  const monthElement = ZHI_ELEMENT[monthZhi] ?? '';
  let score = 0;
  const factors: string[] = [];

  // 月令权重最高，决定得令/失令。
  const monthWeight = relationWeight(me, monthElement);
  score += Math.round(monthWeight * 40);
  factors.push(`月令${monthZhi || '—'}（${monthElement || '—'}）${relationName(me, monthElement)}`);

  // 天干（年/月/时干）计得势，生扶与克泄分别计数。
  let ganHelp = 0, ganDrain = 0;
  for (const i of [0, 1, 3]) {
    const g = pillars[i]?.gan ?? '';
    if (!g) continue;
    const w = relationWeight(me, GAN_ELEMENT[g] ?? '');
    score += Math.round(w * 10);
    if (w >= 0) ganHelp++; else ganDrain++;
  }
  factors.push(`三干生扶 ${ganHelp}、克泄 ${ganDrain}`);

  // 地支藏干计得地。
  let zhiHelp = 0, zhiDrain = 0;
  for (const p of pillars) for (const h of p.hideGan ?? []) {
    const w = relationWeight(me, GAN_ELEMENT[h] ?? '');
    score += Math.round(w * 4);
    if (w >= 0) zhiHelp++; else zhiDrain++;
  }
  factors.push(`四支藏干生扶 ${zhiHelp}、克泄 ${zhiDrain}`);

  // 归入五档。
  const level = score >= 50 ? '身强' : score >= 15 ? '偏强' : score >= -14 ? '中和' : score >= -49 ? '偏弱' : '身弱';
  return { score, level, factors, note: '旺衰为「月令 + 天干 + 地支藏干」三分生扶/克泄的简化评分，仅用于理解命局强弱倾向，非严谨八字喜用神判定。' };
}

/** 在四柱地支中查找目标支，命中则记录所在柱位。 */
function locate(targets: string[], pillars: BaziPillarInput[]): { branch: string; pillar: string }[] {
  const out: { branch: string; pillar: string }[] = [];
  pillars.forEach((p, i) => { if (targets.includes(p.zhi)) out.push({ branch: p.zhi, pillar: PILLAR_NAMES[i] }); });
  return out;
}

/** 依地支所属三合局返回局名：申子辰水、寅午戌火、巳酉丑金、亥卯未木。 */
function sanHe(zhi: string): string {
  if ('申子辰'.includes(zhi)) return '水';
  if ('寅午戌'.includes(zhi)) return '火';
  if ('巳酉丑'.includes(zhi)) return '金';
  if ('亥卯未'.includes(zhi)) return '木';
  return '';
}

/** 天乙贵人：以日干查对应二支（甲戊庚牛羊、乙己鼠猴、丙丁猪鸡、壬癸兔蛇、六辛逢马虎）。 */
const TIANYI: Record<string, [string, string]> = { 甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'], 辛: ['寅', '午'] };
/** 文昌贵人：以日干查一支。 */
const WENCHANG: Record<string, string> = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
/** 羊刃：阳日干所临之刃支，阴日干无。 */
const YANGREN: Record<string, string> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
/** 桃花（咸池）、驿马、华盖、将星：按日支三合局取对应支。 */
const SANHE_STAR: Record<string, Record<string, string>> = {
  桃花: { 水: '酉', 火: '卯', 金: '午', 木: '子' },
  驿马: { 水: '寅', 火: '申', 金: '亥', 木: '巳' },
  华盖: { 水: '辰', 火: '戌', 金: '丑', 木: '未' },
  将星: { 水: '子', 火: '午', 金: '酉', 木: '卯' },
};

/** 依据日干与日支，判定常见神煞在四柱的落点；仅返回命中有落点的神煞。 */
function shenSha(dayGan: string, pillars: BaziPillarInput[]): ShenSha[] {
  const list: ShenSha[] = [];
  const push = (name: string, desc: string, targets: string[]) => {
    const locations = locate(targets, pillars);
    if (locations.length) list.push({ name, desc, locations });
  };
  // 以日干查：天乙、文昌、羊刃。
  if (TIANYI[dayGan]) push('天乙贵人', '逢凶化吉、得遇贵人之象', TIANYI[dayGan]);
  if (WENCHANG[dayGan]) push('文昌贵人', '主敏而好学、才思清利', [WENCHANG[dayGan]]);
  if (YANGREN[dayGan]) push('羊刃', '性刚果断，宜防急躁冲动', [YANGREN[dayGan]]);
  // 以日支三合局查：桃花、驿马、华盖、将星。
  const ju = sanHe(pillars[2]?.zhi ?? '');
  if (ju) {
    push('桃花', '主异性人缘与才艺，宜守分寸', [SANHE_STAR.桃花[ju]]);
    push('驿马', '主变动迁移、奔波远行', [SANHE_STAR.驿马[ju]]);
    push('华盖', '主艺术慧根，性喜清静', [SANHE_STAR.华盖[ju]]);
    push('将星', '主领导统御之才', [SANHE_STAR.将星[ju]]);
  }
  return list;
}

/** 计算八字细盘：日主信息、旺衰评分与常见神煞落点。 */
export function calculateBaziDetail(input: BaziDetailInput): BaziDetail {
  const { dayGan, pillars } = input;
  return {
    dayMaster: { gan: dayGan, element: GAN_ELEMENT[dayGan] ?? '', yinYang: GAN_YANG[dayGan] ? '阳' : '阴' },
    strength: dayMasterStrength(dayGan, pillars),
    shensha: shenSha(dayGan, pillars),
  };
}