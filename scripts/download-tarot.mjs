/** 下载固定版本的韦特牌图；校验 SHA-256，失败时不覆盖已有资源。 */
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder=new URL('../public/assets/tarot/rws/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
await mkdir(folder,{recursive:true});
let next=0;
/** 有限并发下载，核对文件内容与已审核版本清单。 */
async function worker(){
 while(next<manifest.cards.length){
  const card=manifest.cards[next++],target=new URL(card.file,folder);
  try{const existing=await readFile(target);if(createHash('sha256').update(existing).digest('hex')===card.sha256)continue;}catch(error){if(error.code!=='ENOENT')throw error;}
  const response=await fetch(card.source,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`牌图下载失败：${card.id}，HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  // 不把 HTML 错误页或下载中断的内容当作图片保存。
  if(bytes[0]!==0xff||bytes[1]!==0xd8||createHash('sha256').update(bytes).digest('hex')!==card.sha256)throw new Error(`牌图校验失败：${card.id}`);
  const temporary=new URL(card.file+'.part',folder);await writeFile(temporary,bytes);await rename(temporary,target);
 }
}
await Promise.all(Array.from({length:4},worker));
console.log(`韦特牌图已准备：${manifest.cards.length} 张。`);
