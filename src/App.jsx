import { useMemo, useState, useEffect } from 'react';
import { dump, load } from 'js-yaml';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppNav } from './components/Navigation';
import {
  CASH_KEY, currency, DP_CHARGES_KEY, formatDate, getDateKey,
  MANUAL_MAPPINGS_KEY, normalizeSymbols, readStorage, saveStorage,
  STOCK_KEY, SYMBOL_KEY, toAction, toDate, toNumber
} from './utils';
import { DashboardPage } from './pages/DashboardPage';
import { DpChargesPage, MoneyPage, StocksPage } from './pages/EntryPages';
import { DailyPLPage, MonthlyPnlPage } from './pages/PerformancePages';
import { SplitViewPage } from './pages/MappingPages';
import { DataYamlPage } from './pages/DataYamlPage';
import { SymbolMapPage } from './pages/SymbolMapPage';
import { SimpleStockPage } from './pages/SimpleStockPage';

export default function App() {
  const location = useLocation();
  const [cashEntries, setCashEntries] = useState(() => readStorage(CASH_KEY));
  const [stockEntries, setStockEntries] = useState(() => readStorage(STOCK_KEY));
  const [dpChargeEntries, setDpChargeEntries] = useState(() => readStorage(DP_CHARGES_KEY));
  const [symbolSuggestions, setSymbolSuggestions] = useState(() => {
    const saved = normalizeSymbols(readStorage(SYMBOL_KEY));
    if (saved.length) return saved;
    return normalizeSymbols(readStorage(STOCK_KEY).map((item) => item.symbol));
  });
  const [sessionDisplayStockEntries, setSessionDisplayStockEntries] = useState([]);

  useEffect(() => {
    if (location.pathname === '/simple-stocks') {
      setSessionDisplayStockEntries([]);
    }
  }, [location.pathname]);

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
  const [manualMappings, setManualMappings] = useState(() => readStorage(MANUAL_MAPPINGS_KEY));

  const sessionStockFilterOptions = [
    ...new Set(sessionDisplayStockEntries.map((item) => item.symbol)),
  ].sort();

  const filteredSessionStockEntries = sessionDisplayStockEntries;

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

  const stockEntriesMap = useMemo(() => {
    return new Map(stockEntries.map(item => [item.id, item]));
  }, [stockEntries]);



  const pnlByDate = useMemo(() => {
    let so1 = {};
    return manualMappings.reduce((acc, x) => {
      const buyItem = stockEntriesMap.get(x.buyId);
      const sellItem = stockEntriesMap.get(x.sellId);

      if (!buyItem || !sellItem) {
        return acc;
      }

      const dateKey = getDateKey(sellItem.date);

      let pnl =
        (sellItem.price * x.qty - buyItem.price * x.qty);

      if (so1[x.sellId] == undefined) {
        pnl = pnl - sellItem.charges;
        so1[x.sellId] = 0;
      }
      if (so1[x.buyId] == undefined) {
        pnl = pnl - buyItem.charges;
        so1[x.buyId] = 0;
      }

      acc[dateKey] = (acc[dateKey] || 0) + pnl;

      return acc;
    }, {});
  }, [manualMappings, stockEntriesMap]);

  const dpchargetotal = useMemo(() => {
    return dpChargeEntries.reduce((result, item) => {
      result = result + item.amount;
      return result;
    }, 0);
  }, [dpChargeEntries]);

  const fundtotal = useMemo(() => {
    return cashEntries.reduce((result, item) => {
      if (item.type == 'withdraw')
        result[1] = result[1] + item.amount;
      else
        result[0] = result[0] + item.amount;
      return result;
    }, [0, 0]);
  }, [cashEntries]);

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
    setSessionDisplayStockEntries((prev) => [
      {
        id: next[0].id,
        action: next[0].action,
        symbol: next[0].symbol,
        quantity: next[0].quantity,
        price: next[0].price,
        charges: next[0].charges,
        date: next[0].date,
        createdAt: next[0].createdAt,
      },
      ...prev,
    ]);
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
    setSessionDisplayStockEntries((prev) => prev.filter((item) => item.id !== id));
    saveStorage(STOCK_KEY, next);
  };

  const addManualMapping = ({ buyId, sellId, qty }) => {
    const buyTx = stockEntries.find((s) => s.id === buyId);
    const sellTx = stockEntries.find((s) => s.id === sellId);
    if (!buyTx || !sellTx || buyTx.symbol !== sellTx.symbol) return;

    const numQty = toNumber(qty);
    if (numQty <= 0 || numQty > buyTx.quantity || numQty > sellTx.quantity)
      return;

    const next = [
      ...manualMappings.filter(
        (m) => !(m.buyId === buyId && m.sellId === sellId)
      ),
      {
        buyId,
        sellId,
        qty: numQty,
        symbol: buyTx.symbol,
        createdAt: Date.now(),
      },
    ];
    setManualMappings(next);
    saveStorage(MANUAL_MAPPINGS_KEY, next);
  };

  const removeManualMapping = (buyId, sellId) => {
    const next = manualMappings.filter(
      (m) => !(m.buyId === buyId && m.sellId === sellId)
    );
    setManualMappings(next);
    saveStorage(MANUAL_MAPPINGS_KEY, next);
  };

  const resetSymbolMappings = (symbol) => {
    const next = manualMappings.filter((m) => m.symbol !== symbol);
    setManualMappings(next);
    saveStorage(MANUAL_MAPPINGS_KEY, next);
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
    setSessionDisplayStockEntries((prev) => {
      const current = prev.find((item) => item.id === id);
      if (!current) {
        return [
          {
            id,
            action,
            symbol,
            quantity,
            price,
            charges,
            date: editStockForm.date || new Date().toISOString().slice(0, 10),
            createdAt: Date.now(),
          },
          ...prev,
        ];
      }

      return prev.map((item) =>
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
    });
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
      manualMappings,
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
      const nextStockEntries = Array.isArray(parsed.stockEntries) ? parsed.stockEntries : [];
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

      const nextManualMappings = Array.isArray(parsed.manualMappings) ? parsed.manualMappings : [];

      setCashEntries(nextCashEntries);
      setStockEntries(nextStockEntries);
      setDpChargeEntries(nextDpChargeEntries);
      setSymbolSuggestions(nextSymbolSuggestions);
      setManualMappings(nextManualMappings)
      setEditingStockId('');

      saveStorage(CASH_KEY, nextCashEntries);
      saveStorage(STOCK_KEY, nextStockEntries);
      saveStorage(DP_CHARGES_KEY, nextDpChargeEntries);
      saveStorage(SYMBOL_KEY, nextSymbolSuggestions);
      saveStorage(MANUAL_MAPPINGS_KEY, nextManualMappings);

      setYamlStatus('YAML data imported successfully.');
    } catch (error) {
      setYamlStatus(
        `Import failed: ${error instanceof Error ? error.message : 'Invalid YAML data.'
        }`
      );
    }
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-top">
          <h1>
            <Link className="hero-title-link" to="/">
              <span className="hero-title-icon" aria-hidden="true">
                <img
                  className="hero-title-icon-img"
                  src="/apple-touch-icon.svg"
                  alt=""
                />
              </span>
              Stock Valley
            </Link>
          </h1>
          <AppNav inHero />
        </div>
        <p>
          Track deposits, withdrawals, and each stock position in one place.
        </p>
      </header>

      <Routes>
        <Route path="/" element={
          <DashboardPage currency={currency} stockEntries={stockEntries} manualMappings={manualMappings}
            pnlByDate={pnlByDate} dpchargetotal={dpchargetotal} fundtotal={fundtotal} />
        }
        />
        <Route path="/money" element={
          <MoneyPage cashForm={cashForm} setCashForm={setCashForm} addCashEntry={addCashEntry} sortedCashEntries={sortedCashEntries}
            deleteCashEntry={deleteCashEntry} currency={currency} formatDate={formatDate} />
        }
        />
        <Route path="/dp-charges" element={
          <DpChargesPage dpChargeForm={dpChargeForm} setDpChargeForm={setDpChargeForm} addDpChargeEntry={addDpChargeEntry}
            dpChargeEntries={dpChargeEntries} deleteDpChargeEntry={deleteDpChargeEntry} currency={currency} formatDate={formatDate} />
        }
        />
        <Route path="/stocks" element={
          <StocksPage stockForm={stockForm} setStockForm={setStockForm} addStockEntry={addStockEntry} stockFilter={stockFilter}
            setStockFilter={setStockFilter} stockFilterOptions={stockFilterOptions} filteredStockEntries={filteredStockEntries}
            startStockEdit={startStockEdit} editingStockId={editingStockId} editStockForm={editStockForm} setEditStockForm={setEditStockForm}
            saveStockEdit={saveStockEdit} cancelStockEdit={cancelStockEdit} toAction={toAction} toNumber={toNumber}
            deleteStockEntry={deleteStockEntry} currency={currency} formatDate={formatDate} filteredSymbolSuggestions={filteredSymbolSuggestions}
          />
        }
        />
        <Route path="/simple-stocks" element={
          <SimpleStockPage stockForm={stockForm} setStockForm={setStockForm} addStockEntry={addStockEntry} stockFilter={stockFilter}
            setStockFilter={setStockFilter} stockFilterOptions={sessionStockFilterOptions} filteredStockEntries={filteredSessionStockEntries}
            startStockEdit={startStockEdit} editingStockId={editingStockId} editStockForm={editStockForm} setEditStockForm={setEditStockForm}
            saveStockEdit={saveStockEdit} cancelStockEdit={cancelStockEdit} toAction={toAction} toNumber={toNumber}
            deleteStockEntry={deleteStockEntry} currency={currency} formatDate={formatDate} filteredSymbolSuggestions={filteredSymbolSuggestions}
          />
        }
        />        
        <Route path="/monthly-pnl" element={
          <MonthlyPnlPage currency={currency} pnlByDate={pnlByDate} />
        }
        />
        <Route path="/daily-pnl" element={
          <DailyPLPage currency={currency} formatDate={formatDate} pnlByDate={pnlByDate} />
        }
        />

        <Route path="/data-yaml" element={
          <DataYamlPage yamlText={yamlText} setYamlText={setYamlText} yamlStatus={yamlStatus}
            exportAllDataAsYaml={exportAllDataAsYaml} importAllDataFromYaml={importAllDataFromYaml} />
        }
        />

        <Route path="/split-view/:findsymbol" element={
          <SplitViewPage symbolSuggestions={symbolSuggestions} stockEntries={stockEntries}
            manualMappings={manualMappings} currency={currency} formatDate={formatDate} />
        }
        />
        <Route path="/symbol-map/:findsymbol" element={
          <SymbolMapPage symbolSuggestions={symbolSuggestions} stockEntries={stockEntries} manualMappings={manualMappings}
            onAddMapping={addManualMapping} onRemoveMapping={removeManualMapping} onResetSymbol={resetSymbolMappings}
            currency={currency} formatDate={formatDate} />
        }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
