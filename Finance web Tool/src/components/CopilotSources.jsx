export default function CopilotSources({ rows }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return (
    <details className="copilot-evidence">
      <summary>Sources <span>{rows.length}</span></summary>
      <div className="copilot-evidence-list">
        {rows.map((row, index) => (
          <article key={`${row.documentId || row.sourceFile}-${index}`} className="copilot-evidence-card">
            <strong>{row.sourceFile || "Source"}</strong>
            <span>{row.sourceLocation || "Reference"}</span>
            {row.evidenceSnippet ? <p>{row.evidenceSnippet}</p> : null}
            {row.reviewStatus ? <small>{row.reviewStatus === "saved" ? "Saved deal value" : "Document evidence · Unreviewed"}</small> : null}
          </article>
        ))}
      </div>
    </details>
  );
}
