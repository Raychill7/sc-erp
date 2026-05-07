import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logOperation } from '../utils/audit.js';
import { generateDocumentNo } from '../utils/docNo.js';
import { buildReconciliationPreview } from '../utils/reconciliationPreview.js';

const r = Router();

r.get('/preview', async (req, res, next) => {
  try {
    const supplierId = Number(req.query.supplierId);
    const from = req.query.from;
    const to = req.query.to;
    if (!supplierId || !from || !to) {
      return res.status(400).json({ message: 'supplierId、from、to 必填' });
    }
    const data = await buildReconciliationPreview(supplierId, from, to);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

r.post('/snapshot', requireRole('admin', 'finance', 'purchaser'), async (req, res, next) => {
  try {
    const supplierId = Number(req.body.supplierId);
    const from = req.body.from;
    const to = req.body.to;
    if (!supplierId || !from || !to) return res.status(400).json({ message: '参数不完整' });

    const data = await buildReconciliationPreview(supplierId, from, to);
    const snapshotNo = await generateDocumentNo('RS');
    await pool.query(
      `INSERT INTO reconciliation_snapshots (snapshot_no, supplier_id, period_start, period_end, total_payable, total_paid, total_unpaid, lines_json, created_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        snapshotNo,
        supplierId,
        from,
        to,
        data.totalPayable,
        data.totalPaidAllocated,
        data.totalUnpaid,
        JSON.stringify(data.lines),
        req.user.id,
      ]
    );
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'reconciliation_snapshot',
      entityType: 'reconciliation',
      entityId: snapshotNo,
      detail: `${from}~${to}`,
    });
    res.json({ snapshotNo, ...data });
  } catch (e) {
    next(e);
  }
});

r.get('/snapshots', async (req, res, next) => {
  try {
    const supplierId = req.query.supplierId;
    let sql = `SELECT rs.*, s.full_name AS supplier_name FROM reconciliation_snapshots rs
               INNER JOIN suppliers s ON s.id = rs.supplier_id ORDER BY rs.id DESC LIMIT 200`;
    const params = [];
    if (supplierId) {
      sql = `SELECT rs.*, s.full_name AS supplier_name FROM reconciliation_snapshots rs
             INNER JOIN suppliers s ON s.id = rs.supplier_id WHERE rs.supplier_id = ? ORDER BY rs.id DESC LIMIT 200`;
      params.push(Number(supplierId));
    }
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.get('/snapshots/:no', async (req, res, next) => {
  try {
    const no = req.params.no;
    const [rows] = await pool.query(`SELECT rs.*, s.full_name AS supplier_name FROM reconciliation_snapshots rs INNER JOIN suppliers s ON s.id=rs.supplier_id WHERE rs.snapshot_no=?`, [no]);
    if (!rows.length) return res.status(404).json({ message: '对账单不存在' });
    const row = rows[0];
    let lines = row.lines_json;
    if (typeof lines === 'string') lines = JSON.parse(lines);
    res.json({ ...row, lines });
  } catch (e) {
    next(e);
  }
});

export default r;
