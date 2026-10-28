/** 京房纳甲适配层：验证六次钱币结果、筛选可复核事实，并按传统规则给出用神与应期参考。 */
import {randomInt} from 'node:crypto';
import engine from './vendor/liuyao-engine.cjs';
import { parentOf } from './wuxing.ts';

export const LIUYAO_RULES={version:'jingfang-najia-v2',system:'京房八宫纳甲，六亲以本卦宫五行为基准，六神按日干起',source:'MIT liuyao-divination；vendor/liuyao-LICENSE',order:'初爻到上爻，自下而上',boundary:'提供排盘事实与用神/应期的传统参考；不同流派用神取法与应期断法可能不同，不作为确定性预测'};

/** 手动模式严格要求六个 6/7/8/9；自动模式按三枚独立钱币生成。 */
export function castLines(mode:unknown='auto',values?:unknown):number[] {
 if(mode==='auto')return Array.from({length:6},()=>Array.from({length:3},()=>2+randomInt(2)).reduce((a,b)=>a+b,0));
 if(mode!=='manual'||!Array.isArray(values)||values.length!==6||values.some(v=>!Number.isInteger(v)||![6,7,8,9].includes(v)))throw new Error('手摇录入请按初爻至上爻填写六个 6/7/8/9');
 return [...values];
}

/** 单爻需要复核的字段，含旺衰、空破、动变等供用神与应期判断。 */
function pickLine(line:any) {
 return {
  position:line.position,positionName:line.positionName,ganZhi:line.ganZhi,zhi:line.zhi,element:line.element,
  liuQin:line.liuQin,liuShen:line.liuShen,isShi:line.isWorld,isYing:line.isResponse,isMoving:line.isMoving,
  isKongWang:line.isKongWang,isYuePo:line.isYuePo,riChongState:line.riChongState,wangShuai:line.wangShuai,changSheng:line.changSheng,
  changedTo:line.changedTo?{ganZhi:line.changedTo.ganZhi,liuQin:line.changedTo.liuQin,element:line.changedTo.element,jinTuiShen:line.changedTo.jinTuiShen,huiTouRelation:line.changedTo.huiTouRelation}:null
 };
}

/** 卦象容器：保留六亲所用宫五行、特殊卦象标记与伏神。 */
function pickHexagram(hex:any) {
 if(!hex)return null;
 return {
  name:hex.name,palace:hex.palace,palaceElement:hex.palaceElement,liuQinPalace:hex.liuQinPalace,liuQinPalaceElement:hex.liuQinPalaceElement,
  shiPos:hex.shiPos,yingPos:hex.yingPos,specialMarks:hex.specialMarks,isLiuHeGua:hex.isLiuHeGua,isLiuChongGua:hex.isLiuChongGua,
  lines:hex.lines.map(pickLine),fuShen:hex.fuShen
 };
}

/** 从可信四柱排纳甲，变卦六亲沿用本卦宫五行；复筛字段供后续断语使用。 */
export function calculateLiuyao(values:number[],pillars:string[]) {
 const result=engine.mainCast({mainHexagram:values.map(v=>v%2===1),changedHexagram:values.flatMap((v,i)=>[6,9].includes(v)?[i+1]:[]),yearPillar:pillars[0],monthPillar:pillars[1],dayPillar:pillars[2],hourPillar:pillars[3]});
 if(result.error)throw new Error('六爻排盘失败，请核对卦爻与时间');
 return {rules:LIUYAO_RULES,pillars:result.pillars,kongWang:result.kongWang,mainHexagram:pickHexagram(result.mainHexagram),changedHexagram:pickHexagram(result.changedHexagram),movingLines:result.movingLinesSummary,sanHe:result.sanHe,sanXing:result.sanXing,lineHeChong:result.lineHeChong};
}

// ── 用神与应期参考（基于旺衰、空破、动变）──

const CHONG:Record<string,string>={子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳'};
const HE:Record<string,string>={子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
const ELEMENT_BRANCH:Record<string,string[]>={木:['寅','卯'],火:['巳','午'],土:['辰','戌','丑','未'],金:['申','酉'],水:['亥','子']};

interface Category {label:string;usedGods:string[]|null;reason:string;note?:string;}

/** 按问题关键词推断用神六亲；未命中则回落世爻。 */
function classify(question:string):Category {
 const has=(...words:string[])=>words.some(w=>question.includes(w));
 if(has('感情','婚姻','恋爱','对象','配偶','结婚','分手','复合','桃花','另一半','男朋友','女朋友','情感','姻缘'))return {label:'感情婚姻',usedGods:['妻财','官鬼'],reason:'问句中涉及感情/婚恋',note:'传统上男问婚配以妻财为用、女以官鬼为用；可补充性别或写明所问是男是女一方。'};
 if(has('财','钱','赚','生意','投资','买卖','收入','薪资','工资','债务','借','炒股','基金','交易','财运'))return {label:'求财',usedGods:['妻财'],reason:'问句中涉及财富/求财'};
 if(has('工作','事业','求职','应聘','面试','升职','升迁','晋升','考公','考编','职位','官司','诉讼','offer','跳槽','晋升'))return {label:'事业仕途',usedGods:['官鬼'],reason:'问句中涉及事业/功名'};
 if(has('考','学业','升学','读书','学习','成绩','论文','文书','合同','证件','父母','房产','房','车','妈妈','爸爸'))return {label:'学业文书',usedGods:['父母'],reason:'问句中涉及考试/文书/父母房车'};
 if(has('子女','孩子','儿子','女儿','学生','晚辈','下属','员工','病','健康','身体','医药','药','宠物','生育','怀孕','胎','平安','出行','子嗣'))return {label:'子孙健康',usedGods:['子孙'],reason:'问句中涉及子女/健康/出行'};
 if(has('兄弟','姐妹','朋友','同事','合伙人','合作','竞争','对手','失窃','破财','偷','丢'))return {label:'兄弟合作',usedGods:['兄弟'],reason:'问句中涉及同辈/合作/失窃'};
 return {label:'自身',usedGods:null,reason:'未命中具体六亲关键词，以世爻（自身）为用神',note:'若所问可归到具体六亲（财/官/父母/子孙/兄弟），请在问题里写明，可得到更贴切的用神。'};
}

/** 依据月建旺衰、空破与动变给出单爻的旺衰因子与应期建议。 */
function lineVerdict(line:any):{strength:string;factors:string[];timing:string[]} {
 const factors:string[]=[],timing:string[]=[];
 const zhi=line.zhi,ws=line.wangShuai;
 let strength=ws==='旺'||ws==='相'?'旺相':ws==='休'?'休':'休囚';
 factors.push('月建'+ws);
 if(line.isKongWang){factors.push('旬空');timing.push(`出空填实（逢${zhi}）或冲空（逢${CHONG[zhi]}）`);}
 if(line.isYuePo){factors.push('月破');timing.push(`填实（逢${zhi}）或合破（逢${HE[zhi]}）`);}
 if(line.isMoving){
  factors.push('动爻');timing.push(`逢值（${zhi}）或逢合（${HE[zhi]}）`);
  const ct=line.changedTo;
  if(ct){
   if(ct.huiTouRelation==='回头生')factors.push('动化回头生');
   if(ct.huiTouRelation==='回头克')factors.push('动化回头克');
   if(ct.huiTouRelation==='化墓'){factors.push('化墓');timing.push(`冲墓（逢${CHONG[ct.zhi]}）`);}
   if(ct.huiTouRelation==='化绝')factors.push('化绝');
   if(ct.jinTuiShen==='进神')factors.push('化进神');
   if(ct.jinTuiShen==='退神')factors.push('化退神');
  }
 }else{
  if(line.riChongState==='暗动')factors.push('日冲暗动');
  if(line.riChongState==='日破')factors.push('日破');
  if(strength==='旺相')timing.push(`旺相安静，应期逢值（${zhi}）或逢冲（${CHONG[zhi]}）`);
  else{
   const el=line.element,supports=[el,...(parentOf(el)?[parentOf(el)]:[])];
   const branches=[...new Set(supports.flatMap(e=>ELEMENT_BRANCH[e]||[]))].join('、');
   timing.push(`休囚待生扶，逢${supports.join('、')}之月日（${branches}）`);
  }
 }
 return {strength,factors,timing};
}

/** 由用神旺衰与关键凶煞/吉顺因子合成吉凶倾向，仅作传统参考、非确定性结论。 */
function tendencyVerdict(present:boolean, strength:string, factors:string[]):{level:string;text:string} {
 if(!present)return {level:'伏藏待显',text:'用神不上卦，主事迟；待出伏、填实或日月并临方可应事，暂不宜强求。'};
 const bad=['月破','日破','动化回头克','化墓','化绝'].some(f=>factors.includes(f));
 const good=['动化回头生','化进神','日冲暗动'].some(f=>factors.includes(f));
 if(strength==='旺相'&&!bad)return {level:'顺遂',text:'用神旺相有力，又无回头克与冲破，所问倾向顺利，宜把握时机。'};
 if(strength==='旺相'&&bad)return {level:'吉中有阻',text:'用神虽旺，但带冲破或回头克，先顺后阻、成中有变，需防中途波折。'};
 if(strength!=='旺相'&&bad)return {level:'受阻',text:'用神衰而受制，所问暂难如意，宜守不宜进，待生扶之月日。'};
 return {level:'待机',text:good?'用神暂衰但有生扶之机，缓进待旺，逢生扶月日可望转顺。':'用神休囚，势未成，宜静观养力，待生扶之月日再图。'};
}

/** 综合多个用神爻或伏神，产出用神定位、旺衰结论与应期参考。 */
export function analyzeLiuyao(liuyao:any, question:string) {
 const main=liuyao.mainHexagram,cat=classify(question||'');
 // 定位用神爻：未命中六亲时以世爻为用。
 let usedLines:any[]=[];
 if(cat.usedGods===null)usedLines=main.lines.filter((l:any)=>l.isShi);
 else usedLines=main.lines.filter((l:any)=>cat.usedGods!.includes(l.liuQin));
 // 用神不上卦时查伏神。
 let fuShen:any=null;
 if(usedLines.length===0&&cat.usedGods)fuShen=(main.fuShen||[]).find((f:any)=>cat.usedGods!.includes(f.liuQin))||null;
 // 伏藏与上卦分开输出。
 if(fuShen){
  const zhi=fuShen.zhi,hideZhi=(fuShen.hideUnder||'')[1]||'';
  return {rules:{version:'liuyao-yongshen-v1',note:'按问题关键词推断用神，结合月建旺衰与空破动变给出传统参考；不作确定性吉凶或应期。'},category:cat,present:false,fuShen:{liuQin:fuShen.liuQin,ganZhi:fuShen.ganZhi,element:fuShen.element,hideUnder:fuShen.hideUnder,hideUnderLiuQin:fuShen.hideUnderLiuQin},verdict:{strength:'伏藏不现',factors:[`用神${fuShen.liuQin}不上卦，伏于${fuShen.hideUnder}之下（${fuShen.hideUnderLiuQin}）`]},timing:{label:'应期参考',suggestions:[`出伏：逢值（${zhi}）或冲去飞神（逢${CHONG[hideZhi]||hideZhi}）`],note:'用神伏藏多主事迟，须待出伏、填实或日月并临方可应事。'},tendency:tendencyVerdict(false,'伏藏不现',[])};
 }
 const verdicts=usedLines.map(lineVerdict);
 const strengths=verdicts.map(v=>v.strength);
 const strength=strengths.some(s=>s==='旺相')?'旺相':strengths.some(s=>s==='休')&&strengths.every(s=>s!=='旺相')?'休':strengths.length?'休囚':'—';
 const factors=[...new Set(verdicts.flatMap(v=>v.factors))];
 const suggestions=[...new Set(verdicts.flatMap(v=>v.timing))];
 return {rules:{version:'liuyao-yongshen-v1',note:'按问题关键词推断用神，结合月建旺衰与空破动变给出传统参考；不作确定性吉凶或应期。'},category:cat,present:true,usedLines:usedLines.map((l:any)=>({position:l.position,positionName:l.positionName,ganZhi:l.ganZhi,liuQin:l.liuQin,element:l.element,wangShuai:l.wangShuai,isShi:l.isShi,isMoving:l.isMoving,isKongWang:l.isKongWang,isYuePo:l.isYuePo,changedTo:l.changedTo})),verdict:{strength,factors},timing:{label:'应期参考',suggestions,note:'应期以月建、日辰逢值、逢合、填实、冲空之时为参考，非确定日程。'},tendency:tendencyVerdict(true,strength,factors)};
}