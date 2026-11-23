export const SELECTED_SYMBOL_STORAGE_KEY = 'stockvalley-selected-symbol';

const normalizeSymbol = (symbol) => String(symbol || '').trim().toUpperCase();

export const getActiveSymbol = () =>
  normalizeSymbol(globalThis.localStorage?.getItem(SELECTED_SYMBOL_STORAGE_KEY));

export const setActiveSymbol = (symbol) => {
  const activeSymbol = normalizeSymbol(symbol);
  globalThis.localStorage?.setItem(SELECTED_SYMBOL_STORAGE_KEY, activeSymbol);
  return activeSymbol;
};
