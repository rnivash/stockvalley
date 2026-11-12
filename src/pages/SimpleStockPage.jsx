import { CustomSelect, List } from '../components/Navigation';

export function SimpleStockPage({
  stockForm,
  setStockForm,
  addStockEntry,
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

      <List
        emptyText={'No stock entries yet.'}
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