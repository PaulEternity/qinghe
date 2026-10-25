/** 小程序纯逻辑回归：全功能表单、UTF-8 分片及页面资源；真机编译仍需开发者工具。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {runInNewContext} from 'node:vm';
import {prepare,tools} from './engine.mjs';

/** 在隔离 VM 载入小程序 CommonJS，不改变项目 ESM 设置或引入构建依赖。 */
function load(file,extras={},cache=new Map()){
  const path=resolve(file);if(cache.has(path))return cache.get(path).exports;
  const module={exports:{}};cache.set(path,module);
  const context={module,exports:module.exports,require:name=>name==='../config'&&!extras.cloudBackend?{baseUrl:'http://127.0.0.1:3187',cloud:null}:load(resolve(dirname(path),name+'.js'),extras,cache),console,Uint8Array,ArrayBuffer,...extras};
  runInNewContext(readFileSync(path,'utf8'),context,{filename:path});return module.exports;
}
const clean=value=>JSON.parse(JSON.stringify(value));

test('云托管首页与微信登录固定环境和服务，保留 Bearer，不调用公网 request',async()=>{
  let initialized=0,saved;const calls=[];
  const wx={cloud:{init(){initialized++;},callContainer(options){calls.push(options);setImmediate(()=>options.success({statusCode:200,data:options.path==='/api/wechat/login'?{token:'session-token'}:{tools:{}}}));}},
    getStorageSync:()=>saved, setStorageSync:(key,value)=>{saved=value;},login:options=>options.success({code:'login-code'}),
    request:()=>assert.fail('云托管不得使用公网请求')};
  const client=load('miniprogram/utils/api.js',{wx,cloudBackend:true,getApp:()=>({globalData:{}})});
  await client.api('/api/status');await client.login();await client.api('/api/notes');
  assert.equal(initialized,1);assert.equal(saved.token,'session-token');
  assert.equal(calls[1].data.code,'login-code');assert.equal(calls[2].header.Authorization,'Bearer session-token');
  for(const call of calls){assert.equal(call.config.env,'prod-d4goavctzfcc4e777');assert.equal(call.header['X-WX-SERVICE'],'express-xhac');assert.equal(call.timeout,95000);assert.equal(call.url,undefined);}
});

test('云托管 401 验证访问码后仅重试一次，生成结果为完整 JSON',async()=>{
  let attempts=0;
  const wx={getStorageSync:()=>({token:'session-token'}),showModal:options=>options.success({confirm:true,content:'001234'}),
    cloud:{init(){},callContainer(options){setImmediate(()=>{
      let data,statusCode=200;
      if(options.path==='/api/access/status')data={expiresAt:Date.now()+60000};
      else if(options.path==='/api/access/verify')data={aiToken:'verified-token'};
      else if(++attempts===1){statusCode=401;data={code:'AI_ACCESS_REQUIRED'};}
      else{assert.equal(options.header['X-Qinghe-AI'],'verified-token');assert.equal(options.header.Accept,undefined);data={answer:'完整回答',note:{id:'note'}};}
      options.success({statusCode,data});
    });}}};
  const client=load('miniprogram/utils/api.js',{wx,cloudBackend:true});
  assert.equal((await client.stream('/api/interpret',{},()=>assert.fail('云托管 JSON 不分块'))).answer,'完整回答');
  assert.equal(attempts,2);
});

test('云托管生成期间离页立即结束本机等待，迟到回答不会重试或写回',async()=>{
  let pendingRequest,ready;const started=new Promise(resolve=>{ready=resolve;});let attempts=0;
  const wx={getStorageSync:()=>({token:'session-token'}),cloud:{init(){},callContainer(options){setImmediate(()=>{
    if(options.path==='/api/access/status')return options.success({statusCode:200,data:{expiresAt:Date.now()+60000}});
    attempts++;pendingRequest=options;ready();
  });}}};
  const client=load('miniprogram/utils/api.js',{wx,cloudBackend:true});
  const pending=client.stream('/api/interpret',{},()=>{});const rejected=assert.rejects(pending,/页面已离开/);
  await started;client.abortStreams();await rejected;
  pendingRequest.success({statusCode:401,data:{code:'AI_ACCESS_REQUIRED'}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(attempts,1);
});

test('云托管图片经二进制通道写入本地缓存，失败可重试，非法 ID 不发请求',async()=>{
  let requests=0;const bytes=new Uint8Array([255,216,255]).buffer;
  const wx={env:{USER_DATA_PATH:'/cache'},getFileSystemManager:()=>({writeFile(options){assert.equal(options.data,bytes);options.success();}}),
    cloud:{init(){},callContainer(options){requests++;assert.equal(options.responseType,'arraybuffer');assert.equal(options.header.Authorization,undefined);setImmediate(()=>options.success({statusCode:requests===1?503:200,data:bytes}));}}};
  const client=load('miniprogram/utils/api.js',{wx,cloudBackend:true});
  await assert.rejects(client.cardImage('../secret'),/牌图无效/);assert.equal(requests,0);
  await assert.rejects(client.cardImage('rws-0'),/牌图加载失败/);
  assert.equal(await client.cardImage('rws-0'),'/cache/qinghe-rws-0.jpg');
  await client.cardImage('rws-0');assert.equal(requests,2);
});

test('网络失败区分域名、超时和证书，控制台保留原始原因且不记录登录凭证',async()=>{
  for(const [detail,expected] of [
    ['request:fail url not in domain list',/域名尚未获微信授权/],
    ['request:fail timeout',/响应超时/],
    ['request:fail ssl hand shake error',/安全连接失败/],
    ['request:fail err_name_not_resolved',/无法连接清和服务/],
    ['',/无法连接清和服务/]
  ]){
    const logs=[];
    const client=load('miniprogram/utils/api.js',{
      wx:{getStorageSync:()=>null,request:options=>options.fail({errMsg:detail})},
      console:{error:(...args)=>logs.push(args)}
    });
    await assert.rejects(client.api('/api/wechat/login',{code:'private-login-code'}),expected);
    assert.equal(logs[0][1].errMsg,detail);
    assert.ok(logs[0][1].url.endsWith('/api/wechat/login'));
    assert.doesNotMatch(JSON.stringify(logs),/private-login-code/);
  }
});

test('全部九个小程序表单的参数可由现有引擎生成盘面，含双人校正与手摇爻位',()=>{
  const {fieldsFor,payloadFor,updateFields}=load('miniprogram/utils/forms.js');
  let count=0;
  for(const [tool,definition]of Object.entries(tools)){
    if(definition.legacy)continue;count++;
    let fields=fieldsFor(tool,definition);
    for(let i=0;i<fields.length;i++){
      const f=fields[i];let value=f.value;
      if(f.type==='date')value='1995-06-15';if(f.type==='time')value='12:30';
      if(f.name==='surname')value='林';if(f.name==='signA'||f.name==='signB')value=1;
      fields=updateFields(fields,i,value);
    }
    const payload=clean(payloadFor(tool,fields,'想了解当下',tool==='palm'?'data:image/png;base64,YQ==':undefined));
    assert.equal(prepare(payload).tool,tool);
    if(tool==='match'){assert.ok(payload.birth);assert.ok(payload.partnerBirth);}
  }
  assert.equal(count,9);
  let fields=fieldsFor('liuyao',tools.liuyao);
  fields=updateFields(fields,fields.findIndex(f=>f.name==='castMode'),1);
  for(let i=1;i<=6;i++)fields=updateFields(fields,fields.findIndex(f=>f.name==='line'+i),i%4+1);
  const payload=clean(payloadFor('liuyao',fields,'手摇问题'));assert.equal(prepare(payload).facts.castMode,'manual');
  fields=updateFields(fields,fields.findIndex(f=>f.name==='line1'),2);assert.equal(fields.find(f=>f.name==='line2').value,0);
});

test('小程序 SSE 每字节分片均保留中文和表情，断流和服务端错误不成为完整结果',()=>{
  const {SSEDecoder}=load('miniprogram/utils/sse.js'),delta=[];
  const decoder=new SSEDecoder(text=>delta.push(text));
  const wire='event: delta\r\ndata: {"text":"中文🙂"}\r\n\r\nevent: done\ndata: {"answer":"中文🙂"}\n\n';
  const data=new TextEncoder().encode(wire);
  for(const byte of data)decoder.push(Uint8Array.of(byte).buffer);
  decoder.push(null,true);assert.equal(delta.join(''),'中文🙂');assert.equal(decoder.result.answer,'中文🙂');
  const half=new SSEDecoder(()=>{});half.push(new TextEncoder().encode('event: delta\ndata: {"text":"片段"}\n\n').buffer,true);assert.equal(half.result,null);
  const bad=new SSEDecoder(()=>{});assert.throws(()=>bad.push(new TextEncoder().encode('event: error\ndata: {"error":"模型已禁用"}\n\n').buffer),/已禁用/);
  assert.throws(()=>new SSEDecoder(()=>{}).push(Uint8Array.of(0xe4).buffer,true),/中断/);
});

test('小程序所有注册页面均能载入且资源完整；无 web-view 或客户端服务密钥',()=>{
  const config=JSON.parse(readFileSync('miniprogram/app.json','utf8'));assert.equal(config.pages.length,6);
  for(const page of config.pages){assert.ok(existsSync('miniprogram/'+page+'.wxml'));let definition;load('miniprogram/'+page+'.js',{Page:value=>{definition=value;}});assert.ok(definition.data);assert.doesNotMatch(readFileSync('miniprogram/'+page+'.wxml','utf8'),/<web-view/);}
  assert.doesNotMatch(readFileSync('miniprogram/config.js','utf8'),/sk-[A-Za-z0-9]/);
});

test('输入访问码期间离开结果页，不会在验证成功后偷偷重发模型请求',async()=>{
  let modal,ready,calls=0;const opened=new Promise(resolve=>{ready=resolve;});
  const wx={
    getStorageSync:()=>({token:'a'.repeat(64)}),
    showModal:options=>{modal=options;ready();},
    request:options=>{const task={abort(){},onChunkReceived(){}};setImmediate(()=>{
      if(options.url.endsWith('/api/access/status'))return options.success({statusCode:200,data:{expiresAt:0}});
      if(options.url.endsWith('/api/access/verify'))options.success({statusCode:200,data:{aiToken:'b'.repeat(64)}});
      else{calls++;options.success({statusCode:401,data:new TextEncoder().encode(JSON.stringify({code:'AI_ACCESS_REQUIRED'})).buffer});}
    });return task;}
  };
  const client=load('miniprogram/utils/api.js',{wx,getApp:()=>({globalData:{}})});
  const pending=client.stream('/api/interpret',{},()=>{}).catch(error=>error);
  await opened;client.abortStreams();await modal.success({confirm:true,content:'001234'});
  assert.match((await pending).message,/页面已离开/);assert.equal(calls,0);
});

test('模拟器、手机和体验/正式版默认均使用同一云托管服务',()=>{
  const configured=(envVersion,platform)=>load('miniprogram/config.js',{wx:{
    getAccountInfoSync:()=>({miniProgram:{envVersion}}),
    getSystemInfoSync:()=>({platform})
  }});
  for(const [env,platform] of [['develop','devtools'],['develop','ios'],['develop','android'],['trial','devtools'],['release','devtools']]){
    assert.equal(configured(env,platform).baseUrl,'https://express-xhac-335091-7-1516597015.sh.run.tcloudbase.com');
    assert.equal(configured(env,platform).cloud.env,'prod-d4goavctzfcc4e777');
    assert.equal(configured(env,platform).cloud.service,'express-xhac');
  }
});

test('AI 的 401 响应无论字符串、对象或二进制，均先验证访问码再解读',async()=>{
  for(const format of ['string','object','buffer','chunked']){
    let requests=0,modals=0,chunkHandler;
    const error={code:'AI_ACCESS_REQUIRED',error:'请验证访问码'};
    const wx={
      getStorageSync:()=>({token:'a'.repeat(64)}),
      showModal:options=>{modals++;setImmediate(()=>options.success({confirm:true,content:'001234'}));},
      request:options=>{
        const task={abort(){},onChunkReceived(fn){chunkHandler=fn;}};
        if(options.url.endsWith('/api/access/status')){setImmediate(()=>options.success({statusCode:200,data:{expiresAt:Date.now()+60000}}));return task;}
        const current=++requests;
        setImmediate(()=>{
          if(options.url.endsWith('/api/access/verify'))return options.success({statusCode:200,data:{aiToken:'b'.repeat(64)}});
          if(current===1){
            const text=JSON.stringify(error),buffer=new TextEncoder().encode(text).buffer;
            if(format==='chunked')chunkHandler({data:buffer});
            return options.success({statusCode:401,data:format==='object'?error:format==='string'?text:format==='chunked'?new ArrayBuffer(0):buffer});
          }
          assert.equal(options.header['X-Qinghe-AI'],'b'.repeat(64));
          options.success({statusCode:200,data:new TextEncoder().encode('event: done\ndata: {"answer":"已完成"}\n\n').buffer});
        });
        return task;
      }
    };
    const client=load('miniprogram/utils/api.js',{wx,getApp:()=>({globalData:{}})});
    assert.equal((await client.stream('/api/interpret',{},()=>{})).answer,'已完成',format);
    assert.equal(modals,1,format);assert.equal(requests,3,format);
  }
});
test('首次解读先查询访问码状态，弹窗验证完成后才发出模型请求',async()=>{
  const order=[];
  const wx={
    getStorageSync:()=>({token:'a'.repeat(64)}),
    showModal:options=>{order.push('modal');setImmediate(()=>options.success({confirm:true,content:'001234'}));},
    request:options=>{
      const task={abort(){},onChunkReceived(){}};
      setImmediate(()=>{
        if(options.url.endsWith('/api/access/status')){order.push('status');return options.success({statusCode:200,data:{expiresAt:0}});}
        if(options.url.endsWith('/api/access/verify')){order.push('verify');return options.success({statusCode:200,data:{aiToken:'b'.repeat(64)}});}
        order.push('interpret');assert.equal(options.header['X-Qinghe-AI'],'b'.repeat(64));
        options.success({statusCode:200,data:new TextEncoder().encode('event: done\ndata: {"answer":"已完成"}\n\n').buffer});
      });return task;
    }
  };
  const client=load('miniprogram/utils/api.js',{wx,getApp:()=>({globalData:{}})});
  assert.equal((await client.stream('/api/interpret',{},()=>{})).answer,'已完成');
  assert.deepEqual(order,['status','modal','verify','interpret']);
});
