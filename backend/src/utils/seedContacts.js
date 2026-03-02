import { prisma } from '../prisma.js';

export const ensureContacts = async () => {
  const exists = await prisma.contactInfo.findFirst();
  if (!exists) {
    await prisma.contactInfo.create({
      data: {
        phone: '+7 (700) 000-00-00',
        email: 'support@erc.local',
        address: 'г. Пример, ул. Центральная, 1',
        workHours: 'Пн–Пт 09:00–18:00',
        suppliersText: 'ТОО Теплосеть\nТОО Водоканал\nТОО Электроснабжение'
      }
    });
  }

  const suppliersCount = await prisma.supplier.count();
  if (!suppliersCount) {
    await prisma.supplier.create({
      data: {
        name: 'ТОО Теплосеть',
        description: 'Поставщик услуг теплоснабжения',
        phone: '+7 (701) 111-11-11',
        email: 'teplo@example.kz',
        website: 'https://example.kz/teplo',
        services: {
          create: [
            { title: 'Отопление', description: 'Поставка тепловой энергии', priceInfo: 'по тарифу', isActive: true },
            { title: 'Горячая вода', description: 'Подогрев воды', priceInfo: 'по тарифу', isActive: true }
          ]
        }
      }
    });
  }
};

if (process.argv[1]?.includes('seedContacts.js')) {
  ensureContacts().finally(() => prisma.$disconnect());
}
