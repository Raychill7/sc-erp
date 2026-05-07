import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logOperation } from '../utils/audit.js';
import { generateDocumentNo } from '../utils/docNo.js';
import { assertPositiveDecimal, assertNonNegativeDecimal } from '../utils/numbers.js';
import { refreshPurchaseOrderStatus } from '../utils/orderStatus.js';

const r = Router();

r.get('/', async (req, res, next) => {
  try {
    const { status, supplierId } = req.query;
    let sql = `SELECT po.*, s.full_name AS supplier_name FROM purchase_orders po
               INNER JOIN suppliers s ON s.id = po.supplier_id WHERE 1=1`;
    const params = [];
    if (status) {
      sql += ` AND po.status = ?`;
      params.push(status);
    }
    if (supplierId) {
      sql += ` AND po.supplier_id = ?`;
      params.push(Number(supplierId));
    }
    sql += ` ORDER BY po.id DESC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [heads] = await pool.query(`SELECT po.*, s.full_name AS supplier_name FROM purchase_orders po INNER JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?`, [id]);
    if (!heads.length) return res.status(404).json({ message: '采购单不存在' });
    const [lines] = await pool.query(`SELECT * FROM purchase_order_lines WHERE order_id=?`, [id]);
    res.json({ ...heads[0], lines });
  } catch (e) {
    next(e);
  }
});

/**
 * 由已审核通过的申请单生成采购单
 * body: { requestId, supplierId, deliveryDate, payMethod, remark?, lines: [{ requestLineId, unitPrice }] }
 */
r.post('/from-request', requireRole('admin', 'purchaser'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const requestId = Number(b.requestId);
    const supplierId = Number(b.supplierId);
    if (!requestId || !supplierId) return res.status(400).json({ message: '申请单与供应商必填' });
    const [reqRows] = await conn.query(`SELECT * FROM purchase_requests WHERE id=?`, [requestId]);
    if (!reqRows.length) return res.status(404).json({ message: '申请单不存在' });
    if (reqRows[0].status !== 'approved') {
      return res.status(400).json({ message: '仅审核通过的申请单可生成采购单' });
    }
    const [sup] = await conn.query(`SELECT id, status FROM suppliers WHERE id=?`, [supplierId]);
    if (!sup.length || !sup[0].status) return res.status(400).json({ message: '供应商无效或已禁用' });

    const [prLines] = await conn.query(`SELECT * FROM purchase_request_lines WHERE request_id=?`, [requestId]);
    if (!prLines.length) return res.status(400).json({ message: '申请单无明细' });

    const priceByLineId = {};
    for (const pl of b.lines || []) {
      if (pl.requestLineId != null) priceByLineId[Number(pl.requestLineId)] = Number(pl.unitPrice);
    }

    await conn.beginTransaction();
    const orderNo = await generateDocumentNo('PO');
    let total = 0;
    const linePayload = [];
    for (const ln of prLines) {
      const unitPrice = priceByLineId[ln.id] != null ? priceByLineId[ln.id] : Number(ln.est_unit_price);
      assertNonNegativeDecimal(unitPrice, '采购单价');
      if (Number(unitPrice) === 0) {
        const err = new Error('采购单价必须大于 0');
        err.statusCode = 400;
        throw err;
      }
      const qty = Number(ln.qty);
      assertPositiveDecimal(qty, '数量');
      const lineAmount = qty * unitPrice;
      total += lineAmount;
      linePayload.push({
        material_id: ln.material_id,
        material_name: ln.material_name,
        spec: ln.spec,
        qty,
        unit_price: unitPrice,
        line_amount: lineAmount,
      });
    }

    const [ins] = await conn.query(
      `INSERT INTO purchase_orders (order_no, request_id, supplier_id, delivery_date, pay_method, status, total_amount, remark, created_by)
       VALUES (?,?,?,?,?,'pending_ship',?,?,?)`,
      [
        orderNo,
        requestId,
        supplierId,
        b.deliveryDate || null,
        b.payMethod || '月结',
        total,
        b.remark || '',
        req.user.id,
      ]
    );
    const orderId = ins.insertId;
    for (const lp of linePayload) {
      await conn.query(
        `INSERT INTO purchase_order_lines (order_id, material_id, material_name, spec, qty, unit_price, line_amount)
         VALUES (?,?,?,?,?,?,?)`,
        [orderId, lp.material_id, lp.material_name, lp.spec, lp.qty, lp.unit_price, lp.line_amount]
      );
    }
    await conn.commit();
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'po_create',
      entityType: 'purchase_order',
      entityId: orderId,
      detail: orderNo,
    });
    res.json({ id: orderId, orderNo });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

/** 未发货前可编辑单价与交货日期等 */
r.put('/:id', requireRole('admin', 'purchaser'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const [heads] = await conn.query(`SELECT status, shipped_flag FROM purchase_orders WHERE id=?`, [id]);
    if (!heads.length) return res.status(404).json({ message: '采购单不存在' });
    if (heads[0].status === 'void') return res.status(400).json({ message: '已作废不可编辑' });
    if (heads[0].shipped_flag) return res.status(400).json({ message: '已有收货记录，不可编辑' });

    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : null;
    await conn.beginTransaction();
    await conn.query(
      `UPDATE purchase_orders SET supplier_id=COALESCE(?,supplier_id), delivery_date=?, pay_method=?, remark=? WHERE id=?`,
      [
        b.supplierId != null ? Number(b.supplierId) : null,
        b.deliveryDate ?? null,
        b.payMethod,
        b.remark ?? '',
        id,
      ]
    );
    let total = 0;
    if (lines && lines.length) {
      for (const ln of lines) {
        assertPositiveDecimal(ln.qty, '数量');
        assertNonNegativeDecimal(ln.unitPrice, '单价');
        if (Number(ln.unitPrice) === 0) {
          const err = new Error('单价必须大于 0');
          err.statusCode = 400;
          throw err;
        }
        const lineAmount = Number(ln.qty) * Number(ln.unitPrice);
        await conn.query(
          `UPDATE purchase_order_lines SET qty=?, unit_price=?, line_amount=? WHERE id=? AND order_id=?`,
          [ln.qty, ln.unitPrice, lineAmount, ln.id, id]
        );
      }
      const [sums] = await conn.query(
        `SELECT COALESCE(SUM(line_amount),0) AS t FROM purchase_order_lines WHERE order_id=?`,
        [id]
      );
      await conn.query(`UPDATE purchase_orders SET total_amount=? WHERE id=?`, [sums[0].t, id]);
    }
    await conn.commit();
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'po_update',
      entityType: 'purchase_order',
      entityId: id,
      detail: '编辑采购单',
    });
    res.json({ message: '已保存' });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

r.post('/:id/void', requireRole('admin', 'purchaser'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [heads] = await pool.query(`SELECT status, shipped_flag FROM purchase_orders WHERE id=?`, [id]);
    if (!heads.length) return res.status(404).json({ message: '采购单不存在' });
    if (heads[0].shipped_flag) return res.status(400).json({ message: '已有收货，不可作废' });
    await pool.query(`UPDATE purchase_orders SET status='void' WHERE id=?`, [id]);
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'po_void',
      entityType: 'purchase_order',
      entityId: id,
      detail: '作废采购单',
    });
    res.json({ message: '已作废' });
  } catch (e) {
    next(e);
  }
});

/** 管理端：重算状态（修复用） */
r.post('/:id/refresh-status', requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await refreshPurchaseOrderStatus(null, id);
    res.json({ message: 'ok' });
  } catch (e) {
    next(e);
  }
});

export default r;
