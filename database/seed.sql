-- 初始化数据（在 schema 执行后运行）
-- 默认管理员 admin / admin123 的密码哈希由 scripts/seed.js 写入更安全；此处仅插入分类示例

INSERT INTO material_categories (name, sort_order) VALUES
('原材料', 1),
('辅料', 2),
('包材', 3)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO system_config (`key`, `value`) VALUES
('pay_methods', '["现结","月结","批结"]'),
('company_name', '"采购P2P演示企业"')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);
