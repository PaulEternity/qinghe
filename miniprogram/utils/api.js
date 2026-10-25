/** 小程序网络边界：Bearer 身份与 AI 令牌分开，服务端决定角色和数据归属。 */
const { baseUrl, cloud } = require('../config');
const { SSEDecoder } = require('./sse');
const SESSION_KEY = 'qinghe.session:' + baseUrl;
let aiToken = '', verification = null, streamVersion = 0;
const tasks = new Set();
let cloudReady = false;
/** 云托管通道不依赖 request 合法域名，失败时不回退到公网或旧后端。 */
function container(path, options) {
  if(!wx.cloud || typeof wx.cloud.callContainer !== 'function')throw new Error('请升级微信后使用清和云服务');
  if(!cloudReady){wx.cloud.init();cloudReady=true;}
  return wx.cloud.callContainer({...options,config:{env:cloud.env},path,header:{...options.header,'X-WX-SERVICE':cloud.service}});
}
/** 公共牌图经云托管读取为临时本地文件，避免 image 绕回公网域名。 */
const cardImages = new Map();
function cardImage(id) {
  if(!/^rws-(?:[0-9]|[1-6][0-9]|7[0-7])$/.test(id))return Promise.reject(new Error('牌图无效'));
  const path='/assets/tarot/rws/'+id+'.jpg';
  if(!cloud)return Promise.resolve(baseUrl+path);
  if(cardImages.has(id))return cardImages.get(id);
  const pending=new Promise((resolve,reject)=>container(path,{method:'GET',responseType:'arraybuffer',timeout:95000,header:{},
    success:response=>{
      if(response.statusCode!==200)return reject(new Error('牌图加载失败'));
      const filePath=wx.env.USER_DATA_PATH+'/qinghe-'+id+'.jpg';
      wx.getFileSystemManager().writeFile({filePath,data:response.data,success:()=>resolve(filePath),fail:()=>reject(new Error('牌图缓存失败'))});
    },fail:()=>reject(new Error('牌图连接失败'))}));
  cardImages.set(id,pending);
  pending.catch(()=>cardImages.delete(id));
  return pending;
}
/** 仅保存应用会话，不保存微信 session_key、AppSecret 或 AI 密钥。 */
function session() { return wx.getStorageSync(SESSION_KEY) || null; }
/** 切换身份时清除旧 AI 授权与页面共享缓存。 */
function saveSession(value) {
  abortStreams();aiToken='';
  if(value)wx.setStorageSync(SESSION_KEY,value);else wx.removeStorageSync(SESSION_KEY);
  getApp().globalData.status=null;
}
/** 请求头不能由业务表单覆盖，以免把用户输入当作授权。 */
function headers(stream) {
  const value=session(),header={'Content-Type':'application/json'};
  if(value)header.Authorization='Bearer '+value.token;
  if(aiToken)header['X-Qinghe-AI']=aiToken;
  if(stream)header.Accept='text/event-stream';
  return header;
}
/** 微信请求的 HTTP 错误和网络错误统一变成可显示的异常。 */
function send(path,input) {
  return new Promise((resolve,reject)=>{
    const options={method:input===undefined?'GET':'POST',data:input,header:headers(false),timeout:95000,
    success:resolve,fail:error=>{
      const detail=error?.errMsg||'';
      console.error('清和接口连接失败',{url:baseUrl+path,errMsg:detail});
      let message='无法连接清和服务，请稍后重试或联系维护者';
      if(/not in domain list|域名.*不合法/i.test(detail))message='服务域名尚未获微信授权，请联系维护者配置后重新发布';
      else if(/timeout|timed out/i.test(detail))message='清和服务响应超时，请稍后重试';
      else if(/ssl|tls|certificate|cert\b/i.test(detail))message='清和服务安全连接失败，请联系维护者检查证书';
      reject(new Error(message));
    }};
    if(cloud)container(path,options);else wx.request({...options,url:baseUrl+path});
  });
}
/** 访问码验证只在用户主动调用 AI 时弹出，不自动记住访问码。 */
async function verify() {
  if(verification)return verification;
  const identity=session()?.token;
  verification=new Promise((resolve,reject)=>wx.showModal({title:'验证 AI 访问码',content:'',editable:true,placeholderText:'输入六位数字，验证后五分钟有效',
    success:async result=>{
      if(!result.confirm)return reject(new Error('已取消 AI 验证，盘面已保留'));
      const code=(result.content||'').trim();
      if(!/^\d{6}$/.test(code))return reject(new Error('请输入六位数字访问码'));
      try{if(session()?.token!==identity)throw new Error('账号已切换，请重新验证');const response=await send('/api/access/verify',{code});if(response.statusCode!==200)throw new Error(response.data.error||'访问码验证失败');if(session()?.token!==identity)throw new Error('账号已切换，请重新验证');aiToken=response.data.aiToken;resolve();}catch(error){reject(error);}
    },fail:()=>reject(new Error('无法打开访问码输入框'))})).finally(()=>{verification=null;});
  return verification;
}
/** 登录失效后清理本地身份，避免在旧用户上下文继续调用。 */
function failure(response) {
  if(response.statusCode===401&&response.data.code==='LOGIN_REQUIRED')saveSession(null);
  return new Error(response.data.error||'请求失败');
}
/** 普通接口最多在访问码验证后重试一次，不自动重试计费请求。 */
async function api(path,input,retry=true) {
  const response=await send(path,input);
  if(response.statusCode===401&&response.data.code==='AI_ACCESS_REQUIRED'&&retry){await verify();return api(path,input,false);}
  if(response.statusCode<200||response.statusCode>=300)throw failure(response);
  return response.data;
}
/** wx.login 的临时码由后端交换；服务器返回的角色仅用于显示管理入口。 */
async function login() {
  const result=await new Promise((resolve,reject)=>wx.login({success:resolve,fail:()=>reject(new Error('无法获取微信登录凭证'))}));
  if(!result.code)throw new Error('微信登录未返回凭证，请重试');
  const data=await api('/api/wechat/login',{code:result.code});saveSession({token:data.token});return data;
}
/** 原生分块请求解析 SSE；页面卸载可通过 abortStreams 主动取消。 */
function streamOnce(path,input,onDelta) {
  // shortcut: callContainer 无原生分块/中止接口，云端用完整 JSON，离页仅取消本机等待。
  if(cloud)return new Promise((resolve,reject)=>{
    let cancelled=false;
    const task={abort(){cancelled=true;tasks.delete(task);reject(new Error('页面已离开，请刷新札记确认生成结果'));}};
    tasks.add(task);
    send(path,input).then(response=>{if(!cancelled)resolve(response);},error=>{if(!cancelled)reject(error);}).finally(()=>tasks.delete(task));
  });
  return new Promise((resolve,reject)=>{
    const decoder=new SSEDecoder(onDelta);let chunked=false,failed=false,task;
    /** 异常只结算一次，并主动断开 HTTP 请求通知服务端取消。 */
    const stop=error=>{if(failed)return;failed=true;if(task){tasks.delete(task);task.abort();}reject(error);};
    task=wx.request({url:baseUrl+path,method:'POST',data:input,header:headers(true),timeout:95000,enableChunked:true,dataType:'text',responseType:'arraybuffer',
      success:response=>{
        if(failed)return;tasks.delete(task);
        try{
          if(response.statusCode<200||response.statusCode>=300){
            let data=response.data;
            try{
              if(decoder.raw)data=JSON.parse(decoder.raw);
              else if(typeof data==='string')data=JSON.parse(data);
              else if(Object.prototype.toString.call(data)==='[object ArrayBuffer]'){decoder.push(data,true);data=JSON.parse(decoder.raw);}
              if(!data||typeof data!=='object'||(typeof data.error!=='string'&&typeof data.code!=='string'))throw new Error();
            }catch{data={error:'服务响应无效'};}
            return resolve({statusCode:response.statusCode,data});
          }
          if(!chunked&&response.data)decoder.push(response.data);
          decoder.push(null,true);

          if(!decoder.result)throw new Error('连接提前中断，未保存为完整解读');
          resolve({statusCode:200,data:decoder.result});
        }catch(error){stop(error);}
      },fail:()=>stop(new Error('模型连接已中断，请刷新札记确认结果'))});
    tasks.add(task);
    if(typeof task.onChunkReceived!=='function')return stop(new Error('请升级微信版本后使用流式解读'));
    task.onChunkReceived(event=>{if(failed)return;try{chunked=true;decoder.push(event.data);}catch(error){stop(error);}});
  });
}
/** 仅在模型尚未开始执行的 401 响应后重试，不重复发送失败的模型请求。 */
async function stream(path,input,onDelta,retry=true,version=streamVersion) {
  if(version!==streamVersion)throw new Error('页面已离开，模型请求已取消');
  if(retry){
    const access=await api('/api/access/status');
    if(!access.expiresAt||access.expiresAt<=Date.now())await verify();
    if(version!==streamVersion)throw new Error('页面已离开，模型请求已取消');
  }
  const response=await streamOnce(path,input,onDelta);
  if(response.statusCode===401&&response.data.code==='AI_ACCESS_REQUIRED'&&retry){await verify();return stream(path,input,onDelta,false,version);}
  if(response.statusCode!==200)throw failure(response);
  return response.data;
}
/** 离开结果页或退出账号时中断所有本机模型流。 */
function abortStreams(){streamVersion++;for(const task of tasks)task.abort();tasks.clear();}
/** 页面统一显示简短错误，长内容保留在页面的 error 字段。 */
function showError(page,error){page.setData({error:error.message||'操作失败'});}
module.exports={api,login,session,saveSession,stream,abortStreams,showError,baseUrl,cardImage};
