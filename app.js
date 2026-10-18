'use strict';
(function () {
  const PLAN = window.REPQUEST_PROGRAM;
  const STORAGE_KEY = 'repquest-prototype-v01'; // Read-only legacy fallback
  const PROFILE_KEY='reprival-athletes-v12'; // Existing profile storage format preserved
  let SESSION_ORDER = ['A', 'B', 'C'];
  const MUSCLES = ['Chest','Back','Biceps','Triceps','Side delts','Rear delts','Quads','Hamstrings','Glutes','Calves','Core'];
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
  let selectedPlan='pump';
  let manager=null;
  let pendingPlan=null;
  let trendEditing=false;
  const ADAPT=window.RepRivalAdaptive;
  const ADAPT_ID='adaptive';
  let adaptiveDraft=null;
  let catalogueFilter={muscle:'All',kit:'owned',search:''};
  let activeProfile=null;
  let clock = null;
  let toastUntil = null;
  let state = loadState();
  initializeProfiles();
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
  function save(){
    if(!manager||!activeProfile)return;
    manager.profiles[activeProfile].training=structuredClone(state);
    manager.last=activeProfile;
    try{localStorage.setItem(PROFILE_KEY,JSON.stringify(manager));}catch(e){console.warn('Storage unavailable',e);}
  }
  function initializeProfiles(){
    try{const stored=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');
      if(stored?.version===12&&stored.profiles&&Object.keys(stored.profiles).length){manager=stored;activeProfile=stored.last in stored.profiles?stored.last:Object.keys(stored.profiles)[0];state=manager.profiles[activeProfile].training;if(stored.setupPending)page='setup';}
    }catch(e){console.warn('Profile data unavailable',e);}
    if(!manager){
      manager={version:12,last:'admin',profiles:{admin:{username:'',pin:'',role:'admin',training:structuredClone(state),body:{unit:'kg',heightUnit:'cm',waistUnit:'cm',measurements:[]},selectedMovements:[],planId:'pump',plans:null}},setupPending:true};
      activeProfile='admin';page='setup';
    }
    ensureTraining();
  }
  function profile(){return manager.profiles[activeProfile];}
  function canImportOwnerBaseline(){return activeProfile==='admin'&&profile().role==='admin'&&!profile().demo&&!state.history.some(s=>s.source==='pumpplan-v5'||s.id==='v5-baseline-2026-10-17');}
  function ensureTraining(){
    state=profile().training;
    if(!state.settings)state.settings=defaults().settings;
    if(!profile().body)profile().body={unit:'kg',heightUnit:'cm',waistUnit:'cm',measurements:[]};
    if(!profile().selectedMovements)profile().selectedMovements=[];
    if(!Array.isArray(profile().equipment))profile().equipment=(activeProfile==='admin'&&!profile().demo)?[...window.REPRIVAL_EXERCISE_LIBRARY.ownerDefault]:[];
    if(!profile().planId)profile().planId='pump';
    if(profile().planId===ADAPT_ID&&!profile().plans?.adaptive){profile().planId='pump';}
    if(!profile().trendOverrides)profile().trendOverrides={added:[],hidden:[]};
    if(!Array.isArray(profile().adaptivePresets))profile().adaptivePresets=[];
    if(!profile().plans)profile().plans={pump:structuredClone(PLAN)};
    selectedPlan=profile().planId;
    SESSION_ORDER=Object.keys(profile().plans[selectedPlan]||PLAN);
    if(!SESSION_ORDER.includes(state.next))state.next=SESSION_ORDER[0];
  }
  function switchTo(id){activeProfile=id;manager.last=id;ensureTraining();page='home';save();render();}
  function profileNames(){return Object.keys(manager.profiles);}
  function newProfileId(){return 'athlete-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5);}
  function weightKg(v,unit){return unit==='lb'?v/2.2046226218:unit==='st'?v*6.35029318:v;}
  function displayWeight(kg){const u=profile().body.unit||'kg';return u==='lb'?`${fmt(kg*2.2046226218)} lb`:u==='st'?`${Math.floor(kg/6.35029318)} st ${fmt((kg/0.45359237)%14)} lb`:`${fmt(kg)} kg`;}
  function heightIn(centimeters){return Number(centimeters||0)/2.54;}
  function chartWeight(kg){const u=profile().body.unit||'kg';return u==='lb'?kg*2.2046226218:u==='st'?kg/6.35029318:kg;}
  function weightUnitLabel(){const u=profile().body.unit||'kg';return u==='st'?'st':u;}
  function todayLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function dayNumber(day){const [y,m,d]=day.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000);}
  function dayAt(day,delta){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+delta);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function tracking(){if(!profile().planTracking){const earliest=state.history.map(s=>dateOnly(s.startedAt||s.endedAt)).sort()[0]||todayLocal();profile().planTracking={planId:selectedPlan,start:earliest,weeklyGoal:3};}return profile().planTracking;}
  function consistency(){const conf=tracking(),start=conf.start||todayLocal(),goal=Number(conf.weeklyGoal)||3,today=todayLocal(),elapsed=Math.max(0,dayNumber(today)-dayNumber(start)),week=Math.floor(elapsed/7),since=dayAt(start,week*7),through=dayAt(since,6),completed=(from,to)=>state.history.filter(s=>{const d=dateOnly(s.startedAt||s.endedAt);return d>=from&&d<=to&&(s.planId?s.planId===conf.planId:conf.planId==='pump')}).length;const done=completed(since,through),weeks=[];for(let i=Math.max(0,week-3);i<=week;i++){const a=dayAt(start,i*7);weeks.push({start:a,end:dayAt(a,6),count:completed(a,dayAt(a,6)),goal});}const completeWeeks=weeks.filter(w=>w.end<=today);const summary=completeWeeks.length?completeWeeks:weeks;const total=summary.reduce((a,x)=>a+Math.min(x.count,x.goal),0),target=summary.reduce((a,x)=>a+x.goal,0);return {start,goal,week,since,through,done,weeks,percentage:target?Math.round(total/target*100):0};}
  const WEEKDAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  function weighSchedule(){
    const b=profile().body;
    if(!b.weighSchedule)b.weighSchedule={enabled:false,days:[0,2,5]};
    b.weighSchedule.days=[...new Set((b.weighSchedule.days||[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<7))].sort();
    return b.weighSchedule;
  }
  function scheduledWeighStatus(){
    const conf=weighSchedule(),today=todayLocal(),d=new Date(today+'T12:00:00'),dow=(d.getDay()+6)%7;
    const done=(profile().body.measurements||[]).some(m=>m.date===today);
    let next=null;
    if(conf.enabled&&conf.days.length){for(let k=0;k<8;k++){const wd=(dow+k)%7;if(conf.days.includes(wd)){next=dayAt(today,k);break;}}}
    return {enabled:conf.enabled&&conf.days.length>0,due:conf.enabled&&conf.days.includes(dow)&&!done,done,next};
  }
  function weighScheduleSection(){
    const conf=weighSchedule();return card(`<div class="row"><h3>Weigh-in schedule</h3><span class="label-tag">Optional</span></div><p class="subhead">Choose your preferred mornings. RepRival reminds you on Home; rest days and missed weigh-ins are never penalised.</p>
      <form id="weighScheduleForm" class="stack mt16"><label class="schedule-enable"><input type="checkbox" name="enabled" ${conf.enabled?'checked':''}> Remind me on scheduled days</label><div class="schedule-days">${WEEKDAYS.map((day,i)=>`<label class="schedule-day"><input type="checkbox" name="day" value="${i}" ${conf.days.includes(i)?'checked':''}><span>${day}</span></label>`).join('')}</div><button type="submit" class="btn outline full">Save weigh-in schedule</button></form><p class="fineprint">In-app reminder only, not a push notification. Dates use your device's local time.</p>`,'section');
  }
  function bodyUnitOptions(){return `<div class="form-grid"><div class="field"><label>Height unit</label><select name="heightUnit" data-unit="height"><option value="cm">Centimetres</option><option value="ft">Feet / inches</option></select></div><div class="field"><label>Weight unit</label><select name="unit" data-unit="weight"><option value="kg">Kilograms</option><option value="lb">Pounds</option><option value="st">Stone / pounds</option></select></div></div>`;}
  function bodyInputFields(b={}){const unit=b.unit||'kg',hu=b.heightUnit||'cm',wu=b.waistUnit||'cm',cm=b.height||0,feet=Math.floor(heightIn(cm)/12),inch=+(heightIn(cm)%12).toFixed(1),g=b.goalKg!=null?b.goalKg:0;return `<div class="body-fields">
    <div class="form-grid"><div class="field"><label>Date of birth</label><input type="date" name="dob" value="${esc(b.dob||'')}"></div><div class="field"><label>Sex (optional)</label><select name="sex"><option value="">Prefer not to say</option>${[['male','Male'],['female','Female'],['other','Other / self-described']].map(([v,l])=>`<option value="${v}" ${b.sex===v?'selected':''}>${l}</option>`).join('')}</select></div></div>
    <div class="form-grid"><div class="field"><label>Height unit</label><select name="heightUnit" data-unit="height"><option value="cm" ${hu==='cm'?'selected':''}>cm</option><option value="ft" ${hu==='ft'?'selected':''}>Feet / inches</option></select></div><div class="field"><label>Weight unit</label><select name="unit" data-unit="weight"><option value="kg" ${unit==='kg'?'selected':''}>kg</option><option value="lb" ${unit==='lb'?'selected':''}>lb</option><option value="st" ${unit==='st'?'selected':''}>Stone / lb</option></select></div></div>
    <div data-height-cm ${hu==='ft'?'hidden':''} class="field"><label>Height (cm)</label><input name="height" type="number" step="0.1" min="0" max="250" value="${cm||''}" placeholder="e.g. 182"></div>
    <div data-height-ft ${hu!=='ft'?'hidden':''} class="form-grid"><div class="field"><label>Height (feet)</label><input name="heightFeet" type="number" step="1" min="0" max="8" value="${cm?feet:''}" placeholder="5"></div><div class="field"><label>Height (inches)</label><input name="heightInches" type="number" step="0.1" min="0" max="11.9" value="${cm?inch:''}" placeholder="11"></div></div>
    <div data-weight-kg ${unit!=='kg'?'hidden':''} class="form-grid"><div class="field"><label>Starting weight (kg)</label><input name="startKg" type="number" min="0" max="600" step="0.1" value="" placeholder="Optional"></div><div class="field"><label>Goal weight (kg)</label><input name="goalKg" type="number" min="0" max="600" step="0.1" value="${g&&unit==='kg'?+g.toFixed(1):''}"></div></div>
    <div data-weight-lb ${unit!=='lb'?'hidden':''} class="form-grid"><div class="field"><label>Starting weight (lb)</label><input name="startLb" type="number" min="0" max="1400" step="0.1" placeholder="Optional"></div><div class="field"><label>Goal weight (lb)</label><input name="goalLb" type="number" min="0" max="1400" step="0.1" value="${g&&unit==='lb'?+(g*2.20462262).toFixed(1):''}"></div></div>
    <div data-weight-st ${unit!=='st'?'hidden':''} class="stack"><div class="form-grid"><div class="field"><label>Starting stone</label><input name="startSt" type="number" min="0" step="1"></div><div class="field"><label>Starting lb</label><input name="startStLb" type="number" min="0" max="13.9" step="0.1"></div></div><div class="form-grid"><div class="field"><label>Goal stone</label><input name="goalSt" type="number" min="0" step="1" value="${g&&unit==='st'?Math.floor(g/6.35029318):''}"></div><div class="field"><label>Goal lb</label><input name="goalStLb" type="number" min="0" max="13.9" step="0.1" value="${g&&unit==='st'?+((g/0.45359237)%14).toFixed(1):''}"></div></div></div>
    <div class="form-grid"><div class="field"><label>Waist unit</label><select name="waistUnit" data-unit="waist" data-last="${wu}"><option value="cm" ${wu==='cm'?'selected':''}>cm</option><option value="in" ${wu==='in'?'selected':''}>Inches</option></select></div><div class="field"><label data-waist-label>Waist (${wu}) · optional</label><input name="waist" type="number" min="0" step="0.1" value="${b.waistCm?+(b.waistCm/(wu==='in'?2.54:1)).toFixed(1):''}"></div></div><div class="field"><label>Body fat (%) · optional</label><input name="bodyFat" type="number" min="0" max="80" step="0.1" value="${b.bodyFat||''}"></div>
  </div>`;}
  function readBodyForm(f,old={},initial=false){const b={...old,measurements:[...(old.measurements||[])]};b.dob=String(f.get('dob')||'');b.sex=String(f.get('sex')||'');b.heightUnit=String(f.get('heightUnit')||'cm');b.unit=String(f.get('unit')||'kg');b.waistUnit=String(f.get('waistUnit')||'cm');const val=key=>Number(f.get(key))||0;b.height=b.heightUnit==='ft'?((val('heightFeet')*12+val('heightInches'))*2.54||null):(val('height')||null);const wg=(p)=>b.unit==='kg'?val(p+'Kg'):b.unit==='lb'?weightKg(val(p+'Lb'),'lb'):weightKg(val(p+'St')+val(p+'StLb')/14,'st');b.goalKg=wg('goal')||null;const waist=val('waist');b.waistCm=waist?waist*(b.waistUnit==='in'?2.54:1):null;b.bodyFat=val('bodyFat')||null;if(initial){const kg=wg('start');if(kg>0)b.measurements.push({date:todayLocal(),kg,waistCm:b.waistCm,bodyFat:b.bodyFat});}return b;}
  function syncBodyFields(form,changed){
    const get=name=>form.querySelector(`[name="${name}"]`),n=name=>Number(get(name)?.value)||0,put=(name,value)=>{const input=get(name);if(input)input.value=value==null?'':String(+value.toFixed(1));};
    if(changed==='height'){
      const cmPanel=form.querySelector('[data-height-cm]'),ftPanel=form.querySelector('[data-height-ft]');
      if(get('heightUnit').value==='ft'&&!cmPanel.hidden&&n('height')){const inches=n('height')/2.54;put('heightFeet',Math.floor(inches/12));put('heightInches',inches%12);}
      if(get('heightUnit').value==='cm'&&!ftPanel.hidden&&(n('heightFeet')||n('heightInches'))){put('height',(n('heightFeet')*12+n('heightInches'))*2.54);}
    }
    if(changed==='weight'){
      const current=['kg','lb','st'].find(u=>{const el=form.querySelector(`[data-weight-${u}]`);return el&&!el.hidden;})||'kg',next=get('unit').value;
      const kgValue=prefix=>current==='kg'?n(prefix+'Kg'):current==='lb'?n(prefix+'Lb')/2.2046226218:(n(prefix+'St')*14+n(prefix+'StLb'))*0.45359237;
      for(const prefix of ['start','goal']){const oldField=(current==='kg'?get(prefix+'Kg'):current==='lb'?get(prefix+'Lb'):get(prefix+'St'));
        if(!oldField||oldField.value==='')continue;const kg=kgValue(prefix);if(next==='kg')put(prefix+'Kg',kg);else if(next==='lb')put(prefix+'Lb',kg*2.2046226218);else {const lb=kg*2.2046226218;put(prefix+'St',Math.floor(lb/14));put(prefix+'StLb',lb%14);}}
    }
    if(changed==='waist'){
      const field=get('waist');if(field?.value){const previous=get('waistUnit').dataset.last||'cm',next=get('waistUnit').value;if(previous!==next){put('waist',previous==='cm'?n('waist')/2.54:n('waist')*2.54);}}
      get('waistUnit').dataset.last=get('waistUnit').value;
    }
    const h=get('heightUnit')?.value||'cm',u=get('unit')?.value||'kg';for(const [sel,visible] of [['[data-height-cm]',h==='cm'],['[data-height-ft]',h==='ft'],['[data-weight-kg]',u==='kg'],['[data-weight-lb]',u==='lb'],['[data-weight-st]',u==='st']]){const el=form.querySelector(sel);if(el)el.hidden=!visible;}
    const label=form.querySelector('[data-waist-label]');if(label)label.textContent=`Waist (${get('waistUnit')?.value||'cm'}) · optional`;
  }
  function dateOnly(iso){return String(iso).slice(0,10);}
  function ageFromDate(d){if(!d)return null;const now=new Date(),born=new Date(d+'T12:00:00');let a=now.getFullYear()-born.getFullYear();if(now.getMonth()<born.getMonth()||(now.getMonth()===born.getMonth()&&now.getDate()<born.getDate()))a--;return a;}

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
    const comparable=allMovements().map(m=>comparableSessions(m)).filter(s=>s.length>=2);
    if(!isCalibrated()||!comparable.length)return {value:null,compared:comparable.length,tracked:allMovements().length};
    const ratios=comparable.map(s=>s.at(-1).performance/Math.max(.01,s[0].performance));
    const value=100*Math.exp(ratios.reduce((n,r)=>n+Math.log(Math.max(.05,r)),0)/ratios.length);
    return {value:Math.round(value*10)/10,compared:comparable.length,tracked:allMovements().length};
  }

  function ratingExplanation(){const r=athleteIndex(),missing=workoutsUntilCalibration();if(r.value==null)return `Rating is waiting for repeat sets. First complete ${missing.length?missing.join(', ')+' workouts':'another session with the same movements'}, then compare your best qualifying sets. This is personal progression, not a ranking against other athletes.`;const delta=+(r.value-100).toFixed(1);return `100 represents your first recorded performance on each compared movement. ${fmt(r.value)} means your best working-set performance is approximately ${delta>=0?'+':''}${fmt(delta)}% versus those baselines across ${r.compared} repeated movements. This is an estimated personal trend, not a competitive percentile or a verified strength test.`;}
  function ratingCard(){const r=athleteIndex();return `<div class="rating-explain"><h3>What does my rating mean?</h3><p class="subhead mt8">${esc(ratingExplanation())}</p>${r.value!=null?`<p class="fineprint">Compared movements: ${r.compared}. Higher means improving relative to your OWN baseline.</p>`:''}</div>`;}
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
  // The heatmap shows recent logged TRAINING EXPOSURE, not biological muscle growth or atrophy.
  const HEAT_KEYS=['Chest','Back','Side delts','Rear delts','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Core'];
  function heatData(period=7){
    const now=Date.now(),days=period===28?28:7;
    const out=Object.fromEntries(HEAT_KEYS.map(m=>[m,{name:m,stimulus:0,sets:0,last:null,ever:false,historySets:0,historySessions:new Set()}]));
    const secondary={'Chest':[['Triceps',.24],['Side delts',.15]],'Back':[['Biceps',.29],['Rear delts',.18]],'Quads':[['Glutes',.23]],'Hamstrings':[['Glutes',.23]],'Glutes':[['Hamstrings',.16]]};
    for(const s of state.history){
      const time=Date.parse(s.endedAt||s.startedAt||'');if(!Number.isFinite(time)||time>now+86400000)continue;
      const age=Math.max(0,(now-time)/86400000);
      for(const l of s.logs||[]){
        const primary=l.muscle;if(!out[primary])continue;
        out[primary].ever=true;out[primary].historySets++;out[primary].historySessions.add(s.id||String(time));
        out[primary].last=Math.max(out[primary].last||0,time);
        if(age>=days)continue;
        // An RIR 0-2 set counts more strongly than an easy set; unknown RIR is neutral.
        const rir=Number(l.rir);
        const effort=l.rir==null||l.rir===''||!Number.isFinite(rir)?.82:Math.max(.43,1-Math.min(5,Math.max(0,rir))*.11);
        const q=Math.pow(.5,age/(days===7?3.8:11))*effort;
        for(const [key,factor] of [[primary,1],...(secondary[primary]||[])]){
          out[key].stimulus+=q*factor;out[key].sets+=factor;
        }
      }
    }
    const targets={'Chest':6,'Back':6,'Side delts':4,'Rear delts':4,'Biceps':4.5,'Triceps':4.5,'Quads':6,'Hamstrings':5,'Glutes':5,'Calves':4,'Core':4.5};
    for(const m of HEAT_KEYS){const p=out[m];p.score=Math.round(Math.min(100,p.stimulus/targets[m]*(days===28?7/14:1)*100));}
    return out;
  }
  function heatBar(name,score){return `<div class="rr-heat-row"><div class="rr-heat-rowhead"><span>${esc(name)}</span><strong>${score}%</strong></div><div class="rr-heat-track"><span style="width:${score}%"></span></div></div>`;}
  function musclePanel(compact=false){
    const period=compact?7:(state.settings.heatPeriod===28?28:7),data=heatData(period);
    const groups=[['Chest',['Chest']],['Back',['Back']],['Shoulders',['Side delts','Rear delts']],['Arms',['Biceps','Triceps']],['Quads',['Quads']],['Hamstrings',['Hamstrings']],['Glutes',['Glutes']],['Calves',['Calves']],['Core',['Core']]];
    const scores=Object.fromEntries(HEAT_KEYS.map(m=>[m,{score:data[m].score,ever:data[m].ever,last:data[m].last,historySets:data[m].historySets,historySessions:data[m].historySessions.size}]));
    const top=groups.map(([name,ms])=>({name,score:Math.round(ms.reduce((a,m)=>a+scores[m].score,0)/ms.length),keys:ms}));
    const trained=new Set(HEAT_KEYS.filter(m=>data[m].sets>.1));
    const active=top.filter(m=>m.score>=15).length;
    const lastWorkout=state.history.length?Math.max(...state.history.map(s=>Date.parse(s.endedAt||s.startedAt||'' )).filter(Number.isFinite)):null;
    const recentEnough=lastWorkout&&Date.now()-lastWorkout<14*86400000;
    const neglect=recentEnough?top.filter(g=>g.keys.some(k=>data[k].ever)&&g.keys.every(k=>(!data[k].last||Date.now()-data[k].last>14*86400000))).sort((a,b)=>a.score-b.score)[0]:null;
    const totalSets=state.history.filter(s=>Date.now()-Date.parse(s.endedAt||s.startedAt||'')<period*86400000).reduce((n,s)=>n+(s.logs||[]).length,0);
    const figures=`<div class="rr-figures"><div class="rr-body"><div class="rr-figure-wrap">${window.RepRivalBodyMap.figure('front',scores)}</div><span>FRONT</span></div><div class="rr-body"><div class="rr-figure-wrap">${window.RepRivalBodyMap.figure('back',scores)}</div><span>BACK</span></div></div>`;
    if(compact)return `<div class="rr-heat-compact">${figures}<div class="rr-heat-compact-side"><div class="rr-heat-kicker">THIS WEEK</div><strong class="rr-heat-big">${active}<small> / 9</small></strong><span>groups activated</span><div class="rr-heat-compact-lines">${top.slice(0,4).map(m=>heatBar(m.name,m.score)).join('')}</div></div></div><div class="rr-heat-legend"><span>LESS RECENT WORK</span><i></i><span>MORE</span></div><p class="rr-heat-note">Red shows recent logged training, not measured muscle growth.</p><button type="button" data-page="progress" class="rr-heat-link">Explore muscle map <span>↗</span></button>`;
    return `<div class="rr-heat-full"><div class="rr-heat-heading"><div><div class="rr-heat-kicker">PERFORMANCE · TRAINING EXPOSURE</div><h2>Muscle map</h2><p>A visual guide to the muscles you have trained recently. Tap any coloured area for details.</p></div><div><label class="sr-only" for="heatPeriod">Muscle map timeframe</label><select id="heatPeriod" aria-label="Muscle map timeframe"><option value="7" ${period===7?'selected':''}>This week</option><option value="28" ${period===28?'selected':''}>Last 28 days</option></select></div></div><div class="rr-heat-atlas">${figures}<div class="rr-heat-details">${top.map(m=>heatBar(m.name,m.score)).join('')}</div></div><div class="rr154-muscle-key"><span><b class="neutral"></b>Neutral</span><span><b class="red"></b>Recent work</span><span><b class="blue"></b>Reduced stimulus</span></div><div class="rr-heat-meta"><div><strong>${active} / 9</strong><span>groups with recent stimulus</span></div><div><strong>${totalSets}</strong><span>logged sets · ${period} days</span></div></div>${neglect?`<div class="rr-heat-alert"><span aria-hidden="true">◷</span><div><strong>${esc(neglect.name)} haven't been trained recently</strong><p>Your logs show over 14 days without work for this area. Consider it when planning your next session.</p></div></div>`:!state.history.length?`<div class="rr-heat-alert"><span aria-hidden="true">◇</span><div><strong>Your map starts neutral</strong><p>Log a workout to see the muscles you trained turn red.</p></div></div>`:''}<p class="rr-heat-disclaimer">Relative estimate from completed working sets and their age; secondary muscle involvement is approximate. Blue indicates possible undertraining, not measured muscle loss. Colours cannot determine growth, recovery or muscle mass.</p></div>`;
  }

  function muscleDetailScreen(){
    const m=state.settings.selectedMuscle||'Chest',period=28,data=heatData(period);
    const named=LEAGUE_GROUPS[m]||[m];
    const chosen=named.filter(x=>data[x]),points=chosen.length?Math.round(chosen.reduce((n,x)=>n+data[x].score,0)/chosen.length):0;
    const last=chosen.map(x=>data[x].last).filter(Boolean).sort((a,b)=>b-a)[0]||null;
    const related=state.history.flatMap(s=>(s.logs||[]).filter(l=>named.includes(l.muscle)).map(l=>({...l,when:s.endedAt||s.startedAt}))).sort((a,b)=>Date.parse(b.when)-Date.parse(a.when)).slice(0,8);
    return `<div class="eyebrow">PERFORMANCE · MUSCLE DETAILS</div><h1 class="page-title">${esc(m)}</h1>${card(`<div class="row"><h3>Recent stimulus</h3><span class="label-tag">LAST 28 DAYS</span></div><h2 class="rr154-muscle-score">${points}%</h2>${heatBar(m,points)}<p class="subhead mt12">Last trained: ${last?dateText(new Date(last).toISOString()):'No recorded session'}. Red represents recent training; blue means less activity than your previous training, not proven muscle loss.</p>`,'section')}${card(`<h3>Recent recorded sets</h3>${related.length?related.map(l=>`<div class="rr154-checkin-history"><strong>${esc(l.name||l.exId)}</strong><span>${esc(String(l.reps||0))} reps · ${esc(String(l.weight??'BW'))} ${l.weight==='bodyweight'?'':'kg'} · ${esc(dateOnly(l.when))}</span></div>`).join(''):'<p class="subhead mt8">No matching training sessions recorded yet.</p>'}`,'section')}<button class="btn outline full" type="button" data-page="progress">Back to muscle map</button>`;
  }

  function muscleTrendPanel(){
    const rows=MUSCLES.map(m=>({name:m,data:muscleChange(m)}));
    const peak=Math.max(15,...rows.filter(x=>x.data).map(x=>Math.abs(x.data.change)));
    return `<div class="muscle-list">${rows.map(row=>`<div class="muscle-item"><div class="muscle-label"><strong>${esc(row.name)}</strong><span>${row.data?progressPct(row.data.change):'Not started'}</span></div><div class="muscle-track"><span style="width:${row.data?Math.min(100,Math.abs(row.data.change)/peak*100):0}%"></span></div></div>`).join('')}</div><p class="fineprint">Compared exercise performance; not measured muscle size.</p>`;
  }

  function historyList(limit=6){
    return [...state.history].reverse().slice(0,limit).map(s=>`<div class="session-row"><div><strong>${esc(s.sessionName||'Full Body '+s.session)}</strong><small>${dateText(s.endedAt)} · ${s.logs.length} sets · ${fmt(s.logs.reduce((n,l)=>n+Number(l.weight||0)*l.reps,0))} kg-reps</small></div><button type="button" class="quiet-link" data-action="review-session" data-id="${esc(s.id)}">Review →</button></div>`).join('')||'<p class="muted">No saved workouts yet.</p>';
  }

  function lastSessionOf(id){return [...state.history].reverse().find(s=>s.session===id);}
  function nextLetter(id){return SESSION_ORDER[(SESSION_ORDER.indexOf(id)+1)%SESSION_ORDER.length];}
  function planFor(id){const p=profile().plans[selectedPlan]||PLAN;return p[id]||p[Object.keys(p)[0]]||PLAN.A;}
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
  function shortPeriod(start,end){const a=new Date(start+'T12:00:00'),b=new Date(end+'T12:00:00');const month=d=>d.toLocaleDateString('en-GB',{month:'short'});if(a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth())return `${a.getDate()}–${b.getDate()} ${month(b)} ${b.getFullYear()}`;return `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)} ${b.getFullYear()}`;}
  function title(){return `<header class="topbar"><span class="brand">RepRival</span><span class="rr153-wordmark-detail">TRAIN <span>·</span> COMPETE <span>·</span> IMPROVE</span><span class="version-chip">1.6.1</span></header>`;}

  function bottomNav(){
    const paths={
      home:'<path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
      workout:'<path d="m6.5 6.5-3 3m14-3 3 3M2 12h20M6 6v12M18 6v12M2 10v4m20-4v4"/>',
      leagues:'<path d="M8 21h8M12 17v4M7 4h10v7a5 5 0 0 1-10 0V4ZM7 6H4v3a3 3 0 0 0 3 3m10-6h3v3a3 3 0 0 1-3 3"/>',
      progress:'<path d="M4 20V12h4v8M10 20V7h4v13M16 20V3h4v17M2 21h20"/>',
      plan:'<path d="M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-6 2v4"/>',
      admin:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      account:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
    };
    const links=[['home','Home'],['workout','Workout'],['leagues','Leagues'],['progress','Progress'],['plan','My plan'],[profile().role==='admin'?'admin':'account',profile().role==='admin'?'Admin':'Account']];
    return `<nav class="tabnav" aria-label="Main navigation">${links.map(([id,label])=>`<button type="button" class="${(page===id||(id==='workout'&&page==='workout-intro'))?'active':''}" data-page="${id}" aria-label="${label}"><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]}</svg></span>${label}</button>`).join('')}</nav>`;
  }


  // Six independent muscle-group ladders, powered by the user's actual sessions.
  // v1.5.3 movement records are preserved as history in the same profile.
  const LEAGUES=window.RepRivalLeagues;
  const LEAGUE_GROUPS={
    'Chest':['Chest'],'Back':['Back'],'Shoulders':['Side delts','Rear delts','Shoulders'],
    'Arms':['Biceps','Triceps','Arms'],'Legs':['Quads','Hamstrings','Glutes','Calves','Legs'],'Core':['Core']
  };
  function leagueStore(){
    const athlete=profile();
    if(!athlete.leagueSim)athlete.leagueSim={version:2,area:'United Kingdom',records:{},focus:'Chest'};
    if(athlete.leagueSim.version!==2){
      athlete.leagueSim.previousMovementRecords=athlete.leagueSim.records||{};
      athlete.leagueSim.records={};athlete.leagueSim.version=2;athlete.leagueSim.focus='Chest';
    }
    return athlete.leagueSim;
  }
  function leagueWorkoutTime(){
    const now=Date.now(),dates=state.history.map(s=>Date.parse(s.endedAt||s.startedAt||'')).filter(n=>Number.isFinite(n)&&n<=now);
    return dates.length?Math.max(...dates):null;
  }
  function leagueInactivity(){
    const last=leagueWorkoutTime(),days=last==null?Infinity:Math.max(0,(Date.now()-last)/86400000),base=athleteIndex().value;
    return {last,days,status:last==null?'new':days>=30?'inactive':days>=14?'decaying':'active',base,adjusted:base==null?null:Math.round(base*Math.pow(.99,Math.max(0,days-14))*10)/10};
  }
  function leagueGroupFor(muscle){
    return Object.keys(LEAGUE_GROUPS).find(group=>LEAGUE_GROUPS[group].includes(muscle))||null;
  }
  function groupPerformance(group){
    // Establish exercise-specific starting points: machines, dumbbells and bodyweight
    // cannot be compared directly by kilograms or repetitions.
    const logs=state.history.flatMap(s=>(s.logs||[]).map(l=>({l,when:Date.parse(l.loggedAt||s.endedAt||s.startedAt||'')})))
      .filter(x=>leagueGroupFor(x.l.muscle)===group&&x.l.exId&&Number.isFinite(x.when))
      .sort((a,b)=>a.when-b.when);
    if(!logs.length)return null;
    const exercises=new Map();
    for(const {l,when} of logs){
      const perf=score(l);if(!(perf>0))continue;
      const record=exercises.get(l.exId)||{name:l.name||l.exId,first:perf,best:perf,latest:when,count:0};
      record.best=Math.max(record.best,perf);record.latest=Math.max(record.latest,when);record.count++;
      exercises.set(l.exId,record);
    }
    if(!exercises.size)return null;
    const now=Date.now(),day=86400000,cutoff=now-28*day;
    const recentSessions=new Set(state.history.filter(s=>{
      const at=Date.parse(s.endedAt||s.startedAt||'');return at>=cutoff&&at<=now&&(s.logs||[]).some(l=>leagueGroupFor(l.muscle)===group);
    }).map(s=>s.id));
    const changes=[...exercises.values()].map(x=>Math.min(.45,Math.max(-.15,x.best/Math.max(.01,x.first)-1)));
    const strength=changes.reduce((a,b)=>a+b,0)/changes.length;
    const consistency=Math.min(12,recentSessions.size*3);
    const points=Math.max(50,Math.round((100+strength*75+consistency)*10)/10);
    return {points,exerciseCount:exercises.size,recentSessions:recentSessions.size,changes:Math.round(strength*100),movements:[...exercises.values()]};
  }
  function syncLeagues(){
    const st=leagueStore(),now=Date.now(),latest=leagueWorkoutTime(),rating=athleteIndex().value;
    const area=LEAGUES.LOCATIONS[st.area]?st.area:'United Kingdom';
    let changed=false;const promoted=[];const items=[];
    for(const name of Object.keys(LEAGUE_GROUPS)){
      const perf=groupPerformance(name),ex={id:'group:'+name,name,muscle:name};
      if(!perf){items.push({ex,performance:null,league:null});continue;}
      const previous=st.records[ex.id];
      const result=LEAGUES.update(previous,ex.id,perf.points,rating,activeProfile,now,area,latest);
      if(!previous||result.changed){st.records[ex.id]=result.entry;changed=true;}
      if(result.promoted)promoted.push(name);
      items.push({ex,performance:perf,league:result});
    }
    if(!Object.hasOwn(LEAGUE_GROUPS,st.focus)){st.focus=items.find(x=>x.performance)?.ex.name||'Chest';changed=true;}
    if(changed)save();
    return {items,focus:st.focus,area,inactivity:leagueInactivity(),promoted};
  }
  function leagueTime(ms){const mins=Math.max(0,Math.ceil(ms/60000)),h=Math.floor(mins/60),m=mins%60;return h?`${h}h ${String(m).padStart(2,'0')}m`:`${m}m`;}
  function leaguesScreen(){
    const data=syncLeagues(),st=leagueStore(),qualified=data.items.filter(x=>x.performance),paused=data.inactivity.status==='inactive';
    const selected=data.items.find(x=>x.ex.name===data.focus)||qualified[0]||data.items[0];
    const status=data.inactivity.status==='new'?'Ready to compete':paused?'Competition paused':data.inactivity.status==='decaying'?'Rating decreasing':'Active competitor';
    const rating=data.inactivity.adjusted;
    const areaOptions=Object.keys(LEAGUES.LOCATIONS).map(area=>`<option value="${esc(area)}" ${data.area===area?'selected':''}>${esc(area)}</option>`).join('');
    const statusText=data.inactivity.status==='new'?'Log a workout to enter your first muscle-group league.':paused?'Your active league positions have been released. Complete a workout to rejoin; your previous divisions and personal bests remain saved.':data.inactivity.status==='decaying'?'Overall Athlete Score begins to decay after 14 days. Promotions pause until your next workout.':'Improve and consistently train a muscle group to climb its league. Hold first place for 24 hours to promote.';
    const header=`<section class="rr153-league-hero"><div class="rr153-waves" aria-hidden="true"></div><span class="eyebrow">MUSCLE LEAGUES · FICTIONAL OPPONENTS</span><h1>Earn your<br><em>place.</em></h1><p>Six muscle groups. Six independent ladders. Hold first for 24 hours to advance.</p><div class="rr153-league-hud"><div><strong>${qualified.length}<small> / 6</small></strong><span>GROUPS RANKED</span></div><div><strong>${qualified.filter(x=>x.league?.standings?.rank===1).length}</strong><span>LEADING</span></div><div><strong>${qualified.reduce((a,x)=>a+(x.league?.entry?.promotions||0),0)}</strong><span>PROMOTIONS</span></div></div></section>`;
    const options=`<div class="rr154-league-pills">${data.items.map(item=>`<button type="button" data-action="league-focus" data-id="${esc(item.ex.name)}" class="${data.focus===item.ex.name?'selected':''}">${esc(item.ex.name)}${item.performance?'':' ·'}</button>`).join('')}</div>`;
    const overview=card(`<div class="row"><div><div class="eyebrow">ATHLETE STATUS</div><h3 class="mt8">${status}</h3></div><div class="league-rating">${rating==null?'—':fmt(rating)}<small>ATHLETE SCORE</small></div></div><p class="subhead">${statusText}</p><p class="fineprint">14-day inactivity grace period; after 30 days without training you leave active standings. Records and achieved divisions are preserved.</p>`,'section');
    if(!selected)return header+overview;
    if(!selected.performance)return header+card(`<h3>${esc(selected.ex.name)} · unranked</h3>${options}<p class="subhead mt16">Train this muscle group to establish your league benchmark.</p>${btn('Preview next workout','league-to-workout','outline full mt16')}`,'section')+overview+leagueFooter(areaOptions);
    const res=selected.league,entry=res.entry,s=res.standings,first=s.rows[0];
    const inFirst=s.rank===1,hold=entry.firstSince==null?0:Math.min(LEAGUES.HOLD,Date.now()-entry.firstSince),ready=inFirst&&entry.division===1;
    const label=paused?'PAUSED':res.status==='decaying'?'RATING DECAY':inFirst?(ready?'TOP DIVISION':'PROMOTION CHALLENGE'):'CLIMB THE LEADERBOARD';
    const promotionHtml=paused?`<p class="subhead mt8">Your slot is vacant until you complete another workout.</p>`:
      res.status==='decaying'?`<p class="subhead mt8">Promotion pauses until you train again.</p>`:
      ready?`<p class="subhead mt8">You lead the top ${esc(selected.ex.name)} division.</p>`:
      inFirst?`<div class="row mt12"><strong>${leagueTime(LEAGUES.HOLD-hold)} remaining</strong><span class="tiny muted">${Math.round(hold/LEAGUES.HOLD*100)}% / 24h</span></div>${bar(hold,LEAGUES.HOLD)}<p class="fineprint">Remain first continuously or the timer resets.</p>`:
      `<p class="subhead mt8">${fmt(s.gap)} points behind ${esc(first.name)}. Take first to start your 24-hour countdown.</p>`;
    const rows=(paused?s.rows.filter(x=>!x.player):s.rows).map((r,i)=>`<div class="league-row ${r.player?'mine':''}"><span class="league-position">${i+1}</span><div class="league-who"><strong>${esc(r.name)} ${r.player?'<span class="league-you">YOU</span>':''}</strong><small>${r.player?'Your muscle-group rating':esc(r.town)+' · simulated'}</small></div><span class="league-points">${fmt(r.score)}</span></div>`).join('');
    const perf=selected.performance;
    return header+card(`<div class="eyebrow">SELECT YOUR MUSCLE LEAGUE</div>${options}<div class="row league-detail-head mt16"><div><h3>${esc(selected.ex.name)}</h3><p class="subhead">${paused?'Previously Division '+entry.division:'Division '+entry.division+' · '+s.rows.length+' athletes · Rank #'+s.rank}</p></div><div class="league-rank-number">${paused?'—':'#'+s.rank}</div></div><div class="league-promo"><div class="row"><span class="eyebrow">${label}</span><span class="label-tag">${entry.division===1?'Elite':'To Division '+(entry.division-1)}</span></div>${promotionHtml}</div><div class="league-list-head"><span>POSITION / ATHLETE</span><span>GROUP SCORE</span></div><div class="league-list">${rows}</div><p class="fineprint">Your group score: ${fmt(perf.points)} · ${perf.exerciseCount} qualifying movements · ${perf.recentSessions} recent workouts. Movement-specific PBs remain in Progress.</p></div>`,'section')+
      overview+card(`<h3>How scoring works</h3><p class="subhead mt12">Your score starts at 100, adds capped improvements measured <strong>against your own first logged performance for each movement</strong> (up to 33.75 points), and gives up to 12 points for training that group during the last 28 days. More sets in one session don't endlessly add points.</p><p class="fineprint">This is a local sandbox using fictional, mathematically generated opponents. Results are not verified real-world strength comparisons.</p>`,'section')+leagueFooter(areaOptions);
  }
  function leagueFooter(areaOptions){
    return card(`<h3>Competition settings</h3><p class="subhead">Your display area adds local flavour; matchmaking remains ability-based across the fictional UK population.</p><div class="field mt12"><label for="leagueArea">Display location</label><select id="leagueArea">${areaOptions}</select></div><p class="fineprint">${LEAGUES.POPULATION.toLocaleString('en-GB')} fictional athletes, generated locally. No real accounts or background notifications. Timers use local device time and aren't tamper-proof.</p>`,'section');
  }

  function shell(body){$app.innerHTML=`<main class="shell">${title()}${body}</main>${(page==='workout'&&state.active)||page==='setup'||page==='unlock'?'':bottomNav()}<div id="toast" aria-live="polite"></div>`;}
  function allMovements(){
    const x=[],seen=new Set();
    SESSION_ORDER.forEach(day=>planFor(day).pairs.forEach(p=>p.exercises.forEach(e=>{const key=day+':'+e.id;if(!seen.has(key)){x.push({...e,day,key});seen.add(key);}})));
    state.history.forEach(session=>(session.logs||[]).forEach(l=>{const key=(session.session||'H')+':'+l.exId;if(!seen.has(key)){x.push({id:l.exId,name:l.name,muscle:l.muscle,load:l.load,sets:1,min:1,max:20,day:session.session||'H',key});seen.add(key);}}));
    return x;
  }
  function comparableSessions(movement){
    if(!movement)return [];
    return state.history.map(s=>{
      const logs=(s.logs||[]).filter(l=>l.exId===movement.id);
      if(!logs.length)return null;
      const best=bestSet(logs);
      return {date:s.endedAt||s.startedAt,sessionId:s.id,reps:logs.reduce((a,l)=>a+l.reps,0),load:best.weight||0,performance:score(best),log:logs};
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
  function consistencyCard(){const c=consistency();const from=c.since,days=Array.from({length:7},(_,i)=>{const date=dayAt(from,i),count=state.history.filter(s=>dateOnly(s.startedAt||s.endedAt)===date&&(s.planId?s.planId===tracking().planId:tracking().planId==='pump')).length;return {date,name:new Date(date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short'}),count};});return card(`<div class="row"><h3>Training consistency</h3><span class="label-tag">Week ${c.week+1}</span></div><p class="subhead mt8">${dateText(c.since)} – ${dateText(c.through)} · target ${c.goal} sessions</p><div class="row mt12"><h2 class="feature-title">${c.done} / ${c.goal} workouts</h2><strong>${c.percentage}% over recent training weeks</strong></div>${bar(Math.min(c.done,c.goal),c.goal)}<div class="week-days mt12">${days.map(d=>`<div class="week-day ${d.count?'trained':''}"><small>${esc(d.name)}</small><b>${d.date.slice(-2)}</b>${d.count?'✓':''}</div>`).join('')}</div><p class="fineprint">Training weeks are consecutive 7-day blocks anchored to when you started this plan. Rest days do not count against your goal. Extra sessions never push the percentage over 100%.</p>`,'section');}
  // Optional daily subjective check-in (kept separately for each local athlete).
  const SORE_GROUPS=['Chest','Back','Shoulders','Arms','Legs','Core'];
  function readinessLog(){if(!Array.isArray(profile().readinessLog))profile().readinessLog=[];return profile().readinessLog;}
  function todayReadiness(){return readinessLog().find(x=>x.day===todayLocal())||null;}
  function readinessGuidance(){
    const r=todayReadiness();if(!r)return null;
    const fatigue=Number(r.fatigue)||0,sore=Number(r.soreness)||0,poor=r.sleep==='poor';
    const week=state.history.filter(s=>Date.now()-Date.parse(s.endedAt||s.startedAt||'')<7*86400000).length;
    let extra=(fatigue>=3?12:0)+(sore>=3?12:0)+(poor?12:0)+(week>=4?6:0);
    extra=Math.min(36,extra);
    let message=extra>=24?'Your check-in suggests a lighter session, reduced sets or a rest day may be helpful.':extra>=12?'Ease into your warm-up and adjust intensity or volume if needed.':'You report feeling reasonably ready. Use your warm-up to confirm.';
    return {r,extra,message};
  }
  function readinessPreview(){
    const current=todayReadiness(),dismissed=profile().readinessDismissed===todayLocal(),guide=readinessGuidance();
    if(current)return card(`<div class="row"><h3>Daily readiness</h3><span class="label-tag">TODAY · SAVED</span></div><p class="subhead mt12">${esc(guide.message)}</p><div class="rr154-ready-summary"><span>Fatigue ${current.fatigue}/4</span><span>Soreness ${current.soreness}/4</span><span>Sleep ${esc(current.sleep)}</span></div><button type="button" class="btn outline full mt12" data-action="readiness">Edit today's check-in</button>`,'section');
    if(dismissed)return '';
    return card(`<div class="row"><div><div class="eyebrow">10-SECOND CHECK-IN</div><h3 class="mt8">How are you feeling?</h3></div><span class="label-tag">OPTIONAL</span></div><p class="subhead mt8">Fatigue, sleep and sore muscles help tailor today's training guide.</p><div class="row mt16"><button type="button" class="btn primary" data-action="readiness">Check in →</button><button type="button" class="btn text" data-action="dismiss-readiness">Not today</button></div>`,'section');
  }
  function readinessScreen(){
    const r=todayReadiness()||{},prior=readinessLog().slice(-7).reverse();
    return `<div class="eyebrow">PERSONAL RECOVERY · ${todayLocal()}</div><h1 class="page-title">Daily readiness</h1><p class="lead">How you feel matters more than a fixed countdown. This is a guide, not a medical measurement.</p>${card(`<form id="readinessForm" class="stack rr154-checkin"><div class="field"><label for="fatigue">General fatigue</label><select name="fatigue" id="fatigue">${['Fresh','Good','Moderate','Tired','Exhausted'].map((label,i)=>`<option value="${i}" ${Number(r.fatigue??1)===i?'selected':''}>${i} · ${label}</option>`).join('')}</select></div><div class="field"><label for="soreness">Muscle soreness</label><select name="soreness" id="soreness">${['None','Mild','Moderate','Quite sore','Very sore'].map((label,i)=>`<option value="${i}" ${Number(r.soreness??1)===i?'selected':''}>${i} · ${label}</option>`).join('')}</select></div><div class="field"><label for="sleep">Sleep quality</label><select name="sleep" id="sleep"><option value="good" ${r.sleep==='good'?'selected':''}>Good</option><option value="okay" ${r.sleep==='okay'?'selected':''}>Okay</option><option value="poor" ${r.sleep==='poor'?'selected':''}>Poor</option></select></div><fieldset class="rr154-sore"><legend>Which areas are sore? <small>Optional</small></legend><div class="rr154-sore-options">${SORE_GROUPS.map(g=>`<label><input type="checkbox" name="soreGroup" value="${g}" ${(r.groups||[]).includes(g)?'checked':''}><span>${g}</span></label>`).join('')}</div></fieldset><button class="btn primary full" type="submit">Save today's check-in →</button><button class="btn outline full" type="button" data-page="home">Return to Home</button></form>`,'section')}${prior.length?card(`<h3>Recent check-ins</h3>${prior.map(x=>`<div class="rr154-checkin-history"><strong>${esc(x.day)}</strong><span>Fatigue ${x.fatigue} · Soreness ${x.soreness} · ${esc(x.sleep)} sleep</span></div>`).join('')}`,'section'):''}<p class="fineprint">Check-ins are private to this device/profile. You can always train; guidance never blocks a workout.</p>`;
  }
  function recoveryWindow(){
    const completed=state.history
      .map(s=>({session:s,when:Date.parse(s.endedAt||s.startedAt||'')}))
      .filter(x=>Number.isFinite(x.when)&&x.when<=Date.now())
      .sort((x,y)=>y.when-x.when)[0];
    if(!completed)return {hasWorkout:false,remaining:0,hours:48};
    const override=Number(profile().recoveryHours)||0;
    const hours=[24,36,48,72].includes(override)?override:
      ([24,36,48,72].includes(Number(completed.session.recovery))?Number(completed.session.recovery):48);
    const guide=readinessGuidance();
    const adjustedHours=Math.min(96,hours+(guide?.extra||0));
    const remaining=Math.max(0,completed.when+adjustedHours*3600000-Date.now());
    return {hasWorkout:true,remaining,hours:adjustedHours,baselineHours:hours,guide};
  }
  function recoveryText(remaining){
    if(remaining<=0)return 'Window reached';
    const mins=Math.ceil(remaining/60000);
    const h=Math.floor(mins/60),m=mins%60;
    return h?`${h}h${m?' '+String(m).padStart(2,'0')+'m':''} remaining`:`${m}m remaining`;
  }
  function recoveryIndicator(){
    const r=recoveryWindow();
    return `<div class="plan-recovery" aria-label="Recovery planning timer"><span class="plan-recovery-icon" aria-hidden="true">◷</span><div class="plan-recovery-content"><strong>Recovery guide</strong><span data-recovery-countdown>${r.hasWorkout?recoveryText(r.remaining):'Starts after your first workout'}</span></div>${r.hasWorkout?`<span class="recovery-hours">${r.hours}h guide</span>`:''}</div>`;
  }
  function home(){
    const a=state.active,missing=workoutsUntilCalibration(),rating=athleteIndex(),c=consistency(),leagueRating=leagueInactivity();
    const session=a?.session||state.next;
    const all=allLogs(),latest=state.history.at(-1),bests=Object.values(bestByExercise(all)).sort((x,y)=>new Date(y.loggedAt)-new Date(x.loggedAt));
    const bm=profile().body,ws=[...(bm.measurements||[])].sort((x,y)=>x.date.localeCompare(y.date));
    const days=ws.map(m=>({date:m.date,value:+chartWeight(m.kg).toFixed(2)}));
    const gains=allMovements().map(m=>({m,change:muscleChange(m.muscle)})).filter(x=>x.change?.count&&x.change.change>0).sort((x,y)=>y.change.change-x.change.change);
    const insight=!state.history.length?'Your first workout will establish your baseline.':gains.length?`${gains[0].m.muscle} is your most improved muscle group (${progressPct(gains[0].change.change)} versus baseline).`:'Complete another session for the same movement to reveal a meaningful training insight.';
    const weigh=scheduledWeighStatus(), weightInfo=weigh.enabled?(weigh.due?'Weigh-in due today':weigh.done?'Weighed in today':weigh.next?'Next: '+dateText(weigh.next):'Schedule on'):'Optional weigh-ins';
    const planMeta=window.REPRIVAL_PLAN_LIBRARY.details[selectedPlan]||{};
    const currentIndex=Math.max(0,SESSION_ORDER.indexOf(session)),rotationCount=SESSION_ORDER.length;
    const displayRating=rating.value==null?'—':fmt(leagueRating.adjusted);
    const planName=esc(selectedPlan===ADAPT_ID?'Adaptive Training':planMeta.title||'Training plan');
    const nextName=esc(planFor(session).name||('Workout '+session));
    const greeting=esc((profile().username||'Athlete').split(' ')[0]);
    const pbTotal=state.history.reduce((n,s)=>n+(s.prs||[]).length,0);
    return `<section class="rr153-home-hero">
        <div class="rr153-waves" aria-hidden="true"></div>
        <div class="rr153-greeting"><span class="eyebrow">A HIGHER STANDARD. EVERY DAY.</span><h1>Good morning,<br><em>${greeting}.</em></h1><span class="rr153-discipline">Your progress is the competition.</span><button type="button" class="rr161-checkin" data-action="readiness">${todayReadiness()?"✓ Check-in saved · edit":"＋ Daily check-in"}</button></div>
        <div class="rr153-score-inset"><span>ATHLETE SCORE</span><div class="rr153-score-value">${displayRating}<i class="rr153-score-ring" aria-hidden="true"></i></div><small>${rating.value==null?'Establishing baseline':leagueRating.status==='active'?'Keep climbing':'Return to restore rating'}</small></div>
        <div class="rr160-hero-quick"><button type="button" data-page="workout-intro" class="rr160-next-pill"><small>${a?'RESUME WORKOUT':'NEXT WORKOUT'}</small><strong>${nextName}</strong><span aria-hidden="true">→</span></button><div class="rr160-recovery-pill">${recoveryIndicator()}</div></div>
      </section>
      <section class="rr153-plan section" data-nav="plan" role="button" tabindex="0" aria-label="View your training plan">
        <div class="row"><span class="eyebrow">CURRENT PLAN</span><span class="rr153-card-arrow" aria-hidden="true">↗</span></div>
        <h2>${planName}</h2>
        <div class="rr153-plan-label"><span>${adaptivePlan()?'Next adaptive session':'Rotation progress'}</span><b>${adaptivePlan()?'Ready':currentIndex+' / '+rotationCount}</b></div>
        <div class="rotation-track" role="progressbar" aria-valuenow="${currentIndex}" aria-valuemax="${rotationCount}" aria-valuemin="0" aria-label="Plan rotation progress">${SESSION_ORDER.map((id,i)=>`<span class="rotation-segment ${adaptivePlan()?'complete':i<currentIndex?'complete':i===currentIndex?'next':''}"></span>`).join('')}</div>
      </section>
      <div class="rr153-kpis section">
        <div class="rr153-kpi"><span>WORKOUTS</span><strong>${c.done}<small> / ${c.goal}</small></strong><em>this week</em></div>
        <div class="rr153-kpi"><span>PERSONAL BESTS</span><strong>${pbTotal}</strong><em>all time</em></div>
        <div class="rr153-kpi"><span>CONSISTENCY</span><strong>${c.percentage}<small>%</small></strong><em>this week</em></div>
      </div>
      ${adaptiveReviewDue()?card(`<div class="row"><h3>Your focus review is due</h3><span class="label-tag">ADAPTIVE</span></div><p class="subhead mt8">Review your muscle priorities and recent recovery before changing your focus.</p><button class="btn outline full mt12" data-action="adaptive-review">Review my training focus →</button>`,'section'):''}
      ${card(`<div class="row"><h3>Muscle performance</h3><span class="label-tag">RECENT TRAINING</span></div>${musclePanel(true)}`,'section')}
      ${card(`<div class="row"><h3>Body weight</h3>${btn('Weigh in +','weigh-in','outline')}</div><div class="row mt12"><h2 class="weight-current">${ws.length?displayWeight(ws.at(-1).kg):'No weigh-ins yet'}</h2><span class="label-tag ${weigh.due?'weight-due':''}">${esc(weightInfo)}</span></div>${days.length>1?`<div class="compact-weight-chart">${drawChart(days)}</div>`:'<p class="subhead">Your weight trend appears after two weigh-ins.</p>'}<p class="fineprint">${weigh.enabled?`Scheduled: ${weighSchedule().days.map(i=>WEEKDAYS[i]).join(', ')} · `:''}Edit your reminder days in Body metrics. The chart uses ${weightUnitLabel()}.</p>`,'section')}
      ${bests.length?card(`<div class="row"><h3>Latest milestone</h3><span class="label-tag">PB</span></div><p class="subhead mt12"><strong>${esc(bests[0].name)}</strong> · ${esc(scoreLabel(bests[0]))}</p>`,'section'):''}
      ${card(`<div class="row"><h3>Latest insight</h3><span class="label-tag">From your workouts</span></div><p class="subhead mt12">${esc(insight)}</p>`,'section')}
      ${canImportOwnerBaseline()&&!state.history.length?card(`<h3>Bring in your first session</h3><p class="subhead">Import your 17 October Workout A baseline as 18 individual sets.</p>${btn('Import V5 baseline','import-v5','outline full')}`,'section'):''}`;
  }


  function workoutLanding(){
    const a=state.active,day=a?.session||state.next,session=planFor(day),pairs=session.pairs||[];
    const exercises=pairs.flatMap(p=>p.exercises),sets=exercises.reduce((n,e)=>n+e.sets,0);
    const estimate=adaptivePlan()?Math.round(5+sets*1.32+pairs.length*2.15+exercises.length*.65):Math.max(20,Math.ceil((sets*1.6+pairs.length*1.5)/5)*5);
    const completed=a?.logs?.filter(Boolean).length||0;
    const groups=pairs.map((p,i)=>`<div class="preworkout-block"><div class="preworkout-block-header"><span>${p.exercises.length>1?'SUPERSET':'BLOCK'} ${i+1}</span><span>${p.restMin}–${p.restMax}s rest</span></div>${p.exercises.map(ex=>`<div class="preworkout-ex"><div><strong>${esc(ex.name)}</strong><small>${esc(ex.muscle)} · ${esc(ex.min)}–${esc(ex.max)} ${esc(ex.unit||'reps')} ${esc(ex.suffix||'')}</small></div><span class="preworkout-sets">${ex.sets} sets</span></div>`).join('')}</div>`).join('');
    const focus=[...new Set(exercises.map(x=>x.muscle).filter(Boolean))].slice(0,6);
    const guide=readinessGuidance();const sore=(guide?.r?.groups||[]);const hitsSore=focus.filter(m=>sore.includes(leagueGroupFor(m))); 
    return `<section class="rr153-prep-hero">
        <div class="rr153-prep-waves" aria-hidden="true"></div>
        <span class="eyebrow">${a?'RESUME SESSION':'TRAINING SESSION'} · ${esc(window.REPRIVAL_PLAN_LIBRARY.details[selectedPlan]?.title||'YOUR PLAN')}</span>
        <h1>${esc(session.name||'Workout '+day)}</h1><p>${a?'Pick up where you left off. All logged sets are preserved.':'Build strength. Track progress. Compete with yesterday.'}</p>
        <div class="rr153-prep-meta"><div><span>◷</span><strong>~${estimate} min</strong><small>ESTIMATED</small></div><div><span>♧</span><strong>${exercises.length} movements</strong><small>THIS SESSION</small></div><div><span>▥</span><strong>${sets} sets</strong><small>WORKING</small></div></div>
      </section>
      <section class="rr153-focus-card section"><div class="row"><span class="eyebrow">WHAT YOU'LL TRAIN</span><span class="rr153-focus-count">${focus.length} MUSCLE GROUPS</span></div><div class="rr153-focus-list">${focus.map((m,i)=>`<div class="rr153-focus-item"><span class="rr153-focus-bar" aria-hidden="true"><i style="height:${14+((i*17)%23)}px"></i></span><strong>${esc(m)}</strong><span>↗</span></div>`).join('')}</div></section>
      ${adaptivePlan()?card(`<div class="row"><h3>Why this session?</h3><span class="label-tag">ADAPTIVE</span></div><p class="subhead mt8">${esc(profile().adaptive?.lastReason||'Training is balanced around your priorities and recovery.')}</p><button class="btn outline full mt12" data-action="regenerate-adaptive" ${a?'disabled':''}>↻ Randomise workout · same focus</button>`,'section'):''}
      ${guide?card(`<div class="row"><h3>Today's readiness guide</h3><span class="label-tag">FROM YOUR CHECK-IN</span></div><p class="subhead mt8">${esc(guide.message)}</p>${hitsSore.length?`<p class="fineprint">Reported soreness overlaps this session: ${esc([...new Set(hitsSore.map(leagueGroupFor))].join(', '))}. Consider a gentler warm-up or substitutions.</p>`:''}`,'section'):card(`<div class="row"><h3>Readiness</h3><button type="button" class="btn text" data-action="readiness">Check in →</button></div><p class="subhead">Optional: add fatigue, sleep and muscle soreness to tailor today's guide.</p>`,'section')}
      <div class="rr153-prep-start section"><button class="btn primary full" type="button" data-action="begin">${a?'Resume workout':'Begin workout'} <span aria-hidden="true">→</span></button><p>${a?`${completed} sets already recorded`:'Your workout timer starts when you begin'}</p></div>
      ${card(`<div class="row"><h3>Session selection</h3><span class="label-tag">${esc(day)}</span></div>
        ${a?`<div class="preworkout-active">${completed} of ${buildTasks(day).length} sets recorded · safe to resume</div>`:`<div class="session-choices">${SESSION_ORDER.map(id=>`<button type="button" class="${id===day?'chosen':''}" data-action="choose-session" data-id="${esc(id)}">${esc(id)} · ${esc(planFor(id).name||'Workout '+id)}</button>`).join('')}</div>`}`,'section')}
      ${card(`<div class="row"><h3>Session breakdown</h3><span class="label-tag">${pairs.length} blocks</span></div>${groups}`,'section')}
      <p class="rr153-prep-footer">Every working set counts. Your previous records appear when you begin.</p>`;
  }

  function startWorkout(){
    if(!state.active){
      state.active={session:state.next,planId:selectedPlan,planVersion:state.settings.planVersion||0,taskIndex:0,logs:[],startedAt:new Date().toISOString(),stage:'lift',restUntil:null,restNote:'',restSeconds:0};save();
    }
    page='workout';render();
  }
  function previousMatchingSet(exId,round){
    for(const session of [...state.history].reverse()){
      const logs=(session.logs||[]).filter(x=>x.exId===exId);
      if(logs.length)return logs.find(l=>l.round===round)||logs[Math.min(round-1,logs.length-1)];
    }return null;
  }
  function weightStep(ex){return ex.load==='combined'?5:2.5;}
  function legalWeight(value,ex){const step=weightStep(ex);return +(Math.max(step,Math.round(Number(value)/step)*step)).toFixed(2);}
  function recommend(ex,previous){
    if(!previous)return {weight:ex.load==='bodyweight'?0:'',reps:ex.min,reason:'First benchmark · select your actual working load'};
    const isBody=ex.load==='bodyweight',weight=Number(previous.weight)||0,reps=Number(previous.reps)||ex.min,rir=previous.rir==null?null:Number(previous.rir);const w=isBody?0:legalWeight(weight,ex);
    // Never auto-increase weights based on an unknown RIR.
    if(rir!=null&&reps>=ex.max&&rir>=2&&!isBody){const next=w+weightStep(ex);return {weight:next,reps:ex.min,reason:`Top of rep range reached · next available ${ex.load==='combined'?'pair':'dumbbell'} increment`};}
    if(rir!=null&&rir>=3&&reps<ex.max)return {weight:w,reps:reps+1,reason:'Good reserve · aim for one more rep'};
    if(rir===0)return {weight:w,reps:Math.max(ex.min,Math.min(reps,ex.max)),reason:'Maximum effort last time · hold steady'};
    if(reps<ex.min)return {weight:w,reps:ex.min,reason:'Return to the lower end of the target range'};
    if(rir==null)return {weight:w,reps:Math.min(reps,ex.max),reason:'Previous RIR unknown · maintain target until effort is recorded'};
    return {weight:w,reps:Math.min(ex.max,reps+(rir>=2?1:0)),reason:rir>=2?'Progress by one rep when ready':'Maintain weight and reps'};
  }
  function movementCue(ex){
    const n=(ex.name+' '+ex.id).toLowerCase();
    const specific=window.REPRIVAL_EXERCISE_ART?.[ex.id];
    let key='';
    if(!specific){
      // Only use a representative illustration when the movement type is recognisable.
      if(/inverted|row|pull|chin/.test(n))key='row';
      else if(/incline.*(press|bench)/.test(n))key='incline';
      else if(/fly|flye/.test(n)&&/chest|pec/.test(n))key='fly';
      else if(/skull|lying tricep/.test(n))key='skull';
      else if(/squat|goblet/.test(n))key='squat';
      else if(/lunge|split squat|step.up/.test(n))key='lunge';
      else if(/swing/.test(n))key='swing';
      else if(/deadlift|rdl|hinge/.test(n))key='hinge';
      else if(/incline.*curl/.test(n))key='curl';
      else if(/curl/.test(n))key='curl';
      else if(/rear.delt|reverse fly/.test(n))key='rear';
      else if(/lateral|side raise/.test(n))key='raise';
      else if(/front raise/.test(n))key='front';
      else if(/upright row/.test(n))key='upright';
      else if(/overhead|shoulder press/.test(n))key='overhead';
      else if(/rollout|ab.wheel|plank|core|crunch|sit.up/.test(n))key='core';
      else if(/dip|tricep/.test(n))key='dip';
      else if(/carry/.test(n))key='carry';
      else if(/push.up|pushup/.test(n))key='pushup';
      else if(/bench|press/.test(n))key='bench';
    }
    const slug=specific||window.REPRIVAL_FALLBACK_ART?.[key];
    if(!slug)return '';
    const src=window.REPRIVAL_EMBEDDED_ART?.[slug];
    if(!src)return '';
    const description=specific?'Exercise illustration':'Representative exercise illustration';
    return `<button type="button" class="art-open" data-action="view-art" aria-label="Enlarge illustration for ${esc(ex.name)}"><img class="exercise-cue exercise-art" src="${src}" alt="${esc(ex.name)} — ${description}" loading="lazy"></button>`;
  }

  function workout(){
    if(!state.active)return workoutLanding();
    const a=state.active;if(a.stage==='feedback')return feedbackView();
    const tasks=buildTasks(a.session),group=fullRound(tasks,a.taskIndex);
    if(!group.items.length)return `<h2>Session ready</h2>${btn('Finish session','feedback','primary full')}`;
    if(a.stage==='rest')return restView(tasks,group.task);
    const pair=group.task.pair,isSolo=group.items.length===1,done=a.logs.filter(Boolean).length,draft=a.drafts?.[group.start]||{},next=fullRound(tasks,group.end+1);
    return `<div class="compact-workout"><div class="row workout-top-actions"><button type="button" class="quiet-link" data-action="back-round">← Back</button><details class="workout-menu"><summary>••• Options</summary><div class="menu-items">${btn('Save & exit','pause','outline full')}${btn('Discard workout','discard','text full')}</div></details></div>
      <div class="rr153-active-header"><div class="row"><span class="eyebrow">LIVE SESSION <b>●</b></span><span class="rr153-set-counter">${done} / ${tasks.length} sets logged</span></div><h1>${esc(planFor(a.session).name||'WORKOUT '+a.session)}</h1><p>${isSolo?'MOVEMENT':'SUPERSET '+esc(pair.id)} · ROUND ${group.task.round} OF ${group.task.rounds}</p>${bar(done,tasks.length)}</div>
      <form id="roundForm" class="round-form">${group.items.map((t,i)=>{const ex=t.ex,idx=t.index,prev=previousMatchingSet(ex.id,t.round),rec=recommend(ex,prev),logged=a.logs[idx],weight=draft[`weight-${idx}`]??(logged?.weight??rec.weight),reps=draft[`reps-${idx}`]??(logged?.reps??rec.reps),rir=draft[`rir-${idx}`]??(logged?.rir??''),editing=!!draft[`edit-${idx}`]||!!logged;
        const value=ex.load==='bodyweight'?'BW':weight===''?'Choose weight':fmt(weight)+' kg';
        return `<section class="movement-entry mini-exercise"><div class="mini-head"><div class="mini-title"><span class="eyebrow">${isSolo?'MOVEMENT':(i+1)+' OF '+group.items.length} · SET ${t.round}/${ex.sets}</span><h2>${esc(ex.name)}</h2><p class="tiny muted">${esc(ex.muscle)} · ${ex.min}–${ex.max} ${esc(ex.unit||'reps')}</p></div>${`<div class="cue-stack">${movementCue(ex)}${personalBests(ex.id)?.best?`<span class="mini-pb">🏆 Best ${esc(scoreLabel(personalBests(ex.id).best))}</span>`:"<span class=\"mini-pb empty-pb\">Setting baseline</span>"}</div>`}</div>
        <div class="mini-target"><div><span class="eyebrow">RECOMMENDED</span><strong>${value} × ${esc(reps)}</strong></div><button type="button" class="quiet-link" data-action="toggle-edit" data-index="${idx}" data-group="${group.start}">${editing?'Done':'✎ Edit'}</button></div>
        <div class="mini-previous">${prev?'Previous set '+t.round+': '+esc(scoreLabel(prev))+' · '+(prev.rir??'—')+' RIR':'First benchmark · choose a weight using Edit'}</div>
        <div class="form-grid compact-edit ${editing?'':'hidden-edit'}" data-edit-fields="${idx}"><div class="field"><label>Actual weight (kg)</label><input name="weight-${idx}" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(weight)}" ${ex.load==='bodyweight'?'disabled':''}></div><div class="field"><label>Actual ${esc(ex.unit||'reps')}</label><input name="reps-${idx}" type="number" inputmode="numeric" min="1" max="99" value="${esc(reps)}" required></div></div>
        <div class="rir-row"><span>Reps you had left (RIR)</span><div class="rir-options">${[0,1,2,3,4,5].map(n=>`<label><input type="radio" name="rir-${idx}" value="${n}" ${String(rir)===String(n)?'checked':''} required><span>${n===5?'5+':n}</span></label>`).join('')}</div></div></section>`;
      }).join('')}<div class="up-next"><div><span class="eyebrow">UP NEXT</span><strong>${next.items.length?next.task.pair.id===pair.id?'Round '+next.task.round+' of '+next.task.rounds:next.items.map(t=>t.ex.name).join(' + '):'Finish workout'}</strong><span>${next.items.length?next.task.pair.id===pair.id?'Same exercises':'Prepare next movement(s)':'Review and save your session'}</span></div><div class="next-rest">${next.items.length?`Rest<strong>${pair.restMin}–${pair.restMax}s</strong>`:''}</div></div>
      <button class="btn primary full round-log-button" type="submit">${group.items.some(t=>a.logs[t.index])?'Update':'Log'} ${isSolo?'set':'superset round'} →</button></form>
      </div>`;
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
    const finished={id:String(Date.now()),session:a.session,sessionName:planFor(a.session).name,planId:a.planId,planVersion:a.planVersion,startedAt:a.startedAt,endedAt:new Date().toISOString(),logs,feeling,recovery,prs};
    state.history.push(finished);
    state.lastSummary=finished.id;state.next=nextLetter(a.session);state.active=null;
    if(a.planId===ADAPT_ID&&profile().adaptive?.active){profile().adaptive.sequence=(profile().adaptive.sequence||0)+1;createAdaptiveNext(0);}
    save();page='summary';render();
  }

  function finishPartial(){
    if(!state.active)return;
    if(state.active.logs.length===0){state.active=null;save();page='home';render();return;}
    if(confirm('End this workout and save the sets completed?')){
      state.active.stage='feedback';save();render();
    }
  }
  // Derived from the canonical set logs so historic corrections remain authoritative.
  function sessionMovements(session){
    const groups=new Map();
    for(const l of (session?.logs||[])){
      if(!groups.has(l.exId))groups.set(l.exId,{id:l.exId,name:l.name,muscle:l.muscle,logs:[]});
      groups.get(l.exId).logs.push(l);
    }
    return [...groups.values()].map(g=>({...g,best:bestSet(g.logs)}));
  }
  function previousSameWorkout(session){
    const sessions=state.history.filter(x=>x.id!==session.id&&x.session===session.session&&(x.planId||'pump')===(session.planId||'pump')&&new Date(x.endedAt||x.startedAt)<new Date(session.endedAt||session.startedAt));
    return sessions.sort((a,b)=>new Date(b.endedAt||b.startedAt)-new Date(a.endedAt||a.startedAt))[0]||null;
  }
  function compareWorkout(session){
    const previous=previousSameWorkout(session),prior=new Map(sessionMovements(previous).map(m=>[m.id,m]));
    const entries=sessionMovements(session).map(m=>{
      const before=prior.get(m.id),old=before?.best,next=m.best;
      const change=old&&score(old)>0?(score(next)/score(old)-1)*100:null;
      const stable=change!=null&&Math.abs(change)<.5;
      const direction=change==null?'baseline':stable?'maintained':change>0?'improved':'lower';
      const beforeAll=state.history.filter(x=>x.id!==session.id&&new Date(x.endedAt||x.startedAt)<new Date(session.endedAt||session.startedAt)).flatMap(x=>(x.logs||[]).filter(l=>l.exId===m.id));
      const pb=beforeAll.length>0&&score(next)>score(bestSet(beforeAll))+.00001;
      return {...m,old,change,direction,pb};
    });
    return {previous,entries,improved:entries.filter(x=>x.direction==='improved').length,maintained:entries.filter(x=>x.direction==='maintained').length,lower:entries.filter(x=>x.direction==='lower').length,pbs:entries.filter(x=>x.pb).length};
  }
  function movementSelectionPanel(){
    const movements=allMovements(),overrides=profile().trendOverrides||{added:[],hidden:[]};
    const cutoff=Date.now()-7*86400000;
    const recentIds=new Set(state.history.filter(s=>Date.parse(s.endedAt||s.startedAt||'')>=cutoff).flatMap(s=>(s.logs||[]).map(l=>l.exId)));
    const auto=movements.filter(m=>recentIds.has(m.id)).map(m=>m.id);
    const asId=key=>movements.find(m=>m.key===key)?.id||key;
    const selectedIds=new Set([...auto,...(overrides.added||[]).map(asId),...(profile().selectedMovements||[]).map(asId)]);
    const hiddenIds=new Set((overrides.hidden||[]).map(asId));
    const unique=[...new Map(movements.map(m=>[m.id,m])).values()];
    const chosen=unique.filter(m=>selectedIds.has(m.id)&&!hiddenIds.has(m.id));
    return `<div class="row"><div><h3>Movement trends</h3><p class="subhead">${chosen.length} movement${chosen.length===1?'':'s'} tracked · auto-filled from the last 7 days</p></div><button type="button" class="btn outline" data-action="modify-trends">${trendEditing?'Done':'Modify'}</button></div>
      ${trendEditing?`<div class="rr160-trends-editor"><p class="subhead">Recent movements appear automatically. Add others or hide any you don't want to follow.</p><div class="movement-picker">${unique.map(m=>`<button type="button" class="movement-option ${chosen.some(x=>x.id===m.id)?'picked':''}" data-action="trend-select" data-id="${esc(m.id)}"><span>${esc(m.name)}</span><strong>${chosen.some(x=>x.id===m.id)?'✓':'+'}</strong></button>`).join('')}</div></div>`:''}
      ${chosen.length?chosen.map(m=>{const series=comparableSessions(m),first=series[0],last=series.at(-1),pct=series.length>1?(last.performance/Math.max(.01,first.performance)-1)*100:null;return `<div class="trend-card"><div class="row"><h3>${esc(m.name)}</h3>${trendEditing?`<button class="quiet-link" data-action="trend-select" data-id="${esc(m.id)}">Remove</button>`:''}</div><div class="movement-detail-summary mt12"><div><span>Starting</span><strong>${first?esc(scoreLabel(bestSet(first.log))):'—'}</strong></div><div><span>Latest</span><strong>${last?esc(scoreLabel(bestSet(last.log))):'—'}</strong></div><div><span>Change</span><strong>${progressPct(pct)}</strong></div></div>${drawChart(series.map(x=>({date:x.date,value:x.performance})))}<p class="fineprint">Best recorded set per session · estimated movement performance.</p></div>`;}).join(''):'<p class="subhead mt16">No workouts from the last seven days yet. Press Modify to follow a movement.</p>'}`;
  }
  function progressJourney(){
    const timeframe=state.settings.journeyPeriod||'all',workout=state.settings.journeyWorkout||'all';
    const now=Date.now(),cutoff=timeframe==='30'?now-30*86400000:timeframe==='90'?now-90*86400000:null;
    const ordered=[...state.history].sort((a,b)=>new Date(a.endedAt||a.startedAt)-new Date(b.endedAt||b.startedAt));
    const filtered=ordered.filter(s=>(workout==='all'||s.session===workout)&&(!cutoff||new Date(s.endedAt||s.startedAt).getTime()>=cutoff));
    const movementHistory=new Map();
    for(const s of filtered)for(const m of sessionMovements(s)){
      if(!movementHistory.has(m.id))movementHistory.set(m.id,[]);
      movementHistory.get(m.id).push({session:s,best:m.best,name:m.name,muscle:m.muscle});
    }
    let improved=0,maintained=0,pbCount=0;
    const rows=[...movementHistory].map(([id,items])=>{
      let record=null,ups=0,holds=0,records=0;
      for(let i=0;i<items.length;i++){
        const cur=items[i],prior=items[i-1];
        if(prior){const diff=score(cur.best)/Math.max(score(prior.best),.001)-1;if(diff>.005){ups++;improved++;}else if(Math.abs(diff)<=.005){holds++;maintained++;}}
        if(record&&score(cur.best)>score(record)+.00001){records++;pbCount++;}
        if(!record||score(cur.best)>score(record))record=cur.best;
      }
      const start=items[0].best,end=items.at(-1).best,pct=items.length>1?(score(end)/Math.max(score(start),.001)-1)*100:null;
      return {id,name:items[0].name,items,start,end,pct,ups,holds,records};
    });
    const improvedMovements=rows.filter(r=>r.pct!=null&&r.pct>.5).length;
    const options=(values,sel)=>values.map(([v,label])=>`<option value="${v}" ${v===sel?'selected':''}>${label}</option>`).join('');
    return card(`<div class="row"><h3>Performance Journey</h3><span class="label-tag">${filtered.length} workouts</span></div>
      <p class="subhead">Your progress in each movement's <strong>best working set</strong>. Every correction to past workouts automatically updates these results.</p>
      <div class="form-grid mt12"><div class="field"><label>Period</label><select id="journeyPeriod">${options([['all','All time'],['30','Last 30 days'],['90','Last 90 days']],timeframe)}</select></div>
      <div class="field"><label>Workout</label><select id="journeyWorkout">${options([['all','All workouts'],...Array.from(new Set(ordered.map(x=>x.session))).map(x=>[x,'Workout '+x])],workout)}</select></div></div>
      <div class="journey-stats mt16"><div class="metric"><strong>${improved}</strong><span>Improved movement sessions</span></div><div class="metric"><strong>${maintained}</strong><span>Maintained</span></div><div class="metric"><strong>${pbCount}</strong><span>New PBs after baseline</span></div></div>
      <p class="notice mt12">${filtered.length?`${improvedMovements} of ${rows.length} tracked movements improved from their first to latest session in this selection. Comparisons use single best sets; different set counts do not automatically lower your score.`:'No completed workouts in this period yet.'}</p>
      <div class="journey-movement-panel"><h3 class="mt20">Movement graphs</h3><p class="subhead">Choose the exercises you want to follow. Show as many graphs as you like; selections are saved for your athlete.</p>${movementSelectionPanel()}</div>
      <p class="fineprint">PB totals are counted within the selected period, not against records set before it. A new exercise starts its own baseline; results across different exercise types are not merged. Weighted strength scores are estimates, while bodyweight movements are compared by recorded repetitions.</p>`,'section');
  }
  function editHistoryScreen(){
    const id=state.settings.editSessionId,s=state.history.find(x=>x.id===id);
    if(!s)return `<h1>Workout not found</h1>${btn('Back','last-summary','outline')}`;
    return `<div class="eyebrow">CORRECT COMPLETED WORKOUT</div><h1 class="page-title">Edit Workout ${esc(s.session)}.</h1><p class="lead">Update old entries, including missing RIR. Your existing session and original set count will be preserved.</p>
      ${card(`<form id="historyEditForm" class="stack"><div class="field"><label>Workout date</label><input type="date" name="date" value="${esc(dateOnly(s.startedAt||s.endedAt))}" required></div>
      ${s.logs.map((l,i)=>`<div class="history-edit-set"><div class="row"><strong>${esc(l.name)}</strong><span class="label-tag">Set ${l.round||i+1}</span></div><div class="history-edit-grid"><div class="field"><label>Weight (kg)</label><input type="number" min="0" step="0.5" name="weight-${i}" value="${num(l.weight)}" ${l.load==='bodyweight'?'disabled':''} required></div><div class="field"><label>Reps</label><input type="number" min="1" max="99" name="reps-${i}" value="${num(l.reps)}" required></div><div class="field"><label>RIR</label><select name="rir-${i}"><option value="">Unknown</option>${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${l.rir!=null&&Number(l.rir)===n?'selected':''}>${n===5?'5+':n}</option>`).join('')}</select></div></div></div>`).join('')}
      <button type="submit" class="btn primary full">Save corrections</button>${btn('Cancel','cancel-history-edit','outline full')}</form>`,'section')}`;
  }
  function summary(){
    const s=state.history.find(x=>x.id===state.lastSummary)||state.history.at(-1);
    if(!s)return home();
    const groups=[];
    (s.logs||[]).forEach(l=>{let g=groups.find(x=>x.id===l.exId);if(!g){g={id:l.exId,name:l.name,load:l.load,muscle:l.muscle,sets:[]};groups.push(g);}g.sets.push(l);});
    const comparison=compareWorkout(s);
    const vol=s.logs.reduce((a,l)=>a+Number(l.weight||0)*l.reps,0);
    const reps=s.logs.reduce((a,l)=>a+l.reps,0);
    const rir=s.logs.filter(l=>l.rir!=null);
    return `<div class="eyebrow">WORKOUT HISTORY · ${dateText(s.endedAt)}</div><h1 class="page-title">${esc(s.sessionName||'Full Body '+s.session)}</h1><p class="lead">Your complete session, set by set — plus what changed since your previous matching workout.</p>
      <div class="three-stat section"><div class="metric"><strong>${s.logs.length}</strong><span>Working sets</span></div><div class="metric"><strong>${fmt(reps)}</strong><span>Total reps</span></div><div class="metric"><strong>${fmt(vol)}</strong><span>Kg-reps volume</span></div></div>
      ${card(`<div class="row"><h3>Compared with last Workout ${esc(s.session)}</h3><span class="label-tag">${comparison.previous?dateText(comparison.previous.endedAt||comparison.previous.startedAt):'First baseline'}</span></div>
        ${comparison.previous?`<div class="journey-stats mt16"><div class="metric"><strong>${comparison.improved}</strong><span>Improved</span></div><div class="metric"><strong>${comparison.maintained}</strong><span>Maintained</span></div><div class="metric"><strong>${comparison.pbs}</strong><span>New PBs</span></div></div>`:'<p class="notice mt12">Your first session with this workout establishes a baseline. Complete it again to see what improved.</p>'}
        <div class="mt12">${comparison.entries.map(m=>`<div class="comparison-row"><div class="row"><strong>${esc(m.name)}</strong><span class="${m.direction==='improved'?'positive':m.direction==='lower'?'negative':''}">${m.pb?'🏆 PB · ':''}${m.direction==='baseline'?'Baseline':m.direction==='improved'?'Improved':m.direction==='maintained'?'Maintained':'Below previous'}</span></div><p class="tiny muted">${m.old?esc(scoreLabel(m.old))+' → ':''}${esc(scoreLabel(m.best))}${m.change!=null?' · '+progressPct(m.change):''}${m.old&&m.old.rir!=null&&m.best.rir!=null?' · RIR '+m.old.rir+' → '+m.best.rir:''}</p></div>`).join('')}</div>
        <p class="fineprint">Compared using the strongest qualifying working set per movement. Fewer or extra sets do not imply weaker or stronger performance. Percentages are estimates, not direct strength measurements.</p>`,'section')}
      ${card(`<h3>Workout takeaway</h3><p class="subhead">${comparison.previous?comparison.improved>0?`${comparison.improved} movements improved compared with the previous matching workout.${comparison.pbs?' You also achieved '+comparison.pbs+' new personal best'+(comparison.pbs===1?'':'s')+'.':''} Keep progressing within your target rep ranges.`:comparison.maintained>0?`You maintained performance on ${comparison.maintained} movements. Maintaining weight and reps can be a good outcome when fatigue or recovery varies.`:`This session was below your previous best-set performance on some movements. One session does not define your overall trend.`:'Your first recorded Workout '+esc(s.session)+' is now your reference for the next session.'}</p>`,'section')}
      <div class="section">${btn('✎ Edit this completed workout','edit-history','outline full')}</div>
      ${card(`<div class="row"><h3>Session details</h3><span class="label-tag">${groups.length} movements</span></div><p class="subhead mt12">${rir.length?'Average RIR '+fmt(rir.reduce((n,l)=>n+l.rir,0)/rir.length):'Effort (RIR) not recorded'} · Suggested recovery ${s.recovery||48}h</p>
      `,'section')}
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
  function workloadCard(history){const list=[...new Set(history.map(x=>x.session))];const filter=state.settings.volumeFilter||'all';const shown=history.filter(s=>filter==='all'||s.session===filter);const points=shown.map(s=>({date:s.endedAt,value:(s.logs||[]).reduce((a,l)=>a+Number(l.weight||0)*Number(l.reps||0),0)}));const first=points[0]?.value,last=points.at(-1)?.value;const suffix=filter==='all'?'All workout types (not directly comparable)':'Workout '+filter+' only';let description=shown.length<2?'Log at least two matching workouts to compare their workload.':first>0?`First: ${fmt(first)} kg lifted. Latest: ${fmt(last)} kg lifted (${last>=first?'+':''}${fmt((last/first-1)*100)}%). Changes in exercise choice or set count also affect this total.`:'This exercise selection has little recorded external weight; bodyweight effort is not included in kg lifted.';return card(`<div class="row"><h3>Training workload</h3><span class="label-tag">kg lifted</span></div><p class="subhead">Total external weight × reps across all completed sets — how much weighted work you did, <strong>not</strong> how strong you are.</p><div class="field mt12"><label>Compare matching workouts</label><select id="volumeFilter"><option value="all" ${filter==='all'?'selected':''}>All workouts (overview only)</option>${list.map(id=>`<option value="${esc(id)}" ${filter===id?'selected':''}>Workout ${esc(id)}</option>`).join('')}</select></div><p class="fineprint">${esc(suffix)} · excludes unweighted bodyweight exercise effort.</p>${drawChart(points)}<p class="notice">${esc(description)}</p>`,'section');}
  function simpleMovementTrends(){
    const movements=allMovements(),over=profile().trendOverrides||{added:[],hidden:[]},cutoff=Date.now()-7*86400000;
    const recentIds=new Set(state.history.filter(s=>Date.parse(s.endedAt||s.startedAt||'')>=cutoff).flatMap(s=>(s.logs||[]).map(l=>l.exId)));
    const lookup=key=>movements.find(m=>m.key===key)?.id||key;
    const saved=new Set([...(over.added||[]).map(lookup),...(profile().selectedMovements||[]).map(lookup)]);
    const hidden=new Set((over.hidden||[]).map(lookup));
    const unique=[...new Map(movements.map(m=>[m.id,m])).values()];
    const chosen=unique.filter(m=>(recentIds.has(m.id)||saved.has(m.id))&&!hidden.has(m.id));
    return card(`<div class="row"><div><h3>Movement trends</h3><p class="subhead">Recent exercises appear automatically</p></div><button type="button" class="btn outline sm" data-action="modify-trends">${trendEditing?'Done':'Modify'}</button></div>
      ${trendEditing?`<div class="rr161-trend-choices"><p class="subhead">Select exercises to follow. Tap again to remove.</p>${unique.map(m=>`<button type="button" data-action="trend-select" data-id="${esc(m.id)}" class="rr161-trend-choice ${chosen.some(x=>x.id===m.id)?'selected':''}"><span>${esc(m.name)}</span><b>${chosen.some(x=>x.id===m.id)?'✓':'+'}</b></button>`).join('')}</div>`:''}
      <div class="rr161-trend-list">${chosen.length?chosen.map(m=>{const a=comparableSessions(m),first=a[0],last=a.at(-1);const pct=a.length>1?Math.round((last.performance/Math.max(.01,first.performance)-1)*100):null;
        return `<div class="rr161-trend-row"><div><strong>${esc(m.name)}</strong><small>${a.length>1?esc(scoreLabel(bestSet(first.log)))+' → '+esc(scoreLabel(bestSet(last.log))):last?'Latest: '+esc(scoreLabel(bestSet(last.log))):'No completed record yet'}</small></div><span class="rr161-change ${pct!=null&&pct>0?'positive':''}">${pct==null?'Baseline':(pct>0?'+':'')+pct+'%'}</span></div>`;}).join(''):'<p class="subhead">Complete a workout to see your exercises here, or use Modify to add one.</p>'}</div>
      <p class="fineprint">Change compares your first and latest best recorded set for each exercise. It is an estimate, not measured muscle growth.</p>`,'section');
  }
  function progress(){
    const stats=trainingMetrics(),rating=athleteIndex(),history=state.history;
    const last30=history.filter(s=>Date.now()-Date.parse(s.endedAt||s.startedAt||'')<30*86400000),pbs=last30.reduce((a,s)=>a+(s.prs||[]).length,0);
    const lastSession=history.at(-1),lastDate=lastSession?dateText(lastSession.endedAt||lastSession.startedAt):'No workouts yet';
    return `<div class="eyebrow">TRAINING ANALYTICS</div><h1 class="page-title">Progress.</h1><p class="lead">A clear picture of your training — no confusing graph scales.</p>
      <div class="two-stat section"><div class="metric athlete"><div class="eyebrow">ATHLETE SCORE</div><div class="score-number">${rating.value==null?'Calibrating':fmt(rating.value)}</div><div class="stat-detail">Personal progress rating</div></div><div class="metric"><div class="eyebrow">WORKOUTS</div><div class="score-number">${stats.workouts}</div><div class="stat-detail">${stats.sets} working sets</div></div></div>
      ${musclePanel(false)}
      ${card(`<div class="row"><h3>Your last 30 days</h3><span class="label-tag">AT A GLANCE</span></div><div class="rr161-summary-three"><div><strong>${last30.length}</strong><span>Workouts</span></div><div><strong>${pbs}</strong><span>New PBs</span></div><div><strong>${last30.reduce((a,s)=>a+(s.logs||[]).length,0)}</strong><span>Working sets</span></div></div><p class="subhead mt12">Last workout: <strong>${esc(lastDate)}</strong></p>`,'section')}
      ${simpleMovementTrends()}
      ${card(`<div class="row"><h3>Workout history</h3><span class="label-tag">${history.length} sessions</span></div><p class="subhead mt8">Tap Review to see individual sets and your progress since that session.</p><div class="mt12">${historyList(12)}</div>`,'section')}`;
  }

  function adaptivePlan(){return selectedPlan===ADAPT_ID&&profile().adaptive?.active;}
  function adaptiveReviewDue(){const cfg=profile().adaptive;if(!cfg?.active)return false;const d=ADAPT.nextReviewDay(cfg);return d!=null&&d<=todayLocal();}
  function lastReadinessForAdaptive(){return todayReadiness()||readinessLog().at(-1)||null;}
  function createAdaptiveNext(variant=0,keepFocus=false){
    const cfg=profile().adaptive;if(!cfg)return;
    const fresh=ADAPT.generate(cfg,state.history,profile().equipment||[],lastReadinessForAdaptive(),{variant,avoid:cfg.avoid||[],focusLock:keepFocus?(cfg.lastFocus||[]):[]});
    const day={name:fresh.name,pairs:fresh.pairs};
    profile().plans[ADAPT_ID]={A:day};
    cfg.lastReason=fresh.explanation;cfg.lastFocus=fresh.focus;cfg.estimatedMinutes=fresh.estimatedMinutes;cfg.generatedAt=new Date().toISOString();
    cfg.variant=variant;state.next='A';return day;
  }
  function adaptiveConfig(){const cfg=profile().adaptive||{};return {space:'small',experience:'intermediate',exclusions:activeProfile==='admin'?['carries','overhead']:['carries'],...cfg,levels:[...(cfg.levels||ADAPT.TEMPLATES.runner.levels)]};}
  function adaptiveSetupScreen(){
    const cfg=adaptiveDraft||adaptiveConfig(),presets=profile().adaptivePresets||[];
    const chosenPreset=ADAPT.TEMPLATES[cfg.template]||presets.find(x=>x.id===cfg.template)||ADAPT.TEMPLATES.runner;
    const key=ADAPT.TEMPLATES[cfg.template]||presets.some(x=>x.id===cfg.template)?cfg.template:'runner';
    const focus=cfg.levels||chosenPreset.levels;
    const options=(values,current)=>values.map(([value,label])=>`<option value="${esc(String(value))}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`).join('');
    const gear=window.REPRIVAL_EXERCISE_LIBRARY.gear,owned=profile().equipment||[];
    const gearChoices=Object.entries(gear).map(([id,entry])=>`<label class="rr161-choice"><input type="checkbox" name="gear" value="${esc(id)}" ${owned.includes(id)?'checked':''}><span>${esc(entry.name)}</span></label>`).join('');
    const exclusions=cfg.exclusions||[];
    const avoidChoice=(id,label)=>`<label class="rr161-choice"><input type="checkbox" name="exclusion" value="${id}" ${exclusions.includes(id)?'checked':''}><span>${label}</span></label>`;
    const groupControls=ADAPT.GROUPS.map((group,i)=>`<div class="rr160-focus-row"><div class="row"><strong>${group}</strong><span class="rr160-focus-label" data-focus-name="${i}">${ADAPT.LEVELS[focus[i]]}</span></div><input class="rr160-focus-slider" type="range" name="level${i}" min="0" max="4" step="1" value="${focus[i]}" aria-label="${group} training priority"></div>`).join('');
    const templateOptions=[...Object.entries(ADAPT.TEMPLATES).map(([id,t])=>`<option value="${id}" ${id===key?'selected':''}>${esc(t.name)}</option>`),...presets.map(t=>`<option value="${esc(t.id)}" ${t.id===key?'selected':''}>★ ${esc(t.name)}</option>`)].join('');
    return `<div class="eyebrow">ADAPTIVE TRAINING · GUIDED SETUP</div><h1 class="page-title">Make training fit you.</h1><p class="lead">Three short steps. RepRival won't prescribe exercises that need equipment or space you don't have.</p>
      ${card(`<form id="adaptiveForm" class="rr161-wizard">
      <div class="rr161-wizard-progress"><span class="current">1 · Your goal</span><span>2 · Your setup</span><span>3 · Fine-tune</span></div>
      <section class="rr161-wizard-step" data-wizard-step="0">
        <h3>1. What would you like to achieve?</h3>
        <div class="field mt16"><label>Choose a starting focus</label><select name="template" id="adaptiveTemplate">${templateOptions}</select><p class="fineprint" id="adaptiveTemplateDesc">${esc(chosenPreset.desc)}</p></div>
        <div class="form-grid"><div class="field"><label>Main goal</label><select name="goal">${options([['hypertrophy','Build muscle'],['strength','Get stronger'],['endurance','Strength endurance'],['general','General fitness']],cfg.goal||'hypertrophy')}</select></div><div class="field"><label>Time per workout</label><select name="duration">${options([[25,'25 minutes'],[30,'30 minutes'],[40,'40 minutes'],[50,'50 minutes'],[60,'60 minutes'],[75,'75 minutes']],cfg.duration||40)}</select></div></div>
        <div class="field"><label>Workouts per week</label><select name="frequency">${options([2,3,4,5,6].map(n=>[n,n+' sessions']),cfg.frequency||3)}</select></div>
        <button type="button" class="btn primary full" data-action="adaptive-wizard-next">Next · My equipment and space →</button>
      </section>
      <section class="rr161-wizard-step" data-wizard-step="1" hidden>
        <h3>2. What works in your training space?</h3>
        <div class="field mt16"><label>Available floor space</label><select name="space">${options([['small','Small / home gym · no walking carries'],['large','Room to move · travelling exercises allowed']],cfg.space||'small')}</select><p class="fineprint">Choose small if you cannot walk several steps holding weights.</p></div>
        <div class="field"><label>Your experience</label><select name="experience">${options([['beginner','Getting started'],['intermediate','Some lifting experience'],['advanced','Experienced lifter']],cfg.experience||'intermediate')}</select></div>
        <div class="field"><label>What equipment can you actually use?</label><div class="rr161-check-grid">${gearChoices}</div></div>
        <fieldset class="rr161-exclusions"><legend>Avoid these movement types</legend><div class="rr161-check-grid">${avoidChoice('carries','Loaded carries')}${avoidChoice('overhead','Overhead pressing')}${avoidChoice('impact','Jumping or impact')}${avoidChoice('deep_knee','Deep knee bending')}${avoidChoice('floor','Floor exercises')}</div></fieldset>
        <label class="rr160-checkbox"><input type="checkbox" name="running" ${cfg.running!==false?'checked':''}><span>I also run or do lower-body sport</span></label>
        <div class="field"><label>Running / sport load</label><select name="runningLoad">${options([['normal','Moderate'],['high','High · keep gym legs lighter']],cfg.runningLoad||'high')}</select></div>
        <fieldset class="rr160-run-days"><legend>Hard-running days <small>(optional)</small></legend><div class="rr160-day-pills">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day,i)=>`<label><input type="checkbox" name="runningDay" value="${i}" ${(cfg.runningDays||[]).includes(i)?'checked':''}><span>${day}</span></label>`).join('')}</div></fieldset>
        <div class="rr161-wizard-nav"><button type="button" class="btn outline" data-action="adaptive-wizard-back">← Back</button><button type="button" class="btn primary" data-action="adaptive-wizard-next">Next · Set priorities →</button></div>
      </section>
      <section class="rr161-wizard-step" data-wizard-step="2" hidden>
        <h3>3. Adjust your training focus</h3><p class="subhead mt12">High focus gets more weekly sets. Maintenance keeps a smaller but meaningful training dose.</p>
        ${groupControls}
        <div class="form-grid mt16"><div class="field"><label>Focus review</label><select name="review">${options([['weekly','Weekly'],['fortnightly','Fortnightly'],['monthly','Every 4 weeks'],['manual','Only when requested']],cfg.review||'fortnightly')}</select></div><div class="field"><label>Start date</label><input type="date" name="start" value="${esc(cfg.startedAt||todayLocal())}" required></div></div>
        <details class="rr161-advanced"><summary>Optional · favourite and avoided exercises</summary><p class="fineprint">You can change this any time in My Plan.</p><div class="rr160-pref-list">${window.REPRIVAL_EXERCISE_LIBRARY.entries.map(ex=>`<div class="rr160-pref-row"><span>${esc(ex.name)}</span><label><input type="checkbox" name="preferred" value="${esc(ex.id)}" ${(cfg.preferred||[]).includes(ex.id)?'checked':''}> Favour</label><label><input type="checkbox" name="avoid" value="${esc(ex.id)}" ${(cfg.avoid||[]).includes(ex.id)?'checked':''}> Avoid</label></div>`).join('')}</div></details>
        <div class="rr160-save-preset"><div class="field"><label>Save these priorities for later (optional)</label><input name="presetName" maxlength="35" placeholder="e.g. Upper body for running"></div><button type="button" class="btn outline" data-action="save-adaptive-preset">Save template</button></div>
        <div class="rr161-wizard-nav"><button type="button" class="btn outline" data-action="adaptive-wizard-back">← Back</button><button type="submit" class="btn primary" ${state.active?'disabled':''}>${cfg.active&&selectedPlan===ADAPT_ID?'Update plan':'Activate plan'} →</button></div>
      </section>
      <button type="button" class="btn text full mt12" data-page="plan">Cancel · return to My Plan</button>
      </form>`,'section')}`;
  }

  function adaptiveReviewScreen(){
    const cfg=profile().adaptive;
    if(!cfg?.active)return `<h1>Adaptive Training is not active</h1>${btn('My plan','plan','outline full')}`;
    const r=ADAPT.review(cfg,state.history,lastReadinessForAdaptive());
    return `<div class="eyebrow">FOCUS REVIEW · ${esc(cfg.review||'Manual')}</div><h1 class="page-title">Review your progress.</h1><p class="lead">Suggestions use your recent logged sets, stated priorities and reported soreness. Nothing changes without approval.</p>
      ${card(`<h3>Training balance · last 7 days</h3>${r.rows.map(x=>`<div class="rr160-review-row"><div><strong>${x.name}</strong><small>${x.note}</small></div><div><b>${x.actual} / ${x.target}</b><small>sets · illustrative target</small></div></div>`).join('')}<p class="fineprint">Targets are approximate, and a compound lift can contribute to more than one muscle group.</p>`,'section')}
      ${card(`<h3>Suggested priority changes</h3>${r.rows.filter(x=>x.level!==x.proposed).length?r.rows.filter(x=>x.level!==x.proposed).map(x=>`<div class="session-row"><strong>${x.name}</strong><small>${ADAPT.LEVELS[x.level]} → ${ADAPT.LEVELS[x.proposed]}</small></div>`).join(''):'<p class="subhead">Your current muscle priorities look reasonable based on the logged training and readiness data.</p>'}
        <div class="stack mt16"><button type="button" class="btn primary full" data-action="accept-adaptive-review">Accept suggestions</button><button type="button" class="btn outline full" data-action="adjust-adaptive-focus">Adjust focus manually</button><button type="button" class="btn text full" data-action="dismiss-adaptive-review">Dismiss this review</button></div>`,'section')}`;
  }
  function adaptiveStatusCard(){const cfg=profile().adaptive;if(!cfg?.active)return '';const reviewAt=ADAPT.nextReviewDay(cfg);
    const day=planFor('A'),exercises=(day.pairs||[]).flatMap(p=>p.exercises),sets=exercises.reduce((n,e)=>n+e.sets,0);
    return card(`<div class="row"><div><div class="eyebrow">YOUR ADAPTIVE PLAN</div><h3 class="mt8">${esc((ADAPT.TEMPLATES[cfg.template]||(profile().adaptivePresets||[]).find(x=>x.id===cfg.template)||{name:'Personalised'}).name)}</h3></div><span class="label-tag">ACTIVE</span></div>
      <div class="rr161-adaptive-stats"><span><b>${cfg.duration} min</b> preferred</span><span><b>${exercises.length} exercises</b> next session</span><span><b>${sets} sets</b> planned</span></div>
      <p class="subhead mt12">${esc(cfg.lastReason||'Built around your priorities and available equipment.')}</p>
      <p class="fineprint">Space: ${cfg.space==='large'?'Room to move':'Compact'} · Review: ${reviewAt?esc(reviewAt):'when requested'}</p>
      <div class="rr161-management"><button type="button" class="btn primary" data-action="regenerate-adaptive" ${state.active?'disabled':''}>↻ New workout</button><button type="button" class="btn outline" data-action="adaptive-config">Adjust plan</button><button type="button" class="btn outline" data-action="adaptive-review">Focus review</button></div>`,'section');
  }

  function plan(){
    const current=selectedPlan===ADAPT_ID?{title:'Adaptive Training',focus:(ADAPT.TEMPLATES[profile().adaptive?.template]||(profile().adaptivePresets||[]).find(x=>x.id===profile().adaptive?.template)||{name:'Personalised focus'}).name,duration:'Continuous',days:'Fresh workout after each session'}:(window.REPRIVAL_PLAN_LIBRARY.details[selectedPlan]||window.REPRIVAL_PLAN_LIBRARY.details.pump);
    return `<div class="eyebrow">TRAINING PROGRAMME</div><h1 class="page-title">My plan.</h1><p class="lead">Edit your workouts or switch focus without losing historical training.</p>
      ${card(`<div class="row"><h3>${esc(current.title)}</h3><span class="label-tag">ACTIVE</span></div><p class="subhead mt12">${esc(current.focus)} · ${esc(current.duration)} · ${esc(current.days)}</p><div class="stack mt16">${btn('Edit workouts','designer','primary full')}${btn('Start Adaptive Training','adaptive-setup','outline full')}${btn('Browse training plans','library','outline full')}${btn('Your equipment','equipment','outline full')}${btn('Explore 146 movements','exercises','outline full')}</div>`,'section')}
      ${adaptiveStatusCard()}
      ${card(`<h3>${adaptivePlan()?'Upcoming generated session':'Current rotation'}</h3>${SESSION_ORDER.map(id=>`<div class="session-row"><div><strong>${esc(planFor(id).name||'Workout '+id)}</strong><small>${planFor(id).pairs.length} blocks · ${buildTasks(id).length} working sets</small></div><span class="label-tag">${state.next===id?'Next':'Scheduled'}</span></div>`).join('')}`,'section')}
      ${card(`<h3>Plan start & consistency target</h3><p class="subhead">The seven-day training week begins on your plan start date, not necessarily Monday.</p><form class="stack mt12" id="planTimingForm"><div class="form-grid"><div class="field"><label>Plan start date</label><input type="date" name="start" required value="${esc(tracking().start)}"></div><div class="field"><label>Workouts per 7 days</label><input type="number" name="goal" min="1" max="7" value="${tracking().weeklyGoal}" required></div></div><button class="btn outline full" type="submit">Update training schedule</button></form>`,'section')}
      ${card(`<h3>Recovery countdown</h3><p class="subhead">A planning guide counted from the end of your most recent completed workout, not a measurement of muscle readiness. The automatic setting uses 48 hours after most sessions, or 72 hours when you mark one as tiring.</p><form id="recoverySettingsForm" class="stack mt12"><div class="field"><label>Recovery window</label><select name="recoveryHours"><option value="auto" ${![24,36,48,72].includes(Number(profile().recoveryHours))?'selected':''}>Automatic (48h / 72h if tired)</option>${[24,36,48,72].map(h=>`<option value="${h}" ${Number(profile().recoveryHours)===h?'selected':''}>${h} hours</option>`).join('')}</select></div><button class="btn outline full" type="submit">Save recovery preference</button></form>`,'section')}
      ${card(`<h3>Training focus</h3><p class="subhead">Your active programme defines the training goal and workouts. For a different focus, switch plans in the library. Running can fit around rest days but is not counted as a strength workout.</p><p class="fineprint">Previously saved Main Focus / Include Cardio preferences are retained in backups, but they did not change training recommendations; the unused controls have been removed.</p>`,'section')}
      ${card(`<h3>Your local data</h3><p class="subhead">Workouts are stored on this device, separately for each profile. Export a backup before a major update or changing devices.</p><div class="stack mt16">${btn('Export complete backup (JSON)','export','outline full')}<label class="btn outline full" for="backupFile">Import backup (JSON)</label><input id="backupFile" type="file" accept="application/json,.json" style="display:none">${canImportOwnerBaseline()?btn('Import 17 Oct Workout A baseline','import-v5','outline full'):''}</div>`,'section')}`;
  }
  function setupScreen(){return `<div class="eyebrow">WELCOME TO REPRIVAL</div><h1 class="page-title">Create your admin profile.</h1><p class="lead">Your existing workouts will be migrated to this profile. Measurements are optional and editable later.</p>
    ${card(`<form id="setupForm" class="stack"><h3>1 · Login details</h3><div class="field"><label>Admin username</label><input name="username" minlength="2" maxlength="28" required autocomplete="off"></div><div class="form-grid"><div class="field"><label>4-digit PIN</label><input name="pin" type="password" pattern="[0-9]{4}" inputmode="numeric" maxlength="4" required></div><div class="field"><label>Confirm PIN</label><input name="confirm" type="password" pattern="[0-9]{4}" inputmode="numeric" maxlength="4" required></div></div><h3>2 · Personal measurements</h3>${bodyInputFields(profile().body)}<button class="btn primary full" type="submit">Create admin profile →</button></form>`,'section')}
    <p class="fineprint">PINs are only a convenience on this device, not secure online authentication. You only enter the PIN when switching profiles.</p>`;}
  function unlockScreen(){const target=manager.profiles[manager.pending];if(!target){page='home';return home();}return `<div class="eyebrow">SWITCH ATHLETE</div><h1 class="page-title">${esc(target.username)}</h1><p class="lead">Enter this athlete’s 4-digit PIN to switch profiles.</p>${card(`<form id="unlockForm" class="stack"><div class="field"><label>4-digit PIN</label><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required autofocus></div><button class="btn primary full" type="submit">Switch profile →</button>${btn('Cancel','cancel-switch','outline full')}</form>`,'section')}`;}
  function profileTable(){return profileNames().map(id=>{const u=manager.profiles[id];return `<div class="session-row"><div><strong>${esc(u.username||'Setup needed')}</strong><small>${u.role==='admin'?'Administrator':'Athlete'} · ${u.training?.history?.length||0} workouts ${id===activeProfile?'· Active':''}</small></div>${id===activeProfile?'<span class="label-tag">Active</span>':`<button type="button" data-action="switch-profile" data-id="${esc(id)}" class="quiet-link">Switch →</button>`}</div>`;}).join('');}
  function adminScreen(){if(profile().role!=='admin'){page='account';return accountScreen();}
    return `<div class="eyebrow">PROFILE MANAGEMENT</div><h1 class="page-title">Admin.</h1><p class="lead">Create athletes, assign PINs and inspect their training. All data stays on this device.</p>
      ${card(`<div class="row"><h3>Athletes</h3><span class="label-tag">${profileNames().length} profiles</span></div>${profileTable()}`,'section')}
      ${card(`<h3>Create athlete</h3><form id="createProfileForm" class="stack mt12"><div class="field"><label>Username</label><input name="username" minlength="2" maxlength="28" required></div><div class="field"><label>4-digit PIN</label><input type="password" name="pin" pattern="[0-9]{4}" maxlength="4" inputmode="numeric" required></div><h3>Personal measurements · optional</h3>${bodyInputFields()}<button class="btn primary full" type="submit">Create athlete</button></form>`,'section')}
      ${card(`<h3>Manage athletes</h3><p class="subhead">Reset a PIN or delete a demo athlete. Deletions require confirmation.</p>${profileNames().filter(id=>id!==activeProfile).map(id=>`<div class="session-row"><strong>${esc(manager.profiles[id].username)}</strong><div class="row"><button class="quiet-link" type="button" data-action="reset-pin" data-id="${esc(id)}">Reset PIN</button><button class="quiet-link" type="button" data-action="remove-profile" data-id="${esc(id)}">Delete</button></div></div>`).join('')}`,'section')}
      ${card(`<h3>Demo athletes</h3><p class="subhead">Create 10 clearly labelled demo athletes, each with a month of training and weigh-ins. Every demo athlete uses PIN <strong>1234</strong>.</p>${btn('Generate 10 demo athletes','generate-demo','outline full')}<p class="fineprint">Demo profiles never join real leaderboards. Default demo PINs are displayed after generation.</p>`,'section')}
      ${card(`<h3>My account</h3>${btn('Edit my body metrics','metrics','outline full')}${btn('Export all profiles','export','outline full')}`,'section')}`;
  }
  function accountScreen(){return `<div class="eyebrow">YOUR ACCOUNT</div><h1 class="page-title">${esc(profile().username)}</h1>${card(`<h3>Profile settings</h3><div class="stack mt12">${btn('My body metrics','metrics','outline full')}${btn('Switch athlete','switch-list','outline full')}${btn('Export backup','export','outline full')}</div>`,'section')}${card(`<h3>Other local profiles</h3>${profileTable()}`,'section')}<p class="art-attribution">Exercise illustrations by Bryl Lim, based on Everkinetic artwork · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.</p>`;}
  function metricsScreen(){const b=profile().body,w=b.measurements||[],latest=w.at(-1),unit=b.unit||'kg';return `<div class="eyebrow">ATHLETE MEASUREMENTS</div><h1 class="page-title">Body metrics.</h1><p class="lead">Update your measurements at any time without losing old weigh-ins.</p>
    ${card(`<h3>Your measurements & preferences</h3><form id="metricsForm" class="stack mt12">${bodyInputFields(b)}<button class="btn primary full" type="submit">Save body settings</button></form>`,'section')}
    ${card(`<h3>Weigh in</h3><p class="subhead">Latest: ${latest?displayWeight(latest.kg):'Not recorded'}</p><form id="weighInForm" class="stack mt12"><div class="field"><label>${unit==='st'?'Weight in stone and pounds':`Weight (${unit})`}</label>${unit==='st'?`<div class="form-grid"><input name="stone" type="number" min="0" max="70" step="1" placeholder="Stone" required><input name="pounds" type="number" min="0" max="13.9" step="0.1" placeholder="Pounds" required></div>`:`<input name="weight" type="number" step="0.1" min="1" max="1400" required placeholder="${latest?+(chartWeight(latest.kg)).toFixed(1):'Your weight'}">`}</div><div class="form-grid"><div class="field"><label>Waist (${b.waistUnit||'cm'}) · optional</label><input name="waist" type="number" step="0.1" min="0"></div><div class="field"><label>Body fat % · optional</label><input name="bodyFat" type="number" step="0.1" min="0" max="80"></div></div><div class="field"><label>Date</label><input name="date" type="date" required value="${todayLocal()}"></div><button class="btn primary full" type="submit">Save weigh-in</button></form>`,'section')}
    ${weighScheduleSection()}
    ${card(`<h3>Weigh-in history</h3>${w.length?[...w].reverse().slice(0,30).map(x=>`<div class="session-row"><strong>${esc(x.date)}</strong><strong>${displayWeight(x.kg)}</strong></div>`).join(''):'<p class="subhead">No weigh-ins yet.</p>'}`,'section')}`;}
  function movementLibrary(){
    const lib=window.REPRIVAL_EXERCISE_LIBRARY,owned=profile().equipment||[],by=new Map();
    lib.entries.filter(e=>lib.compatible(e,owned)).forEach(e=>by.set(e.id,structuredClone(e)));
    Object.values(profile().plans||{}).forEach(p=>Object.values(p).forEach(w=>w.pairs.forEach(pair=>pair.exercises.forEach(e=>{if(!by.has(e.id))by.set(e.id,structuredClone(e));}))));
    return [...by.values()].sort((a,b)=>a.name.localeCompare(b.name));
  }
  function gearName(id){return window.REPRIVAL_EXERCISE_LIBRARY.gear[id]?.name||id;}
  function equipmentScreen(){
    const lib=window.REPRIVAL_EXERCISE_LIBRARY,owned=profile().equipment||[];
    const groups=[...new Set(Object.values(lib.gear).map(x=>x.group))];
    return `<div class="eyebrow">YOUR TRAINING SETUP</div><h1 class="page-title">Your equipment.</h1><p class="lead">Choose what you can actually use. Plans and the exercise catalogue will adapt to your kit; past sessions and your current plan are never automatically rewritten.</p>
      ${card(`<div class="row"><h3>Available at your location</h3><span class="label-tag">${owned.length} selected</span></div><form id="equipmentForm" class="stack mt12">${groups.map(group=>`<fieldset class="equipment-group"><legend>${esc(group)}</legend>${Object.entries(lib.gear).filter(([,g])=>g.group===group).map(([id,g])=>`<label class="equipment-choice"><input type="checkbox" name="equipment" value="${esc(id)}" ${owned.includes(id)?'checked':''}><span>${esc(g.name)}</span></label>`).join('')}</fieldset>`).join('')}<button class="btn primary full" type="submit">Save my equipment</button></form><p class="fineprint">Bodyweight-only movements are always available. Your original profile is pre-filled with your known equipment; the low-row station is inferred from your current workouts, so untick it if that setup isn't available. Selection is private to this profile.</p>`,'section')}
      ${card(`<h3>What becomes available?</h3><p class="subhead">With this kit, ${lib.entries.filter(e=>lib.compatible(e,owned)).length} of ${lib.entries.length} exercises can be used and ${Object.keys(window.REPRIVAL_PLAN_LIBRARY.details).filter(id=>window.REPRIVAL_PLAN_LIBRARY.build(id,owned).compatible).length} plan templates are compatible.</p><div class="stack mt12">${btn('Explore available movements','exercises','outline full')}${btn('Browse compatible programmes','library','outline full')}</div>`,'section')}`;
  }
  function exerciseBrowser(){
    const lib=window.REPRIVAL_EXERCISE_LIBRARY,owned=profile().equipment||[],f=catalogueFilter;
    const muscles=['All',...new Set(lib.entries.map(e=>e.muscle))];
    const matches=lib.entries.filter(e=>(f.muscle==='All'||e.muscle===f.muscle)&&(f.kit!=='owned'||lib.compatible(e,owned))&&(!f.search||(e.name+' '+e.muscle+' '+e.details).toLowerCase().includes(f.search.toLowerCase())));
    const day=state.settings.editDay&&SESSION_ORDER.includes(state.settings.editDay)?state.settings.editDay:state.next;
    return `<div class="eyebrow">MOVEMENT EXPLORER</div><h1 class="page-title">Find your next exercise.</h1><p class="lead">${lib.entries.length} curated exercises and variations. Find movements that match your equipment, then add them to a future workout.</p>
      ${card(`<div class="row"><h3>Filter movements</h3>${btn('Edit equipment','equipment','outline')}</div><div class="form-grid mt12"><div class="field"><label>Muscle group</label><select id="exerciseMuscle">${muscles.map(m=>`<option ${m===f.muscle?'selected':''} value="${esc(m)}">${esc(m)}</option>`).join('')}</select></div><div class="field"><label>Equipment</label><select id="exerciseKit"><option value="owned" ${f.kit==='owned'?'selected':''}>My equipment</option><option value="all" ${f.kit==='all'?'selected':''}>All equipment</option></select></div></div><div class="field mt12"><label>Search by name or movement</label><input id="exerciseSearch" type="search" placeholder="e.g. split squat, curl, row" value="${esc(f.search)}"></div><div class="field mt12"><label>Add new exercises to</label><select id="exerciseDay">${SESSION_ORDER.map(id=>`<option value="${esc(id)}" ${id===day?'selected':''}>${esc(planFor(id).name||'Workout '+id)}</option>`).join('')}</select></div><p class="fineprint">${matches.length} matching exercises · the current programme is not changed until you press Add.</p>`,'section')}
      ${card(`<div class="row"><h3>Exercises</h3><span class="label-tag">${matches.length}</span></div>${matches.length?matches.map(e=>{const ok=lib.compatible(e,owned),req=e.equipment.map(gearName).join(' + ')||'Bodyweight';return `<div class="exercise-result"><div class="exercise-result-main"><strong>${esc(e.name)}</strong><small>${esc(e.muscle)} · ${esc(e.sets)} × ${esc(e.min)}–${esc(e.max)} ${esc(e.suffix)}</small><span>${esc(req)}${!ok?' · NOT OWNED':''}</span></div><button class="btn outline" data-action="catalogue-add" data-id="${esc(e.id)}" ${(!ok||state.active)?'disabled':''}>Add +</button></div>`;}).join(''):'<p class="subhead mt12">No movement matches those filters. Try All equipment or clear your search.</p>'}${state.active?'<p class="fineprint">Finish or discard the active workout before editing future sessions.</p>':''}`,'section')}`;
  }
  function planSnapshot(){
    state.planHistory=state.planHistory||[];
    state.planHistory.push({savedAt:new Date().toISOString(),planId:selectedPlan,version:state.settings.planVersion||0,rotation:structuredClone(profile().plans[selectedPlan])});
    if(state.planHistory.length>30)state.planHistory.shift();
  }
  function updatePlan(){state.settings.planVersion=(state.settings.planVersion||0)+1;save();render();}
  function canEditPlan(){if(state.active){showToast('Finish or discard your current workout before changing its plan.');return false;}return true;}
  function designerScreen(){const id=state.settings.editDay&&SESSION_ORDER.includes(state.settings.editDay)?state.settings.editDay:SESSION_ORDER[0],plan=planFor(id);
    return `<div class="eyebrow">WORKOUT DESIGNER</div><h1 class="page-title">Edit programme.</h1><p class="lead">Changes affect future sessions only. Completed workout data is never rewritten.</p>
      ${card(`<h3>Choose workout</h3><div class="row mt12" style="flex-wrap:wrap">${SESSION_ORDER.map(day=>`<button class="btn ${day===id?'primary':'outline'}" type="button" data-action="select-edit-day" data-id="${esc(day)}">${esc(day)}</button>`).join('')}</div><form id="workoutNameForm" class="stack mt16"><div class="field"><label>Workout name</label><input name="name" value="${esc(plan.name)}" required></div><button class="btn outline full" type="submit">Rename workout</button></form>`,'section')}
      ${plan.pairs.map((pair,pi)=>card(`<div class="row"><h3>${pair.exercises.length>1?'Superset':'Block'} ${pi+1}</h3><span class="label-tag">Rest ${pair.restMin}–${pair.restMax}s</span></div>${pair.exercises.map((ex,ei)=>`<form class="editExerciseForm stack mt16" data-day="${esc(id)}" data-pair="${pi}" data-ex="${ei}"><strong>${esc(ex.name)}</strong><div class="field"><label>Replace movement</label><select name="replaceId">${movementLibrary().map(x=>`<option value="${esc(x.id)}" ${x.id===ex.id?'selected':''}>${esc(x.name)} — ${esc(x.muscle)}</option>`).join('')}</select></div><div class="form-grid"><div class="field"><label>Sets</label><input type="number" name="sets" min="1" max="10" value="${ex.sets}" required></div><div class="field"><label>Minimum reps</label><input type="number" name="min" min="1" max="99" value="${ex.min}" required></div><div class="field"><label>Maximum reps</label><input type="number" name="max" min="1" max="99" value="${ex.max}" required></div><div class="field"><label>Rest minimum (sec)</label><input type="number" name="restMin" min="15" max="300" value="${pair.restMin}" required></div></div><div class="row" style="flex-wrap:wrap"><button class="btn outline" type="submit">Save changes</button><button class="btn outline" type="button" data-action="move-exercise" data-day="${esc(id)}" data-pair="${pi}" data-ex="${ei}">Move to next block</button><button class="btn text" type="button" data-action="remove-exercise" data-day="${esc(id)}" data-pair="${pi}" data-ex="${ei}">Remove</button></div></form>`).join('')}`,'section')).join('')}
      ${state.planHistory?.length?card(`<h3>Previous versions</h3><p class="subhead">Restore the last configuration if you change your mind.</p>${btn('Restore previous plan version','restore-plan','outline full')}`,'section'):''}
      ${card(`<h3>Exercise library</h3><p class="subhead">Add a new movement as a solo block, or replace, move or remove an existing movement below.</p><form id="addExerciseForm" class="stack mt12"><input type="hidden" name="day" value="${esc(id)}"><div class="field"><label>Choose exercise</label><select name="exId">${movementLibrary().map(x=>`<option value="${esc(x.id)}">${esc(x.name)} — ${esc(x.muscle)}</option>`).join('')}</select></div><button type="submit" class="btn primary full">Add movement</button></form><p class="fineprint">Each save preserves the previous configuration in plan history for recovery.</p>${btn('Browse complete training plans','library','outline full')}`,'section')}`;
  }
  function libraryScreen(){
    const library=window.REPRIVAL_PLAN_LIBRARY,owned=profile().equipment||[];
    const list=Object.entries(library.details).map(([id,d])=>({id,d,build:library.build(id,owned)}));
    const available=list.filter(x=>x.build.compatible),locked=list.filter(x=>!x.build.compatible);
    const makeCard=({id,d,build})=>card(`<div class="row"><div><div class="eyebrow">${esc(d.split)}</div><h3 class="mt8">${esc(d.title)}</h3></div>${selectedPlan===id?'<span class="label-tag">ACTIVE</span>':build.compatible?'<span class="label-tag">AVAILABLE</span>':'<span class="label-tag">NEEDS KIT</span>'}</div><p class="subhead mt12">${esc(d.description)}</p><p class="fineprint">${esc(d.duration)} · ${esc(d.days)} · ${Object.keys(build.days).length} workouts</p>${!build.compatible?`<p class="fineprint"><strong>Missing:</strong> ${esc(build.missing.map(gearName).join(', '))} · <a href="#" data-action="equipment">Update your equipment</a></p>`:''}
      <details class="mt12"><summary>View exercises & workout structure</summary>${Object.values(build.days).map(w=>`<div class="programme-day"><strong>${esc(w.name)}</strong>${w.pairs.flatMap(p=>p.exercises).map(e=>`<span>${esc(e.name)} · ${e.sets}×${e.min}–${e.max}</span>`).join('')}</div>`).join('')}</details><div class="mt16">${selectedPlan===id?'<span class="subhead">Your current plan</span>':`<button class="btn ${build.compatible?'primary':'outline'} full" data-action="activate-plan" data-id="${esc(id)}" ${(!build.compatible||state.active)?'disabled':''}>${build.compatible?'Choose this programme':'Equipment needed'}</button>`}</div>`,'section');
    return `<div class="eyebrow">WORKOUT LIBRARY</div><h1 class="page-title">Programmes for your kit.</h1><p class="lead">${list.length} distinct programme templates, including push/pull/legs, upper/lower and a five-day bro split. Each workout has its own exercise selection.</p>
      ${card(`<div class="row"><h3>Adaptive Training · build your own focus</h3><span class="label-tag">NEW</span></div><p class="subhead mt12">Choose a template, set your muscle priorities, then let RepRival prepare the next session from your history and recovery.</p><div class="mt16"><button type="button" class="btn primary full" data-action="adaptive-config">Set up Adaptive Training →</button></div>`,'section')}
      ${card(`<div class="row"><h3>Based on your equipment</h3><span class="label-tag">${available.length} available</span></div><p class="subhead">Equipment is saved per athlete. Adding a new piece of kit unlocks more exercises and programmes.</p><div class="stack mt12">${btn('Change my equipment','equipment','outline full')}${btn('Browse all 146 movements','exercises','outline full')}</div>`,'section')}
      ${available.map(makeCard).join('')}${locked.length?`<div class="eyebrow section">MORE PROGRAMMES · NEED ADDITIONAL KIT</div>${locked.map(makeCard).join('')}`:''}`;
  }
  function activateScreen(){const item=window.REPRIVAL_PLAN_LIBRARY.details[pendingPlan];if(!item){page='library';return libraryScreen();}const suggested=item.weekly||3;return `<div class="eyebrow">START A NEW PLAN</div><h1 class="page-title">${esc(item.title)}</h1><p class="lead">Choose when your 7-day training week begins. Your previous workouts remain saved.</p>${card(`<form id="activatePlanForm" class="stack"><div class="field"><label>Plan start date</label><input type="date" name="start" value="${todayLocal()}" required></div><div class="field"><label>Weekly workout target</label><input type="number" name="goal" min="1" max="7" value="${suggested}" required></div><p class="fineprint">For example, a Saturday start means Saturday–Friday training weeks. Your history from earlier plans is preserved.</p><button class="btn primary full" type="submit">Activate plan →</button>${btn('Cancel','library','outline full')}</form>`,'section')}`;}
  function render(){
    let body='';
    if(page==='setup')body=setupScreen();
    else if(page==='unlock')body=unlockScreen();
    else if(page==='admin')body=adminScreen();
    else if(page==='account')body=accountScreen();
    else if(page==='designer')body=designerScreen();
    else if(page==='library')body=libraryScreen();
    else if(page==='equipment')body=equipmentScreen();
    else if(page==='exercises')body=exerciseBrowser();
    else if(page==='activate')body=activateScreen();
    else if(page==='adaptive-setup')body=adaptiveSetupScreen();
    else if(page==='adaptive-review')body=adaptiveReviewScreen();
    else if(page==='metrics')body=metricsScreen();
    else if(page==='home')body=home();
    else if(page==='workout-intro')body=workoutLanding();
    else if(page==='workout')body=workout();
    else if(page==='progress')body=progress();
    else if(page==='readiness')body=readinessScreen();
    else if(page==='muscle-detail')body=muscleDetailScreen();
    else if(page==='leagues')body=leaguesScreen();
    else if(page==='plan')body=plan();
    else if(page==='summary')body=summary();
    else if(page==='edit-history')body=editHistoryScreen();
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
    if(!canImportOwnerBaseline()){showToast('This import is only available to the original owner profile');return;}
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
    save();
    const blob=new Blob([JSON.stringify(manager,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='reprival-all-profiles-backup-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function demoProfiles(){
    const archetypes=[['Alex','Rapid beginner',.74,.045],['Sam','Steady',.9,.023],['Jordan','Plateau',1.25,.003],['Charlie','Endurance',.8,.037],['Taylor','Inconsistent',.85,.008],['Morgan','Experienced',1.35,.012],['Jamie','Returning',.95,.03],['Casey','Upper-body focus',1.1,.02],['Riley','Consistent',1,.036],['Drew','Variable',1.05,.014]];
    const today=new Date();let made=0;
    archetypes.forEach(([username,kind,mult,progress],i)=>{
      const id='demo-'+username.toLowerCase();if(manager.profiles[id])return;
      const data=defaults();data.history=[];data.next='A';
      const body={unit:i%3===0?'st':'kg',heightUnit:'cm',waistUnit:'cm',dob:`${1985+i%12}-03-12`,sex:i%2?'female':'male',height:165+i%14*2,measurements:[]};
      for(let week=0;week<4;week++){
        const dt=new Date(today);dt.setDate(dt.getDate()-(27-week*7));body.measurements.push({date:dateOnly(dt.toISOString()),kg:+(74+i*1.9-week*(i%4===0?0.15:0.05)).toFixed(2)});
        for(let day=0;day<3;day++){
          if(username==='Taylor'&&week===1&&day===1)continue;
          const when=new Date(dt);when.setDate(when.getDate()+day*2);
          const code=['A','B','C'][day],plan=PLAN[code],logs=[];
          plan.pairs.forEach(pair=>pair.exercises.forEach(ex=>{
            for(let round=1;round<=ex.sets;round++){
              const w=ex.load==='bodyweight'?0:Math.max(2,Math.round((10+ex.min*.45+i*2.1)*mult*(1+week*progress)*2)/2);
              const reps=Math.max(4,Math.min(ex.max,ex.min+1+Math.floor(week*progress*18)+(round===1?1:0)+(username==='Drew'?(week%2?1:-1):0)));
              logs.push({exId:ex.id,name:ex.name,muscle:ex.muscle,weight:w,reps,rir:Math.max(0,Math.min(4,3-Math.floor(week/2))),load:ex.load,pair:pair.id,round,loggedAt:when.toISOString()});
            }
          }));
          data.history.push({id:id+'-'+week+'-'+day,demo:true,session:code,startedAt:when.toISOString(),endedAt:when.toISOString(),logs,feeling:'normal',recovery:48,prs:[]});
        }
      }
      data.next='A';manager.profiles[id]={username:username+' · Demo',pin:'1234',role:'athlete',demo:true,kind,training:data,body,planId:'pump',plans:{pump:structuredClone(PLAN)},selectedMovements:['A:low_incline_db_press','B:flat_db_bench_press'],equipment:[...window.REPRIVAL_EXERCISE_LIBRARY.ownerDefault]};made++;
    });
    save();return made;
  }
  function activatePlan(id,schedule){
    const lib=window.REPRIVAL_PLAN_LIBRARY;
    if(!lib.details[id])return;
    if(state.active){showToast('Save or finish the current session before changing plans.');return;}
    const generated=lib.build(id,profile().equipment||[]);
    if(!generated.compatible){showToast('Choose the required equipment before activating this plan.');return;}
    if(!confirm(`Activate ${lib.details[id].title}? Your previous completed sessions and personal bests will remain saved.`))return;
    profile().plans[id]=profile().plans[id]||structuredClone(generated.days);
    if(profile().adaptive)profile().adaptive.active=false;
    profile().planId=id;selectedPlan=id;SESSION_ORDER=Object.keys(profile().plans[id]);state.next=SESSION_ORDER[0];profile().planTracking={planId:id,start:schedule.start,weeklyGoal:schedule.weeklyGoal};
    state.settings.planVersion=(state.settings.planVersion||0)+1;
    save();page='plan';render();showToast('Training plan activated');
  }
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-nav]')){e.preventDefault();page=e.target.dataset.nav;render();}});
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-nav]');
    if(nav){page=nav.dataset.nav;render();window.scrollTo({top:0,left:0,behavior:'instant'});return;}
    const link=e.target.closest('[data-page]');
    if(link){page=link.dataset.page==='workout'?'workout-intro':link.dataset.page;render();window.scrollTo({top:0,left:0,behavior:'instant'});return;}
    const muscle=e.target.closest('[data-muscle]');if(muscle){state.settings.selectedMuscle=muscle.dataset.muscle;page='muscle-detail';render();return;}
    const el=e.target.closest('[data-action]');if(!el)return;
    const action=el.dataset.action;
    if(['designer','library','metrics','equipment','exercises'].includes(action)){page=action;render();return;}
    if(action==='adaptive-wizard-next'||action==='adaptive-wizard-back'){
      const steps=[...document.querySelectorAll('[data-wizard-step]')],current=steps.findIndex(step=>!step.hidden);
      const target=Math.max(0,Math.min(steps.length-1,current+(action==='adaptive-wizard-next'?1:-1)));
      steps.forEach((step,i)=>{step.hidden=i!==target;});
      document.querySelectorAll('.rr161-wizard-progress span').forEach((step,i)=>step.classList.toggle('current',i===target));
      document.querySelector('.rr161-wizard')?.scrollIntoView({block:'start',behavior:'instant'});return;
    }
    if(action==='adaptive-config'||action==='adaptive-setup'){adaptiveDraft=adaptiveConfig();page='adaptive-setup';render();return;}
    if(action==='save-adaptive-preset'){
      const form=document.querySelector('#adaptiveForm');if(!form)return;
      const f=new FormData(form),name=String(f.get('presetName')||'').trim();
      if(name.length<2||name.length>35){showToast('Name your template (2–35 characters)');return;}
      const levels=ADAPT.GROUPS.map((_,i)=>clamp(Number(f.get('level'+i)),0,4));
      const id='personal-'+name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,38);
      if(!id||id==='personal-'){showToast('Choose a more descriptive name');return;}
      const saved=profile().adaptivePresets||(profile().adaptivePresets=[]);
      const item={id,name,desc:'Your saved muscle-group priorities',levels};
      const ix=saved.findIndex(p=>p.id===id);if(ix>=0)saved[ix]=item;else saved.push(item);
      adaptiveDraft={...adaptiveConfig(),template:id,levels,goal:String(f.get('goal')||'hypertrophy'),duration:Number(f.get('duration')||40),frequency:Number(f.get('frequency')||3),review:String(f.get('review')||'fortnightly'),startedAt:String(f.get('start')||todayLocal()),running:f.has('running'),runningLoad:String(f.get('runningLoad')||'high'),runningDays:f.getAll('runningDay').map(Number),space:String(f.get('space')||'small'),experience:String(f.get('experience')||'intermediate'),exclusions:f.getAll('exclusion'),preferred:f.getAll('preferred'),avoid:f.getAll('avoid')};
      save();render();showToast('Personal focus template saved');return;
    }
    if(action==='adaptive-review'){page='adaptive-review';render();return;}
    if(action==='regenerate-adaptive'){
      if(state.active||!adaptivePlan()){showToast('Finish your session before generating another');return;}
      const cfg=profile().adaptive;createAdaptiveNext((cfg.variant||0)+1,true);save();page='workout-intro';render();showToast('Next adaptive session regenerated');return;
    }
    if(action==='accept-adaptive-review'||action==='dismiss-adaptive-review'){
      const cfg=profile().adaptive;if(!cfg?.active)return;
      if(action==='accept-adaptive-review'){cfg.levels=ADAPT.review(cfg,state.history,lastReadinessForAdaptive()).levels;if(!state.active&&selectedPlan===ADAPT_ID)createAdaptiveNext((cfg.variant||0)+1);}
      cfg.reviewedAt=todayLocal();save();page='plan';render();showToast(action==='accept-adaptive-review'?'Focus suggestions accepted':'Review dismissed');return;
    }
    if(action==='adjust-adaptive-focus'){adaptiveDraft=adaptiveConfig();page='adaptive-setup';render();return;}
    if(action==='modify-trends'){trendEditing=!trendEditing;render();return;}
    if(action==='trend-select'){
      const id=String(el.dataset.id||''),movements=allMovements(),known=movements.some(m=>m.id===id);if(!known)return;
      const over=profile().trendOverrides||(profile().trendOverrides={added:[],hidden:[]});
      const keysForId=new Set(movements.filter(x=>x.id===id).map(x=>x.key));
      const autoIds=new Set(state.history.filter(s=>Date.now()-Date.parse(s.endedAt||s.startedAt||'')<=7*86400000).flatMap(s=>(s.logs||[]).map(l=>l.exId)));
      const manually=(over.added||[]).some(k=>k===id||keysForId.has(k))||(profile().selectedMovements||[]).some(k=>keysForId.has(k));
      const hidden=(over.hidden||[]).some(k=>k===id||keysForId.has(k));
      const selected=!hidden&&(manually||autoIds.has(id));
      if(selected){over.added=over.added.filter(k=>k!==id&&!keysForId.has(k));over.hidden=[...new Set([...over.hidden.filter(k=>!keysForId.has(k)),id])];profile().selectedMovements=(profile().selectedMovements||[]).filter(k=>!keysForId.has(k));}
      else{over.hidden=over.hidden.filter(k=>k!==id&&!keysForId.has(k));over.added=[...new Set([...over.added.filter(k=>!keysForId.has(k)),id])];}
      save();render();return;
    }
    if(action==='league-to-workout'){page='workout-intro';render();return;}
    if(action==='readiness'){page='readiness';render();return;}
    if(action==='dismiss-readiness'){profile().readinessDismissed=todayLocal();save();render();return;}
    if(action==='catalogue-add'){
      if(!canEditPlan())return;const lib=window.REPRIVAL_EXERCISE_LIBRARY,ex=lib.byId[el.dataset.id],owned=profile().equipment||[];
      const day=state.settings.editDay&&SESSION_ORDER.includes(state.settings.editDay)?state.settings.editDay:state.next;
      if(!lib.compatible(ex,owned)||!profile().plans[selectedPlan]?.[day]){showToast('This movement needs equipment you have not selected.');return;}
      planSnapshot();profile().plans[selectedPlan][day].pairs.push({id:'block-'+Date.now().toString(36),restMin:75,restMax:105,exercises:[structuredClone(ex)]});
      updatePlan();page='exercises';render();showToast('Added to '+planFor(day).name);return;
    }
    if(action==='league-focus'){leagueStore().focus=el.dataset.id;save();page='leagues';render();return;}
    if(action==='weigh-in'){page='metrics';render();return;}
    if(action==='view-art'){
      const src=el.querySelector('img')?.getAttribute('src');
      if(!src)return;
      const modal=document.createElement('dialog');modal.className='art-preview-modal';
      const close=document.createElement('button');close.className='art-preview-close';close.type='button';close.textContent='Close ×';
      close.addEventListener('click',()=>modal.close());
      const pic=document.createElement('img');pic.src=src;pic.alt=el.querySelector('img')?.alt||'Exercise illustration';pic.className='art-preview-image';
      const label=document.createElement('p');label.textContent=pic.alt;
      modal.append(close,pic,label);document.body.appendChild(modal);
      modal.addEventListener('close',()=>modal.remove(),{once:true});
      modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});
      modal.showModal();return;
    }
    if(action==='cancel-switch'){manager.pending=null;page=profile().role==='admin'?'admin':'account';render();return;}
    if(action==='switch-profile'){if(el.dataset.id===activeProfile)return;manager.pending=el.dataset.id;page='unlock';render();return;}
    if(action==='switch-list'){page=profile().role==='admin'?'admin':'account';render();return;}
    if(['move-exercise','remove-exercise'].includes(action)){
      if(!canEditPlan())return;
      const day=el.dataset.day,pi=+el.dataset.pair,ei=+el.dataset.ex;
      const plan=profile().plans[selectedPlan]?.[day];if(!plan?.pairs?.[pi]?.exercises?.[ei])return;
      const pair=plan.pairs[pi],ex=pair.exercises[ei];
      if(action==='remove-exercise'&&!confirm(`Remove ${ex.name} from future workouts? Historical sets will remain saved.`))return;
      if(action==='move-exercise'&&plan.pairs.length<=1){showToast('Add another block first');return;}
      planSnapshot();pair.exercises.splice(ei,1);
      if(action==='move-exercise'){
        const next=pi+1<plan.pairs.length?pi+1:Math.max(0,pi-1);
        plan.pairs[next].exercises.push(ex);
      }
      plan.pairs=plan.pairs.filter(x=>x.exercises.length);
      if(!plan.pairs.length){planSnapshot();plan.pairs.push({id:'block-'+Date.now(),restMin:75,restMax:105,exercises:[structuredClone(movementLibrary()[0])]});}
      updatePlan();showToast(action==='remove-exercise'?'Movement removed':'Movement moved');return;
    }
    if(action==='restore-plan'){
      if(!canEditPlan())return;
      const versions=state.planHistory||[],ix=versions.map(x=>x.planId).lastIndexOf(selectedPlan);
      if(ix<0)return;
      if(!confirm('Restore the previous version of this plan? Completed workouts stay unchanged.'))return;
      const version=versions.splice(ix,1)[0];const prior=structuredClone(profile().plans[selectedPlan]);
      profile().plans[selectedPlan]=version.rotation;state.settings.planVersion=(state.settings.planVersion||0)+1;
      versions.push({savedAt:new Date().toISOString(),planId:selectedPlan,version:state.settings.planVersion,rotation:prior});
      save();render();showToast('Previous plan restored');return;
    }
    if(action==='choose-session'&&!state.active&&SESSION_ORDER.includes(el.dataset.id)){state.next=el.dataset.id;save();render();return;}
    if(action==='select-edit-day'){state.settings.editDay=el.dataset.id;save();render();return;}
    if(action==='activate-plan'){pendingPlan=el.dataset.id;page='activate';render();return;}
    if(action==='toggle-movement'){
      const id=el.dataset.id,arr=profile().selectedMovements;
      profile().selectedMovements=arr.includes(id)?arr.filter(x=>x!==id):[...arr,id];save();render();return;
    }
    if(action==='toggle-edit'&&state.active){
      const idx=+el.dataset.index,g=+el.dataset.group;
      state.active.drafts=state.active.drafts||{};const d=state.active.drafts[g]||{};
      d[`edit-${idx}`]=!d[`edit-${idx}`];state.active.drafts[g]=d;save();render();return;
    }
    if(action==='generate-demo'){
      if(!confirm('Add 10 fictional demo-only athlete profiles? All demo PINs will be 1234. Existing profiles will be kept.'))return;
      const n=demoProfiles();render();showToast(n?`${n} demo athletes added · PIN 1234`:'Demo athletes already exist');return;
    }
    if(action==='reset-pin'){
      const id=el.dataset.id,u=manager.profiles[id];if(!u)return;
      const pin=prompt('Enter a NEW 4-digit PIN for '+u.username);if(pin==null)return;
      if(!/^\d{4}$/.test(pin)){showToast('PIN must be exactly 4 digits');return;}
      u.pin=pin;save();render();showToast('PIN updated');return;
    }
    if(action==='remove-profile'){
      const id=el.dataset.id,u=manager.profiles[id];if(!u||id===activeProfile||id==='admin')return;
      if(!confirm(`Permanently delete ${u.username} and their local workouts? Export a backup first.`))return;
      delete manager.profiles[id];save();render();showToast('Profile removed');return;
    }
    if(action==='home'||action==='progress'){page=action;render();}
    if(action==='start'){page='workout-intro';render();}
    if(action==='begin')startWorkout();
    if(action==='rest-skip')restSkip();
    if(action==='back-set'||action==='back-round')backSet();
    if(action==='pause'){if(state.active){if(state.active.stage==='rest'){state.active.stage='lift';state.active.restUntil=null;}save();}page='home';render();}
    if(action==='discard'&&state.active&&confirm('Discard this unfinished workout? All sets recorded in this session will be lost.')){state.active=null;save();page='home';render();}
    if(action==='rest-add'&&state.active){state.active.restUntil+=15000;state.active.restSeconds+=15;save();render();}
    if(action==='feedback'&&state.active){state.active.stage='feedback';save();render();}
    if(action==='end-early')finishPartial();
    if(action==='cancel-history-edit'){page='summary';render();return;}
    if(action==='edit-history'){state.settings.editSessionId=state.lastSummary||state.history.at(-1)?.id;page='edit-history';render();return;}
    if(action==='last-summary'){state.lastSummary=state.history.at(-1)?.id;page='summary';render();}
    if(action==='review-session'){const id=el.dataset.id; if(id){state.lastSummary=id; page='summary'; render();return;}}
    if(action==='export')exportBackup();
    if(action==='import-v5')importV5Baseline();
    if(action==='clear'){showToast('Export your backup before clearing data in browser settings.');}
  });
  document.addEventListener('input',e=>{
    if(e.target.classList?.contains('rr160-focus-slider')){
      const i=Number(e.target.name.replace('level',''));const label=document.querySelector(`[data-focus-name="${i}"]`);if(label)label.textContent=ADAPT.LEVELS[Number(e.target.value)];return;
    }
    if(e.target.id==='exerciseSearch'){catalogueFilter.search=e.target.value;const start=e.target.selectionStart;render();const field=document.querySelector('#exerciseSearch');if(field){field.focus();if(start!=null)field.setSelectionRange(start,start);}return;}
    if(e.target.form?.id==='roundForm'&&state.active){
      const group=fullRound(buildTasks(state.active.session),state.active.taskIndex);
      state.active.drafts=state.active.drafts||{};
      const values=state.active.drafts[group.start]||{};
      values[e.target.name]=e.target.value;state.active.drafts[group.start]=values;save();
    }
  });
  document.addEventListener('submit',e=>{
    const id=e.target.id;
    if(id==='adaptiveForm'){
      e.preventDefault();if(state.active){showToast('Finish or discard the active session first');return;}
      const f=new FormData(e.target),template=String(f.get('template')),title=ADAPT.TEMPLATES[template]||(profile().adaptivePresets||[]).find(p=>p.id===template);if(!title)return;
      const levels=ADAPT.GROUPS.map((_,i)=>clamp(Number(f.get('level'+i)),0,4));
      const goal=String(f.get('goal')||'hypertrophy'),duration=Number(f.get('duration')),frequency=Number(f.get('frequency')),review=String(f.get('review')),start=String(f.get('start'));
      if(!['hypertrophy','strength','endurance','general'].includes(goal)||duration<20||duration>90||frequency<1||frequency>6||!Object.prototype.hasOwnProperty.call(ADAPT.PERIODS,review)||!/^\d{4}-\d{2}-\d{2}$/.test(start)){showToast('Check your plan settings');return;}
      const gear=f.getAll('gear').filter(id=>window.REPRIVAL_EXERCISE_LIBRARY.gear[id]),prev=profile().adaptive||{},cfg={...prev,active:true,template,levels,goal,duration,frequency,review,startedAt:start,running:f.has('running'),runningLoad:String(f.get('runningLoad'))==='high'?'high':'normal',runningDays:f.getAll('runningDay').map(Number),space:String(f.get('space'))==='large'?'large':'small',experience:['beginner','intermediate','advanced'].includes(f.get('experience'))?String(f.get('experience')):'intermediate',exclusions:f.getAll('exclusion').filter(x=>['carries','overhead','impact','deep_knee','floor'].includes(x)),preferred:f.getAll('preferred').filter(x=>window.REPRIVAL_EXERCISE_LIBRARY.byId[x]&&!f.getAll('avoid').includes(x)),avoid:f.getAll('avoid').filter(x=>window.REPRIVAL_EXERCISE_LIBRARY.byId[x]),sequence:prev.sequence||0};
      const feasible=ADAPT.generate(cfg,state.history,gear,lastReadinessForAdaptive());
      if(feasible.pairs.flatMap(p=>p.exercises).length<3){showToast('Not enough compatible exercises. Check equipment and restrictions.');return;}
      profile().equipment=gear;
      if(!prev.active||!cfg.reviewedAt)cfg.reviewedAt=start;
      profile().adaptive=cfg;profile().planId=ADAPT_ID;selectedPlan=ADAPT_ID;
      createAdaptiveNext(0);SESSION_ORDER=['A'];profile().planTracking={planId:ADAPT_ID,start,weeklyGoal:frequency};
      state.settings.planVersion=(state.settings.planVersion||0)+1;adaptiveDraft=null;
      save();page='workout-intro';render();showToast('Adaptive Training activated');return;
    }
    if(id==='readinessForm'){
      e.preventDefault();const f=new FormData(e.target);
      const record={day:todayLocal(),fatigue:clamp(Number(f.get('fatigue'))||0,0,4),soreness:clamp(Number(f.get('soreness'))||0,0,4),sleep:['good','okay','poor'].includes(f.get('sleep'))?f.get('sleep'):'okay',groups:f.getAll('soreGroup').filter(x=>SORE_GROUPS.includes(x))};
      const log=readinessLog();const at=log.findIndex(x=>x.day===record.day);if(at>=0)log[at]=record;else log.push(record);log.sort((a,b)=>a.day.localeCompare(b.day));if(log.length>120)log.splice(0,log.length-120);
      save();page='home';render();showToast('Your check-in is saved');return;
    }
    if(id==='historyEditForm'){
      e.preventDefault();const s=state.history.find(x=>x.id===state.settings.editSessionId);if(!s)return;
      const data=new FormData(e.target),when=String(data.get('date')||'');if(!/^\d{4}-\d\d-\d\d$/.test(when))return;
      const updated=[];
      for(let i=0;i<s.logs.length;i++){
        const l=s.logs[i],w=l.load==='bodyweight'?0:Number(data.get('weight-'+i)),r=Number(data.get('reps-'+i)),rs=data.get('rir-'+i),rir=rs===''?null:Number(rs);
        if(!Number.isFinite(w)||w<0||!(r>=1&&r<=99&&Number.isInteger(r))||(rir!=null&&(!Number.isInteger(rir)||rir<0||rir>5))){showToast('Check all set values');return;}
        updated.push({...l,weight:w,reps:r,rir});
      }
      const oldDate=dateOnly(s.startedAt||s.endedAt);s.logs=updated;
      if(oldDate!==when){s.startedAt=when+'T09:00:00.000Z';s.endedAt=when+'T10:00:00.000Z';}
      // Recompute derived highlights on demand; do not create another workout.
      s.prs=[];save();page='summary';render();showToast('Past workout corrected · trends updated');return;
    }
    if(id==='setupForm'){
      e.preventDefault();const f=new FormData(e.target),username=String(f.get('username')).trim(),pin=String(f.get('pin'));
      if(username.length<2||!/^\d{4}$/.test(pin)||pin!==f.get('confirm')){showToast('Check username and matching four-digit PINs');return;}
      profile().username=username;profile().pin=pin;profile().body=readBodyForm(f,profile().body,true);manager.setupPending=false;save();page='home';render();return;
    }
    if(id==='equipmentForm'){
      e.preventDefault();const lib=window.REPRIVAL_EXERCISE_LIBRARY,items=[...new Set(new FormData(e.target).getAll('equipment').map(String))];
      profile().equipment=items.filter(id=>lib.gear[id]);save();render();showToast('Your equipment has been saved');return;
    }
    if(id==='recoverySettingsForm'){
      e.preventDefault();const val=String(new FormData(e.target).get('recoveryHours'));
      if(!['auto','24','36','48','72'].includes(val))return;
      profile().recoveryHours=val==='auto'?null:Number(val);
      save();render();showToast('Recovery preference updated');return;
    }
    if(id==='planTimingForm'){
      e.preventDefault();const f=new FormData(e.target),start=String(f.get('start')),goal=Number(f.get('goal'));if(!/^\d{4}-\d\d-\d\d$/.test(start)||goal<1||goal>7)return;profile().planTracking={planId:selectedPlan,start,weeklyGoal:goal};save();render();showToast('Training week updated');return;
    }
    if(id==='activatePlanForm'){
      e.preventDefault();const f=new FormData(e.target),start=String(f.get('start')),goal=Number(f.get('goal'));if(!/^\d{4}-\d\d-\d\d$/.test(start)||goal<1||goal>7||!pendingPlan)return;
      activatePlan(pendingPlan,{start,weeklyGoal:goal});pendingPlan=null;return;
    }
    if(id==='unlockForm'){
      e.preventDefault();const target=manager.pending,valid=manager.profiles[target];
      if(!valid||String(new FormData(e.target).get('pin'))!==valid.pin){showToast('Incorrect PIN');return;}
      manager.pending=null;switchTo(target);return;
    }
    if(id==='createProfileForm'){
      e.preventDefault();if(profile().role!=='admin')return;
      const f=new FormData(e.target),username=String(f.get('username')).trim(),pin=String(f.get('pin'));
      if(profileNames().some(k=>manager.profiles[k].username.toLowerCase()===username.toLowerCase())){showToast('Username is already in use');return;}
      if(!/^\d{4}$/.test(pin)||username.length<2){showToast('Use a username and 4-digit PIN');return;}
      const pid=newProfileId();manager.profiles[pid]={username,pin,role:'athlete',training:defaults(),planId:'pump',plans:{pump:structuredClone(PLAN)},selectedMovements:[],equipment:[],body:readBodyForm(f,{unit:'kg',heightUnit:'cm',waistUnit:'cm',measurements:[]},true)};
      save();render();showToast('Athlete created');return;
    }
    if(id==='metricsForm'){
      e.preventDefault();const f=new FormData(e.target);profile().body=readBodyForm(f,profile().body,false);save();render();showToast('Measurements saved');return;
    }
    if(id==='weighScheduleForm'){
      e.preventDefault();const f=new FormData(e.target),days=f.getAll('day').map(Number).filter(i=>i>=0&&i<=6);
      const enabled=f.has('enabled');if(enabled&&!days.length){showToast('Choose at least one reminder day');return;}
      profile().body.weighSchedule={enabled,days:[...new Set(days)].sort()};save();render();showToast('Weigh-in schedule saved');return;
    }
    if(id==='weighInForm'){
      e.preventDefault();const f=new FormData(e.target),b=profile().body,value=b.unit==='st'?(Number(f.get('stone'))+Number(f.get('pounds'))/14):Number(f.get('weight')),date=String(f.get('date'));
      if(!value||value<=0||!/^\d{4}-\d\d-\d\d$/.test(date)){showToast('Enter weight and a valid date');return;}
      const kg=weightKg(value,b.unit||'kg');b.measurements=b.measurements||[];
      b.measurements=b.measurements.filter(x=>x.date!==date);b.measurements.push({date,kg,waistCm:f.get('waist')?Number(f.get('waist'))*(b.waistUnit==='in'?2.54:1):null,bodyFat:f.get('bodyFat')?Number(f.get('bodyFat')):null});b.measurements.sort((a,b)=>a.date.localeCompare(b.date));save();render();showToast('Weigh-in saved');return;
    }
    if(id==='addExerciseForm'){
      e.preventDefault();if(!canEditPlan())return;
      const f=new FormData(e.target),day=String(f.get('day')),ex=movementLibrary().find(x=>x.id===f.get('exId'));
      if(!ex||!profile().plans[selectedPlan][day])return;
      planSnapshot();const plan=profile().plans[selectedPlan][day];
      plan.pairs.push({id:'block-'+Date.now().toString(36),restMin:75,restMax:105,exercises:[structuredClone(ex)]});
      updatePlan();showToast('Movement added');return;
    }
    if(id==='workoutNameForm'){
      e.preventDefault();const day=state.settings.editDay||SESSION_ORDER[0],val=String(new FormData(e.target).get('name')).trim();
      if(!val)return;if(!canEditPlan())return;planSnapshot();profile().plans[selectedPlan][day].name=val;state.settings.planVersion=(state.settings.planVersion||0)+1;save();render();return;
    }
    if(e.target.classList.contains('editExerciseForm')){
      e.preventDefault();const form=e.target,day=form.dataset.day,pi=+form.dataset.pair,ei=+form.dataset.ex;
      const plan=profile().plans[selectedPlan][day],pair=plan?.pairs[pi],ex=pair?.exercises[ei];if(!ex)return;
      if(state.active){showToast('Finish or discard your current session before editing the plan');return;}
      const f=new FormData(form),sets=+f.get('sets'),min=+f.get('min'),max=+f.get('max'),rest=+f.get('restMin');
      if(!(sets>=1&&sets<=10&&min>=1&&max>=min&&max<=99&&rest>=15&&rest<=300)){showToast('Check sets, rep range and rest');return;}
      const choice=String(f.get('replaceId'));
      const template=movementLibrary().find(x=>x.id===choice);
      if(!template){showToast('Choose a valid movement');return;}
      planSnapshot();
      if(choice!==ex.id){pair.exercises[ei]={...structuredClone(template),sets,min,max};}
      else {ex.sets=sets;ex.min=min;ex.max=max;}
      pair.restMin=rest;pair.restMax=Math.max(pair.restMax,rest);
      updatePlan();showToast('Future workouts updated');return;
    }
    if(e.target.id==='roundForm'){e.preventDefault();submitSet(e.target);}
    if(e.target.id==='feedbackForm'){e.preventDefault();const f=new FormData(e.target);completeWorkout(f.get('feel')||'normal');}
  });
  document.addEventListener('change',async e=>{
    if(e.target.matches('[data-unit]')){const form=e.target.closest('form');if(form)syncBodyFields(form,e.target.dataset.unit);return;}
    if(e.target.id==='adaptiveTemplate'){
      const t=ADAPT.TEMPLATES[e.target.value]||(profile().adaptivePresets||[]).find(p=>p.id===e.target.value);if(!t)return;
      document.querySelectorAll('.rr160-focus-slider').forEach((input,i)=>{input.value=t.levels[i];document.querySelector(`[data-focus-name="${i}"]`).textContent=ADAPT.LEVELS[t.levels[i]];});
      const desc=document.querySelector('#adaptiveTemplateDesc');if(desc)desc.textContent=t.desc;return;
    }
    if(e.target.id==='exerciseMuscle'){catalogueFilter.muscle=e.target.value;render();return;}
    if(e.target.id==='exerciseKit'){catalogueFilter.kit=e.target.value;render();return;}
    if(e.target.id==='exerciseDay'){state.settings.editDay=e.target.value;save();render();return;}
    
    if(e.target.id==='leagueArea'){leagueStore().area=e.target.value;save();render();return;}
    if(e.target.id==='journeyPeriod'||e.target.id==='journeyWorkout'){state.settings[e.target.id]=e.target.value;save();render();return;}
    if(e.target.id==='heatPeriod'){state.settings.heatPeriod=Number(e.target.value);save();render();return;}
    if(e.target.id==='volumeFilter'){state.settings.volumeFilter=e.target.value;save();render();return;}
    if(e.target.id==='movementSelect'){
      state.settings.focusMovement=e.target.value;save();render();return;
    }
    if(e.target.id!=='backupFile')return;
    const file=e.target.files?.[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(data.version===12&&data.profiles&&Object.keys(data.profiles).length){
        if(!confirm('Replace ALL local RepRival profiles with this backup? Export your current data first.'))return;
        localStorage.setItem(PROFILE_KEY,JSON.stringify(data));manager=data;activeProfile=data.last in data.profiles?data.last:Object.keys(data.profiles)[0];ensureTraining();page='home';render();showToast('Profiles restored');return;
      }
      if(data.version===1&&Array.isArray(data.history)&&data.settings){
        if(!confirm('Import this old workout backup into your CURRENT profile, replacing that profile’s sessions?'))return;
        profile().training=data;state=data;save();page='home';render();showToast('Old workout backup imported');return;
      }
      throw Error('Unrecognised backup');
    } catch(err){showToast('Could not import that backup.');}
  });
  let recoveryClockLastMinute=-1;
  let leagueMinuteLast=Math.floor(Date.now()/60000);
  function tick(){
    if(page==='leagues' && Math.floor(Date.now()/60000)!==leagueMinuteLast){leagueMinuteLast=Math.floor(Date.now()/60000);render();}
    if(page==='home' && Math.floor(Date.now()/60000)!==recoveryClockLastMinute){
      recoveryClockLastMinute=Math.floor(Date.now()/60000);
      const indicator=document.querySelector('[data-recovery-countdown]');
      if(indicator){const r=recoveryWindow();indicator.textContent=r.hasWorkout?recoveryText(r.remaining):'Starts after your first workout';}
    }
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
  window.RepRivalTest={getState:()=>structuredClone(state),buildTasks,score,calcRest,version:'1.5.4',league:()=>({store:structuredClone(leagueStore()),inactivity:leagueInactivity()}),comparableSessions,muscleChange};
})();
