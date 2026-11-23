import React, { useCallback, useEffect, useState } from 'react';
import { mutate, request } from './api';

function Segment({segment, index, workflow, disabled, run, onDirty}) {
  const [text,setText]=useState(segment.transcript);
  const [ids,setIds]=useState(segment.step_ids);
  const [confirmed,setConfirmed]=useState(false);
  const savedIds = JSON.stringify(segment.step_ids);
  useEffect(()=>{setText(segment.transcript);setIds(segment.step_ids);setConfirmed(false);},[segment.transcript,savedIds,segment.confirmed]);
  const dirty=text!==segment.transcript||JSON.stringify(ids)!==JSON.stringify(segment.step_ids);
  useEffect(()=>{onDirty(segment.id,dirty);return()=>onDirty(segment.id,false);},[segment.id,dirty,onDirty]);
  const assigned=new Set(workflow.narration.segments.filter(s=>s.id!==segment.id).flatMap(s=>s.step_ids));
  const comparison=segment.comparison;
  const base=`/workflows/${workflow.id}/narration/segments/${segment.id}`;
  const time=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
  return <section className="narration-segment">
    <h3>Narrated step {index+1} <small>{time(segment.start)} - {time(segment.end)}</small></h3>
    <label>Transcript<textarea aria-label={`Narration ${index+1} transcript`} value={text} maxLength={12000} rows={3} disabled={disabled} onChange={e=>{setText(e.target.value);setConfirmed(false);}} /></label>
    <details><summary>Captured actions ({ids.length}) - adjust assignment</summary>
      {workflow.steps.map((s,i)=><label className="narration-choice" key={s.id}><input type="checkbox" checked={ids.includes(s.id)} disabled={disabled||assigned.has(s.id)} onChange={e=>{setIds(e.target.checked?[...ids,s.id]:ids.filter(id=>id!==s.id));setConfirmed(false);}} />Step {i+1}: {s.description}{assigned.has(s.id)?' (assigned elsewhere)':''}</label>)}
    </details>
    <p className="narration-actions-list">{workflow.steps.filter(s=>ids.includes(s.id)).map(s=>`${s.action}: ${s.label || s.page_title || 'Unidentified target'}${s.sensitive?' (private)':s.value?` | Recorded value: ${s.value}`:''}`).join('; ') || 'No captured actions assigned.'}</p>
    {dirty?<button className="secondary small" disabled={disabled} onClick={()=>run(()=>mutate(base,{version:workflow.version,transcript:text,step_ids:ids},'PATCH'))}>Save transcript and assignment</button>:<button className="secondary small" disabled={disabled} onClick={()=>run(()=>mutate(`/workflows/${workflow.id}/narration/process`,{version:workflow.version,segment_id:segment.id}))}>Compare this narrated step</button>}
    {comparison&&!dirty&&<>
      <div className={`narration-result ${comparison.status}`}><strong>{comparison.status==='matched'?'Matched':comparison.status==='mismatch'?'Mismatch':'Needs review'} (AI comparison)</strong><p>{comparison.reason}</p></div>
      {comparison.suggestions.map(s=><div className="narration-suggestion" key={s.step_id}><strong>Step {workflow.steps.findIndex(step=>step.id===s.step_id)+1}: {s.description}</strong>{[['purpose','Purpose'],['expected_result','Expected result'],['validation','Validation'],['notes','Notes']].map(([key,label])=>s[key]&&<p key={key}><b>{label}:</b> {s[key]}</p>)}</div>)}
      {segment.confirmed?<p className="notice">Narration reviewed. Verify any updated SOP instructions below.</p>:<>
        <label className="narration-choice"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={disabled} />I checked the narration against the captured actions and screenshots, including any differences.</label>
        <button className="primary small" disabled={disabled||!confirmed||!comparison.suggestions.length} onClick={()=>run(()=>mutate(base+'/accept',{version:workflow.version,apply_suggestions:true}))}>Use reviewed suggestions</button>
      </>}
    </>}
  </section>;
}

export function NarrationReview({workflow, disabled, onUpdate, onError, onDirty}) {
  const voice=workflow.narration;
  const [busy,setBusy]=useState(false);
  const [dirtySegments,setDirtySegments]=useState(new Set());
  const markDirty=useCallback((id,dirty)=>setDirtySegments(previous=>{if(previous.has(id)===dirty)return previous;const next=new Set(previous);dirty?next.add(id):next.delete(id);return next;}),[]);
  useEffect(()=>{onDirty?.(dirtySegments.size>0);return()=>onDirty?.(false);},[dirtySegments.size,onDirty]);
  const [audio,setAudio]=useState('');
  useEffect(()=>{
    setAudio(''); if(!voice)return;
    let gone=false;let objectUrl;
    request(`/workflows/${workflow.id}/narration/audio`,{blob:true}).then(blob=>{
      objectUrl=URL.createObjectURL(blob);if(!gone)setAudio(objectUrl);else URL.revokeObjectURL(objectUrl);
    }).catch(()=>{});
    return()=>{gone=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[workflow.id,Boolean(voice)]);
  useEffect(()=>{
    if(voice?.status!=='processing')return;
    let gone=false;
    const timer=setInterval(()=>request(`/workflows/${workflow.id}`).then(w=>{if(!gone)onUpdate(w);}).catch(e=>{if(!gone)onError(e.message);}),2000);
    return()=>{gone=true;clearInterval(timer);};
  },[workflow.id,voice?.status,onUpdate,onError]);
  if(!voice)return null;
  const processing=voice.status==='processing';
  async function run(fn){setBusy(true);try{onUpdate(await fn());}catch(e){onError(e.message);}finally{setBusy(false);}}
  const assigned=new Set(voice.segments.flatMap(s=>s.step_ids));
  return <details className="narration-review" open>
    <summary>Voice narration</summary>
    <p>Say "Next step" after each action. These spoken boundaries group the narration and recorded actions. Check the transcript, action assignment and screenshots before using suggestions. Matching an action does not prove its outcome.</p>
    {audio&&<audio controls src={audio} preload="metadata" aria-label="Recorded narration" />}
    {voice.error&&<p role="alert" className="error">{voice.error}</p>}
    {processing?<p role="status">{voice.total?`Comparing narrated steps: ${voice.progress} of ${voice.total}`:'Transcribing and finding spoken step boundaries...'}</p>:<button className="secondary small" disabled={disabled||busy||dirtySegments.size>0} onClick={()=>run(()=>mutate(`/workflows/${workflow.id}/narration/process`,{version:workflow.version}))}>{voice.transcribed?'Compare unreviewed narration':'Transcribe and compare narration'}</button>}
    {voice.transcribed&&!voice.segments.length&&<p>No speech or actions were found within the audio timeline. Review the recording manually.</p>}
    {voice.transcribed&&workflow.steps.some(s=>!assigned.has(s.id))&&<p className="notice">Some captured actions fall outside the narration timeline. Assign them to a narrated step or review them manually.</p>}
    {voice.segments.map((s,i)=><Segment key={s.id} segment={s} index={i} workflow={workflow} disabled={disabled||busy||processing||(dirtySegments.size>0&&!dirtySegments.has(s.id))} run={run} onDirty={markDirty} />)}
  </details>;
}
