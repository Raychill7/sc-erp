import { pool } from '../db.js';

/**
 * 记录操作日志，供审计追溯
 */
export async function logOperation({ userId, username, action, entityType, entityId, detail }) {
  await pool.query(
    `INSERT INTO operation_logs (user_id, username, action, entity_type, entity_id, detail)
     VALUES (:userId, :username, :action, :entityType, :entityId, :detail)`,
    {
      userId: userId || null,
      username: username || '',
      action,
      entityType: entityType || '',
      entityId: entityId != null ? String(entityId) : '',
      detail: (detail || '').slice(0, 1000),
    }
  );
}
