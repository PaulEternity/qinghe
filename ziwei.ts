/** 紫微适配层：固定依赖版本与单盘配置，完整保留命身宫、辅曜、四化和阶段依据。 */
import iztro from 'iztro';
interface Options {dayDivide?:unknown;fixLeap?:unknown;algorithm?:unknown;focusDate?:string;}
/** 配置只作用于当前星盘，避免修改全局设置污染其他请求。 */
export function calculateZiwei(parts:number[],gender:'男'|'女',options:Options={}) {
 const dayDivide=options.dayDivide??'forward',fixLeap=options.fixLeap??true,algorithm=options.algorithm??'default';
 if(!['current','forward'].includes(String(dayDivide))||typeof fixLeap!=='boolean'||!['default','zhongzhou'].includes(String(algorithm)))throw new Error('紫微排盘规则配置无效');
 const [y,m,d,h]=parts;
 const timeIndex=h===23?12:Math.floor((h+1)/2);
 const config={yearDivide:'normal' as const,horoscopeDivide:'normal' as const,ageDivide:'normal' as const,dayDivide:dayDivide as 'current'|'forward',algorithm:algorithm as 'default'|'zhongzhou'};
 const chart=iztro.astro.withOptions({type:'solar',dateStr:`${y}-${m}-${d}`,timeIndex,gender,fixLeap,language:'zh-CN',config});
 const focusDate=options.focusDate||new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 const stage=chart.horoscope(focusDate);
 const star=(s:{name:string;brightness?:string;mutagen?:string;type?:string})=>({name:s.name,brightness:s.brightness,mutagen:s.mutagen,type:s.type});
 const period=(p:typeof stage.yearly|typeof stage.decadal)=>({name:p.name,heavenlyStem:p.heavenlyStem,earthlyBranch:p.earthlyBranch,palaceNames:p.palaceNames,mutagen:p.mutagen});
 return {
  rules:{version:'iztro-2.6.3-v1',library:'iztro@2.6.3',config,fixLeap,timeIndex,lateZi:'23:00—23:59 使用索引 12；按 dayDivide 确定换日，非原站索引 0 的兼容仿真',mutagenOrder:['禄','权','科','忌'],boundary:'不同流派不保证一致；这里记录算法依据，不是可验证的人生预测'},
  solarDate:chart.solarDate,lunarDate:chart.lunarDate,chineseDate:chart.chineseDate,fiveElementsClass:chart.fiveElementsClass,
  soul:chart.soul,body:chart.body,soulBranch:chart.earthlyBranchOfSoulPalace,bodyBranch:chart.earthlyBranchOfBodyPalace,
  palaces:chart.palaces.map(p=>({index:p.index,name:p.name,earthlyBranch:p.earthlyBranch,heavenlyStem:p.heavenlyStem,isBodyPalace:p.isBodyPalace,majorStars:p.majorStars.map(star),minorStars:p.minorStars.map(star),adjectiveStars:p.adjectiveStars.map(star),decadal:p.decadal})),
  stage:{focusDate,decadal:period(stage.decadal),yearly:period(stage.yearly)}
 };
}
