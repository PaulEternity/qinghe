/** 星座匹配规则与真实 HTTP 回归：不连接个人数据库，不调用付费模型。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {matchZodiac,ZODIAC_SIGNS} from './zodiac.ts';
import {prepare,tools} from './engine.mjs';
import {createApp} from './server.mjs';
import {testAccounts} from './support/auth-fixture.mjs';

test('十二星座的四元素及三模式分类，以及 144 种组合的对称性',()=>{
  const groups={火象:['aries','leo','sagittarius'],土象:['taurus','virgo','capricorn'],风象:['gemini','libra','aquarius'],水象:['cancer','scorpio','pisces']};
  for(const [element,ids] of Object.entries(groups))assert.deepEqual(ZODIAC_SIGNS.filter(sign=>sign.element===element).map(sign=>sign.id),ids);
  for(const modality of ['基本宫','固定宫','变动宫'])assert.equal(ZODIAC_SIGNS.filter(sign=>sign.modality===modality).length,4);
  for(const a of ZODIAC_SIGNS)for(const b of ZODIAC_SIGNS){
    const result=matchZodiac(a.id,b.id),reverse=matchZodiac(b.id,a.id);
    assert.deepEqual(result.personA,a);assert.deepEqual(result.personB,b);
    assert.deepEqual(result.pairing,reverse.pairing);
    assert.ok(result.pairing.strength&&result.pairing.friction&&result.pairing.advice);
    assert.equal(result.rhythm.summary,reverse.rhythm.summary);
  }
  assert.match(matchZodiac('aries','gemini').pairing.theme,/灵感与行动/);
  assert.match(matchZodiac('taurus','cancer').pairing.theme,/安定与关怀/);
  assert.match(matchZodiac('aries','leo').pairing.theme,/同元素/);
});

test('星座输入严格校验；新记录无需出生时间且停用 Offer 新建',()=>{
  for(const invalid of [undefined,null,'','Aries','<script>',{},['aries'],1]){
    assert.throws(()=>matchZodiac(invalid,'aries'),/有效星座/);
    assert.throws(()=>matchZodiac('aries',invalid),/有效星座/);
  }
  const record=prepare({tool:'zodiac',signA:'cancer',signB:'capricorn',question:'怎样表达关心？'});
  assert.equal(record.title,'星座匹配');assert.equal(record.facts.zodiac.personA.element,'水象');
  assert.equal(record.facts.birth,undefined);assert.equal(record.facts.zodiac.score,undefined);
  assert.match(record.facts.zodiac.rules.limit,/未计算月亮、上升/);
  assert.equal(Object.values(tools).filter(tool=>!tool.legacy).length,10);
  assert.equal(tools.offer.legacy,true);
  assert.throws(()=>prepare({tool:'offer',question:'旧功能',optionA:'A',optionB:'B'}));
  // 返回快照不能被客户端/调用方修改后污染下一次匹配。
  record.facts.zodiac.personA.name='修改';
  assert.equal(matchZodiac('cancer','capricorn').personA.name,'巨蟹座');
});

test('星座 API 生成固定依据，AI 解读与追问沿用原记录且不虚构完整星盘',async()=>{
  const calls=[];
  const server=createApp({accounts:testAccounts,auth:{authorized:()=>true,handle:async()=>false},model:async messages=>{calls.push(messages);return {configured:true,answer:'模拟相处建议'};}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,input)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  try{
    const status=await(await fetch(base+'/api/status')).json();
    assert.equal(status.tools.zodiac.signs.length,12);assert.equal(status.tools.offer.legacy,true);
    const response=await post('/api/chart',{tool:'zodiac',signA:'pisces',signB:'virgo',question:'如何磨合？'});
    assert.equal(response.status,200);const {record}=await response.json();assert.equal(calls.length,0);
    assert.equal(record.facts.zodiac.personA.element,'水象');assert.equal(record.facts.zodiac.personB.element,'土象');
    const interpretation=await(await post('/api/interpret',{record})).json();assert.equal(interpretation.answer,'模拟相处建议');
    assert.match(calls[0][0].content,/不编造月亮、上升/);assert.match(calls[0][1].content,/双鱼座/);assert.match(calls[0][1].content,/土象/);
    const follow=await(await post('/api/followup',{record,history:[{role:'user',content:'具体如何表达？'}]})).json();
    assert.equal(follow.record.id,record.id);assert.deepEqual(follow.record.facts,record.facts);
    const bad=await post('/api/chart',{tool:'zodiac',signA:'pisces',question:'缺失星座'});assert.equal(bad.status,400);
  }finally{server.close();server.closeAllConnections();}
});
