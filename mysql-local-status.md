# 本机 MySQL 安装状态

日期：2026-10-22。

- 安装方式：Homebrew `mysql@8.4`。
- 已安装版本：MySQL Server 8.4.13（Apple Silicon / arm64）。
- 服务端目录：`/opt/homebrew/opt/mysql@8.4/bin`。
- 数据目录：`/opt/homebrew/var/mysql`。
- 原来仅安装了 mysql-client 9.7.1；保留原客户端及 PATH，不替换其全局命令。
- 实际验证：独立 Socket、`--skip-networking`、关闭 MySQL X；执行 SELECT 返回版本 `8.4.13`、`@@skip_networking=1`、实际本机数据目录。随后 mysqladmin 正常关闭验证实例。
- 未设置开机启动、未启动常驻数据库服务、未开放 TCP。

Homebrew 已初始化默认数据目录，默认 root 账号尚未设密码。正式启用前应完成账号密码配置，并为清和创建仅访问自己数据库的应用账号；不要直接以无密码 root 接入应用。

当前工程尚未接入数据库，历史记录仍是浏览器 localStorage，不能视为已有 MySQL 数据备份。本轮完成安装与真实本地启动/连接验证，下一阶段再做数据库表结构、应用账号和读写迁移。

后续管理应显式使用 `/opt/homebrew/opt/mysql@8.4/bin/` 下的工具，以避免 PATH 中现有 9.7.1 客户端覆盖版本。不要复用其他工程或共享环境的数据源配置。
