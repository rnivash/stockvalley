import { useState } from 'react';

export function SymbolSelector({
  symbolSuggestions = [],
  selectedSymbol = 'ALL',
  onSymbolSelect,
  includeAll = false,  
  onCollapse,
  onExpand,
}) {

  const sourceSymbols = [
    ...symbolSuggestions
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
        <span className="symbol-selector-title">Select Symbol</span>
        <div className="symbol-selector-selected-row">
          <strong className="symbol-selector-selected">{normalizedSelectedSymbol}</strong>
          <button
            type="button"
            className="symbol-selector-edit"
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
      <span className="symbol-selector-title">Select Symbol</span>
      <div className="symbol-selector-list" role="list" >
        {includeAll && (
          <button
            type="button"
            role="listitem"
            className={`symbol-selector-button${normalizedSelectedSymbol === 'ALL' ? ' active' : ''}`}
            aria-pressed={normalizedSelectedSymbol === 'ALL'}
            onClick={() => selectSymbol('ALL')}
          >
            ALL
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
