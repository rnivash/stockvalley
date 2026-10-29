import { getDateKey, normalizeCreatedAt, toAction, toDate, toNumber } from './utils';

export function calculateTotals({ cashEntries, stockEntries, dpChargeEntries }) {
  const totalFundAdded = cashEntries.reduce(
    (sum, item) =>
      item.type === 'deposit' ? sum + toNumber(item.amount) : sum,
    0
  );

  const totalFundWithdrawn = cashEntries.reduce(
    (sum, item) =>
      item.type === 'withdraw' ? sum + toNumber(item.amount) : sum,
    0
  );

  const cashDeposited = totalFundAdded - totalFundWithdrawn;

  const orderedStocks = [...stockEntries]
    .map((item, index) => ({ ...item, _index: index }))
    .sort((a, b) => {
      const aDate = toDate(a.date)?.getTime() || 0;
      const bDate = toDate(b.date)?.getTime() || 0;
      if (aDate !== bDate) return aDate - bDate;

      const aCreated = normalizeCreatedAt(a.createdAt);
      const bCreated = normalizeCreatedAt(b.createdAt);
      if (aCreated !== null && bCreated !== null && aCreated !== bCreated)
        return aCreated - bCreated;

      // Fallback for older entries: list is newest-first, so reverse index yields oldest-first.
      return b._index - a._index;
    });

  const stockCashSummary = orderedStocks.reduce(
    (acc, item) => {
      const qty = toNumber(item.quantity);
      const price = toNumber(item.price);
      const charges = toNumber(item.charges);
      const action = toAction(item.action);
      const value = qty * price;

      acc.totalCharges += charges;
      if (action === 'buy') {
        acc.totalBought += value;
        acc.tradeCashFlow -= value + charges;
        return acc;
      }

      acc.totalSold += value;
      acc.tradeCashFlow += value - charges;
      return acc;
    },
    {
      totalBought: 0,
      totalSold: 0,
      totalCharges: 0,
      tradeCashFlow: 0,
    }
  );

  const stocksBySymbol = orderedStocks.reduce((map, item) => {
    if (!map[item.symbol]) map[item.symbol] = [];
    map[item.symbol].push(item);
    return map;
  }, {});

  const symbolProfitLoss = {};
  const realizedSummary = {
    lotsBySymbol: {},
    matchedSellValue: 0,
    matchedBuyValue: 0,
    matchedSellGrossValue: 0,
    matchedBuyGrossValue: 0,
    matchedSellCharges: 0,
    matchedBuyCharges: 0,
  };

  const stockPositions = {};

  Object.entries(stocksBySymbol).forEach(([symbol, symbolItems]) => {
    const dayGroups = symbolItems.reduce((map, item) => {
      const dateKey = getDateKey(item.date);
      if (!dateKey) return map;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(item);
      return map;
    }, {});

    const lots = [];
    const summary = {
      symbol,
      quantity: 0,
      matchedBuyValue: 0,
      matchedSellValue: 0,
      matchedBuyGrossValue: 0,
      matchedSellGrossValue: 0,
      matchedBuyCharges: 0,
      matchedSellCharges: 0,
      lots,
    };

    Object.keys(dayGroups)
      .sort()
      .forEach((dateKey) => {
        const dayItems = dayGroups[dateKey];
        const dayBuyItems = dayItems.filter(
          (item) => toAction(item.action) === 'buy'
        );
        const daySellItems = dayItems.filter(
          (item) => toAction(item.action) === 'sell'
        );

        const dayBuyQty = dayBuyItems.reduce(
          (sum, item) => sum + toNumber(item.quantity),
          0
        );
        const dayBuyGrossValue = dayBuyItems.reduce(
          (sum, item) => sum + toNumber(item.quantity) * toNumber(item.price),
          0
        );
        const dayBuyCharges = dayBuyItems.reduce(
          (sum, item) => sum + toNumber(item.charges),
          0
        );

        const daySellQty = daySellItems.reduce(
          (sum, item) => sum + toNumber(item.quantity),
          0
        );
        const daySellGrossValue = daySellItems.reduce(
          (sum, item) => sum + toNumber(item.quantity) * toNumber(item.price),
          0
        );
        const daySellCharges = daySellItems.reduce(
          (sum, item) => sum + toNumber(item.charges),
          0
        );

        const intradayQty = Math.min(dayBuyQty, daySellQty);
        const intradayBuyGrossValue =
          dayBuyQty > 0 ? (dayBuyGrossValue * intradayQty) / dayBuyQty : 0;
        const intradayBuyCharges =
          dayBuyQty > 0 ? (dayBuyCharges * intradayQty) / dayBuyQty : 0;
        const intradaySellGrossValue =
          daySellQty > 0 ? (daySellGrossValue * intradayQty) / daySellQty : 0;
        const intradaySellCharges =
          daySellQty > 0 ? (daySellCharges * intradayQty) / daySellQty : 0;

        if (intradayQty > 0) {
          summary.quantity += intradayQty;
          summary.matchedBuyGrossValue += intradayBuyGrossValue;
          summary.matchedSellGrossValue += intradaySellGrossValue;
          summary.matchedBuyCharges += intradayBuyCharges;
          summary.matchedSellCharges += intradaySellCharges;
          summary.matchedBuyValue +=
            intradayBuyGrossValue + intradayBuyCharges;
          summary.matchedSellValue +=
            intradaySellGrossValue - intradaySellCharges;

        }

        const remainingBuyQty = dayBuyQty - intradayQty;
        const remainingSellQty = daySellQty - intradayQty;

        if (remainingBuyQty > 0) {
          lots.push({
            qty: remainingBuyQty,
            grossValue: dayBuyGrossValue - intradayBuyGrossValue,
            charges: dayBuyCharges - intradayBuyCharges,
            dateKey,
          });
        }

        if (remainingSellQty > 0) {
          const remainingSellGrossValue =
            daySellGrossValue - intradaySellGrossValue;
          const remainingSellCharges = daySellCharges - intradaySellCharges;
          let sellQuantityLeft = remainingSellQty;

          while (sellQuantityLeft > 0 && lots.length > 0) {
            const lot = lots[0];
            const matchedQty = Math.min(sellQuantityLeft, lot.qty);
            const lotRatio = lot.qty > 0 ? matchedQty / lot.qty : 0;
            const matchedBuyGrossValue = lot.grossValue * lotRatio;
            const matchedBuyCharges = lot.charges * lotRatio;
            const sellRatio =
              remainingSellQty > 0 ? matchedQty / remainingSellQty : 0;
            const matchedSellGrossValue =
              remainingSellQty > 0 ? remainingSellGrossValue * sellRatio : 0;
            const matchedSellCharges =
              remainingSellQty > 0 ? remainingSellCharges * sellRatio : 0;

            summary.quantity += matchedQty;
            summary.matchedBuyGrossValue += matchedBuyGrossValue;
            summary.matchedSellGrossValue += matchedSellGrossValue;
            summary.matchedBuyCharges += matchedBuyCharges;
            summary.matchedSellCharges += matchedSellCharges;
            summary.matchedBuyValue +=
              matchedBuyGrossValue + matchedBuyCharges;
            summary.matchedSellValue +=
              matchedSellGrossValue - matchedSellCharges;


            lot.qty -= matchedQty;
            lot.grossValue -= matchedBuyGrossValue;
            lot.charges -= matchedBuyCharges;
            sellQuantityLeft -= matchedQty;

            if (lot.qty <= 0) lots.shift();
          }
        }
      });

    symbolProfitLoss[symbol] = summary;
    realizedSummary.lotsBySymbol[symbol] = lots;
    realizedSummary.matchedBuyValue += summary.matchedBuyValue;
    realizedSummary.matchedSellValue += summary.matchedSellValue;
    realizedSummary.matchedBuyGrossValue += summary.matchedBuyGrossValue;
    realizedSummary.matchedSellGrossValue += summary.matchedSellGrossValue;
    realizedSummary.matchedBuyCharges += summary.matchedBuyCharges;
    realizedSummary.matchedSellCharges += summary.matchedSellCharges;

    stockPositions[symbol] = {
      symbol,
      lots: lots.map((lot) => ({ ...lot })),
    };
  });

  const closedTradeDiff =
    realizedSummary.matchedSellValue - realizedSummary.matchedBuyValue;
  const closedTradeDiffWithoutCharges =
    realizedSummary.matchedSellGrossValue -
    realizedSummary.matchedBuyGrossValue;
  const closedTradeCharges =
    realizedSummary.matchedSellCharges + realizedSummary.matchedBuyCharges;
  const totalDpCharges = dpChargeEntries.reduce(
    (sum, item) => sum + Math.abs(toNumber(item.amount)),
    0
  );

  const pnlAfterDpCharges = closedTradeDiff - totalDpCharges;
  const totalProfit = Object.values(symbolProfitLoss).reduce((sum, item) => {
    const symbolDiff = item.matchedSellValue - item.matchedBuyValue;
    return symbolDiff > 0 ? sum + symbolDiff : sum;
  }, 0);
  const totalLoss = Object.values(symbolProfitLoss).reduce((sum, item) => {
    const symbolDiff = item.matchedSellValue - item.matchedBuyValue;
    return symbolDiff < 0 ? sum + Math.abs(symbolDiff) : sum;
  }, 0);

  const symbolProfitLossRows = Object.values(symbolProfitLoss)
    .map((item) => {
      const difference = item.matchedSellValue - item.matchedBuyValue;
      const charges = item.matchedBuyCharges + item.matchedSellCharges;

      return {
        symbol: item.symbol,
        difference,
        charges,
      };
    })
    .sort((a, b) => b.difference - a.difference);

  const { totalBought, totalSold, totalCharges, tradeCashFlow } =
    stockCashSummary;
  const holdings = Object.fromEntries(
    Object.entries(stockPositions).map(([symbol, item]) => [
      symbol,
      item.lots.reduce((sum, lot) => sum + lot.qty, 0),
    ])
  );

  // Build open positions using FIFO buy lots so graph shows only unsold buy expense.
  const investedByStock = Object.values(stockPositions)
    .map((item) => {
      const quantity = item.lots.reduce((sum, lot) => sum + lot.qty, 0);
      const invested = item.lots.reduce(
        (sum, lot) => sum + lot.grossValue + lot.charges,
        0
      );
      const openLots = item.lots.filter((lot) => lot.qty > 0);
      const oldestBuyDate =
        openLots.length > 0
          ? openLots.reduce(
              (earliest, lot) =>
                !earliest || (lot.dateKey && lot.dateKey < earliest)
                  ? lot.dateKey
                  : earliest,
              null
            )
          : null;
      return { symbol: item.symbol, quantity, invested, oldestBuyDate };
    })
    .filter((item) => item.quantity > 0 && item.invested > 0)
    .sort((a, b) => b.invested - a.invested);

  const palette = [
    '#0ea5e9',
    '#14b8a6',
    '#22c55e',
    '#f59e0b',
    '#f97316',
    '#ef4444',
    '#8b5cf6',
  ];
  const liquidCash = cashDeposited + tradeCashFlow;

  const allocationItems = [
    ...investedByStock.map((item, index) => ({
      label: item.symbol,
      value: item.invested,
      color: palette[index % palette.length],
      quantity: item.quantity,
      avgPrice: item.quantity > 0 ? item.invested / item.quantity : 0,
      oldestBuyDate: item.oldestBuyDate,
    })),
    {
      label: 'Remaining Cash',
      value: Math.max(0, toNumber(liquidCash)),
      color: '#334155',
      quantity: null,
      avgPrice: null,
    },
  ].filter((item) => item.value > 0);

  const allocationTotal = allocationItems.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const allocationLegend = allocationItems.map((item) => ({
    ...item,
    percent: allocationTotal ? (item.value / allocationTotal) * 100 : 0,
  }));

  let cursor = 0;
  const gradientParts = allocationLegend.map((item) => {
    const start = cursor;
    const angle = allocationTotal ? (item.value / allocationTotal) * 360 : 0;
    cursor += angle;
    return `${item.color} ${start}deg ${cursor}deg`;
  });

  const allocationGradient = gradientParts.length
    ? `conic-gradient(${gradientParts.join(', ')})`
    : 'conic-gradient(#cbd5e1 0deg 360deg)';

  const openOrderInvestedValue = investedByStock.reduce(
    (sum, item) => sum + item.invested,
    0
  );
  const netTotalAmount = cashDeposited + pnlAfterDpCharges;
  const projectedAmount = netTotalAmount - openOrderInvestedValue;

  const finalAmount = cashDeposited + pnlAfterDpCharges;

  return {
    remainingCash: finalAmount,
    netFundsOnly: cashDeposited,
    closedTradeDiff,
    closedTradeDiffWithoutCharges,
    closedTradeCharges,
    totalDpCharges,
    netTotalAmount,
    openOrderInvestedValue,
    projectedAmount,
    liquidCash,
    totalFundAdded,
    totalFundWithdrawn,
    totalProfit,
    totalLoss,
    totalBought,
    totalSold,
    totalCharges,
    pnl: pnlAfterDpCharges,
    pnlBeforeDpCharges: closedTradeDiff,
    holdings,
    investedByStock,
    symbolProfitLossRows,
    allocationLegend,
    allocationGradient,
    allocationTotal,
  };
}
