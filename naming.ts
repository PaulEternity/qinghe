/** 东方起名纯规则：依八字喜用神补五行，从字库推荐候选用字。字库按常用偏旁与起名字典属性归类五行，寓意为民俗与文化参考，非确定性吉凶或强制建议。 */
import { GAN_ELEMENT, favorableElements } from './wuxing.ts';

/** 起名字条：用字、五行与寓意。 */
interface NameWord { char: string; meaning: string; }

/** 五行喜用字库，按偏旁（钅/木/氵/火/土）与常用起名字典属性归类。 */
const NAME_WORDS: Record<string, NameWord[]> = {
  金: [
    { char: '铭', meaning: '铭刻于心、才识显著' }, { char: '锋', meaning: '锐意进取' }, { char: '钧', meaning: '千钧之重、沉稳可靠' },
    { char: '钰', meaning: '珍玉光华' }, { char: '锐', meaning: '敏锐果敢' }, { char: '锦', meaning: '前程似锦' },
    { char: '钦', meaning: '敬重谦和' }, { char: '铮', meaning: '刚正有声' }, { char: '瑞', meaning: '祥瑞福泽' },
    { char: '珊', meaning: '温润雅致' }, { char: '玥', meaning: '美玉神珠' }, { char: '琳', meaning: '琳琅美玉' },
  ],
  木: [
    { char: '林', meaning: '生机繁茂' }, { char: '森', meaning: '繁盛绵延' }, { char: '柏', meaning: '坚贞长青' },
    { char: '楠', meaning: '栋梁之材' }, { char: '彬', meaning: '文质彬彬' }, { char: '柯', meaning: '枝叶兴起' },
    { char: '权', meaning: '通达权衡' }, { char: '柳', meaning: '柔韧灵动' }, { char: '栋', meaning: '栋梁担当' },
    { char: '荣', meaning: '欣欣向荣' }, { char: '楚', meaning: '清朗挺拔' }, { char: '桦', meaning: '正直高洁' },
  ],
  水: [
    { char: '泽', meaning: '恩泽润物' }, { char: '润', meaning: '温润滋养' }, { char: '洋', meaning: '胸怀宽广' },
    { char: '浩', meaning: '浩然正大' }, { char: '涵', meaning: '涵养深远' }, { char: '沐', meaning: '沐泽清新' },
    { char: '沁', meaning: '沁人心脾' }, { char: '淼', meaning: '水势浩渺' }, { char: '源', meaning: '源头活水' },
    { char: '涛', meaning: '奔涌向前' }, { char: '清', meaning: '清正明澈' }, { char: '潇', meaning: '潇洒从容' },
  ],
  火: [
    { char: '炎', meaning: '热烈光明' }, { char: '炜', meaning: '光彩照人' }, { char: '煜', meaning: '明亮照耀' },
    { char: '焕', meaning: '焕发光彩' }, { char: '熙', meaning: '和乐光明' }, { char: '灿', meaning: '灿烂夺目' },
    { char: '耀', meaning: '光耀出众' }, { char: '烨', meaning: '光辉灿烂' }, { char: '炫', meaning: '才华外显' },
    { char: '煌', meaning: '辉煌昌盛' }, { char: '炯', meaning: '目光有神' }, { char: '昕', meaning: '旭日初升' },
  ],
  土: [
    { char: '坤', meaning: '厚德载物' }, { char: '培', meaning: '培育根基' }, { char: '城', meaning: '稳重守护' },
    { char: '基', meaning: '根基稳固' }, { char: '峰', meaning: '层峦有志' }, { char: '岚', meaning: '山间清风' },
    { char: '峥', meaning: '峥嵘向上' }, { char: '屹', meaning: '屹立坚韧' }, { char: '岩', meaning: '坚如磐石' },
    { char: '域', meaning: '开阔有度' }, { char: '圣', meaning: '睿智通达' }, { char: '垚', meaning: '厚土高远' },
  ],
};

/** 起名输入：姓氏、日主天干与旺衰档位。 */
export interface NamingInput { surname: string; dayGan: string; strengthLevel: string; }

/** 单个候选名：姓名、用字、各字五行与综合寓意。 */
export interface NameCandidate { name: string; chars: string[]; elements: string[]; meaning: string; }

/** 已挑选的用字，自带五行与寓意，便于候选名与释义统一输出。 */
interface PickedWord { char: string; element: string; meaning: string; }

/** 依喜用神主次五行，从字库按固定顺序组合单字名与双字名候选，结果可复现、不随机。 */
export function calculateNaming(input: NamingInput) {
  const surname = (input.surname || '').trim();
  const me = GAN_ELEMENT[input.dayGan] ?? '';
  const { favorable, unfavorable } = favorableElements(input.dayGan, input.strengthLevel);
  const primary = favorable[0] || me;
  const secondary = favorable[1] || primary;
  const libA = NAME_WORDS[primary] || [];
  const libB = NAME_WORDS[secondary] || [];

  /** 从指定字库取第 i 个字并标注五行；越界返回 null 由后续过滤。 */
  const pickWord = (lib: NameWord[], i: number, element: string): PickedWord | null =>
    lib[i] ? { char: lib[i].char, element, meaning: lib[i].meaning } : null;

  // 固定顺序组合：单字名 2 个 + 双字名 4 个；主次同库时取同库相邻字，避免重字与重复名。
  const groups: PickedWord[][] = [];
  const push = (a: PickedWord | null, b: PickedWord | null) => {
    if (a && b && a.char === b.char) return;
    if (a) groups.push(b ? [a, b] : [a]);
  };
  push(pickWord(libA, 0, primary), null);
  push(pickWord(libA, 1, primary), null);
  if (primary !== secondary) {
    push(pickWord(libA, 0, primary), pickWord(libB, 0, secondary));
    push(pickWord(libA, 1, primary), pickWord(libB, 0, secondary));
    push(pickWord(libA, 0, primary), pickWord(libB, 1, secondary));
    push(pickWord(libB, 0, secondary), pickWord(libB, 1, secondary));
  } else {
    push(pickWord(libA, 0, primary), pickWord(libA, 1, primary));
    push(pickWord(libA, 1, primary), pickWord(libA, 2, primary));
    push(pickWord(libA, 2, primary), pickWord(libA, 3, primary));
    push(pickWord(libA, 3, primary), pickWord(libA, 4, primary));
  }

  const candidates: NameCandidate[] = groups.map(g => {
    const name = surname + g.map(w => w.char).join('');
    return {
      name,
      chars: g.map(w => w.char),
      elements: g.map(w => w.element),
      meaning: g.map(w => `${w.char}（${w.element}，${w.meaning}）`).join('、'),
    };
  });

  return {
    rules: { version: 'naming-v1', note: '起名依日主旺衰推导的喜用神选取补益五行，用字五行按偏旁与常用起名字典归类；寓意为民俗与文化参考，具体取名请结合姓氏音韵、家族字辈与个人偏好，非确定性吉凶。' },
    dayMaster: { gan: input.dayGan, element: me },
    strength: input.strengthLevel,
    favorable,
    unfavorable,
    primary,
    candidates,
  };
}