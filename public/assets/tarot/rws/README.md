# 韦特牌图来源与复现

- 牌组：Rider–Waite–Smith，78 张（22 大阿尔卡那、56 小阿尔卡那）。原绘：Pamela Colman Smith；设计：Arthur Edward Waite；原始出版：Rider & Company，1909 年。
- 下载来源：https://github.com/mixvlad/TarotCards/tree/840b84d012c6b74dc1634fa2d00d1b21f5b28093/tarot/rider-waite/720px
- 上游来源说明：https://github.com/mixvlad/TarotCards/blob/840b84d012c6b74dc1634fa2d00d1b21f5b28093/SOURCES.md
- 上游记载为 1909 Pam-A 牌组第三方扫描，经 Steve P. 清理与修复，来源 https://steve-p.org/cards/RWSa.html ，标注 Public Domain。此处记录的是图片素材的来源声明，不将仓库代码的 MIT 许可证套用到牌图。
- 工程使用 720px JPEG 原文件，仅重命名，没有裁切、重绘或改色；不包含上游额外的两张封面。
- `manifest.json` 保存固定提交、每张原始下载地址、中文名称、工程 ID、文件名及 SHA-256。
- 在工程根目录执行 `npm run assets:tarot` 可恢复缺失或损坏图片；校验一致的已有文件不会重新下载。需要联网，下载完成后运行页面无需再连接图片外站。
- `rws-0.jpg` 到 `rws-21.jpg` 为大阿尔卡那；22–35 权杖，36–49 圣杯，50–63 宝剑，64–77 星币。每个花色顺序为 Ace、2–10、Page、Knight、Queen、King。
- `public/tarot-images.js` 提供中文牌名到本地文件的白名单映射，兼容旧札记；刷新页面不改变原始抽牌和正逆位。
