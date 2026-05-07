# 采购链 P2P 简化版供应链闭环 ERP

面向中小企业的轻量化 **采购申请 → 审核 → 下单 → 收货 → 对账 → 付款** 全流程系统。技术栈：**Vue 3 + Element Plus**、**Node.js + Express**、**MySQL**。

## 目录结构

- `database/schema.sql`：建表脚本  
- `database/seed.sql`：可选示例分类（管理员请用 `npm run seed`）  
- `server/`：REST API 服务  
- `client/`：管理后台前端  

## 环境要求

- Node.js 18+  
- MySQL 8.0+（或 5.7+，需支持 JSON 类型）  

## 一、数据库初始化

1. 创建数据库：

```sql
CREATE DATABASE sc_erp DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 导入表结构：

```bash
mysql -u root -p sc_erp < database/schema.sql
```

3. 配置服务端环境变量：复制 `server/.env.example` 为 `server/.env`，修改 `DB_PASSWORD`、`JWT_SECRET` 等。

4. 初始化管理员（默认 **admin / admin123**）：

```bash
cd server
npm install
npm run seed
```

## 二、启动后端

```bash
cd server
npm start
```

默认端口：`http://localhost:3000`  
健康检查：`GET http://localhost:3000/api/health`  

上传文件目录：`server/uploads`（相对 `server` 工作目录）。

## 三、启动前端

```bash
cd client
npm install
npm run dev
```

开发环境默认 `http://localhost:5173`，通过 Vite 代理转发 `/api` 与 `/uploads` 到后端。

生产构建：

```bash
cd client
npm run build
```

将 `client/dist` 静态文件交由 Nginx / IIS 托管，并将 `/api`、`/uploads` 反向代理到 Node 服务。

## 四、角色说明

| 角色 | 说明 |
|------|------|
| admin | 全部功能、用户与基础配置 |
| purchaser | 供应商、物料、申请、下单、收货、对账预览/快照 |
| finance | 看板、入库流水、对账、付款、应付台账 |

## 五、打印 / PDF

各页面提供「打印」或使用浏览器 **打印 → 另存为 PDF**。采购单、收货单、对账单、入库列表均支持 `window.print()` 友好版式。

## 六、核心业务说明摘要

- 采购申请仅 **草稿** 可改；**待审核** 由管理员/采购员通过或驳回；**已通过** 可生成采购单。  
- 采购单在 **无收货记录** 前可编辑、可作废；收货后状态随实收自动变更。  
- 收货行验收为 **合格** 的数量写入 **简易入库** 表，无仓位管理。  
- 付款可分摊到多张采购单；应付台账按「已收货金额 − 已分摊付款」汇总。  

## 公网部署（Docker / Nginx）

见仓库根目录 **[DEPLOY.md](./DEPLOY.md)**。

## 许可证

内部项目示例代码，按需修改使用。
