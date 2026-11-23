import { NarrationReview } from './NarrationReview';
import { WorkflowCard } from './WorkflowCard';
import { DeleteWorkflow } from './DeleteWorkflow';
import { VisionReview } from './VisionReview';
import { MergeInputs, UndoInputMerge, canMergeInput } from './MergeInputs';
import { WorkflowVisionReview } from './WorkflowVisionReview';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, CheckCircle2, ChevronRight, Circle, Clock3, Download, FileText, Film, Layers, LayoutGrid, Loader2, LockKeyhole, LogOut, Monitor, MousePointer2, Plus, Search, Settings2, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { mutate, request } from './api';
import { RecorderWorkspace } from './RecorderWorkspace';
import { ClickCoordinates } from './ClickCoordinates';
import { CapturedText } from './CapturedText';
import './styles.css';

function Brand() {
  return <div className="brand"><span className="brand-icon"><Layers size={23} /></span><span>SOP<span className="brand-light">studio</span><small>KNOWLEDGE, IN MOTION</small></span></div>;
}

function Login({ onConnected }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function connect(event) {
    event.preventDefault(); setBusy(true); setError('');
    sessionStorage.setItem('sop-token', token.trim());
    try { await request('/settings'); onConnected(); }
    catch (e) { sessionStorage.removeItem('sop-token'); setError(e.message); }
    finally { setBusy(false); }
  }
  return <main className="login"><div className="login-story"><Brand /><div><span className="eyebrow light">FROM KNOW-HOW TO HOW-TO</span><h1>Your process.<br />Perfectly documented.</h1><p>Capture the way work gets done. Turn everyday tasks into clear, repeatable instructions.</p><div className="login-flow"><span><MousePointer2 /> Record</span><ChevronRight /><span><CheckCircle2 /> Review</span><ChevronRight /><span><FileText /> Share</span></div></div><small>Built for the work only you know how to do.</small></div><div className="login-panel"><form onSubmit={connect}><span className="login-lock"><LockKeyhole /></span><h2>Open your workspace</h2><p>Connect to your local SOP Studio to record, refine, and share your workflows.</p><label htmlFor="token">Session token</label><input id="token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste your local session token" autoComplete="off" required /><p className="hint">Find your token in <code>data/session-token.txt</code> on the computer running SOP Studio.</p>{error && <p role="alert" className="error">{error}</p>}<button className="primary wide" disabled={busy}>{busy ? <Loader2 className="spin" /> : <>Connect to workspace <ArrowRight size={17} /></>}</button><div className="local-note"><ShieldCheck size={17} /> Your recordings are stored on this computer.</div></form></div></main>;
}

function Status({ workflow }) {
  const ready = workflow.step_count > 0 && workflow.reviewed_count === workflow.step_count;
  const type = workflow.status === 'recording' ? 'recording' : ready ? 'ready' : 'draft';
  return <span className={`status ${type}`}><span />{type === 'recording' ? 'Recording' : type === 'ready' ? 'Ready to export' : 'Needs review'}</span>;
}

function Library({ workflows, onDelete, onOpen, onRecord, search, setSearch, filter, setFilter, loading }) {
  const filtered = workflows.filter(w => w.title.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || (filter === 'review' ? w.status !== 'recording' && (w.reviewed_count !== w.step_count || !w.step_count) : w.step_count > 0 && w.reviewed_count === w.step_count && w.status !== 'recording')));
  const stats = [
    { label: 'Total workflows', value: workflows.length.toString().padStart(2, '0'), icon: Layers },
    { label: 'Steps captured', value: workflows.reduce((a, w) => a + w.step_count, 0).toString().padStart(2, '0'), icon: MousePointer2 },
    { label: 'Ready to share', value: workflows.filter(w => w.step_count && w.step_count === w.reviewed_count && w.status !== 'recording').length.toString().padStart(2, '0'), icon: CheckCircle2 },
  ];
  return <><header className="page-heading"><div><div className="eyebrow">YOUR TEAM'S PLAYBOOK, STARTS HERE</div><h1>Make knowledge repeatable.</h1><p>Turn the things you do into guides anyone can follow.</p></div><button className="primary" onClick={onRecord}><Plus size={18} /> New recording</button></header><section className="hero"><div className="hero-copy"><span className="hero-tag"><span /> LESS WRITING. MORE DOING.</span><h2>You do the work.<br />We'll help document it.</h2><p>Record a browser or desktop workflow, fine-tune the steps,<br className="desktop-break" /> and share a beautifully organized SOP.</p><button className="hero-link" onClick={onRecord}>See how recording works <ArrowRight size={17} /></button></div><div className="process-preview" aria-hidden="true"><div className="preview-tabs"><span /><span /><span /><i>New team member onboarding</i></div><div className="preview-line"><b>01</b><span>Open your team workspace<small>Capture every important detail</small></span><CheckCircle2 /></div><div className="preview-line"><b>02</b><span>Invite your new teammate<small>Make the next step obvious</small></span><CheckCircle2 /></div><div className="preview-line last"><b>03</b><span>Share the knowledge<small>Ready when your team needs it</small></span><CheckCircle2 /></div><div className="preview-badge"><Sparkles size={15} /> A little clarity goes a long way</div></div></section><section className="stats">{stats.map(({ label, value, icon: Icon }) => <div className="stat" key={label}><span className="stat-icon"><Icon size={21} /></span><div><strong>{value}</strong><span>{label}</span></div></div>)}</section><section className="library"><div className="section-heading"><h2>Your workflows <span>{workflows.length}</span></h2><label className="search"><Search size={17} /><input aria-label="Search workflows" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflows..." /></label></div><div className="filter-tabs">{[['all', 'All workflows'], ['review', 'Needs review'], ['ready', 'Ready to export']].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div>{loading ? <div className="empty"><Loader2 className="spin" /><p>Loading your workflows...</p></div> : !filtered.length ? <div className="empty"><span className="empty-icon"><BookOpen size={30} /></span><h3>{workflows.length ? 'No matching workflows' : 'Great processes start with a first step.'}</h3><p>{workflows.length ? 'Try another search or filter.' : 'Record your first task. We will help turn it into your next great guide.'}</p>{!workflows.length && <button className="secondary" onClick={onRecord}><Plus size={16} /> Create your first recording</button>}</div> : <div className="workflow-grid">{filtered.map(w => <WorkflowCard key={w.id} workflow={w} onOpen={onOpen} onDelete={onDelete} status={<Status workflow={w} />} />)}</div>}</section></>;
}

function Screenshot({ workflowId, step, phase }) {
  const shot = step[phase];
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false; let objectUrl;
    setUrl(''); setError('');
    if (shot.filename) request(`/workflows/${workflowId}/steps/${step.id}/screenshots/${phase}?annotated=true`, { blob: true }).then(blob => {
      objectUrl = URL.createObjectURL(blob);
      if (!disposed) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl);
    }).catch(e => { if (!disposed) setError(e.message); });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [workflowId, step.id, phase, shot.filename]);
  return <figure className="screenshot"><figcaption><span>{phase === 'before' ? 'Before action' : 'After action'}</span><small>{shot.captured_at ? new Date(shot.captured_at).toLocaleTimeString() : 'Not captured'}</small></figcaption>{url ? <a href={url} target="_blank" rel="noreferrer" title={`Enlarge ${phase} screenshot`}><img src={url} alt={`${phase} screenshot for ${step.label || step.action}`} /></a> : <div className="screenshot-empty"><Monitor size={23} /><span>{error || (shot.filename ? 'Loading screenshotâ€¦' : 'Screenshot unavailable')}</span></div>}{shot.note && <p className="screenshot-note">{shot.note}</p>}</figure>;
}

function StepEditor({ workflow, step, index, total, onUpdate, onError, disabled, onDirty, anyDirty, otherDirty, onImprove, improveDisabled, visionDisabledReason, onVisionBusy, mergeSelected, onMergeSelect }) {
  const [description, setDescription] = useState(step.description);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const dirty = description !== step.description;
  useEffect(() => { onDirty(step.id, dirty); return () => onDirty(step.id, false); }, [step.id, dirty, onDirty]);
  useEffect(() => { setDescription(step.description); }, [step.id, step.description]);
  async function action(fn) {
    setBusy(true);
    try { onUpdate(await fn()); } catch (e) { onError(e.message); }
    finally { setBusy(false); }
  }
  function move(direction) {
    if (anyDirty) { onError('Save your instruction edits before changing the step order.'); return; }
    const ids = workflow.steps.map(s => s.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    action(() => mutate(`/workflows/${workflow.id}/reorder`, { step_ids: ids, version: workflow.version }));
  }
  return <article className={`step-card ${step.reviewed && !dirty ? 'verified' : ''}`}><div className="step-header"><span className="step-number">{String(index + 1).padStart(2, '0')}</span><div><span className="step-action">{step.action.replace('_', ' ')}</span><span className="step-context">{step.source === 'desktop' ? `Desktop · ${step.app_name || 'Windows'}` : `Tab ${step.tab_id}`} · {step.page_title || 'Untitled page'}</span></div><span className={`review-label ${step.reviewed && !dirty ? 'done' : ''}`}>{step.reviewed && !dirty ? <><CheckCircle2 size={15} /> Verified</> : <><Circle size={15} /> Needs review</>}</span></div>{canMergeInput(step) && <label className="merge-select"><input type="checkbox" aria-label={`Select step ${index + 1} for merging`} checked={mergeSelected} disabled={disabled || busy || anyDirty || improveDisabled} onChange={event => onMergeSelect(step.id, event.target.checked)} />Select typing step</label>}<UndoInputMerge workflow={workflow} step={step} disabled={disabled || busy || anyDirty || improveDisabled} onBusy={onVisionBusy} onUpdate={onUpdate} onError={onError} /><label className="sr-only" htmlFor={`step-${step.id}`}>Step {index + 1} instruction</label><textarea id={`step-${step.id}`} value={description} maxLength={5000} onChange={e => setDescription(e.target.value)} disabled={disabled || busy} rows={2} />{(step.sop_details || step.narration_details) && <div className="step-narration-details">{[['purpose','Purpose'],['expected_result','Expected result'],['validation','Validation'],['notes','Notes']].map(([key,label])=>(step.sop_details || step.narration_details)[key]&&<p key={key}><strong>{label}:</strong> {(step.sop_details || step.narration_details)[key]}</p>)}</div>}<div className="step-improve"><button className="secondary small" disabled={disabled || busy || anyDirty || improveDisabled} onClick={() => onImprove(step.id)}><Sparkles size={14} /> Improve this step</button><small>Refine this instruction with OpenAI, then review and verify it.</small></div><div className="step-url">{step.source === 'desktop' ? `Desktop app: ${step.app_name || 'Windows'}` : step.url || 'No page URL'}</div><div className="screenshots">{['before', 'after'].map(phase => <Screenshot key={phase} workflowId={workflow.id} step={step} phase={phase} />)}</div><VisionReview workflow={workflow} step={step} disabled={disabled || busy || otherDirty || improveDisabled} disabledReason={visionDisabledReason || (busy ? 'Wait for this step to finish saving.' : otherDirty ? 'Save edits to other steps before using Vision on this step.' : '')} draftDescription={dirty ? description : undefined} onBusy={onVisionBusy} onUpdate={onUpdate} onError={onError} /><details><summary>Captured details</summary><div className="raw-details"><span>Recorded: {new Date(step.occurred_at).toLocaleString()}</span><span>Element: {step.label || 'â€”'}</span>{step.capture_host && <span>Recorded on remote machine: {step.capture_host.machine}</span>}{step.desktop_target && <><span>Automation ID: {step.desktop_target.auto_id || 'Unavailable'}</span><span>Control name: {step.desktop_target.name || 'Unavailable'}</span><span>Control type: {step.desktop_target.control_type || 'Unavailable'}</span></>}<ClickCoordinates step={step} /><CapturedText step={step} />{step.source !== 'desktop' && <code>{step.selector || 'No selector'}</code>}</div></details><div className="step-footer"><div className="step-tools"><button className="icon-button" aria-label={`Move step ${index + 1} up`} disabled={disabled || busy || index === 0 || dirty} onClick={() => move(-1)}><ArrowUp size={16} /></button><button className="icon-button" aria-label={`Move step ${index + 1} down`} disabled={disabled || busy || index === total - 1 || dirty} onClick={() => move(1)}><ArrowDown size={16} /></button><button className="icon-button danger" aria-label={`Delete step ${index + 1}`} disabled={disabled || busy} onClick={() => setRemoving(!removing)}><Trash2 size={16} /></button></div>{removing ? <div className="delete-confirm"><span>Delete this step?</span><button className="text-button" onClick={() => setRemoving(false)}>Cancel</button><button className="danger text-button" disabled={disabled || busy} onClick={() => action(() => request(`/workflows/${workflow.id}/steps/${step.id}?version=${workflow.version}`, { method: 'DELETE' }))}>Delete</button></div> : <div className="step-save">{dirty && <button className="secondary small" disabled={disabled || busy || !description.trim()} onClick={() => action(() => mutate(`/workflows/${workflow.id}/steps/${step.id}`, { description, reviewed: false, version: workflow.version }, 'PATCH'))}>Save draft</button>}<button className={step.reviewed && !dirty ? 'secondary small' : 'primary small'} disabled={disabled || busy || !description.trim()} onClick={() => action(() => mutate(`/workflows/${workflow.id}/steps/${step.id}`, { description, reviewed: !(step.reviewed && !dirty), version: workflow.version }, 'PATCH'))}>{busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />}{step.reviewed && !dirty ? 'Mark unreviewed' : 'Save & verify'}</button></div>}</div></article>;
}

function Workflow({ workflow, onDelete, onBack, onUpdate, onError, onNotice, onRefresh }) {
  const [localBusy, setBusy] = useState(false);
  const [narrationDirty, setNarrationDirty] = useState(false);
  const [visionBusy, setVisionBusy] = useState(false);
  const busy = localBusy || visionBusy || narrationDirty || workflow.narration?.status === 'processing' || workflow.vision_review?.status === 'processing';
  const [title, setTitle] = useState(workflow.title);
  const [recordingContext, setRecordingContext] = useState(workflow.recording_context || '');
  const [description, setDescription] = useState(workflow.description);
  const [purpose, setPurpose] = useState(workflow.purpose || '');
  const [scope, setScope] = useState(workflow.scope || '');
  const [prerequisites, setPrerequisites] = useState(workflow.prerequisites || '');
  const [dirtyIds, setDirtyIds] = useState(new Set());
  const [mergeIds, setMergeIds] = useState([]);
  const onMergeSelect = (id, checked) => setMergeIds(previous => checked ? [...previous, id] : previous.filter(value => value !== id));
  const [includeEdited, setIncludeEdited] = useState(false);
  const [improving, setImproving] = useState(null);
  const onDirty = useCallback((id, dirty) => setDirtyIds(previous => {
    if (previous.has(id) === dirty) return previous;
    const next = new Set(previous); if (dirty) next.add(id); else next.delete(id); return next;
  }), []);
  const reviewed = workflow.steps.filter(s => s.reviewed).length;
  const recording = workflow.status === 'recording';
  const canExport = !recording && workflow.steps.length > 0 && reviewed === workflow.steps.length && dirtyIds.size === 0;
  const changed = recordingContext !== (workflow.recording_context || '') || title !== workflow.title || description !== workflow.description || purpose !== (workflow.purpose || '') || scope !== (workflow.scope || '') || prerequisites !== (workflow.prerequisites || '');
  const visionDisabledReason = recording ? 'Stop recording before analyzing a step.'
    : localBusy || visionBusy || workflow.narration?.status === 'processing' || workflow.vision_review?.status === 'processing'
      ? 'Wait for the current workflow operation to finish before using Vision.'
    : narrationDirty ? 'Save your transcript and assignment edits before using Vision.'
    : changed ? 'Save SOP details before using Vision.' : '';
  useEffect(() => { setTitle(workflow.title); setRecordingContext(workflow.recording_context || ''); setDescription(workflow.description); setPurpose(workflow.purpose || ''); setScope(workflow.scope || ''); setPrerequisites(workflow.prerequisites || ''); }, [workflow.id, workflow.title, workflow.recording_context, workflow.description, workflow.purpose, workflow.scope, workflow.prerequisites]);
  async function run(fn) { setBusy(true); try { await fn(); } catch (e) { onError(e.message); } finally { setBusy(false); } }
  async function improve(stepId = null) {
    setImproving(stepId || 'all');
    await run(async () => {
      try {
        const path = stepId ? `/workflows/${workflow.id}/steps/${stepId}/clean` : `/workflows/${workflow.id}/clean`;
        const result = await mutate(path, { version: workflow.version, ...(!stepId ? { include_edited_and_verified: includeEdited } : {}) });
        onUpdate(result.workflow);
        onNotice(result.message);
      } finally { setImproving(null); }
    });
  }
  async function download(kind) {
    const response = await request(`/workflows/${workflow.id}/export/${kind}`, { raw: true });
    const encodedName = response.headers.get('Content-Disposition')?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const filename = encodedName ? decodeURIComponent(encodedName) : `SOP.${kind}`;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    onNotice(`Downloading ${filename}.`);
  }
  return <><button className="back-button" onClick={onBack}><ArrowLeft size={16} /> All workflows</button><header className="editor-heading"><div><div className="eyebrow">WORKFLOW EDITOR</div><h1>From captured to crystal clear.</h1><p>Check the details, add your expertise, then make it official.</p></div><button className="secondary" disabled={busy || changed || dirtyIds.size > 0} onClick={onRefresh}><Clock3 size={16} /> Refresh</button><button className="secondary danger" disabled={busy || recording} onClick={() => onDelete(workflow)}><Trash2 size={16} /> Delete workflow</button></header><div className="editor-layout"><div className="editor-main"><WorkflowVisionReview workflow={workflow} disabled={localBusy || visionBusy || narrationDirty || workflow.narration?.status === 'processing' || recording || changed || dirtyIds.size > 0} disabledReason={visionDisabledReason || (dirtyIds.size > 0 ? 'Save instruction edits before improving the entire SOP.' : '')} onUpdate={onUpdate} onError={onError} onBusy={setVisionBusy} /><section className="workflow-info"><label htmlFor="workflow-title">Workflow title</label><input id="workflow-title" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} disabled={recording || busy} /><label htmlFor="workflow-context">Workflow context <span>(optional)</span></label><textarea id="workflow-context" rows={3} maxLength={2000} placeholder="Describe the task you intended to record." value={recordingContext} onChange={e => setRecordingContext(e.target.value)} disabled={recording || busy} aria-describedby="workflow-context-hint" /><p className="hint" id="workflow-context-hint">Your original task description guides SOP improvements. It stays separate from the overview exported in your SOP.</p><label htmlFor="workflow-description">Overview <span>(optional)</span></label><textarea id="workflow-description" rows={2} maxLength={5000} placeholder="What does this process help someone accomplish?" value={description} onChange={e => setDescription(e.target.value)} disabled={recording || busy} /><label htmlFor="workflow-purpose">Purpose</label><textarea id="workflow-purpose" rows={3} maxLength={5000} placeholder="Why is this procedure needed? What outcome should it achieve?" value={purpose} onChange={e => setPurpose(e.target.value)} disabled={recording || busy} /><label htmlFor="workflow-scope">Scope</label><textarea id="workflow-scope" rows={3} maxLength={5000} placeholder="Who and which systems does this apply to? Where does the procedure start and end?" value={scope} onChange={e => setScope(e.target.value)} disabled={recording || busy} /><label htmlFor="workflow-prerequisites">Prerequisites</label><textarea id="workflow-prerequisites" rows={3} maxLength={5000} placeholder="What access, software, files, or setup must be ready before starting?" value={prerequisites} onChange={e => setPrerequisites(e.target.value)} disabled={recording || busy} />{changed && <button className="primary small" disabled={busy || !title.trim()} onClick={() => run(async () => onUpdate(await mutate(`/workflows/${workflow.id}`, { title, recording_context: recordingContext, description, purpose, scope, prerequisites, version: workflow.version }, 'PATCH')))}>Save SOP details</button>}</section>{recording && <div className="notice"><Circle size={18} /><span>Recording in progress. Stop the recording before reviewing. Refresh to see newly synced steps.</span></div>}<NarrationReview workflow={workflow} disabled={localBusy || visionBusy || workflow.vision_review?.status === 'processing' || workflow.narration?.status === 'processing' || recording || changed || dirtyIds.size > 0} onUpdate={onUpdate} onError={onError} onDirty={setNarrationDirty} /><MergeInputs workflow={workflow} selected={mergeIds} setSelected={setMergeIds} disabled={recording || busy || changed || dirtyIds.size > 0} onBusy={setVisionBusy} onUpdate={onUpdate} onError={onError} /><div className="steps-heading"><h2>Recorded steps <span>{workflow.steps.length}</span></h2><span>Before + after screenshots</span></div>{!workflow.steps.length && <div className="empty"><MousePointer2 size={28} /><h3>Waiting for your first step</h3><p>Perform your task while the recorder is running.</p></div>}{workflow.steps.map((step, i) => <StepEditor key={step.id} workflow={workflow} step={step} index={i} total={workflow.steps.length} onUpdate={onUpdate} onError={onError} disabled={recording || busy} onDirty={onDirty} anyDirty={dirtyIds.size > 0} otherDirty={dirtyIds.size > (dirtyIds.has(step.id) ? 1 : 0)} onImprove={improve} improveDisabled={changed} visionDisabledReason={visionDisabledReason} onVisionBusy={setVisionBusy} mergeSelected={mergeIds.includes(step.id)} onMergeSelect={onMergeSelect} />)}</div><aside className="review-sidebar"><section className="review-panel"><span className="feature-icon"><ShieldCheck size={23} /></span><h3>A final human touch.</h3><p>Verify each instruction and its screenshots before sharing your guide.</p><div className="review-count"><strong>{reviewed}<span> / {workflow.steps.length}</span></strong><span>steps verified</span></div><div className="progress"><span style={{ width: `${workflow.steps.length ? reviewed / workflow.steps.length * 100 : 0}%` }} /></div><div className="divider" /><div className="improve-options"><button className="secondary wide" disabled={busy || recording || changed || dirtyIds.size > 0 || !workflow.steps.some(s => includeEdited || (!s.edited && !s.reviewed))} onClick={() => improve()}>{improving ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} {improving === 'all' ? 'Improving all steps...' : 'Improve all steps'}</button><label><input type="checkbox" checked={includeEdited} onChange={e => setIncludeEdited(e.target.checked)} disabled={busy || recording} />Include edited and verified steps</label><small>{includeEdited ? 'OpenAI will rewrite all instructions as unverified drafts. Review them before exporting.' : 'OpenAI refines untouched instructions. Your edits and verified steps are preserved.'}</small>{improving && <small role="status">{improving === 'all' ? 'Improving eligible instructions...' : 'Improving the selected instruction...'}</small>}</div><div className="divider" /><button className="primary wide" disabled={busy || !canExport || changed} onClick={() => run(() => download('pdf'))}><Download size={17} /> Export PDF</button><button className="secondary wide" disabled={busy || !canExport || changed} onClick={() => run(() => download('docx'))}><FileText size={17} /> Export Word</button><small>{canExport ? 'Your guide is reviewed and ready to share.' : 'Exports unlock when every step is verified.'}</small></section><p className="editor-tip"><BookOpen size={17} /><span>Good instructions start with a verb. Keep one clear action in each step.</span></p></aside></div></>;
}

function App() {
  const [connected, setConnected] = useState(Boolean(sessionStorage.getItem('sop-token')));
  const [workflows, setWorkflows] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const [deleting, setDeleting] = useState(null);
  function deleted(id) {
    setDeleting(null); selection.current++;
    setWorkflows(previous => previous.filter(w => w.id !== id));
    if (workflow?.id === id) { setWorkflow(null); }
    notify('Workflow and its stored files permanently deleted.');
    void load();
  }
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [setup, setSetup] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [notification, setNotification] = useState(null);
  const timeout = useRef();
  const selection = useRef(0);
  function notify(message, error = false) { clearTimeout(timeout.current); setNotification({ message, error }); timeout.current = setTimeout(() => setNotification(null), 8000); }
  async function load() { setLoading(true); try { const [list, config] = await Promise.all([request('/workflows'), request('/settings')]); setWorkflows(list); setSettings(config); } catch (e) { notify(e.message, true); } finally { setLoading(false); } }
  async function open(id) { const current = ++selection.current; try { const result = await request(`/workflows/${id}`); if (current === selection.current) setWorkflow(result); } catch (e) { notify(e.message, true); } }
  function back() { selection.current++; setWorkflow(null); load(); }
  useEffect(() => { const unauthorized = () => { sessionStorage.removeItem('sop-token'); setConnected(false); setWorkflow(null); }; window.addEventListener('sop-unauthorized', unauthorized); return () => { window.removeEventListener('sop-unauthorized', unauthorized); clearTimeout(timeout.current); }; }, []);
  useEffect(() => { if (!connected) return; load(); const timer = setInterval(() => { if (!document.hidden) request('/workflows').then(setWorkflows).catch(() => {}); }, 10000); return () => clearInterval(timer); }, [connected]);
  if (!connected) return <Login onConnected={() => setConnected(true)} />;
  return <div className="app-shell"><aside className="sidebar"><Brand /><div className="workspace-label"><span>W</span><div>My workspace<small>Local workspace</small></div><LockKeyhole size={14} /></div><span className="nav-label">WORKSPACE</span><nav><button className={!workflow ? 'active' : ''} onClick={() => { setFilter('all'); back(); }}><LayoutGrid size={18} /> All workflows <span>{workflows.length}</span></button><button onClick={() => { setFilter('review'); back(); }}><CheckCircle2 size={18} /> Review queue</button><button onClick={() => setSetup(true)}><Film size={18} /> Recording guide <ArrowRight size={15} /></button></nav><div className="sidebar-card"><span className="sparkle-mark"><Sparkles size={21} /></span><h3>Your expertise.<br />Their head start.</h3><p>A good guide makes everyone's next step a little easier.</p><button onClick={() => setSetup(true)}>Create a guide <ArrowRight size={15} /></button></div><div className="sidebar-bottom"><span className="connection-dot" /> Local storage<div><button aria-label="Workspace setup" title="Workspace setup" onClick={() => setSetup(true)}><Settings2 size={17} /></button><button aria-label="Sign out" title="Sign out" onClick={() => { sessionStorage.removeItem('sop-token'); setConnected(false); setWorkflow(null); }}><LogOut size={17} /></button></div></div></aside><div className="main-shell"><div className="topbar"><div><span>Workspace</span><ChevronRight size={14} /><strong>{workflow ? 'Review workflow' : 'All workflows'}</strong></div><span className="private-label"><LockKeyhole size={13} /> Private workspace</span><span className="avatar">ME</span></div><main className="content">{workflow ? <Workflow workflow={workflow} onDelete={setDeleting} onBack={back} onUpdate={setWorkflow} onError={m => notify(m, true)} onNotice={m => notify(m)} onRefresh={() => open(workflow.id)} /> : <Library workflows={workflows} onDelete={setDeleting} onOpen={open} onRecord={() => setSetup(true)} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} loading={loading} />}<footer className="page-footer"><span>SOP Studio</span><span>A little less explaining. A lot more doing.</span></footer></main></div>{deleting && <DeleteWorkflow key={deleting.id} workflow={deleting} onClose={() => setDeleting(null)} onDeleted={deleted} />}<RecorderWorkspace open={setup} configured={settings.openai_configured} onClose={() => setSetup(false)} onReview={open} />{notification && <div role={notification.error ? 'alert' : 'status'} className={`toast ${notification.error ? 'toast-error' : ''}`}><span>{notification.message}</span><button aria-label="Dismiss notification" onClick={() => setNotification(null)}><X size={17} /></button></div>}</div>;
}

createRoot(document.getElementById('root')).render(<App />);
