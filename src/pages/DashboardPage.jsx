import { Link, useNavigate } from 'react-router-dom';
import { currency, getDateKey } from '../utils';

export function DashboardPage({ totals,
  currency: currencyFormatter,
  openStockAges = {},
  mappingOpenAvgPrices = {},
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

  totalprofit = totalprofit - dpchargetotal - tax;


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
            <span className={`metric-badge ${totals.projectedAmount >= 0 ? 'balance-good' : 'balance-bad'}`}>
              Trade Balance {currencyFormatter(totals.projectedAmount)}
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
            <span
              className={`metric-badge ${totalprofit >= 0 ? 'net-profit-good' : 'net-profit-bad'
                }`}
            >
              Net Profit {currencyFormatter(totalprofit)}
            </span>

          </div>
        </article>
        <article className='card good'>
          <small>Today</small>
          <TodayBooked manualMappings={manualMappings} stockEntries={stockEntries} pnlByDate={pnlByDate}></TodayBooked>
        </article>
      </section>

      <ActiveTrade totals={totals} currency={currency} openStockAges={openStockAges}
        mappingOpenAvgPrices={mappingOpenAvgPrices} ></ActiveTrade>


    </>
  );
}
export function ActiveTrade({ totals,
  currency: currencyFormatter,
  openStockAges = {},
  mappingOpenAvgPrices = {} }) {

  return (<>

    <section className="panel">
      {totals.allocationLegend.length ? (
        <ul className="allocation-legend">
          {totals.allocationLegend.map((item) => {
            const openAvgPrice =
              mappingOpenAvgPrices[item.label] ?? item.avgPrice;
            const projectedSellPrice =
              openAvgPrice !== null && typeof openAvgPrice !== 'undefined'
                ? openAvgPrice * 1.04
                : null;

            if (openStockAges[item.label] == undefined) return;

            return (
              <li key={item.label}>
                <div className="active-stock-symbol">
                  <Link to={"/split-view/" + item.label}>{item.label}</Link>
                </div>
                {item.quantity !== null && item.avgPrice !== null && (<>
                <div className="active-stock-details">
                  <span>Buy: {currencyFormatter(openAvgPrice)}</span>
                  <span>Sell: {currencyFormatter(projectedSellPrice)}</span>
                  <span>Quantity: {item.quantity}</span>
                </div>
                <span className="stock-age-badge">
                  {openStockAges[item.label]}
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
      <span
        className={`metric-badge ${todaysold >= 0 ? 'balance-good' : 'balance-bad'
          }`}
      >
        {todaysold}
      </span>

    </div>
    <button className="btn-nav" onClick={() => history("/stocks")} >
      Stocks
    </button>
    <button className="btn-nav" onClick={() => history("/buy-sell-mapping")} >
      Map
    </button>
    <button className="btn-nav" onClick={() => history("/monthly-pnl")} >
      Profit
    </button>
  </>);
}
