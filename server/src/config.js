import dotenv from 'dotenv';
dotenv.config();

function env(key, fallback) {
  const railwayKey = key.replace('DB_', 'MYSQL_');
  return process.env[key] || process.env[railwayKey] || fallback;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-in-production-min-32',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  db: {
    host: env('DB_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT', '3306')),
    user: env('DB_USER', 'root'),
    password: env('DB_PASSWORD', '') || '',
    database: env('DB_NAME', 'sc_erp'),
  },
};