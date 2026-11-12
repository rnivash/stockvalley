import { Link, useNavigate } from 'react-router-dom';
import { currency, getDateKey } from '../utils';
import { toAction, toNumber } from '../utils';

const formatDaysAgo = (value) => {
  if (!value) return '0';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '0';

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return '1';
  if (diffDays === 1) return '1';
  return `${diffDays}`;
};

export function DashboardPage({ 
  currency: currencyFormatter,
  stockEntries,
  manualMappings,
  pnlByDate,
  dpchargetotal,
  fundtotal }) {

  let tax = 0;

  for (let i in stockEntries) {
    let itm = stockEntries[i];
    tax = tax + itm.charges;

  }

  let totalprofit = 0;

  for (let idx in pnlByDate) {
    totalprofit = totalprofit + pnlByDate[idx];
  }

  let grossprofit = totalprofit;

  totalprofit = totalprofit - dpchargetotal;

  const symbolBuys = stockEntries.filter((item) => toAction(item.action) === 'buy');
  
    const buyAllocated = {};
  
    manualMappings.forEach((link) => {
      if (!buyAllocated[link.buyId])
        buyAllocated[link.buyId] = 1;
    });
  
    const unlinkedBuys = symbolBuys.filter((b) => {
      const allocated = buyAllocated[b.id] || 0;
      return allocated < 1;
    });

    const openStocks = {};

     unlinkedBuys.forEach((link) => {
      if (!openStocks[link.symbol])
        openStocks[link.symbol] = [link.quantity, (link.price * link.quantity) + (link.charges||0), link.date];
      else{
        openStocks[link.symbol][0] += link.quantity;
        openStocks[link.symbol][1] += ((link.price * link.quantity)+ (link.charges||0));
        openStocks[link.symbol][2] = openStocks[link.symbol][2] > link.date ? openStocks[link.symbol][2] : link.date;
      }
        
    });

    // write for loop using openStocks

    let totalopeninvestdamount = 0;

    for (const [symbol, [quantity, totalAmount]] of Object.entries(openStocks)) {
      totalopeninvestdamount += totalAmount;
    }

    const prjectedBalnceAmount = (fundtotal[0] - fundtotal[1])+ totalprofit - totalopeninvestdamount;


  return (
    <>
      <section className="summary-grid">
        <article className="card good">
          <small>Deposits &amp; Withdrawals</small>
          <div className="metric-badges">
            <span className="metric-badge deposit">
              Deposited {currencyFormatter(fundtotal[0])}
            </span>
            <span className="metric-badge withdrawn">
              Withdrawn {currencyFormatter(fundtotal[1])}
            </span>
            <span className="metric-badge net-funds">
              Balance {currencyFormatter(fundtotal[0] - fundtotal[1])}
            </span>
            
          </div>
        </article>

        <article className="card good">
          <small>Profit & Loss</small>
          <div className="metric-badges">
            <span className={`metric-badge net-profit-bad`} >
              Tax {currencyFormatter(tax)}
            </span>
            <span className={`metric-badge net-profit-bad`} >
              DP {currencyFormatter(dpchargetotal)}
            </span>
            <span className={`metric-badge ${grossprofit >= 0 ? 'net-profit-good' : 'net-profit-bad' }`}>
              Gross Profit {currencyFormatter(grossprofit)}
            </span>
            <span className={`metric-badge ${totalprofit >= 0 ? 'net-profit-good' : 'net-profit-bad'}`}>
              Net Profit {currencyFormatter(totalprofit)}
            </span>
          </div>
        </article>
        <article className='card good'>
          <small>Today</small>
          <TodayBooked manualMappings={manualMappings} stockEntries={stockEntries} pnlByDate={pnlByDate}></TodayBooked>
        </article>
        <article className='card good'>
         <small>Numbers</small>
          <div className="metric-badges">
            <span className={`metric-badge ${totalopeninvestdamount >= 0 ? 'balance-good' : 'balance-bad'}`}>
              Invested {currencyFormatter(totalopeninvestdamount)}
            </span>
            <span className={`metric-badge ${prjectedBalnceAmount>= 0 ? 'balance-good' : 'balance-bad'}`}>
              Trade Balance {currencyFormatter(prjectedBalnceAmount)}
            </span>
          </div>
        </article>
      </section>

      <ActiveTrade currency={currency} openStocks={openStocks} >
      </ActiveTrade>


    </>
  );
}
export function ActiveTrade({ 
  currency: currencyFormatter,
  openStocks = {}}) {

  const history = useNavigate();


  return (<>

    <section className="panel">
      {Object.keys(openStocks).length ? (
        <ul className="allocation-legend">
          {Object.entries(openStocks).map(([symbol, [quantity, totalAmount, date]]) => {
            const openAvgPrice = totalAmount / quantity;
            const projectedSellPrice =
              openAvgPrice !== null && typeof openAvgPrice !== 'undefined' && openAvgPrice !== 0
                ? openAvgPrice * 1.04
                : null;

            return (
              <li key={symbol}>
                <div className="active-stock-symbol">
                  <button className="plain-btn" onClick={() => history("/split-view/" + symbol)} >
                    {symbol}
                  </button>
                </div>
                {quantity !== null && openAvgPrice !== null && (<>
                <div className="active-stock-details">
                  <span>Buy: {currencyFormatter(openAvgPrice)}</span>
                  <span>Sell: {currencyFormatter(projectedSellPrice)}</span>
                  <span>Quantity: {quantity}</span>
                </div>
                <span className="stock-age-badge">
                  {formatDaysAgo(date)}
                </span></>)}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">No active stock investments yet.</p>
      )}
    </section>
  </>);

}
export function TodayBooked({ pnlByDate }) {
  const today = getDateKey(new Date());
  const todaysold = pnlByDate[today];

  const history = useNavigate();

  return (<>
    <div className="metric-badges">
      {todaysold !== undefined? (<span className={`metric-badge ${todaysold >= 0 ? 'balance-good' : 'balance-bad'}`}>
        {todaysold}
      </span>):(<></>)}
    </div>
    <button className="btn-nav" onClick={() => history("/simple-stocks")} >
      Stocks
    </button>    
    <button className="btn-nav" onClick={() => history("/monthly-pnl")} >
      Profit
    </button>
    <button className="btn-nav" onClick={() => history("/daily-pnl")} >
      Daily
    </button>
  </>);
}
