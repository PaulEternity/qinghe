/** 排盘领域模块：计算事实与 AI 解读分离，所有随机抽取均在本地完成。 */
import lunar from 'lunar-javascript';
import { randomUUID } from 'node:crypto';
import { drawTarot } from './tarot.ts';
import { castLines, calculateLiuyao } from './liuyao.ts';
import { calculateZiwei } from './ziwei.ts';
import { correctSolarTime } from './solar-time.ts';

export const tools = {
  bazi: { name: '生辰八字', icon: '乾', desc: '四柱排盘，读懂人生的节律', birth: true },
  liuyao: { name: '六爻问事', icon: '易', desc: '一事一问，看清当下的选择' },
  ziwei: { name: '紫微斗数', icon: '星', desc: '十二宫位，展开命盘全景', birth: true },
  tarot: { name: '塔罗占卜', icon: '契', desc: '选择牌阵，照见心绪与行动' },
  match: { name: '双人合盘', icon: '合', desc: '从差异出发，理解彼此', birth: true },
  offer: { name: 'Offer 对比', icon: '择', desc: '把两种可能，放在一起看', birth: true },
  naming: { name: '东方起名', icon: '名', desc: '在字义与音韵之间，寻找好名字', birth: true },
  dream: { name: '梦境札记', icon: '梦', desc: '记录梦境，梳理现实中的牵挂' },
  palm: { name: '手相观察', icon: '掌', desc: '上传手掌照片，获得视觉解读' }
};
/** 验证公历墙上时间；本版统一按北京时间，不悄悄套用服务器时区。 */
export function parseBirth(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('请填写完整出生日期和时间');
  const a = value.split(/[-T:]/).map(Number);
  const [y,m,d,h,minute] = a;
  const dt = new Date(Date.UTC(y,m-1,d,h,minute));
  if (y<1900 || y>2100 || dt.getUTCFullYear()!==y || dt.getUTCMonth()!==m-1 || dt.getUTCDate()!==d || h>23 || minute>59) throw new Error('出生日期须在 1900—2100 年之间且真实有效');
  return a;
}

/** 调用历法库生成四柱，固定晚子时换日规则并明确展示计算口径。 */
export function bazi(birth, options={}) {
  const timeCorrection=correctSolarTime(birth,options.enabled??false,options.longitude);
  const a=parseBirth(timeCorrection.corrected), l=lunar.Solar.fromYmdHms(...a,0).getLunar(), e=l.getEightChar();
  e.setSect(2);
  return { timeCorrection, calendar:`公历 · ${timeCorrection.enabled?'真太阳时近似校正（分钟取整）':'北京时间 UTC+8，未校正'} · 子初不换日（sect 2）`, lunar:l.toString(), pillars:['Year','Month','Day','Time'].map((k,i)=>({name:['年柱','月柱','日柱','时柱'][i],ganzhi:e['get'+k](),wuxing:e['get'+k+'WuXing'](),nayin:e['get'+k+'NaYin']()})) };
}

/** 校验文本长度，避免误将对象或过长请求发送至模型。 */
function field(value,label,max=4000) {
  if (typeof value!=='string' || !value.trim() || value.length>max) throw new Error(`${label}不能为空且不能超过 ${max} 字`);
  return value.trim();
}

/** 根据功能创建可信上下文；不要求模型虚构历法、星曜或抽牌。 */
export function prepare(input) {
  const tool=tools[input.tool];
  if (!tool) throw new Error('未知测算功能');
  const question=field(input.question,'问题');
  let facts={};
  const correction={enabled:input.solarCorrection??false,longitude:input.longitude};
  if (tool.birth) facts.birth=bazi(input.birth,correction);
  if (['match','ziwei'].includes(input.tool) && !['男','女'].includes(input.gender)) throw new Error('请选择命盘性别');
  if (input.tool==='match') facts.partner=bazi(input.partnerBirth,{enabled:input.partnerSolarCorrection??false,longitude:input.partnerLongitude});
  if (input.tool==='ziwei') {
    if(input.focusDate)parseBirth(input.focusDate+'T12:00');
    facts.ziwei=calculateZiwei(parseBirth(facts.birth.timeCorrection.corrected),input.gender,{dayDivide:input.dayDivide,fixLeap:input.fixLeap,algorithm:input.ziweiAlgorithm,focusDate:input.focusDate});
  }
  if (input.tool==='tarot') {
    const tarot=drawTarot(input.spread,input.spreadMode);facts.cards=tarot.cards;facts.tarotRules=tarot.rules;
  }
  if (input.tool==='liuyao') {
    const values=castLines(input.castMode,input.lineValues);
    const timeCorrection=correctSolarTime(input.castTime||new Date(Date.now()+8*3600000).toISOString().slice(0,16),correction.enabled,correction.longitude);
    const calendar=bazi(timeCorrection.corrected);
    facts={timeCorrection,lines:values.map((value,i)=>({position:i+1,value,yang:value%2===1,moving:[6,9].includes(value)})),method:'三钱法，初爻至上爻。6 老阴、7 少阳、8 少阴、9 老阳。纳甲/六亲六神/世应/旬空由固定规则引擎生成；不自动确定用神或应期。',castMode:input.castMode||'auto',liuyao:calculateLiuyao(values,calendar.pillars.map(p=>p.ganzhi))};
  }
  if (input.tool==='offer') facts.options={a:field(input.optionA,'方案 A'),b:field(input.optionB,'方案 B')};
  if (input.tool==='naming') facts.surname=field(input.surname,'姓氏',10);
  if (input.tool==='palm') {
    if (typeof input.image!=='string'||input.image.length>4_200_000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(input.image)) throw new Error('请上传不超过 3MB 的 PNG、JPEG 或 WebP 手掌照片');
    facts.note='只描述可见纹理；模糊处说明无法判断，不作健康诊断或寿命预测。';
  }
  return {id:randomUUID(),schemaVersion:2,createdAt:new Date().toISOString(),tool:input.tool,title:tool.name,question,facts};
}
