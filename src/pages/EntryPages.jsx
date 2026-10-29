import { CustomSelect, List } from '../components/Navigation';

export function MoneyPage({
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
        <CustomSelect
          value={cashForm.type}
          onChange={(e) => setCashForm((f) => ({ ...f, type: e.target.value }))}
        >
          <option value="deposit">Deposit</option>
          <option value="withdraw">Withdraw</option>
        </CustomSelect>
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
export function DpChargesPage({
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
export function StocksPage({
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
  toAction,
  toNumber,
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
        <CustomSelect
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
        </CustomSelect>
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
                  <CustomSelect
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
                  </CustomSelect>
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
