# 本机 MySQL 状态

2026-10-22 已完成真实持久化接入。

- Homebrew MySQL Server 8.4.13；程序目录 `/opt/homebrew/opt/mysql@8.4/bin`，数据目录 `/opt/homebrew/var/mysql`。原有 9.7.1 客户端及 PATH 保持不变。
- 仅监听 `127.0.0.1:3307`；关闭 MySQL X，未设置开机启动。
- 数据库 `qinghe`，专用应用账号 `qinghe`，仅拥有本库 SELECT、INSERT、UPDATE、DELETE、CREATE 权限。root 已设置随机密码。
- 应用凭据 `.env`、管理凭据 `.local/mysql-admin.cnf` 均为本机私有忽略文件；不要提交或打包。
- `npm run db:start` 在当前终端常驻运行（另开终端启动应用），`npm run db:status` 检查，`npm run db:stop` 停止；`npm start` 启动应用。
- `readings` 表保存原始问题、盘面与规则、翻牌状态、解读、追问和请求 ID；不保存原始照片或模型 API Key。
- 真实 MySQL 集成测试使用模拟模型，通过 HTTP 验证写入、追问、应用实例关闭后重新连接读取、重复导入不覆盖、失败不改原文、过期版本拒绝及单条删除；命令 `npm run test:mysql`。

数据库持久化不等于备份。可在“我的札记”导出文本；删除和清空无法恢复。旧浏览器札记可显式导入，原数据不会自动删除。
