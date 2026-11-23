import { useEffect, useRef, useState } from 'react';
import { mutate, request } from './api';

function draftStore(mode, action) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('sop-narration', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('drafts');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result; const tx = db.transaction('drafts', mode);
      const result = action(tx.objectStore('drafts'));
      tx.oncomplete = () => { resolve(result?.result); db.close(); };
      tx.onerror = () => { reject(tx.error); db.close(); };
    };
  });
}
const saveDraft = draft => draftStore('readwrite', store => store.put(draft, 'current'));
const clearDraft = () => draftStore('readwrite', store => store.delete('current'));

export function useNarration(recorderState) {
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const session = useRef(null);
  const media = useRef(null);
  const stream = useRef(null);
  const saving = useRef(false);
  const saveQueue = useRef(Promise.resolve());
  const stateRef = useRef(recorderState); stateRef.current = recorderState;
  const supported = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'));
  function persist() {
    if (!session.current) return;
    const copy = {...session.current, chunks: [...session.current.chunks]};
    saveQueue.current = saveQueue.current.then(() => saveDraft(copy)).catch(() => setError('Local audio backup failed. Keep this dashboard open until audio is saved.'));
  }
  useEffect(() => {
    let gone = false;
    draftStore('readonly', store => store.get('current')).then(draft => {
      if (!gone && draft?.chunks?.length) {
        session.current = draft; setPending(true); setStatus('pending');
        setError('Recovered microphone audio. Finish recovering the screen recording, then retry saving narration.');
      }
    }).catch(() => setError('Local audio recovery is unavailable in this browser.'));
    return () => { gone = true; media.current?.state !== 'inactive' && media.current?.stop(); stream.current?.getTracks().forEach(t => t.stop()); };
  }, []);
  useEffect(() => {
    const warn = event => { if (media.current?.state === 'recording' || pending) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  async function prepare() {
    if (!enabled) return;
    if (session.current) throw Error('Save the pending narration before starting a new recording.');
    if (!supported) throw Error('Microphone narration requires an Edge or Chrome dashboard on localhost or HTTPS.');
    setError(''); setMuted(false); setStatus('requesting');
    try {
      let expired=false;let timer;
      const permission=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      permission.then(value=>{if(expired)value.getTracks().forEach(t=>t.stop());}).catch(()=>{});
      try {
        stream.current=await Promise.race([permission,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('Microphone permission timed out'));},30000);})]);
      } finally {clearTimeout(timer);}
      stream.current.getAudioTracks().forEach(t => { t.enabled = false; t.onended = () => {
        setError('Microphone disconnected. Captured audio will be saved; later actions may have no narration.'); finish();
      }; });
      const recorder = new MediaRecorder(stream.current,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:24000});
      media.current = recorder;
      session.current = {startedAt:new Date().toISOString(), endAt:Date.now(), workflowId:null, chunks:[], bytes:0};
      recorder.ondataavailable = event => {
        if (!event.data.size || !session.current) return;
        session.current.chunks.push(event.data); session.current.bytes += event.data.size; session.current.endAt = Date.now(); persist();
        if(session.current.bytes > 23_000_000 && recorder.state === 'recording') {
          setError('Microphone recording reached its size limit. Audio was stopped; screen recording can continue.'); finish();
        }
      };
      recorder.onstop = () => { stream.current?.getTracks().forEach(t => {t.onended=null;t.stop();}); setPending(true); setStatus('pending'); };
      recorder.onerror = () => { setError('Microphone recording failed. Available audio is retained for recovery.'); finish(); };
      recorder.start(5000); setStatus('recording');
    } catch (e) {
      stream.current?.getTracks().forEach(t=>t.stop()); media.current=null; session.current=null; setStatus('idle');
      throw Error('Microphone access failed. Allow microphone access or turn off voice narration and try again.');
    }
  }
  function finish() {
    if (media.current?.state === 'recording') media.current.stop();
  }
  async function cancel() {
    const recorder=media.current;
    if(recorder){recorder.onstop=null;recorder.ondataavailable=null;if(recorder.state!=='inactive')recorder.stop();}
    stream.current?.getTracks().forEach(t=>{t.onended=null;t.stop();});
    media.current=null;session.current=null;await saveQueue.current;await clearDraft();setPending(false);setStatus('idle');
  }
  async function upload() {
    const draft=session.current;
    if(!draft?.workflowId || !draft.chunks.length || saving.current)return;
    saving.current=true;setStatus('saving');setError('');
    try {
      await saveQueue.current;
      const duration=Math.max(.01,(draft.endAt-Date.parse(draft.startedAt))/1000);
      const workflow=await request(`/workflows/${draft.workflowId}/narration/audio?started_at=${encodeURIComponent(draft.startedAt)}&duration=${duration}`,{
        method:'POST',headers:{'Content-Type':'audio/webm'},body:new Blob(draft.chunks,{type:'audio/webm'})});
      await clearDraft();session.current=null;setPending(false);
      try {await mutate(`/workflows/${draft.workflowId}/narration/process`,{version:workflow.version});}
      catch(e){setError(`${e.message} Open the workflow's Voice narration panel to retry.`);}
      setStatus('saved');
    }catch(e){setError(e.message);setStatus('pending');}
    finally{saving.current=false;}
  }
  useEffect(()=>{
    const draft=session.current;
    if(!draft)return;
    if(media.current?.state==='recording'&&!draft.workflowId&&recorderState.workflow_id&&['starting','recording','paused','stopping'].includes(recorderState.phase)){
      draft.workflowId=recorderState.workflow_id;persist();
    }
    const allowed=recorderState.phase==='recording'&&!muted;
    stream.current?.getAudioTracks().forEach(t=>{t.enabled=allowed;});
    if(['stopping','done','error','interrupted'].includes(recorderState.phase))finish();
    if(pending&&recorderState.phase==='done'&&draft.workflowId===recorderState.workflow_id)void upload();
  },[recorderState.phase,recorderState.workflow_id,muted,pending]);
  function downloadPending() {
    const draft=session.current;if(!draft?.chunks.length)return;
    const url=URL.createObjectURL(new Blob(draft.chunks,{type:'audio/webm'}));
    const link=document.createElement('a');link.href=url;link.download='narration-recovery.webm';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  return {downloadPending,enabled,setEnabled,muted,setMuted,status,error,pending,supported,prepare,cancel,finish,upload};
}
