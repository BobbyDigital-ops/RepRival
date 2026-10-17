'use strict';
(function () {
  const PLAN = window.REPQUEST_PROGRAM;
  const STORAGE_KEY = 'repquest-prototype-v01'; // Preserve V0.1 browser history
  const SESSION_ORDER = ['A', 'B', 'C'];
  const MUSCLES = ['Chest','Back','Biceps','Triceps','Side delts','Rear delts','Quads','Hamstrings','Core'];
  const CHOICES = {
    fitness:'Feel fitter & look more toned',
    muscle:'Build muscle',
    strength:'Get stronger',
    endurance:'Improve muscular endurance'
  };
  const defaults = () => ({
    version:1,
    history:[],
    active:null,
    settings:{goal:'muscle',spotlight:'Chest',running:true,focusMovement:'A:low_incline_db_press'},
    next:'A',
    lastSummary:null
  });
  const LEGACY_IDS={incline_press:'low_incline_db_press',flat_press:'flat_db_bench_press',reverse_lunge:'reverse_lunge',incline_curl:'incline_db_curl',pec_fly:'flat_db_pec_fly',lateral_raise:'db_lateral_raise',tricep_extension:'lying_db_triceps_extension',ab_rollout:'ab_rollout',rdl:'db_romanian_deadlift',rear_fly:'chest_supported_rear_fly',hammer_curl:'hammer_curl',goblet_squat:'goblet_squat'};
  const $app = document.querySelector('#app');
  let page = 'home';
  let clock = null;
  let toastUntil = null;
  let state = loadState();
  function loadState(){
    try {
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(raw&&Array.isArray(raw.history)&&raw.settings){
        const out={...defaults(),...raw,settings:{...defaults().settings,...raw.settings}};
        // Older prototype used different exercise identifiers; only remap identical movements.
        const migrateLog=l=>{
          if(LEGACY_IDS[l.exId])l.exId=LEGACY_IDS[l.exId];
          const ex=Object.values(PLAN).flatMap(p=>p.pairs.flatMap(p=>p.exercises)).find(e=>e.id===l.exId);
          if(ex){l.name=ex.name;l.muscle=ex.muscle;}
        };
        out.history.forEach(s=>(s.logs||[]).forEach(migrateLog));
        if(out.active)(out.active.logs||[]).forEach(migrateLog);
        return out;
      }
    } catch(e){console.warn('Could not load saved workouts',e);}
    return defaults();
  }
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){console.warn('Storage unavailable',e);}}
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
  function fmt(n){return Number(n||0).toLocaleString('en-GB',{maximumFractionDigits:1});}
  function allLogs(){return state.history.flatMap(s=>s.logs||[]);}
  function workoutsCount(){return state.history.length;}
  function totalSets(){return allLogs().length;}
  function workoutsUntilCalibration(){return SESSION_ORDER.filter(id=>!state.history.some(s=>s.session===id));}
  function isCalibrated(){return workoutsUntilCalibration().length===0;}
  function athleteIndex(){
    const comparable=allMovements().map(m=>comparableSessions(m)).filter(s=>s.length);
    if(!comparable.length)return {value:null,compared:0,tracked:0};
    const ratios=comparable.map(s=>s.at(-1).performance/Math.max(0.01,s[0].performance));
    // Geometric mean normalises strength/endurance to each movement's own baseline.
    const value=100*Math.exp(ratios.reduce((sum,r)=>sum+Math.log(Math.max(.05,r)),0)/ratios.length);
    return {value:Math.round(value*10)/10,compared:comparable.filter(s=>s.length>=2).length,tracked:comparable.length};
  }
  function fullRound(tasks,index){
    const start=Math.min(Math.max(index,0),tasks.length-1);
    if(!tasks[start])return {start:0,end:-1,items:[],task:null};
    const task=tasks[start];let i=start;
    while(i>0&&tasks[i-1].pair.id===task.pair.id&&tasks[i-1].round===task.round)i--;
    let end=i;
    while(end+1<tasks.length&&tasks[end+1].pair.id===task.pair.id&&tasks[end+1].round===task.round)end++;
    return {start:i,end,items:tasks.slice(i,end+1).map((task,j)=>({...task,index:i+j})),task};
  }
  function bestSet(logs){return logs?.length?logs.reduce((best,l)=>!best||score(l)>score(best)?l:best,null):null;}
  function progressPct(change){return change==null?'Baseline':`${change>0?'+':''}${change.toFixed(1)}%`;}
  function musclePanel(compact=false){
    const focus=state.settings.spotlight;
    const rows=MUSCLES.map(m=>({name:m,data:muscleChange(m)}));
    const shown=compact?rows.filter(x=>x.data).sort((a,b)=>a.name===focus?-1:b.name===focus?1:0).slice(0,5):rows;
    const peak=Math.max(15,...shown.filter(x=>x.data).map(x=>Math.abs(x.data.change)));
    return `${shown.length===0?`<p class="subhead mt16">Your muscle trends appear after your first completed session.</p>`:`<div class="muscle-list">${shown.map(row=>`<div class="muscle-item"><div class="muscle-label"><strong>${esc(row.name)}</strong><span class="${row.data?(row.data.change>0?'positive':row.data.change<0?'negative':''):''}">${row.data?progressPct(row.data.change):'Not started'}</span></div><div class="muscle-track"><span style="width:${row.data?Math.max(row.data.count?5:0,Math.min(100,Math.abs(row.data.change)/peak*100)):0}%"></span></div></div>`).join('')}</div>`}<p class="fineprint">Change in comparable exercise performance since your first completed session — not a measurement of muscle size.</p>`;
  }
  function historyList(limit=6){
    return [...state.history].reverse().slice(0,limit).map(s=>`<div class="session-row"><div><strong>Full Body ${esc(s.session)}</strong><small>${dateText(s.endedAt)} · ${s.logs.length} sets · ${fmt(s.logs.reduce((n,l)=>n+Number(l.weight||0)*l.reps,0))} kg-reps</small></div><button type="button" class="quiet-link" data-action="review-session" data-id="${esc(s.id)}">Review →</button></div>`).join('')||'<p class="muted">No saved workouts yet.</p>';
  }

  function lastSessionOf(id){return [...state.history].reverse().find(s=>s.session===id);}
  function nextLetter(id){return SESSION_ORDER[(SESSION_ORDER.indexOf(id)+1)%3];}
  function planFor(id){return PLAN[id]||PLAN.A;}
  function buildTasks(id){
    const result=[];
    planFor(id).pairs.forEach((pair,pi)=>{
      const rounds=Math.max(...pair.exercises.map(x=>x.sets));
      for(let round=1;round<=rounds;round++){
        pair.exercises.forEach((ex,ei)=>{
          if(round<=ex.sets) result.push({ex,pair,pi,round,rounds,ei,repLabel:`${ex.min}–${ex.max}${ex.suffix?' '+ex.suffix:''}`});
        });
      }
    });
    return result;
  }
  function exerciseLastSet(exId,activeLogs=[]){
    const current=[...activeLogs].reverse().find(l=>l.exId===exId);
    return current||[...allLogs()].reverse().find(l=>l.exId===exId)||null;
  }
  function score(log){
    if(!log||log.reps<=0)return 0;
    if(log.load==='bodyweight'||(log.load==='optional'&&!log.weight))return log.reps;
    // Estimated 1RM is only an approximate ranking signal, not a tested maximum.
    return log.weight*(1+Math.min(log.reps,30)/30);
  }
  function scoreLabel(log){return log.load==='bodyweight'||(log.load==='optional'&&!log.weight)?`${log.reps} reps`:`${fmt(log.weight)} kg × ${log.reps}`;}
  function bestByExercise(logs){
    const result={};
    logs.forEach(l=>{if(!result[l.exId]||score(l)>score(result[l.exId]))result[l.exId]=l;});
    return result;
  }
  function recentExercises(muscle){
    return Object.values(bestByExercise(allLogs())).filter(l=>l.muscle===muscle).sort((a,b)=>score(b)-score(a));
  }
  function calcRest(pair,rir){
    // Evidence-informed range from the user's spreadsheet; no single exact optimum exists.
    if(rir<=1)return pair.restMax;
    if(rir>=3)return pair.restMin;
    return Math.round((pair.restMin+pair.restMax)/2/5)*5;
  }
  function wreathIcon(size='large'){
    return `<svg class="laurel ${size==='small'?'laurel-small':''}" viewBox="0 0 88 88" fill="none" aria-hidden="true">
      <g stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M36 70C16 59 11 35 29 15"/><path d="M52 70c20-11 25-35 7-55"/></g>
      <g fill="currentColor" opacity=".92">
      <ellipse cx="23" cy="60" rx="4.4" ry="8" transform="rotate(-57 23 60)"/><ellipse cx="16" cy="49" rx="4.2" ry="7.8" transform="rotate(-39 16 49)"/><ellipse cx="17" cy="36" rx="4.2" ry="8" transform="rotate(-18 17 36)"/><ellipse cx="23" cy="24" rx="4" ry="7" transform="rotate(16 23 24)"/><ellipse cx="31" cy="17" rx="3.6" ry="6.2" transform="rotate(35 31 17)"/>
      <ellipse cx="65" cy="60" rx="4.4" ry="8" transform="rotate(57 65 60)"/><ellipse cx="72" cy="49" rx="4.2" ry="7.8" transform="rotate(39 72 49)"/><ellipse cx="71" cy="36" rx="4.2" ry="8" transform="rotate(18 71 36)"/><ellipse cx="65" cy="24" rx="4" ry="7" transform="rotate(-16 65 24)"/><ellipse cx="57" cy="17" rx="3.6" ry="6.2" transform="rotate(-35 57 17)"/>
      </g><text x="44" y="49" text-anchor="middle" fill="currentColor" font-weight="1000" font-size="24" letter-spacing="-1">PB</text>
    </svg>`;
  }
  function pbPanel(ex,a){
    const referenceLogs=[...allLogs(),...a.logs.filter((_,i)=>i!==a.taskIndex)];
    const best=bestByExercise(referenceLogs)[ex.id];
    return `<div class="pb-panel ${best?'has-pb':'pending-pb'}" aria-label="Personal best for ${esc(ex.name)}">
      <div class="pb-emblem">${wreathIcon()}</div>
      <div class="pb-copy"><div class="pb-kicker">${best?'PERSONAL BEST TO BEAT':'YOUR PB JOURNEY STARTS HERE'}</div>
      <div class="pb-value">${best?esc(scoreLabel(best)):'First benchmark'}</div>
      <div class="pb-sub">${best?'Beat this effort to unlock a PB celebration.':'Your first logged effort sets your starting record.'}</div></div>
    </div>`;
  }
  let celebrationTimeout=null;
  function celebratePB(ex,log,previous){
    if(typeof document.createElement!=='function')return;
    const old=document.querySelector('.pb-celebration');if(old)old.remove();
    if(celebrationTimeout)clearTimeout(celebrationTimeout);
    const host=document.createElement('div');host.className='pb-celebration';host.setAttribute('role','status');
    host.setAttribute('aria-label','New personal best');
    const confetti=Array.from({length:52},(_,i)=>{
      const x=(i*37+11)%100, delay=(i%9)*0.07,spin=(i%2?'1':'-1');
      return `<i style="--x:${x}%;--delay:${delay}s;--drift:${spin==='1'?'24vw':'-24vw'};--hue:${i%4}"></i>`;
    }).join('');
    host.innerHTML=`<div class="confetti-field" aria-hidden="true">${confetti}</div>
      <div class="pb-toast">${wreathIcon()}<div><div class="pb-toast-title">NEW PERSONAL BEST!</div>
      <div class="pb-toast-movement">${esc(ex.name)}</div><div class="pb-toast-value">${esc(scoreLabel(log))} <span>↑ from ${esc(scoreLabel(previous))}</span></div></div></div>`;
    document.body.appendChild(host);
    celebrationTimeout=setTimeout(()=>host.remove(),3300);
  }
  function card(html,extra=''){return `<section class="card ${extra}">${html}</section>`;}
  function btn(text,action,kind='primary',extra=''){return `<button type="button" class="btn ${kind} ${extra}" data-action="${action}">${text}</button>`;}
  function bar(part,total){return `<div class="meter"><span style="width:${clamp(Math.round(part/Math.max(total,1)*100),0,100)}%"></span></div>`;}
  function miniProgress(n,done){return `<div class="progress-row">${Array.from({length:n},(_,i)=>`<span class="${i<done?'done':i===done?'current':''}"></span>`).join('')}</div>`;}
  function dateText(iso){return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
  function title(){return `<header class="topbar"><span class="brand">RepRival</span><span class="version-chip">PERSONAL PREVIEW · 1.0</span></header>`;}

  function bottomNav(){
    const links=[['home','⌂','Home'],['workout','◫','Workout'],['progress','▥','Progress'],['plan','⚙','My plan']];
    return `<nav class="tabnav" aria-label="Main navigation">${links.map(([id,ico,label])=>`<button type="button" class="${page===id?'active':''}" data-page="${id}" aria-label="${label}"><span class="ico">${ico}</span>${label}</button>`).join('')}</nav>`;
  }

  function shell(body){$app.innerHTML=`<main class="shell">${title()}${body}</main>${page==='workout'&&state.active?'':bottomNav()}<div id="toast" aria-live="polite"></div>`;}
  function allMovements(){
    const x=[];SESSION_ORDER.forEach(day=>planFor(day).pairs.forEach(p=>p.exercises.forEach(e=>x.push({...e,day,key:day+':'+e.id}))));return x;
  }
  function comparableSessions(movement){
    if(!movement)return [];
    return state.history.filter(s=>s.session===movement.day).map(s=>{
      const logs=(s.logs||[]).filter(l=>l.exId===movement.id);
      if(logs.length<movement.sets)return null;
      const used=logs.slice(0,movement.sets);
      const avgLoad=used.reduce((a,l)=>a+Number(l.weight||0),0)/used.length;
      const reps=used.reduce((a,l)=>a+l.reps,0);
      // Same structure as V5 scorecard: mean estimated 1RM per set, or reps/set for BW.
      const performance=used.reduce((a,l)=>a+score(l),0)/used.length;
      return {date:s.endedAt||s.startedAt,sessionId:s.id,reps,load:avgLoad,performance,log:used};
    }).filter(Boolean).sort((a,b)=>new Date(a.date)-new Date(b.date));
  }
  function muscleChange(muscle){
    const rows=allMovements().filter(m=>m.muscle===muscle).map(m=>({m,series:comparableSessions(m)})).filter(x=>x.series.length);
    if(!rows.length)return null;
    const changes=rows.map(x=>x.series.at(-1).performance/Math.max(0.00001,x.series[0].performance)*100-100);
    return {change:changes.reduce((a,b)=>a+b,0)/changes.length,count:rows.length};
  }
  function lastRecordedMovement(movement){return comparableSessions(movement).at(-1);}
  function nextAction(ex,day){
    const result=lastRecordedMovement({...ex,day});
    if(!result)return 'ESTABLISH BASELINE';
    if(result.log.every(l=>l.reps>=ex.max && (l.rir==null||l.rir>=1)))return 'INCREASE WEIGHT';
    if(result.log.some(l=>l.reps<ex.min))return 'REVIEW LOAD';
    return 'BUILD REPS';
  }
  function trainingMetrics(){
    const data=state.history;
    const all=allLogs();
    const vol=all.reduce((a,l)=>a+(Number(l.weight||0)*l.reps),0);
    const rir=all.filter(l=>l.rir!=null);
    return {workouts:data.length,sets:all.length,totalReps:all.reduce((a,l)=>a+l.reps,0),volume:vol,avgRir:rir.length?rir.reduce((a,l)=>a+Number(l.rir),0)/rir.length:null};
  }
  function historyForMovement(exId){return state.history.flatMap(s=>(s.logs||[]).filter(l=>l.exId===exId));}
  function personalBests(exId){
    const entries=historyForMovement(exId);
    if(!entries.length)return null;
    let best=null, previous=null;
    for(const entry of entries){
      if(!best || score(entry)>score(best)+1e-8){previous=best;best=entry;}
    }
    return {best,previous};
  }
  function home(){
    const a=state.active;
    const last=state.history.at(-1);
    const missing=workoutsUntilCalibration();
    const index=athleteIndex();
    const focus=state.settings.spotlight;
    const top=recentExercises(focus).slice(0,2);
    const session=a?.session||state.next;
    const rounds=buildTasks(session).filter((t,i,ts)=>i===0||t.pair.id!==ts[i-1].pair.id||t.round!==ts[i-1].round).length;
    return `<div class="eyebrow">YOUR TRAINING</div><h1 class="page-title">Train with purpose.</h1><p class="lead">A clear plan. Measurable progress. Competition at your level.</p>
      ${card(`<div class="row"><span class="eyebrow">${a?'SESSION IN PROGRESS':'NEXT WORKOUT'}</span><span class="tiny muted">A → B → C</span></div><h2 class="feature-title">Full Body ${session}</h2><p class="subhead">${rounds} guided rounds · ${buildTasks(session).length} working sets · supersets and individual movements</p><div class="mt16">${btn(a?'Resume workout →':'Start workout →','start','primary full')}</div>${a?`<p class="fineprint">Your completed rounds are saved. Pick up where you left off.</p>`:''}`,'hero')}
      <div class="section two-stat"><div class="metric athlete"><div class="eyebrow">ATHLETE SCORE</div><div class="score-number">${index.value==null?'—':fmt(index.value)}</div><div class="stat-detail">${index.value==null?'Start training to establish 100':index.compared?`${index.compared} movements compared with baseline`:`Starting index · ${index.tracked} movements`}</div></div><div class="metric"><div class="eyebrow">WORKOUTS</div><div class="score-number">${workoutsCount()}</div><div class="stat-detail">${state.history.length===0?'Your first one awaits':`${trainingMetrics().sets} sets recorded`}</div></div></div>
      ${card(`<div class="row"><h3>Muscle performance</h3><button class="quiet-link" type="button" data-action="progress">Full analysis →</button></div><p class="subhead">Your logged movement trends at a glance.</p>${musclePanel(true)}`,'section')}
      ${card(`<div class="row"><h3>${esc(focus)} spotlight</h3><span class="label-tag">Priority muscle</span></div>${top.length?top.map(l=>`<div class="spot-movement"><strong>${esc(l.name)}</strong><span>${esc(scoreLabel(l))} · best recorded set</span></div>`).join(''):`<p class="subhead mt12">Your ${esc(focus.toLowerCase())} benchmarks will appear after your first workout.</p>`}<p class="fineprint">You can change your spotlight in My Plan.</p>`,'section')}
      ${card(`<div class="row"><h3>Competition readiness</h3><span class="label-tag">${3-missing.length}/3</span></div><p class="subhead">${missing.length?'Complete your first A, B and C sessions to establish movement baselines.':'Calibration complete. Real leagues will be enabled when online matching is built.'}</p>${bar(3-missing.length,3)}<p class="fineprint">${missing.length?`Remaining: ${missing.join(', ')}`:'No simulated opponents or rankings.'}</p>`,'section')}
      ${card(`<div class="row"><h3>Recent workouts</h3><span class="tiny muted">Saved history</span></div><div class="mt12">${historyList(3)}</div>`,'section')}
      ${state.history.length===0?card(`<h3>Bring in your first session</h3><p class="subhead">Your 17 October Workout A is available from the V5 spreadsheet as 18 individual sets.</p><div class="mt12">${btn('Import my 17 October workout','import-v5','outline full')}</div>`,'section'):''}
    `;
  }

  function startWorkout(){
    if(!state.active){
      state.active={session:state.next,taskIndex:0,logs:[],startedAt:new Date().toISOString(),stage:'lift',restUntil:null,restNote:'',restSeconds:0};save();
    }
    page='workout';render();
  }
  function workout(){
    if(!state.active)return workoutLanding();
    const a=state.active;
    if(a.stage==='feedback')return feedbackView();
    const tasks=buildTasks(a.session);
    const group=fullRound(tasks,a.taskIndex);
    if(!group.items.length)return `<h2>Session ready</h2>${btn('Finish session','feedback','primary full')}`;
    if(a.stage==='rest')return restView(tasks,group.task);
    const task=group.task;
    const roundTotal=task.rounds;
    const pair=task.pair;
    const isSolo=group.items.length===1;
    const done=a.logs.filter(Boolean).length;
    const draft=a.drafts?.[group.start]||{};
    return `<div class="row session-controls"><button type="button" class="quiet-link" data-action="back-round">← Back</button><button type="button" class="quiet-link" data-action="pause">Save & exit</button></div>
      <div class="eyebrow">FULL BODY ${a.session} · ${isSolo?'SINGLE MOVEMENT':`SUPERSET ${esc(pair.id)}`}</div>
      <h1 class="page-title compact">Round ${task.round} <span class="light-text">of ${roundTotal}</span></h1>
      <div aria-label="${done} of ${tasks.length} completed sets">${miniProgress(tasks.length,done)}</div>
      <p class="subhead">${isSolo?'Complete the set below.':`Complete both movements, then record them together.`} ${done}/${tasks.length} sets logged.</p>
      <form id="roundForm" class="section stack">
      ${group.items.map((t,i)=>{
        const ex=t.ex,idx=t.index;
        const prior=a.logs[idx]||exerciseLastSet(ex.id,a.logs.slice(0,group.start));
        const weight=ex.load==='bodyweight'?'0':draft[`weight-${idx}`]??(prior?.weight??'');
        const reps=draft[`reps-${idx}`]??(prior?.reps??ex.min);
        const rir=draft[`rir-${idx}`]??(prior?.rir??2);
        const best=bestByExercise([...allLogs(),...a.logs.slice(0,group.start)])[ex.id];
        return `<section class="movement-entry"><div class="row"><span class="eyebrow">${isSolo?'MOVEMENT':`MOVEMENT ${i+1} OF ${group.items.length}`}</span><span class="label-tag">Set ${t.round} / ${ex.sets}</span></div>
          <h2 class="movement-name">${esc(ex.name)}</h2><p class="subhead">${esc(ex.muscle)} · ${t.repLabel} reps · ${ex.load==='combined'?'combined dumbbell weight':ex.load==='single'?'single dumbbell':ex.load==='bodyweight'?'bodyweight':'optional added load'}</p>
          ${best?`<div class="benchmark">${wreathIcon('small')}<div><span>PERSONAL BEST</span><strong>${esc(scoreLabel(best))}</strong></div></div>`:''}
          <div class="form-grid mt16"><div class="field"><label for="weight-${idx}">Weight (kg)</label><input id="weight-${idx}" name="weight-${idx}" type="number" inputmode="decimal" step="0.5" min="0" ${ex.load==='bodyweight'?'disabled value="0"':`value="${esc(weight)}" placeholder="kg"`} ${ex.load==='bodyweight'||ex.load==='optional'?'':'required'}></div>
          <div class="field"><label for="reps-${idx}">Completed reps</label><input id="reps-${idx}" name="reps-${idx}" type="number" inputmode="numeric" step="1" min="1" max="99" value="${esc(reps)}" required></div></div>
          <div class="rir-row"><span>Reps left in reserve (RIR)</span><div class="rir-options">${[0,1,2,3,4,5].map(n=>`<label><input type="radio" name="rir-${idx}" value="${n}" ${Number(rir)===n?'checked':''}><span>${n===5?'5+':n}</span></label>`).join('')}</div></div>
        </section>`;
      }).join('')}
      <button type="submit" class="btn primary full">${group.items.every(t=>a.logs[t.index])?'Update':'Log'} ${isSolo?'set':'superset round'} →</button>
      </form>
      ${card(`<div class="row"><div><strong>Rest comes next</strong><p class="subhead">${pair.restMin}–${pair.restMax} seconds after this ${isSolo?'set':'pair'}.</p></div><span class="label-tag">Automatic</span></div>`,'section subtle')}
      <div class="section small-actions">${btn('Save & exit','pause','outline')}${btn('Discard workout','discard','text')}</div>
    `;
  }

  function restView(tasks,nextTask){
    const a=state.active;
    const remaining=Math.max(0,Math.ceil((a.restUntil-Date.now())/1000));
    const time=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
    const group=fullRound(tasks,a.taskIndex);
    return `<div class="row session-controls"><button class="quiet-link" type="button" data-action="back-round">← Edit previous round</button><button class="quiet-link" type="button" data-action="pause">Save & exit</button></div>
      <div class="eyebrow">WORKOUT ${a.session} · RECOVERY</div><h1 class="page-title">Rest.</h1><p class="lead">${esc(a.restNote)}</p>
      ${card(`<div class="center"><div class="eyebrow">REST TIMER</div><div class="timer">${time}</div><p class="subhead">${a.restSeconds} seconds recommended · adjust as needed</p>${bar(a.restSeconds-remaining,a.restSeconds)}</div><div class="rest-controls">${btn('+15 seconds','rest-add','outline')}${btn('Skip rest','rest-skip','primary')}</div>`,'section')}
      ${card(`<div class="eyebrow">UP NEXT</div><h2 class="feature-title">${group.items.length===1?esc(group.items[0].ex.name):`Superset ${esc(group.task.pair.id)} · round ${group.task.round}`}</h2><p class="subhead">${group.items.map(t=>esc(t.ex.name)).join(' + ')}</p>`,'section')}
      <div class="section">${btn('Save & exit for later','pause','outline full')}</div>`;
  }

  function feedbackView(){
    const a=state.active;
    if(!a)return '';
    return `<div class="row session-controls"><button type="button" class="quiet-link" data-action="back-round">← Previous round</button><button type="button" class="quiet-link" data-action="pause">Save & exit</button></div>
      <div class="eyebrow">WORKOUT ${a.session}</div><h1 class="page-title">Session complete.</h1><p class="lead">${a.logs.filter(Boolean).length} working sets saved. How did that feel?</p>
      ${card(`<form id="feedbackForm"><div class="radio-row"><label><input type="radio" name="feel" value="fresh"><span>Good</span></label><label><input type="radio" name="feel" value="normal" checked><span>Worked</span></label><label><input type="radio" name="feel" value="tired"><span>Tired</span></label></div><div class="mt16"><button type="submit" class="btn primary full">Finish & review →</button></div></form>`,'section')}`;
  }

  function completeWorkout(feeling){
    const a=state.active;if(!a)return;
    const logs=a.logs.filter(Boolean);
    const old=bestByExercise(allLogs());const newBest=bestByExercise(logs);
    const prs=Object.values(newBest).filter(l=>old[l.exId]&&score(l)>score(old[l.exId])+1e-8)
      .map(l=>({exId:l.exId,name:l.name,muscle:l.muscle,label:scoreLabel(l),old:scoreLabel(old[l.exId])}));
    const recovery=feeling==='tired'?72:48;
    const finished={id:String(Date.now()),session:a.session,startedAt:a.startedAt,endedAt:new Date().toISOString(),logs,feeling,recovery,prs};
    state.history.push(finished);
    state.lastSummary=finished.id;state.next=nextLetter(a.session);state.active=null;
    save();page='summary';render();
  }

  function finishPartial(){
    if(!state.active)return;
    if(state.active.logs.length===0){state.active=null;save();page='home';render();return;}
    if(confirm('End this workout and save the sets completed?')){
      state.active.stage='feedback';save();render();
    }
  }
  function summary(){
    const s=state.history.find(x=>x.id===state.lastSummary)||state.history.at(-1);
    if(!s)return home();
    const groups=[];
    (s.logs||[]).forEach(l=>{let g=groups.find(x=>x.id===l.exId);if(!g){g={id:l.exId,name:l.name,load:l.load,muscle:l.muscle,sets:[]};groups.push(g);}g.sets.push(l);});
    const vol=s.logs.reduce((a,l)=>a+Number(l.weight||0)*l.reps,0);
    const reps=s.logs.reduce((a,l)=>a+l.reps,0);
    const rir=s.logs.filter(l=>l.rir!=null);
    return `<div class="eyebrow">WORKOUT HISTORY · ${dateText(s.endedAt)}</div><h1 class="page-title">Full Body ${esc(s.session)}</h1><p class="lead">Your complete session, set by set.</p>
      <div class="three-stat section"><div class="metric"><strong>${s.logs.length}</strong><span>Working sets</span></div><div class="metric"><strong>${fmt(reps)}</strong><span>Total reps</span></div><div class="metric"><strong>${fmt(vol)}</strong><span>Kg-reps volume</span></div></div>
      ${card(`<div class="row"><h3>Session details</h3><span class="label-tag">${groups.length} movements</span></div><p class="subhead mt12">${rir.length?'Average RIR '+fmt(rir.reduce((n,l)=>n+l.rir,0)/rir.length):'Effort (RIR) not recorded'} · Suggested recovery ${s.recovery||48}h</p>
      ${s.prs?.length?`<div class="section">${s.prs.map(p=>`<div class="benchmark">${wreathIcon('small')}<div><span>NEW PERSONAL BEST · ${esc(p.name)}</span><strong>${esc(p.label)}</strong><small>Previous: ${esc(p.old)}</small></div></div>`).join('')}</div>`:''}`,'section')}
      ${groups.map((g,i)=>card(`<div class="row"><div><div class="eyebrow">MOVEMENT ${i+1}</div><h3 class="mt8">${esc(g.name)}</h3><p class="subhead">${esc(g.muscle)} · ${g.sets.length} sets</p></div><span class="label-tag">${g.load==='bodyweight'?'Bodyweight':'Weighted'}</span></div><div class="set-log mt16">${g.sets.map((l,n)=>`<div class="set-log-row"><span>Set ${n+1}</span><strong>${esc(scoreLabel(l))}</strong><span>${l.rir==null?'—':l.rir+' RIR'}</span></div>`).join('')}</div>`,'section')).join('')}
      <div class="section">${btn('Back to home','home','outline full')}</div>`;
  }

  function drawChart(points){
    if(points.length<2)return `<div class="muted tiny" style="padding:30px 0;text-align:center">After two logged sessions for the same movement, your trend chart will appear here.</div>`;
    const W=550,H=180,left=41,right=13,top=22,bottom=17;
    const vals=points.map(x=>x.value),lo=Math.min(...vals),hi=Math.max(...vals),delta=Math.max(hi-lo,1);
    const coords=points.map((pt,i)=>({x:left+i*(W-left-right)/(points.length-1),y:H-bottom-((pt.value-lo)/delta)*(H-top-bottom),value:pt.value}));
    const line=coords.map((pt,i)=>`${i?'L':'M'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    const area=`${line} L${coords.at(-1).x.toFixed(1)},${H-bottom} L${left},${H-bottom} Z`;
    return `<div class="chart"><div class="chart-latest"><span>FIRST ${fmt(vals[0])}</span><strong>LATEST ${fmt(vals.at(-1))}</strong></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Performance trend, first ${fmt(vals[0])}, latest ${fmt(vals.at(-1))}">
      ${[0,.5,1].map(f=>{const y=top+(H-bottom-top)*f;return `<line x1="${left}" y1="${y}" x2="${W-right}" y2="${y}" stroke="#50607c" stroke-opacity=".45" stroke-dasharray="4 7"/><text x="${left-8}" y="${y+4}" fill="#586f7b" text-anchor="end" font-size="12">${fmt(hi-(hi-lo)*f)}</text>`;}).join('')}
      <path d="${area}" fill="#8ba9b2" fill-opacity=".12"/><path d="${line}" class="chartline"/>
      ${coords.map(pt=>`<circle class="chartdot" r="5.3" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}"><title>${fmt(pt.value)}</title></circle>`).join('')}
      </svg><div class="row tiny muted"><span>${dateText(points[0].date)}</span><span>${dateText(points.at(-1).date)}</span></div></div>`;
  }
  function progress(){
    const stats=trainingMetrics(),index=athleteIndex();
    const movements=allMovements();
    const focus=movements.find(m=>m.key===state.settings.focusMovement)||movements[0];
    const focusSeries=comparableSessions(focus),first=focusSeries[0],last=focusSeries.at(-1);
    const history=state.history;
    const volumeHistory=history.map(s=>({date:s.endedAt,value:(s.logs||[]).reduce((n,l)=>n+Number(l.weight||0)*l.reps,0)}));
    const repsHistory=history.map(s=>({date:s.endedAt,value:(s.logs||[]).reduce((n,l)=>n+l.reps,0)}));
    const rows=movements.map(m=>{const visits=comparableSessions(m);return {...m,visits,first:visits[0],last:visits.at(-1),change:visits.length>1?(visits.at(-1).performance/Math.max(.01,visits[0].performance)-1)*100:null};});
    return `<div class="eyebrow">TRAINING ANALYTICS</div><h1 class="page-title">Progress.</h1><p class="lead">Your performance, records and training trends — without the noise.</p>
      <div class="two-stat section"><div class="metric athlete"><div class="eyebrow">ATHLETE SCORE</div><div class="score-number">${index.value==null?'—':fmt(index.value)}</div><div class="stat-detail">100 = baseline · ${index.compared} repeat-tested movements</div></div><div class="metric"><div class="eyebrow">WORKOUTS</div><div class="score-number">${stats.workouts}</div><div class="stat-detail">${stats.sets} working sets</div></div></div>
      ${card(`<div class="row"><h3>Muscle performance</h3><span class="label-tag">Since baseline</span></div>${musclePanel(false)}`,'section')}
      ${card(`<div class="row"><h3>Movement trends</h3><span class="tiny muted">${focusSeries.length} visits</span></div><div class="field mt16"><label for="movementSelect">Choose a movement</label><select id="movementSelect">${movements.map(m=>`<option value="${esc(m.key)}" ${m.key===focus.key?'selected':''}>${m.day} · ${esc(m.name)}</option>`).join('')}</select></div>
        <div class="movement-detail-summary mt16"><div><span>First completed session</span><strong>${first?esc(scoreLabel(bestSet(first.log))):'—'}</strong></div><div><span>Latest completed session</span><strong>${last?esc(scoreLabel(bestSet(last.log))):'—'}</strong></div></div>
        <div class="mt16"><h3>Estimated performance trend</h3><p class="subhead">Comparable exercise score, calculated from your sets. Not a tested maximum.</p>${drawChart(focusSeries.map(x=>({date:x.date,value:x.performance})))}</div>
        <div class="mt16"><h3>Weight per set</h3>${focus.load==='bodyweight'?'<p class="subhead">Bodyweight movement</p>':drawChart(focusSeries.map(x=>({date:x.date,value:x.load})))}</div>
        <div class="mt16"><h3>Total reps per session</h3>${drawChart(focusSeries.map(x=>({date:x.date,value:x.reps})))}</div>`,'section')}
      ${card(`<div class="row"><h3>Movement scorecard</h3><span class="label-tag">Actual lifts</span></div><p class="subhead">Actual weight and reps are shown. The change percentage estimates overall performance across comparable completed sets.</p>
        <div class="movement-score-list mt16">${rows.map(m=>`<div class="movement-tile"><div class="row"><div><strong>${esc(m.day)} · ${esc(m.name)}</strong><p class="tiny muted">${esc(m.muscle)} · ${m.sets} planned sets · ${m.visits.length} visits</p></div><span class="${m.change==null?'label-tag':m.change>0?'change up':m.change<0?'change down':'change'}">${progressPct(m.change)}</span></div>
          <div class="movement-comparison"><div><span>First</span><strong>${m.first?esc(scoreLabel(bestSet(m.first.log))):'—'}</strong></div><span class="comparison-arrow">→</span><div><span>Latest</span><strong>${m.last?esc(scoreLabel(bestSet(m.last.log))):'—'}</strong></div></div>
          ${m.last?`<div class="best-footnote">All-time PB · ${esc(scoreLabel(personalBests(m.id)?.best||bestSet(m.last.log)))}</div>`:''}</div>`).join('')}</div>`,'section')}
      ${card(`<h3>Training volume</h3><p class="subhead">Session-by-session weighted work, expressed as kg × repetitions.</p>${drawChart(volumeHistory.map(x=>({date:x.date,value:x.value})))}<div class="mt20"><h3>Completed reps</h3>${drawChart(repsHistory.map(x=>({date:x.date,value:x.value})))}</div>`,'section')}
      ${card(`<div class="row"><h3>Workout history</h3><span class="label-tag">${history.length} sessions</span></div><div class="mt12">${historyList(30)}</div>`,'section')}
    `;
  }

  function plan(){
    return `<div class="eyebrow">TRAINING PREFERENCES</div><h1 class="page-title">My plan.</h1><p class="lead">A simple setup that stays out of your way.</p>
      ${card(`<h3>Your focus</h3><p class="subhead">Your choices affect what RepRival highlights. Your current A/B/C programme remains based on the V5 spreadsheet.</p><form id="settingsForm" class="stack mt16"><div class="field"><label for="goal">Main goal</label><select id="goal" name="goal">${Object.entries(CHOICES).map(([id,label])=>`<option value="${id}" ${state.settings.goal===id?'selected':''}>${esc(label)}</option>`).join('')}</select></div><div class="field"><label for="spotlight">Spotlight muscle</label><select id="spotlight" name="spotlight">${MUSCLES.map(m=>`<option value="${m}" ${state.settings.spotlight===m?'selected':''}>${esc(m)}</option>`).join('')}</select></div><label class="checkbox-row"><input type="checkbox" name="running" ${state.settings.running?'checked':''}> I also run or do cardio</label><button class="btn primary full" type="submit">Save preferences</button></form>`,'section')}
      ${card(`<div class="row"><h3>Your workouts</h3><span class="label-tag">A · B · C</span></div><p class="subhead">Follow the rotation in order rather than resetting every Monday.</p>${SESSION_ORDER.map(id=>`<div class="session-row"><div><strong>Full Body ${id}</strong><small>${PLAN[id].pairs.length} blocks · ${buildTasks(id).length} working sets</small></div><span class="label-tag">${state.next===id?'Next':'Scheduled'}</span></div>`).join('')}<p class="fineprint">Warm up 4–5 minutes. Allow recovery between sessions as needed; adjust leg training around running.</p>`,'section')}
      ${card(`<h3>Historical references</h3><p class="subhead">Previous spreadsheet records are reference only and are not automatically treated as your current training targets.</p><details class="mt12"><summary>View older PBs</summary><div class="mt12">${(window.REPQUEST_HISTORICAL||[]).map(x=>`<div class="session-row"><div><strong>${esc(x.day)} · ${esc(x.movement)}</strong><small>${esc(x.benchmark)}</small></div></div>`).join('')}</div></details><div class="mt16">${btn('Import 17 Oct Workout A (18 sets)','import-v5','outline full')}</div>`,'section')}
      ${card(`<h3>Keep your workout data</h3><p class="subhead">Training data is currently stored only in this browser. It does not sync automatically across your phone and PC.</p><div class="stack mt16">${btn('Export backup (JSON)','export','outline full')}<label class="btn outline full" for="backupFile" style="cursor:pointer">Import backup (JSON)</label><input id="backupFile" type="file" accept="application/json,.json" style="display:none">${btn('Clear local workout data','clear','text full')}</div>`,'section')}`;
  }

  function render(){
    let body='';
    if(page==='home')body=home();
    else if(page==='workout')body=workout();
    else if(page==='progress')body=progress();
    else if(page==='plan')body=plan();
    else if(page==='summary')body=summary();
    else body=home();
    shell(body);
    document.title=`RepRival · ${page[0].toUpperCase()+page.slice(1)}`;
  }
  function showToast(message){
    const el=document.querySelector('#toast');if(!el)return;
    el.className='toast';el.textContent=message;
    if(toastUntil)clearTimeout(toastUntil);
    toastUntil=setTimeout(()=>{if(document.querySelector('#toast'))document.querySelector('#toast').className='';},2500);
  }
  function restSkip(){if(!state.active)return;state.active.stage='lift';state.active.restUntil=null;save();render();}
  function backSet(){
    const a=state.active;if(!a)return;
    const tasks=buildTasks(a.session);
    if(a.stage==='feedback'){a.taskIndex=fullRound(tasks,tasks.length-1).start;a.stage='lift';}
    else if(a.stage==='rest'){a.taskIndex=fullRound(tasks,Math.max(0,a.taskIndex-1)).start;a.stage='lift';}
    else {
      const group=fullRound(tasks,a.taskIndex);
      if(group.start===0){page='home';save();render();return;}
      a.taskIndex=fullRound(tasks,group.start-1).start;
    }
    a.restUntil=null;save();page='workout';render();
  }

  function advanceWithRest(prior,next,rir){
    if(!next){state.active.stage='feedback';save();render();return;}
    const seconds=prior.pair.id===next.pair.id?calcRest(prior.pair,rir):Math.max(60,calcRest(prior.pair,rir));
    state.active.stage='rest';state.active.restSeconds=seconds;
    state.active.restNote=prior.pair.id===next.pair.id?'Rest between rounds':'Next block coming up';
    state.active.restUntil=Date.now()+seconds*1000;save();render();
  }

  function submitSet(form){
    const a=state.active;if(!a||a.stage!=='lift')return;
    const tasks=buildTasks(a.session),group=fullRound(tasks,a.taskIndex);
    const data=new FormData(form);let values=[];
    for(const t of group.items){
      const ex=t.ex,idx=t.index;
      const raw=String(data.get(`weight-${idx}`)??'').trim();
      const weight=ex.load==='bodyweight'?0:(raw?num(raw):0);
      const reps=num(data.get(`reps-${idx}`));const rir=num(data.get(`rir-${idx}`));
      if((ex.load!=='bodyweight'&&ex.load!=='optional'&&(raw===''||weight<=0))||!Number.isInteger(reps)||reps<1||reps>99||weight<0||!Number.isInteger(rir)||rir<0||rir>5){showToast('Check weight, reps and RIR for both exercises.');return;}
      values.push({t,log:{exId:ex.id,name:ex.name,muscle:ex.muscle,weight,reps,rir,load:ex.load,pair:t.pair.id,round:t.round,loggedAt:new Date().toISOString()}});
    }
    const pbEvents=[];
    for(const {t,log} of values){
      const prev=bestByExercise([...allLogs(),...a.logs.filter((_,i)=>i!==t.index)])[log.exId];
      if(prev&&score(log)>score(prev)+.000001)pbEvents.push({ex:t.ex,log,prev});
    }
    for(const {t,log} of values)a.logs[t.index]=log;
    a.drafts=a.drafts||{};delete a.drafts[group.start];
    a.taskIndex=group.end+1;
    const next=tasks[a.taskIndex];
    advanceWithRest(group.task,next,Math.min(...values.map(v=>v.log.rir)));
    if(pbEvents.length)celebratePB(pbEvents[0].ex,pbEvents[0].log,pbEvents[0].prev);
  }

  function importV5Baseline(){
    if(!Array.isArray(window.REPQUEST_V5_BASELINE))return;
    if(state.history.some(x=>x.source==='pumpplan-v5')){showToast('Already imported the V5 baseline');return;}
    if(!confirm('Import your logged 17 October Workout A from Pump Plan V5? This adds 18 recorded sets and does not erase existing history. Avoid importing if you already recorded the same session in RepRival.'))return;
    const logs=structuredClone(window.REPQUEST_V5_BASELINE);
    const finished={id:'v5-baseline-2026-10-17',source:'pumpplan-v5',session:'A',startedAt:'2026-10-17T08:00:00.000Z',endedAt:'2026-10-17T08:40:00.000Z',logs,feeling:'not recorded',recovery:48,prs:[]};
    state.history.push(finished);
    state.history.sort((a,b)=>new Date(a.endedAt)-new Date(b.endedAt));
    if(state.history.length===1)state.next='B';
    save();render();showToast('Imported 18 individual sets from V5');
  }
  function exportBackup(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='reprival-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  document.addEventListener('click',e=>{
    const link=e.target.closest('[data-page]');
    if(link){page=link.dataset.page;render();return;}
    const el=e.target.closest('[data-action]');if(!el)return;
    const action=el.dataset.action;
    if(action==='home'||action==='progress'){page=action;render();}
    if(action==='start')startWorkout();
    if(action==='begin')startWorkout();
    if(action==='rest-skip')restSkip();
    if(action==='back-set'||action==='back-round')backSet();
    if(action==='pause'){if(state.active){if(state.active.stage==='rest'){state.active.stage='lift';state.active.restUntil=null;}save();}page='home';render();}
    if(action==='discard'&&state.active&&confirm('Discard this unfinished workout? All sets recorded in this session will be lost.')){state.active=null;save();page='home';render();}
    if(action==='rest-add'&&state.active){state.active.restUntil+=15000;state.active.restSeconds+=15;save();render();}
    if(action==='feedback'&&state.active){state.active.stage='feedback';save();render();}
    if(action==='end-early')finishPartial();
    if(action==='last-summary'){state.lastSummary=state.history.at(-1)?.id;page='summary';render();}
    if(action==='review-session'){const id=el.dataset.id; if(id){state.lastSummary=id; page='summary'; render();}}
    if(action==='export')exportBackup();
    if(action==='import-v5')importV5Baseline();
    if(action==='clear'&&confirm('Clear all locally saved RepRival workouts and settings? This cannot be undone unless you have exported a backup.')){localStorage.removeItem(STORAGE_KEY);state=defaults();page='home';render();}
  });
  document.addEventListener('input',e=>{
    if(e.target.form?.id==='roundForm'&&state.active){
      const group=fullRound(buildTasks(state.active.session),state.active.taskIndex);
      state.active.drafts=state.active.drafts||{};
      const values=state.active.drafts[group.start]||{};
      values[e.target.name]=e.target.value;state.active.drafts[group.start]=values;save();
    }
  });
  document.addEventListener('submit',e=>{
    if(e.target.id==='roundForm'){e.preventDefault();submitSet(e.target);}
    if(e.target.id==='feedbackForm'){e.preventDefault();const f=new FormData(e.target);completeWorkout(f.get('feel')||'normal');}
    if(e.target.id==='settingsForm'){
      e.preventDefault();const f=new FormData(e.target);
      state.settings.goal=Object.hasOwn(CHOICES,f.get('goal'))?f.get('goal'):'muscle';
      state.settings.spotlight=MUSCLES.includes(f.get('spotlight'))?f.get('spotlight'):'Chest';
      state.settings.running=!!f.get('running');save();render();showToast('Preferences saved');
    }
  });
  document.addEventListener('change',async e=>{
    if(e.target.id==='movementSelect'){
      state.settings.focusMovement=e.target.value;save();render();return;
    }
    if(e.target.id!=='backupFile')return;
    const file=e.target.files?.[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data.history)||typeof data.settings!=='object'||data.version!==1)throw Error('Not a RepRival backup');
      if(!confirm('Replace all your locally saved data with this backup?'))return;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(data));state=loadState();page='home';render();showToast('Backup imported');
    } catch(err){showToast('Could not import that backup.');}
  });
  function tick(){
    if(!state.active||state.active.stage!=='rest')return;
    if(Date.now()>=state.active.restUntil){restSkip();return;}
    if(page==='workout'){
      const timer=document.querySelector('.timer');
      const remain=Math.ceil((state.active.restUntil-Date.now())/1000);
      if(timer){timer.textContent=`${String(Math.floor(remain/60)).padStart(2,'0')}:${String(remain%60).padStart(2,'0')}`;}
    }
  }
  clock=setInterval(tick,350);
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline cache unavailable',e));
  }
  render();
  // Small surface for local smoke tests. No production backend or data transfer.
  window.RepRivalTest={getState:()=>structuredClone(state),buildTasks,score,calcRest,version:'0.3',comparableSessions,muscleChange};
})();
