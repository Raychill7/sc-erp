import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const r = Router();

r.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const kw = (req.query.keyword || '').trim();
    let where = 'WHERE 1=1';
    const params = [];
    if (kw) {
      where += ` AND (action LIKE ? OR detail LIKE ? OR username LIKE ?)`;
      const k = `%${kw}%`;
      params.push(k, k, k);
    }
    const [rows] = await pool.query(
      `SELECT * FROM operation_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const [cnt] = await pool.query(`SELECT COUNT(*) AS c FROM operation_logs ${where}`, params);
    res.json({ list: rows, total: cnt[0].c, page, pageSize });
  } catch (e) {
    next(e);
  }
});

export default r;
