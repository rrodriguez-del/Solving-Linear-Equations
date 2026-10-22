'use strict';
const $=id=>document.getElementById(id);
let generation=0;
const names={distribute:'Distributive property',combine:'Combining like terms',multi:'Multi-step equations',both:'Variables on both sides'};
const message=t=>{$('status').textContent=t;};
function row(target,values){const tr=document.createElement('tr');for(const v of values){const td=document.createElement('td');td.textContent=String(v);tr.append(td);}$(target).append(tr);}
const ratio=(n,d)=>d?`${n} / ${d} (${Math.round(100*n/d)}%)`:'—';
function summarize(ps){const submitted=ps.filter(p=>p.attempts.length);return {submitted:submitted.length,first:submitted.filter(p=>p.first_try_correct).length,independent:submitted.filter(p=>p.independent_first_try).length,solved:ps.filter(p=>p.solved_at).length,hints:ps.reduce((n,p)=>n+p.hints,0),views:ps.reduce((n,p)=>n+p.solution_views,0)};}
async function loadClasses(){const a=await ALACloud.auth('teacher');const classes=await ALACloud.request('/rest/v1/ala_classes?select=code&order=code',undefined,a.access_token,'GET');$('class').replaceChildren();for(const c of classes){const o=document.createElement('option');o.value=o.textContent=c.code;$('class').append(o);}$('login').hidden=true;$('dashboard').hidden=false;if(!classes.length){message('Signed in. No classes assigned to this teacher account.');return;}await load();}
async function load(){const mine=++generation;const code=$('class').value;message('Loading practice evidence…');try{const a=await ALACloud.auth('teacher');let rows=[],offset=0;while(true){const page=await ALACloud.request('/rest/v1/ala_sessions?select=id,snapshot&class_code=eq.'+encodeURIComponent(code)+'&order=id&limit=500&offset='+offset,undefined,a.access_token,'GET');rows.push(...page);if(page.length<500)break;offset+=500;}if(mine!==generation)return;
for(const id of ['skills','students','sessions'])$(id).replaceChildren();
const snapshots=rows.map(r=>r.snapshot),ps=snapshots.flatMap(s=>s.problems);const submitted=ps.filter(p=>p.attempts.length).length;
$('totals').textContent=`${new Set(snapshots.map(s=>s.student_code)).size} students with activity · ${rows.length} sessions · ${ps.length} problems presented · ${submitted} with a submitted answer`;
for(const [skill,name] of Object.entries(names)){const items=ps.filter(p=>p.skill===skill),t=summarize(items);row('skills',[name,items.length+' / '+t.submitted,ratio(t.first,t.submitted),ratio(t.independent,t.submitted),ratio(t.solved,items.length),t.hints+' / '+t.views]);}
for(const student of [...new Set(snapshots.map(s=>s.student_code))].sort()){const all=snapshots.filter(s=>s.student_code===student).flatMap(s=>s.problems);for(const [skill,name]of Object.entries(names)){const items=all.filter(p=>p.skill===skill);if(!items.length)continue;const t=summarize(items);row('students',[student,name,t.submitted,ratio(t.first,t.submitted),t.solved+' / '+items.length,t.hints+' / '+t.views]);}}
for(const s of snapshots.sort((a,b)=>b.started_at.localeCompare(a.started_at)))row('sessions',[s.student_code,new Date(s.started_at).toLocaleString(),s.status,s.ports_cleared+' / '+s.total_ports,s.arcade_score]);message('Loaded. First try uses all problems with a valid submission, including unfinished problems. Independent first try also requires no prior hint or solution reveal.');
}catch(_){if(mine===generation)message('Unable to load. Check connection, teacher sign-in, and database setup.');}}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();try{await ALACloud.auth('teacher',{email:$('email').value.trim(),password:$('password').value});$('password').value='';await loadClasses();}catch(_){message('Sign-in failed. Check credentials and project configuration.');}});
$('refresh').addEventListener('click',load);$('class').addEventListener('change',load);
$('logout').addEventListener('click',()=>{generation++;ALACloud.logout();for(const id of ['skills','students','sessions'])$(id).replaceChildren();$('totals').textContent='';$('class').replaceChildren();$('dashboard').hidden=true;$('login').hidden=false;message('Signed out.');});
if(ALACloud.configured)loadClasses().catch(()=>message('Sign in with your teacher account to view assigned classes.'));
