import { useNarration } from './useNarration';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Film, Loader2, Monitor, Pause, Play, RotateCcw, Square, X } from 'lucide-react';
import { mutate, request } from './api';

const busyPhases = new Set(['starting', 'pausing', 'resuming', 'stopping', 'recovering']);
const livePhases = new Set(['starting', 'recording', 'paused', 'pausing', 'resuming', 'stopping', 'recovering']);
const phaseLabel = {
  idle: 'Ready to record', starting: 'Opening Chromium…', recording: 'Recording in Chromium', paused: 'Recording paused',
  pausing: 'Pausing…', resuming: 'Resuming…', stopping: 'Saving your recording…', recovering: 'Recovering saved steps…',
  interrupted: 'Recording needs recovery', done: 'Ready for review', error: 'Recorder needs attention',
};

export function RecorderWorkspace({ open, onClose, onReview, configured }) {
  const [state, setState] = useState({ phase: 'idle', available: true, count: 0, pending: 0 });
  const voice = useNarration(state);
  const [title, setTitle] = useState('');
  const [recordingContext, setRecordingContext] = useState('');
  const [mode, setMode] = useState('browser');
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [extensionGuide, setExtensionGuide] = useState(false);
  const [reviewedWorkflow, setReviewedWorkflow] = useState(null);
  const mutationEpoch = useRef(0);
  const inflight = useRef(false);
  const dialog = useRef(null);
  const active = livePhases.has(state.phase);
  const busy = requesting || busyPhases.has(state.phase);
  const canStart = !active && !state.recoverable && !connectionError && !loading;
  const desktop = (active || state.recoverable ? state.mode : mode) === 'desktop';
  const modeAvailable = desktop ? state.desktop_available : (state.browser_available ?? state.available);
  const browserName = state.browser_channel === 'msedge' ? 'Microsoft Edge' : 'Chromium';
  const statusLabel = state.mode === 'desktop'
    ? ({ starting: 'Preparing desktop recorder...', recording: 'Recording whole desktop' }[state.phase] || phaseLabel[state.phase])
    : ({ starting: `Opening ${browserName}...`, recording: `Recording in ${browserName}` }[state.phase] || phaseLabel[state.phase]);

  useEffect(() => {
    let disposed = false;
    async function poll() {
      if (inflight.current) return;
      const epoch = mutationEpoch.current;
      try {
        const result = await request('/recorder/status');
        if (!disposed && epoch === mutationEpoch.current) { setState(result); setConnectionError(''); }
      } catch (err) {
        if (!disposed) setConnectionError(err.status === 404 ? 'Restart the backend to enable browser recording, then refresh this page.' : 'The recorder status is unavailable. Keep the backend running and refresh this page.');
      } finally { if (!disposed) setLoading(false); }
    }
    void poll();
    const timer = setInterval(poll, 1500);
    return () => { disposed = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialog.current?.focus();
    const keydown = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const targets = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(el => el.getClientRects().length);
        const first = targets[0]; const last = targets[targets.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open]);

  async function command(action, body = {}) {
    if (inflight.current) return;
    inflight.current = true; mutationEpoch.current++; setRequesting(true); setError('');
    let prepared = false;
    try { if(action === 'start') { await voice.prepare(); prepared = true; } setState(await mutate(`/recorder/${action}`, body)); setConnectionError(''); }
    catch (err) { if(prepared) await voice.cancel(); setError(err.status === 404 ? 'Restart the backend to load the browser recorder.' : err.message); }
    finally { mutationEpoch.current++; inflight.current = false; setRequesting(false); }
  }
  async function downloadRemote() {
    setRequesting(true); setError('');
    try {
      const blob = await request('/remote-recorder/download', { blob: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'sop-remote-recorder.zip';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(e.message); }
    finally { setRequesting(false); }
  }
  function narrationControls() { return <>{voice.status !== 'idle' && <div className="narration-capture"><strong>{voice.status === 'requesting' ? 'Waiting for microphone permission...' : voice.status === 'recording' ? (voice.muted || state.phase !== 'recording' ? 'Microphone muted' : 'Microphone recording') : voice.status === 'saving' ? 'Saving narration...' : voice.status === 'pending' ? 'Audio waiting to save' : 'Narration saved'}</strong>{voice.status === 'recording' && <button className="secondary small" onClick={() => voice.setMuted(!voice.muted)}>{voice.muted ? 'Unmute microphone' : 'Mute microphone'}</button>}{voice.pending && <button className="secondary small" disabled={active || voice.status === 'saving'} onClick={voice.upload}>Retry saving narration</button>}{voice.pending && !active && voice.status !== 'saving' && <><button className="text-button" onClick={voice.downloadPending}>Download audio backup</button><button className="text-button danger" onClick={() => { if(window.confirm('Discard the local narration backup? Download it first if you want to keep it.')) void voice.cancel(); }}>Discard local audio</button></>}</div>}{voice.error && <p role="alert" className="error">{voice.error}</p>}</>; }
  function start(event) { event.preventDefault(); void command('start', { title: title.trim(), mode, recording_context: recordingContext.trim() }); }
  function review() { setReviewedWorkflow(state.workflow_id); onClose(); onReview(state.workflow_id); }

  function controls() {
    return <div className="recorder-actions">
      {['recording', 'paused'].includes(state.phase) && <>
        <button className="secondary" disabled={busy} onClick={() => command(state.phase === 'paused' ? 'resume' : 'pause')}>
          {state.phase === 'paused' ? <Play size={16} /> : <Pause size={16} />}{state.phase === 'paused' ? 'Resume recording' : 'Pause recording'}
        </button>
        <button className="primary" disabled={busy} onClick={() => command('stop')}><Square size={15} /> Stop & review</button>
      </>}
      {state.recoverable && <button className="primary" disabled={busy} onClick={() => command('recover')}><RotateCcw size={16} /> Recover saved steps</button>}
      {state.phase === 'done' && state.workflow_id && <button className="primary" disabled={busy || voice.pending || voice.status === 'saving'} onClick={review}>Review recording <ArrowRight size={16} /></button>}
      {busyPhases.has(state.phase) && <span className="recorder-working"><Loader2 className="spin" size={17} />{statusLabel}</span>}
      {state.pending > 0 && ['recording', 'paused'].includes(state.phase) && <button className="text-button" disabled={busy} onClick={() => command('retry')}>Retry sync</button>}
    </div>;
  }

  return <>
    {!open && (active || state.recoverable || (state.phase === 'done' && state.workflow_id !== reviewedWorkflow)) && <div className="recorder-bar" aria-label={state.mode === 'desktop' ? 'Desktop recorder controls' : `${browserName} recorder controls`}>
      <div><span className={`recorder-dot ${state.phase === 'recording' ? 'live' : ''}`} /><strong>{statusLabel}</strong><small>{state.count} steps{state.pending ? ` · ${state.pending} waiting to sync` : ''}</small></div>
      {controls()}
      {narrationControls()}
      {(state.error || connectionError) && <p role="alert">{connectionError || state.error}</p>}
      {state.download_error && <p role="alert">{state.download_error}</p>}
    </div>}
    {open && <div className="modal-backdrop" onClick={onClose}>
      <section className="modal recorder-modal" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="recorder-title" onClick={event => event.stopPropagation()}>
        <button className="icon-button close" aria-label="Close recording setup" onClick={onClose}><X /></button>
        <span className="feature-icon"><Monitor /></span>
        <span className="recorder-mode">NO EXTENSION REQUIRED</span>
        <h2 id="recorder-title">{desktop ? 'Record your whole desktop' : `Record in ${browserName}`}</h2>
        <p>{desktop ? 'Capture a task across Windows apps and all your monitors.' : "Open a dedicated browser for your task. We'll capture the steps as you work across its tabs."}</p>
        {connectionError && <p role="alert" className="error">{connectionError}</p>}
        {(error || state.error) && <p role="alert" className="error">{error || state.error}</p>}
        {state.download_error && <p role="alert" className="error">{state.download_error}</p>}
        {loading && <p className="recorder-working"><Loader2 className="spin" size={17} />Checking the recorder…</p>}
        {canStart && <div className="recording-mode-choice" role="group" aria-label="Recording mode">
          <button className="secondary" type="button" aria-pressed={!desktop} onClick={() => setMode('browser')}>Browser tabs</button>
          <button className="secondary" type="button" aria-pressed={desktop} onClick={() => setMode('desktop')}>Whole desktop</button>
        </div>}
        {canStart && <form className="recorder-form" onSubmit={start}>
          <label htmlFor="recording-name">Workflow name</label>
          <input id="recording-name" value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Add a new teammate" maxLength={200} required disabled={busy} />
          <label htmlFor="recording-context">Describe the workflow you’re recording <span>(optional)</span></label>
          <textarea id="recording-context" rows={3} maxLength={2000} value={recordingContext} onChange={event => setRecordingContext(event.target.value)} disabled={busy} aria-describedby="recording-context-hint" placeholder="Example: Raise a ticket for Claude access in One Connect, from opening the portal to receiving a ticket number." />
          <p id="recording-context-hint" className="hint">Tell us what you want to accomplish. OpenAI uses this context with your recorded actions and screenshots when you improve the SOP.</p>
          {desktop ? <p className="hint desktop-capture-note">Starts after 3 seconds and captures all monitors. Typed text is captured from supported editable fields and added to your SOP. Password fields are excluded; review any text that could not be captured. Screenshots show visible content, including private information; use the floating Pause control before handling it.</p> : <p className="hint">{browserName} opens on a blank tab. Use its address bar to visit your website and begin your task. Return here to pause or stop.</p>}
          <label className="narration-choice"><input type="checkbox" checked={voice.enabled} onChange={e => voice.setEnabled(e.target.checked)} disabled={busy || !voice.supported || voice.pending} />Record voice narration</label>
          <p className="hint">Narrate the current action, perform it, then say <strong>Next step</strong>. Audio is saved locally and sent to OpenAI after stopping for transcription and comparison. Keep this dashboard tab open. Mute before speaking private information. Pausing screen recording also mutes the microphone.</p>
          {!voice.supported && <p className="hint">Open this dashboard in Edge or Chrome using localhost or HTTPS to enable microphone recording.</p>}
          {narrationControls()}
          <button className="primary wide" disabled={busy || voice.pending || !modeAvailable || !title.trim()}>
            {requesting ? <Loader2 className="spin" size={17} /> : <Play size={17} />}{desktop ? 'Start desktop recording' : `Launch ${browserName} & record`}
          </button>
          {!modeAvailable && <p className="error">{desktop ? 'Whole-desktop recording requires an interactive Windows session and Python with Tkinter.' : <>Recorder dependencies are missing. Install Node.js and run <code>npm.cmd ci</code> inside <code>frontend</code>.</>}</p>}
        </form>}
        {(active || state.recoverable || state.phase === 'done') && <section className="recorder-session">
          <span className="recorder-session-label">{statusLabel}</span>
          <h3>{state.title}</h3>
          <div className="recorder-metrics"><span><strong>{state.count}</strong> captured steps</span><span><strong>{state.pending}</strong> waiting to sync</span></div>
          {controls()}
          {narrationControls()}
          {active && <p className="hint">{state.mode === 'desktop' ? 'Use the floating controls to pause or stop. Stop saves your steps and leaves your apps open.' : 'Recording continues when you close this panel. Stop finishes saving and closes the recorder window.'}</p>}
        </section>}
        <div className="notice"><Check size={18} /><span>Review and edit every step before PDF or Word export. {configured ? 'OpenAI text cleanup is configured.' : 'Manual editing works without OpenAI.'}</span></div>
        <details className="extension-alternative">
          <summary>Record inside Remote Desktop (RDP)</summary>
          <p>Download this recorder and run it inside the remote Windows session to capture actual app controls. It sends steps to this dashboard.</p>
          <ol><li>Extract the ZIP on the remote machine. With Python installed, run <code>setup-remote-recorder.cmd</code>.</li><li>Run <code>start-remote-recorder.cmd</code>. Enter a reachable HTTPS backend address (or localhost through an approved tunnel), your dashboard session token, and a workflow name.</li><li>Start and stop using the remote recorder controls, then refresh your workflow library here.</li></ol>
          <p>Read the included connection guide. This dashboard's localhost address cannot be used directly from another computer.</p>
          <button className="secondary" disabled={busy} onClick={downloadRemote}>Download remote recorder</button>
        </details>
        <details className="extension-alternative" open={extensionGuide} onToggle={event => setExtensionGuide(event.currentTarget.open)}>
          <summary><Film size={14} /> Optional: use an approved browser extension</summary>
          <p>If your browser permits extensions, load the project's <code>extension</code> folder from its extensions page. Connect it to your local backend using your session token, then record using the extension controls.</p>
        </details>
      </section>
    </div>}
  </>;
}
