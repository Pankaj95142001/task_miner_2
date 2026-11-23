import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, Check, FileText, Layers, Trash2 } from 'lucide-react';
import { request } from './api';

function Cover({ workflow }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState('');
  const stepId = workflow.preview?.step_id;
  const phase = workflow.preview?.phase;
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '160px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setUrl('');
    if (!visible || !stepId) return;
    const controller = new AbortController();
    let objectUrl;
    request(`/workflows/${workflow.id}/steps/${stepId}/screenshots/${phase}`, { blob: true, signal: controller.signal })
      .then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }).catch(() => { /* Keep the illustrated cover if a screenshot is unavailable. */ });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [visible, workflow.id, stepId, phase]);
  return <div ref={ref} className={`guide-cover ${url ? 'has-image' : ''}`} aria-hidden="true">
    {url ? <img src={url} alt="" onError={() => setUrl('')} /> : <div className="guide-paper">
      <span className="guide-paper-icon"><FileText size={21} /></span>
      <span className="guide-paper-line title" />
      {[1, 2, 3].map(n => <span className="guide-paper-step" key={n}><i>{n}</i><span /></span>)}
      <span className="guide-paper-seal"><Check size={15} /></span>
    </div>}
    <span className="guide-cover-label"><BookOpen size={12} /> SOP GUIDE</span>
    <span className="guide-cover-open"><ArrowUpRight size={19} /></span>
  </div>;
}

export function WorkflowCard({ workflow: w, onOpen, onDelete, status }) {
  const total = Number(w.step_count) || 0;
  const reviewed = Math.min(total, Math.max(0, Number(w.reviewed_count) || 0));
  const ready = total > 0 && reviewed === total && w.status !== 'recording';
  const tone = [...w.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  return <article className={`workflow-card-shell guide-tone-${tone}`}>
    <button className="workflow-card" onClick={() => onOpen(w.id)}>
      <Cover workflow={w} />
      <div className="guide-card-body">
        <div className="guide-card-status">{status}<span><Layers size={13} />{total} {total === 1 ? 'step' : 'steps'}</span></div>
        <h3 title={w.title}>{w.title}</h3>
        <p className="guide-description">{w.description || w.purpose || 'Turn your captured steps into a guide worth sharing.'}</p>
        <div className="guide-review"><span>{ready ? 'All steps verified' : w.status === 'recording' ? 'Capturing your workflow' : 'Review progress'}</span><strong>{reviewed}/{total}</strong></div>
        <div className="guide-review-track" aria-hidden="true"><span style={{ width: `${total ? reviewed / total * 100 : 0}%` }} /></div>
        <div className="guide-card-footer"><span>Updated {new Date(w.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span className="guide-open">Open guide <ArrowUpRight size={14} /></span></div>
      </div>
    </button>
    <button className="workflow-delete-button text-button danger" aria-label={`Delete workflow ${w.title}`} title={w.status === 'recording' ? 'Stop recording before deleting' : 'Permanently delete workflow'} disabled={w.status === 'recording'} onClick={() => onDelete(w)}><Trash2 size={14} /><span>Delete</span></button>
  </article>;
}
