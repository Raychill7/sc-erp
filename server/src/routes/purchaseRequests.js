import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logOperation } from '../utils/audit.js';
import { generateDocumentNo } from '../utils/docNo.js';
import { assertNonNegativeDecimal, assertPositiveDecimal } from '../utils/numbers.js';

const r = Router();

async function loadRequest(id) {
  const [heads] = await pool.query(`SELECT * FROM purchase_requests WHERE id = ?`, [id]);
  if (!heads.length) return null;
  const [lines] = await pool.query(`SELECT * FROM purchase_request_lines WHERE request_id = ?`, [id]);
  return { ...heads[0], lines };
}

r.get('/', async (req, res, next) => {
  try {
    const status = req.query.status;
    let sql = `SELECT pr.*, u.display_name AS applicant_name FROM purchase_requests pr
               LEFT JOIN users u ON u.id = pr.applicant_id WHERE 1=1`;
    const params = [];
    if (status) {
      sql += ` AND pr.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY pr.id DESC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.get('/:id', async (req, res, next) => {
  try {
    const data = await loadRequest(Number(req.params.id));
    if (!data) return res.status(404).json({ message: '申请单不存在' });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

/** 保存草稿或更新草稿 */
r.post('/', requireRole('admin', 'purchaser'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length) return res.status(400).json({ message: '请至少添加一行物料明细' });
    await conn.beginTransaction();
    const requestNo = await generateDocumentNo('PR');
    const [ins] = await conn.query(
      `INSERT INTO purchase_requests (request_no, dept_name, need_date, applicant_id, status)
       VALUES (?,?,?,?, 'draft')`,
      [requestNo, b.deptName || '', b.needDate || null, req.user.id]
    );
    const rid = ins.insertId;
    for (const ln of lines) {
      assertPositiveDecimal(ln.qty, '需求数量');
      assertNonNegativeDecimal(ln.estUnitPrice ?? 0, '预估单价');
      await conn.query(
        `INSERT INTO purchase_request_lines (request_id, material_id, material_name, spec, qty, est_unit_price, purpose_remark)
         VALUES (?,?,?,?,?,?,?)`,
        [rid, ln.materialId || null, ln.materialName, ln.spec || '', ln.qty, ln.estUnitPrice ?? 0, ln.purposeRemark || '']
      );
    }
    await conn.commit();
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'pr_create',
      entityType: 'purchase_request',
      entityId: rid,
      detail: requestNo,
    });
    res.json({ id: rid, requestNo });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

r.put('/:id', requireRole('admin', 'purchaser'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const [st] = await conn.query(`SELECT status FROM purchase_requests WHERE id = ?`, [id]);
    if (!st.length) return res.status(404).json({ message: '申请单不存在' });
    if (st[0].status !== 'draft') {
      return res.status(400).json({ message: '仅草稿可编辑' });
    }
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length) return res.status(400).json({ message: '请至少添加一行物料明细' });
    await conn.beginTransaction();
    await conn.query(
      `UPDATE purchase_requests SET dept_name=?, need_date=? WHERE id=?`,
      [b.deptName || '', b.needDate || null, id]
    );
    await conn.query(`DELETE FROM purchase_request_lines WHERE request_id=?`, [id]);
    for (const ln of lines) {
      assertPositiveDecimal(ln.qty, '需求数量');
      assertNonNegativeDecimal(ln.estUnitPrice ?? 0, '预估单价');
      await conn.query(
        `INSERT INTO purchase_request_lines (request_id, material_id, material_name, spec, qty, est_unit_price, purpose_remark)
         VALUES (?,?,?,?,?,?,?)`,
        [id, ln.materialId || null, ln.materialName, ln.spec || '', ln.qty, ln.estUnitPrice ?? 0, ln.purposeRemark || '']
      );
    }
    await conn.commit();
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'pr_update',
      entityType: 'purchase_request',
      entityId: id,
      detail: '更新草稿',
    });
    res.json({ message: '已保存' });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

/** 提交审核 */
r.post('/:id/submit', requireRole('admin', 'purchaser'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [st] = await pool.query(`SELECT status FROM purchase_requests WHERE id = ?`, [id]);
    if (!st.length) return res.status(404).json({ message: '申请单不存在' });
    if (st[0].status !== 'draft') return res.status(400).json({ message: '仅草稿可提交' });
    await pool.query(`UPDATE purchase_requests SET status='pending_approval' WHERE id=?`, [id]);
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'pr_submit',
      entityType: 'purchase_request',
      entityId: id,
      detail: '提交审核',
    });
    res.json({ message: '已提交审核' });
  } catch (e) {
    next(e);
  }
});

/** 审核通过：管理员或采购员（采购负责人简化等同角色） */
r.post('/:id/approve', requireRole('admin', 'purchaser'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const note = (req.body && req.body.note) || '';
    const [st] = await pool.query(`SELECT status FROM purchase_requests WHERE id = ?`, [id]);
    if (!st.length) return res.status(404).json({ message: '申请单不存在' });
    if (st[0].status !== 'pending_approval') return res.status(400).json({ message: '当前状态不可审核通过' });
    await pool.query(
      `UPDATE purchase_requests SET status='approved', reviewer_id=?, review_note=?, reviewed_at=NOW() WHERE id=?`,
      [req.user.id, note, id]
    );
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'pr_approve',
      entityType: 'purchase_request',
      entityId: id,
      detail: note,
    });
    res.json({ message: '已通过' });
  } catch (e) {
    next(e);
  }
});

r.post('/:id/reject', requireRole('admin', 'purchaser'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const note = (req.body && req.body.note) || '';
    if (!note) return res.status(400).json({ message: '请填写驳回理由' });
    const [st] = await pool.query(`SELECT status FROM purchase_requests WHERE id = ?`, [id]);
    if (!st.length) return res.status(404).json({ message: '申请单不存在' });
    if (st[0].status !== 'pending_approval') return res.status(400).json({ message: '当前状态不可驳回' });
    await pool.query(
      `UPDATE purchase_requests SET status='rejected', reviewer_id=?, review_note=?, reviewed_at=NOW() WHERE id=?`,
      [req.user.id, note, id]
    );
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'pr_reject',
      entityType: 'purchase_request',
      entityId: id,
      detail: note,
    });
    res.json({ message: '已驳回' });
  } catch (e) {
    next(e);
  }
});

/** 复制新增：返回新草稿 ID */
r.post('/:id/copy', requireRole('admin', 'purchaser'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const src = await loadRequest(id);
    if (!src) return res.status(404).json({ message: '源申请单不存在' });
    await conn.beginTransaction();
    const requestNo = await generateDocumentNo('PR');
    const [ins] = await conn.query(
      `INSERT INTO purchase_requests (request_no, dept_name, need_date, applicant_id, status)
       VALUES (?,?,?,?, 'draft')`,
      [requestNo, src.dept_name, src.need_date, req.user.id]
    );
    const newId = ins.insertId;
    for (const ln of src.lines) {
      await conn.query(
        `INSERT INTO purchase_request_lines (request_id, material_id, material_name, spec, qty, est_unit_price, purpose_remark)
         VALUES (?,?,?,?,?,?,?)`,
        [newId, ln.material_id, ln.material_name, ln.spec, ln.qty, ln.est_unit_price, ln.purpose_remark]
      );
    }
    await conn.commit();
    res.json({ id: newId, requestNo });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

export default r;
