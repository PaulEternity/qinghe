import { testAccounts } from './support/auth-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccessControl } from './access.mjs';
import { createApp } from './server.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'qinghe-access-'));
  const auth = await AccessControl.open(directory);
  let now = Date.now();
  auth.now = () => now;
  const credentials = await readFile(join(directory, 'admin-credentials.txt'), 'utf8');
  const password = credentials.match(/管理员密码：(\S+)/)[1];
  const code = credentials.match(/初始 AI 访问码：(\d{6})/)[1];
  let calls = 0;
  // 模拟模型记录请求收到的覆盖值，供测试验证保存后立即生效。
  let lastModelName;
  let lastConnection;
  const server = createApp({accounts:testAccounts, auth, model: async (_, options) => {
    calls++;
    lastModelName = options?.modelName;
    lastConnection = options?.connection;
    options?.onDelta?.('模拟回答');
    return { configured: true, answer: '模拟回答' };
  } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.close(); server.closeAllConnections(); await rm(directory, { recursive: true, force: true }); });
  const post = (path, input, cookie = '', headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers }, body: JSON.stringify(input) });
  return { auth, directory, base, password, code, post, advance: milliseconds => { now += milliseconds; }, calls: () => calls, lastModelName: () => lastModelName, lastConnection: () => lastConnection };
}
const cookie = response => response.headers.get('set-cookie').split(';')[0];

/** 验证管理员切换服务时，密钥加密落盘且只发送到对应接口。 */
test('管理员保存星火接口与密钥，读取配置时隐藏 Key', async t => {
  const previousSecret = process.env.MODEL_SETTINGS_SECRET;
  process.env.MODEL_SETTINGS_SECRET = 'test-only-model-secret-32-characters';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.MODEL_SETTINGS_SECRET;
    else process.env.MODEL_SETTINGS_SECRET = previousSecret;
  });
  const f = await fixture(t);
  const path = '/api/access/model';
  const admin = cookie(await f.post('/api/access/login', { username: 'admin', password: f.password }));
  const ai = cookie(await f.post('/api/access/verify', { code: f.code }));
  const baseUrl = 'https://maas-api.cn-huabei-1.xf-yun.com/v2';
  const apiKey = 'fake-spark-key';
  const config = { modelName: 'spark-x2.6', baseUrl: baseUrl + '/chat/completions', apiKey };
  assert.equal((await f.post(path, config, ai)).status, 401);
  assert.equal((await f.post(path, { ...config, baseUrl: 'https://127.0.0.1/v2' }, admin)).status, 400);
  assert.equal((await f.post(path, config, admin)).status, 200);
  const status = await (await fetch(f.base + path, { headers: { Cookie: admin } })).json();
  assert.equal(status.baseUrl, baseUrl);
  assert.equal(status.hasSavedKey, true);
  assert.ok(!JSON.stringify(status).includes(apiKey));
  assert.ok(!(await readFile(join(f.directory, 'access.json'), 'utf8')).includes(apiKey));
  assert.equal((await f.post(path, { ...config, baseUrl: 'https://api.deepseek.com', apiKey: '' }, admin)).status, 400);
  assert.equal((await f.post(path, { ...config, apiKey: '' }, admin)).status, 200);

  // 模拟重启重新读取磁盘配置，再验证流式请求使用配套接口与密钥。
  f.auth.state = (await AccessControl.open(f.directory)).state;
  const payload = { tool: 'tarot', question: '当下' };
  const stream = await f.post('/api/reading', payload, ai, { Accept: 'text/event-stream' });
  assert.match(await stream.text(), /event: done/);
  assert.equal(f.lastModelName(), 'spark-x2.6');
  assert.deepEqual(f.lastConnection(), { baseUrl, apiKey });
  assert.equal((await f.post(path, { modelName: '', baseUrl: '', apiKey: '' }, admin)).status, 200);
  assert.equal((await f.post('/api/reading', payload, ai)).status, 200);
  assert.equal(f.lastConnection(), undefined);
});

/** 通过实际 HTTP 路由验证模型名的权限、持久化及生效范围。 */
test('管理员模型名可持久化，应用于 JSON 和 SSE，留空清除覆盖', async t => {
  const f = await fixture(t);
  const path = '/api/access/model';
  const ai = cookie(await f.post('/api/access/verify', { code: f.code }));
  const read = session => fetch(f.base + path, { headers: { Cookie: session } });
  assert.equal((await read(ai)).status, 401);
  assert.equal((await f.post(path, { modelName: 'test-model' }, ai)).status, 401);
  const admin = cookie(await f.post('/api/access/login', { username: 'admin', password: f.password }));
  assert.equal((await (await read(admin)).json()).modelName, '');
  assert.equal((await f.post(path, { modelName: 'invalid model' }, admin)).status, 400);
  assert.equal((await f.post(path, { modelName: ' test-model ' }, admin)).status, 200);
  assert.equal((await (await read(admin)).json()).modelName, 'test-model');
  assert.equal((await AccessControl.open(f.directory)).state.modelName, 'test-model');

  const payload = { tool: 'tarot', question: '当下' };
  assert.equal((await f.post('/api/reading', payload, ai)).status, 200);
  assert.equal(f.lastModelName(), 'test-model');
  const streamed = await f.post('/api/reading', payload, ai, { Accept: 'text/event-stream' });
  assert.match(await streamed.text(), /event: done/);
  assert.equal(f.lastModelName(), 'test-model');
  assert.equal((await f.post(path, { modelName: '' }, admin)).status, 200);
  assert.equal((await AccessControl.open(f.directory)).state.modelName, undefined);
  assert.equal((await f.post('/api/reading', payload, ai)).status, 200);
  assert.equal(f.lastModelName(), undefined);
});

test('所有模型路径默认拒绝；验证码固定有效 5 分钟，复用不续期', async t => {
  const f = await fixture(t);
  for (const path of ['/api/reading', '/api/interpret', '/api/followup']) {
    const denied = await f.post(path, {}, '', { Accept: 'text/event-stream' });
    assert.equal(denied.status, 401);
    assert.equal((await denied.json()).code, 'AI_ACCESS_REQUIRED');
  }
  assert.equal(f.calls(), 0);
  const payload = { tool: 'tarot', question: '当下' };
  assert.equal((await f.post('/api/chart', payload)).status, 200);
  const verify = await f.post('/api/access/verify', { code: f.code });
  assert.equal(verify.status, 200);
  assert.match(verify.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const session = cookie(verify);
  assert.equal((await f.post('/api/reading', payload, session)).status, 200);
  f.advance(299_999);
  assert.equal((await f.post('/api/reading', payload, session)).status, 200);
  f.advance(1);
  assert.equal((await f.post('/api/reading', payload, session)).status, 401);
  assert.equal(f.calls(), 2);
  assert.equal((await f.post('/api/access/verify', { code: f.code })).status, 200);
});

test('仅管理员可改码；前导零、旧会话撤销、持久化与管理员改密', async t => {
  const f = await fixture(t);
  const session = cookie(await f.post('/api/access/verify', { code: f.code }));
  assert.equal((await f.post('/api/access/code', { code: '000123' }, session)).status, 401);
  assert.equal((await f.post('/api/access/login', { username: 'admin', password: f.code })).status, 401);
  const adminResponse = await f.post('/api/access/login', { username: 'admin', password: f.password });
  const admin = cookie(adminResponse);
  assert.equal((await f.post('/api/reading', {}, admin)).status, 401);
  for (const invalid of ['12345', '1234567', 'abcdef', 123456]) assert.equal((await f.post('/api/access/code', { code: invalid }, admin)).status, 400);
  assert.equal((await f.post('/api/access/code', { code: '000123' }, admin)).status, 200);
  assert.equal((await f.post('/api/reading', {}, session)).status, 401);
  assert.equal((await f.post('/api/access/verify', { code: f.code })).status, 401);
  assert.equal((await f.post('/api/access/verify', { code: '000123' })).status, 200);
  const disk = await readFile(join(f.directory, 'access.json'), 'utf8');
  assert.ok(!disk.includes('000123') && !disk.includes(f.password));
  const reopened = await AccessControl.open(f.directory);
  assert.deepEqual(reopened.state, f.auth.state);
  assert.equal((await f.post('/api/access/password', { currentPassword: 'wrong', password: 'new-password-123' }, admin)).status, 401);
  assert.equal((await f.post('/api/access/password', { currentPassword: f.password, password: 'new-password-123' }, admin)).status, 200);
  assert.equal((await f.post('/api/access/code', { code: '555555' }, admin)).status, 401);
  assert.equal((await f.post('/api/access/login', { username: 'admin', password: f.password })).status, 401);
  assert.equal((await f.post('/api/access/login', { username: 'admin', password: 'new-password-123' })).status, 200);
});

test('错误尝试限流、跨站拦截、保存失败不撤销旧码', async t => {
  const f = await fixture(t);
  const wrong = f.code === '111111' ? '222222' : '111111';
  for (let i = 0; i < 5; i++) assert.equal((await f.post('/api/access/verify', { code: wrong })).status, 401);
  assert.equal((await f.post('/api/access/verify', { code: f.code })).status, 429);
  f.advance(300_000);
  assert.equal((await f.post('/api/access/verify', { code: f.code })).status, 200);
  assert.equal((await f.post('/api/access/verify', { code: f.code }, '', { Origin: 'https://evil.example' })).status, 403);
  const admin = cookie(await f.post('/api/access/login', { username: 'admin', password: f.password }));
  f.auth.persist = async () => { throw new Error('disk unavailable'); };
  assert.equal((await f.post('/api/access/code', { code: '987654' }, admin)).status, 400);
  assert.equal((await f.post('/api/access/verify', { code: f.code })).status, 200);
});
