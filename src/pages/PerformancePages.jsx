import { formatMonthLabel } from '../utils';

export function SymbolPnlPage({ symbolProfitLossRows, currency: currencyFormatter }) {
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
export function MonthlyPnlPage({
  currency: currencyFormatter,
  pnlByDate
}) {

  const monthlyPerformanceRows ={};

  for(let idx in pnlByDate){
    let month = idx.slice(0,7);
    monthlyPerformanceRows[month] = (monthlyPerformanceRows[month] | 0 ) + pnlByDate[idx];
  }
  let monthpnl = [];

  Object.entries(monthlyPerformanceRows)
    .sort(([date1], [date2]) => date1.localeCompare(date2))
    .forEach(([date, value]) => {
        monthpnl.push({"monthKey" :date, "netPnl": value});
    });

  return (
    <section className="panel monthly-pnl-page">
      <h2>Month Wise Overall Profit / Loss</h2>
      <p className="chart-summary">
        Net P/L includes realized trade P/L and DP charges. Gain % is calculated
        as net P/L divided by cumulative net funds (carry-forward of monthly
        fund added minus withdrawn).
      </p>

      {monthpnl.length ? (
        <section className="monthly-chart-wrap">
          <h3>Monthly Gain Percentage</h3>
          <div className="monthly-chart-list">
            {monthpnl.map((item) => {
              

              return (
                <article
                  key={`${item.monthKey}-gain`}
                  className="monthly-chart-row"
                >
                  <div className="monthly-row-head">
                    <strong>{formatMonthLabel(item.monthKey)}</strong>
                    <strong className={item.netPnl >= 0 ? 'cell-good' : 'cell-bad'}>
                      {currencyFormatter(item.netPnl)}
                    </strong>
                  </div>
                  
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
export function DailyPLPage({
  currency: currencyFormatter,
  formatDate: formatDateFn,
  pnlByDate  
}) {

  const last15DaysData = [];

  Object.entries(pnlByDate)
    .sort(([date1], [date2]) => date2.localeCompare(date1))
    .forEach(([date, value]) => {
      last15DaysData.push({"date": date, "pnl": value});
    });

  return (
    <section className="panel">
      <h2>Day Wise Profit / Loss</h2>
      <p className="chart-summary">
        P/L breakdown for the most recent 15 trading days using exact
        FIFO-matched realized trade P/L.
      </p>

      {last15DaysData.length > 0 ? (
        <div className="pnl-table" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th
                  style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: 'bold',
                  }}
                >
                  Date
                </th>
                <th
                  style={{
                    padding: '0.75rem',
                    textAlign: 'right',
                    fontWeight: 'bold',
                  }}
                >
                  P/L
                </th>
              </tr>
            </thead>
            <tbody>
              {last15DaysData.map((item) => (
                <tr
                  key={item.date}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                >
                  <td style={{ padding: '0.75rem' }}>
                    {formatDateFn(item.date)}
                  </td>
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
        <p className="empty">No trade data available for the last 15 days.</p>
      )}
    </section>
  );
}
