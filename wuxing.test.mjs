/** wuxing 公共模块回归：十神推导、喜用/忌神方向、生扶与生我五行。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { shiShen, favorableElements, supportive, parentOf } from './wuxing.ts';

test('十神推导：同我、生我、我生、我克、克我及阴阳分野', () => {
  assert.equal(shiShen('甲', '甲'), '比肩'); // 同五行、同阴阳
  assert.equal(shiShen('甲', '乙'), '劫财'); // 同五行、异阴阳
  assert.equal(shiShen('甲', '壬'), '偏印'); // 水生木、阳
  assert.equal(shiShen('甲', '癸'), '正印'); // 水生木、阴
  assert.equal(shiShen('甲', '丙'), '食神'); // 木生火、阳
  assert.equal(shiShen('甲', '丁'), '伤官'); // 木生火、阴
  assert.equal(shiShen('甲', '戊'), '偏财'); // 木克土、阳
  assert.equal(shiShen('甲', '己'), '正财'); // 木克土、阴
  assert.equal(shiShen('甲', '庚'), '七杀'); // 金克木、阳
  assert.equal(shiShen('甲', '辛'), '正官'); // 金克木、阴
});

test('喜用与忌神方向：身弱宜生扶，身强宜克泄耗', () => {
  const weak = favorableElements('甲', '身弱');
  assert.deepEqual(weak.favorable, ['水', '木']); // 印 + 比劫
  assert.deepEqual(weak.unfavorable, ['火', '土', '金']); // 我生 + 我克 + 克我

  const strong = favorableElements('甲', '身强');
  assert.deepEqual(strong.favorable, ['火', '土', '金']);
  assert.deepEqual(strong.unfavorable, ['水', '木']);
});

test('生扶者与生我五行', () => {
  assert.equal(parentOf('木'), '水');
  assert.equal(parentOf('火'), '木');
  assert.deepEqual(supportive('木'), ['水', '木']);
  assert.deepEqual(supportive('火'), ['木', '火']);
});