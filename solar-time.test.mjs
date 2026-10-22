/** 校正测试：验证 NOAA 固定数值、跨时辰/跨日、禁用行为和紫微真实接入。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {correctSolarTime,equationOfTime} from './solar-time.ts';
import {prepare} from './engine.mjs';

// 非闰年 1 月 1 日正午 gamma=0，可直接手算 NOAA 式作为独立基准。
test('NOAA 分数年零点基准与经度方向',()=>{
  assert.ok(Math.abs(equationOfTime(new Date('2023-01-01T12:00:00Z'))-(-2.90416896))<1e-8);
  const east=correctSolarTime('2023-01-01T12:00',true,121),west=correctSolarTime('2023-01-01T12:00',true,119);
  assert.equal(east.longitudeMinutes,4);assert.equal(west.longitudeMinutes,-4);
  assert.equal(east.corrected,'2023-01-01T12:01');assert.equal(west.corrected,'2023-01-01T11:53');
});
// 关闭开关不改时间，输入缺失时不能默默采用默认城市。
test('关闭与校正参数边界',()=>{
  assert.equal(correctSolarTime('2024-02-29T12:00',false).corrected,'2024-02-29T12:00');
  for(const n of [undefined,NaN,181,-181,'116.4'])assert.throws(()=>correctSolarTime('2024-01-01T12:00',true,n));
  assert.throws(()=>correctSolarTime('2023-02-29T12:00',true,120));
});
// 不把太阳时对一天取模，跨午夜时保留日期变化。
test('跨日期与时辰变化',()=>{
  const c=correctSolarTime('2024-01-01T00:01',true,75);
  assert.equal(c.corrected.slice(0,10),'2023-12-31');assert.equal(c.crossedDay,true);assert.equal(c.crossedHour,true);
});
// 验证校正进入真实排盘调用，而非只在页面显示一个说明字段。
test('紫微采用校正后的日期时辰，合盘分别校正',()=>{
  const c=correctSolarTime('2024-01-01T01:00',true,116);
  assert.equal(c.corrected,'2024-01-01T00:41');assert.equal(c.crossedHour,true);
  const input={tool:'ziwei',birth:'2024-01-01T01:00',gender:'女',question:'了解自己'};
  const corrected=prepare({...input,solarCorrection:true,longitude:116});
  const reference=prepare({...input,birth:'2024-01-01T00:41'});
  assert.deepEqual(corrected.facts.ziwei,reference.facts.ziwei);
  const match=prepare({...input,tool:'match',partnerBirth:input.birth,partnerSolarCorrection:true,partnerLongitude:75});
  assert.equal(match.facts.birth.timeCorrection.enabled,false);assert.equal(match.facts.partner.timeCorrection.enabled,true);
});
