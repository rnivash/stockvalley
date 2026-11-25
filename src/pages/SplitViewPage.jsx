import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SymbolSelector } from '../components/SymbolSelector';
import { getActiveSymbol } from '../sessionservice';
import { toAction } from '../utils';

export function SplitViewPage({
  symbolSuggestions,
  stockEntries,
  manualMappings,
  onSellBuy,
  currency: currencyFormatter,
  formatDate: formatDateFn
}) {
  const { findsymbol } = useParams();
  const initialSymbol =
    findsymbol && findsymbol !== 'ALL'
      ? findsymbol
      : getActiveSymbol() || 'ALL';
  const [symbolFilter, setSymbolFilter] = useState(initialSymbol);
  const [isSelectorExpanded, setIsSelectorExpanded] = useState(
    initialSymbol === 'ALL'
  );
  const [expandedBuy, setExpandedBuy] = useState(null);
  const [sellBuy, setSellBuy] = useState(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState('');
  const [sellError, setSellError] = useState('');

  const openSellForm = (event, buy) => {
    event.stopPropagation();
    setSellBuy(buy);
    setSellPrice('');
    setSellDate(new Date().toISOString().slice(0, 10));
    setSellError('');
  };

  const saveSellEntry = (event) => {
    event.preventDefault();
    if (!sellBuy) return;

    const saved = onSellBuy({
      buyId: sellBuy.id,
      price: sellPrice,
      date: sellDate,
    });
    if (!saved) {
      setSellError('Could not save this sale. Please try again.');
      return;
    }

    setSellBuy(null);
  };

  const symbolBuys = stockEntries.filter((item) =>
    symbolFilter !== 'ALL'
    && item.symbol === symbolFilter
    && toAction(item.action) === 'buy'
  );

  const buyAllocated = {};
  manualMappings.forEach((link) => {
    if (!buyAllocated[link.buyId]) buyAllocated[link.buyId] = 1;
  });

  const unlinkedBuys = symbolBuys.filter((buy) =>
    (buyAllocated[buy.id] || 0) < 1
  );

  let sumOfPrice = 0;
  let sumOfQty = 0;

  for (const buy of unlinkedBuys) {
    sumOfPrice += (buy.price * buy.quantity) + (buy.charges || 0);
    sumOfQty += buy.quantity;
  }

  const avgPrice = sumOfQty ? sumOfPrice / sumOfQty : 0;
  const overallAmount = sumOfQty * avgPrice;
  let hike = 4;

  return (
    <>
      <SymbolSelector
        symbolSuggestions={symbolSuggestions}
        selectedSymbol={symbolFilter}
        onSymbolSelect={setSymbolFilter}
        onCollapse={() => setIsSelectorExpanded(false)}
        onExpand={() => setIsSelectorExpanded(true)}
      />
      {!isSelectorExpanded && <div className="split-view">
        {symbolFilter !== 'ALL' && (
          <>
            <div>
              Average price of open stocks:
              <strong> {currencyFormatter(avgPrice)}</strong>,
              Total quantity:<strong>{sumOfQty}</strong>
            </div>

            <div className="target-box-2">
              Target 1000 : {currencyFormatter((overallAmount + 1000) / sumOfQty)} <br />
              Target 1500 : {currencyFormatter((overallAmount + 1500) / sumOfQty)} <br />
              Target 2000 : {currencyFormatter((overallAmount + 2000) / sumOfQty)} <br />
              Target 2500 : {currencyFormatter((overallAmount + 2500) / sumOfQty)} <br />
            </div>
            <div className="target-box-3">
              Target {hike}% {currencyFormatter((overallAmount * hike) / 100)}: {currencyFormatter((overallAmount + ((overallAmount * hike) / 100)) / sumOfQty)} <br />
              Target {++hike}% {currencyFormatter((overallAmount * hike) / 100)}: {currencyFormatter((overallAmount + ((overallAmount * hike) / 100)) / sumOfQty)} <br />
              Target {++hike}% {currencyFormatter((overallAmount * hike) / 100)}: {currencyFormatter((overallAmount + ((overallAmount * hike) / 100)) / sumOfQty)} <br />
              Target {++hike}% {currencyFormatter((overallAmount * hike) / 100)}: {currencyFormatter((overallAmount + ((overallAmount * hike) / 100)) / sumOfQty)} <br />
            </div>
            <ul>
              {unlinkedBuys.map((buy, index) => {
                const isExpanded = expandedBuy === buy.id;
                const currentAmount =
                  (buy.quantity * buy.price) + (buy.charges || 0);

                return (
                  <li
                    key={buy.id}
                    onClick={() => setExpandedBuy(isExpanded ? null : buy.id)}
                  >
                    <div className="split-view-row">
                      <span>
                        {index + 1}.&nbsp;
                        {formatDateFn(buy.date)} - {currencyFormatter(currentAmount / buy.quantity)} X {buy.quantity}
                      </span>
                      <button
                        type="button"
                        className="btn-nav split-view-sell"
                        onClick={(event) => openSellForm(event, buy)}
                      >
                        Sell
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="target-box">
                        Target 500 : {currencyFormatter((currentAmount + 500) / buy.quantity)} <br />
                        Target 1000 : {currencyFormatter((currentAmount + 1000) / buy.quantity)} <br />
                        Target 1500 : {currencyFormatter((currentAmount + 1500) / buy.quantity)} <br />
                        Target 2000 : {currencyFormatter((currentAmount + 2000) / buy.quantity)} <br />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {sellBuy && (
              <div
                className="sell-modal-backdrop"
                onClick={(event) => {
                  if (event.target === event.currentTarget) setSellBuy(null);
                }}
              >
                <section
                  className="sell-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="sell-modal-title"
                >
                  <h2 id="sell-modal-title">Sell {sellBuy.symbol}</h2>
                  <p>Quantity: {sellBuy.quantity}</p>
                  <form className="sell-modal-form" onSubmit={saveSellEntry}>
                    <label>
                      Sell price
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={sellPrice}
                        onChange={(event) => setSellPrice(event.target.value)}
                        required
                        autoFocus
                      />
                    </label>
                    <label>
                      Sell date
                      <input
                        type="date"
                        value={sellDate}
                        onChange={(event) => setSellDate(event.target.value)}
                        required
                      />
                    </label>
                    {sellError && <p className="sell-modal-error" role="alert">{sellError}</p>}
                    <div className="sell-modal-actions">
                      <button type="submit">Save</button>
                      <button
                        type="button"
                        className="sell-modal-cancel"
                        onClick={() => setSellBuy(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </>
        )}
      </div>}
    </>
  );
}
