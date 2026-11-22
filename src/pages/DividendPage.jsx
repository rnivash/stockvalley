import { useState } from 'react';
import { SymbolSelector } from '../components/SymbolSelector';
import { List } from '../components/Navigation';

export function DividendPage({
  symbolSuggestions = [],
  stockEntries = [],
  dividendEntries = [],
  dividendForm,
  setDividendForm,
  addDividendEntry,
  deleteDividendEntry,
  currency: currencyFormatter,
  formatDate: formatDateFn,
}) {
  const symbols = [...new Set([
    ...symbolSuggestions,
    ...stockEntries.map((item) => item?.symbol),
    ...dividendEntries.map((item) => item?.symbol),
  ])]
    .map((symbol) => String(symbol || '').trim().toUpperCase())
    .filter(Boolean)
    .sort();

  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [isSelectorExpanded, setIsSelectorExpanded] = useState(true);

  const totalDividend = dividendEntries.reduce(
    (total, item) => total + (Number(item.amount) || 0),
    0
  );
  const selectedTotal = selectedSymbol
    ? dividendEntries
      .filter((item) => item.symbol === selectedSymbol)
      .reduce((total, item) => total + (Number(item.amount) || 0), 0)
    : 0;
  const visibleEntries = selectedSymbol
    ? dividendEntries.filter((item) => item.symbol === selectedSymbol)
    : dividendEntries;

  const handleSymbolSelect = (symbol) => {
    setSelectedSymbol(symbol);
    setDividendForm((form) => ({ ...form, symbol }));
  };

  return (
    <section className="panel">
      <h2>Dividends</h2>

      <div className="metric-badges">
        <span className="metric-badge net-profit-good">
          Total Received {currencyFormatter(totalDividend)}
        </span>
        {selectedSymbol && (
          <span className="metric-badge net-profit-good">
            {selectedSymbol} {currencyFormatter(selectedTotal)}
          </span>
        )}
      </div>

      <SymbolSelector
        symbols={symbols}
        selectedSymbol={selectedSymbol}
        onSymbolSelect={handleSymbolSelect}
        onCollapse={() => setIsSelectorExpanded(false)}
        onExpand={() => setIsSelectorExpanded(true)}
        includeAll={false}
      />

      {!isSelectorExpanded && (
        <>
          <form className="form-grid" onSubmit={addDividendEntry}>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Dividend amount"
              value={dividendForm.amount}
              onChange={(event) =>
                setDividendForm((form) => ({ ...form, amount: event.target.value }))
              }
            />
            <input
              type="date"
              value={dividendForm.date}
              onChange={(event) =>
                setDividendForm((form) => ({ ...form, date: event.target.value }))
              }
            />
            <button type="submit">Add Dividend</button>
          </form>

          <List
            emptyText={selectedSymbol
              ? `No dividends recorded for ${selectedSymbol}.`
              : 'No dividends recorded yet.'}
            items={visibleEntries}
            renderItem={(item) => (
              <>
                <div>
                  <strong>{item.symbol}</strong>
                  <p>Date {formatDateFn(item.date)}</p>
                </div>
                <div className="row-end">
                  <strong>{currencyFormatter(item.amount)}</strong>
                  <button
                    type="button"
                    onClick={() => deleteDividendEntry(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          />
        </>
      )}
    </section>
  );
}
