#!/bin/zsh -l
# 启动本目录的个人服务，不写入全局配置或调用外部模型。
cd "${0:A:h}" || exit 1
if ! command -v node >/dev/null; then
  echo '未找到 Node.js，请安装 Node.js 22.19 或更高版本。'
  read -r '?按回车关闭'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  echo '请先在当前目录执行 npm ci 安装依赖。'
  read -r '?按回车关闭'
  exit 1
fi
echo '启动后请打开 http://127.0.0.1:3187 ，按 Ctrl+C 停止服务。'
npm start
