-- 采购链 P2P 简化版 ERP - MySQL 建表脚本
-- 字符集 utf8mb4，适配中文与文件路径

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS operation_logs;
DROP TABLE IF EXISTS payment_order_allocations;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS reconciliation_snapshots;
DROP TABLE IF EXISTS stock_in_records;
DROP TABLE IF EXISTS receipt_lines;
DROP TABLE IF EXISTS receipts;
DROP TABLE IF EXISTS purchase_order_lines;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS purchase_request_lines;
DROP TABLE IF EXISTS purchase_requests;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS materials;
DROP TABLE IF EXISTS material_categories;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS system_config;

SET FOREIGN_KEY_CHECKS = 1;

-- 系统配置键值（付款方式、审核人等 JSON 或标量）
CREATE TABLE system_config (
  `key` VARCHAR(64) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL COMMENT 'JSON 字符串',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='基础配置';

-- 用户（角色：admin / purchaser / finance）
CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(64) NOT NULL DEFAULT '',
  role ENUM('admin','purchaser','finance') NOT NULL DEFAULT 'purchaser',
  status TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1启用 0禁用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户';

-- 物料分类
CREATE TABLE material_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物料分类';

-- 物料主数据
CREATE TABLE materials (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NULL,
  code VARCHAR(64) NOT NULL DEFAULT '',
  name VARCHAR(256) NOT NULL,
  spec VARCHAR(512) NOT NULL DEFAULT '',
  unit VARCHAR(32) NOT NULL DEFAULT '件',
  status TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_materials_cat (category_id),
  CONSTRAINT fk_materials_cat FOREIGN KEY (category_id) REFERENCES material_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物料库';

-- 供应商
CREATE TABLE suppliers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(256) NOT NULL,
  contact_name VARCHAR(64) NOT NULL DEFAULT '',
  contact_phone VARCHAR(32) NOT NULL DEFAULT '',
  address VARCHAR(512) NOT NULL DEFAULT '',
  license_file VARCHAR(512) NOT NULL DEFAULT '' COMMENT '营业执照路径',
  bank_permit_file VARCHAR(512) NOT NULL DEFAULT '' COMMENT '开户许可证路径',
  main_materials VARCHAR(512) NOT NULL DEFAULT '' COMMENT '主营物料关键词',
  coop_level ENUM('premium','qualified','pending') NOT NULL DEFAULT 'qualified' COMMENT '优质/合格/待考核',
  payment_terms_days INT NOT NULL DEFAULT 30 COMMENT '账期天数',
  status TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1启用 0禁用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_suppliers_level (coop_level),
  KEY idx_suppliers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商';

-- 采购申请单头
CREATE TABLE purchase_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_no VARCHAR(32) NOT NULL UNIQUE,
  dept_name VARCHAR(128) NOT NULL DEFAULT '',
  need_date DATE NULL,
  applicant_id INT UNSIGNED NOT NULL,
  status ENUM('draft','pending_approval','approved','rejected') NOT NULL DEFAULT 'draft',
  reviewer_id INT UNSIGNED NULL,
  review_note VARCHAR(512) NOT NULL DEFAULT '',
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_pr_status (status),
  CONSTRAINT fk_pr_applicant FOREIGN KEY (applicant_id) REFERENCES users(id),
  CONSTRAINT fk_pr_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购申请';

-- 采购申请明细
CREATE TABLE purchase_request_lines (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id INT UNSIGNED NOT NULL,
  material_id INT UNSIGNED NULL,
  material_name VARCHAR(256) NOT NULL,
  spec VARCHAR(512) NOT NULL DEFAULT '',
  qty DECIMAL(18,4) NOT NULL,
  est_unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
  purpose_remark VARCHAR(512) NOT NULL DEFAULT '',
  KEY idx_prl_req (request_id),
  CONSTRAINT fk_prl_req FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_prl_mat FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购申请明细';

-- 采购单头
CREATE TABLE purchase_orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL UNIQUE,
  request_id INT UNSIGNED NULL COMMENT '来源申请单',
  supplier_id INT UNSIGNED NOT NULL,
  delivery_date DATE NULL,
  pay_method VARCHAR(64) NOT NULL DEFAULT '月结' COMMENT '现结/月结/批结等',
  status ENUM('pending_ship','partial_shipped','fully_shipped','completed','void') NOT NULL DEFAULT 'pending_ship',
  total_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
  remark VARCHAR(512) NOT NULL DEFAULT '',
  created_by INT UNSIGNED NOT NULL,
  shipped_flag TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已有发货/收货登记',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_po_supplier (supplier_id),
  KEY idx_po_status (status),
  CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_po_request FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE SET NULL,
  CONSTRAINT fk_po_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单';

-- 采购单明细
CREATE TABLE purchase_order_lines (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  material_id INT UNSIGNED NULL,
  material_name VARCHAR(256) NOT NULL,
  spec VARCHAR(512) NOT NULL DEFAULT '',
  qty DECIMAL(18,4) NOT NULL,
  unit_price DECIMAL(18,4) NOT NULL,
  line_amount DECIMAL(18,4) NOT NULL,
  received_qty DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '累计实收数量',
  KEY idx_pol_order (order_id),
  CONSTRAINT fk_pol_order FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_pol_mat FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单明细';

-- 收货单头
CREATE TABLE receipts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_no VARCHAR(32) NOT NULL UNIQUE,
  order_id INT UNSIGNED NOT NULL,
  receive_date DATE NOT NULL,
  abnormal_note VARCHAR(512) NOT NULL DEFAULT '' COMMENT '少货/次品/延期等',
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rc_order (order_id),
  CONSTRAINT fk_rc_order FOREIGN KEY (order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_rc_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收货验收';

-- 收货明细
CREATE TABLE receipt_lines (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_id INT UNSIGNED NOT NULL,
  order_line_id INT UNSIGNED NOT NULL,
  qty_received DECIMAL(18,4) NOT NULL,
  inspection ENUM('qualified','unqualified','defective') NOT NULL DEFAULT 'qualified',
  line_remark VARCHAR(256) NOT NULL DEFAULT '',
  KEY idx_rl_receipt (receipt_id),
  KEY idx_rl_ol (order_line_id),
  CONSTRAINT fk_rl_receipt FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_rl_ol FOREIGN KEY (order_line_id) REFERENCES purchase_order_lines(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收货明细';

-- 简易入库（合格数量汇总）
CREATE TABLE stock_in_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_line_id INT UNSIGNED NOT NULL,
  material_id INT UNSIGNED NULL,
  material_name VARCHAR(256) NOT NULL,
  qty DECIMAL(18,4) NOT NULL,
  in_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sin_mat (material_id),
  CONSTRAINT fk_sin_rl FOREIGN KEY (receipt_line_id) REFERENCES receipt_lines(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='简易入库记录';

-- 付款登记
CREATE TABLE payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT UNSIGNED NOT NULL,
  pay_date DATE NOT NULL,
  amount DECIMAL(18,4) NOT NULL,
  pay_method VARCHAR(64) NOT NULL DEFAULT '',
  voucher_no VARCHAR(128) NOT NULL DEFAULT '',
  remark VARCHAR(512) NOT NULL DEFAULT '',
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pay_supplier (supplier_id),
  CONSTRAINT fk_pay_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_pay_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='付款';

-- 付款分摊到采购单（用于应付台账）
CREATE TABLE payment_order_allocations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_id INT UNSIGNED NOT NULL,
  order_id INT UNSIGNED NOT NULL,
  amount DECIMAL(18,4) NOT NULL,
  UNIQUE KEY uk_pay_order (payment_id, order_id),
  KEY idx_poa_order (order_id),
  CONSTRAINT fk_poa_pay FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT fk_poa_order FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='付款与采购单关联';

-- 对账单快照（生成后可打印）
CREATE TABLE reconciliation_snapshots (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  snapshot_no VARCHAR(32) NOT NULL UNIQUE,
  supplier_id INT UNSIGNED NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_payable DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_paid DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_unpaid DECIMAL(18,4) NOT NULL DEFAULT 0,
  lines_json JSON NOT NULL COMMENT '明细快照',
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rs_supplier (supplier_id),
  CONSTRAINT fk_rs_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_rs_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对账单快照';

-- 操作日志
CREATE TABLE operation_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  username VARCHAR(64) NOT NULL DEFAULT '',
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL DEFAULT '',
  entity_id VARCHAR(64) NOT NULL DEFAULT '',
  detail VARCHAR(1024) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ol_user (user_id),
  KEY idx_ol_created (created_at),
  CONSTRAINT fk_ol_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作留痕';
