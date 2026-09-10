export default function FlavorRanking({ ranking }) {
  const max = Math.max(1, ...ranking.map((r) => r.sold));
  if (ranking.every((r) => r.sold === 0)) {
    return <p className="empty-state">No sales recorded for this period yet.</p>;
  }
  return (
    <div>
      {ranking.map((r) => (
        <div className="ranking-row" key={r.flavor.id}>
          <span className="ranking-name">{r.flavor.name}</span>
          <span className="ranking-bar-track">
            <span
              className="ranking-bar-fill"
              style={{ width: `${(r.sold / max) * 100}%` }}
            />
          </span>
          <span className="ranking-value">{r.sold}</span>
        </div>
      ))}
    </div>
  );
}
