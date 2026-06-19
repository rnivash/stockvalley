# StockValley

StockValley is a React + Vite single-page app for tracking investment cash flows, stock trades, P/L, and lot mapping.

## What it does

- Tracks deposits and withdrawals under Money Movement.
- Records buy/sell stock trades with quantity, price, charges, and date.
- Shows a Dashboard with invested amount, total worth, projected balance, and overall P/L.
- Displays symbol-level P/L summaries and stock allocation.
- Provides a Stock Map page for assigning sell lots to buy lots with matched P/L.
- Lets you record DP charges separately.
- Supports exporting and importing the complete app state as YAML.
- Includes a GitHub import button that loads `public/data.yaml` from the repository.

## Tech stack

- React 18
- Vite
- React Router DOM
- js-yaml
- Plain CSS
- ESLint

## Setup

Prerequisites: Node.js 18+ and npm (or pnpm/yarn).

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Open the app at `http://localhost:5173`.

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## App pages

- `/` — Dashboard
- `/money` — Money Movement
- `/stocks` — Stock Entries
- `/stock-map` — Stock Map lot assignment
- `/dp-charges` — DP Charges
- `/symbol-pnl` — Symbol P/L
- `/data-yaml` — YAML import/export

## Data and persistence

- Data is persisted in browser `localStorage`.
- Use the Data YAML page to export current state, paste YAML to import, or fetch sample YAML from GitHub.
- The repository includes `public/data.yaml` as demo data.

## Project structure

- `index.html` — app shell
- `src/main.jsx` — React entry point
- `src/App.jsx` — main app and page components
- `src/styles.css` — UI styling
- `public/data.yaml` — demo YAML dataset
- `eslint.config.js` — linting configuration

## Notes

- The app is designed as a lightweight demo and stores data locally in the browser.
- Add API integration or environment variables using `VITE_` prefixes if you extend the app.
