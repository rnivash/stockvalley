import { useMemo, useState } from 'react';
import { dump, load } from 'js-yaml';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';

const CASH_KEY = 'stockvalley-cash-entries';
const STOCK_KEY = 'stockvalley-stock-entries';
const SYMBOL_KEY = 'stockvalley-symbol-suggestions';
const DP_CHARGES_KEY = 'stockvalley-dp-charge-entries';

const readStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const toNumber = (value) => Number(value) || 0;

const normalizeCreatedAt = (value) => {
  const n = Number(value);
  // Accept only millisecond timestamps; reject legacy small index-like values.
  return Number.isFinite(n) && n > 1_000_000_000_000 ? n : null;
};

const toDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toAction = (value) => {
  const action = String(value || '').toLowerCase();
  return action === 'sell' ? 'sell' : 'buy';
};

const normalizeStockEntries = (items) =>
  items
    .map((item, index) => {
      if (item?.action && typeof item.price !== 'undefined') {
        return {
          ...item,
          action: toAction(item.action),
          symbol: String(item.symbol || '')
            .trim()
            .toUpperCase(),
          quantity: toNumber(item.quantity),
          price: toNumber(item.price),
          charges: toNumber(item.charges),
          dpCharges: toNumber(item.dpCharges),
          createdAt: normalizeCreatedAt(item.createdAt),
        };
      }
      if (typeof item?.buyPrice !== 'undefined') {
        return {
          ...item,
          action: 'buy',
          symbol: String(item.symbol || '')
            .trim()
            .toUpperCase(),
          quantity: toNumber(item.quantity),
          price: toNumber(item.buyPrice),
          charges: toNumber(item.charges),
          dpCharges: toNumber(item.dpCharges),
          createdAt: normalizeCreatedAt(item.createdAt),
        };
      }
      return null;
    })
    .filter(Boolean);

const normalizeSymbols = (items) =>
  [
    ...new Set(
      (items || [])
        .map((item) =>
          String(item || '')
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    ),
  ].sort();

const currency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value) => {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'No date'
    : date.toLocaleDateString('en-IN');
};

export default function App() {
  const [cashEntries, setCashEntries] = useState(() => readStorage(CASH_KEY));
  const [stockEntries, setStockEntries] = useState(() =>
    normalizeStockEntries(readStorage(STOCK_KEY))
  );
  const [dpChargeEntries, setDpChargeEntries] = useState(() =>
    readStorage(DP_CHARGES_KEY)
  );
  const [symbolSuggestions, setSymbolSuggestions] = useState(() => {
    const saved = normalizeSymbols(readStorage(SYMBOL_KEY));
    if (saved.length) return saved;
    return normalizeSymbols(
      normalizeStockEntries(readStorage(STOCK_KEY)).map((item) => item.symbol)
    );
  });

  const [cashForm, setCashForm] = useState({
    type: 'deposit',
    amount: '',
    note: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const [dpChargeForm, setDpChargeForm] = useState({
    amount: '',
    note: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const [stockForm, setStockForm] = useState({
    action: 'buy',
    symbol: '',
    quantity: '',
    price: '',
    charges: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const [editingStockId, setEditingStockId] = useState('');
  const [editStockForm, setEditStockForm] = useState({
    action: 'buy',
    symbol: '',
    quantity: '',
    price: '',
    charges: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [stockFilter, setStockFilter] = useState('ALL');
  const [yamlText, setYamlText] = useState('');
  const [yamlStatus, setYamlStatus] = useState('');

  const activeSymbolInput = editingStockId
    ? editStockForm.symbol
    : stockForm.symbol;
  const symbolQuery = activeSymbolInput.trim().toUpperCase();
  const filteredSymbolSuggestions =
    symbolQuery.length >= 1
      ? symbolSuggestions.filter((symbol) => symbol.startsWith(symbolQuery))
      : [];

  const stockFilterOptions = [
    ...new Set(stockEntries.map((item) => item.symbol)),
  ].sort();
  const filteredStockEntries =
    stockFilter === 'ALL'
      ? stockEntries
      : stockEntries.filter((item) => item.symbol === stockFilter);
  const sortedCashEntries = useMemo(
    () =>
      [...cashEntries].sort((a, b) => {
        const aDate = toDate(a.date)?.getTime() || 0;
        const bDate = toDate(b.date)?.getTime() || 0;
        return bDate - aDate;
      }),
    [cashEntries]
  );

  const totals = useMemo(() => {
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fyStart = new Date(today.getFullYear(), 3, 1);
    if (today < fyStart) fyStart.setFullYear(fyStart.getFullYear() - 1);

    const dayCount = Math.floor((today - fyStart) / (1000 * 60 * 60 * 24)) + 1;
    const dayList = Array.from({ length: dayCount }, (_, idx) => {
      const date = new Date(fyStart);
      date.setDate(fyStart.getDate() + idx);
      return date;
    });

    const movementByDay = cashEntries.reduce((map, item) => {
      const date = toDate(item.date);
      if (!date) return map;
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().slice(0, 10);
      const amount =
        toNumber(item.amount) * (item.type === 'withdraw' ? -1 : 1);
      map[key] = (map[key] || 0) + amount;
      return map;
    }, {});

    const movementWithDpCharges = dpChargeEntries.reduce((map, item) => {
      const date = toDate(item.date);
      if (!date) return map;
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().slice(0, 10);
      const amount = Math.abs(toNumber(item.amount));
      map[key] = (map[key] || 0) - amount;
      return map;
    }, movementByDay);

    const movementWithStocks = stockEntries.reduce((map, item) => {
      const date = toDate(item.date);
      if (!date) return map;
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().slice(0, 10);
      const tradeValue = toNumber(item.quantity) * toNumber(item.price);
      const charges = toNumber(item.charges);
      const cashEffect =
        toAction(item.action) === 'buy'
          ? -(tradeValue + charges)
          : tradeValue - charges;
      map[key] = (map[key] || 0) + cashEffect;
      return map;
    }, movementWithDpCharges);

    const monthlyMovement = dayList.map((date, idx) => {
      const key = date.toISOString().slice(0, 10);
      return {
        key,
        amount: movementWithStocks[key] || 0,
        label: date.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        }),
        showLabel:
          idx % Math.max(1, Math.ceil(dayList.length / 8)) === 0 ||
          idx === dayList.length - 1,
      };
    });

    const movementMax = Math.max(
      1,
      ...monthlyMovement.map((item) => Math.abs(item.amount))
    );

    const monthInflow = monthlyMovement
      .filter((item) => item.amount > 0)
      .reduce((sum, item) => sum + item.amount, 0);

    const monthOutflow = monthlyMovement
      .filter((item) => item.amount < 0)
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);

    let runningTotal = 0;
    const movementSeries = monthlyMovement.map((item) => {
      runningTotal += item.amount;
      return {
        ...item,
        totalAmount: runningTotal,
      };
    });

    const movementMin = Math.min(
      0,
      ...movementSeries.map((item) => item.totalAmount)
    );
    const movementMaxTotal = Math.max(
      0,
      ...movementSeries.map((item) => item.totalAmount)
    );
    const movementRange = Math.max(1, movementMaxTotal - movementMin);

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

    // Realized P/L on closed quantity including proportional buy/sell charges.
    const realizedSummary = orderedStocks.reduce(
      (acc, item) => {
        const symbol = item.symbol;
        const qty = toNumber(item.quantity);
        const price = toNumber(item.price);
        const charges = toNumber(item.charges);
        const action = toAction(item.action);

        if (!acc.lotsBySymbol[symbol]) acc.lotsBySymbol[symbol] = [];
        const lots = acc.lotsBySymbol[symbol];

        if (action === 'buy') {
          const buyChargePerUnit = qty > 0 ? charges / qty : 0;
          lots.push({ qty, unitPrice: price, chargePerUnit: buyChargePerUnit });
          return acc;
        }

        let remainingSellQty = qty;
        while (remainingSellQty > 0 && lots.length > 0) {
          const lot = lots[0];
          const matchedQty = Math.min(remainingSellQty, lot.qty);
          const proportionalSellCharges =
            qty > 0 ? (charges * matchedQty) / qty : 0;
          const proportionalBuyCharges =
            matchedQty * toNumber(lot.chargePerUnit);

          acc.matchedSellGrossValue += matchedQty * price;
          acc.matchedBuyGrossValue += matchedQty * lot.unitPrice;
          acc.matchedSellCharges += proportionalSellCharges;
          acc.matchedBuyCharges += proportionalBuyCharges;
          acc.matchedSellValue += matchedQty * price - proportionalSellCharges;
          acc.matchedBuyValue +=
            matchedQty * lot.unitPrice + proportionalBuyCharges;

          lot.qty -= matchedQty;
          remainingSellQty -= matchedQty;
          if (lot.qty <= 0) lots.shift();
        }

        return acc;
      },
      {
        lotsBySymbol: {},
        matchedSellValue: 0,
        matchedBuyValue: 0,
        matchedSellGrossValue: 0,
        matchedBuyGrossValue: 0,
        matchedSellCharges: 0,
        matchedBuyCharges: 0,
      }
    );

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
    const symbolProfitLoss = Object.entries(realizedSummary.lotsBySymbol)
      .map(([symbol, lots]) => ({ symbol, lots }))
      .reduce((acc, item) => {
        acc[item.symbol] = {
          symbol: item.symbol,
          quantity: 0,
          matchedBuyValue: 0,
          matchedSellValue: 0,
          matchedBuyCharges: 0,
          matchedSellCharges: 0,
        };
        return acc;
      }, {});

    orderedStocks.forEach((item) => {
      const symbol = item.symbol;
      const qty = toNumber(item.quantity);
      const price = toNumber(item.price);
      const charges = toNumber(item.charges);
      const action = toAction(item.action);

      if (!symbolProfitLoss[symbol]) {
        symbolProfitLoss[symbol] = {
          symbol,
          quantity: 0,
          matchedBuyValue: 0,
          matchedSellValue: 0,
          matchedBuyCharges: 0,
          matchedSellCharges: 0,
        };
      }

      if (!symbolProfitLoss[symbol].lots) symbolProfitLoss[symbol].lots = [];
      const lots = symbolProfitLoss[symbol].lots;

      if (action === 'buy') {
        const buyUnitPriceWithCharges =
          qty > 0 ? (qty * price + charges) / qty : price;
        const buyChargePerUnit = qty > 0 ? charges / qty : 0;
        lots.push({
          qty,
          unitPrice: buyUnitPriceWithCharges,
          chargePerUnit: buyChargePerUnit,
        });
        return;
      }

      let remainingSellQty = qty;
      while (remainingSellQty > 0 && lots.length > 0) {
        const lot = lots[0];
        const matchedQty = Math.min(remainingSellQty, lot.qty);
        const proportionalSellCharges =
          qty > 0 ? (charges * matchedQty) / qty : 0;
        const proportionalBuyCharges = matchedQty * toNumber(lot.chargePerUnit);

        symbolProfitLoss[symbol].quantity += matchedQty;
        symbolProfitLoss[symbol].matchedSellValue +=
          matchedQty * price - proportionalSellCharges;
        symbolProfitLoss[symbol].matchedBuyValue += matchedQty * lot.unitPrice;
        symbolProfitLoss[symbol].matchedBuyCharges += proportionalBuyCharges;
        symbolProfitLoss[symbol].matchedSellCharges += proportionalSellCharges;

        lot.qty -= matchedQty;
        remainingSellQty -= matchedQty;
        if (lot.qty <= 0) lots.shift();
      }
    });

    const symbolProfitLossRows = Object.values(symbolProfitLoss)
      .map((item) => {
        const quantity = item.quantity;
        const avgBuyPrice = quantity > 0 ? item.matchedBuyValue / quantity : 0;
        const avgSellPrice =
          quantity > 0 ? item.matchedSellValue / quantity : 0;
        const difference = item.matchedSellValue - item.matchedBuyValue;
        const charges = item.matchedBuyCharges + item.matchedSellCharges;

        return {
          symbol: item.symbol,
          quantity,
          avgBuyPrice,
          avgSellPrice,
          difference,
          charges,
        };
      })
      .filter((item) => item.quantity > 0)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    const tradeSummary = orderedStocks.reduce(
      (acc, item) => {
        const symbol = item.symbol;
        const qty = toNumber(item.quantity);
        const price = toNumber(item.price);
        const charges = toNumber(item.charges);
        const action = toAction(item.action);

        if (action === 'buy') {
          const value = qty * price;
          acc.totalBought += value;
          acc.totalCharges += charges;
          acc.tradeCashFlow -= value + charges;
          acc.holdings[symbol] = (acc.holdings[symbol] || 0) + qty;
          return acc;
        }

        const available = toNumber(acc.holdings[symbol]);
        const executableQty = Math.min(qty, available);
        if (executableQty <= 0) return acc;

        const ratio = qty > 0 ? executableQty / qty : 0;
        const value = executableQty * price;
        const proportionalCharges = charges * ratio;

        acc.totalSold += value;
        acc.totalCharges += proportionalCharges;
        acc.tradeCashFlow += value - proportionalCharges;
        acc.holdings[symbol] = available - executableQty;
        return acc;
      },
      {
        totalBought: 0,
        totalSold: 0,
        totalCharges: 0,
        tradeCashFlow: 0,
        holdings: {},
      }
    );

    const { totalBought, totalSold, totalCharges, tradeCashFlow, holdings } =
      tradeSummary;

    // Build open positions using FIFO buy lots so graph shows only unsold buy expense.
    const stockPositions = orderedStocks.reduce((map, item) => {
      const symbol = item.symbol;
      const qty = toNumber(item.quantity);
      const price = toNumber(item.price);
      const charges = toNumber(item.charges);
      const action = toAction(item.action);

      if (!map[symbol]) map[symbol] = { symbol, lots: [] };
      const current = map[symbol];

      if (action === 'buy') {
        const lotCost = qty * price + charges;
        current.lots.push({ qty, cost: lotCost });
        return map;
      }

      let remainingSellQty = qty;
      while (remainingSellQty > 0 && current.lots.length > 0) {
        const firstLot = current.lots[0];
        if (remainingSellQty >= firstLot.qty) {
          remainingSellQty -= firstLot.qty;
          current.lots.shift();
        } else {
          const ratioLeft = (firstLot.qty - remainingSellQty) / firstLot.qty;
          firstLot.cost *= ratioLeft;
          firstLot.qty -= remainingSellQty;
          remainingSellQty = 0;
        }
      }

      return map;
    }, {});

    const investedByStock = Object.values(stockPositions)
      .map((item) => {
        const quantity = item.lots.reduce((sum, lot) => sum + lot.qty, 0);
        const invested = item.lots.reduce((sum, lot) => sum + lot.cost, 0);
        return { symbol: item.symbol, quantity, invested };
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
      })),
      {
        label: 'Remaining Cash',
        value: Math.max(0, toNumber(liquidCash)),
        color: '#334155',
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
      totalBought,
      totalSold,
      totalCharges,
      pnl: pnlAfterDpCharges,
      pnlBeforeDpCharges: closedTradeDiff,
      holdings,
      monthlyMovement,
      movementMax,
      movementSeries,
      movementMin,
      movementMaxTotal,
      movementRange,
      monthInflow,
      monthOutflow,
      investedByStock,
      openStocks: investedByStock,
      symbolProfitLossRows,
      allocationLegend,
      allocationGradient,
      allocationTotal,
      movementFromLabel: fyStart.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      }),
    };
  }, [cashEntries, stockEntries, dpChargeEntries]);

  const addCashEntry = (event) => {
    event.preventDefault();
    const amount = toNumber(cashForm.amount);
    if (amount <= 0) return;

    const next = [
      {
        id: crypto.randomUUID(),
        type: cashForm.type,
        amount,
        note: cashForm.note.trim(),
        date: cashForm.date || new Date().toISOString().slice(0, 10),
      },
      ...cashEntries,
    ];

    setCashEntries(next);
    saveStorage(CASH_KEY, next);
    setCashForm({
      type: 'deposit',
      amount: '',
      note: '',
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const deleteCashEntry = (id) => {
    const next = cashEntries.filter((item) => item.id !== id);
    setCashEntries(next);
    saveStorage(CASH_KEY, next);
  };

  const addDpChargeEntry = (event) => {
    event.preventDefault();
    const amount = Math.abs(toNumber(dpChargeForm.amount));
    if (amount <= 0) return;

    const next = [
      {
        id: crypto.randomUUID(),
        amount,
        note: dpChargeForm.note.trim(),
        date: dpChargeForm.date || new Date().toISOString().slice(0, 10),
      },
      ...dpChargeEntries,
    ];

    setDpChargeEntries(next);
    saveStorage(DP_CHARGES_KEY, next);
    setDpChargeForm({
      amount: '',
      note: '',
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const deleteDpChargeEntry = (id) => {
    const next = dpChargeEntries.filter((item) => item.id !== id);
    setDpChargeEntries(next);
    saveStorage(DP_CHARGES_KEY, next);
  };

  const rememberSymbol = (symbolValue) => {
    const symbol = String(symbolValue || '')
      .trim()
      .toUpperCase();
    if (!symbol) return;
    setSymbolSuggestions((prev) => {
      const next = normalizeSymbols([...prev, symbol]);
      saveStorage(SYMBOL_KEY, next);
      return next;
    });
  };

  const addStockEntry = (event) => {
    event.preventDefault();
    const quantity = toNumber(stockForm.quantity);
    const price = toNumber(stockForm.price);
    const charges = toNumber(stockForm.charges);
    const symbol = stockForm.symbol.trim().toUpperCase();
    if (!symbol || quantity <= 0 || price <= 0 || charges < 0) return;

    const availableQty = toNumber(totals.holdings[symbol]);
    if (stockForm.action === 'sell' && quantity > availableQty) {
      window.alert(`Not enough quantity to sell. Available: ${availableQty}`);
      return;
    }

    const next = [
      {
        id: crypto.randomUUID(),
        action: toAction(stockForm.action),
        symbol,
        quantity,
        price,
        charges,
        date: stockForm.date || new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
      },
      ...stockEntries,
    ];

    setStockEntries(next);
    saveStorage(STOCK_KEY, next);
    rememberSymbol(symbol);
    setStockForm({
      action: 'buy',
      symbol: '',
      quantity: '',
      price: '',
      charges: '',
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const deleteStockEntry = (id) => {
    const next = stockEntries.filter((item) => item.id !== id);
    setStockEntries(next);
    saveStorage(STOCK_KEY, next);
  };

  const startStockEdit = (item) => {
    setEditingStockId(item.id);
    setEditStockForm({
      action: toAction(item.action),
      symbol: item.symbol,
      quantity: String(item.quantity),
      price: String(item.price),
      charges: String(toNumber(item.charges)),
      date: item.date || new Date().toISOString().slice(0, 10),
    });
  };

  const cancelStockEdit = () => {
    setEditingStockId('');
    setEditStockForm({
      action: 'buy',
      symbol: '',
      quantity: '',
      price: '',
      charges: '',
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const saveStockEdit = (id) => {
    const action = toAction(editStockForm.action);
    const symbol = editStockForm.symbol.trim().toUpperCase();
    const quantity = toNumber(editStockForm.quantity);
    const price = toNumber(editStockForm.price);
    const charges = toNumber(editStockForm.charges);

    if (!symbol || quantity <= 0 || price <= 0 || charges < 0) return;

    const holdingsWithoutCurrent = stockEntries.reduce((map, item) => {
      if (item.id === id) return map;
      const key = item.symbol;
      const qty = toNumber(item.quantity);
      const itemAction = toAction(item.action);
      map[key] = (map[key] || 0) + (itemAction === 'buy' ? qty : -qty);
      return map;
    }, {});

    const availableQty = toNumber(holdingsWithoutCurrent[symbol]);
    if (action === 'sell' && quantity > availableQty) {
      window.alert(`Not enough quantity to sell. Available: ${availableQty}`);
      return;
    }

    const next = stockEntries.map((item) =>
      item.id === id
        ? {
            ...item,
            action,
            symbol,
            quantity,
            price,
            charges,
            date: editStockForm.date || new Date().toISOString().slice(0, 10),
          }
        : item
    );

    setStockEntries(next);
    saveStorage(STOCK_KEY, next);
    rememberSymbol(symbol);
    cancelStockEdit();
  };

  const exportAllDataAsYaml = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      cashEntries,
      stockEntries,
      dpChargeEntries,
      symbolSuggestions,
    };

    const yaml = dump(payload, {
      noRefs: true,
      lineWidth: 120,
      sortKeys: false,
    });

    setYamlText(yaml);
    setYamlStatus('YAML export generated. You can copy and save it anywhere.');
  };

  const importAllDataFromYaml = () => {
    try {
      const parsed = load(yamlText);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('YAML must contain an object with app data.');
      }

      const nextCashEntries = Array.isArray(parsed.cashEntries)
        ? parsed.cashEntries
        : [];
      const nextStockEntries = normalizeStockEntries(
        Array.isArray(parsed.stockEntries) ? parsed.stockEntries : []
      );
      const nextDpChargeEntries = Array.isArray(parsed.dpChargeEntries)
        ? parsed.dpChargeEntries.map((item) => ({
            id: item?.id ? String(item.id) : crypto.randomUUID(),
            amount: Math.abs(toNumber(item?.amount)),
            note: String(item?.note || ''),
            date: item?.date || new Date().toISOString().slice(0, 10),
          }))
        : [];
      const nextSymbolSuggestions = Array.isArray(parsed.symbolSuggestions)
        ? normalizeSymbols(parsed.symbolSuggestions)
        : normalizeSymbols(nextStockEntries.map((item) => item.symbol));

      setCashEntries(nextCashEntries);
      setStockEntries(nextStockEntries);
      setDpChargeEntries(nextDpChargeEntries);
      setSymbolSuggestions(nextSymbolSuggestions);
      setEditingStockId('');

      saveStorage(CASH_KEY, nextCashEntries);
      saveStorage(STOCK_KEY, nextStockEntries);
      saveStorage(DP_CHARGES_KEY, nextDpChargeEntries);
      saveStorage(SYMBOL_KEY, nextSymbolSuggestions);

      setYamlStatus('YAML data imported successfully.');
    } catch (error) {
      setYamlStatus(
        `Import failed: ${
          error instanceof Error ? error.message : 'Invalid YAML data.'
        }`
      );
    }
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <h1>Stock Valley</h1>
        <p>
          Track deposits, withdrawals, and each stock position in one place.
        </p>
      </header>

      <section className="nav-wrap">
        <p className="nav-title">Navigate</p>
        <nav className="app-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-label">Dashboard</span>
            <small className="nav-hint">Total amount and P/L</small>
          </NavLink>
          <NavLink
            to="/money"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-label">Money Movement</span>
            <small className="nav-hint">Add and view entries</small>
          </NavLink>
          <NavLink
            to="/stocks"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-label">Stock Entries</span>
            <small className="nav-hint">Add and view trades</small>
          </NavLink>
          <NavLink
            to="/dp-charges"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-label">DP Charges</span>
            <small className="nav-hint">Add delivery charges</small>
          </NavLink>
          <NavLink
            to="/open-stocks"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-label">Open Stocks</span>
            <small className="nav-hint">Bought not fully sold</small>
          </NavLink>
          <NavLink
            to="/symbol-pnl"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-label">Symbol P/L</span>
            <small className="nav-hint">Closed qty averages</small>
          </NavLink>
          <NavLink
            to="/data-yaml"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-label">Data YAML</span>
            <small className="nav-hint">Import or export all data</small>
          </NavLink>
        </nav>
      </section>

      <Routes>
        <Route
          path="/"
          element={
            <>
              <section className="summary-grid">
                <Card
                  label="Money I Invested"
                  value={currency(totals.netFundsOnly)}
                />
                <article className={`card ${totals.pnl >= 0 ? 'good' : 'bad'}`}>
                  <small>Profit / Loss</small>
                  <p className="card-subline">
                    {currency(totals.closedTradeDiffWithoutCharges)} - (
                    {currency(totals.closedTradeCharges)} +{' '}
                    {currency(totals.totalDpCharges)}){' '}
                  </p>
                  <h3>{currency(totals.pnl)}</h3>
                </article>
                <Card
                  label="Total worth"
                  value={currency(totals.netFundsOnly + totals.pnl)}
                  tone={totals.netFundsOnly + totals.pnl >= 0 ? 'good' : 'bad'}
                />
                <Card
                  label="Balance Amount for Trade"
                  value={currency(totals.projectedAmount)}
                  tone={totals.projectedAmount >= 0 ? 'good' : 'bad'}
                />
              </section>

              <section className="panel">
                <h2>Money Movement (Apr 1 to Date)</h2>
                <p className="chart-summary">
                  Range {totals.movementFromLabel} to{' '}
                  {new Date().toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  })}{' '}
                  | Inflow {currency(totals.monthInflow)} | Outflow{' '}
                  {currency(totals.monthOutflow)}
                </p>
                <div
                  className="movement-chart"
                  role="img"
                  aria-label="Money movement line chart from Apr 1 to today"
                >
                  {(() => {
                    const width = 320;
                    const height = 220;
                    const padX = 10;
                    const padY = 10;
                    const usableWidth = width - padX * 2;
                    const usableHeight = height - padY * 2;
                    const step =
                      totals.movementSeries.length > 1
                        ? usableWidth / (totals.movementSeries.length - 1)
                        : usableWidth;

                    const points = totals.movementSeries
                      .map((item, index) => {
                        const x = padX + index * step;
                        const y =
                          padY +
                          ((totals.movementMaxTotal - item.totalAmount) /
                            totals.movementRange) *
                            usableHeight;
                        return `${x},${y}`;
                      })
                      .join(' ');

                    const yTicks = Array.from({ length: 5 }, (_, idx) => {
                      const value =
                        totals.movementMaxTotal -
                        (idx * (totals.movementMaxTotal - totals.movementMin)) /
                          4;
                      const y = padY + (idx * usableHeight) / 4;
                      return {
                        key: `y-${idx}`,
                        label: currency(value),
                        y,
                      };
                    });

                    const xLabelStep = Math.max(
                      1,
                      Math.ceil(totals.movementSeries.length / 8)
                    );

                    return (
                      <div className="movement-chart-layout">
                        <div className="movement-y-axis">
                          {yTicks.map((tick) => (
                            <small
                              key={tick.key}
                              className="movement-y-tick"
                              style={{ top: `${(tick.y / height) * 100}%` }}
                            >
                              {tick.label}
                            </small>
                          ))}
                        </div>
                        <div>
                          <svg
                            viewBox={`0 0 ${width} ${height}`}
                            className="movement-svg"
                            preserveAspectRatio="none"
                          >
                            {yTicks.map((tick) => (
                              <line
                                key={`grid-${tick.key}`}
                                x1={8}
                                y1={tick.y}
                                x2={width - 8}
                                y2={tick.y}
                                className="movement-gridline"
                              />
                            ))}
                            <line
                              x1={padX}
                              y1={height - padY}
                              x2={width - padX}
                              y2={height - padY}
                              className="movement-baseline"
                            />
                            <polyline
                              points={points}
                              className="movement-line"
                            />
                            {totals.movementSeries.map((item, index) => {
                              const x = padX + index * step;
                              const y =
                                padY +
                                ((totals.movementMaxTotal - item.totalAmount) /
                                  totals.movementRange) *
                                  usableHeight;
                              return (
                                <circle
                                  key={item.key}
                                  cx={x}
                                  cy={y}
                                  r={
                                    index % xLabelStep === 0 ||
                                    index === totals.movementSeries.length - 1
                                      ? 2.2
                                      : 1.4
                                  }
                                  className="movement-point up"
                                >
                                  <title>{`${item.label}: ${currency(
                                    item.totalAmount
                                  )}`}</title>
                                </circle>
                              );
                            })}
                          </svg>
                          <div
                            className="movement-x-axis"
                            style={{
                              gridTemplateColumns: `repeat(${totals.movementSeries.length}, minmax(0, 1fr))`,
                            }}
                          >
                            {totals.movementSeries.map((item, index) => (
                              <small key={item.key}>
                                {index % xLabelStep === 0 ||
                                index === totals.movementSeries.length - 1
                                  ? item.label
                                  : ''}
                              </small>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </section>

              <section className="panel">
                <h2>Stock Wise Invested Money</h2>
                {totals.allocationLegend.length ? (
                  <div className="allocation-wrap">
                    <div
                      className="allocation-pie"
                      style={{ background: totals.allocationGradient }}
                    />
                    <ul className="allocation-legend">
                      {totals.allocationLegend.map((item) => (
                        <li key={item.label}>
                          <span
                            className="dot"
                            style={{ backgroundColor: item.color }}
                          />
                          <div>
                            <strong>{item.label}</strong>
                            <p>
                              {currency(item.value)} ({item.percent.toFixed(1)}
                              %)
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="empty">No active stock investments yet.</p>
                )}
              </section>
            </>
          }
        />
        <Route
          path="/money"
          element={
            <section className="panel">
              <h2>Money Movement</h2>
              <form className="form-grid" onSubmit={addCashEntry}>
                <select
                  value={cashForm.type}
                  onChange={(e) =>
                    setCashForm((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  <option value="deposit">Deposit</option>
                  <option value="withdraw">Withdraw</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={cashForm.amount}
                  onChange={(e) =>
                    setCashForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={cashForm.note}
                  onChange={(e) =>
                    setCashForm((f) => ({ ...f, note: e.target.value }))
                  }
                />
                <input
                  type="date"
                  value={cashForm.date}
                  onChange={(e) =>
                    setCashForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
                <button type="submit">Add Entry</button>
              </form>

              <List
                emptyText="No money entries yet."
                items={sortedCashEntries}
                renderItem={(item) => (
                  <>
                    <div>
                      <strong>
                        {item.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                      </strong>
                      <p>
                        {item.note || 'No note'} | Date {formatDate(item.date)}
                      </p>
                    </div>
                    <div className="row-end money-row-end">
                      <button
                        className="close-btn"
                        onClick={() => deleteCashEntry(item.id)}
                        aria-label="Delete entry"
                      >
                        X
                      </button>
                      <strong>{currency(item.amount)}</strong>
                    </div>
                  </>
                )}
              />
            </section>
          }
        />
        <Route
          path="/dp-charges"
          element={
            <section className="panel">
              <h2>DP Charges</h2>
              <form className="form-grid" onSubmit={addDpChargeEntry}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="DP Charge Amount"
                  value={dpChargeForm.amount}
                  onChange={(e) =>
                    setDpChargeForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={dpChargeForm.note}
                  onChange={(e) =>
                    setDpChargeForm((f) => ({ ...f, note: e.target.value }))
                  }
                />
                <input
                  type="date"
                  value={dpChargeForm.date}
                  onChange={(e) =>
                    setDpChargeForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
                <button type="submit">Add DP Charge</button>
              </form>

              <List
                emptyText="No DP charges yet."
                items={dpChargeEntries}
                renderItem={(item) => (
                  <>
                    <div>
                      <strong>DP Charge</strong>
                      <p>
                        {item.note || 'No note'} | Date {formatDate(item.date)}
                      </p>
                    </div>
                    <div className="row-end">
                      <strong>{currency(item.amount)}</strong>
                      <button onClick={() => deleteDpChargeEntry(item.id)}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              />
            </section>
          }
        />
        <Route
          path="/stocks"
          element={
            <section className="panel">
              <h2>Stock Entries</h2>
              <form className="form-grid" onSubmit={addStockEntry}>
                <div className="action-checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={stockForm.action === 'buy'}
                      onChange={() =>
                        setStockForm((f) => ({ ...f, action: 'buy' }))
                      }
                    />
                    Buy
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={stockForm.action === 'sell'}
                      onChange={() =>
                        setStockForm((f) => ({ ...f, action: 'sell' }))
                      }
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

              <div className="stock-filter-row">
                <label htmlFor="stock-symbol-filter">Filter by Symbol</label>
                <select
                  id="stock-symbol-filter"
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                >
                  <option value="ALL">All Symbols</option>
                  {stockFilterOptions.map((symbol) => (
                    <option key={symbol} value={symbol}>
                      {symbol}
                    </option>
                  ))}
                </select>
              </div>

              <List
                emptyText={
                  stockFilter === 'ALL'
                    ? 'No stock entries yet.'
                    : `No entries for ${stockFilter}.`
                }
                items={filteredStockEntries}
                onItemClick={(item) => startStockEdit(item)}
                isItemClickable
                renderItem={(item) => {
                  if (editingStockId === item.id) {
                    return (
                      <>
                        <div className="edit-fields">
                          <select
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
                          </select>
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
                              setEditStockForm((f) => ({
                                ...f,
                                price: e.target.value,
                              }))
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
                              setEditStockForm((f) => ({
                                ...f,
                                date: e.target.value,
                              }))
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
                  const tradeValue =
                    toNumber(item.quantity) * toNumber(item.price);
                  const netValue =
                    action === 'buy'
                      ? -(tradeValue + charges)
                      : tradeValue - charges;
                  return (
                    <>
                      <div>
                        <strong>{item.symbol}</strong>
                        <p>
                          {action === 'buy' ? 'Buy' : 'Sell'} | Qty{' '}
                          {item.quantity} | Price {currency(item.price)} |
                          Charges {currency(charges)} | Date{' '}
                          {formatDate(item.date)}
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
                        <strong>{currency(netValue)}</strong>
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
          }
        />
        <Route
          path="/open-stocks"
          element={
            <section className="panel">
              <h2>Open Stocks</h2>
              {totals.openStocks.length ? (
                <ul className="list">
                  {totals.openStocks.map((item) => {
                    const avgCost = item.quantity
                      ? item.invested / item.quantity
                      : 0;
                    return (
                      <li key={item.symbol} className="list-row">
                        <div>
                          <strong>{item.symbol}</strong>
                          <p>
                            Open Qty {item.quantity} | Avg Cost{' '}
                            {currency(avgCost)}
                          </p>
                        </div>
                        <div className="row-end">
                          <strong>{currency(item.invested)}</strong>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="empty">No open stocks.</p>
              )}
            </section>
          }
        />

        <Route
          path="/symbol-pnl"
          element={
            <section className="panel">
              <h2>Profit / Loss By Symbol</h2>
              {totals.symbolProfitLossRows.length ? (
                <div className="symbol-pnl-grid">
                  {totals.symbolProfitLossRows.map((item) => (
                    <article key={item.symbol} className="symbol-pnl-card">
                      <div className="symbol-pnl-head">
                        <strong>{item.symbol}</strong>
                        <strong
                          className={
                            item.difference >= 0 ? 'cell-good' : 'cell-bad'
                          }
                        >
                          {currency(item.difference)}
                        </strong>
                      </div>
                      <div className="symbol-pnl-meta">
                        <p>
                          <span>Avg. Sell price</span>
                          <strong>{currency(item.avgSellPrice)}</strong>
                        </p>
                        <p>
                          <span>Avg Buy price</span>
                          <strong>{currency(item.avgBuyPrice)}</strong>
                        </p>
                        <p>
                          <span>Quantity</span>
                          <strong>{item.quantity}</strong>
                        </p>
                        <p>
                          <span>Charges</span>
                          <strong>{currency(item.charges)}</strong>
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
          }
        />
        <Route
          path="/data-yaml"
          element={
            <section className="panel">
              <h2>Data Import / Export (YAML)</h2>
              <p className="chart-summary">
                Export all saved entries as YAML or paste YAML here to restore
                data.
              </p>
              <div className="yaml-actions">
                <button type="button" onClick={exportAllDataAsYaml}>
                  Export As YAML
                </button>
                <button type="button" onClick={importAllDataFromYaml}>
                  Import From YAML
                </button>
              </div>
              <textarea
                className="yaml-editor"
                placeholder="YAML data will appear here after export. You can also paste YAML and import."
                value={yamlText}
                onChange={(event) => setYamlText(event.target.value)}
              />
              {yamlStatus ? (
                <p className="chart-summary">{yamlStatus}</p>
              ) : null}
            </section>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function Card({ label, value, tone = 'normal' }) {
  return (
    <article className={`card ${tone}`}>
      <small>{label}</small>
      <h3>{value}</h3>
    </article>
  );
}

function List({
  items,
  renderItem,
  emptyText,
  onItemClick,
  isItemClickable = false,
}) {
  if (!items.length) return <p className="empty">{emptyText}</p>;

  return (
    <ul className="list">
      {items.map((item) => (
        <li
          key={item.id}
          className={`list-row${isItemClickable ? ' clickable-row' : ''}`}
          onClick={onItemClick ? () => onItemClick(item) : undefined}
        >
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
