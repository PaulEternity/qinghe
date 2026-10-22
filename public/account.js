export function showAccount(user, admin = false) {
  const link = document.querySelector('#account-link');
  link.textContent = admin ? 'admin' : user ? user.username : '登录 / 注册';
  document.querySelector('#admin-link').hidden = !admin;
}

export function accountChanged(target = '#home') {
  localStorage.setItem('qinghe.account.changed', String(Date.now()) + Math.random());
  location.hash = target;
  location.reload();
}

export async function accountPage(main, mode) {
  main.innerHTML = '<section class="panel"><h2>我的账号</h2><p>正在检查登录状态…</p></section>';
  const hash = location.hash;
  try {
    const response = await fetch('/api/account/status'), status = await response.json();
    if (!response.ok) throw new Error(status.error || '无法读取登录状态');
    if (location.hash !== hash) return;
    showAccount(status.user, status.admin);
    if (status.user || status.admin) {
      main.innerHTML = `<div class="page-head"><h2>我的账号</h2></div><section class="panel account-panel"><p>当前账号：<strong id="current-username"></strong></p><p>${status.admin ? '管理员身份已验证，可进入管理页面修改 AI 访问码。' : '札记仅属于你的账号。使用 AI 时仍需验证管理员提供的六位访问码。'}</p><a class="secondary" href="${status.admin ? '#admin' : '#history'}">${status.admin ? '进入管理页面' : '查看我的札记'}</a><button class="quiet" id="user-logout">退出登录</button><p role="status"></p></section>`;
      document.querySelector('#current-username').textContent = status.admin ? 'admin' : status.user.username;
      document.querySelector('#user-logout').onclick = async event => {
        event.currentTarget.disabled = true;
        try {
          const result = await fetch('/api/account/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
          if (!result.ok) throw new Error('退出失败，请重试');
          accountChanged();
        } catch (error) { main.querySelector('[role=status]').textContent = error.message; event.target.disabled = false; }
      };
      return;
    }
    const registering = mode === 'register';
    main.innerHTML = `<div class="page-head"><h2>${registering ? '注册账号' : '用户登录'}</h2><p>登录后生成和保存属于自己的札记。</p></div><section class="panel account-panel"><form id="user-form"><label for="user-username">用户名（3—32 位字母、数字或下划线）</label><input id="user-username" name="username" autocomplete="username" pattern="[A-Za-z0-9_]{3,32}" minlength="3" maxlength="32" required><label for="user-password">密码（12—128 位）</label><input id="user-password" name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="12" maxlength="128" required>${registering ? '<label for="user-confirm">再次输入密码</label><input id="user-confirm" name="confirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required>' : ''}<div class="form-actions"><button class="primary">${registering ? '注册并登录' : '登录'}</button><a href="${registering ? '#account' : '#account/register'}">${registering ? '已有账号，去登录' : '没有账号，去注册'}</a></div><p role="status"></p></form></section>`;
    const form = document.querySelector('#user-form');
    form.onsubmit = async event => {
      event.preventDefault();
      const input = Object.fromEntries(new FormData(form)), output = form.querySelector('[role=status]'), button = form.querySelector('button');
      if (registering && input.password !== input.confirm) { output.textContent = '两次密码不一致'; return; }
      button.disabled = true;
      output.textContent = '';
      try {
        const result = await fetch(`/api/account/${registering ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const data = await result.json();
        if (!result.ok) throw new Error(data.error || '登录失败');
        accountChanged(data.admin ? '#admin' : '#home');
      } catch (error) { output.textContent = error.message; }
      finally { button.disabled = false; }
    };
  } catch (error) { if (location.hash === hash) main.textContent = error.message; }
}
