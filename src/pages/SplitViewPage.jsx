import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SymbolSelector } from '../components/SymbolSelector';
import { getActiveSymbol } from '../sessionservice';
import { toAction } from '../utils';

export function SplitViewPage({
  symbolSuggestions,
  stockEntries,
  manualMappings,
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
                    {index + 1}.&nbsp;
                    {formatDateFn(buy.date)} - {currencyFormatter(currentAmount  / buy.quantity)} X {buy.quantity}
                    <br />
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
          </>
        )}
      </div>}
    </>
  );
}
