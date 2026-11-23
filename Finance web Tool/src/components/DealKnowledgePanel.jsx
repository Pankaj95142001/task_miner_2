import { useEffect, useState } from "react";
import { fetchDealKnowledge, importDealKnowledge, rebuildDealKnowledge, removeDealKnowledge, fetchKnowledgeExtraction } from "../api/deals";

export default function DealKnowledgePanel({ deal, user, enabled, onCountChange }) {
  const [state, setState] = useState({ documents: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [extraction, setExtraction] = useState(null);
  const [original, setOriginal] = useState(null);
  const [replacement, setReplacement] = useState("");
  const owner = deal?.dealOwnerUserId === user?.id;

  useEffect(() => {
    onCountChange?.(state.documents.length);
  }, [state.documents.length, onCountChange]);

  useEffect(() => {
    let cancelled = false;
    if (enabled) fetchDealKnowledge(deal.id, user.id).then((result) => {
      if (!cancelled) setState(result);
    }).catch((failure) => { if (!cancelled) setError(String(failure.message)); });
    return () => { cancelled = true; };
  }, [deal.id, deal.version, user.id, enabled]);

  async function run(action, success, progress = "Updating documents…") {
    setBusy(true);
    setError("");
    setMessage(progress);
    try {
      const result = await action();
      setState(result);
      setMessage(success);
    } catch (failure) {
      setError(String(failure.message || "Document search could not be updated."));
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  async function download(document) {
    setBusy(true);
    setError("");
    try {
      const data = await fetchKnowledgeExtraction(deal.id, document.documentId, user.id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${document.fileName}.extraction.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(String(failure.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="copilot-knowledge" aria-label="Document knowledge" aria-busy={busy}>
      <div className="copilot-knowledge-header"><div><h4>Document knowledge</h4><p>Search document evidence while keeping your saved finance values unchanged.</p></div><button type="button" className="btn btn-secondary" disabled={!enabled || busy} onClick={() => void run(() => fetchDealKnowledge(deal.id, user.id), "Document list refreshed.", "Refreshing documents…")}>Refresh</button></div>
      {state.unindexedPortalDocuments ? <p className="copilot-knowledge-notice">{state.unindexedPortalDocuments} portal document(s) are not searchable yet. Rebuild search or import their extraction JSON.</p> : null}
      <div className={`copilot-knowledge-layout${owner ? "" : " is-reader"}`}>
      {owner ? (
        <form className="copilot-import-form" onSubmit={(event) => {
          event.preventDefault();
          if (extraction && !busy) void run(
            () => importDealKnowledge(deal.id, extraction, original, replacement, user.id),
            "Extraction imported. You can now ask questions about this document.",
            "Importing document… Large files may take a few minutes.",
          );
        }}>
          <h4>Add document evidence</h4>
          <p>Choose a document JSON from the separate extractor.</p>
          <div className="copilot-import-fields">
            <label>Extraction JSON
              <input type="file" accept=".json,application/json" required disabled={!enabled || busy} onChange={(event) => setExtraction(event.target.files?.[0] || null)} />
            </label>
            <label>Original document (optional)
              <input type="file" disabled={!enabled || busy} onChange={(event) => setOriginal(event.target.files?.[0] || null)} />
            </label>
            <label>Document version
              <select value={replacement} disabled={!enabled || busy} onChange={(event) => setReplacement(event.target.value)}>
                <option value="">Add document</option>
                {state.documents.filter((row) => row.origin === "extractor").map((row) => <option key={row.documentId} value={row.documentId}>Replace: {row.fileName}</option>)}
              </select>
            </label>
          </div>
          <p className="copilot-import-help">Attach the matching original if available. Choose Replace when importing a revised document.</p>
          <div className="copilot-import-actions">
            <button type="submit" className="btn btn-primary" disabled={!enabled || busy || !extraction}>{busy ? "Working…" : "Import extraction"}</button>
            <button type="button" className="btn btn-secondary" disabled={!enabled || busy} onClick={() => void run(() => rebuildDealKnowledge(deal.id, user.id), "Document search rebuilt.", "Rebuilding search… Large documents may take a few minutes.")}>Rebuild search</button>
          </div>
        </form>
      ) : null}
      <div className="copilot-document-section">
      <div className="copilot-document-section-head"><h4>Searchable documents</h4><span>{state.documents.length}</span></div>
      <div className="copilot-document-list">
        {!state.documents.length ? <div className="copilot-documents-empty"><strong>No documents added yet</strong><p>{owner ? "Import an extraction to start asking questions about its contents." : "The deal owner can add documents here."}</p></div> : null}
        {state.documents.map((row) => (
          <article key={row.documentId} className="copilot-document-card">
            <div className="copilot-document-card-head"><strong>{row.fileName}</strong><span className="copilot-review-badge">Unreviewed</span></div>
            <p>{row.chunkCount} searchable excerpts · {row.embeddedChunks === row.chunkCount ? "Search ready" : "Keyword search available"}</p>
            {row.status === "partial" ? <p className="copilot-document-warning">Partial extraction. Review important values against the source.</p> : null}
            {row.warning ? <p className="copilot-document-warning">{row.warning}</p> : null}
            <div className="copilot-document-actions"><button type="button" className="btn btn-secondary" disabled={busy || !enabled} onClick={() => void download(row)}>Download JSON</button>
            {owner && row.origin === "extractor" ? <button type="button" className="btn btn-secondary copilot-remove-button" disabled={busy || !enabled} onClick={() => void run(async () => {
              const result = await removeDealKnowledge(deal.id, row.documentId, user.id);
              if (replacement === row.documentId) setReplacement("");
              return result;
            }, "Document removed from chat search.")}>Remove</button> : null}</div>
          </article>
        ))}
      </div>
      </div>
      </div>
      {message ? <div className="copilot-knowledge-status" role="status" aria-live="polite">{message}</div> : null}
      {error ? <p role="alert" className="portal-copilot-error copilot-knowledge-status">{error}</p> : null}
    </section>
  );
}
