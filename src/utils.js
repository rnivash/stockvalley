export const CASH_KEY = 'stockvalley-cash-entries';
export const STOCK_KEY = 'stockvalley-stock-entries';
export const SYMBOL_KEY = 'stockvalley-symbol-suggestions';
export const DP_CHARGES_KEY = 'stockvalley-dp-charge-entries';
export const MANUAL_MAPPINGS_KEY = 'stockvalley-manual-mappings';

export const readStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveStorage = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export const toNumber = (value) => Number(value) || 0;

export const normalizeCreatedAt = (value) => {
  const n = Number(value);
  // Accept only millisecond timestamps; reject legacy small index-like values.
  return Number.isFinite(n) && n > 1_000_000_000_000 ? n : null;
};

export const toDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const toAction = (value) => {
  const action = String(value || '').toLowerCase();
  return action === 'sell' ? 'sell' : 'buy';
};

export const normalizeSymbols = (items) =>
  [
    ...new Set(
      (items || [])
        .map((item) =>
          String(item || '')
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    ),
  ].sort();

export const currency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

export const formatDate = (value) => {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'No date'
    : date.toLocaleDateString('en-IN');
};

export const getDateKey = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = toDate(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getMonthKey = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(0, 7);
  }

  const date = toDate(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const formatMonthLabel = (value) => {
  const [year, month] = String(value || '').split('-');
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return 'Unknown month';
  }

  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
};
