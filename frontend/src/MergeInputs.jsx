import React, { useEffect, useState } from 'react';
import { mutate } from './api';

export const canMergeInput = step => step.source === 'desktop' && step.action === 'input'
  && !step.sensitive && step.text_capture === 'captured' && !step.merge;

export function MergeInputs({ workflow, selected, setSelected, disabled, onBusy, onUpdate, onError }) {
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const chosen = workflow.steps.filter(step => selected.includes(step.id));
  const selectionKey = chosen.map(step => step.id).join(',');
  useEffect(() => { setConfirmed(false); }, [selectionKey, workflow.version]);
  useEffect(() => {
    setSelected(previous => previous.filter(id => workflow.steps.some(step => step.id === id && canMergeInput(step))));
  }, [workflow.steps, setSelected]);
  const positions = chosen.map(step => workflow.steps.findIndex(item => item.id === step.id));
  const consecutive = positions.every((position, index) => position === positions[0] + index);
  if (!workflow.steps.some(step => canMergeInput(step) || step.merge)) return null;
  const last = chosen.at(-1);
  async function merge() {
    setWorking(true); onBusy(true);
    try {
      const result = await mutate(`/workflows/${workflow.id}/merge-inputs`, {
        version: workflow.version, step_ids: chosen.map(step => step.id), confirm_same_field: confirmed,
      });
      setSelected([]); setConfirmed(false); onUpdate(result);
    } catch (error) { onError(error.message); }
    finally { setWorking(false); onBusy(false); }
  }
  return <section className="merge-inputs" aria-label="Merge typing steps">
    <strong>Combine repeated typing</strong>
    <p>Consecutive updates from the same recorded typing session combine automatically when recording stops. To combine older captures, select consecutive typing steps below and check that they belong to the same field.</p>
    <small>{chosen.length} steps selected. Original captures and screenshots are preserved for Undo merge.</small>
    {chosen.length >= 2 && <div className="merge-preview">
      <strong>Final captured text</strong><pre>{last.value ? JSON.stringify(last.value) : '(empty field)'}</pre>
      <p>The combined instruction uses this final value, the first available before-image and the last available after-image. It replaces the selected instructions and needs verification.</p>
      {!consecutive && <p role="status">Select consecutive typing steps without another action between them.</p>}
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={disabled || working} />I confirm these are updates to the same field in one typing action.</label>
    </div>}
    <div className="merge-actions"><button className="secondary small" disabled={disabled || working || chosen.length < 2 || !consecutive || !confirmed} onClick={merge}>{working ? 'Merging...' : 'Merge selected typing steps'}</button>
      {chosen.length > 0 && <button className="text-button" disabled={working} onClick={() => setSelected([])}>Clear selection</button>}</div>
    {disabled && !working && <small>Stop recording and finish pending edits or processing before merging.</small>}
  </section>;
}

export function UndoInputMerge({ workflow, step, disabled, onBusy, onUpdate, onError }) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  if (!step.merge) return null;
  async function undo() {
    setWorking(true); onBusy(true);
    try {
      onUpdate(await mutate(`/workflows/${workflow.id}/steps/${step.id}/unmerge`, {version: workflow.version}));
    } catch (error) { onError(error.message); }
    finally { setWorking(false); onBusy(false); }
  }
  return <div className="merge-history">
    <span>{step.merge.count} typing updates combined{step.merge.automatic ? ' automatically' : ''}. Originals are saved.</span>
    {!confirming ? <button className="text-button" disabled={disabled || working} onClick={() => setConfirming(true)}>Undo merge</button> : <>
      <p>Restore the original steps and screenshots? Wording changes to this combined step will be discarded. Restored steps need verification.</p>
      <div className="merge-actions"><button className="secondary small" disabled={disabled || working} onClick={undo}>{working ? 'Restoring...' : 'Restore original steps'}</button>
        <button className="text-button" disabled={working} onClick={() => setConfirming(false)}>Cancel</button></div>
    </>}
  </div>;
}
