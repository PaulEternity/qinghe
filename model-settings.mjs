/** 共享模型配置与请求生命周期：密钥加密，停用代次跨部署传播，完整结果受事务保护。 */
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { askModel } from './model.ts';

const KINDS = ['text', 'vision'];
/** 解码 MySQL JSON，兼容驱动的字符串与对象返回格式。 */
const unpack = value => typeof value === 'string' ? JSON.parse(value) : value;
/** 统一可向客户端显示的中断信息，不附带任何上游凭据。 */
const stopped = () => new Error('模型已禁用或请求已中断，未保存未完成的回答');

/** 复用 app_settings，网页和小程序后端连接同一数据库、使用相同加密密钥。 */
export class ModelSettings {
  /** 接受明确的配置加密密钥，禁止把登录密码或 AI 访问码作为加密密钥。 */
  constructor({ pool, secret, env = process.env, model = askModel, pollMs = 250 } = {}) {
    if (!/^[a-f0-9]{64}$/i.test(secret || '')) throw new Error('请配置 MODEL_CONFIG_SECRET（64 位十六进制，所有部署相同）');
    this.pool = pool; this.key = Buffer.from(secret, 'hex'); this.env = env; this.model = model;
    this.active = new Set(); this.pollMs = pollMs; this.monitor = null; this.syncing = false;
  }

  /** AES-GCM 同时保护密文与完整性，每次保存使用新随机 nonce。 */
  encrypt(value) {
    if (!value) return '';
    const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [nonce, cipher.getAuthTag(), data].map(part => part.toString('base64')).join('.');
  }

  /** 解密仅发生在服务端调用边界；错密钥直接失败，不回退旧环境变量。 */
  decrypt(value) {
    if (!value) return '';
    try {
      const [nonce, tag, data] = value.split('.').map(part => Buffer.from(part, 'base64'));
      const decipher = createDecipheriv('aes-256-gcm', this.key, nonce); decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch { throw new Error('模型配置解密失败，请核对各部署的 MODEL_CONFIG_SECRET'); }
  }

  /** 仅首次导入环境配置；已有数据库配置不被重启或另一部署覆盖。 */
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS app_settings (
      id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      value JSON NOT NULL, revision INT UNSIGNED NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const initial = {};
    for (const kind of KINDS) {
      const prefix = kind === 'text' ? 'MODEL_' : 'VISION_MODEL_';
      initial[kind] = { enabled: true, epoch: 0, baseUrl: this.env[prefix + 'BASE_URL'] || '', model: this.env[prefix + 'NAME'] || '', key: this.encrypt(this.env[prefix + 'API_KEY'] || '') };
    }
    await this.pool.execute('INSERT IGNORE INTO app_settings (id,value) VALUES (?,?)', ['models', JSON.stringify(initial)]);
    await this.refresh();
    for (const kind of KINDS) this.decrypt(this.state[kind].key);
  }

  /** 每次调用前读取权威配置；活动请求以短轮询发现其他进程的停用。 */
  async refresh() {
    const [rows] = await this.pool.execute('SELECT value,revision FROM app_settings WHERE id=?', ['models']);
    if (!rows[0]) throw new Error('请先初始化共享模型配置');
    // 并行读取可能迟到，旧快照不得回滚已观察到的禁用代次。
    if (Number(rows[0].revision) < (this.revision || 0)) return this.state;
    const state = unpack(rows[0].value);
    for (const ticket of this.active) {
      if (!state[ticket.kind].enabled || state[ticket.kind].epoch !== ticket.epoch) ticket.controller.abort(stopped());
    }
    this.state = state; this.revision = Number(rows[0].revision);
    return state;
  }

  /** 管理页可读地址、模型与开关，永不返回密文或明文 Key。 */
  async status(admin = false) {
    const state = await this.refresh(), result = {};
    for (const kind of KINDS) {
      const item = state[kind];
      result[kind] = { enabled: item.enabled, configured: Boolean(item.baseUrl && item.model && item.key) };
      if (admin) Object.assign(result[kind], { baseUrl: item.baseUrl, model: item.model, hasKey: Boolean(item.key) });
    }
    return admin ? { revision: this.revision, ...result } : result;
  }

  /** 用修订号阻止两个管理端互相覆盖；开关关闭时递增取消代次。 */
  async save(input) {
    if (!KINDS.includes(input?.kind)) throw new Error('模型类型无效');
    await this.refresh();
    const revision = this.revision;
    if (input.revision !== revision) throw new Error('模型配置已被修改，请刷新后重试');
    const state = structuredClone(this.state), item = state[input.kind];
    if (typeof input.enabled !== 'boolean') throw new Error('模型开关无效');
    if (input.baseUrl !== undefined) {
      if (typeof input.baseUrl !== 'string' || input.baseUrl.length > 500) throw new Error('模型服务地址无效');
      const base = input.baseUrl.trim().replace(/\/+$/, '');
      if (base) {
        let url; try { url = new URL(base); } catch { throw new Error('模型服务地址无效'); }
        if (!['https:', ...(this.env.APP_MODE === 'cloud' ? [] : ['http:'])].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('模型服务地址无效，云端请使用 HTTPS 根路径');
      }
      item.baseUrl = base;
    }
    if (input.model !== undefined) {
      if (typeof input.model !== 'string' || input.model.length > 200) throw new Error('模型名称无效');
      item.model = input.model.trim();
    }
    if (input.apiKey !== undefined && input.apiKey !== '') {
      if (typeof input.apiKey !== 'string' || !input.apiKey.trim() || input.apiKey.length > 4096) throw new Error('模型密钥无效');
      item.key = this.encrypt(input.apiKey.trim());
    }
    if (!input.enabled) item.epoch++;
    item.enabled = input.enabled;
    const [result] = await this.pool.execute('UPDATE app_settings SET value=?,revision=revision+1 WHERE id=? AND revision=?', [JSON.stringify(state), 'models', revision]);
    if (result.affectedRows !== 1) throw new Error('模型配置已被修改，请刷新后重试');
    // 提交后立即取消本进程请求；远端进程通过 epoch 检出禁用后又启用的情况。
    await this.refresh();
    return this.status(true);
  }

  /** 一个活动请求对应一个取消句柄，JSON、SSE 与连接测试共用此路径。 */
  async begin(kind, signal) {
    await this.refresh();
    const item = this.state[kind];
    if (!item?.enabled) throw new Error('模型已禁用，请联系管理员启用');
    if (!item.baseUrl || !item.model || !item.key) throw new Error(kind === 'vision' ? '模型未配置：图片模型暂不可用' : '模型未配置，请联系管理员');
    const controller = new AbortController();
    const ticket = { kind, epoch: item.epoch, controller, signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
      env: { MODEL_BASE_URL: item.baseUrl, MODEL_NAME: item.model, MODEL_API_KEY: this.decrypt(item.key) } };
    this.active.add(ticket);
    if (!this.monitor) {
      this.monitor = setInterval(async () => {
        if (this.syncing) return;
        this.syncing = true;
        try { await this.refresh(); }
        catch { for (const current of this.active) current.controller.abort(new Error('模型配置同步失败，已停止请求，请稍后重试')); }
        finally { this.syncing = false; }
      }, this.pollMs);
      this.monitor.unref();
    }
    return ticket;
  }

  /** 即便上游实现忽略 signal，应用也立即结束等待，拒绝迟到的完整结果。 */
  async invoke(ticket, messages, options = {}) {
    ticket.signal.throwIfAborted();
    let listener;
    try {
      return await Promise.race([
        this.model(messages, { ...options, env: ticket.env, signal: ticket.signal,
          onDelta: options.onDelta ? text => { if (!ticket.signal.aborted) options.onDelta(text); } : undefined }),
        new Promise((_, reject) => { listener = () => reject(stopped()); ticket.signal.addEventListener('abort', listener, { once: true }); if (ticket.signal.aborted) listener(); })
      ]);
    } finally { if (listener) ticket.signal.removeEventListener('abort', listener); }
  }

  /** 与停用操作锁同一配置行；取消与保存之间有明确事务先后，禁止半成品落库。 */
  async finish(ticket, persist) {
    ticket.signal.throwIfAborted();
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute('SELECT value,revision FROM app_settings WHERE id=? FOR UPDATE', ['models']);
      const item = unpack(rows[0].value)[ticket.kind];
      if (!item.enabled || item.epoch !== ticket.epoch || ticket.signal.aborted) throw stopped();
      const result = await persist(connection);
      await connection.commit();
      return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  /** 请求结束后释放监控；没有活动模型调用时不持续轮询数据库。 */
  end(ticket) {
    this.active.delete(ticket);
    if (!this.active.size && this.monitor) { clearInterval(this.monitor); this.monitor = null; }
  }

  /** 测试已保存配置，文字和视觉都发送最小真实请求，仍受开关和取消控制。 */
  async test(kind) {
    if (!KINDS.includes(kind)) throw new Error('模型类型无效');
    const ticket = await this.begin(kind);
    const content = kind === 'text' ? '连接测试，请回复“连接成功”。' : [
      { type: 'text', text: '图片连接测试，请简短描述图片颜色。' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC' } }
    ];
    try {
      const result = await this.invoke(ticket, [{ role: 'user', content }]);
      if (!result.configured || !result.answer) throw new Error('模型没有返回有效测试结果');
      return { ok: true };
    } finally { this.end(ticket); }
  }
}
