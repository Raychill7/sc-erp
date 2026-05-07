import { pool } from '../db.js';

const pad = (n, len = 4) => String(n).padStart(len, '0');

/** 白名单：避免动态表名注入 */
const DOC_FIELDS = {
  purchase_requests: 'request_no',
  purchase_orders: 'order_no',
  receipts: 'receipt_no',
  reconciliation_snapshots: 'snapshot_no',
};

/**
 * @param {'PR'|'PO'|'RC'|'RS'} kind 单号前缀
 */
export async function generateDocumentNo(kind) {
  const prefixMap = { PR: 'PR', PO: 'PO', RC: 'RC', RS: 'RS' };
  const prefix = prefixMap[kind];
  const table =
    kind === 'PR'
      ? 'purchase_requests'
      : kind === 'PO'
        ? 'purchase_orders'
        : kind === 'RC'
          ? 'receipts'
          : 'reconciliation_snapshots';
  const field = DOC_FIELDS[table];
  const d = new Date();
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1, 2);
  const day = pad(d.getDate(), 2);
  const datePart = `${y}${m}${day}`;
  const pattern = `${prefix}${datePart}%`;
  const [rows] = await pool.query(
    `SELECT MAX(\`${field}\`) AS mx FROM \`${table}\` WHERE \`${field}\` LIKE ?`,
    [pattern]
  );
  const mx = rows[0]?.mx;
  let next = 1;
  if (mx && typeof mx === 'string') {
    const suffix = mx.slice(-4);
    const n = parseInt(suffix, 10);
    if (Number.isFinite(n)) next = n + 1;
  }
  return `${prefix}${datePart}${pad(next, 4)}`;
}
