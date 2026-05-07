import { pool } from '../db.js';

/**
 * 根据明细行累计收货数量，回写采购单状态（不含已作废）
 */
export async function refreshPurchaseOrderStatus(conn, orderId) {
  const executor = conn || pool;
  const [orderRows] = await executor.query(`SELECT status FROM purchase_orders WHERE id = ?`, [orderId]);
  if (!orderRows.length || orderRows[0].status === 'void') return;

  const [lines] = await executor.query(
    `SELECT qty, received_qty FROM purchase_order_lines WHERE order_id = ?`,
    [orderId]
  );
  if (!lines.length) return;

  let allReceived = true;
  let anyReceived = false;
  for (const l of lines) {
    const rq = Number(l.received_qty);
    const q = Number(l.qty);
    if (rq > 0) anyReceived = true;
    if (rq + 1e-9 < q) allReceived = false;
  }

  let status = 'pending_ship';
  if (anyReceived && !allReceived) status = 'partial_shipped';
  else if (allReceived) {
    status = 'fully_shipped';
    // 若已全部收货，可标记完成（简化：全部收货即完成）
    status = 'completed';
  }

  await executor.query(
    `UPDATE purchase_orders SET status = ?, shipped_flag = ? WHERE id = ? AND status <> 'void'`,
    [status, anyReceived ? 1 : 0, orderId]
  );
}
