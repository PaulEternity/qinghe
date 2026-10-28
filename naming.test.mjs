/** 起名五行补字回归：喜用神主补五行、候选名不重字且可复现，以及 prepare 集成产出 facts.naming。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateNaming } from './naming.ts';
import { prepare } from './engine.mjs';

test('起名：按喜用主补五行生成候选，名前缀姓氏且不重字', () => {
  const r = calculateNaming({ surname: '李', dayGan: '甲', strengthLevel: '身弱' });
  assert.equal(r.primary, '水'); // 甲身弱喜水木，主补取水
  assert.ok(r.candidates.length >= 5);
  for (const c of r.candidates) {
    assert.ok(c.name.startsWith('李'));
    assert.equal(new Set(c.chars).size, c.chars.length, c.name); // 单字/双字内不重复
    assert.equal(c.elements.length, c.chars.length);
    assert.ok(c.meaning.length > 0);
  }
});

test('起名：同库取字时不产生重复候选名', () => {
  // 丙火身强喜土金，主次五行不同（土、金），确认不因同库去重逻辑报错且产出稳定。
  const r1 = calculateNaming({ surname: '赵', dayGan: '丙', strengthLevel: '身强' });
  const r2 = calculateNaming({ surname: '赵', dayGan: '丙', strengthLevel: '身强' });
  assert.deepEqual(r1.candidates.map(c => c.name), r2.candidates.map(c => c.name)); // 可复现、不随机
  assert.equal(new Set(r1.candidates.map(c => c.name)).size, r1.candidates.length); // 候选名互不重复
});

test('prepare 起名接入：产出 facts.naming 与姓氏校验', () => {
  const r = prepare({ tool: 'naming', question: '为孩子起名', surname: '王', birth: '1996-08-18T10:30' });
  assert.equal(r.facts.surname, '王');
  assert.ok(r.facts.naming);
  assert.ok(r.facts.naming.candidates.length > 0);
  assert.equal(r.facts.naming.dayMaster.gan, r.facts.birth.dayMaster.gan);
  assert.throws(() => prepare({ tool: 'naming', question: '起名', surname: '', birth: '1996-08-18T10:30' }), /姓氏/);
});