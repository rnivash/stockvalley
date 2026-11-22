import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SymbolSelector } from '../components/SymbolSelector';
import { toAction, toNumber } from '../utils';

const ACTION_ORDER = {
  buy: 0,
  sell: 1,
};

function toDayMs(value) {
  if (!value) return Number.NaN;

  const raw = String(value).trim();
  if (!raw) return Number.NaN;

  const match = raw.match(/^\d{4}-\d{2}-\d{2}$/);
  if (match) {
    const [year, month, day] = raw.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return Number.NaN;

  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
}

function sortTransactionsByDate(a, b) {
  const aDate = toDayMs(a.date);
  const bDate = toDayMs(b.date);

  if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
    return 0;
  }

  if (bDate !== aDate) return aDate - bDate;

  const actionDiff =
    (ACTION_ORDER[toAction(a.action)] ?? 99) -
    (ACTION_ORDER[toAction(b.action)] ?? 99);

  if (actionDiff !== 0) return actionDiff;

  return String(a.id).localeCompare(String(b.id));
}

function sortByTradeDate(a, b) {
  const aDate = toDayMs(a.date);
  const bDate = toDayMs(b.date);

  if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
    return String(a.id).localeCompare(String(b.id));
  }

  if (aDate !== bDate) return aDate - bDate;

  return String(a.id).localeCompare(String(b.id));
}

function getAllocationTotals(stockEntries, manualMappings, symbol) {
  const buyAllocated = {};
  const sellAllocated = {};
  const symbolMappings = manualMappings.filter((m) => m.symbol === symbol);

  symbolMappings.forEach((link) => {
    buyAllocated[link.buyId] = (buyAllocated[link.buyId] || 0) + toNumber(link.qty);
    sellAllocated[link.sellId] = (sellAllocated[link.sellId] || 0) + toNumber(link.qty);
  });

  const symbolBuys = [...stockEntries]
    .filter(
      (entry) =>
        entry.symbol === symbol && toAction(entry.action) === 'buy'
    )
    .sort(sortTransactionsByDate);

  const symbolSells = [...stockEntries]
    .filter(
      (entry) =>
        entry.symbol === symbol && toAction(entry.action) === 'sell'
    )
    .sort(sortTransactionsByDate);

  const unlinkedBuys = symbolBuys.filter(
    (buy) => (buyAllocated[buy.id] || 0) < toNumber(buy.quantity)
  );

  const unlinkedSells = symbolSells.filter(
    (sell) => (sellAllocated[sell.id] || 0) < toNumber(sell.quantity)
  );

  return {
    buyAllocated,
    sellAllocated,
    symbolBuys,
    symbolSells,
    unlinkedBuys,
    unlinkedSells,
    symbolMappings,
  };
}

export function SymbolMapPage({
  symbolSuggestions,
  stockEntries,
  manualMappings,
  onAddMapping,
  onRemoveMapping,
  onResetSymbol,
  currency: currencyFormatter,
  formatDate: formatDateFn,
}) {
  const { findsymbol } = useParams();
  const [selectedSymbol, setSelectedSymbol] = useState(
    findsymbol && findsymbol !== 'ALL' ? String(findsymbol).toUpperCase() : 'ALL'
  );
  const [selectedBuyId, setSelectedBuyId] = useState(null);
  const [selectedSellId, setSelectedSellId] = useState(null);
  const [mapQty, setMapQty] = useState(0);
  const [isSelectorExpanded, setIsSelectorExpanded] = useState(
    (findsymbol || 'ALL') === 'ALL'
  );

  useEffect(() => {
    const nextSymbol =
      findsymbol && findsymbol !== 'ALL'
        ? String(findsymbol).toUpperCase()
        : 'ALL';
    setSelectedSymbol(nextSymbol);
    setSelectedBuyId(null);
    setSelectedSellId(null);
    setMapQty(0);
  }, [findsymbol]);

  const resolvedSymbol =
    selectedSymbol === 'ALL' ? (findsymbol && findsymbol !== 'ALL' ? String(findsymbol).toUpperCase() : '') : selectedSymbol;

  const effectiveSymbol = resolvedSymbol || selectedSymbol;
  const symbolOptions = [...new Set(symbolSuggestions)].sort();

  const { buyAllocated, sellAllocated, unlinkedBuys, unlinkedSells, symbolMappings } = useMemo(() => {
    if (!effectiveSymbol || effectiveSymbol === 'ALL') {
      return {
        buyAllocated: {},
        sellAllocated: {},
        unlinkedBuys: [],
        unlinkedSells: [],
        symbolMappings: [],
      };
    }

    return getAllocationTotals(stockEntries, manualMappings, effectiveSymbol);
  }, [effectiveSymbol, stockEntries, manualMappings]);

  const selectedBuyTx = stockEntries.find((entry) => entry.id === selectedBuyId) || null;
  const selectedSellTx = stockEntries.find((entry) => entry.id === selectedSellId) || null;

  const maxLinkQty = useMemo(() => {
    if (!selectedBuyTx || !selectedSellTx) return 0;
    const buyRemaining = toNumber(selectedBuyTx.quantity) - (buyAllocated[selectedBuyTx.id] || 0);
    const sellRemaining = toNumber(selectedSellTx.quantity) - (sellAllocated[selectedSellTx.id] || 0);
    return Math.min(Math.max(buyRemaining, 0), Math.max(sellRemaining, 0));
  }, [buyAllocated, selectedBuyTx, selectedSellTx, sellAllocated]);

  useEffect(() => {
    setMapQty(maxLinkQty);
  }, [maxLinkQty]);

  const handleAddLink = () => {
    if (!selectedBuyTx || !selectedSellTx) return;
    const qty = toNumber(mapQty);
    const safeQty = Math.min(qty, maxLinkQty);
    if (safeQty <= 0) return;

    onAddMapping({
      buyId: selectedBuyTx.id,
      sellId: selectedSellTx.id,
      qty: safeQty,
    });

    setSelectedBuyId(null);
    setSelectedSellId(null);
    setMapQty(0);
  };

  const canMap = Boolean(selectedBuyTx && selectedSellTx && maxLinkQty > 0);
  const symbolTrades = effectiveSymbol && effectiveSymbol !== 'ALL'
    ? [...stockEntries.filter((entry) => entry.symbol === effectiveSymbol)].sort(sortTransactionsByDate)
    : [];

  const handleSymbolChange = (nextSymbol) => {
    setSelectedSymbol(nextSymbol);
    setSelectedBuyId(null);
    setSelectedSellId(null);
    setMapQty(0);
  };

  const openTrades = useMemo(() => {
    if (!effectiveSymbol || effectiveSymbol === 'ALL') return [];

    return [...unlinkedBuys, ...unlinkedSells].sort((a, b) => {
      const aDate = toDayMs(a.date);
      const bDate = toDayMs(b.date);

      if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
        return String(a.id).localeCompare(String(b.id));
      }

      if (aDate !== bDate) return aDate - bDate;

      const aActionRank = ACTION_ORDER[toAction(a.action)] ?? 99;
      const bActionRank = ACTION_ORDER[toAction(b.action)] ?? 99;

      if (aActionRank !== bActionRank) return aActionRank - bActionRank;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [effectiveSymbol, unlinkedBuys, unlinkedSells]);

  const mappedRows = symbolMappings
    .map((link) => {
      const buyTx = stockEntries.find((entry) => entry.id === link.buyId);
      const sellTx = stockEntries.find((entry) => entry.id === link.sellId);

      if (!buyTx || !sellTx) return null;

      return {
        ...link,
        buyTx,
        sellTx,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const buyDiff =
        new Date(`${a.buyTx.date}T00:00:00`).getTime() -
        new Date(`${b.buyTx.date}T00:00:00`).getTime();

      if (buyDiff !== 0) return buyDiff;

      const sellDiff =
        new Date(`${a.sellTx.date}T00:00:00`).getTime() -
        new Date(`${b.sellTx.date}T00:00:00`).getTime();

      if (sellDiff !== 0) return sellDiff;

      return String(a.buyId).localeCompare(String(b.buyId));
    });

  const totalMappedPL = mappedRows.reduce((total, link) => {
    const buyCost =
      link.qty * link.buyTx.price +
      (link.buyTx.charges * link.qty) / link.buyTx.quantity;
    const sellValue =
      link.qty * link.sellTx.price -
      (link.sellTx.charges * link.qty) / link.sellTx.quantity;

    return total + (sellValue - buyCost);
  }, 0);

  return (
    <section className="panel">
      <SymbolSelector
        symbols={symbolOptions}
        selectedSymbol={selectedSymbol}
        onSymbolSelect={handleSymbolChange}
        onCollapse={() => setIsSelectorExpanded(false)}
        onExpand={() => setIsSelectorExpanded(true)}
        includeAll={false}
      />

      {!isSelectorExpanded && effectiveSymbol && effectiveSymbol !== 'ALL' ? (
        <div className="mapping-summary-table">
          <div className="mapping-card">
            <div className="mapping-header">
              <div className="mapping-header-main">
                <div className="mapping-header-title">
                  <strong className="symbol-label">{effectiveSymbol}</strong>
                </div>
              </div>
              <div className="mapping-header-end">                
                <strong className={totalMappedPL >= 0 ? 'cell-good' : 'cell-bad'}>
                  {currencyFormatter(totalMappedPL)}
                </strong>
              </div>
            </div>

            <div className="mapping-details">
              <div className="mapping-transactions">
                {openTrades.length ? (
                  <ul className="tx-list">
                    {openTrades.map((trade) => {
                      const isBuy = toAction(trade.action) === 'buy';
                      const remaining = toNumber(trade.quantity) - (
                        isBuy ? (buyAllocated[trade.id] || 0) : (sellAllocated[trade.id] || 0)
                      );
                      const selected =
                        (isBuy && selectedBuyId === trade.id) ||
                        (!isBuy && selectedSellId === trade.id);
                      const isInvalidSelection =
                        selected &&
                        Boolean(selectedBuyTx && selectedSellTx) &&
                        toNumber(selectedSellTx.price) < toNumber(selectedBuyTx.price);

                      return (
                        <li
                          key={trade.id}
                          className={`tx-item ${selected ? 'selected' : ''} ${
                            isInvalidSelection ? 'selected-invalid' : ''
                          }`}
                          onClick={() => {
                            if (isBuy) {
                              setSelectedBuyId(trade.id);
                            } else {
                              setSelectedSellId(trade.id);
                            }
                          }}
                        >
                          <div className="tx-row">
                            <div className="tx-side-badge">
                              <span className={`tx-badge ${isBuy ? 'buy-badge' : 'sell-badge'}`}>
                                {isBuy ? 'BUY' : 'SELL'}
                              </span>
                            </div>
                            <div className="tx-side-values">
                              <span className="tx-qty">{remaining} / {trade.quantity}</span>
                            </div>

                            <div className="tx-side-values">
                              <span className="tx-price">{currencyFormatter(trade.price)}</span>
                            </div>

                            <div className="tx-side-values">
                              <span className="tx-date">{formatDateFn(trade.date)}</span>
                            </div>

                            <div className="tx-side-meta">
                              {selected && selectedBuyTx && selectedSellTx ? (
                                <button type="button" className="inline-link-btn" 
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleAddLink();
                                  }}
                                >
                                  Link {mapQty || 0}
                                </button>
                              ) : (<></>)}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="no-transactions">No open trades available for this symbol.</p>
                )}
              </div>

              <div className="existing-links">
                <h4>Mapped Links ({mappedRows.length})</h4>
                {mappedRows.length ? (
                  <ul className="links-list">
                    {mappedRows.map((link) => {
                      const buyCost =
                        link.qty * link.buyTx.price +
                        (link.buyTx.charges * link.qty) / link.buyTx.quantity;
                      const sellValue =
                        link.qty * link.sellTx.price -
                        (link.sellTx.charges * link.qty) / link.sellTx.quantity;
                      const linkPL = sellValue - buyCost;

                      return (
                         <li key={`${link.buyId}-${link.sellId}`} className="link-item">
                          <div className="link-details-wrapper">
                            <div className="link-info">
                              <span className="link-detail">
                                Quantity: {link.qty}, &nbsp;
                                <span className={`${linkPL >= 0 ? 'cell-good' : 'cell-bad'}`}>
                                  P&L: {currencyFormatter(linkPL)}
                                </span>
                              </span>
                            </div>
                            <div className="link-dates">
                              <span className="link-date">Buy: {currencyFormatter(link.buyTx.price)}</span>
                              <span className="link-date">Sell: {currencyFormatter(link.sellTx.price)}</span>
                            </div>
                            <div className="link-dates">
                              <span className="link-date">Buy: {formatDateFn(link.buyTx.date)}</span>
                              <span className="link-date">Sell: {formatDateFn(link.sellTx.date)}</span>
                            </div>
                          </div>
                          <button
                            className="remove-link-btn"
                            onClick={() => onRemoveMapping(link.buyId, link.sellId)}
                          >
                            X
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="no-links">No mappings for this symbol yet.</p>
                )}
              </div>

              {mappedRows.length > 0 && (
                <button className="reset-btn" onClick={() => onResetSymbol(effectiveSymbol)}>
                  Clear All Links
                </button>
              )}
            </div>
          </div>
        </div>
      ) : !isSelectorExpanded ? (
        <div className="empty">
          Select a stock symbol to begin mapping.
        </div>
      ) : null}
    </section>
  );
}