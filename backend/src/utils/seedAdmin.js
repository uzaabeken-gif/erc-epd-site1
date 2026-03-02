import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { config } from '../config.js';

export const ensureAdmin = async () => {
  const exists = await prisma.adminUser.findFirst();
  if (exists) return;
  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  await prisma.adminUser.create({ data: { email: config.adminEmail, passwordHash } });
  console.log(`Admin created: ${config.adminEmail}`);
};

if (process.argv[1]?.includes('seedAdmin.js')) {
  ensureAdmin().finally(() => prisma.$disconnect());
}
