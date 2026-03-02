import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { processUpload, remapUnassignedPages } from '../services/pdfProcessor.js';
import { isValidPeriod, normalizeAccount, toId, toNullableUrl, toTrimmed, toUrlList } from '../utils/validators.js';

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});

const uploader = multer({
  storage: uploadStorage,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) cb(null, true);
    else cb(new Error('Only PDF is allowed'));
  }
});

const adStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.adMediaDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});

const adUploader = multer({
  storage: adStorage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image/png, image/jpeg, image/webp, image/gif allowed'));
  }
});

router.post('/auth/login', loginLimiter, async (req, res) => {
  const email = toTrimmed(req.body.email);
  const password = String(req.body.password || '');
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, { expiresIn: '12h' });
  res.json({ token });
});

router.use(requireAuth);

router.get('/ads', async (_req, res) => {
  let ad = await prisma.advertisement.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!ad) {
    ad = await prisma.advertisement.create({
      data: {
        ruText: 'Здесь может быть размещена ваша реклама',
        kzText: 'Мұнда сіздің жарнамаңыз орналастырылуы мүмкін',
        isActive: true,
        rotationSeconds: 5
      }
    });
  }
  const ads = await prisma.advertisement.findMany({ orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] });
  res.json({ ad, ads });
});

router.post('/ads', async (req, res) => {
  const ad = await prisma.advertisement.create({
    data: {
      ruText: toTrimmed(req.body.ruText) || 'Новый рекламный блок',
      kzText: toTrimmed(req.body.kzText) || 'Жаңа жарнама блогы',
      linkUrl: toNullableUrl(req.body.linkUrl),
      imageUrl: toUrlList(req.body.imageUrl).join('\n') || null,
      isActive: req.body.isActive !== false,
      rotationSeconds: Math.max(1, Number(req.body.rotationSeconds || 5))
    }
  });
  res.status(201).json({ ad });
});

router.put('/ads/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });
  const updated = await prisma.advertisement.update({
    where: { id },
    data: {
      ruText: String(req.body.ruText || '').trim(),
      kzText: String(req.body.kzText || '').trim(),
      linkUrl: toNullableUrl(req.body.linkUrl),
      imageUrl: toUrlList(req.body.imageUrl).join('\n') || null,
      isActive: Boolean(req.body.isActive),
      rotationSeconds: Math.max(1, Number(req.body.rotationSeconds || 5))
    }
  });
  res.json({ ad: updated });
});

router.post('/ads/:id/media', adUploader.array('media', 10), async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });
  const ad = await prisma.advertisement.findUnique({ where: { id } });
  const files = req.files || [];
  if (!ad || !files.length) return res.status(400).json({ message: 'ad or media not found' });

  const uploadedMedia = files.map((file) => ({
    path: `/media/${path.basename(file.path)}`,
    type: file.mimetype
  }));

  const existingUrls = String(ad.imageUrl || '')
    .split(/\r?\n|,/)
    .map((v) => v.trim())
    .filter(Boolean);

  const mergedUrls = Array.from(new Set([
    ...existingUrls,
    ...uploadedMedia.map((m) => m.path)
  ]));

  const updated = await prisma.advertisement.update({
    where: { id },
    data: {
      mediaPath: uploadedMedia[0]?.path || ad.mediaPath,
      mediaType: uploadedMedia[0]?.type || ad.mediaType,
      imageUrl: mergedUrls.join('\n')
    }
  });

  res.json({ ad: updated });
});


router.delete('/ads/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });

  const ad = await prisma.advertisement.findUnique({ where: { id } });
  if (!ad) return res.sendStatus(404);

  const adsCount = await prisma.advertisement.count();
  if (adsCount <= 1) return res.status(400).json({ message: 'Должен оставаться хотя бы один рекламный блок' });

  const mediaPaths = String(ad.imageUrl || '')
    .split(/\r?\n|,/)
    .map((v) => v.trim())
    .filter((v) => v.startsWith('/media/'));

  for (const mediaPath of mediaPaths) {
    const absolutePath = path.join(config.adMediaDir, path.basename(mediaPath));
    if (fsSync.existsSync(absolutePath)) await fs.unlink(absolutePath).catch(() => null);
  }

  await prisma.advertisement.delete({ where: { id } });
  res.sendStatus(204);
});

router.get('/contacts', async (_req, res) => {
  let contacts = await prisma.contactInfo.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!contacts) {
    contacts = await prisma.contactInfo.create({
      data: {
        phone: '+7 (700) 000-00-00',
        email: 'support@erc.local',
        address: 'г. Пример, ул. Центральная, 1',
        workHours: 'Пн–Пт 09:00–18:00',
        suppliersText: 'ТОО Теплосеть\nТОО Водоканал\nТОО Электроснабжение'
      }
    });
  }
  res.json({ contacts });
});

router.put('/contacts/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });
  if (!toTrimmed(req.body.phone) || !toTrimmed(req.body.email)) return res.status(400).json({ message: 'phone and email are required' });
  const updated = await prisma.contactInfo.update({
    where: { id },
    data: {
      phone: String(req.body.phone || '').trim(),
      email: String(req.body.email || '').trim(),
      address: String(req.body.address || '').trim(),
      workHours: String(req.body.workHours || '').trim(),
      suppliersText: String(req.body.suppliersText || '').trim()
    }
  });
  res.json({ contacts: updated });
});


router.get('/suppliers', async (_req, res) => {
  const suppliers = await prisma.supplier.findMany({
    include: { services: { orderBy: { createdAt: 'asc' } }, _count: { select: { services: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ suppliers });
});

router.post('/suppliers', async (req, res) => {
  const name = toTrimmed(req.body.name);
  if (!name) return res.status(400).json({ message: 'Supplier name is required' });
  const supplier = await prisma.supplier.create({
    data: {
      name,
      description: req.body.description ? String(req.body.description).trim() : null,
      phone: req.body.phone ? String(req.body.phone).trim() : null,
      email: req.body.email ? String(req.body.email).trim() : null,
      website: req.body.website ? String(req.body.website).trim() : null,
      isActive: req.body.isActive !== false
    }
  });
  res.status(201).json({ supplier });
});

router.put('/suppliers/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });
  const name = toTrimmed(req.body.name);
  if (!name) return res.status(400).json({ message: 'Supplier name is required' });
  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name,
      description: req.body.description ? String(req.body.description).trim() : null,
      phone: req.body.phone ? String(req.body.phone).trim() : null,
      email: req.body.email ? String(req.body.email).trim() : null,
      website: req.body.website ? String(req.body.website).trim() : null,
      isActive: req.body.isActive !== false
    }
  });
  res.json({ supplier });
});

router.delete('/suppliers/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });
  await prisma.supplier.delete({ where: { id } });
  res.sendStatus(204);
});

router.post('/suppliers/:id/services', async (req, res) => {
  const supplierId = toId(req.params.id);
  if (!supplierId) return res.status(400).json({ message: 'Invalid supplier id' });
  const title = toTrimmed(req.body.title);
  if (!title) return res.status(400).json({ message: 'Service title is required' });
  const service = await prisma.supplierService.create({
    data: {
      supplierId,
      title,
      description: req.body.description ? String(req.body.description).trim() : null,
      priceInfo: req.body.priceInfo ? String(req.body.priceInfo).trim() : null,
      isActive: req.body.isActive !== false
    }
  });
  res.status(201).json({ service });
});

router.put('/services/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });
  const title = toTrimmed(req.body.title);
  if (!title) return res.status(400).json({ message: 'Service title is required' });
  const service = await prisma.supplierService.update({
    where: { id },
    data: {
      title,
      description: req.body.description ? String(req.body.description).trim() : null,
      priceInfo: req.body.priceInfo ? String(req.body.priceInfo).trim() : null,
      isActive: req.body.isActive !== false
    }
  });
  res.json({ service });
});

router.delete('/services/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });
  await prisma.supplierService.delete({ where: { id } });
  res.sendStatus(204);
});

router.post('/uploads', uploader.array('files', 20), async (req, res) => {
  const period = toTrimmed(req.body.period);
  if (!period) return res.status(400).json({ message: 'period is required' });
  if (!isValidPeriod(period)) return res.status(400).json({ message: 'Invalid period format. Expected YYYY-MM' });
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ message: 'files are required' });

  const uploads = [];
  for (const file of files) {
    const hash = crypto.createHash('sha256').update(await fs.readFile(file.path)).digest('hex');
    const upload = await prisma.upload.create({
      data: {
        originalName: file.originalname,
        storedPath: path.resolve(file.path),
        period,
        status: 'queued',
        sourceHash: hash
      }
    });
    uploads.push(upload);
    processUpload(upload.id).catch(() => null);
  }

  res.status(201).json({ uploads });
});

router.get('/uploads', async (_req, res) => {
  const uploads = await prisma.upload.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ uploads });
});

router.get('/uploads/:id/source', async (req, res) => {
  const upload = await prisma.upload.findUnique({ where: { id: Number(req.params.id) } });
  if (!upload || !fsSync.existsSync(upload.storedPath)) return res.sendStatus(404);
  res.download(upload.storedPath, upload.originalName);
});

router.delete('/uploads/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });
  const upload = await prisma.upload.findUnique({ where: { id }, include: { receipts: true } });
  if (!upload) return res.sendStatus(404);

  if (fsSync.existsSync(upload.storedPath)) await fs.unlink(upload.storedPath);
  for (const r of upload.receipts) {
    if (fsSync.existsSync(r.filePath)) await fs.unlink(r.filePath);
  }

  await prisma.upload.delete({ where: { id } });
  res.sendStatus(204);
});


router.delete('/uploads', async (req, res) => {
  const period = toTrimmed(req.query.period);
  if (!period) return res.status(400).json({ message: 'period is required' });
  if (!isValidPeriod(period)) return res.status(400).json({ message: 'Invalid period format. Expected YYYY-MM' });

  const uploads = await prisma.upload.findMany({ where: { period }, include: { receipts: true } });
  if (!uploads.length) return res.json({ deletedUploads: 0, deletedReceipts: 0 });

  let deletedReceipts = 0;
  for (const upload of uploads) {
    if (fsSync.existsSync(upload.storedPath)) await fs.unlink(upload.storedPath);
    for (const r of upload.receipts) {
      if (fsSync.existsSync(r.filePath)) await fs.unlink(r.filePath);
      deletedReceipts += 1;
    }
    await prisma.upload.delete({ where: { id: upload.id } });
  }

  res.json({ deletedUploads: uploads.length, deletedReceipts });
});
router.post('/uploads/:id/reprocess', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });
  await processUpload(id);
  const updated = await prisma.upload.findUnique({ where: { id } });
  res.json({ upload: updated });
});

router.get('/unassigned-pages', async (req, res) => {
  const uploadId = toId(req.query.uploadId);
  if (!uploadId) return res.status(400).json({ message: 'Invalid uploadId' });
  const pages = await prisma.unassignedPage.findMany({ where: { uploadId }, orderBy: { pageNumber: 'asc' } });
  res.json({ pages });
});

router.post('/unassigned-pages/assign', async (req, res) => {
  const payload = req.body;
  const uploadId = toId(payload.uploadId);
  const fromPage = Number(payload.fromPage);
  const toPage = Number(payload.toPage);
  if (!uploadId || !Number.isInteger(fromPage) || !Number.isInteger(toPage) || fromPage <= 0 || toPage <= 0 || fromPage > toPage) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  await remapUnassignedPages({
    uploadId,
    fromPage,
    toPage,
    account: normalizeAccount(payload.account),
    rawAddress: payload.rawAddress
  });
  res.sendStatus(204);
});

router.use((err, _req, res, _next) => {
  if (err?.name === 'MulterError') return res.status(400).json({ message: err.message });
  if (err?.message) return res.status(400).json({ message: err.message });
  return res.status(500).json({ message: 'Internal server error' });
});

export default router;
