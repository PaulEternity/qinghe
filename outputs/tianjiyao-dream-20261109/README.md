# 天机爻「周公解梦」逆向交付

目标：https://tianjiyao.com/zh/dream  
采集日期：2026-11-09（北京时间）  
工具：本机 REA 6.7.0、独立临时 Chrome 156 浏览器。

已恢复浏览器交付的前端脚本、输入字段、提交校验、登录入口、积分检查、SSE 流式处理和错误恢复逻辑。不是服务端源码，也不是可以直接启动的 React 源码工程；保留了 Webpack 模块和生产环境的压缩变量名。

## 文件入口

| 文件 | 内容 |
| --- | --- |
| `逆向分析.md` | 表单、调用链、状态、结果展示和恢复边界 |
| `接口与流式协议.md` | 请求头、requestId、SSE 事件、重试及恢复协议的详细静态证据 |
| `readable/dream-page.readable.js` | 解梦页面，模块 49442；登录弹窗入口和历史入口也在此文件 |
| `readable/4782-d4e77fd3cbbb5c25.readable.js` | /api/dream 传输层与问题预校验 |
| `readable/6680-ec385fcd0d9e53a6.readable.js` | 通用结果组件与 Markdown 展示 |
| `readable/9395-51f96b3ec854adb7.readable.js` | 身份认证依赖的生产脚本副本 |
| `scripts/files/` | REA 导出的 75 份原始脚本，约 3.6 MB |
| `scripts/manifest.json` | REA 生成的导出清单；URL、路径和内容摘要以实际文件为准 |
| `page.html` | 公开页面 HTML 快照；联网依赖未改写为离线资源 |
| `anonymous-login.png` | 匿名点击分析后出现的登录弹窗截图 |
| `anonymous-click.accessibility.txt` | 同次交互的可访问性文本 |
| `anonymous-verification.json` | 实测步骤、观察到的接口和采集完整性 |
| `verification.json` | 四份可读副本与原始脚本 AST 等价校验结果 |
| `evidence/` | REA 采集、导出、限定范围静态分析及匿名交互的原始 JSON 证据 |

## 已验证

1. REA 采集并导出了 75 份同站脚本，导出内容附带 SHA-256。
2. 限定两个关键文件执行 REA 静态分析：解析失败 0，恢复 23 个模块。未分析的 73 个文件仍保留在原始导出中。
3. 四份可读副本只做空白格式化，并用 Babel AST 对比验证语法结构及字面量未改变。
4. REA 实际执行了填写示例梦境、点击“分析梦境”、等待并采集结果。所有动作成功；出现“登录账户”弹窗，本次观察窗口内未出现 `/api/dream` 请求。
5. 公开费用接口实际返回 `credits_required=150`、`pro_credits_required=1`，见 `evidence/credit-cost.json`。这是采集时配置，不应当作为固定收费规则。

## 未恢复部分

- 未登录，因此没有生成真实解梦结果，也没有验证扣费或登录后的 SSE 响应。
- 服务端提示词、模型供应商、传统解梦词典、数据库结构和生成算法无法由这些客户端脚本确定。
- REA 的网络事件捕获报告存在未完成请求/部分内容不可用；匿名页面行为已验证，但不能宣称抓到了完整网络历史。
- 整站一次性 `analyze-web-bundle` 曾触发 Node 内存上限，交付使用后续成功的页面采集、脚本导出和两个文件的限定静态分析。

本次只新增逆向材料，没有接入晴禾业务代码，也没有提交或部署。
