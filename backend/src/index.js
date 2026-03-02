import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import pinoHttp from 'pino-http';
import fs from 'fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import { ensureAdmin } from './utils/seedAdmin.js';
import { ensureAdvertisement } from './utils/seedAd.js';
import { ensureContacts } from './utils/seedContacts.js';

const execFileAsync = promisify(execFile);

const app = express();
app.use(helmet());
const corsOrigin = config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((v) => v.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '4mb' }));
app.use(morgan('dev'));
app.use(pinoHttp());
app.use('/media', express.static(config.adMediaDir));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);


const runPrismaMigrations = async () => {
  await execFileAsync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: process.env
  });
};

app.use((err, req, res, _next) => {
  req.log?.error?.(err);
  res.status(500).json({ message: 'Internal server error' });
});

const start = async () => {
  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.mkdir(config.receiptDir, { recursive: true });
  await fs.mkdir(config.adMediaDir, { recursive: true });
  await runPrismaMigrations();
  await ensureAdmin();
  await ensureAdvertisement();
  await ensureContacts();

  app.listen(config.port, () => {
    console.log(`Backend listening on ${config.port}`);
  });
};

start();
