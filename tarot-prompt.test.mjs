/** 塔罗系统提示词回归：实际牌面、动态问题、牌阵兼容及其他工具的提示词隔离。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare } from './engine.mjs';
import { messagesFor } from './server.mjs';

test('塔罗提示词只解读已有牌阵，单张、三牌不同视角与十张均保留原牌位', () => {
  // 覆盖现有全部牌阵视角，确保提示词不会把所有输入改成范例中的三张牌。
  const spreads = [
    ['single', undefined], ['three', 'situation-challenge-advice'],
    ['three', 'past-present-future'], ['three', 'mind-body-spirit'],
    ['three', 'you-partner-relationship'], ['celtic', undefined]
  ];
  for (const [spread, spreadMode] of spreads) {
    const record = prepare({ tool: 'tarot', spread, spreadMode, question: '如何安排接下来一个月的学习？' });
    // 保存原牌面快照，用于核对组装提示词没有重抽、修改牌位或正逆位。
    const before = structuredClone(record.facts);
    const messages = messagesFor(record), system = messages[0].content;
    assert.match(system, /10 年解读经验/);
    assert.match(system, /约 500 字/);
    assert.ok(!system.includes('100—250'));
    for (const text of ['不再抽牌', '实际牌位', '核心牌意', '用户情境', '整体脉络', '今日金句', '成长课题', '不虚构用户经历']) assert.ok(system.includes(text), text);
    assert.match(messages[1].content, /如何安排接下来一个月的学习/);
    for (const card of before.cards) {
      assert.ok(messages[1].content.includes(card.name));
      assert.ok(messages[1].content.includes(card.position));
      assert.ok(messages[1].content.includes(card.orientation));
    }
    assert.deepEqual(record.facts, before);
  }
});

test('塔罗追问保留对话和原牌，其他工具不使用塔罗角色或 500 字要求', () => {
  const record = prepare({ tool: 'tarot', question: '如何改善沟通？' });
  const history = [{ role: 'assistant', content: '上次的解读' }, { role: 'user', content: '能给一个具体的沟通练习吗？' }];
  const messages = messagesFor(record, history);
  assert.match(messages[0].content, /100—250/);
  assert.match(messages[0].content, /不机械重复完整框架或今日金句/);
  assert.deepEqual(messages.slice(2), history);
  for (const other of [prepare({ tool: 'dream', question: '梦见自己在海边散步' }), prepare({ tool: 'bazi', birth: '1996-08-18T10:30', question: '近期学习安排' })]) {
    const system = messagesFor(other)[0].content;
    assert.match(system, /100—250/);
    assert.ok(!system.includes('10 年解读经验'));
    assert.ok(!system.includes('约 500 字'));
    assert.ok(!system.includes('今日金句'));
  }
});
