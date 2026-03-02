import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { normalizeAccount } from '../utils/validators.js';

const normalize = (v = '') => v.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

const extractAddressParts = (rawAddress) => {
  if (!rawAddress) return {};
  const value = rawAddress.replace(/,/g, ' ').replace(/\s+/g, ' ');
  const settlement = value.match(/(?:г\.|город|пос\.|п\.|с\.)\s*([\p{L}\-]+)/iu)?.[1] || '';
  const street = value.match(/(?:ул\.|улица|пр\.|проспект|мкр\.|микрорайон)\s*([\p{L}\-0-9]+)/iu)?.[1] || '';
  const house = value.match(/(?:д\.|дом)\s*([0-9A-Za-z\-/]+)/iu)?.[1] || '';
  const apartment = value.match(/(?:кв\.|квартира)\s*([0-9A-Za-z\-/]+)/iu)?.[1] || '';

  return {
    settlement: settlement || null,
    street: street || null,
    house: house || null,
    apartment: apartment || null
  };
};

const extractFirst = (text, regexes) => {
  for (const r of regexes) {
    const match = text.match(r);
    if (match?.[1]) return match[1].trim();
  }
  return null;
};

const getPageSegments = async (buffer) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const segments = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const midY = viewport.height / 2;
    const text = await page.getTextContent();

    const topItems = text.items.filter((it) => (it.transform?.[5] || 0) > midY);
    const bottomItems = text.items.filter((it) => (it.transform?.[5] || 0) <= midY);

    const fullText = text.items.map((it) => it.str).join(' ');
    const topText = topItems.map((it) => it.str).join(' ');
    const bottomText = bottomItems.map((it) => it.str).join(' ');

    const topAccount = extractFirst(topText, config.accountRegexes);
    const bottomAccount = extractFirst(bottomText, config.accountRegexes);

    if (topAccount && bottomAccount && topAccount !== bottomAccount) {
      segments.push({ pageIndex: i - 1, pageNumber: i, part: 'top', text: topText || fullText });
      segments.push({ pageIndex: i - 1, pageNumber: i, part: 'bottom', text: bottomText || fullText });
    } else {
      segments.push({ pageIndex: i - 1, pageNumber: i, part: 'full', text: fullText });
    }
  }

  return segments;
};

const mergeSegmentsToPdf = async (sourcePdf, segments) => {
  const outDoc = await PDFDocument.create();

  for (const segment of segments) {
    const sourcePage = sourcePdf.getPage(segment.pageIndex);
    const { width, height } = sourcePage.getSize();

    if (segment.part === 'full') {
      const [copied] = await outDoc.copyPages(sourcePdf, [segment.pageIndex]);
      outDoc.addPage(copied);
      continue;
    }

    const embedded = await outDoc.embedPage(sourcePage);
    const halfHeight = height / 2;
    const page = outDoc.addPage([width, halfHeight]);

    if (segment.part === 'top') {
      page.drawPage(embedded, {
        x: 0,
        y: -halfHeight,
        width,
        height
      });
    } else {
      page.drawPage(embedded, {
        x: 0,
        y: 0,
        width,
        height
      });
    }
  }

  return Buffer.from(await outDoc.save());
};

export const processUpload = async (uploadId) => {
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) throw new Error('Upload not found');

  await prisma.upload.update({ where: { id: uploadId }, data: { status: 'processing', error: null } });

  try {
    const fileBuffer = await fs.readFile(upload.storedPath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const sourcePdf = await PDFDocument.load(fileBuffer);
    const pageSegments = await getPageSegments(fileBuffer);

    await prisma.receipt.deleteMany({ where: { uploadId } });
    await prisma.unassignedPage.deleteMany({ where: { uploadId } });

    const groups = [];
    let current = null;

    pageSegments.forEach((segment) => {
      const account = normalizeAccount(extractFirst(segment.text, config.accountRegexes));
      const rawAddress = extractFirst(segment.text, config.addressRegexes);
      if (account) {
        if (!current || current.account !== account) {
          current = {
            account,
            rawAddress,
            segments: [segment],
            first: segment.pageNumber,
            last: segment.pageNumber
          };
          groups.push(current);
        } else {
          current.segments.push(segment);
          current.last = segment.pageNumber;
          current.rawAddress ||= rawAddress;
        }
      } else if (config.stickyGrouping && current) {
        current.segments.push(segment);
        current.last = segment.pageNumber;
        current.rawAddress ||= rawAddress;
      } else {
        groups.push({
          account: null,
          rawAddress,
          segments: [segment],
          first: segment.pageNumber,
          last: segment.pageNumber,
          unassigned: true,
          text: segment.text
        });
        current = null;
      }
    });

    let recognized = 0;
    let unassigned = 0;

    for (const [index, g] of groups.entries()) {
      if (!g.account && !g.rawAddress) {
        unassigned += 1;
        await prisma.unassignedPage.create({ data: { uploadId, pageNumber: g.first, rawText: (g.text || '').slice(0, 5000) } });
        continue;
      }

      const merged = await mergeSegmentsToPdf(sourcePdf, g.segments);
      const fileName = `receipt-${uploadId}-${index + 1}-${Date.now()}.pdf`;
      const receiptPath = path.join(config.receiptDir, fileName);
      await fs.writeFile(receiptPath, merged);
      const normalized = extractAddressParts(g.rawAddress);

      await prisma.receipt.create({
        data: {
          uploadId,
          period: upload.period,
          account: g.account,
          rawAddress: g.rawAddress,
          ...normalized,
          filePath: receiptPath,
          pageStart: g.first,
          pageEnd: g.last,
          sourceHash: hash
        }
      });
      recognized += 1;
    }

    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: 'processed',
        totalPages: sourcePdf.getPageCount(),
        recognizedCount: recognized,
        unassignedCount: unassigned,
        sourceHash: hash
      }
    });
  } catch (e) {
    await prisma.upload.update({ where: { id: uploadId }, data: { status: 'failed', error: e.message } });
    throw e;
  }
};

export const remapUnassignedPages = async ({ uploadId, fromPage, toPage, account, rawAddress }) => {
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  const source = await PDFDocument.load(await fs.readFile(upload.storedPath));
  const pageIndexes = [];
  for (let i = fromPage; i <= toPage; i += 1) pageIndexes.push(i - 1);
  const manualSegments = pageIndexes.map((idx) => ({ pageIndex: idx, pageNumber: idx + 1, part: "full", text: "" }));
  const merged = await mergeSegmentsToPdf(source, manualSegments);
  const fileName = `manual-${uploadId}-${Date.now()}.pdf`;
  const receiptPath = path.join(config.receiptDir, fileName);
  await fs.writeFile(receiptPath, merged);

  await prisma.receipt.create({
    data: {
      uploadId,
      period: upload.period,
      account: normalizeAccount(account),
      rawAddress: rawAddress || null,
      ...extractAddressParts(rawAddress),
      filePath: receiptPath,
      pageStart: fromPage,
      pageEnd: toPage,
      sourceHash: upload.sourceHash
    }
  });

  await prisma.unassignedPage.deleteMany({ where: { uploadId, pageNumber: { gte: fromPage, lte: toPage } } });
};

export const normalizeAddressInput = (payload) => ({
  settlement: normalize(payload.settlement || payload.city || ''),
  street: normalize(payload.street || ''),
  house: normalize(payload.house || ''),
  apartment: normalize(payload.apartment || '')
});

export const normalizeText = normalize;
