# StockValley

StockValley is a small React application (built with Vite) for viewing and valuing stocks. It demonstrates a lightweight SPA with local demo data and simple styling.

## Features

- View sample stock data from `public/data.yaml`.
- Simple portfolio/value visualization and details view.
- Fast development experience with Vite + React and hot module replacement.

## Tech stack

- React
- Vite
- Plain CSS (styles.css)
- ESLint (project template rules)

## Quickstart

Prerequisites: Node.js 18+ and npm (or pnpm/yarn).

Install dependencies:

```
npm install
```

Start development server:

```
npm run dev
```

Build for production:

```
npm run build
```

Preview production build locally:

```
npm run preview
```

## Data

This repo includes a demo dataset at `public/data.yaml`. The app reads this file at runtime (served statically by Vite) to populate sample stocks and portfolio values.

## Project structure (key files)

- `index.html` — app shell
- `src/main.jsx` — app entry
- `src/App.jsx` — main app component
- `src/styles.css` — global styles
- `public/data.yaml` — demo data

## Development notes

- The app is intentionally minimal. Add APIs or environment variables (prefix `VITE_`) if you integrate external services.
- ESLint is configured via the template; update rules in `eslint.config.js` as needed.

## Contributing

Contributions are welcome. Create issues or PRs with feature requests or fixes.

## License

This project is provided as-is. Add a LICENSE file if you need a specific license.
