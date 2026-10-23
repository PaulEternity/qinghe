/** 可信服务端专用：将已经微信登录的应用账号提升/撤销为管理员，无公开提权接口。 */
import { fileURLToPath } from 'node:url';
import { MysqlStore } from '../store.ts';

/** 必须同时核对 AppID 和精确账号 ID，不使用昵称或首个登录者。 */
export async function setWechatAdmin(pool, appid, userId, enabled) {
  if (typeof appid !== 'string' || !/^wx[a-f0-9]{16}$/.test(appid)) throw new Error('WECHAT_APP_ID 无效，请核对目标小程序');
  if (typeof userId !== 'string' || !/^wx_[a-f0-9-]{36}$/.test(userId) || typeof enabled !== 'boolean') throw new Error('账号标识或管理员操作无效');
  const [users] = await pool.execute('SELECT id FROM wechat_users WHERE id=? AND appid=?', [userId, appid]);
  if (!users.length) throw new Error('账号不存在或不属于当前小程序，请先微信登录并核对账号标识');
  await pool.execute('UPDATE wechat_users SET is_admin=? WHERE id=? AND appid=?', [enabled, userId, appid]);
}

// 只在显式运行命令时写数据库；导入模块用于测试不会执行提权。
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [action, userId] = process.argv.slice(2);
  if (!['grant', 'revoke'].includes(action) || !userId) throw new Error('用法：node scripts/wechat-admin.mjs grant|revoke wx_账号UUID');
  const store = new MysqlStore();
  try {
    await setWechatAdmin(store.pool, process.env.WECHAT_APP_ID, userId, action === 'grant');
    console.log(action === 'grant' ? '微信管理员权限已授予；回到账号页刷新生效。' : '微信管理员权限已撤销；后续请求立即按普通用户校验。');
  } finally { await store.close(); }
}
