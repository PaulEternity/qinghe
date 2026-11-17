/** 图片资源集成校验：核对韦特牌原图、轻量牌图和铜钱的静态响应。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {TAROT_IMAGES} from './public/tarot-images.js';
import {createApp} from './server.mjs';
const directory=new URL('./public/assets/tarot/rws/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));

test('韦特 78 张无缺失、重复或错序，文件内容与来源清单一致',async()=>{
 const major='愚者 魔术师 女祭司 皇后 皇帝 教皇 恋人 战车 力量 隐者 命运之轮 正义 倒吊人 死神 节制 恶魔 高塔 星星 月亮 太阳 审判 世界'.split(' ');
 const names=[...major,...['权杖','圣杯','宝剑','星币'].flatMap(suit=>'王牌 二 三 四 五 六 七 八 九 十 侍从 骑士 王后 国王'.split(' ').map(rank=>suit+rank))];
 assert.equal(manifest.cards.length,78);assert.equal(Object.keys(TAROT_IMAGES).length,78);assert.equal(new Set(manifest.cards.map(card=>card.sha256)).size,78);
 for(const [index,card] of manifest.cards.entries()){
  assert.equal(card.id,`rws-${index}`);assert.equal(card.name,names[index]);assert.equal(TAROT_IMAGES[card.name],card.file);
  const bytes=await readFile(new URL(card.file,directory));assert.equal(bytes.readUInt16BE(0),0xffd8);assert.equal(createHash('sha256').update(bytes).digest('hex'),card.sha256);
 }
});

test('牌图和铜钱的 WebP 可从静态路由读取并缓存，原始 JPEG 链接可用',async()=>{
 const server=createApp();server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const module=await fetch(base+'/tarot-images.js');assert.equal(module.status,200);
  /** 检查轻量图片响应实际传输 WebP 字节，并可直接复用七天。 */
  async function checkWebp(path,originalSize){
   const response=await fetch(base+path);
   assert.equal(response.status,200,path);
   assert.equal(response.headers.get('content-type'),'image/webp',path);
   assert.equal(response.headers.get('cache-control'),'public, max-age=604800',path);
   // 使用 HTTP 响应体的字节数核对实际缩减幅度。
   const bytes=Buffer.from(await response.arrayBuffer());
   assert.equal(bytes.toString('ascii',8,12),'WEBP',path);
   assert.ok(bytes.length>12&&bytes.length<originalSize/2,path);
  }
  for(const card of manifest.cards){
   const path='/assets/tarot/rws/'+card.file;
   const response=await fetch(base+path);
   assert.equal(response.status,200);
   assert.equal(response.headers.get('content-type'),'image/jpeg');
   const original=Buffer.from(await response.arrayBuffer());
   assert.equal(createHash('sha256').update(original).digest('hex'),card.sha256);
   await checkWebp(path.replace(/\.jpg$/,'.webp'),original.length);
  }
  const css=await (await fetch(base+'/style.css')).text();
  for(const face of ['obverse','reverse']){
   const path=`/assets/coins/qianlong-${face}`;
   assert.ok(css.includes(`url('${path}.webp')`));
   const original=await fetch(base+path+'.jpg');
   assert.equal(original.status,200);
   await checkWebp(path+'.webp',(await original.arrayBuffer()).byteLength);
  }
  for(const path of ['/assets/tarot/rws/rws-78.jpg','/assets/tarot/rws/rws-00.jpg','/assets/tarot/rws/rws-78.webp','/assets/tarot/rws/manifest.json','/assets/tarot/rws/%2e%2e%2f.env','/assets/coins/other.webp'])assert.equal((await fetch(base+path)).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
