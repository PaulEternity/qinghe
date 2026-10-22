/** 真太阳时计算模块：输入必须为已还原到 UTC+8 标准时的公历时间。 */
export interface SolarCorrection {
  enabled: boolean;
  original: string;
  corrected: string;
  longitude?: number;
  longitudeMinutes?: number;
  equationMinutes?: number;
  totalMinutes?: number;
  algorithm: string;
  crossedDay: boolean;
  crossedHour: boolean;
}

/** 解析不带隐式时区的墙上时间，使用 UTC 字段作纯公历运算。 */
function parseWall(value: string): Date {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('请填写完整公历时间');
  const [y,m,d,h,n]=value.split(/[-T:]/).map(Number);
  const date=new Date(Date.UTC(y,m-1,d,h,n));
  if(y<1900||y>2100||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d||h>23||n>59)throw new Error('请填写 1900—2100 年内有效公历时间');
  return date;
}

/** 标注子时区间，跨午夜与跨时辰分别记录供排盘规则处理。 */
function hourBranch(date: Date): number {return Math.floor((date.getUTCHours()+1)/2)%12;}

/** 按 NOAA 分数年近似式计算均时差，正值表示视太阳时领先平太阳时。 */
export function equationOfTime(date: Date): number {
  const year=date.getUTCFullYear();
  const day=(Date.UTC(year,date.getUTCMonth(),date.getUTCDate())-Date.UTC(year,0,1))/86400000+1;
  const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
  const hour=date.getUTCHours()+date.getUTCMinutes()/60;
  const gamma=2*Math.PI/days*(day-1+(hour-12)/24);
  return 229.18*(0.000075+0.001868*Math.cos(gamma)-0.032077*Math.sin(gamma)-0.014615*Math.cos(2*gamma)-0.040849*Math.sin(2*gamma));
}

/** 可选校正：完整保存两个分量与原始输入，关闭时不改变时间。 */
export function correctSolarTime(value: string, enabled: boolean, longitude?: number): SolarCorrection {
  const date=parseWall(value);
  if(typeof enabled!=='boolean')throw new Error('校正开关无效');
  if(!enabled)return {enabled:false,original:value,corrected:value,algorithm:'UTC+8-standard',crossedDay:false,crossedHour:false};
  if(typeof longitude!=='number'||!Number.isFinite(longitude)||longitude< -180||longitude>180)throw new Error('开启校正后请填写 -180 至 180 度的有效经度');
  const longitudeMinutes=4*(longitude-120),equationMinutes=equationOfTime(date),totalMinutes=longitudeMinutes+equationMinutes;
  // 完整保留近似偏移到秒；排盘输入统一四舍五入到分钟，页面明确这一口径。
  const correctedDate=new Date(Math.round((date.getTime()+totalMinutes*60000)/60000)*60000);
  const corrected=correctedDate.toISOString().slice(0,16);
  parseWall(corrected);
  return {enabled:true,original:value,corrected,longitude,longitudeMinutes,equationMinutes,totalMinutes,algorithm:'NOAA-fractional-year-v1-minute-rounding',crossedDay:corrected.slice(0,10)!==value.slice(0,10),crossedHour:hourBranch(date)!==hourBranch(correctedDate)};
}
