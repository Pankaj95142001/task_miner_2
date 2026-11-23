export function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

export function MetricCard({ label, value, note }) {
  const isPrimitive = typeof value === "string" || typeof value === "number";

  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      {isPrimitive ? <strong>{value}</strong> : <div className="metric-card-value">{value}</div>}
      {note ? <span className="metric-note">{note}</span> : null}
    </article>
  );
}

export function SectionCard({ badge, title, note, meta = null, children, className = "" }) {
  return (
    <section className={["compact-card", "fpa-subpanel", className].filter(Boolean).join(" ")}>
      <div className="step-header">
        <div>
          <span className="step-badge">{badge}</span>
          <h4>{title}</h4>
          {note ? <p className="section-note">{note}</p> : null}
        </div>
        {meta}
      </div>
      {children}
    </section>
  );
}
