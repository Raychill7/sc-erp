/**
 * 初始化管理员账号与基础分类（需已执行 database/schema.sql）
 * 用法: npm run seed
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const hash = bcrypt.hashSync('admin123', 10);

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sc_erp',
    waitForConnections: true,
    connectionLimit: 2,
  });

  const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']);
  if (rows.length === 0) {
    await pool.query(
      `INSERT INTO users (username, password_hash, display_name, role, status) VALUES (?,?,?,?,1)`,
      ['admin', hash, '系统管理员', 'admin']
    );
    console.log('已创建默认管理员: admin / admin123');
  } else {
    console.log('管理员 admin 已存在，跳过创建');
  }

  await pool.query(
    `INSERT INTO material_categories (name, sort_order) VALUES ('原材料',1),('辅料',2),('包材',3)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`
  ).catch(() => {});

  await pool.query(
    `INSERT INTO system_config (\`key\`, \`value\`) VALUES ('pay_methods','["现结","月结","批结"]'),('company_name','"采购P2P演示企业"')
     ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`
  ).catch(() => {});

  await pool.end();
  console.log('Seed 完成');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
