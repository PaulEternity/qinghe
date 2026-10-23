/** 小程序独立 UTF-8/SSE 解码器，不依赖部分真机缺失的 TextDecoder。 */
class SSEDecoder {
  /** pending 只保留跨网络块的不完整 UTF-8 字节。 */
  constructor(onDelta) { this.pending = []; this.buffer = ''; this.raw = ''; this.result = null; this.onDelta = onDelta; }
  /** 校验 UTF-8 码点，避免中文、表情跨分片损坏。 */
  decode(value, final) {
    const bytes = this.pending.concat(Array.from(new Uint8Array(value || new ArrayBuffer(0))));
    let text = '', i = 0;
    while(i < bytes.length) {
      const first = bytes[i], count = first < 128 ? 1 : first >= 194 && first <= 223 ? 2 : first >= 224 && first <= 239 ? 3 : first >= 240 && first <= 244 ? 4 : 0;
      if(!count)throw new Error('响应包含无效 UTF-8');
      if(i + count > bytes.length)break;
      let code = first & (count === 1 ? 127 : (1 << (7-count))-1);
      for(let j=1;j<count;j++){if((bytes[i+j]&192)!==128)throw new Error('响应包含无效 UTF-8');code=(code<<6)|(bytes[i+j]&63);}
      if(code>0x10ffff||(code>=0xd800&&code<=0xdfff)||(count===2&&code<128)||(count===3&&code<2048)||(count===4&&code<65536))throw new Error('响应包含无效 UTF-8');
      text += String.fromCodePoint(code); i += count;
    }
    this.pending=bytes.slice(i);
    if(final&&this.pending.length)throw new Error('模型连接提前中断');
    return text;
  }
  /** 只有 done 事件才可作为完整结果；error 事件立即终止。 */
  push(value, final = false) {
    const text=this.decode(value,final);this.buffer+=text;this.raw+=text;
    if(this.raw.length>1_000_000)throw new Error('模型响应过长');
    let match;
    while((match=/\r?\n\r?\n/.exec(this.buffer))) {
      const block=this.buffer.slice(0,match.index);this.buffer=this.buffer.slice(match.index+match[0].length);
      const lines=block.split(/\r?\n/),type=lines.find(line=>line.startsWith('event:'));
      const data=lines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      if(!data)continue;
      const result=JSON.parse(data),event=type?type.slice(6).trim():'';
      if(event==='error')throw new Error(result.error||'模型请求失败');
      if(event==='delta')this.onDelta(result.text);
      if(event==='done')this.result=result;
    }
  }
}
module.exports = { SSEDecoder };
