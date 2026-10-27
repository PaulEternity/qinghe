/** 紫微适配层：固定依赖版本与单盘配置，完整保留命身宫、辅曜、四化和阶段依据。 */
import iztro from 'iztro';
interface ChartOptions {dayDivide?:unknown;fixLeap?:unknown;algorithm?:unknown;}
interface Options extends ChartOptions {focusDate?:string;}

/** 校验并规范化排盘规则，返回 iztro 需要的配置与可复核口径。 */
function resolveOptions(options:ChartOptions) {
 const dayDivide=String(options.dayDivide??'forward'),fixLeap=Boolean(options.fixLeap??true),algorithm=String(options.algorithm??'default');
 if(!['current','forward'].includes(dayDivide)||!['default','zhongzhou'].includes(algorithm))throw new Error('紫微排盘规则配置无效');
 const config={yearDivide:'normal' as const,horoscopeDivide:'normal' as const,ageDivide:'normal' as const,dayDivide:dayDivide as 'current'|'forward',algorithm:algorithm as 'default'|'zhongzhou'};
 return {config,fixLeap,dayDivide,algorithm};
}

/** 构建单盘星盘对象；供排盘与流年流月流日复用，不修改全局配置。 */
export function ziweiChart(parts:number[], gender:'男'|'女', options:ChartOptions={}) {
 const {config,fixLeap}=resolveOptions(options);
 const [y,m,d,h]=parts;
 const timeIndex=h===23?12:Math.floor((h+1)/2);
 const chart=iztro.astro.withOptions({type:'solar',dateStr:`${y}-${m}-${d}`,timeIndex,gender,fixLeap,language:'zh-CN',config});
 return {chart,config,fixLeap,timeIndex};
}

/** 提取运限对象的可读字段；流耀 stars 体量大，不进盘面 facts。 */
function period(p:{name:string;heavenlyStem:string;earthlyBranch:string;palaceNames:string[];mutagen:string[]}) {
 return {name:p.name,heavenlyStem:p.heavenlyStem,earthlyBranch:p.earthlyBranch,palaceNames:p.palaceNames,mutagen:p.mutagen};
}

/** 主排盘：构建星盘后计算聚焦日的大限、流年、流月、流日。 */
export function calculateZiwei(parts:number[], gender:'男'|'女', options:Options={}) {
 const {chart,config,fixLeap,timeIndex}=ziweiChart(parts,gender,options);
 const focusDate=options.focusDate||new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 const stage=chart.horoscope(focusDate);
 const star=(s:{name:string;brightness?:string;mutagen?:string;type?:string})=>({name:s.name,brightness:s.brightness,mutagen:s.mutagen,type:s.type});
 return {
  rules:{version:'iztro-2.6.3-v1',library:'iztro@2.6.3',config,fixLeap,timeIndex,lateZi:'23:00—23:59 使用索引 12；按 dayDivide 确定换日，非原站索引 0 的兼容仿真',mutagenOrder:['禄','权','科','忌'],boundary:'不同流派不保证一致；这里记录算法依据，不是可验证的人生预测'},
  solarDate:chart.solarDate,lunarDate:chart.lunarDate,chineseDate:chart.chineseDate,fiveElementsClass:chart.fiveElementsClass,
  soul:chart.soul,body:chart.body,soulBranch:chart.earthlyBranchOfSoulPalace,bodyBranch:chart.earthlyBranchOfBodyPalace,
  palaces:chart.palaces.map(p=>({index:p.index,name:p.name,earthlyBranch:p.earthlyBranch,heavenlyStem:p.heavenlyStem,isBodyPalace:p.isBodyPalace,majorStars:p.majorStars.map(star),minorStars:p.minorStars.map(star),adjectiveStars:p.adjectiveStars.map(star),decadal:p.decadal})),
  stage:{focusDate,decadal:period(stage.decadal),yearly:period(stage.yearly),monthly:period(stage.monthly),daily:period(stage.daily)}
 };
}