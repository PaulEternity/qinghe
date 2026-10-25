/** 仅放公开地址；AppSecret 和模型 Key 必须保留在服务端。 */
// 只有开发版模拟器访问本机；手机预览、体验版和正式版仍使用 HTTPS 后端。
const localSimulator = typeof wx !== 'undefined'
  && typeof wx.getAccountInfoSync === 'function'
  && typeof wx.getSystemInfoSync === 'function'
  && wx.getAccountInfoSync().miniProgram.envVersion === 'develop'
  && wx.getSystemInfoSync().platform === 'devtools';
module.exports = {
  baseUrl: localSimulator ? 'http://127.0.0.1:3187' : 'https://qinghe-u3gv.onrender.com'
};
