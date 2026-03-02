import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = path.resolve(process.cwd(), '..');
const demoDir = path.resolve(root, 'demo');

const makePdf = async (fileName, pages) => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = doc.addPage([595, 842]);
    page.drawText('EPD DEMO', { x: 40, y: 790, size: 24, font, color: rgb(0, 0.2, 0.6) });
    page.drawText(text, { x: 40, y: 740, size: 14, font, lineHeight: 20, maxWidth: 500 });
  }
  await fs.writeFile(path.join(demoDir, fileName), await doc.save());
};

await fs.mkdir(demoDir, { recursive: true });
await makePdf('demo-batch-1.pdf', [
  'ACCOUNT: 123456789\nADDRESS: city Primer street Lenina house 10 apartment 5\nCharge 1200',
  'Receipt continuation\nAdditional services',
  'ACCOUNT: 987654321\nADDRESS: city Primer street Mira house 20 apartment 11\nCharge 3300'
]);
await makePdf('demo-batch-2.pdf', [
  'ACCOUNT: 555666777\nADDRESS: city Primer street Gagarina house 2 apartment 8',
  'Page without identifiers for manual mapping'
]);
console.log('Demo PDFs generated');
