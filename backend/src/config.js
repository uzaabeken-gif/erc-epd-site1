import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

if (!process.env.DATABASE_URL) {
  const defaultDbPath = path.resolve(__dirname, '../../storage/app.db');
  process.env.DATABASE_URL = `file:${defaultDbPath}`;
}

const toArrayRegex = (value, fallback) => (value || fallback)
  .split('||')
  .map((v) => v.trim())
  .filter(Boolean)
  .map((p) => new RegExp(p, 'i'));

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'change-me-secret',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin12345',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 100),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.resolve(__dirname, '../../storage/uploads')),
  receiptDir: path.resolve(process.env.RECEIPT_DIR || path.resolve(__dirname, '../../storage/receipts')),
  adMediaDir: path.resolve(process.env.AD_MEDIA_DIR || path.resolve(__dirname, '../../storage/ad-media')),
  stickyGrouping: String(process.env.STICKY_GROUPING || 'true') === 'true',
  accountRegexes: toArrayRegex(process.env.ACCOUNT_REGEX, 'Л/С[:\\s]*([0-9\\s-]{6,20})||Лицевой\\s*счет(?:\\s*абонента)?[:\\s]*([0-9\\s-]{6,20})||ACCOUNT[:\\s]*([0-9\\s-]{6,20})'),
  addressRegexes: toArrayRegex(process.env.ADDRESS_REGEX, '(?:Адрес|ADDRESS)[:\\s]*([^\\n]+)'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://85.239.35.245,https://85.239.35.245'
};
