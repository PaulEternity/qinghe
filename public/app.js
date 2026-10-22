/** 清和浏览器控制器：导航、测算、追问与 MySQL 札记；不保存 API 密钥。 */
import { GLOSS } from './gloss.js';
const main=document.querySelector('#main');
const STORAGE='qinghe.readings.v1';
let tools={},current=null,records=[],busy=false,routeVersion=0,pendingImage=null,activeController=null;
/** 将外部文本转成安全 HTML，AI 回复始终用 textContent 展示。 */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** 从 MySQL 加载全部札记；连接失败明确报错，不使用旧缓存冒充已保存。 */
async function loadRecords(){const data=await api('/api/notes');records=data.notes;document.querySelector('#count').textContent=records.length;}
/** 服务端已保存解读；浏览器只同步展示缓存，翻牌另走受限接口。 */
function saveRecord(){if(!current)return;records=[current,...records.filter(r=>r.id!==current.id)];document.querySelector('#count').textContent=records.length;}
/** 统一请求处理，明确显示连接和服务端错误。 */
async function api(path,payload){const res=await fetch(path,payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{});const data=await res.json();if(!res.ok)throw new Error(data.error||'请求失败');return data;}
/** 生成带标签的表单字段。 */
function field(name,label,type='text',extra=''){return `<div class="form-group"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" ${extra} required></div>`;}
/** 校正控件：地点经度由用户核对，解释平太阳时与真太阳时的区别。 */
function solarFields(timeField,prefix='') {
  return `<fieldset class="solar-control" data-time="${timeField}" data-prefix="${prefix}"><legend>可选：真太阳时校正</legend><label class="solar-toggle"><input type="checkbox" name="${prefix}solarCorrection"> 按地点经度校正排盘时间</label><details><summary>这是干什么的？怎么校正？</summary><p class="help">北京时间统一按东经 120° 计时，而太阳经过各地的时间不同。开启后按出生地（或起卦地）经度与日期换算地方真太阳时，可能改变时辰。不同流派口径不同，并非开启就一定更准。</p><p class="help">计算：原始北京时间 + 4 ×（经度 − 120°）分钟 + 当日均时差。只修正经度是平太阳时，加入均时差才是真太阳时。本版采用 NOAA 近似式，排盘取整到分钟；临近时辰边界请对照开关两种结果，不作为秒级天文计算。</p><p class="help">请先把原始记录还原为 UTC+8 标准时间；若原始记录使用夏令时，须先减去夏令时偏移。本版不自动判断历史夏令时。</p></details><div class="solar-options" hidden><label>地点经度（东经为正，西经为负）<input type="number" name="${prefix}longitude" min="-180" max="180" step="0.0001" placeholder="例如北京 116.4074" disabled></label><p class="help">请填写实际地点经度；不会读取你的定位，也不会默认使用示例经度。</p></div><div class="solar-preview help" aria-live="polite"></div></fieldset>`;
}
/** 调用同一服务端计算函数做实时预览，过期请求不得覆盖新输入。 */
function bindSolarControls(form) {
  form.querySelectorAll('.solar-control').forEach(control=>{
    const toggle=control.querySelector('[type=checkbox]'),longitude=control.querySelector('[type=number]'),options=control.querySelector('.solar-options'),preview=control.querySelector('.solar-preview'),time=form.elements[control.dataset.time];let version=0;
    async function refresh(){const request=++version;options.hidden=!toggle.checked;longitude.disabled=!toggle.checked;longitude.required=toggle.checked;if(!toggle.checked){preview.textContent='关闭时直接使用原始北京时间。';return;}if(!time.value||longitude.value===''){preview.textContent='请先填写时间和地点经度。';return;}try{const data=await api('/api/solar-time',{time:time.value,enabled:true,longitude:Number(longitude.value)});if(request===version)preview.textContent=solarSummary(data);}catch(e){if(request===version)preview.textContent=e.message;}}
    toggle.addEventListener('change',refresh);longitude.addEventListener('change',refresh);time.addEventListener('change',refresh);refresh();
  });
}
/** 用可复核的两个偏移分量解释最终时间，保留跨日、跨时辰提示。 */
function solarSummary(c){if(!c.enabled)return '未校正，使用北京时间：'+c.original.replace('T',' ');const n=v=>(v>=0?'+':'')+v.toFixed(2);return `原始 ${c.original.replace('T',' ')}；经度修正 ${n(c.longitudeMinutes)} 分钟，均时差 ${n(c.equationMinutes)} 分钟，合计 ${n(c.totalMinutes)} 分钟。用于排盘：${c.corrected.replace('T',' ')}（取整到分钟）。${c.crossedDay?'已跨日期。':''}${c.crossedHour?'已跨时辰。':''}`;}
/** 手摇录入辅助：点击掷铜钱后播放抛掷动画，按三钱法随机出爻并仅展示结果，由用户自行勾选爻位。 */
function bindCoinCast(form){
 const button=form.querySelector('#cast-coins'),coins=[...form.querySelectorAll('.coin')],result=form.querySelector('#coin-result');
 if(!button)return;
 const NAMES={6:'老阴（动）',7:'少阳（静）',8:'少阴（静）',9:'老阳（动）'};
 // 字面呈现「乾隆通宝」四字（直读），背面呈现满文宝泉局（上下两字占位）。
 const FACES={zi:['乾','隆','通','宝'],bei:['宝','泉','',' ']};
 let casting=false,timer=null;
 /** 按正反面设置四字位文字，并用类名承载翻转视觉。 */
 const setFace=(coin,face)=>{coin.classList.toggle('zi',face==='zi');coin.classList.toggle('bei',face==='bei');const chars=FACES[face];['t','b','r','l'].forEach((p,i)=>coin.querySelector('.c-'+p).textContent=chars[i]);};
 /** 抛掷动画期间快速切换正反面，营造铜钱翻滚的模糊感。 */
 const spin=()=>{for(const c of coins)setFace(c,Math.random()<0.5?'zi':'bei');};
 /** 每次掷三枚铜钱：字面记 2、背面记 3，求和得 6/7/8/9；动画结束定格展示，不自动写入爻位。 */
 button.addEventListener('click',()=>{
  if(casting)return;casting=true;button.disabled=true;result.textContent='铜钱摇动中…';
  button.parentElement.classList.add('casting');coins.forEach(c=>c.classList.add('shaking'));
  timer=setInterval(spin,80);
  setTimeout(()=>{
   clearInterval(timer);timer=null;
   const faces=coins.map(()=>Math.random()<0.5?'zi':'bei');
   const value=faces.reduce((s,f)=>s+(f==='zi'?2:3),0);
   coins.forEach((c,i)=>{setFace(c,faces[i]);c.classList.remove('shaking');});
   button.parentElement.classList.remove('casting');button.disabled=false;casting=false;
   result.textContent=`本次摇出：${faces.map(f=>f==='zi'?'字':'背').join(' · ')} → ${value} ${NAMES[value]}。请在下方对应爻位勾选 ${value}。`;
  },1200);
 });
}
/** 呈现首页与所有真实功能入口。 */
function home(){main.replaceChildren(document.querySelector('#home-template').content.cloneNode(true));document.querySelector('#tool-grid').innerHTML=Object.entries(tools).map(([id,t])=>`<a class="tool-card" href="#reading/${id}"><span class="glyph">${esc(t.icon)}</span><div><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p></div><span class="arrow">↗</span></a>`).join('');}
/** 根据功能展示明确的排盘规则，先生成事实，再由用户决定是否调用模型。 */
function reading(id){
 const t=tools[id];if(!t)return home();current=null;pendingImage=null;
 const birth=t.birth?field('birth','出生日期与时间 · 公历北京时间','datetime-local','min="1900-01-01T00:00" max="2100-12-31T23:59"')+solarFields('birth'):'';
 const liuyao=id==='liuyao'?field('castTime','实际起卦时间 · 北京时间','datetime-local')+solarFields('castTime')+`<div class="form-group"><label for="castMode">起卦方式</label><select id="castMode" name="castMode"><option value="auto">程序三钱法</option><option value="manual">手摇结果录入</option></select></div><fieldset id="manual-lines" hidden><legend>按初爻至上爻填写</legend><div class="coin-cast"><div class="coin-tray"><span class="coin zi" data-coin="0"><i class="c-t">乾</i><i class="c-b">隆</i><i class="c-r">通</i><i class="c-l">宝</i></span><span class="coin zi" data-coin="1"><i class="c-t">乾</i><i class="c-b">隆</i><i class="c-r">通</i><i class="c-l">宝</i></span><span class="coin zi" data-coin="2"><i class="c-t">乾</i><i class="c-b">隆</i><i class="c-r">通</i><i class="c-l">宝</i></span></div><button type="button" class="secondary" id="cast-coins">掷铜钱 · 起一爻</button><p class="coin-result help" id="coin-result" aria-live="polite">点击后铜钱摇动，停下时显示这一爻（6/7/8/9），再在上方按爻位手动勾选。</p></div>${Array.from({length:6},(_,i)=>`<label>${i===0?'初爻':i===5?'上爻':i+1+'爻'}<select name="line${i+1}" data-line="${i}" disabled><option value="">请选择</option><option value="6">6 老阴（动）</option><option value="7">7 少阳（静）</option><option value="8">8 少阴（静）</option><option value="9">9 老阳（动）</option></select></label>`).join('')}<p class="help">从下往上录入；修改前爻会清空后续爻。直接录入钱币记法 6/7/8/9，避免正反面命名歧义。</p></fieldset><p class="help">按京房八宫纳甲排本变卦、六亲六神、世应和旬空。盘面可复核，不自动断定用神或应期。</p>`:'';
 const tarot=id==='tarot'?`<div class="form-group"><label for="spread">牌阵</label><select id="spread" name="spread"><option value="single">单张牌 · 当下重点</option><option value="three" selected>圣三角三牌</option><option value="celtic">凯尔特十字 · 十张牌</option></select></div><div class="form-group" id="mode-group"><label for="spreadMode">三牌视角</label><select id="spreadMode" name="spreadMode"><option value="situation-challenge-advice">处境—挑战—建议</option><option value="past-present-future">过去—现在—未来</option><option value="mind-body-spirit">心智—身体—灵魂</option><option value="you-partner-relationship">你—对方—关系</option></select></div>`:'';
 const ziwei=id==='ziwei'?`<div class="form-group"><label for="gender">命盘性别</label><select id="gender" name="gender"><option>男</option><option>女</option></select></div><details class="rule-options"><summary>紫微排盘规则</summary><label>安星规则<select name="ziweiAlgorithm"><option value="default">通行规则</option><option value="zhongzhou">中州派规则</option></select></label><label>晚子时（23:00—23:59）<select name="dayDivide"><option value="forward">按次日</option><option value="current">按当日</option></select></label><label>闰月处理<select name="fixLeap"><option value="true">前半月算当月，后半月算下月</option><option value="false">闰月按原月处理</option></select></label><p class="help">以 iztro 2.6.3 的规则为准；四化与亮度采用所选算法表，记录完整配置供复核。不同流派结果可能不同。</p></details>`+field('focusDate','查看阶段日期','date','min="1900-01-01" max="2100-12-31"'):'';
 const other=(id==='match'?field('partnerBirth','对方出生日期与时间','datetime-local')+solarFields('partnerBirth','partner'):'')+(id==='naming'?field('surname','姓氏','text','maxlength="10"'):'')+(id==='offer'?`<div class="form-group"><label for="optionA">方案 A</label><textarea id="optionA" name="optionA" required maxlength="4000"></textarea></div><div class="form-group"><label for="optionB">方案 B</label><textarea id="optionB" name="optionB" required maxlength="4000"></textarea></div>`:'')+(id==='palm'?field('photo','手掌照片 · 不超过 3MB','file','accept="image/png,image/jpeg,image/webp"')+'<p class="help">照片只在本次解读时发送给你配置的视觉模型，不保存到札记。</p>':'');
 main.innerHTML=`<div class="page-head"><a class="breadcrumb" href="#home">探索 / ${esc(t.name)}</a><h2>${esc(t.name)}</h2><p class="help">${esc(t.desc)}。先核对盘面，再结合所问解读。</p></div><div class="workspace"><section class="panel"><form id="reading-form"><h3>写下此刻所问</h3>${birth}${liuyao}${tarot}${ziwei}${other}<div class="form-group"><label for="question">${id==='dream'?'描述梦境':'你想了解的问题'}</label><textarea id="question" name="question" required maxlength="4000" placeholder="写清背景、具体困惑和时间范围…"></textarea></div><p class="help">生成盘面不会调用模型。之后点击 AI 解读，相关资料才会发送给你配置的服务。</p><div class="form-actions"><button class="primary" type="submit">${id==='tarot'?'抽牌并查看牌面':'生成并核对盘面'} ↗</button></div><div id="form-error" role="alert"></div></form></section><section class="panel result-panel" id="result" aria-live="polite"><div class="empty"><span class="glyph">${esc(t.icon)}</span><h3>先看依据，再看解读。</h3><p>填写资料，生成属于这次问题的盘面。</p></div></section></div>`;
 const form=document.querySelector('#reading-form'),today=new Date(Date.now()+8*3600000).toISOString();
 if(id==='liuyao'){form.elements.castTime.value=today.slice(0,16);const mode=form.elements.castMode,selects=[...form.querySelectorAll('[data-line]')];const update=()=>{const manual=mode.value==='manual';form.querySelector('#manual-lines').hidden=!manual;selects.forEach((el,i)=>{el.disabled=!manual||(i>0&&!selects[i-1].value);el.required=manual;});form.querySelector('[type=submit]').disabled=manual&&selects.some(el=>!el.value);};selects.forEach((el,i)=>el.addEventListener('change',()=>{selects.slice(i+1).forEach(next=>next.value='');update();}));mode.addEventListener('change',update);update();bindCoinCast(form);}
 if(id==='ziwei')form.elements.focusDate.value=today.slice(0,10);
 if(id==='tarot')form.elements.spread.addEventListener('change',()=>{const three=form.elements.spread.value==='three';form.querySelector('#mode-group').hidden=!three;form.elements.spreadMode.disabled=!three;});
 bindSolarControls(form);form.addEventListener('submit',e=>submitReading(e,id));
}
/** 有界读取图片，不在本地历史中持久保存图片内容。 */
async function imageData(file){if(!file||file.size>3*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('请选择不超过 3MB 的 PNG、JPEG 或 WebP 图片');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(file);});}
/** 第一步只生成一次可信盘面；后续解读和追问直接复用同一记录。 */
async function submitReading(event,id){
 event.preventDefault();if(busy)return;const form=event.currentTarget,button=form.querySelector('[type=submit]'),error=form.querySelector('#form-error'),version=routeVersion;busy=true;button.disabled=true;error.textContent='';
 try{const payload=Object.fromEntries(new FormData(form));payload.tool=id;payload.gender||='男';for(const prefix of ['','partner']){const source=prefix+'solarCorrection',target=prefix?'partnerSolarCorrection':'solarCorrection';payload[target]=payload[source]==='on';if(source!==target)delete payload[source];const name=prefix+'longitude',key=prefix?'partnerLongitude':'longitude';if(payload[name]!==undefined)payload[key]=Number(payload[name]);if(name!==key)delete payload[name];}
 if(id==='liuyao'&&payload.castMode==='manual')payload.lineValues=Array.from({length:6},(_,i)=>Number(payload['line'+(i+1)]));
 if(id==='ziwei')payload.fixLeap=payload.fixLeap==='true';
 if(id==='palm'){pendingImage=await imageData(payload.photo);payload.image=pendingImage;}delete payload.photo;
 const data=await api('/api/chart',payload);if(version!==routeVersion)return;current=data.note;saveRecord();renderResult(document.querySelector('#result'));
 }catch(e){if(version===routeVersion){error.className='notice error';error.textContent=e.message;}}finally{if(version===routeVersion)busy=false;button.disabled=false;}
}
/** 通用短释条目：可读标签与释义文本，统一转义。 */
function glossItem(label,text){return `<div class="gloss-item"><span class="gloss-label">${esc(label)}</span><p>${esc(text)}</p></div>`;}
/** 六爻本卦与变卦（静卦仅本卦）的通用卦义，与所问何事无关。 */
function hexagramGloss(l){const main=GLOSS.hexagram?.[l?.mainHexagram?.name],changed=l?.changedHexagram?GLOSS.hexagram?.[l.changedHexagram.name]:'';const items=(main?glossItem(l.mainHexagram.name+' · 卦义',main):'')+(changed?glossItem(l.changedHexagram.name+' · 变卦义',changed):'');return items?`<div class="gloss-section">${items}</div>`:'';}
/** 已翻开塔罗牌的通用牌义（正位/逆位分开），不随问题改变、也不进入模型 facts。 */
function tarotGloss(cards,revealed=[],answered=false){const shown=(cards||[]).filter((c,i)=>answered||revealed.includes(i));return shown.map(c=>{const g=GLOSS.tarot?.[c.name];return g?glossItem(`${c.position} · ${c.name}（${c.orientation}）`,g[c.orientation==='逆位'?'逆':'正']):'';}).join('');}
/** 展示计算证据，确保用户能区分程序结果与模型解释。 */
function factsHTML(record){const f=record.facts;let html='';if(f.timeCorrection)html+=`<p class="notice">${esc(solarSummary(f.timeCorrection))}</p>`;if(f.birth?.timeCorrection)html+=`<p class="notice">${esc(solarSummary(f.birth.timeCorrection))}</p>`;if(f.partner?.timeCorrection)html+=`<p class="notice">对方：${esc(solarSummary(f.partner.timeCorrection))}</p>`;if(f.birth)html+=`<p class="help">${esc(f.birth.lunar)}<br>${esc(f.birth.calendar)}</p><div class="pillars">${f.birth.pillars.map(p=>`<div class="pillar"><small>${esc(p.name)}</small><b>${esc(p.ganzhi)}</b><span>${esc(p.wuxing)}</span></div>`).join('')}</div>`;if(f.partner)html+=`<h4>对方四柱</h4><div class="pillars">${f.partner.pillars.map(p=>`<div class="pillar"><small>${esc(p.name)}</small><b>${esc(p.ganzhi)}</b><span>${esc(p.wuxing)}</span></div>`).join('')}</div>`;if(f.cards){const revealed=current.revealed||[];html+=`<p class="help">${esc(f.tarotRules?.spreadName||'三牌阵')} · ${esc(f.tarotRules?.deck||'韦特牌组')} · 点击牌背，揭开此刻的指引</p><div class="cards">${f.cards.map((c,i)=>{const open=revealed.includes(i)||!!current.answer;return `<button type="button" class="tarot-card${open?' is-revealed':''}" data-flip="${i}" aria-pressed="${open}" aria-label="${esc(open?c.position+'：'+c.name+'，'+c.orientation:'翻开第 '+(i+1)+' 张牌')}"><span class="tarot-rotor"><span class="tarot-face tarot-back" aria-hidden="${open}"><span class="tarot-corner">✧</span><span class="tarot-orbit"><span>✦</span></span><span class="tarot-back-title">清和</span><span class="tarot-invitation">轻触翻开</span></span><span class="tarot-face tarot-front" aria-hidden="${!open}"><span class="tarot-position">${esc(c.position)}</span><span class="tarot-sigil${c.orientation==='逆位'?' is-reversed':''}">☽<span>✧</span></span><b>${esc(c.name)}</b><span class="tarot-orientation">${esc(c.orientation)}</span></span></span><span class="tarot-caption">${esc(c.position)}</span></button>`;}).join('')}</div><div class="gloss-section tarot-gloss">${tarotGloss(f.cards,revealed,!!current.answer)}</div><button class="secondary" id="flip-all"${f.cards.every((_,i)=>revealed.includes(i)||current.answer)?' disabled':''}>全部翻开</button>`;}if(f.lines)html+=`<div class="hex-lines">${f.lines.map(l=>`<div class="hex-line"><small>${l.position}爻</small>${l.yang?'<i></i>':'<i></i><i></i>'}<small>${l.moving?'动':''}</small></div>`).join('')}</div><p class="help">${esc(f.method)}</p>`;if(f.liuyao){const l=f.liuyao;html+=`<h4>${esc(l.mainHexagram.name)}${l.changedHexagram?' → '+esc(l.changedHexagram.name):' · 静卦'}</h4><p class="help">${esc(l.mainHexagram.palace)}宫 · 世 ${l.mainHexagram.shiPos} 爻，应 ${l.mainHexagram.yingPos} 爻；旬空 ${esc(l.kongWang.join('、'))}</p><div class="chart-scroll"><table class="chart-table"><thead><tr><th>爻位</th><th>六神</th><th>本卦纳甲</th><th>六亲</th><th>世应</th><th>动变</th></tr></thead><tbody>${[...l.mainHexagram.lines].reverse().map(row=>`<tr><td>${row.position}</td><td>${esc(row.liuShen)}</td><td>${esc(row.ganZhi)}</td><td>${esc(row.liuQin)}</td><td>${row.isShi?'世':row.isYing?'应':''}</td><td>${esc(l.movingLines.find(m=>m.position===row.position)?.to||'')}</td></tr>`).join('')}</tbody></table></div>${hexagramGloss(l)}`;}if(f.ziwei)html+=`<h4>${esc(f.ziwei.fiveElementsClass)} · 命宫 ${esc(f.ziwei.soulBranch)} · 身宫 ${esc(f.ziwei.bodyBranch)}</h4><div class="pillars">${f.ziwei.palaces.map(p=>`<div class="pillar"><small>${esc(p.name)} · ${esc(p.earthlyBranch)}</small><span>${esc(p.majorStars.map(s=>s.name+(s.mutagen?'化'+s.mutagen:'')).join('、')||'无主星')}</span><small>${p.isBodyPalace?'身宫 · ':''}${esc(p.minorStars.map(s=>typeof s==='string'?s:s.name).join('、'))}</small><small>${esc((p.adjectiveStars||[]).map(s=>s.name).join('、'))}</small></div>`).join('')}</div>`;if(f.ziwei?.stage)html+=`<p class="help">阶段日期：${esc(f.ziwei.stage.focusDate)}；流年 ${esc(f.ziwei.stage.yearly.heavenlyStem+f.ziwei.stage.yearly.earthlyBranch)}，四化（禄权科忌）：${esc(f.ziwei.stage.yearly.mutagen.join('、'))}。规则及大限依据见下方完整数据。</p>`;return html+`<details class="facts-block"><summary>查看完整计算依据</summary><pre>${esc(JSON.stringify(f,null,2))}</pre></details>`;}
/** 翻牌后按当前翻开状态刷新塔罗通用牌义，不重建整个结果面板。 */
function refreshTarotGloss(target){const box=target?.querySelector('.tarot-gloss');if(box&&current?.record?.facts?.cards)box.innerHTML=tarotGloss(current.record.facts.cards,current.revealed||[],!!current.answer);}
/** 展示原盘及翻牌状态；没有 Key 时仍可保存、查看全部计算事实。 */
function renderResult(target){
 const canInterpret=current.record.tool!=='palm'||pendingImage||current.answer;
 target.innerHTML=`<div class="section-label">本次盘面 · ${esc(current.record.id||current.id)}</div><h3>${esc(current.record.question)}</h3>${factsHTML(current.record)}<div class="answer-title">AI 解读</div><div class="ai-answer" id="answer"></div><div id="messages"></div><div class="toolbar"><button class="secondary" id="copy-reading">复制结果</button>${!current.answer&&canInterpret?'<button class="primary" id="interpret">结合此盘 AI 解读</button>':''}</div><p class="help">调用模型才会发送本次问题与盘面。默认简答，追问时继续说明。模型服务可能收费。</p><div id="interpret-error" role="alert"></div>${current.answer?'<form class="followup" id="followup"><label for="follow-question">围绕同一盘继续追问</label><textarea id="follow-question" required maxlength="4000"></textarea><button class="primary">发送追问</button><div id="follow-error" role="alert"></div></form>':''}`;
 target.querySelector('#answer').textContent=current.answer||'尚未调用模型。请先核对盘面，再开始解读。';
 for(const m of current.history){const el=document.createElement('div');el.className='message '+m.role;const label=document.createElement('small');label.textContent=m.role==='user'?'你的追问':'清和';const content=document.createElement('div');content.className='ai-answer';content.textContent=m.content;el.append(label,content);target.querySelector('#messages').append(el);}
 target.querySelector('#copy-reading').onclick=async()=>{try{await navigator.clipboard.writeText(exportText(current));alert('已复制');}catch{alert('复制失败，请手动选择结果文本。');}};
 // 保留原有 DOM 才能在同一张牌上播放背面到正面的连续翻转。
 let flipping=false;
 /** 成功持久化后翻牌；错峰只影响视觉，不重新抽牌或重复保存。 */
 const flip=async indices=>{
  if(flipping||busy)return;
  const version=routeVersion,buttons=[...target.querySelectorAll('[data-flip]')],all=target.querySelector('#flip-all'),interpret=target.querySelector('#interpret');
  const fresh=buttons.filter(button=>indices.includes(Number(button.dataset.flip))&&!button.classList.contains('is-revealed'));
  if(!fresh.length)return;
  flipping=true;buttons.forEach(button=>button.disabled=true);if(all)all.disabled=true;if(interpret)interpret.disabled=true;
  try{
   const data=await api('/api/notes/reveal',{id:current.id,revealed:indices});if(version!==routeVersion)return;
   current=data.note;saveRecord();
   fresh.forEach((button,order)=>{
    const card=current.record.facts.cards[Number(button.dataset.flip)];
    button.style.setProperty('--flip-delay',`${order*110}ms`);
    button.classList.add('is-revealed','is-revealing');button.setAttribute('aria-pressed','true');
    button.setAttribute('aria-label',`${card.position}：${card.name}，${card.orientation}`);
    button.querySelector('.tarot-back').setAttribute('aria-hidden','true');button.querySelector('.tarot-front').setAttribute('aria-hidden','false');
   });
   // 等待实际 CSS 动画，减少动态效果模式下不会额外等待固定时长。
   await new Promise(requestAnimationFrame);
   await Promise.all(fresh.flatMap(button=>button.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))));
   fresh.forEach(button=>{button.classList.remove('is-revealing');button.style.removeProperty('--flip-delay');});
  }catch(e){if(version===routeVersion)alert('翻牌未完成：'+e.message);}
  finally{
   flipping=false;
   if(version===routeVersion){buttons.forEach(button=>button.disabled=button.classList.contains('is-revealed'));const complete=buttons.every(button=>button.classList.contains('is-revealed'));if(all)all.disabled=complete;if(interpret)interpret.disabled=!complete;refreshTarotGloss(target);}
  }
 };
 target.querySelectorAll('[data-flip]').forEach(button=>{button.disabled=button.classList.contains('is-revealed');button.onclick=()=>flip([...new Set([...(current.revealed||[]),Number(button.dataset.flip)])]);});
 target.querySelector('#flip-all')?.addEventListener('click',()=>flip(current.record.facts.cards.map((_,i)=>i)));
 const interpret=target.querySelector('#interpret');if(interpret){interpret.disabled=!!current.record.facts.cards&&(current.revealed||[]).length<current.record.facts.cards.length;interpret.onclick=()=>runInterpretation();}
 target.querySelector('#followup')?.addEventListener('submit',followup);
}
/** 读取本机 SSE；断流、错误或空回复不能当作完整解读保存。 */
async function streamApi(path,payload,onDelta){
 const controller=new AbortController();activeController=controller;
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify(payload),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(95000)])});
 if(!response.ok){const data=await response.json();throw new Error(data.error||'请求失败');}if(!response.body)throw new Error('服务未返回数据流');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result=null;
 try{while(true){const {done,value}=await reader.read();buffer+=done?decoder.decode():decoder.decode(value,{stream:true});let match;while((match=/\r?\n\r?\n/.exec(buffer))){const block=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);const type=block.split(/\r?\n/).find(l=>l.startsWith('event:'))?.slice(6).trim();const text=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!text)continue;const data=JSON.parse(text);if(type==='error')throw new Error(data.error);if(type==='delta')onDelta(data.text);if(type==='done')result=data;}if(done)break;}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();if(activeController===controller)activeController=null;}
 if(!result)throw new Error('连接提前中断，未保存为完整解读');return result;
}
/** 第二步才请求模型，不再次调用排盘引擎；失败时保留原盘和可见片段。 */
async function runInterpretation(){
 if(busy)return;const target=document.querySelector('#result'),button=target.querySelector('#interpret'),error=target.querySelector('#interpret-error'),answer=target.querySelector('#answer'),version=routeVersion;busy=true;button.disabled=true;button.textContent='正在解读…';answer.textContent='';error.textContent='';
 try{const data=await streamApi('/api/interpret',{record:current.record,image:pendingImage||undefined},text=>{if(version===routeVersion)answer.textContent+=text;});if(version!==routeVersion)return;if(!data.answer)throw new Error('尚未配置模型，请打开顶部“模型设置”；盘面已保存在札记。');current=data.note;saveRecord();renderResult(target);}catch(e){if(version===routeVersion){error.className='notice error';error.textContent=e.message;}}finally{if(version===routeVersion){busy=false;button.disabled=false;button.textContent='结合此盘 AI 解读';}}
}
/** 追问携带原盘 ID 和已完成对话，不重新抽牌或生成新卦。 */
async function followup(event){
 event.preventDefault();if(busy)return;const form=event.currentTarget,button=form.querySelector('button'),error=form.querySelector('#follow-error'),question=form.querySelector('textarea').value.trim(),version=routeVersion;if(!question)return;busy=true;button.disabled=true;error.textContent='';const partial=document.createElement('div');partial.className='ai-answer notice';form.before(partial);
 try{const data=await streamApi('/api/followup',{record:current.record,question},text=>{if(version===routeVersion)partial.textContent+=text;});if(version!==routeVersion)return;if(!data.answer)throw new Error('模型未配置，请先完成配置');current=data.note;saveRecord();renderResult(document.querySelector('#result'));}catch(e){if(version===routeVersion){error.className='notice error';error.textContent=e.message;}}finally{if(version===routeVersion)busy=false;button.disabled=false;}
}
/** 形成可携带的纯文本记录，不导出任何服务端配置。 */
function exportText(r){return `${r.record.title}\n${r.record.question}\n${new Date(r.created).toLocaleString('zh-CN')}\n\n${JSON.stringify(r.record.facts,null,2)}\n\n${r.answer}\n\n${r.history.map(m=>(m.role==='user'?'我：':'清和：')+m.content).join('\n\n')}`;}
/** 浏览器下载本地文本。 */
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
/** 呈现札记与显式删除，空状态给出开始入口。 */
async function history(){
 const version=routeVersion;try{await loadRecords();if(version!==routeVersion)return;main.innerHTML=`<div class="page-head"><span class="section-label">留给自己的记录</span><h2>我的札记</h2><p class="help">盘面、解读和追问保存在本机 MySQL；清理浏览器不会删除数据库记录。旧浏览器札记可手动导入，同 ID 不覆盖数据库记录。</p><div class="toolbar"><button class="secondary" id="export-all">导出全部</button><button class="secondary" id="clear-all">清空札记</button><button class="secondary" id="import-old">导入旧浏览器札记</button></div><div id="history-error" role="alert"></div></div><div class="history-list">${records.length?records.map(r=>`<article class="history-row"><span class="glyph">${esc(tools[r.record.tool].icon)}</span><div class="info"><h3><a href="#note/${esc(r.id)}">${esc(r.record.question)}</a></h3><small>${esc(r.record.title)} · ${esc(new Date(r.created).toLocaleString('zh-CN'))}</small></div><a class="secondary" href="#note/${esc(r.id)}">查看</a><button class="quiet delete-note" data-id="${esc(r.id)}">删除</button></article>`).join(''):'<div class="empty"><h3>这里还没有札记。</h3><a href="#home">开始探索 ↗</a></div>'}</div>`;
 document.querySelector('#export-all').onclick=()=>download('清和札记.txt',records.map(exportText).join('\n\n────────────\n\n'));
 document.querySelector('#clear-all').onclick=async()=>{if(confirm('确认清空 MySQL 中的全部札记？此操作无法恢复，请先导出备份。'))try{await api('/api/notes/clear',{confirm:'delete-all'});await history();}catch(e){alert(e.message);}};
 document.querySelector('#import-old').onclick=async()=>{try{const notes=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(!Array.isArray(notes)||!notes.length)return alert('当前浏览器没有旧札记。');await api('/api/notes/import',{notes});await history();alert('已导入 MySQL；浏览器原始数据仍保留。');}catch(e){document.querySelector('#history-error').textContent=e.message;}};
 document.querySelectorAll('.delete-note').forEach(b=>b.onclick=async()=>{if(confirm('删除这条 MySQL 札记？此操作无法恢复。'))try{await api('/api/notes/delete',{id:b.dataset.id});await history();}catch(e){alert(e.message);}});
 }catch(e){if(version===routeVersion)main.textContent='札记读取失败：'+e.message;}
}
/** 哈希路由，保持本地启动无构建依赖。 */
async function route(){activeController?.abort();activeController=null;pendingImage=null;busy=false;routeVersion++;const version=routeVersion;const [page,id]=location.hash.slice(1).split('/');if(page==='history')history();else if(page==='reading')reading(id);else if(page==='note'){try{await loadRecords();if(version!==routeVersion)return;}catch(e){if(version===routeVersion)main.textContent=e.message;return;}current=records.find(r=>r.id===id);if(!current)return history();main.innerHTML='<div class="page-head"><a class="breadcrumb" href="#history">我的札记 / 解读详情</a></div><section class="panel" id="result"></section>';renderResult(document.querySelector('#result'));}else home();window.scrollTo(0,0);}
/** 启动并提示模型连接状态；网络错误可重试，不显示假数据。 */
async function init(){try{const status=await api('/api/status');tools=status.tools;if(status.storage!=='mysql')throw new Error('MySQL 未接入');await loadRecords();document.querySelector('#model-status').textContent=status.configured?'已检测到模型配置。实际连通性会在解读时验证。':'尚未配置模型。你仍可以使用本地排盘和抽牌。';route();}catch{main.innerHTML='<div class="empty"><h3>无法连接本地服务</h3><p>请确认 npm start 正在运行，然后刷新页面。</p></div>';}}
window.addEventListener('hashchange',route);document.querySelector('#settings-button').onclick=()=>document.querySelector('#settings').showModal();init();
