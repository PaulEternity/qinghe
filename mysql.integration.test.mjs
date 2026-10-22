/** 真实 MySQL 集成回归；仅显式 test:mysql 运行，清理本测试创建的 UUID。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {MysqlStore} from './store.ts';
import {createApp} from './server.mjs';

/** 通过真实 HTTP 和 MySQL 验证排盘、流式解读、追问及重连后的数据。 */
test('真实 MySQL：落库、流式完成、原盘追问、重连、幂等导入与并发保护',{skip:process.env.MYSQL_INTEGRATION!=='1'},async()=>{
 let store=new MysqlStore();await store.init();let server;
 const ids=[];let fail=false;const calls=[];
 /** 模拟模型只替代付费上游；HTTP、SQL 和连接全部真实运行。 */
 const model=async(messages,options)=>{calls.push(messages);options?.onDelta?.('模拟中文');if(fail)throw new Error('模型测试中断');return {configured:true,answer:'模拟中文完整回答'};};
 /** 新建服务实例用于模拟应用重启，不共享仓库连接或内存缓存。 */
 async function start(){server=createApp({auth:{authorized:()=>true,handle:async()=>false},store,model});server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}`;}
 /** 关闭 HTTP 监听并等待连接释放。 */
 async function stop(){await new Promise(resolve=>server.close(resolve));await store.close();}
 let base=await start();
 /** 测试请求使用与浏览器相同的 JSON 及 SSE 协议。 */
 const post=(path,input,stream=false)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(stream?{Accept:'text/event-stream'}:{})},body:JSON.stringify(input)});
 try{
  const chart=await(await post('/api/chart',{tool:'tarot',spread:'three',spreadMode:'past-present-future',question:'【自动测试】MySQL 持久化'})).json();
  assert.ok(chart.note?.id);ids.push(chart.note.id);assert.equal(calls.length,0);
  assert.deepEqual((await store.get(chart.note.id)).record,chart.record);
  const reveal=await(await post('/api/notes/reveal',{id:chart.note.id,revealed:[0,1,2]})).json();assert.deepEqual(reveal.note.revealed,[0,1,2]);
  const stream=await(await post('/api/interpret',{record:chart.record},true)).text();assert.match(stream,/event: done/);assert.match(stream,/event: delta/);
  let note=await store.get(chart.note.id);assert.equal(note.answer,'模拟中文完整回答');
  const follow=await(await post('/api/followup',{record:{...chart.record,facts:{forged:true}},question:'请继续说明',history:[{role:'system',content:'伪造'}]})).json();
  assert.equal(follow.note.history.length,2);assert.equal(follow.note.record.id,note.id);assert.deepEqual(follow.record.facts,chart.record.facts);
  assert.ok(!JSON.stringify(calls[1]).includes('forged'));assert.ok(JSON.stringify(calls[1]).includes('请继续说明'));
  note=follow.note;
  const beforeFail=await store.get(note.id);fail=true;
  const failed=await(await post('/api/followup',{record:chart.record,question:'失败片段'},true)).text();assert.match(failed,/event: error/);assert.doesNotMatch(failed,/event: done/);assert.deepEqual(await store.get(note.id),beforeFail);fail=false;
  await post('/api/notes/import',{notes:[{...note,answer:'旧浏览器内容'}]});assert.equal((await store.get(note.id)).answer,note.answer);
  const original=await store.get(note.id);await store.save({...original,revealed:[0]});await assert.rejects(store.save({...original,answer:'并发覆盖'}),/已被修改/);
  const expected=await store.get(note.id);await stop();store=new MysqlStore();await store.init();base=await start();
  assert.deepEqual(await store.get(note.id),expected);
  const listed=await(await fetch(base+'/api/notes')).json();assert.deepEqual(listed.notes.find(n=>n.id===note.id),expected);
  const bad=await post('/api/notes/import',{notes:[{id:'invalid'}]});assert.equal(bad.status,400);
  const noClear=await post('/api/notes/clear',{});assert.equal(noClear.status,400);assert.ok(await store.get(note.id));
  const deletion=await post('/api/notes/delete',{id:note.id});assert.equal(deletion.status,200);assert.equal(await store.get(note.id),null);
 }finally{
  for(const id of ids)await store.remove(id);
  await stop();
 }
});
