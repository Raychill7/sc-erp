import { pool } from '../db.js';

/**
 * 按供应商与收货日期区间计算对账预览数据
 */
export async function buildReconciliationPreview(supplierId, from, to) {
  const [orders] = await pool.query(
    `SELECT DISTINCT po.id, po.order_no, po.status, po.total_amount, po.created_at
     FROM purchase_orders po
     INNER JOIN receipts r ON r.order_id = po.id
     WHERE po.supplier_id = ? AND po.status <> 'void'
       AND r.receive_date >= ? AND r.receive_date <= ?
     ORDER BY po.id ASC`,
    [supplierId, from, to]
  );

  const lines = [];
  for (const o of orders) {
    const [pols] = await pool.query(
      `SELECT id, material_name, spec, qty, unit_price, received_qty, line_amount FROM purchase_order_lines WHERE order_id = ?`,
      [o.id]
    );
    let orderAccrued = 0;
    for (const ln of pols) {
      const accrued = Math.min(Number(ln.received_qty), Number(ln.qty)) * Number(ln.unit_price);
      orderAccrued += accrued;
    }
    const [paidRows] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS p FROM payment_order_allocations WHERE order_id = ?`,
      [o.id]
    );
    const paid = Number(paidRows[0].p);
    const unpaid = Math.max(orderAccrued - paid, 0);
    lines.push({
      orderId: o.id,
      orderNo: o.order_no,
      accruedAmount: orderAccrued,
      paidAmount: paid,
      unpaidAmount: unpaid,
    });
  }

  const [payRows] = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS p FROM payments WHERE supplier_id = ? AND pay_date >= ? AND pay_date <= ?`,
    [supplierId, from, to]
  );
  const totalPaidInPeriod = Number(payRows[0].p);

  const accruedSum = lines.reduce((s, x) => s + x.accruedAmount, 0);
  const paidAllocated = lines.reduce((s, x) => s + x.paidAmount, 0);
  const totalUnpaid = Math.max(accruedSum - paidAllocated, 0);

  return {
    supplierId,
    periodStart: from,
    periodEnd: to,
    lines,
    totalPayable: accruedSum,
    totalPaidAllocated: paidAllocated,
    totalUnpaid,
    totalPaidInPeriod,
  };
}
