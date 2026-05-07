# 公网部署说明

我无法替你登录云厂商或执行 SSH；你可以按下面步骤在自己的服务器上完成部署。

## 方式一：Docker Compose（推荐）

前提：服务器已安装 **Docker** 与 **Docker Compose v2**。

1. 把本仓库代码上传到服务器（git clone 或打包上传）。
2. 复制环境变量模板：
   ```bash
   cp deploy/env.docker.example .env
   ```
3. 编辑根目录 `.env`：设置 **`MYSQL_ROOT_PASSWORD`**、**`JWT_SECRET`**（务必改为随机强密码，不要用示例值）。
4. 在项目根目录执行：
   ```bash
   docker compose up -d --build
   ```
5. 浏览器访问 **`http://服务器公网IP:3000`**（若改了 `APP_PORT` 则用对应端口）。
6. 默认登录：**admin / admin123**，登录后请立即修改密码。

数据持久化：MySQL 与上传文件分别保存在 Docker 卷 **`mysql_data`**、**`app_uploads`**。

## HTTPS 与域名

Docker 只对外暴露 HTTP。生产环境建议在宿主机安装 **Nginx**（或 Caddy），配置 SSL 证书后反向代理到 `127.0.0.1:3000`。可参考仓库内 **`deploy/nginx.example.conf`**，将域名与证书路径改成你自己的。

## 方式二：不用 Docker

在 Linux 上安装 Node.js、MySQL、Nginx，本地执行 `client` 的 `npm run build`，将 `client/dist` 交给 Nginx 托管，并把 `/api`、`/uploads` 代理到 Node 进程（可用 PM2 守护）。细节与注意事项见根目录 **README.md** 中的生产部署摘要。

## 安全清单

- 修改默认管理员密码；**JWT_SECRET**、数据库密码仅保存在服务器 **`.env`**，勿提交到 Git。
- 防火墙仅开放 **80、443**（及你映射的应用端口）；不要将 MySQL 端口暴露到公网。
- 定期备份数据库与 `uploads`（上传附件）。
