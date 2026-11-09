/** 六爻提示词回归：五节结构、原卦与真实问题、静动卦兼容、追问及跨工具隔离。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare } from './engine.mjs';
import { messagesFor } from './server.mjs';

test('六爻系统提示词覆盖五节、三条策略及缺失资料与应期边界，保留静动卦事实', () => {
  // 使用固定起卦时刻与六次钱币值，分别验证静卦和动卦，不把重排产生的新卦当成输入。
  for (const lineValues of [[7, 7, 7, 7, 7, 7], [6, 6, 6, 6, 6, 6]]) {
    const record = prepare({ tool: 'liuyao', question: '这次考试该如何准备？', castMode: 'manual', lineValues, castTime: '1986-05-29T00:00' });
    // 原始资料快照用于确认提示词组装不修改六亲、世应或动变数据。
    const before = structuredClone(record.facts);
    const messages = messagesFor(record), system = messages[0].content;
    for (const heading of ['核心判断（定基调）', '用神分析（抓关键）', '世应与变卦（看发展趋势）', '细节推断与时间节点', '行动建议']) assert.ok(system.includes(`【${heading}】`), heading);
    for (const text of ['火珠林纳甲体系', '3 条具体', '500—800 字', '不重新起卦', '初爻至上爻', '按静卦分析', '不编造精确日期', '性别或关系角色不明', '关键词初筛参考', '腾蛇']) assert.ok(system.includes(text), text);
    assert.ok(!system.includes('100—250'));
    assert.match(messages[1].content, /这次考试该如何准备/);
    assert.ok(!messages[1].content.includes('跳槽去A公司'));
    assert.ok(messages[1].content.includes(before.liuyao.mainHexagram.name));
    assert.ok(messages[1].content.includes(JSON.stringify(before.liuyao.mainHexagram.lines)));
    assert.deepEqual(record.facts, before);
  }
});

test('六爻追问保留历史与原卦，塔罗及其他工具不混入六爻专用框架', () => {
  const record = prepare({ tool: 'liuyao', question: '如何理解这次合作？', castMode: 'manual', lineValues: [7, 7, 7, 7, 7, 7], castTime: '1986-05-29T00:00' });
  const history = [{ role: 'assistant', content: '上一轮解卦' }, { role: 'user', content: '该优先核实什么？' }];
  const messages = messagesFor(record, history);
  assert.match(messages[0].content, /100—250/);
  assert.ok(!messages[0].content.includes('500—800 字'));
  assert.match(messages[0].content, /不机械重写全部五节/);
  assert.deepEqual(messages.slice(2), history);
  const tarot = messagesFor(prepare({ tool: 'tarot', question: '学习安排' }))[0].content;
  assert.match(tarot, /约 500 字/);
  assert.match(tarot, /今日金句/);
  const others = [tarot, messagesFor(prepare({ tool: 'dream', question: '梦见自己在海边散步' }))[0].content];
  for (const system of others) {
    assert.ok(!system.includes('火珠林纳甲体系'));
    assert.ok(!system.includes('【核心判断（定基调）】'));
  }
});
