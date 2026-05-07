import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import supplierRoutes from './routes/suppliers.js';
import materialRoutes from './routes/materials.js';
import categoryRoutes from './routes/categories.js';
import configRoutes from './routes/config.js';
import prRoutes from './routes/purchaseRequests.js';
import poRoutes from './routes/purchaseOrders.js';
import receiptRoutes from './routes/receipts.js';
import paymentRoutes from './routes/payments.js';
import reconRoutes from './routes/reconciliation.js';
import statsRoutes from './routes/stats.js';
import logRoutes from './routes/logs.js';
import uploadRoutes from './routes/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadAbs = path.resolve(__dirname, '../', config.uploadDir);
if (!fs.existsSync(uploadAbs)) fs.mkdirSync(uploadAbs, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadAbs));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/config', authMiddleware, configRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/suppliers', authMiddleware, supplierRoutes);
app.use('/api/materials', authMiddleware, materialRoutes);
app.use('/api/material-categories', authMiddleware, categoryRoutes);
app.use('/api/purchase-requests', authMiddleware, prRoutes);
app.use('/api/purchase-orders', authMiddleware, poRoutes);
app.use('/api/receipts', authMiddleware, receiptRoutes);
app.use('/api/payments', authMiddleware, paymentRoutes);
app.use('/api/reconciliation', authMiddleware, reconRoutes);
app.use('/api/stats', authMiddleware, statsRoutes);
app.use('/api/logs', authMiddleware, logRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);

// 生产环境：存在 public/（Docker 或手动 npm run build 复制）时托管前端静态资源
const publicDir = path.resolve(__dirname, '../public');
if (fs.existsSync(path.join(publicDir, 'index.html'))) {
  app.use(express.static(publicDir));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  const code = err.statusCode || 500;
  res.status(code).json({ message: err.message || '服务器错误' });
});

app.listen(config.port, () => {
  console.log(`SC-ERP API 运行于 http://localhost:${config.port}`);
});
