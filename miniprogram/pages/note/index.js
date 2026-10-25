/** 结果页：翻牌、完整事实、流式解读、原盘追问、复制和导出。 */
const {api,stream,abortStreams,session,showError,cardImage}=require('../../utils/api');
const {present,exportText,exportNotes}=require('../../utils/presentation');
Page({
  data:{note:null,blocks:[],cards:[],lines:[],palaces:[],allRevealed:false,busy:false,error:'',partial:'',question:'',showFacts:false,rawFacts:'',needsPhoto:false},
  /** 通过 ID 取属于当前账号的札记，图片只从同一次排盘的内存中接收。 */
  onLoad(options){this.id=options.id;const pending=getApp().pendingImage;if(pending&&pending.id===this.id)this.image=pending.image;delete getApp().pendingImage;},
  /** 回到页面时从服务端刷新；没有身份时清空旧页面内容。 */
  async onShow(){this.visible=true;this.setData({error:'',partial:''});if(!session()){this.setData({note:null});return showError(this,new Error('请先微信登录'));}try{const result=await api('/api/notes');if(!this.visible)return;const note=result.notes.find(item=>item.id===this.id);if(!note)throw new Error('札记不存在或不属于当前账号');if(!getApp().globalData.gloss){try{getApp().globalData.gloss=await api('/api/gloss');}catch{/* 释义加载失败不隐藏已保存的盘面。 */}}if(this.visible)this.display(note);}catch(error){this.setData({note:null});showError(this,error);}},
  /** 离开页面立即取消本机流，避免后台迟到结果覆盖另一个页面。 */
  onHide(){this.visible=false;abortStreams();this.setData({busy:false});},
  /** 私人照片不跨页面生命周期保留。 */
  onUnload(){this.visible=false;abortStreams();this.image=null;},
  /** 展示层不改动原始记录，所有用户状态以服务器返回为准。 */
  display(note){const view=present(note,getApp().globalData.gloss||{}),version=this.imageVersion=(this.imageVersion||0)+1;this.setData({note,...view,needsPhoto:note.record.tool==='palm'&&!note.answer&&!this.image});for(const card of view.cards)if(card.open&&!card.image)cardImage(card.id).then(path=>{if(this.visible&&this.imageVersion===version)this.setData({['cards['+card.index+'].image']:path});}).catch(error=>{if(this.visible&&this.imageVersion===version)showError(this,error);});},
  /** 翻牌先保存服务器状态再显示，失败时不假装完成。 */
  async flip(event){if(this.data.busy)return;const index=Number(event.currentTarget.dataset.index),indices=new Set(this.data.note.revealed||[]);if(index>=0)indices.add(index);else for(let i=0;i<this.data.cards.length;i++)indices.add(i);this.setData({busy:true,error:''});try{const result=await api('/api/notes/reveal',{id:this.id,revealed:Array.from(indices)});if(this.visible)this.display(result.note);}catch(error){if(this.visible)showError(this,error);}finally{if(this.visible)this.setData({busy:false});}},
  /** 手相札记不保存照片，重新打开未解读记录时需再次选择。 */
  choosePhoto(){wx.chooseMedia({count:1,mediaType:['image'],success:result=>{const file=result.tempFiles[0];if(file.size>3*1024*1024)return showError(this,new Error('请选择不超过 3MB 的照片'));wx.getFileSystemManager().readFile({filePath:file.tempFilePath,encoding:'base64',success:read=>{if(!this.visible)return;const data=read.data,type=data.startsWith('/9j/')?'jpeg':data.startsWith('iVBOR')?'png':data.startsWith('UklGR')?'webp':null;if(!type)return showError(this,new Error('请选择 PNG、JPEG 或 WebP 图片'));this.image='data:image/'+type+';base64,'+data;this.setData({needsPhoto:false,error:''});},fail:()=>showError(this,new Error('图片读取失败'))});}});},
  /** 单页只允许一个请求；追问始终使用原 record，不触发重新排盘。 */
  async run(followup){if(this.data.busy)return;if(!this.data.allRevealed)return showError(this,new Error('请先翻开全部卡牌'));if(followup&&!this.data.question.trim())return showError(this,new Error('请填写追问'));if(this.data.needsPhoto)return showError(this,new Error('请重新选择手掌照片'));this.setData({busy:true,error:'',partial:''});try{const note=this.data.note,payload=followup?{record:note.record,question:this.data.question.trim()}:{record:note.record,image:this.image||undefined};const result=await stream(followup?'/api/followup':'/api/interpret',payload,text=>{if(this.visible)this.setData({partial:this.data.partial+text});});if(!this.visible)return;if(!result.answer||!result.note)throw new Error('模型未返回完整回答，请联系管理员检查配置');this.display(result.note);this.setData({partial:'',question:''});this.image=null;}catch(error){if(this.visible)showError(this,error);}finally{if(this.visible)this.setData({busy:false});}},
  /** 首次解读在用户核对盘面后明确发起。 */
  interpret(){return this.run(false);},
  /** 用户可以围绕原盘继续提问，服务端限制历史长度。 */
  followup(){return this.run(true);},
  /** 保存追问草稿，不将内容写入全局存储。 */
  changeQuestion(event){this.setData({question:event.detail.value});},
  /** 完整规则按需展开，避免长 JSON 淹没主要盘面。 */
  toggleFacts(){this.setData({showFacts:!this.data.showFacts});},
  /** 仅复制已完成结果，不把可见的中断片段作为正式答案。 */
  copy(){wx.setClipboardData({data:exportText(this.data.note)});},
  /** 用户主动选择后才导出私人札记。 */
  export(){exportNotes([this.data.note]);}
});
