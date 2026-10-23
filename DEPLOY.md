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
| `MODEL_CONFIG_SECRET` | 必填，64 位十六进制配置加密密钥；多个部署必须相同，不能丢失或随意更换 |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 接入小程序时在服务端填写；未填写不影响网页，微信登录会提示尚未配置 |
| `VISION_MODEL_BASE_URL` / `VISION_MODEL_NAME` / `VISION_MODEL_API_KEY` | 可选图片模型初始配置；未配置时手相 AI 不可用 |

无需复制本机 `.env` 或 `.local` 到云端，也不要在 Render 填本机 MySQL root 密码。默认域名使用平台自动提供的 `RENDER_EXTERNAL_URL`，无需填写 `PUBLIC_ORIGIN`，也无需手填 `PORT`。

TiDB 的 Public Endpoint 防火墙需要允许 Render 的出口 IP 地址段。在 Render 服务的连接信息中查看 **Outbound** 地址，再把相应 CIDR 加入 TiDB 的 Allowed IP Rules。如果首次启动因数据库连接超时失败，配置好网络规则后手动重新部署。

## 4. 验证上线

部署日志出现“清和已启动”，状态变为 Live 后，访问服务的 `https://…onrender.com` 地址。

1. 点击右上角“登录 / 注册”，注册普通用户，生成一条札记。
2. 点击 AI 解读，输入 `AI_INITIAL_CODE`，确认模型回复和札记保存正常。
3. 退出用户后，用 `admin` 和 `ADMIN_INITIAL_PASSWORD` 登录管理页；修改密码和访问码。
4. 通过 Render 手动重启服务，确认普通账号和札记仍在，且修改后的管理员密码和访问码仍有效。

管理员和访问码的盐及哈希保存在 TiDB `app_settings` 表；初始化环境变量只在该表首次创建配置时使用，后续不会覆盖管理员修改。原本本机的用户、札记、管理员密码不会自动上传到 TiDB。AI 和管理员的内存会话在重启/休眠后失效，需要重新验证；普通用户登录会话保存在数据库，有效期固定 24 小时。

网页和小程序可使用同一后端，也可分开部署并共用数据库。模型配置和访问码从共享数据库刷新；多个部署必须使用相同 `MODEL_CONFIG_SECRET`。每个服务仍应保持单实例、单进程：管理员与 AI 临时会话、错误尝试限流和两并发上限按进程生效，没有改成分布式会话或全局配额。微信和普通网页用户的登录会话在数据库中。更换域名时，在 Render 设置 `PUBLIC_ORIGIN=https://你的新域名` 并重新部署；网页写请求只允许该固定来源，小程序使用独立 Bearer 身份。

升级前先生成并保存 `MODEL_CONFIG_SECRET`：`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`，只填入服务端环境变量，不提交到 Git。本版首次启动将环境变量中的模型参数加密导入 `app_settings` 的 `models` 行；此后以管理页保存值为准，重启或更改旧环境变量不会覆盖数据库配置。密钥留空保存表示保留原 Key。丢失配置加密密钥后不能解密已有模型密钥，请安全备份。

新版本新增 `wechat_users`、`wechat_sessions` 表，并复用 `app_settings`。部署账号需要建表权限；如果现有应用账号无 DDL 权限，应先由迁移账号在目标数据库完成表初始化，不要把本机应用直接指向线上执行迁移。没有改动旧网页用户或自动迁移札记。

小程序导入、微信管理员指定及体验版域名条件见 [MINIPROGRAM.md](MINIPROGRAM.md)。`render.yaml` 仍跟踪 `master`；当前功能分支须显式选择 `codex/wechat-miniprogram` 才能部署此实现，不会由本地编辑自动上线。

## 官方参考

- [TiDB 免费实例创建与支出上限](https://docs.pingcap.com/tidbcloud/create-tidb-cluster-serverless/)
- [TiDB Public Endpoint 连接](https://docs.pingcap.com/tidbcloud/connect-via-standard-connection-serverless/)
- [TiDB 与 node-mysql2、TLS](https://docs.pingcap.com/tidb/stable/dev-guide-sample-application-nodejs-mysql2/)
- [Render 免费实例限制](https://render.com/docs/free)
- [Render Blueprint 配置](https://render.com/docs/blueprint-spec)
