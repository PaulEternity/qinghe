/** 解梦接入回归：资料边界、多选提交、历史兼容及现有 AI/札记调用链，不调用外部模型。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { once } from 'node:events';
import { prepare, tools } from './engine.mjs';
import { messagesFor, createApp } from './server.mjs';
import { testAccounts } from './support/auth-fixture.mjs';

// 固定梦境包含反复主题、睡眠线索和转折，便于检查资料完整进入模型与追问。
const input = { tool: 'dream', question: '梦见自己一直在学校找教室，最后听到铃声惊醒', dreamDate: '2024-02-29', emotions: '焦虑', context: '最近准备考试', recurringDream: 'yes', physiologySignals: ['light_sleep', 'fatigue'], structureHint: '一直找不到教室，铃响后惊醒' };
// 直接执行生产浏览器函数，模板和提交逻辑不在测试中另写一份。
const source = fs.readFileSync(new URL('./public/app.js', import.meta.url), 'utf8');
const escapeDeclaration = source.split('\n').find(line => line.startsWith('const esc='));
/** 按顶层注释边界取生产函数，保留函数内的注释和事件监听。 */
function browserFunction(name) {
  // 保留 async 前缀，否则取出的生产提交函数会被当成普通函数解析。
  const declaration = source.indexOf('function ' + name + '(');
  const start = source.slice(declaration - 6, declaration) === 'async ' ? declaration - 6 : declaration;
  assert.ok(start >= 0, name);
  const next = source.indexOf('\n/**', start);
  return source.slice(start, next < 0 ? source.length : next);
}

test('解梦资料验证、标准化与模型上下文，不向其他工具追加解梦要求', () => {
  const record = prepare({ ...input, emotions: ' 焦虑 ', physiologySignals: ['fatigue', 'fatigue'] });
  assert.equal(record.facts.dream.emotions, '焦虑');
  assert.equal(record.facts.dream.dreamDate, '2024-02-29');
  assert.deepEqual(record.facts.dream.physiologySignals, ['fatigue']);
  assert.deepEqual(record.facts.dream.physiologyLabels, ['疲劳过载']);
  const messages = messagesFor(record);
  assert.match(messages[0].content, /清和/);
  assert.match(messages[0].content, /传统象义/);
  assert.match(messages[0].content, /未提供的背景、日期或身体状态不得补造/);
  for (const text of [input.context, input.structureHint, '疲劳过载']) assert.ok(messages[1].content.includes(text));
  assert.ok(!messagesFor(prepare({ tool: 'tarot', question: '学习安排' }))[0].content.includes('梦境解读中'));
  const minimal = prepare({ tool: 'dream', question: '梦见自己在飞翔' }).facts.dream;
  assert.equal(minimal.recurringDream, '');
  assert.equal(minimal.dreamDate, '');
  assert.deepEqual(minimal.physiologySignals, []);
});

test('服务端拒绝过短正文、伪造日期、未知线索及超长补充字段', () => {
  const invalid = [
    { question: ' 梦 ' }, { question: '梦'.repeat(2001) },
    { dreamDate: '2025-02-29' }, { dreamDate: '2024-04-31' }, { dreamDate: '2024-2-29' },
    { dreamDate: null }, { emotions: {} }, { emotions: '字'.repeat(101) },
    { context: '字'.repeat(1001) }, { structureHint: '字'.repeat(1001) },
    { recurringDream: 'unknown' }, { physiologySignals: 'fatigue' },
    { physiologySignals: ['__proto__'] }, { physiologySignals: [{}] },
    { physiologySignals: Array(7).fill('fatigue') }
  ];
  for (const bad of invalid) assert.throws(() => prepare({ ...input, ...bad }));
  assert.doesNotThrow(() => prepare({ ...input, question: '梦'.repeat(2000) }));
});

test('专用表单支持所有线索、重置与资料展示，旧札记兼容且危险文字转义', () => {
  const listeners = {}, result = { innerHTML: '' }, error = { textContent: '旧错误' };
  const form = { addEventListener: (name, listener) => { listeners[name] = listener; }, querySelector: () => error };
  const context = vm.createContext({ main: { innerHTML: '' }, document: { querySelector: selector => selector === '#reading-form' ? form : result }, tools, current: { id: 'old' }, busy: false, submitDream() {} });
  vm.runInContext(escapeDeclaration + '\n' + ['dreamPage', 'dreamHTML', 'glossItem'].map(browserFunction).join('\n') + '\ndreamPage(tools.dream);', context);
  for (const name of ['dreamDate', 'emotions', 'context', 'recurringDream', 'physiologySignals', 'structureHint']) assert.ok(context.main.innerHTML.includes(`name="${name}"`), name);
  assert.equal((context.main.innerHTML.match(/name="physiologySignals"/g) || []).length, 6);
  assert.match(context.main.innerHTML, /minlength="5" maxlength="2000"/);
  assert.match(context.main.innerHTML, /清和配置的 AI/);
  listeners.reset();
  assert.equal(context.current, null);
  assert.equal(error.textContent, '');
  context.record = prepare({ ...input, context: '<script>alert(1)</script>' });
  vm.runInContext('html=dreamHTML(record);', context);
  assert.match(context.html, /&lt;script&gt;/);
  assert.ok(!context.html.includes('<script>'));
  assert.match(context.html, /惊醒\/浅睡、疲劳过载/);
  context.record = { question: '以前保存的梦境', facts: {} };
  vm.runInContext('html=dreamHTML(record);', context);
  assert.match(context.html, /以前保存的梦境/);
});

test('一次提交保留全部多选值，先保存再解读；保存失败不误解读上一份梦境', async () => {
  for (const fail of [false, true]) {
    const fields = { disabled: false }, button = { disabled: false }, error = { textContent: '' }, payloads = [];
    const entries = Object.entries(input).filter(([key]) => !['tool', 'physiologySignals'].includes(key)).concat(input.physiologySignals.map(value => ['physiologySignals', value]));
    const form = { querySelector: selector => selector === '#dream-fields' ? fields : selector === '[type=submit]' ? button : error };
    /** 模拟浏览器对禁用 fieldset 的提交规则，用于捕捉先禁用再取值导致的资料丢失。 */
    class FormValues {
      constructor() { assert.equal(fields.disabled, false); }
      [Symbol.iterator]() { return entries[Symbol.iterator](); }
      getAll(name) { return entries.filter(([key]) => key === name).map(([, value]) => value); }
    }
    let interpreted = 0;
    const context = vm.createContext({ busy: false, routeVersion: 1, current: null, FormData: FormValues, document: { querySelector: () => ({}) }, saveRecord() {}, renderResult() {}, api: async (path, payload) => {
      assert.equal(path, '/api/chart'); payloads.push(payload);
      if (fail) throw new Error('保存失败');
      return { note: { record: prepare(payload), answer: '' } };
    }, runInterpretation: async () => { assert.equal(fields.disabled, true); interpreted++; } });
    vm.runInContext(browserFunction('submitReading') + '\n' + browserFunction('submitDream'), context);
    await context.submitDream({ currentTarget: form, preventDefault() {} });
    assert.deepEqual(Array.from(payloads[0].physiologySignals), input.physiologySignals);
    assert.equal(interpreted, fail ? 0 : 1);
    assert.equal(fields.disabled, false);
    assert.equal(context.busy, false);
    if (fail) assert.equal(error.textContent, '保存失败');
  }
});

test('真实 HTTP 复用模型配置、札记、SSE 与追问，模型失败不保存片段', async t => {
  // 内存替身只验证现有仓库接口的调用，不能替代真实 MySQL 集成验证。
  const notes = new Map(), calls = [];
  const store = {
    async insert(note, userId) { notes.set(userId + ':' + note.id, structuredClone(note)); return structuredClone(note); },
    async get(id, userId) { return structuredClone(notes.get(userId + ':' + id)); },
    async save(note, userId) { return this.insert(note, userId); }
  };
  let fail = false;
  const server = createApp({ store, accounts: testAccounts, auth: { state: { modelName: 'configured-dream-model' }, authorized: () => true, handle: async () => false }, model: async (messages, options) => {
    calls.push({ messages, options });
    options.onDelta('梦境与最近的压力可能有关。');
    if (fail) throw new Error('模型连接提前中断');
    return { configured: true, answer: '梦境与最近的压力可能有关。' };
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.close(); server.closeAllConnections(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  /** 使用现有清和路由发起请求，不创建独立 dream 代理或外部计费请求。 */
  const post = (path, payload, stream = false) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(stream ? { Accept: 'text/event-stream' } : {}) }, body: JSON.stringify(payload) });
  const chart = await (await post('/api/chart', input)).json();
  assert.equal(calls.length, 0);
  assert.equal((await post('/api/chart', { ...input, physiologySignals: ['bad'] })).status, 400);
  assert.equal(notes.size, 1);
  const forged = { ...chart.record, facts: { dream: { context: '伪造背景' } } };
  const response = await post('/api/interpret', { record: forged }, true);
  const stream = await response.text();
  assert.match(stream, /event: delta/); assert.match(stream, /event: done/);
  assert.equal(calls[0].options.modelName, 'configured-dream-model');
  assert.ok(calls[0].messages[1].content.includes(input.context));
  assert.ok(!calls[0].messages[1].content.includes('伪造背景'));
  assert.equal((await store.get(chart.record.id, 'test-user')).answer, '梦境与最近的压力可能有关。');
  const follow = await (await post('/api/followup', { record: chart.record, question: '如果又梦到同样的场景呢？' }, true)).text();
  assert.match(follow, /event: done/);
  const saved = await store.get(chart.record.id, 'test-user');
  assert.deepEqual(saved.record.facts.dream, chart.record.facts.dream);
  assert.equal(saved.history.length, 2);
  assert.equal(notes.size, 1);
  fail = true;
  const next = await (await post('/api/chart', input)).json();
  const broken = await (await post('/api/interpret', { record: next.record }, true)).text();
  assert.match(broken, /event: error/); assert.ok(!broken.includes('event: done'));
  assert.equal((await store.get(next.record.id, 'test-user')).answer, '');
});
