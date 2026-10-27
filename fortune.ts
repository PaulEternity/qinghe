/** 流年流月运势：八字大运/流年/流月（lunar-javascript）+ 紫微大限/流年/流月/流日（iztro）。 */
import lunar from 'lunar-javascript';
import { ziweiChart } from './ziwei.ts';

interface FortuneOptions {focusDate?:string;dayDivide?:unknown;fixLeap?:unknown;algorithm?:unknown;}

// 十干次序与生克基础，用于以日主计算十神，不依赖第三方藏干。
const GAN='甲乙丙丁戊己庚辛壬癸'.split('');
const GAN_ELEMENT:Record<string,string>={甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const GAN_YANG:Record<string,boolean>={甲:true,乙:false,丙:true,丁:false,戊:true,己:false,庚:true,辛:false,壬:true,癸:false};
const SHENG:Record<string,string>={木:'火',火:'土',土:'金',金:'水',水:'木'};
const KE:Record<string,string>={木:'土',火:'金',土:'水',金:'木',水:'火'};

/** 依据阴阳与生克推出十神（比肩/劫财/食神/伤官/偏财/正财/七杀/正官/偏印/正印）。 */
function shiShen(dayGan:string, targetGan:string):string {
 if(!dayGan||!targetGan)return '';
 const de=GAN_ELEMENT[dayGan],te=GAN_ELEMENT[targetGan],same=GAN_YANG[dayGan]===GAN_YANG[targetGan];
 if(de===te)return same?'比肩':'劫财';
 if(SHENG[de]===te)return same?'食神':'伤官';
 if(KE[de]===te)return same?'偏财':'正财';
 if(KE[te]===de)return same?'七杀':'正官';
 if(SHENG[te]===de)return same?'偏印':'正印';
 return '';
}

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