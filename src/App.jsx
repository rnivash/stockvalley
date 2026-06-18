import { useEffect, useMemo, useState } from 'react';
import { dump, load } from 'js-yaml';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

const CASH_KEY = 'stockvalley-cash-entries';
const STOCK_KEY = 'stockvalley-stock-entries';
const SYMBOL_KEY = 'stockvalley-symbol-suggestions';
const DP_CHARGES_KEY = 'stockvalley-dp-charge-entries';

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
  const date = toDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
};

const STOCK_MAP_ASSIGNMENTS_KEY = 'stockvalley-stock-map-assignments';

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

const readStockMapAssignments = () => {
  try {
    const raw = localStorage.getItem(STOCK_MAP_ASSIGNMENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveStockMapAssignments = (value) => {
  localStorage.setItem(STOCK_MAP_ASSIGNMENTS_KEY, JSON.stringify(value));
};

const sanitizeSellAssignments = (assignments, buys, sells) => {
  const buyById = Object.fromEntries(buys.map((buy) => [String(buy.id), buy]));
  const sellById = Object.fromEntries(
    sells.map((sell) => [String(sell.id), sell])
  );

  return Object.entries(assignments || {}).reduce((next, [sellId, buyIds]) => {
    const sell = sellById[String(sellId)];
    if (!sell) return next;

    // Handle both old format (single buyId) and new format (array of buyIds)
    const buyIdArray = Array.isArray(buyIds) ? buyIds : [buyIds];
    const validBuyIds = buyIdArray.filter((buyId) => {
      const buy = buyById[String(buyId)];
      if (!buy) return false;
      if (toDateTime(sell.date) < toDateTime(buy.date)) return false;
      return true;
    });

    if (validBuyIds.length > 0) {
      next[String(sellId)] = validBuyIds.map(String);
    }
    return next;
  }, {});
};

const isSameAssignmentMap = (left, right) => {
  const leftKeys = Object.keys(left || {}).sort();
  const rightKeys = Object.keys(right || {}).sort();
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => {
    const leftVal = Array.isArray(left[key]) ? left[key].sort() : [left[key]];
    const rightVal = Array.isArray(right[key])
      ? right[key].sort()
      : [right[key]];
    if (leftVal.length !== rightVal.length) return false;
    return leftVal.every((v, i) => v === rightVal[i]);
  });
};

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
          to="/stock-map"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-label">Stock Map</span>
          <small className="nav-hint">Drag sells into buy lots</small>
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

function StockMapBoard({
  selectedSymbol,
  stockEntries,
  currency: currencyFormatter,
}) {
  const symbolEntries = useMemo(
    () =>
      sortTrades(stockEntries.filter((item) => item.symbol === selectedSymbol)),
    [stockEntries, selectedSymbol]
  );

  const buys = useMemo(
    () => symbolEntries.filter((item) => item.action === 'buy'),
    [symbolEntries]
  );
  const sells = useMemo(
    () => symbolEntries.filter((item) => item.action === 'sell'),
    [symbolEntries]
  );

  const [sellAssignments, setSellAssignments] = useState({});
  const [isAssignmentsHydrated, setIsAssignmentsHydrated] = useState(false);

  useEffect(() => {
    setIsAssignmentsHydrated(false);
    const allAssignments = readStockMapAssignments();
    const symbolAssignments =
      allAssignments[selectedSymbol] &&
      typeof allAssignments[selectedSymbol] === 'object'
        ? allAssignments[selectedSymbol]
        : {};

    setSellAssignments(sanitizeSellAssignments(symbolAssignments, buys, sells));
    setIsAssignmentsHydrated(true);
  }, [selectedSymbol, buys, sells]);

  useEffect(() => {
    if (!selectedSymbol || !isAssignmentsHydrated) return;

    const sanitized = sanitizeSellAssignments(sellAssignments, buys, sells);
    if (!isSameAssignmentMap(sanitized, sellAssignments)) {
      setSellAssignments(sanitized);
      return;
    }

    const allAssignments = readStockMapAssignments();
    if (Object.keys(sanitized).length) {
      allAssignments[selectedSymbol] = sanitized;
    } else {
      delete allAssignments[selectedSymbol];
    }
    saveStockMapAssignments(allAssignments);
  }, [selectedSymbol, sellAssignments, buys, sells, isAssignmentsHydrated]);

  const toggleSellSelection = (buyId, sellId) => {
    setSellAssignments((current) => {
      const next = { ...current };
      const buyKey = String(buyId);
      const sellKey = String(sellId);

      const buyIdArray = Array.isArray(next[sellKey]) ? [...next[sellKey]] : [];
      const buyIndex = buyIdArray.indexOf(buyKey);

      if (buyIndex >= 0) {
        // Remove this buyId from the array
        buyIdArray.splice(buyIndex, 1);
        if (buyIdArray.length === 0) {
          delete next[sellKey];
        } else {
          next[sellKey] = buyIdArray;
        }
      } else {
        // Add this buyId to the array
        buyIdArray.push(buyKey);
        next[sellKey] = buyIdArray;
      }

      return next;
    });
  };

  const buyRows = buys.map((buy, buyIndex) => {
    const buyKey = String(buy.id);
    const buyDate = toDateTime(buy.date);

    // Calculate how much of each sell has been consumed by previous buy lots
    const sellUsageMap = {};
    for (let i = 0; i < buyIndex; i++) {
      const prevBuy = buys[i];
      const prevBuyKey = String(prevBuy.id);
      const prevBuyDate = toDateTime(prevBuy.date);

      sells.forEach((sell) => {
        const sellKey = String(sell.id);
        const sellDate = toDateTime(sell.date);
        if (sellDate < prevBuyDate) return; // Sell must not be older than buy

        const sellQty = Number(sell.quantity) || 0;
        let usedInPrevBuy = 0;

        // Check if this sell is assigned to the previous buy
        const buyIdArray = Array.isArray(sellAssignments[sellKey])
          ? sellAssignments[sellKey]
          : [];
        if (buyIdArray.includes(prevBuyKey)) {
          usedInPrevBuy = Math.min(sellQty, Number(prevBuy.quantity) || 0);
          for (let j = 0; j < i; j++) {
            const priorBuyKey = String(buys[j].id);
            const priorBuyIdArray = Array.isArray(sellAssignments[sellKey])
              ? sellAssignments[sellKey]
              : [];
            if (priorBuyIdArray.includes(priorBuyKey)) {
              usedInPrevBuy -= sellUsageMap[`${j}-${sellKey}`] || 0;
            }
          }
        }

        sellUsageMap[`${i}-${sellKey}`] = Math.max(0, usedInPrevBuy);
      });
    }

    // For this buy lot, show all sells that either:
    // 1. Are not yet fully consumed, or
    // 2. Are assigned to this buy and not yet consumed by this buy
    const assignedSells = sells
      .filter((sell) => {
        const sellKey = String(sell.id);
        const sellDate = toDateTime(sell.date);

        // Sell must not be older than this buy
        if (sellDate < buyDate) return false;

        const sellQty = Number(sell.quantity) || 0;
        const totalConsumed = Object.keys(sellUsageMap)
          .filter((key) => key.endsWith(`-${sellKey}`))
          .reduce((sum, key) => sum + (sellUsageMap[key] || 0), 0);

        // Include if: (not fully consumed) OR (assigned to this buy)
        const buyIdArray = Array.isArray(sellAssignments[sellKey])
          ? sellAssignments[sellKey]
          : [];
        return totalConsumed < sellQty || buyIdArray.includes(buyKey);
      })
      .sort((a, b) => toDateTime(a.date) - toDateTime(b.date));

    let remainingBuyQty = Number(buy.quantity) || 0;
    let profitLoss = 0;

    const settledSells = assignedSells.map((sell) => {
      const sellKey = String(sell.id);
      const sellQty = Number(sell.quantity) || 0;
      const buyIdArray = Array.isArray(sellAssignments[sellKey])
        ? sellAssignments[sellKey]
        : [];
      const isAssigned = buyIdArray.includes(buyKey);

      // Calculate how much of this sell is available for this buy
      const totalConsumedByPrevious = Object.keys(sellUsageMap)
        .filter(
          (key) =>
            key.endsWith(`-${sellKey}`) && !key.startsWith(`${buyIndex}-`)
        )
        .reduce((sum, key) => sum + (sellUsageMap[key] || 0), 0);

      const availableQty = sellQty - totalConsumedByPrevious;
      const matchedQty = isAssigned
        ? Math.min(remainingBuyQty, availableQty)
        : 0;

      const buyQty = Number(buy.quantity) || 0;
      const buyPrice = Number(buy.price) || 0;
      const buyCharges = Number(buy.charges) || 0;
      const sellPrice = Number(sell.price) || 0;
      const sellCharges = Number(sell.charges) || 0;
      const buyChargeShare =
        buyQty > 0 ? (buyCharges * matchedQty) / buyQty : 0;
      const sellChargeShare =
        sellQty > 0 ? (sellCharges * matchedQty) / sellQty : 0;
      const buyCost = buyPrice * matchedQty + buyChargeShare;
      const sellValue = sellPrice * matchedQty - sellChargeShare;

      if (matchedQty > 0) {
        remainingBuyQty -= matchedQty;
        profitLoss += sellValue - buyCost;
      }

      return {
        sell,
        matchedQty,
        availableQty,
        remainingQty: availableQty - matchedQty,
      };
    });

    return {
      buy,
      assignedSells: settledSells,
      profitLoss,
      remainingBuyQty,
    };
  });

  const assignedBuyIds = new Set(
    Object.values(sellAssignments)
      .flat()
      .map((buyId) => String(buyId))
  );

  const openBuys = buys.filter((buy) => !assignedBuyIds.has(String(buy.id)));
  const openBuysStats = useMemo(() => {
    if (!openBuys.length) {
      return { totalQty: 0, totalValue: 0, avgPrice: 0 };
    }

    const totalQty = openBuys.reduce(
      (sum, buy) => sum + (Number(buy.quantity) || 0),
      0
    );
    const totalValue = openBuys.reduce((sum, buy) => {
      const qty = Number(buy.quantity) || 0;
      const price = Number(buy.price) || 0;
      return sum + qty * price;
    }, 0);
    const avgPrice = totalQty > 0 ? totalValue / totalQty : 0;

    return { totalQty, totalValue, avgPrice };
  }, [openBuys]);

  const totalPL = useMemo(() => {
    return buyRows.reduce((sum, row) => sum + row.profitLoss, 0);
  }, [buyRows]);

  return (
    <section className="stock-map-board">
      {(openBuys.length > 0 || totalPL !== 0) && (
        <section className="stock-map-summary">
          {openBuys.length > 0 && (
            <div className="stock-map-open-stats">
              <strong>Open Stock (No Sell Mapped):</strong>
              <span>
                Qty {openBuysStats.totalQty} | Avg Buy Price{' '}
                {currencyFormatter(openBuysStats.avgPrice)}
              </span>
            </div>
          )}
          {buyRows.some((row) => row.profitLoss !== 0) && (
            <div
              className={`stock-map-pl-summary${
                totalPL >= 0 ? ' positive' : ' negative'
              }`}
            >
              <strong>Mapped P/L:</strong>
              <span>{currencyFormatter(totalPL)}</span>
            </div>
          )}
        </section>
      )}
      <section className="stock-map-panel">
        <div className="stock-map-section-head">
          <div>
            <h3>Sell Entries</h3>
            <p>
              Check sell entries to assign each one to one or more buy lots. A
              single sell can be split across multiple buys.
            </p>
          </div>
          <small>{sells.length} total</small>
        </div>
        {sells.length ? (
          <p className="empty">
            The sell list is shown inside each buy box below.
          </p>
        ) : (
          <p className="empty">No sell entries for this stock.</p>
        )}
      </section>

      <section className="stock-map-panel">
        <div className="stock-map-section-head">
          <div>
            <h3>Buy Lots</h3>
            <p>
              Select sell entries in each buy lot. Sells can be split across
              multiple buys—remaining quantity automatically appears in other
              lots.
            </p>
          </div>
          <small>{buys.length} lots</small>
        </div>

        {buys.length ? (
          <div className="stock-map-buy-list">
            {buyRows.map(
              ({ buy, assignedSells, profitLoss, remainingBuyQty }) => {
                const buyKey = String(buy.id);
                return (
                  <article key={buyKey} className="stock-map-buy-row">
                    <div className="stock-map-buy-entry">
                      <p>{formatDateMonth(buy.date)}</p>
                      <small>{formatQtyPrice(buy, currencyFormatter)}</small>
                    </div>
                    <div className="stock-map-dropzone filled">
                      {assignedSells.length ? (
                        <div className="stock-map-drop-items">
                          {assignedSells.map(
                            ({
                              sell,
                              matchedQty,
                              availableQty,
                              remainingQty,
                            }) => {
                              const sellKey = String(sell.id);
                              const buyIdArray = Array.isArray(
                                sellAssignments[sellKey]
                              )
                                ? sellAssignments[sellKey]
                                : [];
                              const isSelected = buyIdArray.includes(buyKey);
                              const sellQty = Number(sell.quantity) || 0;
                              return (
                                <label
                                  key={sellKey}
                                  className={`stock-map-drop-item${
                                    availableQty < sellQty ? ' partial' : ''
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="stock-map-select-checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      toggleSellSelection(buyKey, sell.id)
                                    }
                                    aria-label={`Select ${formatTradeStamp(
                                      sell,
                                      currencyFormatter
                                    )} for this buy box`}
                                  />
                                  <div>
                                    <p>{formatDateMonth(sell.date)}</p>
                                    <small>
                                      {availableQty} x{' '}
                                      {currencyFormatter(sell.price)}
                                      {availableQty < sellQty
                                        ? ` (of ${sellQty})`
                                        : ''}
                                    </small>
                                  </div>
                                </label>
                              );
                            }
                          )}
                        </div>
                      ) : (
                        <p className="stock-map-drop-empty">
                          No sell entries loaded
                        </p>
                      )}
                    </div>
                    <div
                      className={`stock-map-pl${
                        profitLoss >= 0 ? ' positive' : ' negative'
                      }`}
                    >
                      <small>P/L</small>
                      <strong>{currencyFormatter(profitLoss)}</strong>
                      <span>
                        {remainingBuyQty > 0
                          ? `${remainingBuyQty} qty open`
                          : 'Fully matched'}
                      </span>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        ) : (
          <p className="empty">No buy entries for this stock.</p>
        )}
      </section>
    </section>
  );
}

function StockMapPage({ stockEntries, currency: currencyFormatter }) {
  const symbols = useMemo(
    () =>
      [
        ...new Set(
          stockEntries
            .map((item) =>
              String(item.symbol || '')
                .trim()
                .toUpperCase()
            )
            .filter(Boolean)
        ),
      ].sort(),
    [stockEntries]
  );

  const [selectedSymbol, setSelectedSymbol] = useState('');

  useEffect(() => {
    if (!symbols.length) {
      if (selectedSymbol) setSelectedSymbol('');
      return;
    }

    if (!symbols.includes(selectedSymbol)) {
      setSelectedSymbol(symbols[0]);
    }
  }, [selectedSymbol, symbols]);

  return (
    <section className="panel stock-map-page">
      <div className="stock-map-header">
        <div>
          <h2>Stock Map</h2>
          <p>
            Select a stock, then check the sell entries you want to match with
            each buy lot. Each sell appears in only the lot where it is
            selected.
          </p>
        </div>
        <label className="stock-map-select-wrap">
          <span>Stock</span>
          <select
            value={selectedSymbol}
            onChange={(event) => setSelectedSymbol(event.target.value)}
          >
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedSymbol ? (
        <StockMapBoard
          key={selectedSymbol}
          selectedSymbol={selectedSymbol}
          stockEntries={stockEntries}
          currency={currencyFormatter}
        />
      ) : (
        <p className="empty">Add stock entries first to build a stock map.</p>
      )}
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

function DataYamlPage({
  yamlText,
  setYamlText,
  yamlStatus,
  exportAllDataAsYaml,
  importAllDataFromYaml,
  importFromGitHub,
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
        <button type="button" onClick={importFromGitHub}>
          Import from GitHub
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
      symbolProfitLossRows,
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
        `Import failed: ${
          error instanceof Error ? error.message : 'Invalid YAML data.'
        }`
      );
    }
  };

  const importFromGitHub = async () => {
    try {
      setYamlStatus('Fetching data from GitHub...');
      const response = await fetch(
        'https://raw.githubusercontent.com/rnivash/stockvalley/refs/heads/main/public/data.yaml'
      );

      if (!response.ok) {
        throw new Error(
          `GitHub fetch failed: ${response.status} ${response.statusText}`
        );
      }

      const yaml = await response.text();
      setYamlText(yaml);
      setYamlStatus('GitHub data loaded. Click "Import From YAML" to import.');
    } catch (error) {
      setYamlStatus(
        `GitHub import failed: ${
          error instanceof Error
            ? error.message
            : 'Unable to fetch from GitHub.'
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
          path="/stock-map"
          element={
            <StockMapPage
              stockEntries={stockEntries}
              currency={currency}
              toAction={toAction}
              toNumber={toNumber}
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
          path="/data-yaml"
          element={
            <DataYamlPage
              yamlText={yamlText}
              setYamlText={setYamlText}
              yamlStatus={yamlStatus}
              exportAllDataAsYaml={exportAllDataAsYaml}
              importAllDataFromYaml={importAllDataFromYaml}
              importFromGitHub={importFromGitHub}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
