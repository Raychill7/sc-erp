import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logOperation } from '../utils/audit.js';
import { assertPositiveDecimal } from '../utils/numbers.js';

const r = Router();

r.get('/', async (req, res, next) => {
  try {
    const { supplierId, from, to } = req.query;
    let sql = `SELECT p.*, s.full_name AS supplier_name FROM payments p
               INNER JOIN suppliers s ON s.id = p.supplier_id WHERE 1=1`;
    const params = [];
    if (supplierId) {
      sql += ` AND p.supplier_id = ?`;
      params.push(Number(supplierId));
    }
    if (from) {
      sql += ` AND p.pay_date >= ?`;
      params.push(from);
    }
    if (to) {
      sql += ` AND p.pay_date <= ?`;
      params.push(to);
    }
    sql += ` ORDER BY p.id DESC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.get('/:id/allocations', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT a.*, po.order_no FROM payment_order_allocations a
       INNER JOIN purchase_orders po ON po.id = a.order_id WHERE a.payment_id = ?`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * 付款登记 + 分摊到采购单（用于应付台账）
 */
r.post('/', requireRole('admin', 'finance'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const supplierId = Number(b.supplierId);
    assertPositiveDecimal(b.amount, '付款金额');
    const allocations = Array.isArray(b.allocations) ? b.allocations : [];
    if (!supplierId) return res.status(400).json({ message: '供应商必填' });
    let allocSum = 0;
    for (const a of allocations) {
      assertPositiveDecimal(a.amount, '分摊金额');
      allocSum += Number(a.amount);
    }
    if (allocations.length && Math.abs(allocSum - Number(b.amount)) > 0.01) {
      return res.status(400).json({ message: '分摊金额合计必须等于付款金额' });
    }

    await conn.beginTransaction();
    const [ins] = await conn.query(
      `INSERT INTO payments (supplier_id, pay_date, amount, pay_method, voucher_no, remark, created_by)
       VALUES (?,?,?,?,?,?,?)`,
      [
        supplierId,
        b.payDate || new Date().toISOString().slice(0, 10),
        b.amount,
        b.payMethod || '',
        b.voucherNo || '',
        b.remark || '',
        req.user.id,
      ]
    );
    const pid = ins.insertId;
    for (const a of allocations) {
      const oid = Number(a.orderId);
      const [ords] = await conn.query(`SELECT id, supplier_id FROM purchase_orders WHERE id=?`, [oid]);
      if (!ords.length || ords[0].supplier_id !== supplierId) {
        const err = new Error('分摊的采购单不属于该供应商');
        err.statusCode = 400;
        throw err;
      }
      await conn.query(`INSERT INTO payment_order_allocations (payment_id, order_id, amount) VALUES (?,?,?)`, [
        pid,
        oid,
        a.amount,
      ]);
    }
    await conn.commit();
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'payment_create',
      entityType: 'payment',
      entityId: pid,
      detail: `付款 ${b.amount}`,
    });
    res.json({ id: pid });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

export default r;
