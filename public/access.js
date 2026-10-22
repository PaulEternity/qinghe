let verification = null;

async function request(path, input) {
  const response = await fetch(path, input ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : {});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '请求失败');
  return result;
}

function verifyCode() {
  if (verification) return verification;
  verification = new Promise((resolve, reject) => {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = `<form><h2>验证 AI 访问码</h2><p>输入管理员提供的六位数字访问码。验证成功后，5 分钟内无需重复输入；调用 AI 不会延长有效期。</p><label for="ai-access-code">六位数字访问码</label><input id="ai-access-code" name="code" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required autofocus><p class="notice" role="alert"></p><div class="form-actions"><button class="secondary" type="button">取消</button><button class="primary" type="submit">验证并继续</button></div></form>`;
    const close = () => { dialog.close(); dialog.remove(); };
    const cancel = () => { close(); reject(new Error('已取消 AI 访问验证，盘面已保留')); };
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    dialog.querySelector('[type=button]').onclick = cancel;
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const button = dialog.querySelector('[type=submit]');
      button.disabled = true;
      try { await request('/api/access/verify', { code: dialog.querySelector('input').value }); close(); resolve(); }
      catch (error) { dialog.querySelector('[role=alert]').textContent = error.message; }
      finally { button.disabled = false; }
    };
    document.body.append(dialog);
    dialog.showModal();
  }).finally(() => { verification = null; });
  return verification;
}

/** Retry once after server-issued authorization; credentials stay in HttpOnly cookies. */
export async function accessFetch(path, options) {
  const response = await fetch(path, options);
  if (response.status !== 401) return response;
  const error = await response.clone().json().catch(() => ({}));
  if (error.code !== 'AI_ACCESS_REQUIRED') return response;
  await verifyCode();
  options?.signal?.throwIfAborted();
  return fetch(path, options);
}

/** Separate administrator account; the shared AI code grants no administrator access. */
export async function adminPage(main) {
  main.innerHTML = '<section class="panel"><h2>管理员账号</h2><p>正在检查登录状态…</p></section>';
  const hash = location.hash;
  try {
    const status = await request('/api/access/status');
    if (location.hash !== hash) return;
    main.innerHTML = status.admin
      ? `<div class="page-head"><h2>管理员设置</h2><p>账号：admin。只有管理员可以修改 AI 访问码；访问码不能用于管理员登录。</p></div><div class="workspace"><section class="panel"><form id="change-code"><h3>修改 AI 访问码</h3><label for="new-code">新的六位数字访问码</label><input id="new-code" name="code" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required><label for="confirm-code">再次输入访问码</label><input id="confirm-code" name="confirm" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" required><p class="help">保存后，所有用户现有的 5 分钟验证立即失效。每次验证的有效期固定为 5 分钟。</p><button class="primary">保存访问码</button><p role="status"></p></form></section><section class="panel"><form id="change-password"><h3>修改管理员密码</h3><label for="current-password">当前密码</label><input id="current-password" name="currentPassword" type="password" autocomplete="current-password" maxlength="128" required><label for="new-password">新密码（12—128 位）</label><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required><label for="confirm-password">再次输入新密码</label><input id="confirm-password" name="confirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required><p class="help">修改成功后，所有管理员会话退出，需要重新登录。</p><button class="primary">保存管理员密码</button><p role="status"></p></form></section></div><button id="admin-logout" class="secondary">退出管理员账号</button>`
      : `<div class="page-head"><h2>管理员登录</h2><p>登录后可以修改六位 AI 访问码和管理员密码。</p></div><section class="panel"><form id="admin-login"><label for="admin-username">账号</label><input id="admin-username" name="username" value="admin" autocomplete="username" required><label for="admin-password">管理员密码</label><input id="admin-password" name="password" type="password" autocomplete="current-password" maxlength="128" required><div class="form-actions"><button class="primary">登录</button></div><p role="status"></p></form></section>`;
    const bind = (id, path, success) => {
      const form = document.getElementById(id);
      if (!form) return;
      form.onsubmit = async event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form));
        const output = form.querySelector('[role=status]'), button = form.querySelector('button');
        output.textContent = '';
        if (values.confirm !== undefined && values.confirm !== (values.code ?? values.password)) { output.textContent = '两次输入不一致'; return; }
        button.disabled = true;
        try { await request(path, values); form.reset(); if (success) output.textContent = success; else if (location.hash === hash) await adminPage(main); }
        catch (error) { output.textContent = error.message; }
        finally { button.disabled = false; }
      };
    };
    bind('admin-login', '/api/access/login');
    bind('change-code', '/api/access/code', '访问码已更新，旧验证已全部失效。请将新码告知需要使用 AI 的用户。');
    bind('change-password', '/api/access/password');
    document.getElementById('admin-logout')?.addEventListener('click', async () => {
      try { await request('/api/access/logout', {}); if (location.hash === hash) await adminPage(main); }
      catch (error) { alert(error.message); }
    });
  } catch (error) { if (location.hash === hash) main.textContent = error.message; }
}
