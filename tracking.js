/* Append-only event outbox. Each event carries a complete assessment snapshot.
   Gameplay never waits on the network. Codes are labels, not verified identities. */
window.ALA = (() => {
  let current=null, queue=[], busy=false, storageOK=true, lastError=false;
  const key='ala-outbox-v1';
  try { queue=JSON.parse(sessionStorage.getItem(key)||'[]'); if(!Array.isArray(queue))queue=[]; } catch(_){storageOK=false;}
  const uuid=()=>crypto.randomUUID();
  const now=()=>new Date().toISOString();
  function status() {
    const el=document.getElementById('trackingStatus'); if(!el)return;
    el.textContent=!ALACloud.configured?'Practice only: database not configured. Activity stays in this tab.':
      lastError?'Not saved yet. Keep this tab open and retry saving.':
      queue.length?'Saving practice activity… '+queue.length+' pending.':'Practice activity saved.';
    if(!storageOK)el.textContent+=' Tab recovery unavailable; copy your summary before closing.';
    const retry=document.getElementById('retryTracking'); if(retry)retry.hidden=!queue.length;
  }
  function persist(){try{sessionStorage.setItem(key,JSON.stringify(queue));}catch(_){storageOK=false;}status();}
  async function flush() {
    if(busy||!ALACloud.configured||!queue.length){status();return;}
    busy=true;
    try {
      const auth=await ALACloud.auth('student');
      while(queue.length){
        await ALACloud.request('/rest/v1/rpc/ala_ingest',{event:queue[0]},auth.access_token);
        queue.shift();lastError=false;persist();
      }
    } catch(_){lastError=true;status();} finally {busy=false;}
  }
  function emit(type) {
    if(!current)return;
    current.revision++;
    const event={id:uuid(),session_id:current.id,revision:current.revision,type,occurred_at:now(),snapshot:structuredClone(current)};
    queue.push(event);persist();void flush();
  }
  const item=()=>current?.problems.at(-1);
  function safe(fn){return (...args)=>{try{return fn(...args);}catch(_){lastError=true;status();}};}
  addEventListener('online',()=>void flush());
  addEventListener('pagehide',()=>{if(current&&!current.ended_at){current.status='interrupted';emit('session_interrupted');}});
  addEventListener('pageshow',()=>{if(current&&current.status==='interrupted'){current.status='active';emit('session_resumed');}void flush();});
  addEventListener('DOMContentLoaded',()=>{status();void flush();});
  setInterval(()=>{if(lastError)void flush();},30000);
  return {
    start:safe((codes,level,total)=>{current={id:uuid(),revision:0,class_code:codes.classCode,student_code:codes.studentCode,
      level,total_ports:total,started_at:now(),ended_at:null,status:'active',problems:[],arcade_score:0,ports_cleared:0,game_version:'ala-tracking-1'};emit('session_started');}),
    problem:safe((q,port)=>{if(!current)return;current.problems.push({id:uuid(),port,skill:q.kind,prompt:q.prompt,mode:q.mode,
      expected:q.mode==='expression'?{a:q.expectedA,b:q.expectedB}:{x:q.n},presented_at:now(),attempts:[],hints:0,solution_views:0,
      first_try_correct:null,independent_first_try:null,solved_at:null,arcade_started_at:null,port_completed_at:null});emit('problem_presented');}),
    answer:safe((answer,correct)=>{const p=item();if(!p||p.solved_at)return;p.attempts.push({number:p.attempts.length+1,answer,correct,submitted_at:now(),hints_before:p.hints,solution_views_before:p.solution_views});
      if(p.attempts.length===1){p.first_try_correct=correct;p.independent_first_try=correct&&p.hints===0&&p.solution_views===0;}
      if(correct)p.solved_at=now();emit(correct?'problem_solved':'answer_submitted');}),
    hint:safe(()=>{if(item()){item().hints++;emit('hint_used');}}),
    reveal:safe(()=>{if(item()){item().solution_views++;emit('solution_revealed');}}),
    arcadeStart:safe(()=>{if(item()){item().arcade_started_at=now();emit('arcade_started');}}),
    portComplete:safe((reason,r)=>{const p=item();if(!p||p.port_completed_at)return;p.port_completed_at=now();p.arcade={reason,gems:r.collected,points:r.earned,moves_remaining:r.moves};current.ports_cleared++;current.arcade_score+=r.earned;emit('port_completed');}),
    end:safe((reason,score,cleared)=>{if(!current||current.ended_at)return;current.status=reason;current.ended_at=now();current.arcade_score=score;current.ports_cleared=cleared;emit('session_ended');}),
    retry:()=>void flush()
  };
})();
