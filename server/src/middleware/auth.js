import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool } from '../db.js';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.display_name },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

export async function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未登录或令牌无效' });
  }
  const token = h.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const [rows] = await pool.query(
      'SELECT id, username, display_name AS name, role, status FROM users WHERE id = ?',
      [payload.id]
    );
    if (!rows.length || !rows[0].status) {
      return res.status(401).json({ message: '账号已禁用' });
    }
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ message: '登录已过期，请重新登录' });
  }
}

/** @param {string[]} roles */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: '未登录' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '无权限执行此操作' });
    }
    next();
  };
}
