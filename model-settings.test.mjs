/** 模型配置回归：加密、跨部署禁用、取消代次和落库事务，不请求真实模型。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {ModelSettings} from './model-settings.mjs';
import {AccessControl} from './access.mjs';
import {MemoryPool} from './support/memory-pool.mjs';

const secret='ab'.repeat(32),env={MODEL_BASE_URL:'https://mock.example/v1',MODEL_API_KEY:'test-only-secret-key',MODEL_NAME:'mock',APP_MODE:'cloud'};
/** 两个独立实例共享数据库，模拟分开部署的网页和小程序。 */
async function pair(model){const pool=new MemoryPool();const a=new ModelSettings({pool,secret,env,model,pollMs:10}),b=new ModelSettings({pool,secret,env,model,pollMs:10});await a.init();await b.init();return {pool,a,b};}

test('密钥加密且不回显，重启不覆盖配置，修订号阻止覆盖，图片不回退文字模型',async()=>{
  const {pool,a,b}=await pair();
  assert.ok(!JSON.stringify([...pool.settings.values()]).includes(env.MODEL_API_KEY));
  assert.ok(!JSON.stringify(await a.status(true)).includes(env.MODEL_API_KEY));
  assert.ok(!JSON.stringify(await a.status()).includes('mock.example'));
  await assert.rejects(a.begin('vision'),/图片模型暂不可用/);
  const old=await a.status(true);
  await a.save({kind:'text',revision:old.revision,enabled:true,model:'updated'});
  await assert.rejects(b.save({kind:'text',revision:old.revision,enabled:false}),/已被修改/);
  const reopened=new ModelSettings({pool,secret,env:{...env,MODEL_NAME:'ignored'}});await reopened.init();
  assert.equal((await reopened.status(true)).text.model,'updated');
  const bad=new ModelSettings({pool,secret:'cd'.repeat(32),env});await assert.rejects(bad.init(),/解密失败/);
  for(const baseUrl of ['https://user:password@example.com','http://example.com','https://example.com/?key=x','not-url'])await assert.rejects(a.save({kind:'text',revision:a.revision,enabled:true,baseUrl}),/地址无效/);
});

test('分开部署：禁用后立即重新启用仍中断旧代次，另一类模型继续完成',async()=>{
  let finishVision;
  const model=(_,options)=>options.env.MODEL_NAME==='vision'?new Promise(resolve=>{finishVision=()=>resolve({configured:true,answer:'完整图片回答'});}):new Promise(()=>{});
  const {a,b}=await pair(model);
  await a.save({kind:'vision',revision:a.revision,enabled:true,baseUrl:'https://vision.example/v1',model:'vision',apiKey:'vision-only-secret'});
  const text=await b.begin('text'),vision=await b.begin('vision');
  const result=b.invoke(text,[]).catch(error=>error),other=b.invoke(vision,[]);
  try{
    await a.save({kind:'text',revision:a.revision,enabled:false});
    await assert.rejects(a.begin('text'),/已禁用/);
    await a.save({kind:'text',revision:a.revision,enabled:true});
    await delay(40);
    assert.match((await result).message,/已禁用|已中断/);
    assert.equal(vision.signal.aborted,false);finishVision();assert.equal((await other).answer,'完整图片回答');
    let saved=false;await assert.rejects(b.finish(text,async()=>{saved=true;}),/已禁用|已中断/);assert.equal(saved,false);
  }finally{b.end(text);b.end(vision);}
  assert.equal(b.monitor,null);
});

test('完整回答提交与禁用锁同一配置行；先禁用则不执行持久化',async()=>{
  const {a,b}=await pair();const ticket=await b.begin('text');
  try{
    let release,entered;
    const inside=new Promise(resolve=>{entered=resolve;});
    const save=b.finish(ticket,async()=>{entered();await new Promise(resolve=>{release=resolve;});return 'committed';});
    await inside;
    let disabled=false;const disable=a.save({kind:'text',revision:a.revision,enabled:false}).then(()=>{disabled=true;});
    await delay(10);assert.equal(disabled,false);release();assert.equal(await save,'committed');await disable;
    await assert.rejects(b.finish(ticket,async()=>assert.fail('停用后不允许落库')),/已禁用|已中断/);
  }finally{b.end(ticket);}
});

test('共享访问配置刷新：其他部署改码/改密撤销旧会话，不覆盖新值',async()=>{
  const pool=new MemoryPool(),initial={password:'admin-test-password',code:'001234'};
  const a=await AccessControl.openDatabase(pool,initial),b=await AccessControl.openDatabase(pool,initial);
  const headers=new Map(),res={setHeader:(name,value)=>headers.set(name,value)};
  b.issue(res,'ai','identity');const ai=headers.get('Set-Cookie').split(';')[0];
  b.issue(res,'admin');const admin=headers.get('Set-Cookie').split(';')[0];
  const req={method:'POST',headers:{cookie:admin,'content-type':'application/json'},userSessionKey:'identity'};
  let status;
  await b.handle(req,res,'/api/access/code',async()=>({code:'009999'}),(_,value)=>{status=value;});assert.equal(status,200);
  await a.refresh();assert.deepEqual(a.state.code,b.state.code);
  // 旧 AI 会话不因同进程刷新遗漏而继续有效。
  assert.equal(b.authorized({headers:{cookie:ai},userSessionKey:'identity'}),false);
  await a.refresh();a.issue(res,'admin');const oldAdmin=headers.get('Set-Cookie').split(';')[0];
  await b.handle(req,res,'/api/access/password',async()=>({currentPassword:initial.password,password:'updated-test-password'}),()=>{});
  await a.refresh();assert.equal(a.session({headers:{cookie:oldAdmin}},'admin'),null);
});
