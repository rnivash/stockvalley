import { useState } from 'react';

export function SymbolSelector({
  symbols: inputSymbols,
  symbolSuggestions = [],
  stockEntries = [],
  selectedSymbol = 'ALL',
  onSymbolSelect,
  includeAll = true,
  allLabel = 'All Symbols',
  title = 'Symbols',
  onCollapse,
  onExpand,
}) {
  const sourceSymbols = inputSymbols ?? [
    ...symbolSuggestions,
    ...stockEntries.map((item) => item?.symbol),
  ];
  const normalizedSelectedSymbol = String(selectedSymbol || 'ALL').trim().toUpperCase();
  const symbols = [...new Set(sourceSymbols)]
    .map((symbol) => String(symbol || '').trim().toUpperCase())
    .filter(Boolean)
    .sort();
  const [isExpanded, setIsExpanded] = useState(normalizedSelectedSymbol === 'ALL');

  if (!symbols.length && !includeAll) return null;

  const selectSymbol = (symbol) => {
    onSymbolSelect?.(symbol);
    setIsExpanded(false);
    onCollapse?.(symbol);
  };

  const expandSelector = () => {
    setIsExpanded(true);
    onExpand?.(normalizedSelectedSymbol);
  };

  if (!isExpanded) {
    return (
      <div className="symbol-selector symbol-selector-collapsed">
        {title ? <span className="symbol-selector-title">{title}</span> : null}
        <div className="symbol-selector-selected-row">
          <strong className="symbol-selector-selected">{normalizedSelectedSymbol}</strong>
          <button
            type="button"
            className="symbol-selector-edit"
            aria-label={`Edit ${title || 'symbol'} selection`}
            onClick={expandSelector}
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="symbol-selector">
      {title ? <span className="symbol-selector-title">{title}</span> : null}
      <div className="symbol-selector-list" role="list" aria-label={title || 'Symbols'}>
        {includeAll && (
          <button
            type="button"
            role="listitem"
            className={`symbol-selector-button${normalizedSelectedSymbol === 'ALL' ? ' active' : ''}`}
            aria-pressed={normalizedSelectedSymbol === 'ALL'}
            onClick={() => selectSymbol('ALL')}
          >
            {allLabel}
          </button>
        )}
        {symbols.map((symbol) => (
          <button
            type="button"
            role="listitem"
            key={symbol}
            className={`symbol-selector-button${normalizedSelectedSymbol === symbol ? ' active' : ''}`}
            aria-pressed={normalizedSelectedSymbol === symbol}
            onClick={() => selectSymbol(symbol)}
          >
            {symbol}
          </button>
        ))}
      </div>
    </div>
  );
}
