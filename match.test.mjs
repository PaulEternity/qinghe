/** 合盘喜用神回归：五行生克方向、十神对照，以及 prepare 集成产出 facts.match。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMatch } from './match.ts';
import { prepare } from './engine.mjs';
import { GAN_ELEMENT, GAN_YANG } from './wuxing.ts';

/** 构造合盘一方所需的最小投影：日主五行/阴阳与旺衰档位。 */
function party(gan, level) {
  return { dayMaster: { gan, element: GAN_ELEMENT[gan], yinYang: GAN_YANG[gan] ? '阳' : '阴' }, strength: { level } };
}

test('合盘：五行生克方向与十神对照对称', () => {
  const m = calculateMatch(party('甲', '身弱'), party('癸', '身强'));
  assert.equal(m.elementRelation.aToB, '被生'); // 对方癸水生甲木
  assert.equal(m.elementRelation.bToA, '生');
  assert.equal(m.shishen.aOfB, '正印'); // 甲木日主看癸水
  assert.equal(m.shishen.bOfA, '伤官'); // 癸水日主看甲木（水生木、阴见阳→伤官）
  assert.ok(m.highlights.length > 0);
  assert.ok(m.a.favorable.length > 0 && m.b.favorable.length > 0);
});

test('合盘：对方日主命中我方喜用/忌神时体现在亮点中', () => {
  // 甲身弱喜水木；对方日主为壬水（喜用）时应有互补提示。
  const m = calculateMatch(party('甲', '身弱'), party('壬', '身强'));
  assert.ok(m.highlights.some(h => h.includes('喜用')));
  assert.ok(m.highlights.some(h => h.includes('日主五行')));
});

test('prepare 合盘接入：产出 facts.match 且保留双方四柱', () => {
  const r = prepare({ tool: 'match', question: '如何相处', birth: '1996-08-18T10:30', gender: '男', partnerBirth: '1997-05-20T08:00' });
  assert.ok(r.facts.birth && r.facts.partner);
  assert.ok(r.facts.match);
  assert.ok(r.facts.match.highlights.length > 0);
  assert.equal(r.facts.match.a.gan, r.facts.birth.dayMaster.gan);
  assert.equal(r.facts.match.b.gan, r.facts.partner.dayMaster.gan);
});