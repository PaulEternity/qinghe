/** 微信管理页：角色来自后端，每次保存都使用共享配置修订号。 */
const {api,showError}=require('../../utils/api');
Page({
  data:{allowed:false,models:[],revision:0,busy:false,testing:'',code:'',confirmCode:'',error:'',message:''},
  /** 普通用户不渲染配置，隐藏入口不能代替后端鉴权。 */
  async onShow(){this.setData({allowed:false,error:'',message:''});try{const status=await api('/api/status');if(!status.admin)throw new Error('请先由服务端指定此微信账号为管理员');this.display(await api('/api/admin/models'));this.setData({allowed:true});}catch(error){showError(this,error);}},
  /** Key 永远是空输入框，仅展示 hasKey 标志。 */
  display(state){this.setData({revision:state.revision,models:['text','vision'].map(kind=>({kind,label:kind==='text'?'文字模型':'图片模型',...state[kind],apiKey:''}))});},
  /** 输入只更新表单草稿，不在输入过程中保存密钥。 */
  changeField(event){const {index,field}=event.currentTarget.dataset;if(!['baseUrl','model','apiKey'].includes(field))return;this.setData({['models['+Number(index)+'].'+field]:event.detail.value});},
  /** 开关变化立即提交，禁用不要求填写完整接口参数。 */
  toggle(event){return this.save(Number(event.currentTarget.dataset.index),{enabled:event.detail.value});},
  /** 配置保存使用当前修订号，冲突时明确要求刷新而非覆盖。 */
  async save(index,patch){if(this.data.busy)return;const item={...this.data.models[index]};this.setData({busy:true,error:'',message:'',['models['+index+'].enabled']:patch.enabled});try{const state=await api('/api/admin/models',{kind:item.kind,revision:this.data.revision,...patch});this.display(state);this.setData({message:patch.enabled===false?'模型已禁用，对应在途请求正在中断。':'模型配置已保存，两端共用。'});}catch(error){this.setData({['models['+index+'].enabled']:item.enabled});showError(this,error);}finally{this.setData({busy:false});}},
  /** 只有明确点击保存才发送本地 Key 草稿，留空保留原值。 */
  saveForm(event){const index=Number(event.currentTarget.dataset.index),item=this.data.models[index];return this.save(index,{enabled:item.enabled,baseUrl:item.baseUrl,model:item.model,apiKey:item.apiKey});},
  /** 测试不阻塞开关，管理员可中途禁用以取消正在测试的请求。 */
  async test(event){if(this.data.testing)return;const kind=event.currentTarget.dataset.kind;this.setData({testing:kind,error:'',message:''});try{await api('/api/admin/models/test',{kind});this.setData({message:'连接测试成功'});}catch(error){showError(this,error);}finally{this.setData({testing:''});}},
  /** 字符串保留前导零，访问码不写入本地缓存。 */
  changeCode(event){const field=event.currentTarget.dataset.field;if(['code','confirmCode'].includes(field))this.setData({[field]:event.detail.value});},
  /** 改码后所有部署的旧五分钟授权都会被撤销。 */
  async saveCode(){if(this.data.busy)return;if(!/^\d{6}$/.test(this.data.code)||this.data.code!==this.data.confirmCode)return showError(this,new Error('请填写两次相同的六位数字访问码'));this.setData({busy:true,error:'',message:''});try{await api('/api/access/code',{code:this.data.code});this.setData({code:'',confirmCode:'',message:'访问码已更新，两端旧验证全部失效。'});}catch(error){showError(this,error);}finally{this.setData({busy:false});}}
});
