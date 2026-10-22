#!/bin/sh
# 清和 macOS 本机 MySQL 生命周期；与应用统一使用 3307，不设置开机启动。
set -eu
MYSQL_BIN=/opt/homebrew/opt/mysql@8.4/bin
MYSQL_RUN=/private/tmp/qinghe-mysql-01a16140
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
case "${1:-status}" in
  start)
    # 已运行时不重复拉起进程，避免两个实例争用同一数据目录。
    if "$MYSQL_BIN/mysqladmin" --defaults-extra-file="$PROJECT_DIR/.local/mysql-admin.cnf" ping >/dev/null 2>&1; then
      echo 'MySQL 已运行：127.0.0.1:3307'; exit 0
    fi
    mkdir -p "$MYSQL_RUN"
    chmod 700 "$MYSQL_RUN"
    echo 'MySQL 前台运行于 127.0.0.1:3307；请另开终端运行 npm start。'
    exec "$MYSQL_BIN/mysqld" --no-defaults --datadir=/opt/homebrew/var/mysql --bind-address=127.0.0.1 --port=3307 --mysqlx=OFF --socket="$MYSQL_RUN/mysql.sock" --pid-file="$MYSQL_RUN/mysql.pid" --log-error="$MYSQL_RUN/mysql.log"
    ;;
  stop) "$MYSQL_BIN/mysqladmin" --defaults-extra-file="$PROJECT_DIR/.local/mysql-admin.cnf" shutdown ;;
  status) "$MYSQL_BIN/mysqladmin" --defaults-extra-file="$PROJECT_DIR/.local/mysql-admin.cnf" ping ;;
  *) echo '用法：mysql-local.sh start|stop|status' >&2; exit 1 ;;
esac
