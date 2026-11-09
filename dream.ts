/** 梦境资料边界：校验用户提供的线索，供清和现有札记和 AI 流程共同使用。 */
export interface DreamInput {
  question: unknown;
  dreamDate?: unknown;
  emotions?: unknown;
  context?: unknown;
  recurringDream?: unknown;
  physiologySignals?: unknown;
  structureHint?: unknown;
}

/** 可选睡眠线索的稳定编码与中文名称；表单、持久化与模型上下文共用。 */
export const DREAM_SIGNALS: Record<string, string> = {
  sleep_deprived: '睡眠不足', light_sleep: '惊醒/浅睡', fatigue: '疲劳过载',
  alcohol: '饮酒刺激', discomfort: '身体不适', sleep_pressure: '鬼压床/动不了'
};

/** 限制可选文本的类型与原始长度，空值保留为未提供，不补造事实。 */
function optionalText(value: unknown, label: string, max: number) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error(`请填写有效的${label}，不超过 ${max} 字`);
  return value.trim();
}

/** 校验梦境正文、真实日期与枚举，只保留本次明确提交的资料。 */
export function prepareDream(input: DreamInput) {
  // 正文沿用现有 question 字段，限制与梦境输入框保持一致。
  const content = optionalText(input.question, '梦境内容', 2000);
  if (content.length < 5) throw new Error('请至少填写 5 个字的梦境内容');
  // 日期仅记录用户选择的公历日，不推断未填写的做梦时间。
  const dreamDate = optionalText(input.dreamDate, '做梦日期', 10);
  if (dreamDate) {
    const date = new Date(dreamDate + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dreamDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dreamDate) throw new Error('请填写真实有效的做梦日期');
  }
  // 空表示未说明，yes/no 分别表示反复梦境与偶发梦境。
  const recurringDream = optionalText(input.recurringDream, '重复梦境选项', 3);
  if (!['', 'yes', 'no'].includes(recurringDream)) throw new Error('请选择有效的重复梦境选项');
  // 多选集合只允许公开的六种线索，禁止对象、未知编码或过量数据进入模型。
  const signals = input.physiologySignals === undefined ? [] : input.physiologySignals;
  if (!Array.isArray(signals) || signals.length > 6 || signals.some(value => typeof value !== 'string' || !Object.hasOwn(DREAM_SIGNALS, value))) throw new Error('请选择有效的睡眠或身体线索');
  const physiologySignals = [...new Set<string>(signals)];
  return {
    dreamDate, recurringDream, physiologySignals,
    physiologyLabels: physiologySignals.map(code => DREAM_SIGNALS[code]),
    emotions: optionalText(input.emotions, '情感状态', 100),
    context: optionalText(input.context, '背景信息', 1000),
    structureHint: optionalText(input.structureHint, '结构补充', 1000)
  };
}
