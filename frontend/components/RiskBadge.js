export default function RiskBadge({ level, score }) {
  const cls = level === "high" ? "badge-high" : level === "medium" ? "badge-medium" : "badge-low";
  return (
    <span className={`badge ${cls}`}>
      {score != null ? <span className="mono">{score}</span> : null}
      {level}
    </span>
  );
}
