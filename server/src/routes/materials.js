import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logOperation } from '../utils/audit.js';

const r = Router();

r.get('/', async (req, res, next) => {
  try {
    const kw = (req.query.keyword || '').trim();
    const categoryId = req.query.categoryId;
    let sql = `SELECT m.id, m.code, m.name, m.spec, m.unit, m.category_id, m.status, c.name AS category_name
               FROM materials m LEFT JOIN material_categories c ON c.id = m.category_id WHERE 1=1`;
    const params = [];
    if (kw) {
      sql += ` AND (m.name LIKE ? OR m.spec LIKE ? OR m.code LIKE ?)`;
      const like = `%${kw}%`;
      params.push(like, like, like);
    }
    if (categoryId) {
      sql += ` AND m.category_id = ?`;
      params.push(Number(categoryId));
    }
    sql += ` ORDER BY m.id DESC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.post('/', requireRole('admin', 'purchaser'), async (req, res, next) => {
  try {
    const { code, name, spec, unit, categoryId } = req.body || {};
    if (!name) return res.status(400).json({ message: '物料名称必填' });
    const [r2] = await pool.query(
      `INSERT INTO materials (code, name, spec, unit, category_id) VALUES (?,?,?,?,?)`,
      [code || '', name, spec || '', unit || '件', categoryId || null]
    );
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'material_create',
      entityType: 'material',
      entityId: r2.insertId,
      detail: name,
    });
    res.json({ id: r2.insertId });
  } catch (e) {
    next(e);
  }
});

r.put('/:id', requireRole('admin', 'purchaser'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { code, name, spec, unit, categoryId, status } = req.body || {};
    if (!name) return res.status(400).json({ message: '物料名称必填' });
    await pool.query(
      `UPDATE materials SET code=?, name=?, spec=?, unit=?, category_id=?, status=? WHERE id=?`,
      [
        code ?? '',
        name,
        spec ?? '',
        unit ?? '件',
        categoryId ?? null,
        status == null ? 1 : status ? 1 : 0,
        id,
      ]
    );
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'material_update',
      entityType: 'material',
      entityId: id,
      detail: name || '',
    });
    res.json({ message: '已保存' });
  } catch (e) {
    next(e);
  }
});

export default r;
