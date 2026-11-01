import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CustomSelect } from '../components/Navigation';
import { toAction, toNumber } from '../utils';

export function BuySellMappingPage({
  symbolSuggestions,
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
  const [symbolFilter, setSymbolFilter] = useState('ALL');
  const [showOpenOnly, setShowOpenOnly] = useState(false);

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

  const symbols = symbolSuggestions.filter((symbol) => {
    if (symbolFilter !== 'ALL' && symbol !== symbolFilter) return false;
    if (showOpenOnly) {
      const symbolMappings = manualMappings.filter((m) => m.symbol === symbol);
      const buyAllocatedMap = {};
      symbolMappings.forEach((m) => {
        buyAllocatedMap[m.buyId] = (buyAllocatedMap[m.buyId] || 0) + m.qty;
      });
      const hasOpenBuy = stockEntries.some(
        (e) =>
          e.symbol === symbol &&
          toAction(e.action) === 'buy' &&
          toNumber(e.quantity) - (buyAllocatedMap[e.id] || 0) > 0
      );
      if (!hasOpenBuy) return false;
    }
    return true;
  });

  return (
    <section className="panel">
      <h2>Buy-Sell Mapping</h2>
      <p className="chart-summary">
        Manually link buy and sell transactions to define which sales correspond
        to which purchases.
      </p>

      {symbolSuggestions.length ? (
        <>
          <div className="mapping-filters">
            <div className="stock-filter-row">
              <label htmlFor="mapping-symbol-filter">Symbol</label>
              <CustomSelect
                id="mapping-symbol-filter"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
              >
                <option value="ALL">All Symbols</option>
                {symbolSuggestions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </CustomSelect>
            </div>
            <label className="mapping-toggle-label">
              <input
                type="checkbox"
                checked={showOpenOnly}
                onChange={(e) => setShowOpenOnly(e.target.checked)}
              />
              Open stocks only
            </label>
          </div>

          <div className="mapping-summary-table">
            {symbols.length ? (
              symbols.map((symbol) => {
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
                      onClick={() =>
                        setExpandedSymbol(isExpanded ? null : symbol)
                      }
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
                          className={
                            totalLinkedPL >= 0 ? 'cell-good' : 'cell-bad'
                          }
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
                          <h4>
                            Unlinked Buy Transactions ({unlinkedBuys.length})
                          </h4>
                          {unlinkedBuys.length > 0 ? (
                            <ul className="tx-list">
                              {unlinkedBuys.map((buy) => {
                                const allocated = buyAllocated[buy.id] || 0;
                                const remaining = buy.quantity - allocated;
                                return (
                                  <li
                                    key={buy.id}
                                    className={`tx-item ${
                                      selectedBuyId === buy.id ? 'selected' : ''
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
                                          (buy.charges * remaining) /
                                            buy.quantity
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
                                    className={`tx-item ${
                                      selectedSellId === sell.id
                                        ? 'selected'
                                        : ''
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
                                          (sell.charges * remaining) /
                                            sell.quantity
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

                              const buyAllocatedQty =
                                buyAllocated[buyTx.id] || 0;
                              const sellAllocatedQty =
                                sellAllocated[sellTx.id] || 0;
                              const buyRemaining =
                                buyTx.quantity - buyAllocatedQty;
                              const sellRemaining =
                                sellTx.quantity - sellAllocatedQty;
                              const linkQty = Math.min(
                                buyRemaining,
                                sellRemaining
                              );

                              return (
                                <div className="control-group">
                                  <button
                                    onClick={handleAddLink}
                                    disabled={false}
                                  >
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

                                  if(!buyTx || !sellTx) return;

                                  const buyCost =
                                    link.qty * buyTx.price +
                                    (buyTx.charges * link.qty) / buyTx.quantity;
                                  const sellValue =
                                    link.qty * sellTx.price -
                                    (sellTx.charges * link.qty) /
                                      sellTx.quantity;
                                  const linkPL = sellValue - buyCost;

                                  return (
                                    <li key={idx} className="link-item">
                                      <div className="link-details-wrapper">
                                        <div className="link-info">
                                          <span className="link-detail">
                                            {link.qty} @{' '}
                                            {currencyFormatter(
                                              buyTx?.price || 0
                                            )}{' '}
                                            →{' '}
                                            {currencyFormatter(
                                              sellTx?.price || 0
                                            )}
                                          </span>
                                          <span
                                            className={`link-pl ${
                                              linkPL >= 0
                                                ? 'cell-good'
                                                : 'cell-bad'
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
                                          onRemoveMapping(
                                            link.buyId,
                                            link.sellId
                                          )
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
              })
            ) : (
              <p className="empty">No symbols match the current filter.</p>
            )}
          </div>
        </>
      ) : (
        <p className="empty">
          No trades yet. Add buy and sell entries to start mapping.
        </p>
      )}
    </section>
  );
}
export function SplitViewPage({ 
  symbolSuggestions,
  stockEntries,
  manualMappings,
  currency: currencyFormatter,
  formatDate: formatDateFn}) {

  const { findsymbol } = useParams();
  const [symbolFilter, setSymbolFilter] = useState(findsymbol ? findsymbol : 'ALL');
  const [expandedBuy, setExpandedBuy] = useState(null);

  const symbolBuys = stockEntries.filter((item) => symbolFilter !== 'ALL' 
    && item.symbol === symbolFilter && toAction(item.action) === 'buy');

  const buyAllocated = {};

  manualMappings.forEach((link) => {
    if (!buyAllocated[link.buyId])
      buyAllocated[link.buyId] = 1;
  });

  const unlinkedBuys = symbolBuys.filter((b) => {
    const allocated = buyAllocated[b.id] || 0;
    return allocated < 1;
  });

  let sumofprice =0;
  let sumofqty =0;
  let sumofcharges =0;

  for(let i in unlinkedBuys){
    sumofprice += unlinkedBuys[i].price * unlinkedBuys[i].quantity;
    sumofqty += unlinkedBuys[i].quantity;
    sumofcharges += unlinkedBuys[i].charges;
  }

  let avgprice = sumofprice/sumofqty;

  const overallamount = (sumofqty * avgprice) + sumofcharges;

  return (<>

    <div>
      <CustomSelect
        id="split-view-filter"
        value={symbolFilter}
        onChange={(e) => setSymbolFilter(e.target.value)}
      >
        <option value="ALL">All Symbols</option>
        {symbolSuggestions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </CustomSelect>
    </div>
    <div className='split-view'>
      {symbolFilter != 'ALL' ? (<>
        <div>Average price of open stocks: {currencyFormatter(avgprice)}, Total quantity:{sumofqty}</div>
       
        <div className='target-box-2'>
                    Target 1000 : {currencyFormatter((overallamount + 1000) / sumofqty)} <br />
                    Target 1500 : {currencyFormatter((overallamount + 1500) / sumofqty)} <br />
                    Target 2000 : {currencyFormatter((overallamount + 2000) / sumofqty)}<br />
                    Target 2500 : {currencyFormatter((overallamount + 2500) / sumofqty)}<br />
        </div>
        <div className='target-box-3'>
                    Target 5% {currencyFormatter(((overallamount * 5)/ 100))}: {currencyFormatter((overallamount + ((overallamount * 5)/ 100)) / sumofqty)} <br />
                    Target 6% {currencyFormatter(((overallamount * 6)/ 100))}: {currencyFormatter((overallamount + ((overallamount * 6)/ 100)) / sumofqty)} <br />
                    Target 7% {currencyFormatter(((overallamount * 7)/ 100))}: {currencyFormatter((overallamount + ((overallamount * 7)/ 100)) / sumofqty)}<br />
                    Target 8% {currencyFormatter(((overallamount * 8)/ 100))}: {currencyFormatter((overallamount + ((overallamount * 8)/ 100)) / sumofqty)}<br />
        </div>
        <ul>
          {
            unlinkedBuys.map((item1, idx) => {

              const isExpanded = expandedBuy === item1.id;
              const currentamount = (item1.quantity * item1.price) + item1.charges;
              return (
                <li key={item1.id} onClick={() => { setExpandedBuy(isExpanded ? null : item1.id) }}> {idx + 1}.&nbsp;
                  {formatDateFn(item1.date)} - {currencyFormatter(item1.price)} X {item1.quantity}
                  = {currencyFormatter(currentamount)}
                  <br />
                  {isExpanded && (<div className='target-box'>
                    Target 500 : {currencyFormatter((currentamount + 500) / item1.quantity)} <br />
                    Target 1000 : {currencyFormatter((currentamount + 1000) / item1.quantity)} <br />
                    Target 1500 : {currencyFormatter((currentamount + 1500) / item1.quantity)}<br />
                    Target 2000 : {currencyFormatter((currentamount + 2000) / item1.quantity)}<br />
                  </div>)}
                </li>
              )
            })

          }
        </ul>
      </>) : (<></>)}
    </div>

  </>);

}
