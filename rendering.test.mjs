/** 共享盘面渲染回归：直接执行实际纯渲染函数，覆盖新旧记录与 HTML 转义。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {prepare} from './engine.mjs';
import { GLOSS } from './public/gloss.js';
const source=fs.readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
// 提取现有纯函数所在注释段，直接测试生产代码，不依赖编译器内部 API。
const functions=['solarSummary','glossItem','hexagramGloss','tarotGloss','factsHTML'].map(name=>{const start=source.indexOf('function '+name+'(');const next=source.indexOf('/**',start);return source.slice(start,next<0?source.length:next);}).join('\n');
const escapeDeclaration=source.split('\n').find(line=>line.startsWith('const esc='));
/** 用真实函数和最少上下文执行模板，不复制生产实现。 */
function render(facts,{revealed=[],answer=''}={}){const context=vm.createContext({GLOSS,current:{revealed,answer},record:{facts},output:null});vm.runInContext(escapeDeclaration+'\n'+functions+'\noutput=factsHTML(record);',context);return context.output;}

test('六爻、紫微与塔罗新盘渲染，以及旧札记缺字段兼容',()=>{
 const base={question:'测试',birth:'2000-06-15T12:00',gender:'男',focusDate:'2026-10-22'};
 const l=render(prepare({...base,tool:'liuyao',castMode:'manual',lineValues:[7,7,7,7,7,7],castTime:'1986-05-29T00:00'}).facts);assert.match(l,/乾为天/);assert.match(l,/甲子/);assert.match(l,/玄武/);assert.match(l,/戌、亥/);
 const z=render(prepare({...base,tool:'ziwei'}).facts);assert.match(z,/命宫/);assert.match(z,/身宫/);assert.match(z,/2026-10-22/);
 const tarot=prepare({...base,tool:'tarot',spread:'celtic'}).facts;assert.equal((render(tarot).match(/data-flip=/g)||[]).length,10);assert.match(render(tarot,{revealed:[0]}),new RegExp(tarot.cards[0].name));
 const legacy={cards:[{position:'建议',name:'星星',orientation:'正位'}]};assert.match(render(legacy,{answer:'旧回答'}),/星星/);
 const oldZiwei={ziwei:{fiveElementsClass:'水二局',palaces:[{name:'命宫',earthlyBranch:'子',majorStars:[{name:'紫微'}],minorStars:['文昌']}]}};assert.match(render(oldZiwei),/文昌/);
});

test('模型或历史中的危险文本作为纯文本转义，不成为可执行标记',()=>{
 const html=render({cards:[{position:'<img src=x onerror=alert(1)>',name:'<script>alert(1)</script>',orientation:'" onclick="alert(1)'}]},{revealed:[0]});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.match(html,/&lt;script&gt;/);assert.match(html,/&quot;/);
});
