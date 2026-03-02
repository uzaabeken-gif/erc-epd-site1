export const toId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const toTrimmed = (value) => String(value ?? '').trim();

export const toNullableUrl = (value) => {
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

export const normalizeAccount = (value) => {
  const raw = toTrimmed(value);
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, '');
  if (digits.length >= 6 && digits.length <= 12) return digits;
  return raw;
};

export const isValidPeriod = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(toTrimmed(value));
