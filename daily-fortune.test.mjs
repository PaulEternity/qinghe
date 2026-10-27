/** 每日运势模块回归：十神推导、今日干支与民俗项格式，以及卡片纯渲染与转义。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { calculateDailyFortune } from './daily-fortune.ts';

const source = fs.readFileSync(new URL('./public/app.js', import.meta.url), 'utf8');
// 与其它渲染回归一致：直接执行生产代码中的纯函数，不复刻实现。
const esc = source.split('\n').find(line => line.startsWith('const esc='));
const htmlFn = source.slice(source.indexOf('function dailyFortuneHTML('), source.indexOf('/**', source.indexOf('function dailyFortuneHTML(')));

test('每日运势：日主、今日十神与民俗项完整且格式正确', () => {
  const f = calculateDailyFortune('1997-05-20', '男');
  assert.match(f.dayMaster, /^[甲乙丙丁戊己庚辛壬癸]$/);
  assert.match(f.dayGanZhi, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
  assert.ok(['比肩','劫财','食神','伤官','偏财','正财','七杀','正官','偏印','正印'].includes(f.relation), f.relation);
  assert.ok(f.luckyColor && f.luckyNumbers && f.luckyDirection && f.guidance);
  assert.ok(typeof f.favorable === 'string' && f.favorable.length > 0);
  assert.match(f.rules.note, /十神/);
  assert.equal(f.gender, '男');
});

test('每日运势：非法日期拒绝，多组生日均得到合法日主与十神', () => {
  assert.throws(() => calculateDailyFortune('bad'), /格式无效/);
  for (const birthday of ['1990-01-01', '2000-06-15', '2010-12-31']) {
    const f = calculateDailyFortune(birthday);
    assert.match(f.dayMaster, /^[甲乙丙丁戊己庚辛壬癸]$/);
    assert.ok(f.relation && f.guidance);
  }
});

test('每日运势卡片：关键字段展示且危险文本转义', () => {
  const base = calculateDailyFortune('1997-05-20');
  const render = f => { const context = vm.createContext({ f }); vm.runInContext(esc + '\n' + htmlFn + '\nout=dailyFortuneHTML(f);', context); return context.out; };
  const html = render(base);
  for (const text of ['每日运势', '你的日主', '今日十神', '幸运色']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('<script>'));
  const malicious = render({ ...base, relation: '<img src=x onerror=alert(1)>', guidance: '<script>alert(1)</script>' });
  assert.ok(!malicious.includes('<img src=x'));assert.match(malicious, /&lt;img/);assert.match(malicious, /&lt;script&gt;/);
});