export const toId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const toTrimmed = (value) => String(value ?? '').trim();

const normalizeHttpUrl = (value) => {
  const v = toTrimmed(value);
  if (!v) return null;
  try {
    const u = new URL(v);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
};

export const toNullableUrl = (value) => normalizeHttpUrl(value);

export const toUrlList = (value) => {
  const parts = String(value || '')
    .split(/\r?\n|,|;/)
    .map((v) => normalizeHttpUrl(v))
    .filter(Boolean);
  return Array.from(new Set(parts));
};

export const normalizeAccount = (value) => {
  const raw = toTrimmed(value);
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, '');
  if (digits.length >= 6 && digits.length <= 12) return digits;
  return raw;
};

export const extractFirstMatch = (text, regexes = []) => {
  for (const regex of regexes) {
    const match = text.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return null;
};

const accountFallbackRegexes = [
  /(?:л\s*[\/.]?\s*с|лицев(?:ой|ого)\s*сч[её]т(?:\s*абонента)?|account(?:\s*(?:no|number))?)[^\d]{0,10}([0-9][0-9\s-]{5,20})/iu,
  /(?:абонент(?:а|ский)?\s*номер|номер\s*л\/?с)[^\d]{0,10}([0-9][0-9\s-]{5,20})/iu
];

export const extractAccountFromText = (text, regexes = []) => {
  const primary = normalizeAccount(extractFirstMatch(text, regexes));
  if (primary) return primary;

  for (const regex of accountFallbackRegexes) {
    const match = String(text || '').match(regex);
    if (match?.[1]) {
      const normalized = normalizeAccount(match[1]);
      if (normalized) return normalized;
    }
  }

  return null;
};

const addressFallbackRegexes = [
  /(?:адрес\s*(?:объекта|помещения|потребителя)?|address)\s*[:№-]*\s*([^\n]{12,220})/iu,
  /((?:г\.?|город|пос\.?|п\.?|с\.?)[^\n]{8,220}(?:д\.?|дом)\s*[0-9A-Za-zА-Яа-я\/-]{1,10}(?:[^\n]{0,60}(?:кв\.?|квартира)\s*[0-9A-Za-zА-Яа-я\/-]{1,10})?)/iu,
  /((?:ул\.?|улица|пр\.?|проспект|мкр\.?|микрорайон|б-р|бульвар)[^\n]{8,220}(?:д\.?|дом)\s*[0-9A-Za-zА-Яа-я\/-]{1,10}(?:[^\n]{0,60}(?:кв\.?|квартира)\s*[0-9A-Za-zА-Яа-я\/-]{1,10})?)/iu,
  /((?:ул\.?|улица)\s*[\p{L}0-9\-\s]{2,80}\s+дом\s*[0-9A-Za-zА-Яа-я\/-]{1,10}(?:\s+квартира\s*[0-9A-Za-zА-Яа-я\/-]{1,10})?)/iu
];

export const extractAddressFromText = (text, regexes = []) => {
  const direct = extractFirstMatch(text, regexes);
  if (direct) return direct;

  for (const regex of addressFallbackRegexes) {
    const match = String(text || '').match(regex);
    if (match?.[1]) return match[1].trim().replace(/\s+/g, ' ');
  }
  return null;
};

export const isValidPeriod = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(toTrimmed(value));
