/** 流年流月运势：八字大运/流年/流月（lunar-javascript）+ 紫微大限/流年/流月/流日（iztro）。 */
import lunar from 'lunar-javascript';
import { ziweiChart } from './ziwei.ts';
import { GAN_ELEMENT, shiShen } from './wuxing.ts';

interface FortuneOptions {focusDate?:string;dayDivide?:unknown;fixLeap?:unknown;algorithm?:unknown;}

/** 提取 iztro 运限对象的可读字段（天干、地支、重叠宫位、四化）。 */
function pick(p:{name:string;heavenlyStem:string;earthlyBranch:string;palaceNames:string[];mutagen:string[]}) {
 return {name:p.name,heavenlyStem:p.heavenlyStem,earthlyBranch:p.earthlyBranch,palaceNames:p.palaceNames,mutagen:p.mutagen};
}

/** 计算八字大运/流年/流月与紫微大限/流年/流月/流日，聚焦日期缺省为今天。 */
export function calculateFortune(parts:number[], gender:'男'|'女', options:FortuneOptions={}) {
 const focusDate=options.focusDate||new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 const focusYear=Number(focusDate.slice(0,4));

 // ── 八字：日主与行运 ──
 const [y,m,d,h,minute]=parts;
 const eightChar=lunar.Solar.fromYmdHms(y,m,d,h,minute,0).getLunar().getEightChar();
 eightChar.setSect(2);
 const dayGan:string=eightChar.getDayGan();
 const dayElement:string=GAN_ELEMENT[dayGan];
 const yun=eightChar.getYun(gender==='男'?1:0,2);
 // 首项为起运前，实际大运自第 1 项起；取足 10 步覆盖高龄。
 const allDaYun:any[]=yun.getDaYun(11);
 const daYun=allDaYun.filter((d:any)=>d.getGanZhi()).map((d:any)=>({
  startYear:d.getStartYear(),endYear:d.getEndYear(),startAge:d.getStartAge(),endAge:d.getEndAge(),
  ganzhi:d.getGanZhi(),shiShen:shiShen(dayGan,d.getGanZhi()[0])
 }));
 // 汇集全部行运中的流年，再按聚焦年份前后截取，跨大运边界也能连续展示。
 const allLiuNian:any[]=[];
 for(const d of allDaYun)for(const yr of d.getLiuNian())allLiuNian.push(yr);
 const liuNian=allLiuNian.filter((yr:any)=>yr.getYear()>=focusYear-1&&yr.getYear()<=focusYear+3).map((yr:any)=>({
  year:yr.getYear(),age:yr.getAge(),ganzhi:yr.getGanZhi(),shiShen:shiShen(dayGan,yr.getGanZhi()[0])
 }));
 // 流月表取聚焦年那一流年的十二个月。
 const focusLiuNian=allLiuNian.find((yr:any)=>yr.getYear()===focusYear)||allLiuNian.at(-1);
 const liuYue=(focusLiuNian?focusLiuNian.getLiuYue():[]).map((mo:any)=>({month:mo.getMonthInChinese(),ganzhi:mo.getGanZhi(),shiShen:shiShen(dayGan,mo.getGanZhi()[0])}));

 // ── 紫微：聚焦日的大限/流年/流月/流日 ──
 const {chart,config,fixLeap,timeIndex}=ziweiChart(parts,gender,options);
 const stage=chart.horoscope(focusDate);

 return {
  rules:{version:'fortune-v1',note:'八字大运/流年/流月为 lunar-javascript sect 2 结果；紫微为 iztro 2.6.3 运限。流年流月是程序排出的纪时事实，不是确定性运势预测。'},
  focusDate,focusYear,dayMaster:dayGan,dayMasterElement:dayElement,
  bazi:{daYun,liuNian,liuYue},
  ziwei:{rules:{config,fixLeap,timeIndex},decadal:pick(stage.decadal),yearly:pick(stage.yearly),monthly:pick(stage.monthly),daily:pick(stage.daily)}
 };
}