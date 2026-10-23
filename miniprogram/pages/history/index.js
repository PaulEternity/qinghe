/** 私人札记列表：每次由后端限定账号归属，客户端不传 owner_id。 */
const {api,session,showError}=require('../../utils/api');
const {exportNotes}=require('../../utils/presentation');
Page({
  data:{notes:[],busy:false,error:''},
  /** 页面重新进入时加载权威记录，不展示上个账号的本地缓存。 */
  async onShow(){this.setData({notes:[],error:''});if(!session())return showError(this,new Error('请先微信登录'));await this.load();},
  /** 全量读取与网页保持一致，不偷偷截断用户记录。 */
  async load(){this.setData({busy:true});try{const result=await api('/api/notes');this.setData({notes:result.notes});}catch(error){showError(this,error);}finally{this.setData({busy:false});}},
  /** ID 仅用于选择，最终归属仍由服务端验证。 */
  open(event){wx.navigateTo({url:'/pages/note/index?id='+encodeURIComponent(event.currentTarget.dataset.id)});},
  /** 删除与清空前明确确认，不在失败时先移除页面记录。 */
  remove(event){const id=event.currentTarget.dataset.id;wx.showModal({title:id?'删除这条札记？':'清空全部札记？',content:'此操作无法恢复，请先导出备份。',success:async result=>{if(!result.confirm)return;try{await api(id?'/api/notes/delete':'/api/notes/clear',id?{id}:{confirm:'delete-all'});await this.load();}catch(error){showError(this,error);}}});},
  /** 只导出当前账号已加载的记录。 */
  exportAll(){exportNotes(this.data.notes);},
  /** 全新微信账号不自动读取或导入网页浏览器旧记录。 */
  login(){wx.navigateTo({url:'/pages/account/index'});}
});
