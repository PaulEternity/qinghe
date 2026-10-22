/** MySQL 札记仓库：整条记录原子更新，版本号阻止并发覆盖已完成的解读。 */
import mysql, {type Pool, type RowDataPacket, type ResultSetHeader} from 'mysql2/promise';

function owner(id: string) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('请先登录用户账号');
  return id;
}

/** 保留既有札记格式，使旧浏览器数据可以直接导入。 */
export interface Note {
  id: string; created: string;
  record: {id: string; createdAt: string; tool: string; question: string; [key: string]: unknown};
  answer: string; history: {role: 'user'|'assistant'; content: string}[];
  revealed: number[]; configured: boolean; lastRequestId?: string; revision?: number;
}

/** 单表 JSON 保留规则、完整盘面和对话；不保存模型密钥或图片。 */
export class MysqlStore {
  pool: Pool;
  /** 使用专用应用账号连接；连接上限适配本机单体。 */
  constructor(env: NodeJS.ProcessEnv = process.env) {
    if (!env.MYSQL_USER || !env.MYSQL_PASSWORD || !env.MYSQL_DATABASE) throw new Error('请先配置 MySQL 专用账号和数据库');
    const remote = !['127.0.0.1','localhost'].includes(env.MYSQL_HOST || '127.0.0.1');
    if (remote && env.APP_MODE !== 'cloud') throw new Error('MySQL 远程连接需要 APP_MODE=cloud');
    if ((remote || env.APP_MODE === 'cloud') && env.MYSQL_SSL !== 'true') throw new Error('云端 MySQL 必须设置 MYSQL_SSL=true');
    this.pool = mysql.createPool({host:env.MYSQL_HOST||'127.0.0.1',port:Number(env.MYSQL_PORT||3307),user:env.MYSQL_USER,password:env.MYSQL_PASSWORD,database:env.MYSQL_DATABASE,connectionLimit:4,charset:'utf8mb4',timezone:'Z',connectTimeout:10000,ssl:env.MYSQL_SSL==='true'?{rejectUnauthorized:true,minVersion:'TLSv1.2',verifyIdentity:true}:undefined});
  }
  /** 建立缺失的表；数据库不可用时启动失败，不降级成浏览器存储。 */
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS readings (
      id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      owner_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
      note JSON NOT NULL, revision INT UNSIGNED NOT NULL DEFAULT 1,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [columns] = await this.pool.query<RowDataPacket[]>("SHOW COLUMNS FROM readings LIKE 'owner_id'");
    if (!columns.length) await this.pool.query('ALTER TABLE readings ADD COLUMN owner_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL');
    const [indexes] = await this.pool.query<RowDataPacket[]>("SHOW INDEX FROM readings WHERE Key_name='readings_owner'");
    if (!indexes.length) await this.pool.query('CREATE INDEX readings_owner ON readings (owner_id, updated_at)');
  }
  /** 读取完整事实和对话，同时返回用于并发检查的版本。 */
  async get(id: string, ownerId: string): Promise<Note|null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT note, revision FROM readings WHERE id=? AND owner_id=?',[id,owner(ownerId)]);
    return rows[0] ? {...rows[0].note,revision:rows[0].revision} : null;
  }
  /** 返回全部札记，避免旧版最近 60 条上限造成数据丢失。 */
  async list(ownerId: string): Promise<Note[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT note, revision FROM readings WHERE owner_id=? ORDER BY updated_at DESC,id',[owner(ownerId)]);
    return rows.map(row=>({...row.note,revision:row.revision}));
  }
  /** 新记录或旧数据导入只插入缺失 ID；绝不覆盖数据库已有内容。 */
  async insert(note: Note, ownerId: string) {
    await this.pool.execute('INSERT INTO readings (id,note,owner_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE id=id',[note.id,JSON.stringify(note),owner(ownerId)]);
    const saved = await this.get(note.id,ownerId);
    if (!saved) throw new Error('记录无效，请使用自己的札记');
    return saved;
  }
  /** 完整回复和追问原子落库；版本冲突时保留原数据并明确报错。 */
  async save(note: Note, ownerId: string) {
    const [result] = await this.pool.execute<ResultSetHeader>('UPDATE readings SET note=?,revision=revision+1 WHERE id=? AND revision=? AND owner_id=?',[JSON.stringify(note),note.id,note.revision??0,owner(ownerId)]);
    if (result.affectedRows!==1) throw new Error('札记已被修改或删除，请刷新后重试');
    return {...note,revision:note.revision!+1};
  }
  /** 显式删除指定札记，参数绑定防止 ID 被当作 SQL。 */
  async remove(id: string, ownerId: string) { await this.pool.execute('DELETE FROM readings WHERE id=? AND owner_id=?',[id,owner(ownerId)]); }
  /** 用户明确确认后清空札记，不使用 TRUNCATE 或修改表结构。 */
  async clear(ownerId: string) { await this.pool.execute('DELETE FROM readings WHERE owner_id=?',[owner(ownerId)]); }
  /** 测试和正常退出时释放连接。 */
  async close() { await this.pool.end(); }
}
