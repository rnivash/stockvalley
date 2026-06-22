import { useEffect, useMemo, useState } from 'react';
import { dump, load } from 'js-yaml';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

const CASH_KEY = 'stockvalley-cash-entries';
const STOCK_KEY = 'stockvalley-stock-entries';
const SYMBOL_KEY = 'stockvalley-symbol-suggestions';
const DP_CHARGES_KEY = 'stockvalley-dp-charge-entries';
const MANUAL_MAPPINGS_KEY = 'stockvalley-manual-mappings';

const readStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const toNumber = (value) => Number(value) || 0;

const normalizeCreatedAt = (value) => {
  const n = Number(value);
  // Accept only millisecond timestamps; reject legacy small index-like values.
  return Number.isFinite(n) && n > 1_000_000_000_000 ? n : null;
};

const toDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toAction = (value) => {
  const action = String(value || '').toLowerCase();
  return action === 'sell' ? 'sell' : 'buy';
};

const normalizeStockEntries = (items) =>
  items
    .map((item, index) => {
      if (item?.action && typeof item.price !== 'undefined') {
        return {
          ...item,
          action: toAction(item.action),
          symbol: String(item.symbol || '')
            .trim()
            .toUpperCase(),
          quantity: toNumber(item.quantity),
          price: toNumber(item.price),
          charges: toNumber(item.charges),
          dpCharges: toNumber(item.dpCharges),
          createdAt: normalizeCreatedAt(item.createdAt),
        };
      }
      if (typeof item?.buyPrice !== 'undefined') {
        return {
          ...item,
          action: 'buy',
          symbol: String(item.symbol || '')
            .trim()
            .toUpperCase(),
          quantity: toNumber(item.quantity),
          price: toNumber(item.buyPrice),
          charges: toNumber(item.charges),
          dpCharges: toNumber(item.dpCharges),
          createdAt: normalizeCreatedAt(item.createdAt),
        };
      }
      return null;
    })
    .filter(Boolean);

const normalizeSymbols = (items) =>
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

const currency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value) => {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'No date'
    : date.toLocaleDateString('en-IN');
};

const getDateKey = (value) => {
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

const getMonthKey = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(0, 7);
  }

  const date = toDate(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatMonthLabel = (value) => {
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

const toDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const formatTradeStamp = (item, currencyFormatter) => {
  const date = new Date(item.date);
  const dateMonth = Number.isNaN(date.getTime())
    ? 'No date'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  return `(${currencyFormatter(item.price)} * ${item.quantity} / ${dateMonth})`;
};

const formatDateMonth = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'No date'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const formatQtyPrice = (item, currencyFormatter) =>
  `${item.quantity} x ${currencyFormatter(item.price)}`;

const sortTrades = (items) =>
  [...items].sort((a, b) => {
    const aTime = toDateTime(a.date);
    const bTime = toDateTime(b.date);
    if (aTime !== bTime) return aTime - bTime;

    const aCreated = Number(a.createdAt) || 0;
    const bCreated = Number(b.createdAt) || 0;
    if (aCreated !== bCreated) return aCreated - bCreated;

    return String(a.id).localeCompare(String(b.id));
  });

function Card({ label, value, tone = 'normal' }) {
  return (
    <article className={`card ${tone}`}>
      <small>{label}</small>
      <h3>{value}</h3>
    </article>
  );
}

function List({
  items,
  renderItem,
  emptyText,
  onItemClick,
  isItemClickable = false,
}) {
  if (!items.length) return <p className="empty">{emptyText}</p>;

  return (
    <ul className="list">
      {items.map((item) => (
        <li
          key={item.id}
          className={`list-row${isItemClickable ? ' clickable-row' : ''}`}
          onClick={onItemClick ? () => onItemClick(item) : undefined}
        >
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

function AppNav() {
  return (
    <section className="nav-wrap">
      <p className="nav-title">Navigate</p>
      <nav className="app-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-label">Dashboard</span>
          <small className="nav-hint">Total amount and P/L</small>
        </NavLink>
        <NavLink
          to="/money"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-label">Money Movement</span>
          <small className="nav-hint">Add and view entries</small>
        </NavLink>
        <NavLink
          to="/stocks"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-label">Stock Entries</span>
          <small className="nav-hint">Add and view trades</small>
        </NavLink>
        <NavLink
          to="/dp-charges"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-label">DP Charges</span>
          <small className="nav-hint">Add delivery charges</small>
        </NavLink>
        <NavLink
          to="/symbol-pnl"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-label">Symbol P/L</span>
          <small className="nav-hint">Closed qty averages</small>
        </NavLink>
        <NavLink
          to="/monthly-pnl"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-label">Monthly P/L</span>
          <small className="nav-hint">Profit and gain % trend</small>
        </NavLink>
        <NavLink
          to="/daily-pnl"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-label">Daily P/L</span>
          <small className="nav-hint">Day-wise profit breakdown</small>
        </NavLink>
        <NavLink
          to="/buy-sell-mapping"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-label">Buy-Sell Mapping</span>
          <small className="nav-hint">Match buys and sells</small>
        </NavLink>
        <NavLink
          to="/data-yaml"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-label">Data YAML</span>
          <small className="nav-hint">Import or export all data</small>
        </NavLink>
      </nav>
    </section>
  );
}

function DashboardPage({ totals, currency: currencyFormatter }) {
  return (
    <>
      <section className="summary-grid">
        <Card
          label="Money I Invested"
          value={currencyFormatter(totals.netFundsOnly)}
        />
        <article className={`card ${totals.pnl >= 0 ? 'good' : 'bad'}`}>
          <small>Profit / Loss</small>
          <p className="card-subline">
            {currencyFormatter(totals.closedTradeDiffWithoutCharges)} - (
            {currencyFormatter(totals.closedTradeCharges)} +{' '}
            {currencyFormatter(totals.totalDpCharges)})
          </p>
          <h3>{currencyFormatter(totals.pnl)}</h3>
        </article>
        <Card
          label="Total worth"
          value={currencyFormatter(totals.netFundsOnly + totals.pnl)}
          tone={totals.netFundsOnly + totals.pnl >= 0 ? 'good' : 'bad'}
        />
        <Card
          label="Balance Amount for Trade"
          value={currencyFormatter(totals.projectedAmount)}
          tone={totals.projectedAmount >= 0 ? 'good' : 'bad'}
        />
      </section>

      <section className="panel">
        <h2>Stock Wise Invested Money</h2>
        {totals.allocationLegend.length ? (
          <div className="allocation-wrap">
            <div
              className="allocation-pie"
              style={{ background: totals.allocationGradient }}
            />
            <ul className="allocation-legend">
              {totals.allocationLegend.map((item) => (
                <li key={item.label}>
                  <span
                    className="dot"
                    style={{ backgroundColor: item.color }}
                  />
                  <div>
                    <strong>{item.label}</strong>
                    <p>
                      {currencyFormatter(item.value)} ({item.percent.toFixed(1)}
                      %)
                    </p>
                    {item.quantity !== null && item.avgPrice !== null && (
                      <p className="allocation-details">
                        Qty {item.quantity} | Avg Price{' '}
                        {currencyFormatter(item.avgPrice)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="empty">No active stock investments yet.</p>
        )}
      </section>
    </>
  );
}

function MoneyPage({
  cashForm,
  setCashForm,
  addCashEntry,
  sortedCashEntries,
  deleteCashEntry,
  currency: currencyFormatter,
  formatDate: formatDateFn,
}) {
  return (
    <section className="panel">
      <h2>Money Movement</h2>
      <form className="form-grid" onSubmit={addCashEntry}>
        <select
          value={cashForm.type}
          onChange={(e) => setCashForm((f) => ({ ...f, type: e.target.value }))}
        >
          <option value="deposit">Deposit</option>
          <option value="withdraw">Withdraw</option>
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={cashForm.amount}
          onChange={(e) =>
            setCashForm((f) => ({ ...f, amount: e.target.value }))
          }
        />
        <input
          type="text"
          placeholder="Note (optional)"
          value={cashForm.note}
          onChange={(e) => setCashForm((f) => ({ ...f, note: e.target.value }))}
        />
        <input
          type="date"
          value={cashForm.date}
          onChange={(e) => setCashForm((f) => ({ ...f, date: e.target.value }))}
        />
        <button type="submit">Add Entry</button>
      </form>

      <List
        emptyText="No money entries yet."
        items={sortedCashEntries}
        renderItem={(item) => (
          <>
            <div>
              <strong>
                {item.type === 'deposit' ? 'Deposit' : 'Withdraw'}
              </strong>
              <p>
                {item.note || 'No note'} | Date {formatDateFn(item.date)}
              </p>
            </div>
            <div className="row-end money-row-end">
              <button
                className="close-btn"
                onClick={() => deleteCashEntry(item.id)}
                aria-label="Delete entry"
              >
                X
              </button>
              <strong>{currencyFormatter(item.amount)}</strong>
            </div>
          </>
        )}
      />
    </section>
  );
}

function DpChargesPage({
  dpChargeForm,
  setDpChargeForm,
  addDpChargeEntry,
  dpChargeEntries,
  deleteDpChargeEntry,
  currency: currencyFormatter,
  formatDate: formatDateFn,
}) {
  return (
    <section className="panel">
      <h2>DP Charges</h2>
      <form className="form-grid" onSubmit={addDpChargeEntry}>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="DP Charge Amount"
          value={dpChargeForm.amount}
          onChange={(e) =>
            setDpChargeForm((f) => ({ ...f, amount: e.target.value }))
          }
        />
        <input
          type="text"
          placeholder="Note (optional)"
          value={dpChargeForm.note}
          onChange={(e) =>
            setDpChargeForm((f) => ({ ...f, note: e.target.value }))
          }
        />
        <input
          type="date"
          value={dpChargeForm.date}
          onChange={(e) =>
            setDpChargeForm((f) => ({ ...f, date: e.target.value }))
          }
        />
        <button type="submit">Add DP Charge</button>
      </form>

      <List
        emptyText="No DP charges yet."
        items={dpChargeEntries}
        renderItem={(item) => (
          <>
            <div>
              <strong>DP Charge</strong>
              <p>
                {item.note || 'No note'} | Date {formatDateFn(item.date)}
              </p>
            </div>
            <div className="row-end">
              <strong>{currencyFormatter(item.amount)}</strong>
              <button onClick={() => deleteDpChargeEntry(item.id)}>
                Delete
              </button>
            </div>
          </>
        )}
      />
    </section>
  );
}

function StocksPage({
  stockForm,
  setStockForm,
  addStockEntry,
  stockFilter,
  setStockFilter,
  stockFilterOptions,
  filteredStockEntries,
  startStockEdit,
  editingStockId,
  editStockForm,
  setEditStockForm,
  saveStockEdit,
  cancelStockEdit,
  deleteStockEntry,
  currency: currencyFormatter,
  formatDate: formatDateFn,
  filteredSymbolSuggestions,
}) {
  return (
    <section className="panel">
      <h2>Stock Entries</h2>
      <form className="form-grid" onSubmit={addStockEntry}>
        <div className="action-checks">
          <label>
            <input
              type="checkbox"
              checked={stockForm.action === 'buy'}
              onChange={() => setStockForm((f) => ({ ...f, action: 'buy' }))}
            />
            Buy
          </label>
          <label>
            <input
              type="checkbox"
              checked={stockForm.action === 'sell'}
              onChange={() => setStockForm((f) => ({ ...f, action: 'sell' }))}
            />
            Sell
          </label>
        </div>
        <input
          type="text"
          placeholder="Symbol (e.g. AAPL)"
          list="stock-symbol-suggestions"
          value={stockForm.symbol}
          onChange={(e) =>
            setStockForm((f) => ({ ...f, symbol: e.target.value }))
          }
        />
        <input
          type="number"
          min="0"
          step="0.0001"
          placeholder="Quantity"
          value={stockForm.quantity}
          onChange={(e) =>
            setStockForm((f) => ({ ...f, quantity: e.target.value }))
          }
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Price"
          value={stockForm.price}
          onChange={(e) =>
            setStockForm((f) => ({ ...f, price: e.target.value }))
          }
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Charges"
          value={stockForm.charges}
          onChange={(e) =>
            setStockForm((f) => ({ ...f, charges: e.target.value }))
          }
        />
        <input
          type="date"
          value={stockForm.date}
          onChange={(e) =>
            setStockForm((f) => ({ ...f, date: e.target.value }))
          }
        />
        <button type="submit">Add Stock</button>
      </form>

      <div className="stock-filter-row">
        <label htmlFor="stock-symbol-filter">Filter by Symbol</label>
        <select
          id="stock-symbol-filter"
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
        >
          <option value="ALL">All Symbols</option>
          {stockFilterOptions.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>
      </div>

      <List
        emptyText={
          stockFilter === 'ALL'
            ? 'No stock entries yet.'
            : `No entries for ${stockFilter}.`
        }
        items={filteredStockEntries}
        onItemClick={(item) => startStockEdit(item)}
        isItemClickable
        renderItem={(item) => {
          if (editingStockId === item.id) {
            return (
              <>
                <div className="edit-fields">
                  <select
                    value={editStockForm.action}
                    onChange={(e) =>
                      setEditStockForm((f) => ({
                        ...f,
                        action: e.target.value,
                      }))
                    }
                  >
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Symbol"
                    list="stock-symbol-suggestions"
                    value={editStockForm.symbol}
                    onChange={(e) =>
                      setEditStockForm((f) => ({
                        ...f,
                        symbol: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="Quantity"
                    value={editStockForm.quantity}
                    onChange={(e) =>
                      setEditStockForm((f) => ({
                        ...f,
                        quantity: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    value={editStockForm.price}
                    onChange={(e) =>
                      setEditStockForm((f) => ({ ...f, price: e.target.value }))
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Charges"
                    value={editStockForm.charges}
                    onChange={(e) =>
                      setEditStockForm((f) => ({
                        ...f,
                        charges: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="date"
                    value={editStockForm.date}
                    onChange={(e) =>
                      setEditStockForm((f) => ({ ...f, date: e.target.value }))
                    }
                  />
                </div>
                <div className="row-end">
                  <button
                    className="save-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      saveStockEdit(item.id);
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="cancel-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      cancelStockEdit();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            );
          }

          const action = toAction(item.action);
          const charges = toNumber(item.charges);
          const tradeValue = toNumber(item.quantity) * toNumber(item.price);
          const netValue =
            action === 'buy' ? -(tradeValue + charges) : tradeValue - charges;
          return (
            <>
              <div>
                <strong>{item.symbol}</strong>
                <p>
                  {action === 'buy' ? 'Buy' : 'Sell'} | Qty {item.quantity} |
                  Price {currencyFormatter(item.price)} | Charges{' '}
                  {currencyFormatter(charges)} | Date {formatDateFn(item.date)}
                </p>
              </div>
              <div className="row-end stock-row-end">
                <button
                  className="close-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteStockEntry(item.id);
                  }}
                  aria-label="Delete stock entry"
                >
                  X
                </button>
                <strong>{currencyFormatter(netValue)}</strong>
              </div>
            </>
          );
        }}
      />

      <datalist id="stock-symbol-suggestions">
        {filteredSymbolSuggestions.map((symbol) => (
          <option key={symbol} value={symbol} />
        ))}
      </datalist>
    </section>
  );
}

function SymbolPnlPage({ symbolProfitLossRows, currency: currencyFormatter }) {
  return (
    <section className="panel">
      <h2>Profit / Loss By Symbol</h2>
      {symbolProfitLossRows.length ? (
        <div className="symbol-pnl-grid">
          {symbolProfitLossRows.map((item) => (
            <article key={item.symbol} className="symbol-pnl-card">
              <div className="symbol-pnl-head">
                <strong>{item.symbol}</strong>
                <strong
                  className={item.difference >= 0 ? 'cell-good' : 'cell-bad'}
                >
                  {currencyFormatter(item.difference)}
                </strong>
              </div>
              <div className="symbol-pnl-meta">
                <p>
                  <span>Avg. Sell price</span>
                  <strong>{currencyFormatter(item.avgSellPrice)}</strong>
                </p>
                <p>
                  <span>Avg Buy price</span>
                  <strong>{currencyFormatter(item.avgBuyPrice)}</strong>
                </p>
                <p>
                  <span>Quantity</span>
                  <strong>{item.quantity}</strong>
                </p>
                <p>
                  <span>Charges</span>
                  <strong>{currencyFormatter(item.charges)}</strong>
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">
          No closed trades yet to calculate symbol-wise profit/loss.
        </p>
      )}
    </section>
  );
}

function MonthlyPnlPage({
  monthlyPerformanceRows,
  currency: currencyFormatter,
}) {
  const maxAbsGainPercent = useMemo(
    () =>
      monthlyPerformanceRows.reduce(
        (max, item) =>
          Math.max(
            max,
            Math.abs(item.gainPercent === null ? 0 : item.gainPercent)
          ),
        0
      ),
    [monthlyPerformanceRows]
  );

  const formatPercent = (value) => {
    if (value === null) return 'N/A';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <section className="panel monthly-pnl-page">
      <h2>Month Wise Overall Profit / Loss</h2>
      <p className="chart-summary">
        Net P/L includes realized trade P/L and DP charges. Gain % is calculated
        as net P/L divided by cumulative net funds (carry-forward of monthly
        fund added minus withdrawn).
      </p>

      {monthlyPerformanceRows.length ? (
        <section className="monthly-chart-wrap">
          <h3>Monthly Gain Percentage</h3>
          <div className="monthly-chart-list">
            {monthlyPerformanceRows.map((item) => {
              const gainValue =
                item.gainPercent === null ? 0 : item.gainPercent;
              const gainWidth =
                maxAbsGainPercent > 0
                  ? `${(Math.abs(gainValue) / maxAbsGainPercent) * 100}%`
                  : '0%';

              return (
                <article
                  key={`${item.monthKey}-gain`}
                  className="monthly-chart-row"
                >
                  <div className="monthly-row-head">
                    <strong>{formatMonthLabel(item.monthKey)}</strong>
                    <strong
                      className={gainValue >= 0 ? 'cell-good' : 'cell-bad'}
                    >
                      {formatPercent(item.gainPercent)} |{' '}
                      {currencyFormatter(item.netPnl)}
                    </strong>
                  </div>
                  <div className="monthly-bar-track">
                    <div className="monthly-bar-side left">
                      {gainValue < 0 ? (
                        <span
                          className="monthly-bar negative"
                          style={{ width: gainWidth }}
                        />
                      ) : null}
                    </div>
                    <div className="monthly-bar-side right">
                      {gainValue >= 0 ? (
                        <span
                          className="monthly-bar positive"
                          style={{ width: gainWidth }}
                        />
                      ) : null}
                    </div>
                  </div>
                  <p className="monthly-row-meta">
                    {(() => {
                      const fdInterest = (item.netFunds * 0.06) / 12;
                      const diffPercent =
                        fdInterest !== 0
                          ? ((item.netPnl - fdInterest) / fdInterest) * 100
                          : 0;
                      return `Net Funds ${currencyFormatter(
                        item.netFunds
                      )} | FD Interest (6% p.a./month) ${currencyFormatter(
                        fdInterest
                      )} | vs P/L ${currencyFormatter(
                        item.netPnl
                      )} | Difference ${formatPercent(diffPercent)}`;
                    })()}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="empty">No monthly trade data available yet.</p>
      )}
    </section>
  );
}

function BuySellMappingPage({
  symbolProfitLoss,
  stockEntries,
  manualMappings,
  onAddMapping,
  onRemoveMapping,
  onResetSymbol,
  currency: currencyFormatter,
  formatDate: formatDateFn,
}) {
  const [expandedSymbol, setExpandedSymbol] = useState(null);
  const [selectedBuyId, setSelectedBuyId] = useState(null);
  const [selectedSellId, setSelectedSellId] = useState(null);

  const handleAddLink = () => {
    if (!selectedBuyId || !selectedSellId) return;
    const buyTx = stockEntries.find((s) => s.id === selectedBuyId);
    const sellTx = stockEntries.find((s) => s.id === selectedSellId);
    if (!buyTx || !sellTx) return;

    // Calculate allocated quantities for these transactions
    const buyAllocated = manualMappings
      .filter((m) => m.buyId === selectedBuyId)
      .reduce((sum, m) => sum + m.qty, 0);
    const sellAllocated = manualMappings
      .filter((m) => m.sellId === selectedSellId)
      .reduce((sum, m) => sum + m.qty, 0);

    const buyRemaining = buyTx.quantity - buyAllocated;
    const sellRemaining = sellTx.quantity - sellAllocated;

    const qty = Math.min(buyRemaining, sellRemaining);
    onAddMapping({ buyId: selectedBuyId, sellId: selectedSellId, qty });
    setSelectedBuyId(null);
    setSelectedSellId(null);
  };

  const symbols = (
    symbolProfitLoss ? Object.keys(symbolProfitLoss) : []
  ).sort();

  return (
    <section className="panel">
      <h2>Buy-Sell Mapping</h2>
      <p className="chart-summary">
        Manually link buy and sell transactions to define which sales correspond
        to which purchases.
      </p>

      {symbols.length ? (
        <div className="mapping-summary-table">
          {symbols.map((symbol) => {
            const isExpanded = expandedSymbol === symbol;
            const symbolBuys = stockEntries.filter(
              (item) =>
                item.symbol === symbol && toAction(item.action) === 'buy'
            );
            const symbolSells = stockEntries.filter(
              (item) =>
                item.symbol === symbol && toAction(item.action) === 'sell'
            );
            const mappingsForSymbol = manualMappings.filter(
              (m) => m.symbol === symbol
            );

            // Calculate allocated quantities and total P/L
            const buyAllocated = {}; // Map of buyId -> allocated qty
            const sellAllocated = {}; // Map of sellId -> allocated qty
            let totalLinkedPL = 0;

            mappingsForSymbol.forEach((link) => {
              buyAllocated[link.buyId] =
                (buyAllocated[link.buyId] || 0) + link.qty;
              sellAllocated[link.sellId] =
                (sellAllocated[link.sellId] || 0) + link.qty;

              const buyTx = stockEntries.find((s) => s.id === link.buyId);
              const sellTx = stockEntries.find((s) => s.id === link.sellId);

              if (buyTx && sellTx) {
                const buyCost =
                  link.qty * buyTx.price +
                  (buyTx.charges * link.qty) / buyTx.quantity;
                const sellValue =
                  link.qty * sellTx.price -
                  (sellTx.charges * link.qty) / sellTx.quantity;
                totalLinkedPL += sellValue - buyCost;
              }
            });

            // Filter unlinked transactions (those with remaining qty after allocations)
            const unlinkedBuys = symbolBuys.filter((b) => {
              const allocated = buyAllocated[b.id] || 0;
              return allocated < b.quantity;
            });
            const unlinkedSells = symbolSells.filter((s) => {
              const allocated = sellAllocated[s.id] || 0;
              return allocated < s.quantity;
            });

            // Calculate average buy price for open stock
            let totalUnlinkedBuyQty = 0;
            let totalUnlinkedBuyValue = 0;

            unlinkedBuys.forEach((buy) => {
              const allocated = buyAllocated[buy.id] || 0;
              const remaining = buy.quantity - allocated;
              totalUnlinkedBuyQty += remaining;
              totalUnlinkedBuyValue +=
                remaining * buy.price +
                (buy.charges * remaining) / buy.quantity;
            });

            const avgOpenBuyPrice =
              totalUnlinkedBuyQty > 0
                ? totalUnlinkedBuyValue / totalUnlinkedBuyQty
                : 0;

            return (
              <div key={symbol} className="mapping-card">
                <div
                  className="mapping-header"
                  onClick={() => setExpandedSymbol(isExpanded ? null : symbol)}
                >
                  <div className="mapping-header-main">
                    <strong className="symbol-label">{symbol}</strong>
                  </div>
                  <div className="mapping-header-end">
                    {totalUnlinkedBuyQty > 0 && (
                      <span>
                        {totalUnlinkedBuyQty} *{' '}
                        {currencyFormatter(avgOpenBuyPrice)}
                      </span>
                    )}
                    <strong
                      className={totalLinkedPL >= 0 ? 'cell-good' : 'cell-bad'}
                    >
                      {currencyFormatter(totalLinkedPL)}
                    </strong>
                    <span className="expand-icon">
                      {isExpanded ? '−' : '+'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mapping-details">
                    <div className="mapping-transactions">
                      <h4>Unlinked Buy Transactions ({unlinkedBuys.length})</h4>
                      {unlinkedBuys.length > 0 ? (
                        <ul className="tx-list">
                          {unlinkedBuys.map((buy) => {
                            const allocated = buyAllocated[buy.id] || 0;
                            const remaining = buy.quantity - allocated;
                            return (
                              <li
                                key={buy.id}
                                className={`tx-item ${selectedBuyId === buy.id ? 'selected' : ''
                                  }`}
                                onClick={() => setSelectedBuyId(buy.id)}
                              >
                                <div>
                                  <span className="tx-qty">
                                    Qty: {remaining} / {buy.quantity}
                                  </span>
                                  <span className="tx-price">
                                    {currencyFormatter(buy.price)}
                                  </span>
                                  <span className="tx-date">
                                    {formatDateFn(buy.date)}
                                  </span>
                                </div>
                                <div className="tx-value">
                                  {currencyFormatter(
                                    remaining * buy.price +
                                    (buy.charges * remaining) / buy.quantity
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="no-transactions">
                          All buy transactions are fully linked.
                        </p>
                      )}

                      <h4>
                        Unlinked Sell Transactions ({unlinkedSells.length})
                      </h4>
                      {unlinkedSells.length > 0 ? (
                        <ul className="tx-list">
                          {unlinkedSells.map((sell) => {
                            const allocated = sellAllocated[sell.id] || 0;
                            const remaining = sell.quantity - allocated;
                            return (
                              <li
                                key={sell.id}
                                className={`tx-item ${selectedSellId === sell.id ? 'selected' : ''
                                  }`}
                                onClick={() => setSelectedSellId(sell.id)}
                              >
                                <div>
                                  <span className="tx-qty">
                                    Qty: {remaining} / {sell.quantity}
                                  </span>
                                  <span className="tx-price">
                                    {currencyFormatter(sell.price)}
                                  </span>
                                  <span className="tx-date">
                                    {formatDateFn(sell.date)}
                                  </span>
                                </div>
                                <div className="tx-value">
                                  {currencyFormatter(
                                    remaining * sell.price -
                                    (sell.charges * remaining) / sell.quantity
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="no-transactions">
                          All sell transactions are fully linked.
                        </p>
                      )}
                    </div>

                    <div className="mapping-control">
                      {selectedBuyId &&
                        selectedSellId &&
                        (() => {
                          const buyTx = stockEntries.find(
                            (s) => s.id === selectedBuyId
                          );
                          const sellTx = stockEntries.find(
                            (s) => s.id === selectedSellId
                          );
                          if (!buyTx || !sellTx) return null;

                          const buyAllocatedQty = buyAllocated[buyTx.id] || 0;
                          const sellAllocatedQty =
                            sellAllocated[sellTx.id] || 0;
                          const buyRemaining = buyTx.quantity - buyAllocatedQty;
                          const sellRemaining =
                            sellTx.quantity - sellAllocatedQty;
                          const linkQty = Math.min(buyRemaining, sellRemaining);

                          return (
                            <div className="control-group">
                              <button onClick={handleAddLink} disabled={false}>
                                Create Link ({linkQty} qty)
                              </button>
                            </div>
                          );
                        })()}

                      <div className="existing-links">
                        <h4>Manual Links ({mappingsForSymbol.length})</h4>
                        {mappingsForSymbol.length > 0 ? (
                          <ul className="links-list">
                            {mappingsForSymbol.map((link, idx) => {
                              const buyTx = stockEntries.find(
                                (s) => s.id === link.buyId
                              );
                              const sellTx = stockEntries.find(
                                (s) => s.id === link.sellId
                              );
                              const buyCost =
                                link.qty * buyTx.price +
                                (buyTx.charges * link.qty) / buyTx.quantity;
                              const sellValue =
                                link.qty * sellTx.price -
                                (sellTx.charges * link.qty) / sellTx.quantity;
                              const linkPL = sellValue - buyCost;

                              return (
                                <li key={idx} className="link-item">
                                  <div className="link-details-wrapper">
                                    <div className="link-info">
                                      <span className="link-detail">
                                        {link.qty} @{' '}
                                        {currencyFormatter(buyTx?.price || 0)} →{' '}
                                        {currencyFormatter(sellTx?.price || 0)}
                                      </span>
                                      <span
                                        className={`link-pl ${linkPL >= 0 ? 'cell-good' : 'cell-bad'
                                          }`}
                                      >
                                        {currencyFormatter(linkPL)}
                                      </span>
                                    </div>
                                    <div className="link-dates">
                                      <span className="link-date">
                                        Buy: {formatDateFn(buyTx?.date)}
                                      </span>
                                      <span className="link-date">
                                        Sell: {formatDateFn(sellTx?.date)}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    className="remove-link-btn"
                                    onClick={() =>
                                      onRemoveMapping(link.buyId, link.sellId)
                                    }
                                  >
                                    Remove
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="no-links">No manual links yet.</p>
                        )}
                      </div>

                      {mappingsForSymbol.length > 0 && (
                        <button
                          className="reset-btn"
                          onClick={() => onResetSymbol(symbol)}
                        >
                          Clear All Links
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="empty">
          No trades yet. Add buy and sell entries to start mapping.
        </p>
      )}
    </section>
  );
}

function DataYamlPage({
  yamlText,
  setYamlText,
  yamlStatus,
  exportAllDataAsYaml,
  importAllDataFromYaml,
}) {
  return (
    <section className="panel">
      <h2>Data Import / Export (YAML)</h2>
      <p className="chart-summary">
        Export all saved entries as YAML or paste YAML here to restore data.
      </p>
      <div className="yaml-actions">
        <button type="button" onClick={exportAllDataAsYaml}>
          Export As YAML
        </button>
        <button type="button" onClick={importAllDataFromYaml}>
          Import From YAML
        </button>
      </div>
      <textarea
        className="yaml-editor"
        placeholder="YAML data will appear here after export. You can also paste YAML and import."
        value={yamlText}
        onChange={(event) => setYamlText(event.target.value)}
      />
      {yamlStatus ? <p className="chart-summary">{yamlStatus}</p> : null}
    </section>
  );
}

function DailyPLPage({
  dailyPLData,
  currency: currencyFormatter,
  formatDate: formatDateFn,
}) {
  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const defaultEndDate = getDateKey(today) || '';
  const defaultStartDate = getDateKey(currentMonthStart) || defaultEndDate;

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const filteredData = dailyPLData.filter((item) => {
    const itemDate = new Date(item.date).getTime();
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    return itemDate >= startTime && itemDate <= endTime;
  });

  const stats = filteredData.length > 0 ? {
    totalDays: filteredData.length,
    avgDailyPL: filteredData.reduce((sum, item) => sum + item.pnl, 0) / filteredData.length,
    bestDay: Math.max(...filteredData.map((item) => item.pnl)),
    worstDay: Math.min(...filteredData.map((item) => item.pnl)),
  } : null;

  return (
    <section className="panel">
      <h2>Day Wise Profit / Loss</h2>
      <p className="chart-summary">
        P/L breakdown for each day trades were closed. Includes realized trade P/L and allocated DP charges.
      </p>

      <div className="filter-row" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ marginRight: '0.5rem' }}>From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '0.5rem' }}
          />
        </div>
        <div>
          <label style={{ marginRight: '0.5rem' }}>To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '0.5rem' }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setStartDate(defaultStartDate);
            setEndDate(defaultEndDate);
          }}
          style={{ padding: '0.5rem 1rem' }}
        >
          Reset
        </button>
      </div>

      {filteredData.length > 0 ? (
        <div className="pnl-table" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Date</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>P/L</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredData].reverse().map((item) => (
                <tr key={item.date} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem' }}>{formatDateFn(item.date)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <span className={item.pnl >= 0 ? 'cell-good' : 'cell-bad'}>
                      {currencyFormatter(item.pnl)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No trades in the selected date range.</p>
      )}
    </section>
  );
}

export default function App() {
  const [cashEntries, setCashEntries] = useState(() => readStorage(CASH_KEY));
  const [stockEntries, setStockEntries] = useState(() =>
    normalizeStockEntries(readStorage(STOCK_KEY))
  );
  const [dpChargeEntries, setDpChargeEntries] = useState(() =>
    readStorage(DP_CHARGES_KEY)
  );
  const [symbolSuggestions, setSymbolSuggestions] = useState(() => {
    const saved = normalizeSymbols(readStorage(SYMBOL_KEY));
    if (saved.length) return saved;
    return normalizeSymbols(
      normalizeStockEntries(readStorage(STOCK_KEY)).map((item) => item.symbol)
    );
  });

  const [cashForm, setCashForm] = useState({
    type: 'deposit',
    amount: '',
    note: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const [dpChargeForm, setDpChargeForm] = useState({
    amount: '',
    note: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const [stockForm, setStockForm] = useState({
    action: 'buy',
    symbol: '',
    quantity: '',
    price: '',
    charges: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const [editingStockId, setEditingStockId] = useState('');
  const [editStockForm, setEditStockForm] = useState({
    action: 'buy',
    symbol: '',
    quantity: '',
    price: '',
    charges: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [stockFilter, setStockFilter] = useState('ALL');
  const [yamlText, setYamlText] = useState('');
  const [yamlStatus, setYamlStatus] = useState('');
  const [manualMappings, setManualMappings] = useState(() =>
    readStorage(MANUAL_MAPPINGS_KEY)
  );

  const activeSymbolInput = editingStockId
    ? editStockForm.symbol
    : stockForm.symbol;
  const symbolQuery = activeSymbolInput.trim().toUpperCase();
  const filteredSymbolSuggestions =
    symbolQuery.length >= 1
      ? symbolSuggestions.filter((symbol) => symbol.startsWith(symbolQuery))
      : [];

  const stockFilterOptions = [
    ...new Set(stockEntries.map((item) => item.symbol)),
  ].sort();
  const filteredStockEntries =
    stockFilter === 'ALL'
      ? stockEntries
      : stockEntries.filter((item) => item.symbol === stockFilter);
  const sortedCashEntries = useMemo(
    () =>
      [...cashEntries].sort((a, b) => {
        const aDate = toDate(a.date)?.getTime() || 0;
        const bDate = toDate(b.date)?.getTime() || 0;
        return bDate - aDate;
      }),
    [cashEntries]
  );

  const totals = useMemo(() => {
    const totalFundAdded = cashEntries.reduce(
      (sum, item) =>
        item.type === 'deposit' ? sum + toNumber(item.amount) : sum,
      0
    );

    const totalFundWithdrawn = cashEntries.reduce(
      (sum, item) =>
        item.type === 'withdraw' ? sum + toNumber(item.amount) : sum,
      0
    );

    const cashDeposited = totalFundAdded - totalFundWithdrawn;

    const orderedStocks = [...stockEntries]
      .map((item, index) => ({ ...item, _index: index }))
      .sort((a, b) => {
        const aDate = toDate(a.date)?.getTime() || 0;
        const bDate = toDate(b.date)?.getTime() || 0;
        if (aDate !== bDate) return aDate - bDate;

        const aCreated = normalizeCreatedAt(a.createdAt);
        const bCreated = normalizeCreatedAt(b.createdAt);
        if (aCreated !== null && bCreated !== null && aCreated !== bCreated)
          return aCreated - bCreated;

        // Fallback for older entries: list is newest-first, so reverse index yields oldest-first.
        return b._index - a._index;
      });

    const stockCashSummary = orderedStocks.reduce(
      (acc, item) => {
        const qty = toNumber(item.quantity);
        const price = toNumber(item.price);
        const charges = toNumber(item.charges);
        const action = toAction(item.action);
        const value = qty * price;

        acc.totalCharges += charges;
        if (action === 'buy') {
          acc.totalBought += value;
          acc.tradeCashFlow -= value + charges;
          return acc;
        }

        acc.totalSold += value;
        acc.tradeCashFlow += value - charges;
        return acc;
      },
      {
        totalBought: 0,
        totalSold: 0,
        totalCharges: 0,
        tradeCashFlow: 0,
      }
    );

    const monthlyAccumulator = {};
    const ensureMonthBucket = (monthKey) => {
      if (!monthKey) return null;
      if (!monthlyAccumulator[monthKey]) {
        monthlyAccumulator[monthKey] = {
          monthKey,
          fundDelta: 0,
          realizedPnlBeforeDp: 0,
          dpCharges: 0,
        };
      }
      return monthlyAccumulator[monthKey];
    };

    cashEntries.forEach((item) => {
      const monthBucket = ensureMonthBucket(getMonthKey(item.date));
      if (!monthBucket) return;

      const amount = toNumber(item.amount);
      if (item.type === 'deposit') {
        monthBucket.fundDelta += amount;
        return;
      }

      if (item.type === 'withdraw') {
        monthBucket.fundDelta -= amount;
      }
    });

    const stocksBySymbol = orderedStocks.reduce((map, item) => {
      if (!map[item.symbol]) map[item.symbol] = [];
      map[item.symbol].push(item);
      return map;
    }, {});

    const symbolProfitLoss = {};
    const realizedSummary = {
      lotsBySymbol: {},
      matchedSellValue: 0,
      matchedBuyValue: 0,
      matchedSellGrossValue: 0,
      matchedBuyGrossValue: 0,
      matchedSellCharges: 0,
      matchedBuyCharges: 0,
    };

    const stockPositions = {};

    Object.entries(stocksBySymbol).forEach(([symbol, symbolItems]) => {
      const dayGroups = symbolItems.reduce((map, item) => {
        const dateKey = getDateKey(item.date);
        if (!dateKey) return map;
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(item);
        return map;
      }, {});

      const lots = [];
      const summary = {
        symbol,
        quantity: 0,
        matchedBuyValue: 0,
        matchedSellValue: 0,
        matchedBuyGrossValue: 0,
        matchedSellGrossValue: 0,
        matchedBuyCharges: 0,
        matchedSellCharges: 0,
        lots,
      };

      Object.keys(dayGroups)
        .sort()
        .forEach((dateKey) => {
          const dayItems = dayGroups[dateKey];
          const dayBuyItems = dayItems.filter(
            (item) => toAction(item.action) === 'buy'
          );
          const daySellItems = dayItems.filter(
            (item) => toAction(item.action) === 'sell'
          );

          const dayBuyQty = dayBuyItems.reduce(
            (sum, item) => sum + toNumber(item.quantity),
            0
          );
          const dayBuyGrossValue = dayBuyItems.reduce(
            (sum, item) => sum + toNumber(item.quantity) * toNumber(item.price),
            0
          );
          const dayBuyCharges = dayBuyItems.reduce(
            (sum, item) => sum + toNumber(item.charges),
            0
          );

          const daySellQty = daySellItems.reduce(
            (sum, item) => sum + toNumber(item.quantity),
            0
          );
          const daySellGrossValue = daySellItems.reduce(
            (sum, item) => sum + toNumber(item.quantity) * toNumber(item.price),
            0
          );
          const daySellCharges = daySellItems.reduce(
            (sum, item) => sum + toNumber(item.charges),
            0
          );

          const intradayQty = Math.min(dayBuyQty, daySellQty);
          const intradayBuyGrossValue =
            dayBuyQty > 0 ? (dayBuyGrossValue * intradayQty) / dayBuyQty : 0;
          const intradayBuyCharges =
            dayBuyQty > 0 ? (dayBuyCharges * intradayQty) / dayBuyQty : 0;
          const intradaySellGrossValue =
            daySellQty > 0 ? (daySellGrossValue * intradayQty) / daySellQty : 0;
          const intradaySellCharges =
            daySellQty > 0 ? (daySellCharges * intradayQty) / daySellQty : 0;

          if (intradayQty > 0) {
            summary.quantity += intradayQty;
            summary.matchedBuyGrossValue += intradayBuyGrossValue;
            summary.matchedSellGrossValue += intradaySellGrossValue;
            summary.matchedBuyCharges += intradayBuyCharges;
            summary.matchedSellCharges += intradaySellCharges;
            summary.matchedBuyValue +=
              intradayBuyGrossValue + intradayBuyCharges;
            summary.matchedSellValue +=
              intradaySellGrossValue - intradaySellCharges;

            const monthBucket = ensureMonthBucket(dateKey.slice(0, 7));
            if (monthBucket) {
              monthBucket.realizedPnlBeforeDp +=
                intradaySellGrossValue -
                intradaySellCharges -
                (intradayBuyGrossValue + intradayBuyCharges);
            }
          }

          const remainingBuyQty = dayBuyQty - intradayQty;
          const remainingSellQty = daySellQty - intradayQty;

          if (remainingBuyQty > 0) {
            lots.push({
              qty: remainingBuyQty,
              grossValue: dayBuyGrossValue - intradayBuyGrossValue,
              charges: dayBuyCharges - intradayBuyCharges,
            });
          }

          if (remainingSellQty > 0) {
            const remainingSellGrossValue =
              daySellGrossValue - intradaySellGrossValue;
            const remainingSellCharges = daySellCharges - intradaySellCharges;
            let sellQuantityLeft = remainingSellQty;

            while (sellQuantityLeft > 0 && lots.length > 0) {
              const lot = lots[0];
              const matchedQty = Math.min(sellQuantityLeft, lot.qty);
              const lotRatio = lot.qty > 0 ? matchedQty / lot.qty : 0;
              const matchedBuyGrossValue = lot.grossValue * lotRatio;
              const matchedBuyCharges = lot.charges * lotRatio;
              const sellRatio =
                remainingSellQty > 0 ? matchedQty / remainingSellQty : 0;
              const matchedSellGrossValue =
                remainingSellQty > 0 ? remainingSellGrossValue * sellRatio : 0;
              const matchedSellCharges =
                remainingSellQty > 0 ? remainingSellCharges * sellRatio : 0;

              summary.quantity += matchedQty;
              summary.matchedBuyGrossValue += matchedBuyGrossValue;
              summary.matchedSellGrossValue += matchedSellGrossValue;
              summary.matchedBuyCharges += matchedBuyCharges;
              summary.matchedSellCharges += matchedSellCharges;
              summary.matchedBuyValue +=
                matchedBuyGrossValue + matchedBuyCharges;
              summary.matchedSellValue +=
                matchedSellGrossValue - matchedSellCharges;

              const monthBucket = ensureMonthBucket(dateKey.slice(0, 7));
              if (monthBucket) {
                monthBucket.realizedPnlBeforeDp +=
                  matchedSellGrossValue -
                  matchedSellCharges -
                  (matchedBuyGrossValue + matchedBuyCharges);
              }

              lot.qty -= matchedQty;
              lot.grossValue -= matchedBuyGrossValue;
              lot.charges -= matchedBuyCharges;
              sellQuantityLeft -= matchedQty;

              if (lot.qty <= 0) lots.shift();
            }
          }
        });

      symbolProfitLoss[symbol] = summary;
      realizedSummary.lotsBySymbol[symbol] = lots;
      realizedSummary.matchedBuyValue += summary.matchedBuyValue;
      realizedSummary.matchedSellValue += summary.matchedSellValue;
      realizedSummary.matchedBuyGrossValue += summary.matchedBuyGrossValue;
      realizedSummary.matchedSellGrossValue += summary.matchedSellGrossValue;
      realizedSummary.matchedBuyCharges += summary.matchedBuyCharges;
      realizedSummary.matchedSellCharges += summary.matchedSellCharges;

      stockPositions[symbol] = {
        symbol,
        lots: lots.map((lot) => ({ ...lot })),
      };
    });

    const closedTradeDiff =
      realizedSummary.matchedSellValue - realizedSummary.matchedBuyValue;
    const closedTradeDiffWithoutCharges =
      realizedSummary.matchedSellGrossValue -
      realizedSummary.matchedBuyGrossValue;
    const closedTradeCharges =
      realizedSummary.matchedSellCharges + realizedSummary.matchedBuyCharges;
    const totalDpCharges = dpChargeEntries.reduce(
      (sum, item) => sum + Math.abs(toNumber(item.amount)),
      0
    );

    dpChargeEntries.forEach((item) => {
      const monthBucket = ensureMonthBucket(getMonthKey(item.date));
      if (!monthBucket) return;
      monthBucket.dpCharges += Math.abs(toNumber(item.amount));
    });

    let runningNetFunds = 0;
    const monthlyPerformanceRows = Object.keys(monthlyAccumulator)
      .sort()
      .map((monthKey) => {
        const item = monthlyAccumulator[monthKey];
        runningNetFunds += item.fundDelta;
        const netPnl = item.realizedPnlBeforeDp - item.dpCharges;
        return {
          ...item,
          netFunds: runningNetFunds,
          netPnl,
          gainPercent:
            runningNetFunds > 0 ? (netPnl / runningNetFunds) * 100 : null,
        };
      })
      .filter(
        (item) =>
          item.fundDelta !== 0 ||
          item.realizedPnlBeforeDp !== 0 ||
          item.dpCharges > 0
      );

    const pnlAfterDpCharges = closedTradeDiff - totalDpCharges;

    const symbolProfitLossRows = Object.values(symbolProfitLoss)
      .map((item) => {
        const quantity = item.quantity;
        const avgBuyPrice = quantity > 0 ? item.matchedBuyValue / quantity : 0;
        const avgSellPrice =
          quantity > 0 ? item.matchedSellValue / quantity : 0;
        const difference = item.matchedSellValue - item.matchedBuyValue;
        const charges = item.matchedBuyCharges + item.matchedSellCharges;

        return {
          symbol: item.symbol,
          quantity,
          avgBuyPrice,
          avgSellPrice,
          difference,
          charges,
        };
      })
      .filter((item) => item.quantity > 0)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    const { totalBought, totalSold, totalCharges, tradeCashFlow } =
      stockCashSummary;
    const holdings = Object.fromEntries(
      Object.entries(stockPositions).map(([symbol, item]) => [
        symbol,
        item.lots.reduce((sum, lot) => sum + lot.qty, 0),
      ])
    );

    // Build open positions using FIFO buy lots so graph shows only unsold buy expense.
    const investedByStock = Object.values(stockPositions)
      .map((item) => {
        const quantity = item.lots.reduce((sum, lot) => sum + lot.qty, 0);
        const invested = item.lots.reduce(
          (sum, lot) => sum + lot.grossValue + lot.charges,
          0
        );
        return { symbol: item.symbol, quantity, invested };
      })
      .filter((item) => item.quantity > 0 && item.invested > 0)
      .sort((a, b) => b.invested - a.invested);

    const palette = [
      '#0ea5e9',
      '#14b8a6',
      '#22c55e',
      '#f59e0b',
      '#f97316',
      '#ef4444',
      '#8b5cf6',
    ];
    const liquidCash = cashDeposited + tradeCashFlow;

    const allocationItems = [
      ...investedByStock.map((item, index) => ({
        label: item.symbol,
        value: item.invested,
        color: palette[index % palette.length],
        quantity: item.quantity,
        avgPrice: item.quantity > 0 ? item.invested / item.quantity : 0,
      })),
      {
        label: 'Remaining Cash',
        value: Math.max(0, toNumber(liquidCash)),
        color: '#334155',
        quantity: null,
        avgPrice: null,
      },
    ].filter((item) => item.value > 0);

    const allocationTotal = allocationItems.reduce(
      (sum, item) => sum + item.value,
      0
    );

    const allocationLegend = allocationItems.map((item) => ({
      ...item,
      percent: allocationTotal ? (item.value / allocationTotal) * 100 : 0,
    }));

    let cursor = 0;
    const gradientParts = allocationLegend.map((item) => {
      const start = cursor;
      const angle = allocationTotal ? (item.value / allocationTotal) * 360 : 0;
      cursor += angle;
      return `${item.color} ${start}deg ${cursor}deg`;
    });

    const allocationGradient = gradientParts.length
      ? `conic-gradient(${gradientParts.join(', ')})`
      : 'conic-gradient(#cbd5e1 0deg 360deg)';

    const openOrderInvestedValue = investedByStock.reduce(
      (sum, item) => sum + item.invested,
      0
    );
    const netTotalAmount = cashDeposited + pnlAfterDpCharges;
    const projectedAmount = netTotalAmount - openOrderInvestedValue;

    const finalAmount = cashDeposited + pnlAfterDpCharges;

    // Calculate daily P/L data
    const dailyPLMap = {};
    stockEntries.forEach((item) => {
      if (toAction(item.action) === 'sell') {
        const dateKey = getDateKey(item.date);
        if (!dateKey) return;
        if (!dailyPLMap[dateKey]) {
          dailyPLMap[dateKey] = {
            date: dateKey,
            tradeCount: 0,
            symbols: new Set(),
            realizedValue: 0,
            volume: 0,
          };
        }
        dailyPLMap[dateKey].tradeCount += 1;
        dailyPLMap[dateKey].symbols.add(item.symbol);
        const qty = toNumber(item.quantity);
        const price = toNumber(item.price);
        dailyPLMap[dateKey].realizedValue += qty * price;
        dailyPLMap[dateKey].volume += qty;
      }
    });

    // Calculate proportional P/L for each day
    const dailyPLData = Object.values(dailyPLMap).map((day) => {
      const dayProportion = realizedSummary.matchedSellGrossValue > 0
        ? day.realizedValue / realizedSummary.matchedSellGrossValue
        : 0;
      const dpChargeAllocation = dayProportion * totalDpCharges;
      const estimatedDayPnl = dayProportion * closedTradeDiffWithoutCharges - dpChargeAllocation;

      const gainPercent = day.realizedValue > 0
        ? (estimatedDayPnl / day.realizedValue) * 100
        : 0;

      return {
        date: day.date,
        pnl: estimatedDayPnl,
        tradeCount: day.tradeCount,
        symbols: Array.from(day.symbols).sort(),
        gainPercent,
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      remainingCash: finalAmount,
      netFundsOnly: cashDeposited,
      closedTradeDiff,
      closedTradeDiffWithoutCharges,
      closedTradeCharges,
      totalDpCharges,
      netTotalAmount,
      openOrderInvestedValue,
      projectedAmount,
      liquidCash,
      totalFundAdded,
      totalFundWithdrawn,
      totalBought,
      totalSold,
      totalCharges,
      pnl: pnlAfterDpCharges,
      pnlBeforeDpCharges: closedTradeDiff,
      holdings,
      investedByStock,
      symbolProfitLoss,
      symbolProfitLossRows,
      monthlyPerformanceRows,
      dailyPLData,
      allocationLegend,
      allocationGradient,
      allocationTotal,
    };
  }, [cashEntries, stockEntries, dpChargeEntries]);

  const addCashEntry = (event) => {
    event.preventDefault();
    const amount = toNumber(cashForm.amount);
    if (amount <= 0) return;

    const next = [
      {
        id: crypto.randomUUID(),
        type: cashForm.type,
        amount,
        note: cashForm.note.trim(),
        date: cashForm.date || new Date().toISOString().slice(0, 10),
      },
      ...cashEntries,
    ];

    setCashEntries(next);
    saveStorage(CASH_KEY, next);
    setCashForm({
      type: 'deposit',
      amount: '',
      note: '',
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const deleteCashEntry = (id) => {
    const next = cashEntries.filter((item) => item.id !== id);
    setCashEntries(next);
    saveStorage(CASH_KEY, next);
  };

  const addDpChargeEntry = (event) => {
    event.preventDefault();
    const amount = Math.abs(toNumber(dpChargeForm.amount));
    if (amount <= 0) return;

    const next = [
      {
        id: crypto.randomUUID(),
        amount,
        note: dpChargeForm.note.trim(),
        date: dpChargeForm.date || new Date().toISOString().slice(0, 10),
      },
      ...dpChargeEntries,
    ];

    setDpChargeEntries(next);
    saveStorage(DP_CHARGES_KEY, next);
    setDpChargeForm({
      amount: '',
      note: '',
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const deleteDpChargeEntry = (id) => {
    const next = dpChargeEntries.filter((item) => item.id !== id);
    setDpChargeEntries(next);
    saveStorage(DP_CHARGES_KEY, next);
  };

  const rememberSymbol = (symbolValue) => {
    const symbol = String(symbolValue || '')
      .trim()
      .toUpperCase();
    if (!symbol) return;
    setSymbolSuggestions((prev) => {
      const next = normalizeSymbols([...prev, symbol]);
      saveStorage(SYMBOL_KEY, next);
      return next;
    });
  };

  const addStockEntry = (event) => {
    event.preventDefault();
    const quantity = toNumber(stockForm.quantity);
    const price = toNumber(stockForm.price);
    const charges = toNumber(stockForm.charges);
    const symbol = stockForm.symbol.trim().toUpperCase();
    if (!symbol || quantity <= 0 || price <= 0 || charges < 0) return;

    const availableQty = toNumber(totals.holdings[symbol]);
    if (stockForm.action === 'sell' && quantity > availableQty) {
      window.alert(`Not enough quantity to sell. Available: ${availableQty}`);
      return;
    }

    const next = [
      {
        id: crypto.randomUUID(),
        action: toAction(stockForm.action),
        symbol,
        quantity,
        price,
        charges,
        date: stockForm.date || new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
      },
      ...stockEntries,
    ];

    setStockEntries(next);
    saveStorage(STOCK_KEY, next);
    rememberSymbol(symbol);
    setStockForm({
      action: 'buy',
      symbol: '',
      quantity: '',
      price: '',
      charges: '',
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const deleteStockEntry = (id) => {
    const next = stockEntries.filter((item) => item.id !== id);
    setStockEntries(next);
    saveStorage(STOCK_KEY, next);
  };

  const addManualMapping = ({ buyId, sellId, qty }) => {
    const buyTx = stockEntries.find((s) => s.id === buyId);
    const sellTx = stockEntries.find((s) => s.id === sellId);
    if (!buyTx || !sellTx || buyTx.symbol !== sellTx.symbol) return;

    const numQty = toNumber(qty);
    if (numQty <= 0 || numQty > buyTx.quantity || numQty > sellTx.quantity)
      return;

    const next = [
      ...manualMappings.filter(
        (m) => !(m.buyId === buyId && m.sellId === sellId)
      ),
      {
        buyId,
        sellId,
        qty: numQty,
        symbol: buyTx.symbol,
        createdAt: Date.now(),
      },
    ];
    setManualMappings(next);
    saveStorage(MANUAL_MAPPINGS_KEY, next);
  };

  const removeManualMapping = (buyId, sellId) => {
    const next = manualMappings.filter(
      (m) => !(m.buyId === buyId && m.sellId === sellId)
    );
    setManualMappings(next);
    saveStorage(MANUAL_MAPPINGS_KEY, next);
  };

  const resetSymbolMappings = (symbol) => {
    const next = manualMappings.filter((m) => m.symbol !== symbol);
    setManualMappings(next);
    saveStorage(MANUAL_MAPPINGS_KEY, next);
  };

  const startStockEdit = (item) => {
    setEditingStockId(item.id);
    setEditStockForm({
      action: toAction(item.action),
      symbol: item.symbol,
      quantity: String(item.quantity),
      price: String(item.price),
      charges: String(toNumber(item.charges)),
      date: item.date || new Date().toISOString().slice(0, 10),
    });
  };

  const cancelStockEdit = () => {
    setEditingStockId('');
    setEditStockForm({
      action: 'buy',
      symbol: '',
      quantity: '',
      price: '',
      charges: '',
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const saveStockEdit = (id) => {
    const action = toAction(editStockForm.action);
    const symbol = editStockForm.symbol.trim().toUpperCase();
    const quantity = toNumber(editStockForm.quantity);
    const price = toNumber(editStockForm.price);
    const charges = toNumber(editStockForm.charges);

    if (!symbol || quantity <= 0 || price <= 0 || charges < 0) return;

    const holdingsWithoutCurrent = stockEntries.reduce((map, item) => {
      if (item.id === id) return map;
      const key = item.symbol;
      const qty = toNumber(item.quantity);
      const itemAction = toAction(item.action);
      map[key] = (map[key] || 0) + (itemAction === 'buy' ? qty : -qty);
      return map;
    }, {});

    const availableQty = toNumber(holdingsWithoutCurrent[symbol]);
    if (action === 'sell' && quantity > availableQty) {
      window.alert(`Not enough quantity to sell. Available: ${availableQty}`);
      return;
    }

    const next = stockEntries.map((item) =>
      item.id === id
        ? {
          ...item,
          action,
          symbol,
          quantity,
          price,
          charges,
          date: editStockForm.date || new Date().toISOString().slice(0, 10),
        }
        : item
    );

    setStockEntries(next);
    saveStorage(STOCK_KEY, next);
    rememberSymbol(symbol);
    cancelStockEdit();
  };

  const exportAllDataAsYaml = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      cashEntries,
      stockEntries,
      dpChargeEntries,
      symbolSuggestions,
    };

    const yaml = dump(payload, {
      noRefs: true,
      lineWidth: 120,
      sortKeys: false,
    });

    setYamlText(yaml);
    setYamlStatus('YAML export generated. You can copy and save it anywhere.');
  };

  const importAllDataFromYaml = () => {
    try {
      const parsed = load(yamlText);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('YAML must contain an object with app data.');
      }

      const nextCashEntries = Array.isArray(parsed.cashEntries)
        ? parsed.cashEntries
        : [];
      const nextStockEntries = normalizeStockEntries(
        Array.isArray(parsed.stockEntries) ? parsed.stockEntries : []
      );
      const nextDpChargeEntries = Array.isArray(parsed.dpChargeEntries)
        ? parsed.dpChargeEntries.map((item) => ({
          id: item?.id ? String(item.id) : crypto.randomUUID(),
          amount: Math.abs(toNumber(item?.amount)),
          note: String(item?.note || ''),
          date: item?.date || new Date().toISOString().slice(0, 10),
        }))
        : [];
      const nextSymbolSuggestions = Array.isArray(parsed.symbolSuggestions)
        ? normalizeSymbols(parsed.symbolSuggestions)
        : normalizeSymbols(nextStockEntries.map((item) => item.symbol));

      setCashEntries(nextCashEntries);
      setStockEntries(nextStockEntries);
      setDpChargeEntries(nextDpChargeEntries);
      setSymbolSuggestions(nextSymbolSuggestions);
      setEditingStockId('');

      saveStorage(CASH_KEY, nextCashEntries);
      saveStorage(STOCK_KEY, nextStockEntries);
      saveStorage(DP_CHARGES_KEY, nextDpChargeEntries);
      saveStorage(SYMBOL_KEY, nextSymbolSuggestions);

      setYamlStatus('YAML data imported successfully.');
    } catch (error) {
      setYamlStatus(
        `Import failed: ${error instanceof Error ? error.message : 'Invalid YAML data.'
        }`
      );
    }
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <h1>Stock Valley</h1>
        <p>
          Track deposits, withdrawals, and each stock position in one place.
        </p>
      </header>

      <AppNav />

      <Routes>
        <Route
          path="/"
          element={<DashboardPage totals={totals} currency={currency} />}
        />
        <Route
          path="/money"
          element={
            <MoneyPage
              cashForm={cashForm}
              setCashForm={setCashForm}
              addCashEntry={addCashEntry}
              sortedCashEntries={sortedCashEntries}
              deleteCashEntry={deleteCashEntry}
              currency={currency}
              formatDate={formatDate}
            />
          }
        />
        <Route
          path="/dp-charges"
          element={
            <DpChargesPage
              dpChargeForm={dpChargeForm}
              setDpChargeForm={setDpChargeForm}
              addDpChargeEntry={addDpChargeEntry}
              dpChargeEntries={dpChargeEntries}
              deleteDpChargeEntry={deleteDpChargeEntry}
              currency={currency}
              formatDate={formatDate}
            />
          }
        />
        <Route
          path="/stocks"
          element={
            <StocksPage
              stockForm={stockForm}
              setStockForm={setStockForm}
              addStockEntry={addStockEntry}
              stockFilter={stockFilter}
              setStockFilter={setStockFilter}
              stockFilterOptions={stockFilterOptions}
              filteredStockEntries={filteredStockEntries}
              startStockEdit={startStockEdit}
              editingStockId={editingStockId}
              editStockForm={editStockForm}
              setEditStockForm={setEditStockForm}
              saveStockEdit={saveStockEdit}
              cancelStockEdit={cancelStockEdit}
              toAction={toAction}
              toNumber={toNumber}
              deleteStockEntry={deleteStockEntry}
              currency={currency}
              formatDate={formatDate}
              filteredSymbolSuggestions={filteredSymbolSuggestions}
            />
          }
        />
        <Route
          path="/symbol-pnl"
          element={
            <SymbolPnlPage
              symbolProfitLossRows={totals.symbolProfitLossRows}
              currency={currency}
            />
          }
        />
        <Route
          path="/monthly-pnl"
          element={
            <MonthlyPnlPage
              monthlyPerformanceRows={totals.monthlyPerformanceRows}
              currency={currency}
            />
          }
        />
        <Route
          path="/daily-pnl"
          element={
            <DailyPLPage
              dailyPLData={totals.dailyPLData}
              currency={currency}
              formatDate={formatDate}
            />
          }
        />
        <Route
          path="/buy-sell-mapping"
          element={
            <BuySellMappingPage
              symbolProfitLoss={totals.symbolProfitLoss}
              stockEntries={stockEntries}
              manualMappings={manualMappings}
              onAddMapping={addManualMapping}
              onRemoveMapping={removeManualMapping}
              onResetSymbol={resetSymbolMappings}
              currency={currency}
              formatDate={formatDate}
            />
          }
        />
        <Route
          path="/data-yaml"
          element={
            <DataYamlPage
              yamlText={yamlText}
              setYamlText={setYamlText}
              yamlStatus={yamlStatus}
              exportAllDataAsYaml={exportAllDataAsYaml}
              importAllDataFromYaml={importAllDataFromYaml}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
