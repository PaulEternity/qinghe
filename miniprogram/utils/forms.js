/** 表单元数据：仅收集输入，历法、规则和随机抽取始终由既有服务端引擎处理。 */
const option=(label,value)=>({label,value});
/** 通用字段保持可序列化，便于原生 WXML 逐项渲染。 */
const field=(name,label,type='text',value='',options=[])=>({name,label,type,value,options,visible:true});
/** 北京时间由显式 UTC+8 偏移生成，不使用手机时区推断出生口径。 */
function beijingNow(){return new Date(Date.now()+8*3600000).toISOString();}
/** 时间输入与真太阳时开关成组；未开启时不提交经度。 */
function timeFields(prefix,label,now=false){return [field(prefix+'Date',label+'日期 · 公历北京时间','date',now?beijingNow().slice(0,10):''),field(prefix+'Time',label+'时间 · UTC+8','time',now?beijingNow().slice(11,16):''),field(prefix==='partnerBirth'?'partnerSolarCorrection':'solarCorrection','真太阳时近似校正','switch',false),{...field(prefix==='partnerBirth'?'partnerLongitude':'longitude','地点经度（东经为正，西经为负）','number'),depends:prefix==='partnerBirth'?'partnerSolarCorrection':'solarCorrection',visible:false}];}
/** 与网页提供相同领域参数，规则值使用后端既有枚举。 */
function fieldsFor(tool,definition){
  let fields=[];
  if(definition.birth)fields.push(...timeFields('birth','出生'));
  if(['match','ziwei'].includes(tool))fields.push(field('gender','命盘性别','picker',0,[option('男','男'),option('女','女')]));
  if(tool==='match')fields.push(...timeFields('partnerBirth','对方出生'));
  if(tool==='naming')fields.push(field('surname','姓氏'));
  if(tool==='ziwei')fields.push(field('ziweiAlgorithm','安星规则','picker',0,[option('通行规则','default'),option('中州派规则','zhongzhou')]),field('dayDivide','晚子时（23:00—23:59）','picker',0,[option('按次日','forward'),option('按当日','current')]),field('fixLeap','闰月处理','picker',0,[option('前半月当月、后半月下月',true),option('按原月',false)]),field('focusDate','查看阶段日期','date',beijingNow().slice(0,10)));
  if(tool==='tarot')fields.push(field('spread','牌阵','picker',1,[option('单张牌','single'),option('圣三角三牌','three'),option('凯尔特十字 · 十张牌','celtic')]),field('spreadMode','三牌视角','picker',0,[option('处境—挑战—建议','situation-challenge-advice'),option('过去—现在—未来','past-present-future'),option('心智—身体—灵魂','mind-body-spirit'),option('你—对方—关系','you-partner-relationship')]));
  if(tool==='liuyao'){
    fields.push(...timeFields('cast','起卦',true),field('castMode','起卦方式','picker',0,[option('程序三钱法','auto'),option('手摇结果录入','manual')]));
    for(let i=1;i<=6;i++)fields.push({...field('line'+i,i===1?'初爻':i===6?'上爻':i+'爻','picker',0,[option('请选择',null),option('6 老阴（动）',6),option('7 少阳（静）',7),option('8 少阴（静）',8),option('9 老阳（动）',9)]),depends:'manual',visible:false});
  }
  if(tool==='zodiac')for(const [name,label] of [['signA','你的星座'],['signB','对方的星座']])fields.push(field(name,label,'picker',0,[option('请选择',null),...definition.signs.map(sign=>option(sign.symbol+' '+sign.name+' · '+sign.element,sign.id))]));
  return fields;
}
/** 字段更新时计算显隐，隐藏字段不会悄悄进入请求。 */
function updateFields(fields,index,value){
  const next=fields.map(item=>({...item})),item=next[index];item.value=item.type==='picker'?Number(value):value;
  if(/^line[1-6]$/.test(item.name))for(const other of next)if(/^line[1-6]$/.test(other.name)&&other.name>item.name)other.value=0;
  const values=valuesOf(next);
  for(const entry of next)if(entry.depends)entry.visible=entry.depends==='manual'?values.castMode==='manual':Boolean(values[entry.depends]);
  return next;
}
/** 控件索引转成领域参数，保留布尔值与数字而非标签文本。 */
function valuesOf(fields){const values={};for(const item of fields)values[item.name]=item.type==='picker'?item.options[item.value].value:item.value;return values;}
/** 拼接用户明确选择的日期时间，不给未填写的出生时间套默认值。 */
function payloadFor(tool,fields,question,image){
  const values=valuesOf(fields),payload={tool,question,...values};
  for(const prefix of ['birth','partnerBirth'])if(Object.prototype.hasOwnProperty.call(values,prefix+'Date')){if(!values[prefix+'Date']||!values[prefix+'Time'])throw new Error('请填写完整出生日期和时间');payload[prefix]=values[prefix+'Date']+'T'+values[prefix+'Time'];}
  if(tool==='liuyao'){payload.castTime=values.castDate+'T'+values.castTime;if(values.castMode==='manual')payload.lineValues=Array.from({length:6},(_,i)=>values['line'+(i+1)]);}
  for(const prefix of ['','partner']){const toggle=prefix?values.partnerSolarCorrection:values.solarCorrection,key=prefix?'partnerLongitude':'longitude';if(toggle){if(values[key]==='')throw new Error('开启校正后请填写地点经度');payload[key]=Number(values[key]);}else delete payload[key];}
  for(const key of Object.keys(payload))if(/(?:Date|Time)$/.test(key)&&key!=='castTime'&&key!=='focusDate'||/^line[1-6]$/.test(key))delete payload[key];
  if(image)payload.image=image;
  return payload;
}
module.exports={fieldsFor,updateFields,payloadFor,valuesOf};
