import React, { useEffect, useRef, useState } from 'react';
import { request } from './api';

export function DeleteWorkflow({ workflow, onClose, onDeleted }) {
  const dialog = useRef(null);
  const cancel = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); cancel.current.focus(); }, []);
  async function remove() {
    setBusy(true); setError('');
    try {
      await request(`/workflows/${workflow.id}?version=${workflow.version}`, { method:'DELETE' });
      onDeleted(workflow.id);
    } catch (e) { setError(e.message); setBusy(false); }
  }
  return <dialog className="workflow-delete-dialog" ref={dialog} aria-labelledby="delete-workflow-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}>
    <h2 id="delete-workflow-title">Permanently delete this workflow?</h2>
    <p><strong>{workflow.title}</strong></p>
    <p>This removes the SOP, all steps and screenshots, voice narration, vision suggestions, and associated stored files from this app's storage. This cannot be undone.</p>
    <p>PDF, Word, or JSON files you already downloaded remain in your Downloads folder.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="workflow-delete-actions"><button className="secondary" ref={cancel} disabled={busy} onClick={onClose}>Cancel</button><button className="primary delete-permanent" disabled={busy} onClick={remove}>{busy ? 'Deleting...' : 'Delete permanently'}</button></div>
  </dialog>;
}
