import dotenv from 'dotenv';
dotenv.config();

function env(...keys) {
  for (const k of keys) {
    if (process.env[k]) return process.env[k];
  }
  return keys[keys.length - 1];
}

export const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-in-production-min-32',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  db: {
    host: env('DB_HOST', 'MYSQLHOST', 'MYSQL_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT', 'MYSQLPORT', 'MYSQL_PORT', '3306')),
    user: env('DB_USER', 'MYSQLUSER', 'MYSQL_USER', 'root'),
    password: env('DB_PASSWORD', 'MYSQLPASSWORD', 'MYSQL_PASSWORD', '') || '',
    database: env('DB_NAME', 'MYSQLDATABASE', 'MYSQL_DATABASE', 'sc_erp'),
  },
};
