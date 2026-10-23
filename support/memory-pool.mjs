/** 测试专用 SQL 替身：模拟共享配置修订和事务锁，不连接本机或线上数据库。 */
export class MemoryPool {
  /** 各实例共用此对象即可模拟两套后端访问同一数据库。 */
  constructor(){this.settings=new Map();this.users=new Map();this.sessions=new Map();this.notes=new Map();this.lock=Promise.resolve();}
  /** 建表语句在内存测试中无需执行。 */
  async query(){return [[],[]];}
  /** 配置写入遵守事务锁，用于验证停用与完整回答提交的先后。 */
  async execute(sql,args=[]){if(sql.startsWith('UPDATE app_settings'))await this.lock;return this.exec(sql,args);}
  /** 只实现业务测试实际经过的 SQL；未覆盖语句直接失败，避免静默伪造成功。 */
  exec(sql,args){
    if(sql.startsWith('SELECT value,revision FROM app_settings')){const row=this.settings.get(args[0]);return [row?[structuredClone(row)]:[]];}
    if(sql.startsWith('INSERT IGNORE INTO app_settings')){if(!this.settings.has(args[0]))this.settings.set(args[0],{value:JSON.parse(args[1]),revision:1});return [{affectedRows:1}];}
    if(sql.startsWith('UPDATE app_settings')){const row=this.settings.get(args[1]);if(!row||row.revision!==args[2])return [{affectedRows:0}];row.value=JSON.parse(args[0]);row.revision++;return [{affectedRows:1}];}
    if(sql.startsWith('INSERT IGNORE INTO wechat_users')){if(![...this.users.values()].some(u=>u.appid===args[1]&&u.openid===args[2]))this.users.set(args[0],{id:args[0],appid:args[1],openid:args[2],is_admin:false});return [{affectedRows:1}];}
    if(sql.startsWith('SELECT id,is_admin FROM wechat_users'))return [[...this.users.values()].filter(u=>u.appid===args[0]&&u.openid===args[1]).map(u=>({...u}))];
    if(sql.includes('JOIN wechat_sessions')){const s=this.sessions.get(args[0]),u=s&&this.users.get(s.userId);return [s&&s.expires>args[1]&&u&&u.appid===args[2]?[{id:u.id,is_admin:u.is_admin}]:[]];}
    if(sql.startsWith('SELECT id FROM wechat_users')){const u=this.users.get(args[0]);return [u&&u.appid===args[1]?[{id:u.id}]:[]];}
    if(sql.startsWith('UPDATE wechat_users')){const u=this.users.get(args[1]);if(!u||u.appid!==args[2])return [{affectedRows:0}];u.is_admin=args[0];return [{affectedRows:1}];}
    if(sql.startsWith('INSERT INTO wechat_sessions')){this.sessions.set(args[0],{userId:args[1],expires:args[2]});return [{affectedRows:1}];}
    if(sql.startsWith('DELETE FROM wechat_sessions WHERE token_hash')){this.sessions.delete(args[0]);return [{affectedRows:1}];}
    if(sql.startsWith('DELETE FROM wechat_sessions WHERE expires')){for(const [key,s]of this.sessions)if(s.expires<=args[0])this.sessions.delete(key);return [{affectedRows:1}];}
    if(sql.startsWith('SELECT note, revision FROM readings WHERE id')){const n=this.notes.get(args[0]);return [n&&n.owner===args[1]?[{note:structuredClone(n.note),revision:n.revision}]:[]];}
    if(sql.startsWith('SELECT note, revision FROM readings WHERE owner'))return [[...this.notes.values()].filter(n=>n.owner===args[0]).map(n=>({note:structuredClone(n.note),revision:n.revision}))];
    if(sql.startsWith('INSERT INTO readings')){if(!this.notes.has(args[0]))this.notes.set(args[0],{note:JSON.parse(args[1]),owner:args[2],revision:1});return [{affectedRows:1}];}
    if(sql.startsWith('UPDATE readings SET note=')){const n=this.notes.get(args[1]);if(!n||n.revision!==args[2]||n.owner!==args[3])return [{affectedRows:0}];n.note=JSON.parse(args[0]);n.revision++;return [{affectedRows:1}];}
    if(sql.startsWith('DELETE FROM readings WHERE id')){if(this.notes.get(args[0])?.owner===args[1])this.notes.delete(args[0]);return [{affectedRows:1}];}
    if(sql.startsWith('DELETE FROM readings WHERE owner')){for(const [id,n]of this.notes)if(n.owner===args[0])this.notes.delete(id);return [{affectedRows:1}];}
    throw new Error('测试 SQL 尚未实现：'+sql);
  }
  /** 串行事务足以模拟同一配置行上 SELECT FOR UPDATE 的互斥关系。 */
  async getConnection(){
    let release,snapshot;
    return {
      beginTransaction:async()=>{const before=this.lock;this.lock=new Promise(resolve=>{release=resolve;});await before;snapshot=structuredClone(this.notes);},
      execute:async(sql,args)=>this.exec(sql,args),
      commit:async()=>{release();release=null;},
      rollback:async()=>{if(release){this.notes=snapshot;release();release=null;}},
      release:()=>{if(release)release();}
    };
  }
}
