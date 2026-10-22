# 免费部署：Render + TiDB Cloud

使用仓库 `PaulEternity/qinghe` 的 `master` 分支。`render.yaml` 只创建一个 Free Web Service，不创建收费数据库或磁盘。免费托管不包含 DeepSeek API 费用。Render 免费实例会休眠，唤醒需要等待；TiDB 额度用尽也可能暂停服务。

## 1. 创建数据库

在 TiDB Cloud 的 My TiDB 页面点 **Create Resource**：

- Plan：**Starter**。
- Compatibility Mode：**MySQL Compatible**。
- Name：`qinghe`。
- 可选区域：AWS Singapore，与本项目 Render 默认区域相同；若不可选，可选相邻可用区域。
- Spending Limit：**0**，不要启用付费扩容。

创建完成后打开 **Connect**，保持 Public，保存 Host、Port、完整 User（包括平台分配的前缀）和生成的 Password。这些是数据库登录信息，不是 TiDB API Key。

在数据库 SQL Editor 中执行：

```sql
CREATE DATABASE IF NOT EXISTS qinghe CHARACTER SET utf8mb4;
```

如果没有 SQL Editor，可以使用 Connect 提供的 MySQL 客户端连接方式执行同一条 SQL。不要将数据库密码提交到 GitHub。

## 2. 创建 Render 服务

推荐在 Render 选择 **New → Blueprint**，连接 GitHub 仓库 `PaulEternity/qinghe`，选择 `master`，使用根目录 `render.yaml`。核对服务价格为 **Free / $0** 后再创建。

如果使用 **New → Web Service** 手动创建，则填写：

| 配置 | 值 |
| --- | --- |
| Branch | `master` |
| Language / Runtime | Node |
| Region | Singapore（尽量和数据库接近） |
| Instance Type | Free |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |

手动创建时需额外设置 `NODE_VERSION=22.22.1`、`APP_MODE=cloud`、`MYSQL_SSL=true`。Blueprint 已包含这些值。

## 3. 填写环境变量

| 变量 | 填写内容 |
| --- | --- |
| `MYSQL_HOST` | TiDB Connect 中的 Host，不含 `https://` |
| `MYSQL_PORT` | Connect 中的 Port，通常 `4000` |
| `MYSQL_USER` | Connect 中完整的 User，包括前缀 |
| `MYSQL_PASSWORD` | TiDB 数据库密码 |
| `MYSQL_DATABASE` | `qinghe` |
| `ADMIN_INITIAL_PASSWORD` | 首次管理员密码，12—128 位；Blueprint 会自动生成，可在 Render 环境变量中查看并保存 |
| `AI_INITIAL_CODE` | 自己设置的六位数字，包含前导零也可 |
| `MODEL_BASE_URL` | `https://api.deepseek.com` |
| `MODEL_NAME` | `deepseek-flash`，或你实际有权调用的模型名 |
| `MODEL_API_KEY` | 你的 DeepSeek API Key |

无需复制本机 `.env` 或 `.local` 到云端，也不要在 Render 填本机 MySQL root 密码。默认域名使用平台自动提供的 `RENDER_EXTERNAL_URL`，无需填写 `PUBLIC_ORIGIN`，也无需手填 `PORT`。

TiDB 的 Public Endpoint 防火墙需要允许 Render 的出口 IP 地址段。在 Render 服务的连接信息中查看 **Outbound** 地址，再把相应 CIDR 加入 TiDB 的 Allowed IP Rules。如果首次启动因数据库连接超时失败，配置好网络规则后手动重新部署。

## 4. 验证上线

部署日志出现“清和已启动”，状态变为 Live 后，访问服务的 `https://…onrender.com` 地址。

1. 点击右上角“登录 / 注册”，注册普通用户，生成一条札记。
2. 点击 AI 解读，输入 `AI_INITIAL_CODE`，确认模型回复和札记保存正常。
3. 退出用户后，用 `admin` 和 `ADMIN_INITIAL_PASSWORD` 登录管理页；修改密码和访问码。
4. 通过 Render 手动重启服务，确认普通账号和札记仍在，且修改后的管理员密码和访问码仍有效。

管理员和访问码的盐及哈希保存在 TiDB `app_settings` 表；初始化环境变量只在该表首次创建配置时使用，后续不会覆盖管理员修改。原本本机的用户、札记、管理员密码不会自动上传到 TiDB。AI 和管理员的内存会话在重启/休眠后失效，需要重新验证；普通用户登录会话保存在数据库，有效期固定 24 小时。

当前支持单实例、单进程运行。不要为同一数据库启动多个并行副本：管理员与 AI 会话、尝试限流和模型并发控制保存在进程内存。更换域名时，在 Render 设置 `PUBLIC_ORIGIN=https://你的新域名` 并重新部署；只允许该固定来源。

## 官方参考

- [TiDB 免费实例创建与支出上限](https://docs.pingcap.com/tidbcloud/create-tidb-cluster-serverless/)
- [TiDB Public Endpoint 连接](https://docs.pingcap.com/tidbcloud/connect-via-standard-connection-serverless/)
- [TiDB 与 node-mysql2、TLS](https://docs.pingcap.com/tidb/stable/dev-guide-sample-application-nodejs-mysql2/)
- [Render 免费实例限制](https://render.com/docs/free)
- [Render Blueprint 配置](https://render.com/docs/blueprint-spec)
