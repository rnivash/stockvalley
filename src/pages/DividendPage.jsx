import { Link } from 'react-router-dom';

export function DividendPage() {
  return (
    <section className="panel">
      <h2>Dividends</h2>
      <div className="chart-summary">
        <p>No dividend tracking is configured yet.</p>
        <Link className="nav-link" to="/stocks">
          View stock entries
        </Link>
      </div>
    </section>
  );
}
