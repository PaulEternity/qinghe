/** 探索首页：入口来自同一后端工具表，不另建一套功能白名单。 */
const {api,showError}=require('../../utils/api');
Page({
  data:{tools:[],user:null,admin:false,error:'',loading:false},
  /** 每次回到首页刷新身份，后台撤销管理员权限后入口同步消失。 */
  async onShow(){this.setData({loading:true,error:''});try{const status=await api('/api/status');getApp().globalData.status=status;this.setData({tools:Object.keys(status.tools).filter(id=>!status.tools[id].legacy).map(id=>({id,...status.tools[id]})),user:status.user,admin:status.admin});}catch(error){showError(this,error);}finally{this.setData({loading:false});}},
  /** 未登录仍可浏览入口，开始生成盘面时由账号页完成登录。 */
  openTool(event){wx.navigateTo({url:'/pages/reading/index?tool='+event.currentTarget.dataset.id});},
  /** 固定导航目标，不从远端数据接受页面路径。 */
  openHistory(){wx.navigateTo({url:'/pages/history/index'});},
  /** 账号页提供主动微信登录和退出。 */
  openAccount(){wx.navigateTo({url:'/pages/account/index'});},
  /** 管理入口仅负责导航，后端对每次管理请求重新授权。 */
  openAdmin(){wx.navigateTo({url:'/pages/admin/index'});}
});
