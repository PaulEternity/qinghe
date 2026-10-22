import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

const FIVE_MINUTES = 5 * 60 * 1000;
const hash = (text, salt = randomBytes(16).toString('hex')) => ({ salt, digest: scryptSync(text, salt, 32).toString('hex') });
const matches = (text, saved) => typeof text === 'string' && text.length <= 128 && timingSafeEqual(Buffer.from(saved.digest, 'hex'), scryptSync(text, saved.salt, 32));
const tokenHash = token => createHash('sha256').update(token).digest('hex');

/** Local single-admin account; AI permission is a separate, fixed five-minute session. */
export class AccessControl {
  constructor({ state = null, now = Date.now, persist = async () => {} } = {}) {
    this.state = state;
    this.now = now;
    this.persist = persist;
    this.sessions = new Map();
    this.failures = new Map();
    this.updating = false;
  }

  static async open(directory) {
    await mkdir(directory, { recursive: true });
    const path = join(directory, 'access.json');
    let state;
    try { state = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const password = randomBytes(18).toString('base64url');
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      state = { username: 'admin', password: hash(password), code: hash(code) };
      await writeFile(join(directory, 'admin-credentials.txt'), `管理员账号：admin\n管理员密码：${password}\n初始 AI 访问码：${code}\n\n仅首次生成；修改后此文件中的旧凭据不再有效。请妥善保存或删除。\n`, { mode: 0o600, flag: 'wx' });
      await writeFile(path, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
    }
    if (state.username !== 'admin' || ![state.password, state.code].every(v => v && /^[a-f0-9]{32}$/.test(v.salt) && /^[a-f0-9]{64}$/.test(v.digest))) throw new Error('管理员配置损坏，请检查 .local/access.json');
    return new AccessControl({ state, persist: async value => {
      const temp = `${path}.tmp`;
      await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
      await rename(temp, path);
    } });
  }

  session(req, role) {
    const name = role === 'admin' ? 'qinghe_admin' : 'qinghe_ai';
    const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
    const token = cookie?.slice(name.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const key = tokenHash(token), session = this.sessions.get(key);
    if (!session || session.role !== role) return null;
    if (role === 'ai' && session.identity !== (req.userSessionKey || null)) return null;
    if (session.expiresAt <= this.now()) { this.sessions.delete(key); return null; }
    return { ...session, key };
  }

  issue(res, role, identity = null) {
    for (const [key, value] of this.sessions) if (value.expiresAt <= this.now()) this.sessions.delete(key);
    if (this.sessions.size >= 1000) this.sessions.delete(this.sessions.keys().next().value);
    const token = randomBytes(32).toString('hex');
    const seconds = role === 'admin' ? 1800 : 300;
    const expiresAt = this.now() + seconds * 1000;
    this.sessions.set(tokenHash(token), { role, expiresAt, identity });
    res.setHeader('Set-Cookie', `${role === 'admin' ? 'qinghe_admin' : 'qinghe_ai'}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}`);
    return expiresAt;
  }

  revoke(role) {
    for (const [key, value] of this.sessions) if (value.role === role) this.sessions.delete(key);
  }

  /** All paths that invoke a model must pass this check before parsing or streaming. */
  authorized(req) { return Boolean(this.session(req, 'ai')); }

  async handle(req, res, path, readBody, reply) {
    if (!path.startsWith('/api/access/')) return false;
    const send = (status, data) => { reply(res, status, data); return true; };
    if (req.method === 'GET' && path === '/api/access/status') return send(200, {
      ready: Boolean(this.state), admin: Boolean(this.session(req, 'admin')), expiresAt: this.session(req, 'ai')?.expiresAt || 0
    });
    if (req.method !== 'POST') return send(404, { error: '账号接口不存在' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: '需要 JSON 请求' });
    if (!this.state) return send(503, { error: '管理员尚未初始化' });
    if (path === '/api/access/verify' || path === '/api/access/login') {
      const role = path.endsWith('/login') ? 'admin' : 'ai';
      const attempt = this.failures.get(role);
      if (attempt && attempt.until > this.now() && attempt.count >= 5) return send(429, { error: '错误次数过多，请 5 分钟后重试' });
      const input = await readBody(req);
      const valid = role === 'admin'
        ? input?.username === this.state.username && matches(input?.password, this.state.password)
        : typeof input?.code === 'string' && /^\d{6}$/.test(input.code) && matches(input.code, this.state.code);
      if (!valid) {
        const failure = attempt && attempt.until > this.now() ? attempt : { count: 0, until: this.now() + FIVE_MINUTES };
        failure.count++;
        this.failures.set(role, failure);
        return send(401, { error: role === 'admin' ? '账号或密码不正确' : '请输入正确的六位数字访问码' });
      }
      this.failures.delete(role);
      return send(200, { ok: true, expiresAt: this.issue(res, role, req.userSessionKey || null) });
    }
    const admin = this.session(req, 'admin');
    if (!admin) return send(401, { error: '请先登录管理员账号' });
    if (path === '/api/access/logout') {
      this.sessions.delete(admin.key);
      res.setHeader('Set-Cookie', 'qinghe_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return send(200, { ok: true });
    }
    if (!['/api/access/code', '/api/access/password'].includes(path)) return send(404, { error: '账号接口不存在' });
    if (this.updating) return send(409, { error: '正在保存，请稍后重试' });
    this.updating = true;
    try {
      const input = await readBody(req);
      const next = { ...this.state };
      if (path.endsWith('/code')) {
        if (typeof input?.code !== 'string' || !/^\d{6}$/.test(input.code)) return send(400, { error: '访问码必须是六位数字，可包含开头的 0' });
        next.code = hash(input.code);
      } else {
        if (!matches(input?.currentPassword, this.state.password)) return send(401, { error: '当前管理员密码不正确' });
        if (typeof input?.password !== 'string' || input.password.length < 12 || input.password.length > 128) return send(400, { error: '管理员密码长度应为 12—128 位' });
        next.password = hash(input.password);
      }
      await this.persist(next);
      this.state = next;
      this.revoke(path.endsWith('/code') ? 'ai' : 'admin');
      return send(200, { ok: true });
    } finally { this.updating = false; }
  }
}
