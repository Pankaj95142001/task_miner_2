import React, { useEffect, useRef, useState } from 'react';
import { Eye, Loader2, Check } from 'lucide-react';
import { mutate, request } from './api';

const sections = [['description', 'Overview'], ['purpose', 'Purpose'], ['scope', 'Scope'], ['prerequisites', 'Prerequisites']];
const details = [['purpose', 'Purpose'], ['expected_result', 'Expected result'], ['validation', 'Validation'], ['notes', 'Notes']];

export function WorkflowVisionReview({ workflow, disabled, disabledReason, onUpdate, onError, onBusy }) {
  const [working, setWorking] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [pollError, setPollError] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const resultsRef = useRef(null);
  const review = workflow.vision_review;
  const processing = review?.status === 'processing';
  const stale = review && review.basis_version !== workflow.version;
  const callbacks = useRef({ onUpdate, onError, onBusy });
  callbacks.current = { onUpdate, onError, onBusy };
  const stepById = new Map(workflow.steps.map(s => [s.id, s]));
  const remainingSteps = (review?.steps || []).filter(s => !review.applied_step_ids.includes(s.step_id));
  const remainingFields = sections.filter(([key]) => review?.overview?.[key]?.trim() && !review.applied_fields.includes(key) && review.overview[key] !== (workflow[key] || ''));
  const appliedCount = (review?.applied_step_ids?.length || 0) + (review?.applied_fields?.length || 0);
  const allApplied = review?.status === 'ready' && !remainingSteps.length && !remainingFields.length;
  const resultsTitle = allApplied && appliedCount ? 'Applied Vision suggestions' : 'Review suggested changes';
  useEffect(() => {
    if (review?.status !== 'ready') return;
    setResultsOpen(!allApplied);
    if (allApplied && resultsRef.current?.contains(document.activeElement)) {
      resultsRef.current.querySelector('summary')?.focus({ preventScroll: true });
    }
  }, [review?.id, review?.status, allApplied]);
  const selectionKey = JSON.stringify([review?.id, review?.status, review?.applied_step_ids, review?.applied_fields]);
  const initializedReview = useRef(null);
  useEffect(() => {
    if (review?.status !== 'ready') return;
    const ids = remainingSteps.map(s => s.step_id);
    const fields = remainingFields.map(([key]) => key);
    if (initializedReview.current !== review.id) {
      setSelectedSteps(ids); setSelectedFields(fields); initializedReview.current = review.id;
    } else {
      setSelectedSteps(previous => previous.filter(id => ids.includes(id)));
      setSelectedFields(previous => previous.filter(key => fields.includes(key)));
    }
  }, [selectionKey]);
  useEffect(() => {
    if (!processing) return;
    let active = true;
    let timer;
    async function poll() {
      try {
        const latest = await request(`/workflows/${workflow.id}`);
        if (!active) return;
        setPollError(''); callbacks.current.onUpdate(latest);
      } catch (error) { if (active) setPollError(`Progress could not refresh: ${error.message}`); }
      if (active) timer = setTimeout(poll, 2000);
    }
    timer = setTimeout(poll, 1000);
    return () => { active = false; clearTimeout(timer); };
  }, [workflow.id, processing]);
  async function run(body, method = 'POST') {
    setWorking(true); callbacks.current.onBusy(true);
    try {
      callbacks.current.onUpdate(await mutate(`/workflows/${workflow.id}/vision-review`, { version: workflow.version, ...body }, method));
    } catch (error) { callbacks.current.onError(error.message); }
    finally { setWorking(false); callbacks.current.onBusy(false); }
  }
  function apply(ids, fields) { return run({ review_id: review.id, step_ids: ids, fields }, 'PATCH'); }
  function toggle(setter, value, checked) { setter(previous => checked ? [...previous, value] : previous.filter(i => i !== value)); }
  const locked = disabled || working || processing;
  const canApply = !locked && !stale && review?.status === 'ready';
  const hasImages = workflow.steps.some(s => !s.sensitive && s.text_capture !== 'protected' && (s.before?.filename || s.after?.filename));
  return <section className="workflow-vision" aria-label="Whole SOP visual review">
    <div className="workflow-vision-heading"><span className="feature-icon"><Eye size={22} /></span><div><h2>Improve your entire guide</h2><p>Let Vision follow the screenshots from the first step to the last.</p></div></div>
    <p>Review clearer instructions, purpose, scope and prerequisites together. Available screenshots, captured actions and accepted narration are sent to OpenAI. Private steps are skipped. Nothing is applied until you choose.</p>
    <div className="workflow-vision-actions">
      <button className="primary" disabled={locked || !hasImages} onClick={() => run({})}>{processing || working ? <Loader2 className="spin" size={16} /> : <Eye size={16} />}Improve entire SOP with Vision</button>
      {review?.status === 'error' && !stale && <button className="secondary" disabled={locked} onClick={() => run({ retry: true })}>Retry remaining analysis</button>}
    </div>
    {disabled && !working && !processing && disabledReason && <small role="status">{disabledReason}</small>}
    {!hasImages && <small>Record at least one non-private step with screenshots to use this review.</small>}
    {processing && <div className="vision-progress" role="status"><p>{review.phase === 'overview' ? 'Drafting the SOP overview and setup...' : `Reviewing steps: ${review.progress} of ${review.total}`}</p><progress max={review.total || 1} value={review.progress} /><small>You can leave this page and return. Completed batches are saved.</small></div>}
    {pollError && <p role="alert">{pollError}</p>}
    {review?.error && <p className="notice" role="alert">{review.error}</p>}
    {stale && !processing && <p className="notice">The workflow changed. Run a new visual review before applying suggestions.</p>}
    {review?.skipped_step_ids?.length > 0 && <p><strong>{review.skipped_step_ids.length} private step(s) skipped.</strong> Review those instructions manually.</p>}
    {review?.status === 'ready' && <details className="workflow-vision-results" ref={resultsRef} open={resultsOpen} onToggle={event => setResultsOpen(event.currentTarget.open)}>
      <summary className="vision-results-summary"><h3>{resultsTitle}</h3><span>{allApplied ? (appliedCount ? 'Changes applied - verify the updated steps' : 'No new changes to apply') : `${remainingSteps.length + remainingFields.length} changes remaining`}</span></summary>
      <p>Compare the suggestions with your screenshots. Applied steps become drafts for you to verify before exporting.</p>
      {review.overview?.warning && <p className="notice">{review.overview.warning}</p>}
      {sections.map(([key, label]) => {
        const applied = review.applied_fields.includes(key);
        const available = remainingFields.some(([k]) => k === key);
        return <details key={key} className="vision-change">
          <summary>{label}{applied ? ' - Applied' : ''}</summary>
          <div className="vision-comparison"><div><strong>Current</strong><p>{workflow[key] || 'Not provided'}</p></div><div><strong>Suggested</strong><p>{review.overview?.[key] || 'No supported suggestion'}</p></div></div>
          {available && <label><input type="checkbox" aria-label={`Use suggested ${label.toLowerCase()}`} checked={selectedFields.includes(key)} disabled={!canApply} onChange={e => toggle(setSelectedFields, key, e.target.checked)} />Use this section</label>}
        </details>;
      })}
      {review.steps.map(suggestion => {
        const step = stepById.get(suggestion.step_id);
        if (!step) return null;
        const applied = review.applied_step_ids.includes(step.id);
        const oldDetails = step.sop_details || step.narration_details || {};
        return <details key={step.id} className="vision-change">
          <summary>Step {step.sequence}: {applied ? 'Applied' : suggestion.description}</summary>
          <div className="vision-comparison"><div><strong>Current instruction</strong><p>{step.description}</p>{details.map(([key, label]) => oldDetails[key] && <p key={key}><strong>{label}:</strong> {oldDetails[key]}</p>)}</div><div><strong>Suggested instruction</strong><p>{suggestion.description}</p>{details.map(([key, label]) => suggestion[key] && <p key={key}><strong>{label}:</strong> {suggestion[key]}</p>)}</div></div>
          {suggestion.evidence && <p><strong>Evidence:</strong> {suggestion.evidence}</p>}
          {suggestion.warning && <p className="notice">{suggestion.warning}</p>}
          <small>Screenshots reviewed: {suggestion.image_phases.length ? suggestion.image_phases.join(' + ') : 'None; captured text only'}.</small>
          {applied ? <p><Check size={15} /> Applied. Verify this step below.</p> : <div className="workflow-vision-actions"><label><input type="checkbox" aria-label={`Use visual suggestion for step ${step.sequence}`} checked={selectedSteps.includes(step.id)} disabled={!canApply} onChange={e => toggle(setSelectedSteps, step.id, e.target.checked)} />Use this step</label><button className="secondary small" disabled={!canApply} onClick={() => apply([step.id], [])}>Apply only step {step.sequence}</button></div>}
        </details>;
      })}
      <div className="workflow-vision-actions">
        <button className="primary" disabled={!canApply || (!remainingSteps.length && !remainingFields.length)} onClick={() => apply(remainingSteps.map(s => s.step_id), remainingFields.map(([key]) => key))}>Apply all suggestions</button>
        <button className="secondary" disabled={!canApply || (!selectedSteps.length && !selectedFields.length)} onClick={() => apply(selectedSteps, selectedFields)}>Apply selected changes</button>
      </div>
      <small>Model: {review.model}. Recorded input values, selectors, screenshots and step order are preserved.</small>
    </details>}
  </section>;
}
