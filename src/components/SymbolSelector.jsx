export function SymbolSelector({
  symbols: inputSymbols,
  symbolSuggestions = [],
  stockEntries = [],
  selectedSymbol = 'ALL',
  onSymbolSelect,
  includeAll = true,
  allLabel = 'All Symbols',
  title = 'Symbols',
}) {
  const sourceSymbols = inputSymbols ?? [
    ...symbolSuggestions,
    ...stockEntries.map((item) => item?.symbol),
  ];
  const symbols = [...new Set(sourceSymbols)]
    .map((symbol) => String(symbol || '').trim().toUpperCase())
    .filter(Boolean)
    .sort();

  if (!symbols.length && !includeAll) return null;

  return (
    <div className="symbol-selector">
      {title ? <span className="symbol-selector-title">{title}</span> : null}
      <div className="symbol-selector-list" role="list" aria-label={title || 'Symbols'}>
        {includeAll && (
          <button
            type="button"
            role="listitem"
            className={`symbol-selector-button${selectedSymbol === 'ALL' ? ' active' : ''}`}
            aria-pressed={selectedSymbol === 'ALL'}
            onClick={() => onSymbolSelect?.('ALL')}
          >
            {allLabel}
          </button>
        )}
        {symbols.map((symbol) => (
          <button
            type="button"
            role="listitem"
            key={symbol}
            className={`symbol-selector-button${selectedSymbol === symbol ? ' active' : ''}`}
            aria-pressed={selectedSymbol === symbol}
            onClick={() => onSymbolSelect?.(symbol)}
          >
            {symbol}
          </button>
        ))}
      </div>
    </div>
  );
}
