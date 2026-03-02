import express from 'express';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../prisma.js';
import { normalizeAddressInput, normalizeText } from '../services/pdfProcessor.js';
import { isValidPeriod, normalizeAccount, toId, toTrimmed } from '../utils/validators.js';

const router = express.Router();
const notFoundMessage = 'Квитанция по указанным данным не найдена. Проверьте правильность введенного лицевого счета или адреса';

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 30 });
router.use(limiter);

const latestPeriod = async () => {
  const upload = await prisma.upload.findFirst({ where: { status: 'processed' }, orderBy: { createdAt: 'desc' } });
  return upload?.period;
};

router.get('/periods', async (_req, res) => {
  const periods = await prisma.upload.findMany({
    where: { status: 'processed' },
    distinct: ['period'],
    select: { period: true },
    orderBy: { period: 'desc' }
  });
  res.json({ periods: periods.map((item) => item.period) });
});

const toPublic = (r) => ({
  id: r.id,
  period: r.period,
  account: r.account,
  rawAddress: r.rawAddress,
  pageStart: r.pageStart,
  pageEnd: r.pageEnd,
  sourceFile: r.upload?.originalName || null
});

router.get('/ad', async (_req, res) => {
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
  const ads = await prisma.advertisement.findMany({ where: { isActive: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] });
  res.json({ ad, ads });
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


router.get('/suppliers', async (_req, res) => {
  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    include: { services: { where: { isActive: true }, orderBy: { createdAt: 'asc' } } },
    orderBy: { name: 'asc' }
  });
  res.json({ suppliers });
});

router.post('/search-by-account', async (req, res) => {
  const account = normalizeAccount(req.body.account);
  if (!account) return res.status(400).json({ message: 'account is required' });
  const periodInput = toTrimmed(req.body.period);
  if (periodInput && !isValidPeriod(periodInput)) return res.status(400).json({ message: 'Invalid period format. Expected YYYY-MM' });
  const period = periodInput || await latestPeriod();
  if (!period) return res.status(404).json({ message: notFoundMessage });

  const receipts = await prisma.receipt.findMany({
    where: { period, account },
    include: { upload: { select: { originalName: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 20
  });
  if (!receipts.length) return res.status(404).json({ message: notFoundMessage });

  res.json({ receipt: toPublic(receipts[0]), receipts: receipts.map(toPublic) });
});

router.post('/search-by-address', async (req, res) => {
  const normalized = normalizeAddressInput(req.body);
  const periodInput = toTrimmed(req.body.period);
  if (periodInput && !isValidPeriod(periodInput)) return res.status(400).json({ message: 'Invalid period format. Expected YYYY-MM' });
  const period = periodInput || await latestPeriod();
  if (!period) return res.status(404).json({ message: notFoundMessage });

  const receipts = await prisma.receipt.findMany({
    where: { period },
    include: { upload: { select: { originalName: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 500
  });
  const matches = receipts.filter((r) => {
    const okSettlement = !normalized.settlement || normalizeText(r.settlement || '').includes(normalized.settlement);
    const okStreet = !normalized.street || normalizeText(r.street || '').includes(normalized.street);
    const okHouse = !normalized.house || normalizeText(r.house || '').includes(normalized.house);
    const okApartment = !normalized.apartment || normalizeText(r.apartment || '').includes(normalized.apartment);
    return okSettlement && okStreet && okHouse && okApartment;
  });

  if (!matches.length) return res.status(404).json({ message: notFoundMessage });
  res.json({ receipt: toPublic(matches[0]), receipts: matches.map(toPublic) });
});

const sendReceipt = async (req, res, disposition) => {
  const receiptId = toId(req.params.id);
  if (!receiptId) return res.sendStatus(400);
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt || !fs.existsSync(receipt.filePath)) return res.sendStatus(404);
  res.setHeader('Content-Type', 'application/pdf');
  if (disposition === 'attachment') {
    res.setHeader('Content-Disposition', `attachment; filename="epd-${receipt.id}.pdf"`);
  } else {
    res.setHeader('Content-Disposition', `inline; filename="epd-${receipt.id}.pdf"`);
  }
  fs.createReadStream(receipt.filePath).pipe(res);
};

router.get('/receipt/:id/view', (req, res) => sendReceipt(req, res, 'inline'));
router.get('/receipt/:id/download', (req, res) => sendReceipt(req, res, 'attachment'));

export default router;
