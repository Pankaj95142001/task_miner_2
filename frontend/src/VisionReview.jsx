import React, { useEffect, useState } from 'react';
import { mutate } from './api';

export function VisionReview({ workflow, step, disabled, disabledReason, draftDescription, onBusy, onUpdate, onError }) {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [useDescription, setUseDescription] = useState(true);
  const [useSelector, setUseSelector] = useState(false);
  const [useValue, setUseValue] = useState(false);
  const [confirmedValue, setConfirmedValue] = useState('');
  const suggestion = step.vision;
  useEffect(() => { setUseDescription(true); setUseSelector(Boolean(suggestion?.selector)); setUseValue(false); setConfirmedValue(suggestion?.recovered_value ?? ''); }, [suggestion?.id]);
  const privateStep = step.sensitive || step.text_capture === 'protected';
  const canRecover = step.action === 'input' && (!step.value || step.text_capture === 'truncated');
  const candidates = step.browser_target?.candidates || [];
  const hasOwnImages = Boolean(step.before?.filename || step.after?.filename);
  const position = workflow.steps.findIndex(item => item.id === step.id);
  const hasContextImages = [workflow.steps[position - 1], workflow.steps[position + 1]].some(item =>
    item && !item.sensitive && item.text_capture !== 'protected' && (item.before?.filename || item.after?.filename));
  const hasImages = hasOwnImages || hasContextImages;
  const hasDraft = draftDescription !== undefined;
  const reason = privateStep ? 'Vision is unavailable for private or protected steps. Edit this instruction manually.'
    : !hasImages ? 'No screenshots are available for this step or its adjacent steps. Use Improve this step for text-only wording, or edit manually.'
    : disabled ? (disabledReason || 'Wait for the current operation to finish before using Vision.')
    : hasDraft && !draftDescription.trim() ? 'Enter an instruction before saving and analyzing.' : '';
  const blocked = Boolean(reason);
  const cannotApply = blocked || busy || hasDraft;
  const stale = suggestion && (suggestion.basis_description !== step.description || suggestion.basis_selector !== step.selector || (suggestion.context_version != null && suggestion.context_version !== workflow.version));
  async function run(apply = false) {
    if (busy || blocked || (apply && hasDraft)) return;
    setBusy(true); setErrorMessage(''); onBusy?.(true);
    let draftSaved = false;
    try {
      let current = workflow;
      if (!apply && hasDraft) {
        current = await mutate(`/workflows/${workflow.id}/steps/${step.id}`, {
          description: draftDescription, reviewed: false, version: workflow.version,
        }, 'PATCH');
        draftSaved = true;
        onUpdate(current);
      }
      const body = { version: current.version, ...(apply ? { suggestion_id: suggestion.id, use_description: useDescription, use_selector: useSelector, ...(useValue ? { confirmed_value: confirmedValue } : {}) } : {}) };
      onUpdate(await mutate(`/workflows/${workflow.id}/steps/${step.id}/vision`, body, apply ? 'PATCH' : 'POST'));
    } catch (error) {
      const message = draftSaved ? `Your draft was saved. Vision analysis failed: ${error.message}` : error.message;
      setErrorMessage(message); onError(message);
    }
    finally { setBusy(false); onBusy?.(false); }
  }
  return <details className="vision-review">
    <summary>Vision assistance</summary>
    {!privateStep && <><p>Analyze this step with OpenAI using its saved screenshots, nearby screenshots, surrounding steps, and target details. Images may contain visible personal information. Review the suggestion before applying it.</p>
    {step.source !== 'desktop' && <small>{candidates.length ? `${candidates.length} selector candidates were checked against the target when recorded.` : 'No DOM candidates were captured. Vision can suggest wording, but cannot reconstruct a reliable selector from an image.'}</small>}
    </>}
    <button className="secondary small" disabled={blocked || busy} onClick={() => run()}>{busy ? 'Working...' : hasDraft && !privateStep ? 'Save draft & analyze with OpenAI' : 'Analyze screenshots with OpenAI'}</button>
    {busy ? <small role="status">Analyzing this step. Other workflow actions will become available when this finishes.</small> : reason && <small role="status">{reason}</small>}
    {!privateStep && !hasOwnImages && hasContextImages && <small>This step has no screenshot. Vision will use adjacent screenshots as context; review the wording carefully.</small>}
    {!privateStep && hasDraft && !busy && <small>Your current instruction will be saved as an unverified draft before analysis. Analyze again before applying an earlier suggestion.</small>}
    {errorMessage && <p className="notice">{errorMessage}</p>}
    {!privateStep && suggestion && <section aria-label="Vision suggestion">
      {suggestion.inferred_intent && <p><strong>Likely task (inferred):</strong> {suggestion.inferred_intent}</p>}
      <strong>Suggested instruction</strong><p>{suggestion.description}</p>
      {suggestion.observation && <p><strong>Visible evidence:</strong> {suggestion.observation}</p>}
      {suggestion.sop_note && <p><strong>SOP review:</strong> {suggestion.sop_note}</p>}
      {suggestion.recovery_evidence && <p><strong>Text evidence:</strong> {suggestion.recovery_evidence}</p>}
      {suggestion.warning && <p className="notice">{suggestion.warning}</p>}
      <small>Evidence confidence: {suggestion.confidence}. Model: {suggestion.model}. Human review is required.</small>
      {suggestion.selector ? <><strong>Suggested selector</strong><code>{suggestion.selector}</code></> : <small>No selector change is proposed. The recorded selector is preserved.</small>}
      {suggestion.applied ? <p>Suggestion applied. Verify the step before exporting your SOP.</p> : stale ? <p>The workflow changed. Analyze again before applying.</p> : <>
        <label><input type="checkbox" checked={useDescription} onChange={e => setUseDescription(e.target.checked)} disabled={cannotApply} /> Use suggested instruction</label>
        {suggestion.selector && <label><input type="checkbox" checked={useSelector} onChange={e => setUseSelector(e.target.checked)} disabled={cannotApply} /> Use suggested selector</label>}
        {canRecover && <>
          <label>Recovered or corrected text<textarea aria-label="Recovered or corrected text" maxLength={2000} value={confirmedValue} onChange={e => { setConfirmedValue(e.target.value); setUseValue(false); }} disabled={cannotApply} /></label>
          <small>{suggestion.recovered_value == null ? 'The model could not recover exact text. Enter it yourself if known.' : 'Check this proposed text against the screenshots.'} Confirmed text updates the SOP instruction and the saved input value.</small>
          <label><input type="checkbox" checked={useValue} onChange={e => setUseValue(e.target.checked)} disabled={cannotApply} />I confirm this exact input value, including an empty value if intended</label>
        </>}
        <button className="primary small" disabled={cannotApply || (!useDescription && !useSelector && !useValue)} onClick={() => run(true)}>Apply selected suggestions</button>
      </>}
    </section>}
  </details>;
}
