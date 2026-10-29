import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export function CustomSelect({ id, value, onChange, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  const options = [];
  if (children) {
    const arr = Array.isArray(children) ? children.flat() : [children];
    arr.forEach((child) => {
      if (!child || !child.props) return;
      options.push({
        value: String(child.props.value ?? ''),
        label: child.props.children,
      });
    });
  }

  const selectedLabel =
    options.find((o) => o.value === String(value))?.label ?? value;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSelect = (val) => {
    onChange({ target: { value: val } });
    setIsOpen(false);
  };

  return (
    <div className={`custom-select${isOpen ? ' open' : ''}`} ref={ref} id={id}>
      <button type="button" className="custom-select-btn" onClick={() => setIsOpen((p) => !p)} 
              aria-haspopup="listbox" aria-expanded={isOpen} >
        <span className="custom-select-value">{selectedLabel}</span>
        <span className="custom-select-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </span>
      </button>
      {isOpen && (
        <ul className="custom-select-list" role="listbox">
          {options.map((opt) => (
            <li key={opt.value} 
              className={`custom-select-item${
                opt.value === String(value) ? ' selected' : ''
              }`}
              role="option"
              aria-selected={opt.value === String(value)}
              onMouseDown={() => handleSelect(opt.value)}>
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function List({items, renderItem, emptyText, onItemClick, isItemClickable = false}) {
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
export function AppNav({ inHero = false }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsExpanded(false);
  }, [location.pathname]);

  return (
    <section className={`nav-wrap${inHero ? ' nav-wrap-inline' : ''}`}>
      <div className="nav-head">
        <button
          type="button"
          className="nav-toggle-btn"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded ? 'Collapse navigation panel' : 'Expand navigation panel'
          }
        >
          <span className="nav-toggle-icon" aria-hidden="true">
            {isExpanded ? (
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M18.3 5.71L12 12.01l-6.3-6.3-1.41 1.41 6.3 6.3-6.3 6.29 1.41 1.42 6.3-6.3 6.29 6.3 1.42-1.42-6.3-6.29 6.3-6.3z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
              </svg>
            )}
          </span>
        </button>
      </div>
      {isExpanded && (
        <nav className="app-nav" onClick={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('a')) {
              setIsExpanded(false);
            }
          }}>
          <NavLink to="/money" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-label">Money Movement</span>
            <small className="nav-hint">Add and view entries</small>
          </NavLink>
          <NavLink  to="/stocks" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-label">Stock Entries</span>
            <small className="nav-hint">Add and view trades</small>
          </NavLink>
          <NavLink to="/dp-charges" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-label">DP Charges</span>
            <small className="nav-hint">Add delivery charges</small>
          </NavLink>
          <NavLink to="/symbol-pnl" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-label">Symbol P/L</span>
            <small className="nav-hint">Closed qty averages</small>
          </NavLink>
          <NavLink to="/monthly-pnl" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-label">Monthly P/L</span>
            <small className="nav-hint">Profit and gain % trend</small>
          </NavLink>
          <NavLink to="/daily-pnl"className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-label">Daily P/L</span>
            <small className="nav-hint">Day-wise profit breakdown</small>
          </NavLink>
          <NavLink to="/buy-sell-mapping" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-label">Buy-Sell Mapping</span>
            <small className="nav-hint">Match buys and sells</small>
          </NavLink>
          <NavLink to="/data-yaml" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-label">Data YAML</span>
            <small className="nav-hint">Import or export all data</small>
          </NavLink>
          <NavLink to="/split-view/ALL" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-label">Split view</span>
            <small className="nav-hint">View all buys</small>
          </NavLink>
        </nav>
      )}
    </section>
  );
}
