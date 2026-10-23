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
  const context={module,exports:module.exports,require:name=>load(resolve(dirname(path),name+'.js'),extras,cache),console,Uint8Array,ArrayBuffer,...extras};
  runInNewContext(readFileSync(path,'utf8'),context,{filename:path});return module.exports;
}
const clean=value=>JSON.parse(JSON.stringify(value));

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
      if(options.url.endsWith('/api/access/verify'))options.success({statusCode:200,data:{aiToken:'b'.repeat(64)}});
      else{calls++;options.success({statusCode:401,data:new TextEncoder().encode(JSON.stringify({code:'AI_ACCESS_REQUIRED'})).buffer});}
    });return task;}
  };
  const client=load('miniprogram/utils/api.js',{wx,getApp:()=>({globalData:{}})});
  const pending=client.stream('/api/interpret',{},()=>{}).catch(error=>error);
  await opened;client.abortStreams();await modal.success({confirm:true,content:'001234'});
  assert.match((await pending).message,/页面已离开/);assert.equal(calls,1);
});
