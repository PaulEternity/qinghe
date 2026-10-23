/** 微信登录与管理权限回归：真实本机 HTTP + 模拟微信/数据库，不使用真实账号和密钥。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {ModelSettings} from './model-settings.mjs';
import {WechatAccounts} from './wechat.mjs';
import {AccessControl} from './access.mjs';
import {MysqlStore} from './store.ts';
import {createApp} from './server.mjs';
import {deploymentConfig} from './deployment.mjs';
import {setWechatAdmin} from './scripts/wechat-admin.mjs';
import {MemoryPool} from './support/memory-pool.mjs';
import {httpFetch} from './support/http-request.mjs';

const env={WECHAT_APP_ID:'wx1234567890abcdef',WECHAT_APP_SECRET:'test-app-secret',MODEL_BASE_URL:'https://model.example/v1',MODEL_API_KEY:'test-model-secret',MODEL_NAME:'text',APP_MODE:'cloud'};
/** 无普通用户 Cookie 的原生请求，与现有浏览器 CSRF 检查同时运行。 */
async function fixture(t,{model}={}){
  const pool=new MemoryPool();let now=Date.now(),calls=0;
  const wechat=new WechatAccounts({pool,env,now:()=>now,fetcher:async url=>{assert.equal(url.origin,'https://api.weixin.qq.com');return Response.json(url.searchParams.get('js_code')==='expired'?{errcode:40029}:{openid:'openid_'+url.searchParams.get('js_code'),session_key:'never-return-this'});}});
  await wechat.init();
  const store=Object.create(MysqlStore.prototype);store.pool=pool;
  const auth=await AccessControl.openDatabase(pool,{password:'admin-test-password',code:'001234'});
  const models=new ModelSettings({pool,env,secret:'ab'.repeat(32),pollMs:10,model:async(messages,options)=>{calls++;if(model)return model(messages,options);options.onDelta?.('完整回答');return {configured:true,answer:'完整回答'};}});await models.init();
  const deployment=deploymentConfig({APP_MODE:'cloud',PUBLIC_ORIGIN:'https://qinghe.example'});
  // Cookie 账号替身用于证明无效微信 Bearer 不能回退到已有网页身份。
  const accounts={current:async req=>req.headers.cookie?.includes('web-session')?{user:{id:'web-user',username:'web_user'},sessionKey:'web-key'}:null,handle:async()=>false};
  const server=createApp({store,auth,models,wechat,accounts,deployment});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.close();server.closeAllConnections();for(const ticket of [...models.active]){ticket.controller.abort();models.end(ticket);}});
  const base=`http://127.0.0.1:${server.address().port}`;
  const raw=(path,input,token,extra={})=>httpFetch(base+path,{method:input===undefined?'GET':'POST',headers:{Host:deployment.host,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra},body:input===undefined?undefined:JSON.stringify(input)});
  const call=async(path,input,token,extra={})=>{const response=await raw(path,input,token,extra);return {status:response.status,body:await response.json()};};
  const login=async code=>{const response=await call('/api/wechat/login',{code,admin:true,openid:'forged'});assert.equal(response.status,200);assert.ok(!JSON.stringify(response.body).includes('openid'));assert.ok(!JSON.stringify(response.body).includes('never-return-this'));return response.body;};
  return {pool,wechat,store,models,auth,call,raw,login,calls:()=>calls,advance:ms=>{now+=ms;}};
}

test('微信登录新建普通账号，同 OpenID 稳定、不同 AppID 隔离；令牌摘要、过期与退出',async t=>{
  const f=await fixture(t),first=await f.login('alice'),again=await f.login('alice');
  assert.equal(first.admin,false);assert.equal(first.user.id,again.user.id);
  assert.ok(!f.pool.sessions.has(first.token));assert.equal((await f.call('/api/status',undefined,first.token)).body.user.id,first.user.id);
  assert.equal((await f.call('/api/wechat/login',{code:'expired'})).status,400);
  const other=new WechatAccounts({pool:f.pool,env:{...env,WECHAT_APP_ID:'wxabcdef1234567890'}});
  assert.equal(await other.current({headers:{authorization:'Bearer '+first.token}}),null);
  f.advance(86400_000);assert.equal((await f.call('/api/status',undefined,first.token)).status,401);
  const fresh=await f.login('alice');assert.equal((await f.call('/api/wechat/logout',{},fresh.token)).status,200);
  assert.equal((await f.call('/api/status',undefined,fresh.token)).status,401);
});

test('服务端指定管理员后可同时使用业务，AI 不免码；普通用户与失效角色不能改配置',async t=>{
  const f=await fixture(t),admin=await f.login('owner'),user=await f.login('reader');
  assert.equal((await f.call('/api/admin/models',undefined,admin.token)).status,401);
  await setWechatAdmin(f.pool,env.WECHAT_APP_ID,admin.user.id,true);
  assert.equal((await f.call('/api/status',undefined,admin.token)).body.admin,true);
  const chart=await f.call('/api/chart',{tool:'tarot',question:'当前问题'},admin.token);assert.equal(chart.status,200);
  assert.equal((await f.call('/api/interpret',{record:chart.body.record},admin.token)).body.code,'AI_ACCESS_REQUIRED');
  const verified=await f.call('/api/access/verify',{code:'001234'},admin.token);assert.equal(verified.status,200);assert.match(verified.body.aiToken,/^[a-f0-9]{64}$/);
  const result=await f.call('/api/interpret',{record:chart.body.record},admin.token,{'X-Qinghe-AI':verified.body.aiToken});assert.equal(result.status,200);assert.equal(result.body.note.answer,'完整回答');
  // 同一 AI 令牌不能借给另一微信身份。
  assert.equal((await f.call('/api/reading',{tool:'tarot',question:'另一个问题'},user.token,{'X-Qinghe-AI':verified.body.aiToken})).status,401);
  assert.equal((await f.call('/api/admin/models',{kind:'text',revision:1,enabled:false},user.token)).status,401);
  const config=await f.call('/api/admin/models',undefined,admin.token);assert.ok(!JSON.stringify(config.body).includes(env.MODEL_API_KEY));
  assert.equal((await f.call('/api/admin/models/test',{kind:'text'},admin.token)).body.code,'AI_ACCESS_REQUIRED');
  assert.equal((await f.call('/api/admin/models/test',{kind:'text'},admin.token,{'X-Qinghe-AI':verified.body.aiToken})).status,200);
  await setWechatAdmin(f.pool,env.WECHAT_APP_ID,admin.user.id,false);
  assert.equal((await f.call('/api/admin/models',undefined,admin.token)).status,401);
});

test('微信与网页札记隔离；客户端伪造用户ID、跨站请求和旧 Cookie 不能越权',async t=>{
  const f=await fixture(t),a=await f.login('alice'),b=await f.login('bob');
  const chart=await f.call('/api/chart',{tool:'tarot',question:'私人的问题',owner_id:b.user.id},a.token);
  assert.equal((await f.call('/api/notes',undefined,b.token)).body.notes.length,0);
  assert.equal((await f.call('/api/notes/reveal',{id:chart.body.note.id,revealed:[0]},b.token)).status,400);
  assert.equal((await f.call('/api/notes',undefined,undefined,{Cookie:'web-session'})).body.notes.length,0);
  assert.equal((await f.call('/api/notes',undefined,'0'.repeat(64),{Cookie:'web-session'})).status,401);
  assert.equal((await f.call('/api/chart',{tool:'tarot',question:'跨站'},a.token,{Origin:'https://evil.example'})).status,403);
  assert.equal((await f.call('/api/account/login',{username:'admin',password:'admin-test-password'})).status,403);
  assert.equal((await f.call('/api/account/legacy',undefined,a.token)).status,403);
  const notes=(await f.call('/api/notes',undefined,a.token)).body.notes;assert.equal(notes[0].id,chart.body.note.id);
});

test('真实 HTTP：另一个部署禁用时同时中断 JSON、SSE，迟到回答不落库且本地排盘仍可用',{timeout:5000},async t=>{
  let started;const ready=new Promise(resolve=>{started=resolve;}),signals=[],late=[];
  const f=await fixture(t,{model:async(_,options)=>{signals.push(options.signal);options.onDelta?.('未完成片段');if(signals.length===2)started();return new Promise(resolve=>late.push(resolve));}});
  const user=await f.login('reader');
  const verify=await f.call('/api/access/verify',{code:'001234'},user.token),headers={'X-Qinghe-AI':verify.body.aiToken};
  const first=await f.call('/api/chart',{tool:'tarot',question:'JSON请求'},user.token),second=await f.call('/api/chart',{tool:'tarot',question:'流式请求'},user.token);
  const json=f.call('/api/interpret',{record:first.body.record},user.token,headers);
  const stream=f.raw('/api/interpret',{record:second.body.record},user.token,{...headers,Accept:'text/event-stream'});
  await ready;
  const other=new ModelSettings({pool:f.pool,env,secret:'ab'.repeat(32)});await other.init();
  await other.save({kind:'text',revision:other.revision,enabled:false});
  const rejected=await json;assert.equal(rejected.status,400);assert.match(rejected.body.error,/模型已禁用|中断/);
  const wire=await (await stream).text();assert.match(wire,/event: error/);assert.doesNotMatch(wire,/event: done/);
  assert.ok(signals.every(signal=>signal.aborted));
  for(const resolve of late)resolve({configured:true,answer:'迟到完整回答'});
  assert.equal((await f.store.get(first.body.note.id,user.user.id)).answer,'');
  assert.equal((await f.store.get(second.body.note.id,user.user.id)).answer,'');
  assert.equal((await f.call('/api/interpret',{record:first.body.record},user.token,headers)).status,400);
  assert.equal(f.calls(),2);
  assert.equal((await f.call('/api/chart',{tool:'tarot',question:'仍可排盘'},user.token)).status,200);
});

test('手相仅路由图片模型，未配置时明确拒绝，不保存照片也不回退文字模型',async t=>{
  const seen=[];const f=await fixture(t,{model:async(messages,options)=>{seen.push({messages,env:options.env});return {configured:true,answer:'图片观察回答'};}});
  const user=await f.login('palm_user'),image='data:image/png;base64,YQ==';
  const chart=await f.call('/api/chart',{tool:'palm',question:'看看纹理',image},user.token);
  assert.equal(chart.status,200);assert.ok(!JSON.stringify(chart.body.note).includes(image));
  const verify=await f.call('/api/access/verify',{code:'001234'},user.token),headers={'X-Qinghe-AI':verify.body.aiToken};
  const denied=await f.call('/api/interpret',{record:chart.body.record,image},user.token,headers);assert.match(denied.body.error,/图片模型暂不可用/);assert.equal(f.calls(),0);
  await f.models.save({kind:'vision',revision:f.models.revision,enabled:true,baseUrl:'https://vision.example/v1',model:'vision-only',apiKey:'vision-test-secret'});
  const answer=await f.call('/api/interpret',{record:chart.body.record,image},user.token,headers);assert.equal(answer.status,200);
  assert.equal(seen[0].env.MODEL_NAME,'vision-only');assert.equal(seen[0].env.MODEL_API_KEY,'vision-test-secret');
  assert.equal(seen[0].messages[1].content[1].image_url.url,image);assert.ok(!JSON.stringify(answer.body.note).includes(image));
});
