import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { deploymentConfig } from './deployment.mjs';
import { createApp } from './server.mjs';
import { AccessControl } from './access.mjs';
import { UserAccounts } from './accounts.mjs';
import { MysqlStore } from './store.ts';
import { httpFetch as fetch } from './support/http-request.mjs';

test('云端配置要求固定 HTTPS 来源；远程数据库必须校验证书和主机名', async () => {
  assert.equal(deploymentConfig({}).bind, '127.0.0.1');
  const config = deploymentConfig({ APP_MODE: 'cloud', RENDER_EXTERNAL_URL: 'https://qinghe.onrender.com', PORT: '10000' });
  assert.equal(config.bind, '0.0.0.0');assert.equal(config.host, 'qinghe.onrender.com');
  for (const env of [{ APP_MODE: 'other' }, { APP_MODE: 'cloud' }, { APP_MODE: 'cloud', PUBLIC_ORIGIN: 'http://example.com' }, { APP_MODE: 'cloud', PUBLIC_ORIGIN: 'https://example.com/path' }]) assert.throws(() => deploymentConfig(env));
  const env = { MYSQL_HOST: 'database.example.com', MYSQL_USER: 'test', MYSQL_PASSWORD: 'test', MYSQL_DATABASE: 'test' };
  assert.throws(() => new MysqlStore(env), /APP_MODE/);
  assert.throws(() => new MysqlStore({ ...env, APP_MODE: 'cloud' }), /MYSQL_SSL/);
  const store = new MysqlStore({ ...env, APP_MODE: 'cloud', MYSQL_SSL: 'true' });
  const ssl = store.pool.pool.config.connectionConfig.ssl;
  assert.equal(ssl.rejectUnauthorized, true);assert.equal(ssl.verifyIdentity, true);assert.equal(ssl.minVersion, 'TLSv1.2');
  await store.close();
});

test('云端数据库非 TLS 连接必须显式授权且仅接受 RFC1918 字面 IPv4', async () => {
  const env = { APP_MODE: 'cloud', MYSQL_USER: 'test', MYSQL_PASSWORD: 'test', MYSQL_DATABASE: 'test', MYSQL_SSL: 'false', MYSQL_ALLOW_INSECURE_PRIVATE: 'true' };
  for (const host of ['10.29.101.116','172.16.0.1','172.31.255.254','192.168.1.2']) {
    const config = { ...env, MYSQL_HOST: host };
    const store = new MysqlStore(config);
    try { assert.ok(!store.pool.pool.config.connectionConfig.ssl); }
    finally { await store.close(); }
    for (const override of [{MYSQL_ALLOW_INSECURE_PRIVATE:undefined},{MYSQL_ALLOW_INSECURE_PRIVATE:'false'},{MYSQL_SSL:undefined}]) {
      assert.throws(() => new MysqlStore({ ...config, ...override }), /MYSQL_SSL/);
    }
    assert.throws(() => new MysqlStore({ ...config, APP_MODE:'local' }), /APP_MODE/);
    const secure = new MysqlStore({ ...config, MYSQL_SSL:'true' });
    try { assert.equal(secure.pool.pool.config.connectionConfig.ssl.rejectUnauthorized, true); }
    finally { await secure.close(); }
  }
  for (const host of ['8.8.8.8','172.15.255.255','172.32.0.1','192.169.0.1','127.0.0.1','localhost','db.internal','10.29.101.116.example.com','10.0.0.999','010.0.0.1','::1','::ffff:10.29.101.116',undefined]) {
    assert.throws(() => new MysqlStore({ ...env, MYSQL_HOST:host }), /MYSQL_SSL/);
  }
});

test('云端拒绝非本站 Host、跨站和缺失 Origin 的写请求；健康检查不暴露数据', async t => {
  const deployment = deploymentConfig({ APP_MODE: 'cloud', PUBLIC_ORIGIN: 'https://qinghe.onrender.com' });
  const server = createApp({ deployment });
  server.listen(0, '127.0.0.1');await once(server, 'listening');
  t.after(() => { server.close();server.closeAllConnections(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/healthz')).status, 200);
  assert.equal((await fetch(base + '/api/status')).status, 403);
  const response = await fetch(base + '/api/status', { headers: { Host: deployment.host } });
  assert.equal(response.status, 200);assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000');
  for (const origin of [undefined,'https://evil.example']) {
    const denied = await fetch(base + '/api/account/login', { method: 'POST', headers: { Host: deployment.host, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: '{}' });
    assert.equal(denied.status, 403);
  }
  const unauthenticated = await fetch(base + '/api/notes', { headers: { Host: deployment.host } });
  assert.equal(unauthenticated.status, 401);
});

test('云端用户、AI 和管理员 Cookie 均包含 Secure，清除 Cookie 也保留保护', async () => {
  const headers = new Map();
  const res = { setHeader: (name,value) => headers.set(name,value) };
  const auth = new AccessControl({ secure: true });auth.issue(res, 'admin');
  assert.match(headers.get('Set-Cookie'), /; Secure$/);
  auth.issue(res, 'ai');assert.match(headers.get('Set-Cookie'), /; Secure$/);
  const accounts = new UserAccounts({ secure: true, pool: { execute: async () => [{ affectedRows: 1 }] } });
  await accounts.issue({ headers: {} }, res, { id: 'test' });
  assert.ok(headers.get('Set-Cookie').every(value => value.endsWith('; Secure')));
});
