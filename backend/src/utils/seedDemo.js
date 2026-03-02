import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../prisma.js';
import { processUpload } from '../services/pdfProcessor.js';

const run = async () => {
  const demoDir = path.resolve(process.cwd(), '..', 'demo');
  const files = (await fs.readdir(demoDir)).filter((f) => f.endsWith('.pdf'));

  for (const fileName of files) {
    const full = path.join(demoDir, fileName);
    const dest = path.resolve(process.cwd(), '..', 'storage', 'uploads', `${Date.now()}-${fileName}`);
    await fs.copyFile(full, dest);
    const hash = crypto.createHash('sha256').update(await fs.readFile(dest)).digest('hex');
    const upload = await prisma.upload.create({
      data: {
        originalName: fileName,
        storedPath: dest,
        period: '2026-03',
        status: 'queued',
        sourceHash: hash
      }
    });
    await processUpload(upload.id);
  }
};

run().finally(() => prisma.$disconnect());
