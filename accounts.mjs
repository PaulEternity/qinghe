import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const digest = token => createHash('sha256').update(token).digest('hex');
const usernameOf = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const tokenOf = req => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('qinghe_user='))?.slice(12);

/** User identity is separate from administrator authority and the shared AI code. */
export class UserAccounts {
  constructor({ pool, now = Date.now } = {}) {
    this.pool = pool;
    this.now = now;
    this.attempts = new Map();
    this.hashing = 0;
  }

  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      username VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
      password_salt CHAR(32) CHARACTER SET ascii NOT NULL,
      password_hash CHAR(64) CHARACTER SET ascii NOT NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Existing deployments do not need REFERENCES privilege after the one-time migration.
    const [sessions] = await this.pool.query("SHOW TABLES LIKE 'user_sessions'");
    if (sessions.length) return;
    await this.pool.query(`CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      user_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      KEY sessions_user (user_id), KEY sessions_expiry (expires_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }

  async current(req) {
    const token = tokenOf(req);
    if (!this.pool || !token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const sessionKey = digest(token);
    const [rows] = await this.pool.execute('SELECT u.id,u.username FROM users u JOIN user_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?', [sessionKey, new Date(this.now())]);
    return rows[0] ? { user: { id: rows[0].id, username: rows[0].username }, sessionKey } : null;
  }

  limited(key, maximum, window) {
    for (const [name, entry] of this.attempts) if (entry.until <= this.now()) this.attempts.delete(name);
    if (!this.attempts.has(key)) {
      if (this.attempts.size >= 1000) return true;
      this.attempts.set(key, { count: 0, until: this.now() + window });
    }
    const entry = this.attempts.get(key);
    return ++entry.count > maximum;
  }

  async issue(req, res, user) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(this.now() + 24 * 3600_000);
    await this.pool.execute('DELETE FROM user_sessions WHERE expires_at<=?', [new Date(this.now())]);
    await this.pool.execute('INSERT INTO user_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', [digest(token), user.id, expiresAt]);
    const previous = tokenOf(req);
    if (previous && /^[a-f0-9]{64}$/.test(previous)) await this.pool.execute('DELETE FROM user_sessions WHERE token_hash=?', [digest(previous)]);
    res.setHeader('Set-Cookie', [
      `qinghe_user=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
      'qinghe_ai=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
      'qinghe_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    ]);
  }

  async handle(req, res, path, readBody, reply, admin) {
    if (!path.startsWith('/api/account/')) return false;
    const send = (status, value) => { reply(res, status, value); return true; };
    if (path === '/api/account/status' && req.method === 'GET') return send(200, { user: req.user || null, admin: Boolean(admin.session(req, 'admin')) });
    if (!this.pool) return send(503, { error: '请先配置用户数据库' });
    if (path === '/api/account/legacy') {
      if (!admin.session(req, 'admin')) return send(401, { error: '请先登录管理员账号' });
      if (req.method === 'GET') {
        const [rows] = await this.pool.query('SELECT COUNT(*) AS count FROM readings WHERE owner_id IS NULL');
        return send(200, { count: Number(rows[0].count) });
      }
      if (req.method !== 'POST') return send(405, { error: '请求方法无效' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: '需要 JSON 请求' });
      const input = await readBody(req);
      if (input?.confirm !== 'assign-legacy') return send(400, { error: '请确认将全部未归属札记迁移给该用户' });
      const [users] = await this.pool.execute('SELECT id FROM users WHERE username=?', [usernameOf(input.username)]);
      if (!users[0]) return send(400, { error: '用户不存在，请先注册' });
      const [result] = await this.pool.execute('UPDATE readings SET owner_id=? WHERE owner_id IS NULL', [users[0].id]);
      return send(200, { ok: true, assigned: result.affectedRows });
    }
    if (req.method !== 'POST') return send(404, { error: '用户接口不存在' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: '需要 JSON 请求' });
    if (path === '/api/account/logout') {
      const token = tokenOf(req);
      if (token && /^[a-f0-9]{64}$/.test(token)) await this.pool.execute('DELETE FROM user_sessions WHERE token_hash=?', [digest(token)]);
      const adminSession = admin.session(req, 'admin');
      if (adminSession) admin.sessions.delete(adminSession.key);
      res.setHeader('Set-Cookie', ['qinghe_user=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0', 'qinghe_ai=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0', 'qinghe_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0']);
      return send(200, { ok: true });
    }
    if (!['/api/account/register', '/api/account/login'].includes(path)) return send(404, { error: '用户接口不存在' });
    const input = await readBody(req), username = usernameOf(input?.username), password = input?.password;
    const registering = path.endsWith('/register');
    const address = req.socket.remoteAddress || 'local';
    if (this.limited(`${registering ? 'register' : 'login'}:${address}`, registering ? 10 : 30, 5 * 60_000) || this.limited(`account:${username.slice(0,32)}`, 10, 5 * 60_000)) return send(429, { error: '尝试过于频繁，请 5 分钟后重试' });
    if (!registering && username === 'admin') {
      let outcome;
      await admin.handle(req, res, '/api/access/login', async () => ({ username, password }), (_, status, result) => { outcome = { status, result }; });
      if (outcome.status === 200) {
        const token = tokenOf(req);
        if (token && /^[a-f0-9]{64}$/.test(token)) await this.pool.execute('DELETE FROM user_sessions WHERE token_hash=?', [digest(token)]);
        const adminCookie = res.getHeader('Set-Cookie');
        res.setHeader('Set-Cookie', [adminCookie, 'qinghe_user=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0', 'qinghe_ai=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0']);
        return send(200, { admin: true, user: null });
      }
      return send(outcome.status, outcome.result);
    }
    if (!/^[a-z0-9_]{3,32}$/.test(username) || username === 'admin') return send(400, { error: '用户名需为 3—32 位字母、数字或下划线，不能使用 admin' });
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) return send(400, { error: '密码长度应为 12—128 位' });
    if (this.hashing >= 4) return send(429, { error: '登录请求较多，请稍后重试' });
    this.hashing++;
    try {
      let user;
      if (registering) {
        const salt = randomBytes(16).toString('hex'), derived = await derive(password, salt, 32);
        user = { id: randomUUID(), username };
        try { await this.pool.execute('INSERT INTO users (id,username,password_salt,password_hash) VALUES (?,?,?,?)', [user.id, username, salt, derived.toString('hex')]); }
        catch (error) { if (error.code === 'ER_DUP_ENTRY') return send(409, { error: '用户名已被使用' }); throw error; }
      } else {
        const [rows] = await this.pool.execute('SELECT id,username,password_salt,password_hash FROM users WHERE username=?', [username]);
        const found = rows[0], derived = await derive(password, found?.password_salt || '0'.repeat(32), 32);
        if (!found || !timingSafeEqual(derived, Buffer.from(found.password_hash, 'hex'))) return send(401, { error: '用户名或密码不正确' });
        user = { id: found.id, username: found.username };
      }
      await this.issue(req, res, user);
      const adminSession = admin.session(req, 'admin');
      if (adminSession) admin.sessions.delete(adminSession.key);
      return send(registering ? 201 : 200, { user, admin: false });
    } finally { this.hashing--; }
  }
}
