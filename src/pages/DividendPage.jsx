import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SymbolSelector } from '../components/SymbolSelector';

export function DividendPage({ symbolSuggestions = [], stockEntries = [] }) {
  const symbols = [...new Set([
    ...symbolSuggestions,
    ...stockEntries.map((item) => item?.symbol),
  ])]
    .map((symbol) => String(symbol || '').trim().toUpperCase())
    .filter(Boolean)
    .sort();

  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [isSelectorExpanded, setIsSelectorExpanded] = useState(true);

  return (
    <section className="panel">
      <h2>Dividends</h2>
      <SymbolSelector
        symbols={symbols}
        selectedSymbol={selectedSymbol}
        onSymbolSelect={setSelectedSymbol}
        onCollapse={() => setIsSelectorExpanded(false)}
        onExpand={() => setIsSelectorExpanded(true)}
        includeAll={false}
      />

      {!isSelectorExpanded && (
        <div className="chart-summary">
          <p>
            {selectedSymbol
              ? `No dividend tracking is configured for ${selectedSymbol}.`
              : 'No dividend tracking is configured yet.'}
          </p>
          <Link className="nav-link" to="/stocks">
            View stock entries
          </Link>
        </div>
      )}
    </section>
  );
}
