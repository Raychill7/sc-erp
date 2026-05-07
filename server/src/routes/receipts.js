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
    const orderId = req.query.orderId;
    let sql = `SELECT r.*, po.order_no FROM receipts r INNER JOIN purchase_orders po ON po.id=r.order_id WHERE 1=1`;
    const params = [];
    if (orderId) {
      sql += ` AND r.order_id = ?`;
      params.push(Number(orderId));
    }
    sql += ` ORDER BY r.id DESC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** 必须在 /:id 之前注册，避免被当成 id */
r.get('/stock-in/list', async (req, res, next) => {
  try {
    const { materialId, from, to } = req.query;
    let sql = `SELECT si.* FROM stock_in_records si WHERE 1=1`;
    const params = [];
    if (materialId) {
      sql += ` AND si.material_id = ?`;
      params.push(Number(materialId));
    }
    if (from) {
      sql += ` AND si.in_date >= ?`;
      params.push(from);
    }
    if (to) {
      sql += ` AND si.in_date <= ?`;
      params.push(to);
    }
    sql += ` ORDER BY si.id DESC LIMIT 500`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [heads] = await pool.query(`SELECT r.*, po.order_no FROM receipts r INNER JOIN purchase_orders po ON po.id=r.order_id WHERE r.id=?`, [id]);
    if (!heads.length) return res.status(404).json({ message: '收货单不存在' });
    const [lines] = await pool.query(
      `SELECT rl.*, pol.material_name, pol.spec, pol.qty AS order_qty, pol.unit_price
       FROM receipt_lines rl
       INNER JOIN purchase_order_lines pol ON pol.id = rl.order_line_id
       WHERE rl.receipt_id = ?`,
      [id]
    );
    res.json({ ...heads[0], lines });
  } catch (e) {
    next(e);
  }
});

/**
 * 收货登记：校验累计实收不超过采购数量；合格数量写入简易入库
 */
r.post('/', requireRole('admin', 'purchaser'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const orderId = Number(b.orderId);
    if (!orderId) return res.status(400).json({ message: '采购单必填' });
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length) return res.status(400).json({ message: '请填写收货明细' });

    const [ords] = await conn.query(`SELECT id, status FROM purchase_orders WHERE id=?`, [orderId]);
    if (!ords.length) return res.status(404).json({ message: '采购单不存在' });
    if (ords[0].status === 'void') return res.status(400).json({ message: '采购单已作废' });

    await conn.beginTransaction();

    const [pols] = await conn.query(`SELECT id, qty, received_qty FROM purchase_order_lines WHERE order_id=? FOR UPDATE`, [orderId]);
    const byId = Object.fromEntries(pols.map((p) => [p.id, p]));

    for (const ln of lines) {
      const olid = Number(ln.orderLineId);
      const row = byId[olid];
      if (!row) {
        const err = new Error('明细行不属于该采购单');
        err.statusCode = 400;
        throw err;
      }
      assertNonNegativeDecimal(ln.qtyReceived, '实收数量');
      const add = Number(ln.qtyReceived);
      const max = Number(row.qty);
      const cur = Number(row.received_qty);
      if (cur + add - 1e-9 > max) {
        const err = new Error(`物料行 ${olid} 累计收货不能超过采购数量 ${max}`);
        err.statusCode = 400;
        throw err;
      }
    }

    const receiptNo = await generateDocumentNo('RC');
    const [ins] = await conn.query(
      `INSERT INTO receipts (receipt_no, order_id, receive_date, abnormal_note, created_by) VALUES (?,?,?,?,?)`,
      [receiptNo, orderId, b.receiveDate || new Date().toISOString().slice(0, 10), b.abnormalNote || '', req.user.id]
    );
    const rid = ins.insertId;

    for (const ln of lines) {
      const olid = Number(ln.orderLineId);
      const add = Number(ln.qtyReceived);
      if (add === 0) continue;
      const inspection = ['qualified', 'unqualified', 'defective'].includes(ln.inspection) ? ln.inspection : 'qualified';
      const [rHeader] = await conn.query(
        `INSERT INTO receipt_lines (receipt_id, order_line_id, qty_received, inspection, line_remark) VALUES (?,?,?,?,?)`,
        [rid, olid, add, inspection, ln.lineRemark || '']
      );
      const rlineId = rHeader.insertId;

      await conn.query(`UPDATE purchase_order_lines SET received_qty = received_qty + ? WHERE id=?`, [add, olid]);

      if (inspection === 'qualified') {
        const [polRow] = await conn.query(`SELECT material_id, material_name FROM purchase_order_lines WHERE id=?`, [olid]);
        await conn.query(
          `INSERT INTO stock_in_records (receipt_line_id, material_id, material_name, qty, in_date) VALUES (?,?,?,?,?)`,
          [rlineId, polRow[0].material_id, polRow[0].material_name, add, b.receiveDate || new Date().toISOString().slice(0, 10)]
        );
      }
    }

    await conn.query(`UPDATE purchase_orders SET shipped_flag = 1 WHERE id=?`, [orderId]);
    await refreshPurchaseOrderStatus(conn, orderId);

    await conn.commit();
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'receipt_create',
      entityType: 'receipt',
      entityId: rid,
      detail: receiptNo,
    });
    res.json({ id: rid, receiptNo });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

export default r;
