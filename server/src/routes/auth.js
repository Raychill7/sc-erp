import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { signToken, authMiddleware } from '../middleware/auth.js';
import { logOperation } from '../utils/audit.js';

const r = Router();

r.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: '请输入用户名和密码' });
    }
    const [rows] = await pool.query(
      'SELECT id, username, password_hash, display_name, role, status FROM users WHERE username = ?',
      [username]
    );
    if (!rows.length || !rows[0].status) {
      return res.status(400).json({ message: '用户名或密码错误' });
    }
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(400).json({ message: '用户名或密码错误' });
    const user = {
      id: rows[0].id,
      username: rows[0].username,
      name: rows[0].display_name,
      role: rows[0].role,
    };
    const token = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.name,
    });
    await logOperation({
      userId: user.id,
      username: user.username,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      detail: '用户登录',
    });
    res.json({ token, user });
  } catch (e) {
    next(e);
  }
});

r.get('/me', authMiddleware, async (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    name: req.user.name,
    role: req.user.role,
  });
});

export default r;
