import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logOperation } from '../utils/audit.js';

const r = Router();

r.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, display_name AS name, role, status, created_at FROM users ORDER BY id ASC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { username, password, name, role } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: '用户名与密码必填' });
    if (!['admin', 'purchaser', 'finance'].includes(role)) {
      return res.status(400).json({ message: '角色无效' });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, display_name, role, status) VALUES (?,?,?,?,1)`,
      [username, hash, name || username, role]
    );
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'user_create',
      entityType: 'user',
      entityId: username,
      detail: `新增用户 ${username} 角色 ${role}`,
    });
    res.json({ message: '创建成功' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: '用户名已存在' });
    next(e);
  }
});

r.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, role, status, password } = req.body || {};
    const fields = [];
    const vals = [];
    if (name != null) {
      fields.push('display_name = ?');
      vals.push(name);
    }
    if (role != null) {
      if (!['admin', 'purchaser', 'finance'].includes(role)) {
        return res.status(400).json({ message: '角色无效' });
      }
      fields.push('role = ?');
      vals.push(role);
    }
    if (status != null) {
      fields.push('status = ?');
      vals.push(status ? 1 : 0);
    }
    if (password) {
      fields.push('password_hash = ?');
      vals.push(await bcrypt.hash(password, 10));
    }
    if (!fields.length) return res.status(400).json({ message: '无更新字段' });
    vals.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'user_update',
      entityType: 'user',
      entityId: id,
      detail: '编辑用户',
    });
    res.json({ message: '已保存' });
  } catch (e) {
    next(e);
  }
});

export default r;
