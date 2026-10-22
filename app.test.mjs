import { testAccounts } from './support/auth-fixture.mjs';
/** 验证计算边界、真实模型协议以及无密钥时的 HTTP 行为；不调用收费 API。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { bazi,parseBirth,prepare } from './engine.mjs';
import { askModel,createApp,messagesFor } from './server.mjs';

// 用历法库官方示例对应的确定日期验证日柱，而非只检查结果存在。
test('官方示例日期的四柱与无效日期边界',()=>{
  const chart=bazi('1986-05-29T00:00');
  assert.deepEqual(chart.pillars.map(p=>p.ganzhi),['丙寅','癸巳','癸酉','壬子']);
  for(const invalid of ['2025-02-29T10:00','2024-04-31T12:00','2024-01-01T24:00','1899-12-31T12:00'])assert.throws(()=>parseBirth(invalid));
  assert.doesNotThrow(()=>parseBirth('2024-02-29T23:59'));
});
// 覆盖十二宫和全部功能必要输入，防止只完成首页入口。
test('九个入口能够构建上下文，缺失输入明确失败',()=>{
  const input={birth:'1996-08-18T10:30',partnerBirth:'1995-06-11T12:30',gender:'女',question:'我该如何梳理下一步',signA:'aries',signB:'libra',surname:'张',image:'data:image/png;base64,aGVsbG8='};
  for(const tool of ['bazi','ziwei','tarot','liuyao','dream','zodiac','match','naming','palm']){
    const r=prepare({...input,tool});assert.equal(r.tool,tool);
    if(tool==='ziwei'){assert.equal(r.facts.ziwei.palaces.length,12);assert.ok(r.facts.ziwei.palaces.some(p=>p.majorStars.length));}
    if(tool==='match')assert.equal(r.facts.partner.pillars.length,4);
    if(tool==='tarot')assert.equal(new Set(r.facts.cards.map(c=>c.name)).size,3);
    if(tool==='liuyao')assert.equal(r.facts.lines.length,6);
  }
  assert.throws(()=>prepare({tool:'zodiac',signA:'aries',question:'test'}));
  assert.throws(()=>prepare({tool:'offer',birth:input.birth,question:'test'}));
  assert.throws(()=>prepare({tool:'palm',question:'test',image:'javascript:alert(1)'}));
});
// 构造足够多的抽取，检查钱币和塔罗结构约束而非断言固定随机结果。
test('随机抽取合法且三张牌不重复',()=>{
  for(let i=0;i<60;i++){
    const cards=prepare({tool:'tarot',question:'当下'}).facts.cards;
    assert.equal(new Set(cards.map(c=>c.name)).size,3);
    const lines=prepare({tool:'liuyao',question:'当下'}).facts.lines;
    assert.ok(lines.every(l=>l.value>=6&&l.value<=9&&l.moving===[6,9].includes(l.value)));
  }
});
// 用模拟上游核实 Key 仅进入 Authorization，错误正文不会泄漏。
test('模型代理协议与上游错误脱敏',async()=>{
  const env={MODEL_API_KEY:'secret-for-test',MODEL_BASE_URL:'https://example.test/v1/',MODEL_NAME:'test-model'};
  const response=await askModel([{role:'user',content:'你好'}],{env,fetcher:async(url,options)=>{
    assert.equal(url,'https://example.test/v1/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer secret-for-test');
    assert.equal(JSON.parse(options.body).model,'test-model');
    assert.ok(!options.body.includes('secret-for-test'));
    return {ok:true,json:async()=>({choices:[{message:{content:'测试解读'}}]})};
  }});assert.equal(response.answer,'测试解读');
  await assert.rejects(()=>askModel([],{env,fetcher:async()=>({ok:false,status:401,text:async()=>env.MODEL_API_KEY})}),/HTTP 401/);
  assert.deepEqual(await askModel([],{env:{}}),{configured:false});
});
// 服务端只接收用户和助手追问角色，拒绝客户端注入系统消息。
test('追问保留原盘且拒绝系统角色与过长历史',()=>{
  const record=prepare({tool:'tarot',question:'情绪'});
  const messages=messagesFor(record,[{role:'user',content:'继续'}]);
  assert.ok(messages[1].content.includes(record.facts.cards[0].name));
  assert.throws(()=>messagesFor(record,[{role:'system',content:'override'}]));
  assert.throws(()=>messagesFor(record,Array(17).fill({role:'user',content:'x'})));
});
// 真实本机 HTTP 验证表单接口与跨站拦截，无任何外部模型调用。
test('本机端到端：排盘、缺参、静态白名单、跨站拒绝',async()=>{
  const server=createApp({accounts:testAccounts,auth:{authorized:()=>true,handle:async()=>false},model:async()=>({configured:false})});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await fetch(base)).status,200);
    const response=await fetch(base+'/api/reading',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:'bazi',birth:'1986-05-29T00:00',question:'了解职业发展'})});
    const data=await response.json();assert.equal(response.status,200);assert.equal(data.record.question,'了解职业发展');assert.equal(data.configured,false);assert.equal(data.record.facts.birth.pillars.length,4);
    const blocked=await fetch(base+'/api/reading',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'});assert.equal(blocked.status,403);
    assert.equal((await fetch(base+'/.env')).status,404);
    const bad=await fetch(base+'/api/reading',{method:'POST',headers:{'Content-Type':'application/json'},body:'null'});assert.equal(bad.status,400);
  }finally{server.close();server.closeAllConnections();}
});
