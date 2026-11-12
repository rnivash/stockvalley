import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CustomSelect } from '../components/Navigation';
import { toAction, toNumber } from '../utils';
import { useNavigate } from 'react-router-dom';


export function SplitViewPage({ 
  symbolSuggestions,
  stockEntries,
  manualMappings,
  currency: currencyFormatter,
  formatDate: formatDateFn}) {
    
  const history = useNavigate();
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
    sumofprice += (unlinkedBuys[i].price * unlinkedBuys[i].quantity) + (unlinkedBuys[i].charges||0);
    sumofqty += unlinkedBuys[i].quantity;
    sumofcharges += unlinkedBuys[i].charges;
  }

  let avgprice = sumofprice/sumofqty;

  const overallamount = (sumofqty * avgprice);

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
        <div>Average price of open stocks:<strong> {currencyFormatter(avgprice)}</strong>, Total quantity:<strong>{sumofqty}</strong></div>
        <div>
          Map: <button className='plain-btn sv-btn' onClick={() => history("/symbol-map/" + findsymbol)} >{findsymbol}</button>
        </div>
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
