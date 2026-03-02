import { prisma } from '../prisma.js';

export const ensureAdvertisement = async () => {
  const ad = await prisma.advertisement.findFirst();
  if (ad) return;

  await prisma.advertisement.create({
    data: {
      ruText: 'Здесь может быть размещена ваша реклама',
      kzText: 'Мұнда сіздің жарнамаңыз орналастырылуы мүмкін',
      isActive: true,
      rotationSeconds: 5
    }
  });
};

if (process.argv[1]?.includes('seedAd.js')) {
  ensureAdvertisement().finally(() => prisma.$disconnect());
}
