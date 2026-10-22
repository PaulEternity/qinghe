/** 模型适配层：JSON 与 SSE 共用验证；不回显密钥或上游错误正文，不自动重试计费请求。 */
export interface Message {role:string;content:unknown}
interface ModelOptions {fetcher?:typeof fetch;env?:NodeJS.ProcessEnv;onDelta?:(text:string)=>void;signal?:AbortSignal;}
/** 逐个解析 SSE 数据块，正确处理 UTF-8 分片、CRLF 和多行 data。 */
async function consumeSSE(response:Response,onData:(data:string)=>boolean) {
 if(!response.body)throw new Error('模型响应缺少流式数据');
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',stopped=false;
 try {
  while(!stopped){const {done,value}=await reader.read();pending+=done?decoder.decode():decoder.decode(value,{stream:true});let match:RegExpExecArray|null;
   while((match=/\r?\n\r?\n/.exec(pending))){const block=pending.slice(0,match.index);pending=pending.slice(match.index+match[0].length);const data=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');if(data&&onData(data)){stopped=true;break;}}
   if(done){if(pending.trim()){const data=pending.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');if(data)onData(data);}break;}
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** 调用兼容 chat/completions 的服务，只有正常结束的完整回答才标记成功。 */
export async function askModel(messages:Message[],{fetcher=fetch,env=process.env,onDelta,signal}:ModelOptions={}) {
 const base=env.MODEL_BASE_URL,key=env.MODEL_API_KEY,model=env.MODEL_NAME;
 if(!base||!key||!model)return {configured:false};
 const u=new URL(base);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('模型服务地址配置无效');
 const timeout=AbortSignal.timeout(90000);
 const response=await fetcher(base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model,messages,temperature:0.65,max_tokens:2500,stream:!!onDelta}),signal:signal?AbortSignal.any([signal,timeout]):timeout});
 if(!response.ok)throw new Error(`模型服务返回 HTTP ${response.status}，请检查额度、模型名称和接口配置`);
 if(!onDelta){const data=await response.json();const answer=data.choices?.[0]?.message?.content;if(typeof answer!=='string'||!answer.trim())throw new Error('模型没有返回文本，请检查接口兼容性');if(data.choices?.[0]?.finish_reason==='length')throw new Error('模型输出达到长度上限，请缩小问题');return{configured:true,answer};}
 if(!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('模型服务不支持 SSE 流式响应，请检查兼容接口');
 let answer='',finished=false;
 await consumeSSE(response,data=>{if(data==='[DONE]'){finished=true;return true;}let part;try{part=JSON.parse(data);}catch{throw new Error('模型流式响应格式无效');}if(part.error)throw new Error('模型流式响应返回错误，请检查服务状态');const choice=part.choices?.[0];if(choice?.finish_reason==='length')throw new Error('模型输出达到长度上限，请缩小问题');if(choice?.finish_reason==='stop')finished=true;else if(choice?.finish_reason)throw new Error('模型未正常完成文本回复，请检查服务或调整问题');const delta=choice?.delta?.content;if(typeof delta==='string'){answer+=delta;onDelta(delta);}return false;});
 if(!finished)throw new Error('模型连接提前中断，部分内容未保存为完整回答');
 if(!answer.trim())throw new Error('模型没有返回文本，请检查接口兼容性');
 return{configured:true,answer};
}
