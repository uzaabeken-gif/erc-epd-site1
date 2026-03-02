import { createContext, useContext, useMemo, useState } from 'react';

const messages = {
  ru: {
    navHome: 'Главная',
    navGet: 'Получить ЕПД',
    navContacts: 'Контакты',
    adminLogin: 'Админ вход',
    brandTitle: 'Единый расчетный центр',
    brandSubtitle: 'Официальный сервис получения ЕПД',
    footerCopyright: 'ЕРЦ ЕПД',
    langRu: 'РУС',
    langKz: 'ҚАЗ',

    homeEyebrow: 'Единый расчетный центр (ЕПД)',
    homeTitle: 'Быстрый доступ к вашей квитанции',
    homeDesc: 'Получите ЕПД онлайн за минуту: найдите квитанцию по лицевому счету или адресу, просмотрите документ прямо на сайте и скачайте PDF.',
    featureSearchTitle: 'Простой поиск',
    featureSearchDesc: 'Два режима на выбор: по лицевому счёту или по адресу.',
    featureViewerTitle: 'Просмотр в браузере',
    featureViewerDesc: 'PDF открывается в удобном просмотрщике, адаптированном для телефона.',
    featureSecureTitle: 'Безопасно',
    featureSecureDesc: 'Сервис защищен, а административная часть доступна только по логину и паролю.',
    howToTitle: 'Как пользоваться',
    howToStep1: 'Откройте страницу «Получить ЕПД».',
    howToStep2: 'Заполните данные и нажмите кнопку «Загрузить».',
    howToStep3: 'Проверьте результат, откройте и скачайте PDF.',

    getTitle: 'Получить ЕПД',
    getIntro: 'Выберите удобный вариант поиска и получите квитанцию за нужный расчетный период.',
    periodLabel: 'Период',
    latestPeriod: 'Последний доступный',
    accountLabel: 'Лицевой счет',
    accountPlaceholder: 'Например, 123456789',
    settlement: 'Населённый пункт',
    street: 'Улица',
    house: 'Дом',
    apartment: 'Квартира',
    settlementPlaceholder: 'Например, Пример',
    searchError: 'Ошибка поиска',
    receiptsFound: 'Найдено квитанций',
    chooseReceipt: 'Выберите нужный документ из загруженных общих PDF-файлов:',
    unknownFile: 'Файл неизвестен',
    periodResult: 'Результат за период',
    sourcePages: 'Источник',
    unknown: 'неизвестно',
    downloadPdf: 'Скачать PDF',
    viewerLoading: 'Загрузка PDF...',
    viewerError: 'Не удалось загрузить PDF. Попробуйте скачать файл.',
    searchByAccount: 'По лицевому счёту',
    searchByAddress: 'По адресу',
    uploadBtn: 'Загрузить',
    searching: 'Поиск...',
    notFound: 'Квитанция по указанным данным не найдена. Проверьте правильность введенного лицевого счета или адреса',

    contactsTitle: 'Контакты',
    contactsIntro: 'Назначение сервиса — предоставить жителям удобный доступ к ЕПД в электронном виде.',
    contactPhone: 'Телефон',
    contactEmail: 'Email',
    contactWorkHours: 'Режим работы',
    contactServiceAddress: 'Адрес обслуживания',
    suppliersTitle: 'Поставщики услуг',
    suppliersSearchLabel: 'Поиск поставщика',
    suppliersSearchPlaceholder: 'Введите название поставщика',
    suppliersSelectLabel: 'Выберите поставщика',
    suppliersNotFound: 'По запросу ничего не найдено.',
    supplierWebsite: 'Сайт',
    supplierServices: 'Услуги',
    supplierServicesEmpty: 'Услуги не указаны.',
    supplierFallbackTitle: 'Поставщики из справочника',

    adBlockLabel: 'Рекламный блок',
    adImageAlt: 'Реклама',

    adminTitle: 'Админ-панель',
    recognitionTitle: 'Проверка распознавания'
  },
  kz: {
    navHome: 'Басты бет',
    navGet: 'ЕПД алу',
    navContacts: 'Байланыс',
    adminLogin: 'Әкімші кіруі',
    brandTitle: 'Бірыңғай есеп айырысу орталығы',
    brandSubtitle: 'ЕПД алуға арналған ресми сервис',
    footerCopyright: 'ЕРЦ ЕПД',
    langRu: 'РУС',
    langKz: 'ҚАЗ',

    homeEyebrow: 'Бірыңғай есеп айырысу орталығы (ЕПД)',
    homeTitle: 'Төлем құжатына жылдам қолжетімділік',
    homeDesc: 'ЕПД-ны онлайн алыңыз: жеке шот немесе мекенжай бойынша тауып, құжатты сайтта қарап, PDF файлын жүктеп алыңыз.',
    featureSearchTitle: 'Қарапайым іздеу',
    featureSearchDesc: 'Екі тәсіл бар: жеке шот немесе мекенжай бойынша.',
    featureViewerTitle: 'Браузерде қарау',
    featureViewerDesc: 'PDF мобильді құрылғыларға бейімделген ыңғайлы қарау режимінде ашылады.',
    featureSecureTitle: 'Қауіпсіз',
    featureSecureDesc: 'Сервис қорғалған, ал әкімші бөлігі тек логин мен пароль арқылы ашылады.',
    howToTitle: 'Қалай пайдалану керек',
    howToStep1: '«ЕПД алу» бетіне өтіңіз.',
    howToStep2: 'Деректерді толтырып, «Жүктеу» түймесін басыңыз.',
    howToStep3: 'Нәтижені тексеріп, PDF файлын ашыңыз және жүктеңіз.',

    getTitle: 'ЕПД алу',
    getIntro: 'Іздеудің ыңғайлы тәсілін таңдап, қажетті есептік кезең үшін түбіртекті алыңыз.',
    periodLabel: 'Кезең',
    latestPeriod: 'Соңғы қолжетімді',
    accountLabel: 'Жеке шот',
    accountPlaceholder: 'Мысалы, 123456789',
    settlement: 'Елді мекен',
    street: 'Көше',
    house: 'Үй',
    apartment: 'Пәтер',
    settlementPlaceholder: 'Мысалы, Пример',
    searchError: 'Іздеу қатесі',
    receiptsFound: 'Табылған түбіртектер',
    chooseReceipt: 'Жүктелген жалпы PDF файлдардан қажетті құжатты таңдаңыз:',
    unknownFile: 'Белгісіз файл',
    periodResult: 'Кезең бойынша нәтиже',
    sourcePages: 'Дереккөз',
    unknown: 'белгісіз',
    downloadPdf: 'PDF жүктеу',
    viewerLoading: 'PDF жүктелуде...',
    viewerError: 'PDF жүктеу сәтсіз аяқталды. Файлды жүктеп көріңіз.',
    searchByAccount: 'Жеке шот бойынша',
    searchByAddress: 'Мекенжай бойынша',
    uploadBtn: 'Жүктеу',
    searching: 'Іздеу...',
    notFound: 'Көрсетілген деректер бойынша түбіртек табылмады. Жеке шот немесе мекенжай деректерін тексеріңіз',

    contactsTitle: 'Байланыс',
    contactsIntro: 'Сервистің мақсаты — тұрғындарға ЕПД-ға электронды түрде ыңғайлы қолжетімділік беру.',
    contactPhone: 'Телефон',
    contactEmail: 'Email',
    contactWorkHours: 'Жұмыс уақыты',
    contactServiceAddress: 'Қызмет көрсету мекенжайы',
    suppliersTitle: 'Қызмет жеткізушілері',
    suppliersSearchLabel: 'Жеткізушіні іздеу',
    suppliersSearchPlaceholder: 'Жеткізуші атауын енгізіңіз',
    suppliersSelectLabel: 'Жеткізушіні таңдаңыз',
    suppliersNotFound: 'Сұрау бойынша ештеңе табылмады.',
    supplierWebsite: 'Сайт',
    supplierServices: 'Қызметтер',
    supplierServicesEmpty: 'Қызметтер көрсетілмеген.',
    supplierFallbackTitle: 'Анықтамалықтағы жеткізушілер',

    adBlockLabel: 'Жарнама блогы',
    adImageAlt: 'Жарнама',

    adminTitle: 'Әкімші панелі',
    recognitionTitle: 'Тану тексерісі'
  }
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'ru');
  const value = useMemo(() => ({
    lang,
    setLang: (next) => {
      localStorage.setItem('lang', next);
      setLang(next);
    },
    t: (key) => messages[lang]?.[key] || messages.ru[key] || key
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
