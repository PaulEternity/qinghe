/** 共享盘面渲染回归：直接执行实际纯渲染函数，覆盖新旧记录与 HTML 转义。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {prepare,tools} from './engine.mjs';
import { TAROT_IMAGES } from './public/tarot-images.js';
import { GLOSS } from './public/gloss.js';
const source=fs.readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
// 提取现有纯函数所在注释段，直接测试生产代码，不依赖编译器内部 API。
const functions=['solarSummary','glossItem','hexagramGloss','tarotGloss','zodiacHTML','liuyaoAnalysisHTML','fortuneHTML','pillarHTML','baziDetailHTML','factsHTML'].map(name=>{const start=source.indexOf('function '+name+'(');const next=source.indexOf('/**',start);return source.slice(start,next<0?source.length:next);}).join('\n');
const escapeDeclaration=source.split('\n').find(line=>line.startsWith('const esc='));
/** 用真实函数和最少上下文执行模板，不复制生产实现。 */
function render(facts,{revealed=[],answer=''}={}){const context=vm.createContext({GLOSS,TAROT_IMAGES,current:{revealed,answer},record:{facts},output:null});vm.runInContext(escapeDeclaration+'\n'+functions+'\noutput=factsHTML(record);',context);return context.output;}

test('六爻、紫微与塔罗新盘渲染，以及旧札记缺字段兼容',()=>{
 const base={question:'测试',birth:'2000-06-15T12:00',gender:'男',focusDate:'2026-10-22'};
 const l=render(prepare({...base,tool:'liuyao',castMode:'manual',lineValues:[7,7,7,7,7,7],castTime:'1986-05-29T00:00'}).facts);assert.match(l,/乾为天/);assert.match(l,/甲子/);assert.match(l,/玄武/);assert.match(l,/戌、亥/);assert.match(l,/用神/);assert.match(l,/应期/);assert.match(l,/吉凶倾向/);
 const z=render(prepare({...base,tool:'ziwei'}).facts);assert.match(z,/命宫/);assert.match(z,/身宫/);assert.match(z,/2026-10-22/);
 const tarot=prepare({...base,tool:'tarot',spread:'celtic'}).facts;assert.equal((render(tarot).match(/data-flip=/g)||[]).length,10);assert.match(render(tarot,{revealed:[0]}),new RegExp(tarot.cards[0].name));
 const legacy={cards:[{position:'建议',name:'星星',orientation:'正位'}]};assert.match(render(legacy,{answer:'旧回答'}),/星星/);
 const oldZiwei={ziwei:{fiveElementsClass:'水二局',palaces:[{name:'命宫',earthlyBranch:'子',majorStars:[{name:'紫微'}],minorStars:['文昌']}]}};assert.match(render(oldZiwei),/文昌/);
});

test('流年流月盘面渲染八字大运/流年/流月与紫微运限，聚焦年份高亮',()=>{
 const f=render(prepare({question:'今年如何',birth:'1996-08-18T10:30',gender:'男',focusDate:'2026-10-27',tool:'fortune'}).facts);
 for(const text of ['流年流月','八字大运','八字流年','流月','紫微运限','大限','流日'])assert.ok(f.includes(text),text);
 assert.match(f,/class="pillar focus"/);
 assert.match(f,/四化：/);
});

test('模型或历史中的危险文本作为纯文本转义，不成为可执行标记',()=>{
 const html=render({cards:[{position:'<img src=x onerror=alert(1)>',name:'<script>alert(1)</script>',orientation:'" onclick="alert(1)'}]},{revealed:[0]});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.match(html,/&lt;script&gt;/);assert.match(html,/&quot;/);
});

test('星座展示双方元素、模式及建议，旧 Offer 依据保留且危险内容转义',()=>{
 const facts=prepare({tool:'zodiac',signA:'cancer',signB:'taurus',question:'如何相处？'}).facts;
 const html=render(facts);
 for(const text of ['巨蟹座','金牛座','水象','土象','基本宫','固定宫','需要磨合','相处建议','仅供娱乐'])assert.ok(html.includes(text),text);
 facts.zodiac.pairing.advice='<script>alert(1)</script>';
 assert.ok(!render(facts).includes('<script>'));assert.match(render(facts),/&lt;script&gt;/);
 assert.match(render({options:{a:'旧方案 A',b:'旧方案 B'}}),/旧方案 A/);
});

test('首页替换 Offer 入口，星座表单提供两份完整选项与四元素说明',()=>{
 const main={innerHTML:'',replaceChildren(){}},grid={innerHTML:''};
 const form={querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
 const document={querySelector:selector=>({'#home-template':{content:{cloneNode:()=>({})}},'#tool-grid':grid,'#reading-form':form})[selector]};
 const templates=['home','reading','bindSolarControls','birthFillButton','bindBirthFill'].map(name=>{const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('/**',start));}).join('\n');
 const context=vm.createContext({main,document,tools,current:null,pendingImage:null,renderDailyFortune:()=>{}});
 vm.runInContext(escapeDeclaration+'\n'+functions+'\n'+templates+'\nhome();reading("zodiac");',context);
 assert.match(grid.innerHTML,/#reading\/zodiac/);assert.ok(!grid.innerHTML.includes('#reading/offer'));
 for(const id of ['signA','signB'])assert.match(main.innerHTML,new RegExp('id="'+id+'"'));
 assert.equal((main.innerHTML.match(/<option value="aries">/g)||[]).length,2);
 assert.equal((main.innerHTML.match(/<option value=/g)||[]).length,26);
 for(const element of ['火象','土象','风象','水象'])assert.ok(main.innerHTML.includes(element));
 assert.ok(!main.innerHTML.includes('datetime-local'));assert.ok(!main.innerHTML.includes('optionA'));
 assert.match(main.innerHTML,/查看星座匹配/);
});
