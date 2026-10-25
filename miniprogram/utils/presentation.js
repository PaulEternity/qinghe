/** 盘面展示适配：只格式化既有事实，不重排盘、不重新抽牌。 */
const {baseUrl}=require('./api');
const {cloud}=require('../config');
/** 完整导出保留原盘、已完成回答与追问，不包含图片和系统配置。 */
function exportText(note){return [note.record.title,note.record.question,note.created,JSON.stringify(note.record.facts,null,2),note.answer,...note.history.map(message=>(message.role==='user'?'我：':'清和：')+message.content)].join('\n\n');}
/** 逐个形成可读区块，完整规则仍可展开核对。 */
function present(note,gloss={}){
  const facts=note.record.facts,blocks=[];
  for(const [key,label] of [['birth','本方四柱'],['partner','对方四柱']])if(facts[key])blocks.push({title:label,text:facts[key].lunar+'\n'+facts[key].calendar,pillars:facts[key].pillars});
  for(const correction of [facts.timeCorrection,facts.birth&&facts.birth.timeCorrection,facts.partner&&facts.partner.timeCorrection])if(correction)blocks.push({title:'时间口径',text:correction.enabled?correction.original+' → '+correction.corrected+'\n经度修正 '+correction.longitudeMinutes.toFixed(2)+' 分钟，均时差 '+correction.equationMinutes.toFixed(2)+' 分钟。'+(correction.crossedDay?'跨日。':'')+(correction.crossedHour?'跨时辰。':''):'北京时间 UTC+8：'+correction.original});
  if(facts.zodiac){const z=facts.zodiac;blocks.push({title:z.personA.name+' × '+z.personB.name,text:[z.personA.element+' · '+z.personA.modality,z.personB.element+' · '+z.personB.modality,z.pairing.theme,z.pairing.strength,'需要磨合：'+z.pairing.friction,'建议：'+z.pairing.advice,z.elements.a,z.elements.b,z.rhythm.a,z.rhythm.b,z.rhythm.summary,z.rules.limit].join('\n\n')});}
  let lines=[],palaces=[];
  if(facts.liuyao){const l=facts.liuyao;blocks.push({title:l.mainHexagram.name+(l.changedHexagram?' → '+l.changedHexagram.name:''),text:l.mainHexagram.palace+'宫 · '+l.mainHexagram.palaceElement+'\n旬空：'+l.kongWang.join('、')+'\n'+(gloss.hexagram&&gloss.hexagram[l.mainHexagram.name]||'')+'\n'+(l.changedHexagram&&gloss.hexagram&&gloss.hexagram[l.changedHexagram.name]||'')+'\n'+l.rules.boundary});lines=facts.lines.map((line,index)=>({...line,symbol:line.yang?'━━━━━━':'━━　━━',detail:l.mainHexagram.lines[index],changed:l.changedHexagram&&l.changedHexagram.lines[index]})).reverse();}
  if(facts.ziwei){const z=facts.ziwei;blocks.push({title:'紫微命盘',text:z.solarDate+' · '+z.lunarDate+'\n'+z.fiveElementsClass+' · 命主 '+z.soul+' · 身主 '+z.body+'\n阶段日期：'+z.stage.focusDate+'\n流年：'+z.stage.yearly.heavenlyStem+z.stage.yearly.earthlyBranch+'\n四化（禄权科忌）：'+z.stage.yearly.mutagen.join('、')});palaces=z.palaces.map(p=>({...p,stars:[...p.majorStars,...p.minorStars,...p.adjectiveStars].map(s=>s.name+(s.brightness?'（'+s.brightness+'）':'')+(s.mutagen?'化'+s.mutagen:'')).join('、')||'无主星'}));}
  if(facts.surname)blocks.push({title:'姓氏',text:facts.surname});
  if(facts.note)blocks.push({title:'观察边界',text:facts.note});
  const cards=(facts.cards||[]).map((card,index)=>{const open=Boolean(note.answer)||(note.revealed||[]).includes(index),entry=gloss.tarot&&gloss.tarot[card.name];return {...card,index,open,image:cloud?'':baseUrl+'/assets/tarot/rws/'+card.id+'.jpg',gloss:open&&entry?entry[card.orientation==='逆位'?'逆':'正']:''};});
  return {blocks:blocks.map((block,key)=>({...block,key})),historyView:note.history.map((message,key)=>({...message,key})),lines,palaces,cards,allRevealed:cards.every(card=>card.open),rawFacts:JSON.stringify(facts,null,2)};
}
/** 导出使用系统分享，旧客户端缺少文件分享能力时保留复制文本入口。 */
function exportNotes(notes){
  const text=notes.map(exportText).join('\n\n────────────\n\n');
  wx.showActionSheet({itemList:['复制全部文本','导出文本文件'],success:result=>{
    if(result.tapIndex===0||!wx.shareFileMessage)return wx.setClipboardData({data:text});
    const path=wx.env.USER_DATA_PATH+'/qinghe-notes.txt';
    wx.getFileSystemManager().writeFile({filePath:path,data:text,encoding:'utf8',success:()=>wx.shareFileMessage({filePath:path,fileName:'清和札记.txt',complete:()=>wx.getFileSystemManager().unlink({filePath:path,fail:()=>{}})}),fail:()=>wx.showToast({title:'导出失败，请复制文本',icon:'none'})});
  }});
}
module.exports={present,exportText,exportNotes};
