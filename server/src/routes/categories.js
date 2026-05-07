import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logOperation } from '../utils/audit.js';

const r = Router();

r.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, sort_order FROM material_categories ORDER BY sort_order ASC, id ASC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.post('/', requireRole('admin', 'purchaser'), async (req, res, next) => {
  try {
    const { name, sortOrder } = req.body || {};
    if (!name) return res.status(400).json({ message: '分类名称必填' });
    const [r2] = await pool.query(`INSERT INTO material_categories (name, sort_order) VALUES (?,?)`, [
      name,
      Number(sortOrder) || 0,
    ]);
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'category_create',
      entityType: 'material_category',
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
    const { name, sortOrder } = req.body || {};
    await pool.query(`UPDATE material_categories SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order) WHERE id = ?`, [
      name ?? null,
      sortOrder != null ? Number(sortOrder) : null,
      id,
    ]);
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'category_update',
      entityType: 'material_category',
      entityId: id,
      detail: name || '',
    });
    res.json({ message: '已保存' });
  } catch (e) {
    next(e);
  }
});

r.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM material_categories WHERE id = ?`, [id]);
    res.json({ message: '已删除' });
  } catch (e) {
    next(e);
  }
});

export default r;
