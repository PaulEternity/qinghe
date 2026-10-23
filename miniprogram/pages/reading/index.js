/** 全功能输入页：复用后端排盘与持久化接口，先生成盘面，再决定调用 AI。 */
const {api,session,showError}=require('../../utils/api');
const {fieldsFor,updateFields,payloadFor,valuesOf}=require('../../utils/forms');
Page({
  data:{tool:'',definition:null,fields:[],question:'',photo:'',busy:false,error:'',manual:false,coinResult:'',solarPreview:''},
  /** 按服务端元数据创建表单，不接收客户端自行定义的工具参数。 */
  async onLoad(options){try{const status=await api('/api/status'),definition=status.tools[options.tool];if(!definition||definition.legacy)throw new Error('该功能不可用');this.setData({tool:options.tool,definition,fields:fieldsFor(options.tool,definition)});wx.setNavigationBarTitle({title:definition.name});}catch(error){showError(this,error);}},
  /** 页面被卸载后忽略迟到的图片读取或排盘响应。 */
  onUnload(){this.unloaded=true;this.previewVersion=(this.previewVersion||0)+1;this.image=null;},
  /** 根据开关展示经度与手摇爻位，并请求同一服务端函数预览校正。 */
  changeField(event){const fields=updateFields(this.data.fields,Number(event.currentTarget.dataset.index),event.detail.value);this.setData({fields,manual:valuesOf(fields).castMode==='manual'});this.preview(fields);},
  /** 问题文本仅作为数据发给后端，不允许客户端指定系统提示词。 */
  changeQuestion(event){this.setData({question:event.detail.value});},
  /** 图片限制为 PNG/JPEG/WebP 和 3MB；只保存在当前页内存，不写入 storage。 */
  choosePhoto(){wx.chooseMedia({count:1,mediaType:['image'],sourceType:['album','camera'],success:result=>{const file=result.tempFiles[0];if(file.size>3*1024*1024)return showError(this,new Error('请选择不超过 3MB 的照片'));wx.getFileSystemManager().readFile({filePath:file.tempFilePath,encoding:'base64',success:read=>{if(this.unloaded)return;const data=read.data;const type=data.startsWith('/9j/')?'jpeg':data.startsWith('iVBOR')?'png':data.startsWith('UklGR')?'webp':null;if(!type)return showError(this,new Error('请选择 PNG、JPEG 或 WebP 图片'));this.image='data:image/'+type+';base64,'+data;this.setData({photo:file.tempFilePath,error:''});},fail:()=>showError(this,new Error('图片读取失败'))});}});},
  /** 手摇辅助沿用三钱记法，显示结果后由用户手动录入爻位。 */
  castCoins(){const faces=Array.from({length:3},()=>Math.random()<0.5?'字':'背'),value=faces.reduce((sum,face)=>sum+(face==='字'?2:3),0);this.setData({coinResult:faces.join(' · ')+' → '+value+'；请按初爻至上爻录入。'});},
  /** 校正结果含两个偏移分量，过期预览不得覆盖新表单。 */
  async preview(fields){const version=(this.previewVersion||0)+1;this.previewVersion=version;try{const values=valuesOf(fields),parts=[];for(const prefix of ['','partner']){if(!(prefix?values.partnerSolarCorrection:values.solarCorrection))continue;const source=prefix?'partnerBirth':this.data.tool==='liuyao'?'cast':'birth',longitude=prefix?values.partnerLongitude:values.longitude;if(!values[source+'Date']||!values[source+'Time']||longitude==='')continue;const result=await api('/api/solar-time',{time:values[source+'Date']+'T'+values[source+'Time'],enabled:true,longitude:Number(longitude)});parts.push((prefix?'对方：':'')+result.original+' → '+result.corrected+'；经度修正 '+result.longitudeMinutes.toFixed(2)+' 分钟，均时差 '+result.equationMinutes.toFixed(2)+' 分钟。'+(result.crossedDay?'已跨日。':'')+(result.crossedHour?'已跨时辰。':''));}if(!this.unloaded&&version===this.previewVersion)this.setData({solarPreview:parts.join('\n')});}catch(error){if(!this.unloaded&&version===this.previewVersion)this.setData({solarPreview:error.message});}},
  /** 生成成功只传札记 ID；手相临时图片通过内存交给下一页，随后清除。 */
  async submit(){if(this.data.busy)return;if(!session())return wx.navigateTo({url:'/pages/account/index'});this.setData({busy:true,error:''});try{const payload=payloadFor(this.data.tool,this.data.fields,this.data.question,this.image),result=await api('/api/chart',payload);if(this.unloaded)return;getApp().pendingImage=this.image?{id:result.note.id,image:this.image}:null;wx.navigateTo({url:'/pages/note/index?id='+result.note.id});}catch(error){if(!this.unloaded)showError(this,error);}finally{if(!this.unloaded)this.setData({busy:false});}}
});
