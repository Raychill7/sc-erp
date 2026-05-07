import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logOperation } from '../utils/audit.js';

const r = Router();

r.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT `key`, `value` FROM system_config');
    const map = {};
    for (const row of rows) {
      try {
        map[row.key] = JSON.parse(row.value);
      } catch {
        map[row.key] = row.value;
      }
    }
    res.json(map);
  } catch (e) {
    next(e);
  }
});

r.put('/', requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const entries = Object.entries(body);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const [key, val] of entries) {
        if (typeof key !== 'string' || !/^[a-zA-Z0-9_]+$/.test(key)) continue;
        const json = JSON.stringify(val);
        await conn.query(
          `INSERT INTO system_config (\`key\`, \`value\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
          [key, json]
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'config_update',
      entityType: 'system_config',
      entityId: '',
      detail: '更新基础配置',
    });
    res.json({ message: '配置已保存' });
  } catch (e) {
    next(e);
  }
});

export default r;
