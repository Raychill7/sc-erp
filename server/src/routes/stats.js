import { Router } from 'express';
import { pool } from '../db.js';

const r = Router();

/** 采购金额趋势 + 供应商占比 + 采购单完成率 */
r.get('/dashboard', async (req, res, next) => {
  try {
    const range = req.query.range || 'month';
    const now = new Date();
    let start;
    if (range === 'day') {
      start = new Date(now);
      start.setDate(start.getDate() - 30);
    } else if (range === 'quarter') {
      start = new Date(now);
      start.setMonth(start.getMonth() - 12);
    } else {
      start = new Date(now);
      start.setMonth(start.getMonth() - 12);
    }
    const startStr = start.toISOString().slice(0, 10);

    const [byDay] = await pool.query(
      `SELECT DATE(created_at) AS d, COALESCE(SUM(total_amount),0) AS amt
       FROM purchase_orders WHERE status <> 'void' AND created_at >= ? GROUP BY DATE(created_at) ORDER BY d ASC`,
      [startStr]
    );

    const [bySupplier] = await pool.query(
      `SELECT s.full_name AS name, COALESCE(SUM(po.total_amount),0) AS value
       FROM purchase_orders po INNER JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.status <> 'void' AND po.created_at >= ?
       GROUP BY po.supplier_id, s.full_name ORDER BY value DESC LIMIT 10`,
      [startStr]
    );

    const [cnt] = await pool.query(
      `SELECT
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS done_cnt,
         COUNT(*) AS all_cnt
       FROM purchase_orders WHERE status <> 'void' AND created_at >= ?`,
      [startStr]
    );
    const allCnt = Number(cnt[0].all_cnt) || 0;
    const doneCnt = Number(cnt[0].done_cnt) || 0;
    const completionRate = allCnt ? Math.round((doneCnt / allCnt) * 1000) / 10 : 0;

    res.json({
      range,
      amountTrend: byDay,
      supplierShare: bySupplier,
      completionRate,
      completedOrders: doneCnt,
      totalOrders: allCnt,
    });
  } catch (e) {
    next(e);
  }
});

/** 应付台账：按供应商汇总（按采购单行累计实收金额 - 已分摊付款） */
r.get('/payables', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id AS supplier_id, s.full_name,
        COALESCE(o.accrued, 0) AS accrued,
        COALESCE(p.paid, 0) AS paid
       FROM suppliers s
       LEFT JOIN (
         SELECT po.supplier_id AS sid, SUM(x.line_accrued) AS accrued
         FROM purchase_orders po
         INNER JOIN (
           SELECT order_id, SUM(LEAST(received_qty, qty) * unit_price) AS line_accrued
           FROM purchase_order_lines GROUP BY order_id
         ) x ON x.order_id = po.id
         WHERE po.status <> 'void'
         GROUP BY po.supplier_id
       ) o ON o.sid = s.id
       LEFT JOIN (
         SELECT po.supplier_id AS sid, SUM(a.amount) AS paid
         FROM payment_order_allocations a
         INNER JOIN purchase_orders po ON po.id = a.order_id
         GROUP BY po.supplier_id
       ) p ON p.sid = s.id
       HAVING accrued > 0 OR paid > 0
       ORDER BY (accrued - paid) DESC`
    );
    const result = rows.map((r) => ({
      supplierId: r.supplier_id,
      supplierName: r.full_name,
      accrued: Number(r.accrued),
      paid: Number(r.paid),
      unpaid: Math.max(Number(r.accrued) - Number(r.paid), 0),
    }));
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default r;
