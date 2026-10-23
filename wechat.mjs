/** 微信独立身份：只信任服务端换取的 OpenID，不与网页账号自动合并。 */
import { randomBytes, randomUUID, createHash } from 'node:crypto';

/** 只接受应用签发的随机令牌；OpenID、session_key 不作为客户端登录凭据。 */
export function bearerOf(req) {
  return /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')?.[1];
}
/** 数据库只存令牌摘要。 */
const digest = token => createHash('sha256').update(token).digest('hex');

/** 微信用户和会话使用独立表，继续复用札记仓库的 owner_id 隔离。 */
export class WechatAccounts {
  /** 微信凭据仅由服务端环境注入；fetcher 支持不访问微信的回归测试。 */
  constructor({ pool, env = process.env, fetcher = fetch, now = Date.now } = {}) {
    this.pool = pool; this.env = env; this.fetcher = fetcher; this.now = now;
    this.attempts = new Map();
  }

  /** 新增表，不修改或迁移已有网页用户。 */
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS wechat_users (
      id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      appid VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      openid VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY wechat_identity (appid,openid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS wechat_sessions (
      token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      user_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      KEY wechat_session_expiry (expires_at), KEY wechat_session_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }

  /** 每次从数据库读取角色，提升/撤销权限无需等待旧令牌过期。 */
  async current(req) {
    const token = bearerOf(req);
    if (!token || !this.pool || !this.env.WECHAT_APP_ID) return null;
    const [rows] = await this.pool.execute(`SELECT u.id,u.is_admin FROM wechat_users u
      JOIN wechat_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.appid=?`,
    [digest(token), new Date(this.now()), this.env.WECHAT_APP_ID]);
    if (!rows[0]) return null;
    return { user: { id: rows[0].id, username: '微信用户', admin: Boolean(rows[0].is_admin) }, sessionKey: digest(token) };
  }

  /** 对登录换码做有界限流，不记录 code、AppSecret 或微信返回正文。 */
  limited(req) {
    for (const [key,value] of this.attempts) if (value.until <= this.now()) this.attempts.delete(key);
    const key = req.socket.remoteAddress || 'local';
    if (!this.attempts.has(key)) {
      if (this.attempts.size >= 1000) return true;
      this.attempts.set(key, { count: 0, until: this.now() + 300_000 });
    }
    return ++this.attempts.get(key).count > 30;
  }

  /** 临时登录码只交给固定微信接口；不接受客户端提交的 OpenID 或管理员标记。 */
  async login(code, req) {
    if (!this.pool || !this.env.WECHAT_APP_ID || !this.env.WECHAT_APP_SECRET) throw new Error('请先在服务端配置微信 AppID 和 AppSecret');
    if (this.limited(req)) throw new Error('微信登录过于频繁，请 5 分钟后重试');
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(code)) throw new Error('微信登录码无效，请重新登录');
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.search = new URLSearchParams({ appid: this.env.WECHAT_APP_ID, secret: this.env.WECHAT_APP_SECRET, js_code: code, grant_type: 'authorization_code' }).toString();
    let data;
    try {
      const response = await this.fetcher(url, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
      if (!response.ok) throw new Error();
      data = await response.json();
    } catch { throw new Error('微信登录服务暂不可用，请稍后重试'); }
    if (data.errcode || typeof data.openid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.openid)) throw new Error('微信登录码已失效，请重新登录');
    const appid = this.env.WECHAT_APP_ID;
    await this.pool.execute('INSERT IGNORE INTO wechat_users (id,appid,openid) VALUES (?,?,?)', ['wx_' + randomUUID(), appid, data.openid]);
    const [rows] = await this.pool.execute('SELECT id,is_admin FROM wechat_users WHERE appid=? AND openid=?', [appid, data.openid]);
    const user = { id: rows[0].id, username: '微信用户', admin: Boolean(rows[0].is_admin) };
    const token = randomBytes(32).toString('hex');
    await this.pool.execute('DELETE FROM wechat_sessions WHERE expires_at<=?', [new Date(this.now())]);
    // 再次登录撤销同一客户端旧令牌，避免遗留已丢弃的授权。
    if (bearerOf(req)) await this.logout(req);
    await this.pool.execute('INSERT INTO wechat_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', [digest(token), user.id, new Date(this.now() + 86400_000)]);
    return { token, user, admin: user.admin };
  }

  /** 只撤销当前微信会话，不触碰网页 Cookie。 */
  async logout(req) {
    const token = bearerOf(req);
    if (token) await this.pool.execute('DELETE FROM wechat_sessions WHERE token_hash=?', [digest(token)]);
  }
}
