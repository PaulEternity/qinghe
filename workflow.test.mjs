import { testAccounts } from './support/auth-fixture.mjs';
/** 报告驱动回归：排盘可复核、模型按需调用、流式失败不冒充成功。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import lunar from 'lunar-javascript';
import {prepare} from './engine.mjs';
import {drawTarot} from './tarot.ts';
import {castLines,calculateLiuyao} from './liuyao.ts';
import vendor from './vendor/liuyao-engine.cjs';
import {askModel,createApp} from './server.mjs';

// 使用乾、坤固定纳甲和变卦六亲归属核对关键规则，不只检查字段存在。
test('乾坤纳甲、世应、日干六神及变卦沿用本宫五行',()=>{
 const r=prepare({tool:'liuyao',question:'复核样例',castMode:'manual',lineValues:[7,7,7,7,7,7],castTime:'1986-05-29T00:00'}).facts.liuyao;
 assert.equal(r.mainHexagram.name,'乾为天');assert.equal(r.mainHexagram.shiPos,6);assert.equal(r.mainHexagram.yingPos,3);
 assert.deepEqual(r.mainHexagram.lines.map(l=>l.ganZhi),['甲子','甲寅','甲辰','壬午','壬申','壬戌']);
 assert.deepEqual(r.mainHexagram.lines.map(l=>l.liuQin),['子孙','妻财','父母','官鬼','兄弟','父母']);
 assert.equal(r.mainHexagram.lines[0].liuShen,'玄武');assert.equal(r.mainHexagram.lines[5].isShi,true);assert.equal(r.mainHexagram.lines[2].isYing,true);assert.deepEqual(r.kongWang,['戌','亥']);
 const changed=calculateLiuyao([6,6,6,6,6,6],['丙寅','癸巳','癸酉','壬子']);assert.equal(changed.mainHexagram.name,'坤为地');assert.equal(changed.changedHexagram.name,'乾为天');assert.equal(changed.changedHexagram.lines[0].liuQin,'妻财');assert.equal(changed.movingLines.length,6);
});
// 穷举 64 卦与每个单动爻，检查映射完整性、动变位置和输入不变性。
test('64 卦单动爻覆盖与手工参数边界',()=>{
 assert.equal(new Set(vendor.HEXAGRAMS.map(h=>h.lines.join(','))).size,64);
 for(const hex of vendor.HEXAGRAMS)for(let pos=0;pos<6;pos++){
  const values=hex.lines.map((yang,i)=>i===pos?(yang?9:6):(yang?7:8));
  const before=[...values],r=calculateLiuyao(values,['丙寅','癸巳','癸酉','壬子']);
  assert.equal(r.mainHexagram.name,hex.name);assert.equal(r.movingLines[0].position,pos+1);assert.equal(r.mainHexagram.lines.filter(l=>l.isShi).length,1);assert.equal(r.mainHexagram.lines.filter(l=>l.isYing).length,1);assert.deepEqual(values,before);
 }
 for(const values of [[],[7,7,7,7,7],[7,7,7,7,7,10],['7',7,7,7,7,7]])assert.throws(()=>castLines('manual',values));
});
// 每张牌都包含稳定 ID、位置、正逆位；视角不同不能复用错误的牌位。
test('塔罗三牌阵类型、四视角与十牌无重复',()=>{
 for(const [spread,count] of [['single',1],['three',3],['celtic',10]]){const r=drawTarot(spread);assert.equal(r.cards.length,count);assert.equal(new Set(r.cards.map(c=>c.id)).size,count);assert.ok(r.cards.every(c=>c.position&&['正位','逆位'].includes(c.orientation)));}
 for(const [mode,positions] of Object.entries({'past-present-future':['过去','现在','未来'],'situation-challenge-advice':['处境','挑战','建议'],'mind-body-spirit':['心智','身体','灵魂'],'you-partner-relationship':['你','对方','关系']}))assert.deepEqual(drawTarot('three',mode).cards.map(c=>c.position),positions);
 assert.throws(()=>drawTarot('unknown'));assert.throws(()=>drawTarot('three','unknown'));
});
// 每盘使用独立配置，切换流派后不能污染下一请求；闰月使用实际历法案例。
test('紫微单盘配置隔离、晚子时、闰月与扩展依据',()=>{
 const base={tool:'ziwei',birth:'2000-06-15T23:30',gender:'男',question:'阶段复核',focusDate:'2026-10-22'};
 const first=prepare(base).facts.ziwei;const current=prepare({...base,dayDivide:'current'}).facts.ziwei;const again=prepare(base).facts.ziwei;
 assert.deepEqual(first,again);assert.equal(first.rules.timeIndex,12);assert.notDeepEqual(first.palaces.map(p=>p.majorStars),current.palaces.map(p=>p.majorStars));assert.ok(first.bodyBranch);assert.ok(first.palaces.some(p=>p.adjectiveStars.length));assert.equal(first.stage.focusDate,'2026-10-22');assert.equal(first.stage.yearly.mutagen.length,4);
 const solar=lunar.Lunar.fromYmd(2023,-2,20).getSolar();const birth=`${solar.toYmd()}T12:00`;
 const a=prepare({...base,birth,fixLeap:true}).facts.ziwei,b=prepare({...base,birth,fixLeap:false}).facts.ziwei;
 assert.notEqual(a.soulBranch,b.soulBranch);assert.throws(()=>prepare({...base,dayDivide:'guess'}));
});

/** 用真实 Response 和任意字节分片模拟上游 SSE，覆盖中文跨字节边界。 */
function responseFor(text){const data=new TextEncoder().encode(text);return new Response(new ReadableStream({start(controller){for(let i=0;i<data.length;i+=2)controller.enqueue(data.slice(i,i+2));controller.close();}}),{headers:{'Content-Type':'text/event-stream'}});}
const env={MODEL_BASE_URL:'https://example.test/v1',MODEL_API_KEY:'not-a-real-key',MODEL_NAME:'mock'};
test('流式模型中文分片、CRLF及正常结束',async()=>{
 const delta=[];const result=await askModel([{role:'user',content:'样例'}],{env,onDelta:t=>delta.push(t),fetcher:async(url,options)=>{assert.equal(JSON.parse(options.body).stream,true);return responseFor('data: {"choices":[{"delta":{"content":"先看盘面"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"，再谈选择。"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');}});
 assert.equal(result.answer,'先看盘面，再谈选择。');assert.equal(delta.join(''),result.answer);
});
test('断流、上游错误与输出截断不能作为完整回答',async()=>{
 const truncated='data: {"choices":[{"delta":{"content":"只收到一半"}}]}\n\n';
 await assert.rejects(()=>askModel([],{env,onDelta:()=>{},fetcher:async()=>responseFor(truncated)}),/提前中断/);
 await assert.rejects(()=>askModel([],{env,onDelta:()=>{},fetcher:async()=>responseFor('data: {"error":{"message":"secret detail"}}\n\n')}),/模型流式响应返回错误/);
 await assert.rejects(()=>askModel([],{env,onDelta:()=>{},fetcher:async()=>responseFor('data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n')}),/长度上限/);
});
// 通过真实 HTTP 验证先盘后解读与原问题 ID 的关联，模型使用本机替身。
test('生成盘面零模型调用，解读与追问保留原盘及 ID',async()=>{
 const calls=[];const server=createApp({accounts:testAccounts,auth:{authorized:()=>true,handle:async()=>false},model:async(messages,options)=>{calls.push(messages);options?.onDelta('模拟回答');return {configured:true,answer:'模拟回答'};}});server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 const post=(path,payload,stream=false)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(stream?{Accept:'text/event-stream'}:{})},body:JSON.stringify(payload)});
 try{const chart=await (await post('/api/chart',{tool:'tarot',spread:'celtic',question:'学习计划'})).json();assert.equal(calls.length,0);assert.equal(chart.record.facts.cards.length,10);
 const output=await(await post('/api/interpret',{record:chart.record},true)).text();assert.match(output,/event: delta/);assert.match(output,/event: done/);assert.ok(output.includes(chart.record.id));
 const follow=await(await post('/api/followup',{record:chart.record,history:[{role:'assistant',content:'模拟回答'},{role:'user',content:'继续说明'}]})).json();assert.equal(follow.parentQuestionId,chart.record.id);assert.deepEqual(follow.record.facts.cards,chart.record.facts.cards);assert.equal(calls.length,2);assert.ok(calls[1][1].content.includes(chart.record.facts.cards[0].name));
 }finally{server.close();server.closeAllConnections();}
});
