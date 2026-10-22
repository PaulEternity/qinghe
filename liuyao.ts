/** 京房纳甲适配层：验证六次钱币结果，筛选可复核事实，禁止把引擎标签当确定预测。 */
import {randomInt} from 'node:crypto';
import engine from './vendor/liuyao-engine.cjs';
export const LIUYAO_RULES={version:'jingfang-najia-v1',system:'京房八宫纳甲，六亲以本卦宫五行为基准，六神按日干起',source:'MIT liuyao-divination；vendor/liuyao-LICENSE',order:'初爻到上爻，自下而上',boundary:'提供排盘事实，不自动确定用神、吉凶或应期；月旺衰等扩展判定未纳入本工程输出'};
/** 手动模式严格要求六个 6/7/8/9；自动模式按三枚独立钱币生成。 */
export function castLines(mode:unknown='auto',values?:unknown):number[] {
 if(mode==='auto')return Array.from({length:6},()=>Array.from({length:3},()=>2+randomInt(2)).reduce((a,b)=>a+b,0));
 if(mode!=='manual'||!Array.isArray(values)||values.length!==6||values.some(v=>!Number.isInteger(v)||![6,7,8,9].includes(v)))throw new Error('手摇录入请按初爻至上爻填写六个 6/7/8/9');
 return [...values];
}
/** 从可信四柱排纳甲，变卦六亲沿用本卦宫五行，不使用变卦自宫。 */
export function calculateLiuyao(values:number[],pillars:string[]) {
 const result=engine.mainCast({mainHexagram:values.map(v=>v%2===1),changedHexagram:values.flatMap((v,i)=>[6,9].includes(v)?[i+1]:[]),yearPillar:pillars[0],monthPillar:pillars[1],dayPillar:pillars[2],hourPillar:pillars[3]});
 if(result.error)throw new Error('六爻排盘失败，请核对卦爻与时间');
 // 只导出已纳入本工程验证范围的字段，不传播上游未经独立验收的自动断语。
 const pick=(hex:any)=>hex?{name:hex.name,palace:hex.palace,palaceElement:hex.palaceElement,shiPos:hex.shiPos,yingPos:hex.yingPos,lines:hex.lines.map((line:any)=>({position:line.position,ganZhi:line.ganZhi,liuQin:line.liuQin,liuShen:line.liuShen,isShi:line.isWorld,isYing:line.isResponse})),fuShen:hex.fuShen}:null;
 return {rules:LIUYAO_RULES,pillars:result.pillars,kongWang:result.kongWang,mainHexagram:pick(result.mainHexagram),changedHexagram:pick(result.changedHexagram),movingLines:result.movingLinesSummary};
}
