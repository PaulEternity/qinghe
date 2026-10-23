/** 网页模型管理：只展示配置状态；Key 输入框始终留空，避免明文回显。 */
export async function renderModelSettings(main, accessFetch) {
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.innerHTML = '<h3>共享模型配置</h3><p class="help">网页与小程序共用配置。关闭开关会停止该模型的所有在途请求；其他部署通常在 250 毫秒轮询后同步停止，网络或数据库延迟可能增加等待时间。已产生的费用无法撤销。</p><div id="model-forms"></div><p id="model-admin-error" role="alert"></p>';
  main.append(panel);
  let state;
  /** 所有设置只发往本站，连接测试仍通过访问码验证。 */
  async function api(path, input) {
    const response = await accessFetch(path, input ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : {});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '模型配置请求失败');
    return data;
  }
  /** 用 DOM 属性填充外部配置，地址和模型名不能注入 HTML。 */
  function render() {
    const forms = panel.querySelector('#model-forms');forms.replaceChildren();
    for (const [kind,label] of [['text','文字模型'],['vision','图片模型']]) {
      const item = state[kind], form = document.createElement('form');
      form.className = 'model-config-form';
      form.innerHTML = `<h4>${label}</h4><label class="model-toggle"><input name="enabled" type="checkbox"> 启用${label}</label><p class="help model-state"></p><label for="${kind}-base">接口根地址</label><input id="${kind}-base" name="baseUrl" type="url" maxlength="500" placeholder="https://服务商地址/v1"><label for="${kind}-model">模型名称</label><input id="${kind}-model" name="model" maxlength="200"><label for="${kind}-key">API Key（留空保留原值）</label><input id="${kind}-key" name="apiKey" type="password" autocomplete="new-password" maxlength="4096"><div class="form-actions"><button class="primary" type="submit">保存配置</button><button class="secondary" type="button">测试已保存配置</button></div><p class="help">连接测试会发送一次真实请求，可能产生费用。图片测试使用内置测试图，不发送私人照片。</p><p role="status"></p>`;
      form.elements.baseUrl.value=item.baseUrl;form.elements.model.value=item.model;form.elements.enabled.checked=item.enabled;
      form.querySelector('.model-state').textContent=`${item.enabled?'已启用':'已禁用'} · ${item.hasKey?'已配置密钥':'未配置密钥'} · ${item.configured?'参数已齐全，需测试连通性':'参数不完整'}`;
      /** 在操作期间锁定本组，保存使用修订号避免覆盖另一管理端修改。 */
      async function update(payload) {
        const output=form.querySelector('[role=status]');
        for(const control of form.elements)control.disabled=true;
        try{state=await api('/api/admin/models',{kind,revision:state.revision,...payload});render();}
        catch(error){output.textContent=error.message;form.elements.enabled.checked=state[kind].enabled;}
        finally{for(const control of form.elements)control.disabled=false;}
      }
      form.elements.enabled.onchange=()=>update({enabled:form.elements.enabled.checked});
      form.onsubmit=event=>{event.preventDefault();update({enabled:form.elements.enabled.checked,baseUrl:form.elements.baseUrl.value,model:form.elements.model.value,apiKey:form.elements.apiKey.value});};
      form.querySelector('[type=button]').onclick=async event=>{
        const button=event.currentTarget;button.disabled=true;
        try{await api('/api/admin/models/test',{kind});form.querySelector('[role=status]').textContent='连接测试成功';}
        catch(error){form.querySelector('[role=status]').textContent=error.message;}
        finally{button.disabled=false;}
      };
      forms.append(form);
    }
  }
  try{state=await api('/api/admin/models');render();}
  catch(error){panel.querySelector('#model-admin-error').textContent=error.message;}
}
