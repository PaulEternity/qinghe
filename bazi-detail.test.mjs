/** 八字细盘回归：日主旺衰评分、神煞落点、bazi() 扩展字段，以及前端渲染与转义。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { calculateBaziDetail } from './bazi-detail.ts';
import { bazi } from './engine.mjs';

// 与其它渲染回归一致：直接提取生产代码中的纯函数执行，不复刻实现。
const source = fs.readFileSync(new URL('./public/app.js', import.meta.url), 'utf8');
const esc = source.split('\n').find(line => line.startsWith('const esc='));
const pillarHTML = source.split('\n').find(line => line.startsWith('function pillarHTML('));
const baziDetailHTML = source.split('\n').find(line => line.startsWith('function baziDetailHTML('));

/** 在隔离上下文中执行单柱渲染，返回生成的 HTML。 */
function renderPillar(p) {
  const context = vm.createContext({ p });
  vm.runInContext(esc + '\n' + pillarHTML + '\nout=pillarHTML(p);', context);
  return context.out;
}

/** 在隔离上下文中执行细盘渲染，返回生成的 HTML。 */
function renderDetail(b) {
  const context = vm.createContext({ b });
  vm.runInContext(esc + '\n' + baziDetailHTML + '\nout=baziDetailHTML(b);', context);
  return context.out;
}

// 使用与 1990-06-15（辛日主）一致的固定干支，验证旺衰与神煞的确定性输出。
const XIN_PILLARS = [
  { gan: '庚', zhi: '午', hideGan: ['丁', '己'] },
  { gan: '壬', zhi: '午', hideGan: ['丁', '己'] },
  { gan: '辛', zhi: '亥', hideGan: ['壬', '甲'] },
  { gan: '庚', zhi: '寅', hideGan: ['甲', '丙', '戊'] },
];

test('日主旺衰：辛金生于午月得偏弱，因子与档位完整', () => {
  const d = calculateBaziDetail({ dayGan: '辛', pillars: XIN_PILLARS });
  assert.equal(d.dayMaster.gan, '辛');
  assert.equal(d.dayMaster.element, '金');
  assert.equal(d.dayMaster.yinYang, '阴');
  assert.equal(d.strength.level, '偏弱');
  assert.ok(d.strength.score < 0);
  assert.ok(d.strength.factors.length >= 3);
  assert.match(d.strength.note, /简化评分/);
});

test('神煞：辛日主命中天乙贵人于年、月、时柱', () => {
  const d = calculateBaziDetail({ dayGan: '辛', pillars: XIN_PILLARS });
  assert.equal(d.shensha.length, 1);
  const tianyi = d.shensha[0];
  assert.equal(tianyi.name, '天乙贵人');
  assert.deepEqual(tianyi.locations.map(l => l.pillar), ['年柱', '月柱', '时柱']);
  assert.deepEqual(tianyi.locations.map(l => l.branch), ['午', '午', '寅']);
});

test('神煞：甲日主命中天乙、文昌、羊刃、华盖', () => {
  const d = calculateBaziDetail({ dayGan: '甲', pillars: [
    { gan: '丙', zhi: '丑', hideGan: ['己', '癸', '辛'] },
    { gan: '丁', zhi: '卯', hideGan: ['乙'] },
    { gan: '甲', zhi: '巳', hideGan: ['丙', '戊', '庚'] },
    { gan: '己', zhi: '未', hideGan: ['己', '丁', '乙'] },
  ] });
  const names = d.shensha.map(x => x.name);
  for (const n of ['天乙贵人', '文昌贵人', '羊刃', '华盖']) assert.ok(names.includes(n), n);
});

test('bazi()：保留既有四柱并新增十神、藏干、长生、旬空、日主、旺衰与胎元命宫', () => {
  const chart = bazi('1986-05-29T00:00');
  assert.deepEqual(chart.pillars.map(p => p.ganzhi), ['丙寅', '癸巳', '癸酉', '壬子']);
  assert.equal(chart.dayMaster.gan, '癸');
  assert.ok(chart.dayMaster.element && chart.dayMaster.yinYang);
  assert.ok(['身强', '偏强', '中和', '偏弱', '身弱'].includes(chart.strength.level));
  for (const p of chart.pillars) {
    assert.ok(typeof p.shishen === 'string');
    assert.ok(Array.isArray(p.hideGan) && p.hideGan.every(h => h.gan && h.shishen));
    assert.ok(p.dishi && p.xunKong);
  }
  assert.ok(chart.taiYuan && chart.mingGong && chart.shenGong);
});

test('渲染：单柱展示十神/藏干/旬空且危险文本转义，兼容旧字段', () => {
  const html = renderPillar({ name: '时柱', ganzhi: '庚寅', wuxing: '金木', shishen: '劫财', dishi: '胎', hideGan: [{ gan: '甲', shishen: '<img src=x onerror=alert(1)>' }, { gan: '丙', shishen: '正官' }], xunKong: '午未' });
  assert.ok(html.includes('庚寅'));
  assert.ok(html.includes('劫财'));
  assert.ok(html.includes('藏：'));
  assert.ok(html.includes('旬空 午未'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img/);
  // 旧札记只有干支/五行时，不应出现新增区块。
  const legacy = renderPillar({ name: '年柱', ganzhi: '庚午', wuxing: '金火' });
  assert.ok(legacy.includes('庚午'));
  assert.ok(!legacy.includes('藏：'));
  assert.ok(!legacy.includes('旬空'));
});

test('渲染：细盘展示日主、旺衰、神煞落点与胎元命宫，且转义', () => {
  const html = renderDetail({ dayMaster: { gan: '辛', element: '金', yinYang: '阴' }, strength: { score: -37, level: '偏弱', factors: ['月令午（火）克制日主'], note: '简化评分' }, shensha: [{ name: '天乙贵人', desc: 'x', locations: [{ pillar: '年柱', branch: '午' }] }], taiYuan: '癸酉', mingGong: '乙酉', shenGong: '乙酉' });
  for (const t of ['日主', '旺衰', '偏弱', '天乙贵人', '年柱·午', '癸酉']) assert.ok(html.includes(t), t);
  assert.ok(!html.includes('<script>'));
  // 无 dayMaster 的旧数据返回空串，不破坏现有渲染。
  assert.equal(renderDetail({}), '');
});