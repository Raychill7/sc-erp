import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logOperation } from '../utils/audit.js';

const r = Router();

const levelMap = { 优质: 'premium', 合格: 'qualified', 待考核: 'pending', premium: 'premium', qualified: 'qualified', pending: 'pending' };

r.get('/', async (req, res, next) => {
  try {
    const { level, keyword, status } = req.query;
    let sql = `SELECT * FROM suppliers WHERE 1=1`;
    const params = [];
    if (level && levelMap[level] !== undefined) {
      sql += ` AND coop_level = ?`;
      params.push(levelMap[level] || level);
    }
    if (status === '1' || status === '0') {
      sql += ` AND status = ?`;
      params.push(Number(status));
    }
    if (keyword) {
      sql += ` AND (full_name LIKE ? OR main_materials LIKE ? OR contact_name LIKE ?)`;
      const k = `%${keyword}%`;
      params.push(k, k, k);
    }
    sql += ` ORDER BY id DESC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.get('/:id/ledger', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [orders] = await pool.query(
      `SELECT id, order_no, status, total_amount, delivery_date, pay_method, created_at FROM purchase_orders WHERE supplier_id = ? ORDER BY id DESC`,
      [id]
    );
    const [receipts] = await pool.query(
      `SELECT r.id, r.receipt_no, r.order_id, r.receive_date, r.abnormal_note, r.created_at
       FROM receipts r INNER JOIN purchase_orders po ON po.id = r.order_id WHERE po.supplier_id = ? ORDER BY r.id DESC`,
      [id]
    );
    const [payments] = await pool.query(
      `SELECT id, pay_date, amount, pay_method, voucher_no, created_at FROM payments WHERE supplier_id = ? ORDER BY id DESC`,
      [id]
    );
    res.json({ orders, receipts, payments });
  } catch (e) {
    next(e);
  }
});

r.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`SELECT * FROM suppliers WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ message: '供应商不存在' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

r.post('/', requireRole('admin', 'purchaser'), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.fullName) return res.status(400).json({ message: '供应商全称必填' });
    const coop = levelMap[b.coopLevel] || b.coopLevel || 'qualified';
    const [ins] = await pool.query(
      `INSERT INTO suppliers (full_name, contact_name, contact_phone, address, license_file, bank_permit_file, main_materials, coop_level, payment_terms_days, status)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        b.fullName,
        b.contactName || '',
        b.contactPhone || '',
        b.address || '',
        b.licenseFile || '',
        b.bankPermitFile || '',
        b.mainMaterials || '',
        coop,
        Number(b.paymentTermsDays) >= 0 ? Number(b.paymentTermsDays) : 30,
        b.status === false ? 0 : 1,
      ]
    );
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'supplier_create',
      entityType: 'supplier',
      entityId: ins.insertId,
      detail: b.fullName,
    });
    res.json({ id: ins.insertId });
  } catch (e) {
    next(e);
  }
});

r.put('/:id', requireRole('admin', 'purchaser'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const coop = b.coopLevel != null ? levelMap[b.coopLevel] || b.coopLevel : undefined;
    await pool.query(
      `UPDATE suppliers SET
        full_name = COALESCE(:fullName, full_name),
        contact_name = COALESCE(:contactName, contact_name),
        contact_phone = COALESCE(:contactPhone, contact_phone),
        address = COALESCE(:address, address),
        license_file = COALESCE(:licenseFile, license_file),
        bank_permit_file = COALESCE(:bankPermitFile, bank_permit_file),
        main_materials = COALESCE(:mainMaterials, main_materials),
        coop_level = COALESCE(:coopLevel, coop_level),
        payment_terms_days = COALESCE(:paymentTermsDays, payment_terms_days),
        status = COALESCE(:status, status)
      WHERE id = :id`,
      {
        fullName: b.fullName ?? null,
        contactName: b.contactName ?? null,
        contactPhone: b.contactPhone ?? null,
        address: b.address ?? null,
        licenseFile: b.licenseFile ?? null,
        bankPermitFile: b.bankPermitFile ?? null,
        mainMaterials: b.mainMaterials ?? null,
        coopLevel: coop ?? null,
        paymentTermsDays: b.paymentTermsDays != null ? Number(b.paymentTermsDays) : null,
        status: b.status === undefined ? null : b.status ? 1 : 0,
        id,
      }
    );
    await logOperation({
      userId: req.user.id,
      username: req.user.username,
      action: 'supplier_update',
      entityType: 'supplier',
      entityId: id,
      detail: b.fullName || '',
    });
    res.json({ message: '已保存' });
  } catch (e) {
    next(e);
  }
});

r.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM suppliers WHERE id = ?`, [id]);
    res.json({ message: '已删除' });
  } catch (e) {
    next(e);
  }
});

export default r;
