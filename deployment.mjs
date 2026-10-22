/** Public origins are explicit; forwarded headers never choose the allowed host. */
export function deploymentConfig(env = process.env) {
  const mode = env.APP_MODE || 'local';
  if (!['local', 'cloud'].includes(mode)) throw new Error('APP_MODE 只能是 local 或 cloud');
  const cloud = mode === 'cloud';
  const port = Number(env.PORT || (cloud ? 10000 : 3187));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 无效');
  let origin = null;
  if (cloud) {
    const configured = env.PUBLIC_ORIGIN || env.RENDER_EXTERNAL_URL;
    if (!configured) throw new Error('云端需要 PUBLIC_ORIGIN 或 RENDER_EXTERNAL_URL');
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('公网地址必须是 HTTPS 根地址');
    origin = url.origin;
  }
  return { cloud, port, bind: cloud ? '0.0.0.0' : '127.0.0.1', origin, host: origin ? new URL(origin).host : null };
}
