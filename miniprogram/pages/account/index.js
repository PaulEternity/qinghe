/** 微信账号页：显示本应用账号标识供服务端指定管理员，不暴露 OpenID。 */
const {api,login,session,saveSession,showError}=require('../../utils/api');
Page({
  data:{user:null,admin:false,busy:false,error:''},
  /** 重新读取服务端角色，账号提升后无需重新签发客户端角色。 */
  async onShow(){if(!session()){this.setData({user:null,admin:false});return;}try{const status=await api('/api/status');this.setData({user:status.user,admin:status.admin,error:''});}catch(error){this.setData({user:null,admin:false});showError(this,error);}},
  /** 微信登录必须由明确点击发起，取消或失败时保留原页面。 */
  async login(){if(this.data.busy)return;this.setData({busy:true,error:''});try{const result=await login();this.setData({user:result.user,admin:result.admin});}catch(error){showError(this,error);}finally{this.setData({busy:false});}},
  /** 登出先撤销服务器令牌，再清理客户端缓存并重置导航栈。 */
  async logout(){if(this.data.busy)return;this.setData({busy:true,error:''});try{await api('/api/wechat/logout',{});saveSession(null);wx.reLaunch({url:'/pages/home/index'});}catch(error){showError(this,error);}finally{this.setData({busy:false});}},
  /** UUID 是账号标识而非凭据；复制供可信服务端命令核对。 */
  copyId(){wx.setClipboardData({data:this.data.user.id});},
  /** 管理员与普通用户共用同一业务账号。 */
  openAdmin(){wx.navigateTo({url:'/pages/admin/index'});}
});
