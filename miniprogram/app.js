/** 清和小程序入口：身份由后端签发，不读取头像、昵称、手机号或定位。 */
App({
  globalData: { status: null, gloss: null },
  /** 首屏按需加载；登录必须由用户点击按钮发起。 */
  onLaunch() {}
});
