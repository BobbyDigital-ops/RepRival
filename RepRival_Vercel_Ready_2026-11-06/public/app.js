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
  const LEGACY_IDS={incline_press:'low_incline_db_press',flat_press:'flat_db_bench_press',reverse_lunge:'reverse_lunge',incline_curl:'incline_db_curl',pec_fly:'flat_db_pec_fly',lateral_raise:'db_lateral_raise',tricep_extension:'lying_db_triceps_extension',ab_rollout:'ab_rollout',rdl:'db_romanian_deadlift',rear_fly:'chest_supported_rear_fly',hammer_curl:'hammer_curl',goblet_squat:'goblet_squat',standing_db_rear_fly:'standing_rear_fly'};
  const $app = document.querySelector('#app');
  let page = 'home';
  let selectedPlan='pump';
  let importedDraftPlan = null;
  let importError = null;
  let manager=null;
  let pendingPlan=null;
  let progressTab='overview';
  let trendEditing=false;
  let trendSearchQuery='';
  const ADAPT=window.RepRivalAdaptive;
  const ADAPT_V3=window.RepRivalAdaptiveV3;
  const ADAPT_ID='adaptive';
  let adaptiveDraft=null;
  let catalogueFilter={muscle:'All',kit:'owned',search:''};
  let activeProfile=null;
  let clock = null;
  let toastUntil = null;
  function safeConfirm(msg){ try { if(window.self !== window.top) return true; return window.safeConfirm(msg); } catch(e){ return true; } }
  let state = loadState();
  initializeProfiles();
  function loadState(){
    try {
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(raw&&Array.isArray(raw.history)&&raw.settings){
        const out={...defaults(),...raw,settings:{...defaults().settings,...raw.settings}};
        const migrateLog=l=>{
          if(LEGACY_IDS[l.exId])l.exId=LEGACY_IDS[l.exId];
          const libEx = window.REPRIVAL_EXERCISE_LIBRARY?.byId?.[l.exId];
          if(libEx){
            if(!l.name) l.name = libEx.name;
            if(!l.muscle) l.muscle = libEx.muscle;
          } else {
            const ex=Object.values(PLAN).flatMap(p=>p.pairs.flatMap(p=>p.exercises)).find(e=>e.id===l.exId);
            if(ex){
              if(!l.name) l.name = ex.name;
              if(!l.muscle) l.muscle = ex.muscle;
            }
          }
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
  
  function generate10PreviewWorkouts(){
    const now = Date.now(), dayMs = 86400000;
    const schedule = [
      { days: 24, code: 'A', calves: true },
      { days: 21, code: 'B', glutes: true },
      { days: 19, code: 'C' },
      { days: 16, code: 'A' },
      { days: 14, code: 'B' },
      { days: 11, code: 'C' },
      { days: 9, code: 'A' },
      { days: 6, code: 'B' },
      { days: 3, code: 'C' },
      { days: 1, code: 'A' }
    ];

    return schedule.map((s, idx) => {
      const when = new Date(now - s.days * dayMs);
      const start = new Date(when.getTime() - 40 * 60000).toISOString();
      const end = when.toISOString();
      const logs = [];
      const prog = 1 + (idx * 0.015);

      if (s.code === 'A') {
        for (let r = 1; r <= 3; r++) logs.push({ exId: 'low_incline_db_press', name: 'Low-incline DB press', muscle: 'Chest', weight: Math.round(22 * prog * 2) / 2, reps: 8, rir: 2, load: 'combined', pair: 'A', round: r, loggedAt: end });
        for (let r = 1; r <= 3; r++) logs.push({ exId: 'inverted_row_neutral', name: 'Inverted row • neutral', muscle: 'Back', weight: 0, reps: 10 + (idx > 5 ? 1 : 0), rir: 2, load: 'bodyweight', pair: 'A', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'reverse_lunge', name: 'Reverse lunge', muscle: 'Quads', weight: Math.round(18 * prog * 2) / 2, reps: 10, rir: 2, load: 'combined', pair: 'B', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'incline_db_curl', name: 'Incline DB curl', muscle: 'Biceps', weight: Math.round(12 * prog * 2) / 2, reps: 12, rir: 1, load: 'combined', pair: 'B', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'flat_db_pec_fly', name: 'Flat DB pec fly', muscle: 'Chest', weight: Math.round(14 * prog * 2) / 2, reps: 12, rir: 2, load: 'combined', pair: 'C', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'db_lateral_raise', name: 'DB lateral raise', muscle: 'Side delts', weight: 10, reps: 14 + (idx > 5 ? 1 : 0), rir: 1, load: 'combined', pair: 'C', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'lying_db_triceps_extension', name: 'Lying DB triceps extension', muscle: 'Triceps', weight: Math.round(14 * prog * 2) / 2, reps: 10, rir: 2, load: 'combined', pair: 'D', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'ab_rollout', name: 'Ab rollout', muscle: 'Core', weight: 0, reps: 12, rir: 2, load: 'bodyweight', pair: 'D', round: r, loggedAt: end });
        if (s.calves) {
          for (let r = 1; r <= 3; r++) logs.push({ exId: 'db_calf_raise', name: 'DB calf raise', muscle: 'Calves', weight: 24, reps: 15, rir: 1, load: 'combined', pair: 'SOLO', round: r, loggedAt: end });
        }
      } else if (s.code === 'B') {
        for (let r = 1; r <= 3; r++) logs.push({ exId: 'flat_db_bench_press', name: 'Flat DB bench press', muscle: 'Chest', weight: Math.round(24 * prog * 2) / 2, reps: 8, rir: 1, load: 'combined', pair: 'A', round: r, loggedAt: end });
        for (let r = 1; r <= 3; r++) logs.push({ exId: 'inverted_row_neutral', name: 'Inverted row • neutral', muscle: 'Back', weight: 0, reps: 10, rir: 2, load: 'bodyweight', pair: 'A', round: r, loggedAt: end });
        for (let r = 1; r <= 3; r++) logs.push({ exId: 'db_romanian_deadlift', name: 'DB Romanian deadlift', muscle: 'Hamstrings', weight: Math.round(26 * prog * 2) / 2, reps: 10, rir: 2, load: 'combined', pair: 'SOLO1', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'chest_supported_rear_fly', name: 'Chest-supported rear fly', muscle: 'Rear delts', weight: 10, reps: 12, rir: 1, load: 'combined', pair: 'B', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'hammer_curl', name: 'Hammer curl', muscle: 'Biceps', weight: Math.round(14 * prog * 2) / 2, reps: 10, rir: 1, load: 'combined', pair: 'B', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'overhead_db_triceps_extension', name: 'Overhead DB triceps extension', muscle: 'Triceps', weight: Math.round(16 * prog * 2) / 2, reps: 10, rir: 1, load: 'combined', pair: 'C', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'db_lateral_raise', name: 'DB lateral raise', muscle: 'Side delts', weight: 10, reps: 14, rir: 1, load: 'combined', pair: 'C', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'decline_sit_up', name: 'Decline sit-up', muscle: 'Core', weight: 0, reps: 15, rir: 2, load: 'optional', pair: 'SOLO2', round: r, loggedAt: end });
        if (s.glutes) {
          for (let r = 1; r <= 3; r++) logs.push({ exId: 'db_glute_bridge', name: 'DB glute bridge', muscle: 'Glutes', weight: 24, reps: 12, rir: 2, load: 'combined', pair: 'SOLO', round: r, loggedAt: end });
        }
      } else {
        for (let r = 1; r <= 3; r++) logs.push({ exId: 'low_incline_db_press', name: 'Low-incline DB press', muscle: 'Chest', weight: Math.round(22 * prog * 2) / 2, reps: 8, rir: 2, load: 'combined', pair: 'A', round: r, loggedAt: end });
        for (let r = 1; r <= 3; r++) logs.push({ exId: 'chest_supported_db_row', name: 'Chest-supported DB row', muscle: 'Back', weight: Math.round(20 * prog * 2) / 2, reps: 10, rir: 2, load: 'combined', pair: 'A', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'incline_db_curl', name: 'Incline DB curl', muscle: 'Biceps', weight: Math.round(12 * prog * 2) / 2, reps: 12, rir: 1, load: 'combined', pair: 'B', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'chest_supported_rear_fly', name: 'Chest-supported rear fly', muscle: 'Rear delts', weight: 10, reps: 12, rir: 1, load: 'combined', pair: 'B', round: r, loggedAt: end });
        for (let r = 1; r <= 3; r++) logs.push({ exId: 'goblet_squat', name: 'Goblet squat', muscle: 'Quads', weight: Math.round(22 * prog * 2) / 2, reps: 10, rir: 2, load: 'single', pair: 'SOLO1', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'db_lateral_raise', name: 'DB lateral raise', muscle: 'Side delts', weight: 10, reps: 15, rir: 1, load: 'combined', pair: 'C', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'ab_rollout', name: 'Ab rollout', muscle: 'Core', weight: 0, reps: 12, rir: 2, load: 'bodyweight', pair: 'C', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'flat_db_pec_fly', name: 'Flat DB pec fly', muscle: 'Chest', weight: Math.round(14 * prog * 2) / 2, reps: 12, rir: 2, load: 'combined', pair: 'D', round: r, loggedAt: end });
        for (let r = 1; r <= 2; r++) logs.push({ exId: 'lying_db_triceps_extension', name: 'Lying DB triceps extension', muscle: 'Triceps', weight: Math.round(14 * prog * 2) / 2, reps: 10, rir: 2, load: 'combined', pair: 'D', round: r, loggedAt: end });
      }

      return {
        id: 'preview-wo-' + (idx + 1),
        session: s.code,
        sessionName: 'Full Body ' + s.code,
        planId: 'pump',
        planVersion: 1,
        startedAt: start,
        endedAt: end,
        feeling: idx % 4 === 0 ? 'strong' : 'good',
        recovery: 48,
        prs: idx > 6 ? [{ exId: 'low_incline_db_press', metric: 'reps', val: 8 }] : [],
        logs
      };
    });
  }

  function initializeProfiles(){
    try{
      const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      if (stored?.version === 12 && stored.profiles && Object.keys(stored.profiles).length) {
        manager = stored;
        activeProfile = stored.last in stored.profiles ? stored.last : Object.keys(stored.profiles)[0];
        state = manager.profiles[activeProfile].training;
        if (stored.setupPending) page = 'setup';
      }
    } catch(e) { console.warn('Profile data unavailable', e); }

    if (!manager) {
      manager = {
        version: 12,
        last: 'admin',
        profiles: {
          admin: {
            username: 'Rival Athlete',
            pin: '1234',
            role: 'admin',
            training: structuredClone(state),
            body: {
              unit: 'kg',
              heightUnit: 'cm',
              waistUnit: 'cm',
              dob: '1992-05-14',
              sex: 'male',
              height: 178,
              measurements: [
                { date: dateOnly(new Date(Date.now() - 24 * 86400000).toISOString()), kg: 78.5 },
                { date: dateOnly(new Date(Date.now() - 14 * 86400000).toISOString()), kg: 78.1 },
                { date: dateOnly(new Date(Date.now() - 1 * 86400000).toISOString()), kg: 77.8 }
              ]
            },
            selectedMovements: ['A:low_incline_db_press', 'B:flat_db_bench_press', 'C:low_incline_db_press'],
            planId: 'pump',
            plans: null
          }
        },
        setupPending: false
      };
      activeProfile = 'admin';
      page = 'home';
    }

    // Auto-populate preview build with 10 workouts if profile has no workouts yet
    if (profile() && profile().training && (!profile().training.history || profile().training.history.length === 0)) {
      profile().training.history = generate10PreviewWorkouts();
      profile().training.next = 'B';
      profile().training.lastSummary = profile().training.history.at(-1)?.id || null;
      if (!profile().body.measurements || profile().body.measurements.length === 0) {
        profile().body.measurements = [
          { date: dateOnly(new Date(Date.now() - 24 * 86400000).toISOString()), kg: 78.5 },
          { date: dateOnly(new Date(Date.now() - 14 * 86400000).toISOString()), kg: 78.1 },
          { date: dateOnly(new Date(Date.now() - 1 * 86400000).toISOString()), kg: 77.8 }
        ];
      }
      state = profile().training;
      save();
    }

    ensureTraining();
  }
  function profile(){return manager.profiles[activeProfile];}
  function canImportOwnerBaseline(){return !profile()?.demo&&!state.history.some(s=>s.source==='pumpplan-v5'||s.id==='v5-baseline-2026-10-17');}
  function ensureTraining(){
    state=profile().training;
    if(!state.settings)state.settings=defaults().settings;
    if(state.active){
      if(state.active.accumulatedTime === undefined) state.active.accumulatedTime = 0;
      if(state.active.lastStartTime === undefined) state.active.lastStartTime = state.active.startedAt ? new Date(state.active.startedAt).getTime() : Date.now();
    }
    if(!profile().body)profile().body={unit:'kg',heightUnit:'cm',waistUnit:'cm',measurements:[]};
    if(!profile().selectedMovements)profile().selectedMovements=[];
    if(!Array.isArray(profile().equipment))profile().equipment=(activeProfile==='admin'&&!profile().demo)?[...window.REPRIVAL_EXERCISE_LIBRARY.ownerDefault]:[];
    if(!Array.isArray(profile().dumbbellInventory) || !profile().dumbbellInventory.length) {
      profile().dumbbellInventory = [5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5];
    }
    if(!Array.isArray(profile().kettlebellInventory))profile().kettlebellInventory=[16];
    if(!profile().equipmentMetadata)profile().equipmentMetadata={};
    if(!profile().quickWorkoutPreference)profile().quickWorkoutPreference='mixed';
    if(!profile().planId)profile().planId='pump';
    if(profile().planId===ADAPT_ID&&!profile().plans?.adaptive){profile().planId='pump';}
    if(!profile().trendOverrides)profile().trendOverrides={added:[],hidden:[]};
    if(!profile().plans)profile().plans={pump:structuredClone(PLAN)};
    if(profile().plans?.pump?.C){
      const cPairs = profile().plans.pump.C.pairs || [];
      cPairs.forEach(p => {
        p.exercises.forEach(ex => {
          if(ex.id === 'chest_supported_db_row' && p.exercises.some(e => e.id === 'low_incline_db_press')){
            ex.id = 'db_bent_over_row';
            ex.name = 'Bent-over DB row';
            ex.muscle = 'Back';
          }
          if(ex.id === 'chest_supported_rear_fly' || ex.id === 'standing_db_rear_fly'){
            ex.id = 'standing_rear_fly';
            ex.name = 'Standing DB rear-delt fly';
            ex.muscle = 'Rear delts';
          }
        });
      });
    }
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
  function consistency(){
    const conf = tracking();
    const goal = Number(conf.weeklyGoal) || 3;
    const history = state?.history || profile()?.training?.history || [];

    // All workouts belonging to this user/plan
    const planWorkouts = history.filter(s => !s.planId || s.planId === conf.planId || conf.planId === 'pump');
    const allWorkouts = planWorkouts.length ? planWorkouts : history;

    const dates = allWorkouts.map(s => {
      const raw = s.startedAt || s.endedAt || s.loggedAt || s.date || (s.id && typeof s.id === 'string' && s.id.includes('202') ? s.id.slice(0, 10) : null);
      return raw ? String(raw).slice(0, 10) : null;
    }).filter(Boolean).sort();

    const totalCompleted = allWorkouts.length;
    if (totalCompleted === 0) {
      return {
        start: todayLocal(),
        goal,
        week: 0,
        since: todayLocal(),
        through: dayAt(todayLocal(), 6),
        done: 0,
        totalDone: 0,
        totalTarget: goal,
        weeks: [],
        percentage: 0
      };
    }

    const today = todayLocal();
    const earliestWorkout = dates[0] || today;
    // Anchor plan start date to earliest workout, or configured start if reasonable
    const start = (conf.start && conf.start <= earliestWorkout && (dayNumber(earliestWorkout) - dayNumber(conf.start) <= 14))
      ? conf.start
      : earliestWorkout;

    const elapsedDays = Math.max(1, dayNumber(today) - dayNumber(start) + 1);
    const elapsedWeeks = Math.max(1, Math.ceil(elapsedDays / 7));

    // Completed weeks + prorated current week target
    const completedWeeks = Math.max(0, elapsedWeeks - 1);
    const daysInCurrentWeek = ((elapsedDays - 1) % 7) + 1;
    const currentWeekTarget = Math.min(goal, Math.max(1, Math.round((daysInCurrentWeek / 7) * goal)));
    const totalTarget = Math.max(1, (completedWeeks * goal) + (totalCompleted > (completedWeeks * goal) ? Math.min(goal, totalCompleted - (completedWeeks * goal)) : currentWeekTarget));

    // Consistency percentage across the entire plan
    let percentage = Math.min(100, Math.round((totalCompleted / totalTarget) * 100));
    if (totalCompleted > 0 && percentage < 25) {
      percentage = Math.min(100, Math.max(33, Math.round((totalCompleted / Math.max(1, elapsedWeeks * goal)) * 100)));
    }

    // Workouts done in recent 7-day rolling window
    const weekStartDaysAgo = dayAt(today, -6);
    const doneThisWeek = allWorkouts.filter(s => {
      const d = dateOnly(s.startedAt || s.endedAt);
      return d >= weekStartDaysAgo && d <= today;
    }).length;

    const weeks = [];
    for(let i = 0; i < Math.min(12, elapsedWeeks); i++){
      const wStart = dayAt(start, i * 7);
      const wEnd = dayAt(wStart, 6);
      const count = allWorkouts.filter(s => {
        const d = dateOnly(s.startedAt || s.endedAt);
        return d >= wStart && d <= wEnd;
      }).length;
      weeks.push({ start: wStart, end: wEnd, count, goal });
    }

    return {
      start,
      goal,
      week: elapsedWeeks - 1,
      since: dayAt(start, Math.max(0, elapsedWeeks - 1) * 7),
      through: dayAt(start, Math.max(0, elapsedWeeks - 1) * 7 + 6),
      done: doneThisWeek,
      totalDone: totalCompleted,
      totalTarget: totalTarget,
      weeks,
      percentage: totalCompleted > 0 ? (percentage || 33) : 0
    };
  }
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
  // The heatmap shows recent logged TRAINING EXPOSURE and weekly effective set coverage.
  const HEAT_KEYS=['Chest','Back','Side delts','Rear delts','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Core'];
  const DEFAULT_WEEKLY_TARGETS = {
    'Chest': 10,
    'Back': 10,
    'Side delts': 6,
    'Rear delts': 6,
    'Biceps': 6,
    'Triceps': 6,
    'Quads': 10,
    'Hamstrings': 8,
    'Glutes': 8,
    'Calves': 6,
    'Core': 6
  };

  function heatData(period=7){
    if (window.RepRivalIntelligence && typeof window.RepRivalIntelligence.calculateMuscleMetrics === 'function') {
      const checkin = (typeof todayReadiness === 'function') ? todayReadiness() : {};
      return window.RepRivalIntelligence.calculateMuscleMetrics({
        history: state.history || [],
        checkin: checkin,
        period: period,
        now: Date.now(),
        customTargets: DEFAULT_WEEKLY_TARGETS
      });
    }
    console.error('RepRival Critical: RepRivalIntelligence module not loaded on window');
    const now=Date.now(), days=period===28?28:7;
    const out=Object.fromEntries(HEAT_KEYS.map(m=>[m,{
      name:m,
      effectiveSets:0,
      primarySets:0,
      secondarySets:0,
      targetSets: DEFAULT_WEEKLY_TARGETS[m] || 10,
      last:null,
      ever:false,
      historySets:0,
      historySessions:new Set(),
      rirSum:0,
      rirCount:0
    }]));

    const secondaryMap={
      'Chest':[['Triceps', 0.4], ['Side delts', 0.2]],
      'Back':[['Biceps', 0.4], ['Rear delts', 0.3]],
      'Quads':[['Glutes', 0.3]],
      'Hamstrings':[['Glutes', 0.3]],
      'Glutes':[['Hamstrings', 0.2]],
      'Side delts':[['Triceps', 0.3]],
      'Rear delts':[['Back', 0.2]]
    };

    for(const s of state.history){
      const time=Date.parse(s.endedAt||s.startedAt||'');
      if(!Number.isFinite(time)||time>now+86400000)continue;
      const age=Math.max(0,(now-time)/86400000);
      for(const l of (s.logs||[])){
        if(!l || l.skipped) continue;
        const primary=l.muscle;
        if(!out[primary]) continue;

        out[primary].ever=true;
        out[primary].historySets++;
        out[primary].historySessions.add(s.id||String(time));
        out[primary].last=Math.max(out[primary].last||0, time);

        if(age <= days){
          out[primary].primarySets += 1;
          out[primary].effectiveSets += 1.0;
          if(l.rir != null && Number.isFinite(Number(l.rir))){
            out[primary].rirSum += Number(l.rir);
            out[primary].rirCount += 1;
          }

          const sec = secondaryMap[primary] || [];
          for(const [secMuscle, factor] of sec){
            if(out[secMuscle]){
              out[secMuscle].secondarySets += factor;
              out[secMuscle].effectiveSets += factor;
            }
          }
        }
      }
    }

    const checkin = todayReadiness() || {};
    const sorenessMap = checkin.sorenessMap || {};
    const soreGroups = checkin.groups || [];
    const fatigue = checkin.fatigue || 2; // Default to 'okay'
    const sleep = checkin.sleep || null;

    for(const m of HEAT_KEYS){
      const p=out[m];
      const target = p.targetSets || 10;
      
      // 1. Weekly coverage percentage (preserved as metadata)
      p.coveragePct = Math.round((p.effectiveSets / target) * 100);
      
      // 2. Multifacted Readiness Score (0-100%)
      // We start at 100 and subtract penalties.
      let score = 100;
      const factors = [];

      // A. Workload penalty (fatigue from sets)
      // Decay penalty over time: 48-96h window depending on volume.
      const avgRir = p.rirCount > 0 ? (p.rirSum / p.rirCount) : 2.5;
      const intensityMult = Math.max(0.6, 1.4 - (avgRir / 6));
      // Base penalty: 4 points per effective set (10 sets = 40% reduction)
      const baseWorkloadPenalty = (p.effectiveSets * 4) * intensityMult;
      
      p.recencyHours = p.last ? Math.max(0, (now - p.last) / 3600000) : null;
      let currentWorkloadPenalty = baseWorkloadPenalty;
      
      if (p.recencyHours != null) {
        // Recovery curve: slower for higher volume
        const recoveryHoursNeeded = 36 + (p.effectiveSets * 3); 
        const recoveryProgress = Math.min(1.0, p.recencyHours / recoveryHoursNeeded);
        // Penalty decays but stays at least 15% of base if volume was high (> target)
        const floorFactor = p.effectiveSets > target ? 0.15 : 0;
        const decayMult = Math.max(floorFactor, 1 - recoveryProgress);
        currentWorkloadPenalty = baseWorkloadPenalty * decayMult;
      }
      
      if (currentWorkloadPenalty > 0) {
        score -= currentWorkloadPenalty;
        factors.push(`Workload: -${Math.round(currentWorkloadPenalty)}%`);
      }

      // B. Workload Spike (Unusual increase)
      const historicalAvgSets = p.historySessions.size > 0 ? (p.historySets / p.historySessions.size) : 0;
      if (p.effectiveSets > (historicalAvgSets * 1.6) && p.effectiveSets > 5) {
        score -= 12;
        factors.push(`Workload spike: -12%`);
      }

      // C. User Feedback (Soreness)
      let sorenessSeverity = 'none';
      if(sorenessMap[m]) sorenessSeverity = sorenessMap[m];
      else if(soreGroups.includes(m)) sorenessSeverity = 'moderate';
      
      if (sorenessSeverity === 'severe') { score -= 45; factors.push(`Severe soreness: -45%`); }
      else if (sorenessSeverity === 'moderate') { score -= 20; factors.push(`Moderate soreness: -20%`); }
      else if (sorenessSeverity === 'mild') { score -= 8; factors.push(`Mild soreness: -8%`); }
      
      // D. General Fatigue & Sleep (Systemic)
      let systemicPenalty = 0;
      if (fatigue >= 4) systemicPenalty += 15;
      else if (fatigue >= 3) systemicPenalty += 5;
      if (sleep === 'poor') systemicPenalty += 10;
      
      if (systemicPenalty > 0) {
        score -= systemicPenalty;
        factors.push(`Systemic (Sleep/Fatigue): -${systemicPenalty}%`);
      }

      p.readinessScore = p.ever ? Math.max(0, Math.min(100, Math.round(score))) : null;
      p.score = p.readinessScore; 
      p.breakdown = factors.length ? factors.join(', ') : 'Fully recovered';

      if(!p.ever){
        p.readinessState = 'Insufficient data';
        p.readinessScore = null;
        p.score = null;
      } else if(p.readinessScore <= 39){
        p.readinessState = 'High recent load';
      } else if(p.readinessScore <= 69){
        p.readinessState = 'Recovering';
      } else if(p.readinessScore <= 84){
        p.readinessState = 'Mostly ready';
      } else {
        p.readinessState = 'Ready';
      }

      // 3. Recency Score for anatomical map (Red-to-Blue)
      if (p.last) {
        const days = (now - p.last) / 86400000;
        if (days <= 14) p.mapScore = 100 - (days * (50 / 14));
        else p.mapScore = Math.max(0, 50 - ((days - 14) * (50 / 14)));
      } else {
        p.mapScore = 0; 
      }

      const formattedSets = Number.isInteger(p.effectiveSets) ? p.effectiveSets : p.effectiveSets.toFixed(1).replace(/\.0$/, '');
      const setsNote = `${formattedSets}/${target} effective sets`;
      p.statusLabel = `${m} (${setsNote})`;
      p.avgRir = p.rirCount > 0 ? (p.rirSum / p.rirCount).toFixed(1) : null;
    }
    return out;
  }


  function heatBar(nameOrObj, score, statusLabel, effectiveSets, targetSets, readinessState, breakdown, stimulusScore){
    let name, rScore, sScore, effSets, tgtSets, state, bdown;
    if (nameOrObj && typeof nameOrObj === 'object') {
      name = nameOrObj.name || '';
      rScore = nameOrObj.readinessScore !== undefined ? nameOrObj.readinessScore : (nameOrObj.score !== undefined ? nameOrObj.score : null);
      sScore = nameOrObj.stimulusScore !== undefined ? nameOrObj.stimulusScore : 0;
      effSets = nameOrObj.effectiveSets != null ? nameOrObj.effectiveSets : 0;
      tgtSets = nameOrObj.targetSets != null ? nameOrObj.targetSets : 10;
      state = nameOrObj.readinessState;
      bdown = nameOrObj.breakdown;
    } else {
      name = nameOrObj || '';
      rScore = score !== undefined ? score : null;
      sScore = stimulusScore !== undefined ? stimulusScore : 0;
      effSets = effectiveSets != null ? effectiveSets : 0;
      tgtSets = targetSets != null ? targetSets : 10;
      state = readinessState;
      bdown = breakdown;
    }

    if (!state) {
      if (window.RepRivalIntelligence && typeof window.RepRivalIntelligence.getReadinessState === 'function') {
        state = window.RepRivalIntelligence.getReadinessState(rScore);
      } else {
        if (rScore == null) state = 'Insufficient data';
        else if (rScore <= 39) state = 'High recent load';
        else if (rScore <= 69) state = 'Recovering';
        else if (rScore <= 84) state = 'Mostly ready';
        else state = 'Ready';
      }
    }

    const formattedEff = Number.isInteger(effSets) ? effSets : Number(effSets).toFixed(1).replace(/\.0$/, '');
    const setSummary = `(${formattedEff}/${tgtSets} sets)`;

    let pillClass = 'ready';
    if(state === 'High recent load') pillClass = 'high-load';
    else if(state === 'Recovering') pillClass = 'recovering';
    else if(state === 'Mostly ready') pillClass = 'mostly-ready';
    else if(state === 'Insufficient data') pillClass = 'insufficient';

    const stateBadge = state ? `<span class="rr-readiness-pill ${pillClass}">${esc(state)}</span>` : '';

    const sVal = Math.max(0, Math.min(100, Math.round(Number(sScore) || 0)));
    const displayStimulus = `${sVal}%`;

    const stimColor = window.RepRivalIntelligence && typeof window.RepRivalIntelligence.getStimulusColor === 'function'
      ? window.RepRivalIntelligence.getStimulusColor(sVal)
      : null;
    const stimBgStyle = stimColor ? `background:${stimColor.fill};` : '';

    let stimulusFillClass = 'stimulus-active';
    if (sVal >= 55) {
      stimulusFillClass = 'stimulus-hot';
    } else if (sVal >= 20) {
      stimulusFillClass = 'stimulus-active';
    } else if (sVal > 0) {
      stimulusFillClass = 'stimulus-cold';
    } else {
      stimulusFillClass = 'stimulus-dim';
    }

    const displayReadiness = rScore !== null ? `${Math.round(rScore)}%` : '—';
    let readinessFillClass = 'readiness-ready';
    if (rScore === null) {
      readinessFillClass = 'readiness-null';
    } else if (rScore <= 39) {
      readinessFillClass = 'readiness-high-load';
    } else if (rScore <= 69) {
      readinessFillClass = 'readiness-recovering';
    } else if (rScore <= 84) {
      readinessFillClass = 'readiness-mostly-ready';
    } else {
      readinessFillClass = 'readiness-ready';
    }

    const breakdownHtml = (bdown && rScore !== null && rScore < 100) ? `<div class="rr-heat-breakdown">${esc(bdown)}</div>` : '';

    return `<div class="rr-heat-row rr-two-metric-row">
      <div class="rr-two-metric-header">
        <div class="rr-two-metric-title">
          <strong class="rr-group-name">${esc(name)}</strong>
          <span class="rr-group-sets">${esc(setSummary)}</span>
        </div>
        ${stateBadge}
      </div>
      <div class="rr-two-metric-bars">
        <div class="rr-metric-subrow">
          <div class="rr-metric-subhead">
            <span class="rr-metric-type">Stimulus</span>
            <strong class="rr-metric-pct stimulus-pct">${displayStimulus}</strong>
          </div>
          <div class="rr-metric-track stimulus-track" role="progressbar" aria-label="${esc(name)} stimulus: ${displayStimulus}" aria-valuenow="${sVal}" aria-valuemin="0" aria-valuemax="100">
            <span class="rr-metric-fill ${stimulusFillClass}" style="width:${sVal}%;${stimBgStyle}"></span>
          </div>
        </div>
        <div class="rr-metric-subrow">
          <div class="rr-metric-subhead">
            <span class="rr-metric-type">Readiness</span>
            <strong class="rr-metric-pct readiness-pct">${displayReadiness}</strong>
          </div>
          <div class="rr-metric-track readiness-track" role="progressbar" aria-label="${esc(name)} readiness: ${displayReadiness}" aria-valuenow="${rScore != null ? Math.round(rScore) : 0}" aria-valuemin="0" aria-valuemax="100">
            <span class="rr-metric-fill ${readinessFillClass}" style="width:${rScore !== null ? Math.max(0, Math.min(100, Math.round(rScore))) : 0}%"></span>
          </div>
        </div>
      </div>
      ${breakdownHtml}
    </div>`;
  }

  function musclePanel(compact=false){
    const period=compact?7:(state.settings.heatPeriod===28?28:7),data=heatData(period);
    const groups=[['Chest',['Chest']],['Back',['Back']],['Shoulders',['Side delts','Rear delts']],['Arms',['Biceps','Triceps']],['Quads',['Quads']],['Hamstrings',['Hamstrings']],['Glutes',['Glutes']],['Calves',['Calves']],['Core',['Core']]];
    
    const top = (window.RepRivalIntelligence && typeof window.RepRivalIntelligence.calculateGroupMetrics === 'function')
      ? window.RepRivalIntelligence.calculateGroupMetrics(data)
      : [];


    const active=top.filter(m=>m.readinessState === 'Ready' || m.readinessState === 'Mostly ready').length;
    const lastWorkout=state.history.length?Math.max(...state.history.map(s=>Date.parse(s.endedAt||s.startedAt||'' )).filter(Number.isFinite)):null;
    const recentEnough=lastWorkout&&Date.now()-lastWorkout<14*86400000;
    const neglect=recentEnough?top.filter(g=>g.keys.some(k=>data[k].ever)&&g.keys.every(k=>(!data[k].last||Date.now()-data[k].last>14*86400000))).sort((a,b)=>a.score-b.score)[0]:null;
    const totalSets=state.history.filter(s=>Date.now()-Date.parse(s.endedAt||s.startedAt||'')<period*86400000).reduce((n,s)=>n+(s.logs||[]).length,0);
    const figures=`<div class="rr-figures"><div class="rr-body"><div class="rr-figure-wrap">${window.RepRivalBodyMap.figure('front',data)}</div><span>FRONT</span></div><div class="rr-body"><div class="rr-figure-wrap">${window.RepRivalBodyMap.figure('back',data)}</div><span>BACK</span></div></div>`;

    if(compact)return `<div class="rr-heat-compact">${figures}<div class="rr-heat-compact-side"><div class="rr-heat-compact-head"><div class="rr-heat-kicker">READINESS & STIMULUS</div><strong class="rr-heat-big">${active}<small> / 9</small></strong><span>groups ready</span></div><div class="rr-heat-compact-lines">${top.map(m=>heatBar(m)).join('')}</div></div></div><div class="rr-heat-legend"><span>DETRAINING (BLUE)</span><i></i><span>STIMULUS (RED)</span></div><p class="rr-heat-note">Readiness: Recovery estimate vs capacity. Stimulus: Productive hypertrophy exposure.</p>`;

    return `<div class="rr-heat-full"><div class="rr-heat-heading"><div><div class="rr-heat-kicker">TRAINING & RECOVERY METRICS</div><h2>Muscle Heat & Readiness</h2><p>Distinguishing weekly training stimulus, estimated muscle readiness, and long-term strength progression.</p></div><div><label class="sr-only" for="heatPeriod">Timeframe</label><select id="heatPeriod" aria-label="Muscle map timeframe"><option value="7" ${period===7?'selected':''}>This week</option><option value="28" ${period===28?'selected':''}>Last 28 days</option></select></div></div><div class="rr-heat-atlas">${figures}<div class="rr-heat-details">${top.map(m=>heatBar(m)).join('')}</div></div><div class="rr154-muscle-key"><span><b style="background:#ef493f;"></b>&lt;3 days (Hot Stimulus)</span><span><b style="background:#b72b24;"></b>7 days (Active Stimulus)</span><span><b style="background:#2a2c32;"></b>14 days (Fading)</span><span><b style="background:#4b6ba2;"></b>&gt;14 days (Detraining)</span></div><div class="rr-heat-meta"><div><strong>${active} / 9</strong><span>groups ready to train</span></div><div><strong>${totalSets}</strong><span>logged sets · ${period} days</span></div></div>${neglect?`<div class="rr-heat-alert"><span aria-hidden="true">◷</span><div><strong>${esc(neglect.name)} haven't been trained recently</strong><p>Your logs show over 14 days without work for this area. Consider it when planning your next session.</p></div></div>`:!state.history.length?`<div class="rr-heat-alert"><span aria-hidden="true">◇</span><div><strong>Your map starts rested</strong><p>Log a workout to see effective set coverage fill up and muscle heat glow.</p></div></div>`:''}<p class="rr-heat-disclaimer">RepRival readiness estimates recovery capacity based on workload, intensity (RIR), recovery decay, and soreness. Heat zones indicate recent productive stimulus magnitude and recency.</p></div>`;

  }

  function muscleDetailScreen(){
    const m=state.settings.selectedMuscle||'Chest',period=28,data=heatData(period);
    const named=LEAGUE_GROUPS[m]||[m];
    const chosen=named.filter(x=>data[x]);
    
    const scores = chosen.map(x => data[x].score).filter(s => s !== null);
    const points = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const stimScores = chosen.map(x => data[x].stimulusScore || 0);
    const stimPoints = stimScores.length ? Math.round(stimScores.reduce((a, b) => a + b, 0) / stimScores.length) : 0;
    const effSets = chosen.reduce((a, x) => a + (data[x].effectiveSets || 0), 0);
    const tgtSets = chosen.reduce((a, x) => a + (data[x].targetSets || 10), 0);
    const breakdown = chosen.map(x => data[x].breakdown).filter(b => b && b !== 'Fully recovered').join('; ') || 'No significant fatigue factors';
    
    const last=chosen.map(x=>data[x].last).filter(Boolean).sort((a,b)=>b-a)[0]||null;
    const related=state.history.flatMap(s=>(s.logs||[]).filter(l=>named.includes(l.muscle)).map(l=>({...l,when:s.endedAt||s.startedAt}))).sort((a,b)=>Date.parse(b.when)-Date.parse(a.when)).slice(0,8);
    const displayPoints = points !== null ? `${points}%` : '—';

    return `<div class="eyebrow">PERFORMANCE · MUSCLE DETAILS</div><h1 class="page-title">${esc(m)}</h1>${card(`<div class="row"><h3>Readiness Estimate</h3><span class="label-tag">RECOVERY SCORE</span></div><h2 class="rr154-muscle-score">${displayPoints}</h2>${heatBar({ name: m, readinessScore: points, stimulusScore: stimPoints, effectiveSets: effSets, targetSets: tgtSets, breakdown: breakdown })}<p class="subhead mt12">Last trained: ${last?dateText(new Date(last).toISOString()):'No recorded session'}. This score estimates your current ability to train this muscle based on workload, intensity, and feedback.</p>`,'section')}${card(`<h3>Recent recorded sets</h3>${related.length?related.map(l=>`<div class="rr154-checkin-history"><strong>${esc(l.name||l.exId)}</strong><span>${esc(String(l.reps||0))} reps · ${esc(String(l.weight??'BW'))} ${l.weight==='bodyweight'?'':'kg'} · ${esc(dateOnly(l.when))}</span></div>`).join(''):'<p class="subhead mt8">No matching training sessions recorded yet.</p>'}`,'section')}<button class="btn outline full" type="button" data-action="progress-tab" data-tab="muscles">Back to muscle map</button>`;
  }


  function muscleTrendPanel(){
    const rows=MUSCLES.map(m=>({name:m,data:muscleChange(m)}));
    const peak=Math.max(15,...rows.filter(x=>x.data).map(x=>Math.abs(x.data.change)));
    return `<div class="muscle-list">${rows.map(row=>`<div class="muscle-item"><div class="muscle-label"><strong>${esc(row.name)}</strong><span>${row.data?progressPct(row.data.change):'Not started'}</span></div><div class="muscle-track"><span style="width:${row.data?Math.min(100,Math.abs(row.data.change)/peak*100):0}%"></span></div></div>`).join('')}</div><p class="fineprint">Compared exercise performance; not measured muscle size.</p>`;
  }

  function historyList(limit=6){
    return [...state.history].reverse().slice(0,limit).map(s=>`<div class="session-row" data-action="review-session" data-id="${esc(s.id)}" style="cursor:pointer;" title="Review & Edit Workout"><div><strong>${esc(s.sessionName||'Full Body '+s.session)}</strong><small>${dateText(s.endedAt||s.startedAt)} · ${(s.logs||[]).filter(l=>!l.skipped).length} sets · ${fmt((s.logs||[]).reduce((n,l)=>n+setVolume(l),0))} kg volume</small></div><button type="button" class="quiet-link" data-action="review-session" data-id="${esc(s.id)}">Review →</button></div>`).join('')||'<p class="muted">No saved workouts yet.</p>';
  }

  function lastSessionOf(id){return [...state.history].reverse().find(s=>s.session===id);}
  function nextLetter(id){return SESSION_ORDER[(SESSION_ORDER.indexOf(id)+1)%SESSION_ORDER.length];}
  function planFor(id){
    if(state.active && (state.active.session === id || !id) && state.active.pairs){
      const p = profile().plans[selectedPlan] || PLAN;
      const base = p[id] || p[Object.keys(p)[0]] || PLAN.A;
      return { ...base, pairs: state.active.pairs };
    }
    if(state.activeCustomPairs && (!state.active || state.active.session === id)){
      const p = profile().plans[selectedPlan] || PLAN;
      const base = p[id] || p[Object.keys(p)[0]] || PLAN.A;
      return { ...base, pairs: state.activeCustomPairs };
    }
    const p=profile().plans[selectedPlan]||PLAN;
    return p[id]||p[Object.keys(p)[0]]||PLAN.A;
  }
  function buildTasks(id, customPairs){
    const result=[];
    const pairs = customPairs || (state.active?.pairs) || (state.activeCustomPairs) || (planFor(id).pairs || []);
    pairs.forEach((pair,pi)=>{
      const rounds=Math.max(...pair.exercises.map(x=>x.sets));
      for(let round=1;round<=rounds;round++){
        pair.exercises.forEach((ex,ei)=>{
          if(round<=ex.sets) {
            result.push({index:result.length,ex,pair,pi,round,rounds,ei,repLabel:`${ex.min}–${ex.max}${ex.suffix?' '+ex.suffix:''}`});
          }
        });
      }
    });
    result.forEach((t, idx) => { t.index = idx; });
    return result;
  }
  function adjustedRestSeconds(prescribed, isTransition=false){
    if(isTransition) return prescribed;
    return Math.max(15, Number(prescribed) - 15);
  }
  function exerciseLastSet(exId,activeLogs=[]){
    const current=[...activeLogs].reverse().find(l=>l&&l.exId===exId&&!l.skipped);
    return current||[...allLogs()].reverse().find(l=>l&&l.exId===exId&&!l.skipped)||null;
  }
  function score(log){
    if(!log||log.skipped||log.reps<=0)return 0;
    if(log.load==='bodyweight'||(log.load==='optional'&&!log.weight))return log.reps;
    // Estimated 1RM is only an approximate ranking signal, not a tested maximum.
    return log.weight*(1+Math.min(log.reps,30)/30);
  }
  function scoreLabel(log){
    if(!log) return '';
    if(log.skipped) return 'Skipped';
    if(log.load==='bodyweight'||(log.load==='optional'&&!log.weight)) return `${log.reps} reps`;
    const w = Number(log.weight);
    if(w === 0) return `0 kg (BW) × ${log.reps}`;
    const libEx = window.REPRIVAL_EXERCISE_LIBRARY?.byId?.[log.exId];
    const isDB = (log.equipment && log.equipment.includes('dumbbells')) ||
                 /(\bdb\b|dumbbell)/i.test(log.name || '') ||
                 (libEx?.equipment && libEx.equipment.includes('dumbbells'));
    if(isDB && log.load !== 'single' && libEx?.load !== 'single' && !isSingleDumbbell(log)){
      const each = +(w / 2).toFixed(1);
      return `${each} kg each (${fmt(w)} kg total) × ${log.reps}`;
    }
    return `${fmt(w)} kg × ${log.reps}`;
  }
  function logEffectiveMultiplier(l){
    if(!l || l.skipped || l.load === 'bodyweight') return 0;
    const libEx = window.REPRIVAL_EXERCISE_LIBRARY?.byId?.[l.exId];
    const isDB = (l.equipment && l.equipment.includes('dumbbells')) ||
                 /(\bdb\b|dumbbell)/i.test(l.name || '') ||
                 (libEx?.equipment && libEx.equipment.includes('dumbbells'));
    if (isDB) {
      if (l.load === 'single' || libEx?.load === 'single') {
        return 1;
      }
      return 2; // Two dumbbells (bench press, incline, rows, curls, lateral raises, flyes)
    }
    return 1; // Barbell, cable, machine
  }
  function setVolume(l){
    if(!l || l.skipped || !l.reps || l.reps <= 0) return 0;
    return Number(l.weight || 0) * logEffectiveMultiplier(l) * Number(l.reps || 0);
  }
  function bestByExercise(logs){
    const result={};
    logs.forEach(l=>{if(l&&!l.skipped&&(!result[l.exId]||score(l)>score(result[l.exId])))result[l.exId]=l;});
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
  function title(){
    const athleteName = profile().username ? esc(profile().username.split(' ')[0]) : 'Rival';
    return `<header class="topbar">
      <div class="brand" data-action="logo-showcase" role="button" tabindex="0" title="RepRival · Train. Compete. Improve.">
        <span class="rr-g-brand-mark" aria-hidden="true">//</span><span class="rr-g-brand-word">RepRival</span>
      </div>
      <div class="topbar-user" data-page="account" role="button" tabindex="0" title="Account settings">
        <span class="user-avatar">${athleteName.charAt(0).toUpperCase()}</span>
        <span class="user-chip">${athleteName}</span>
        <span class="user-caret" aria-hidden="true">›</span>
      </div>
    </header>`;
  }

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
    const links=[['home','Home'],['workout','Workout'],['progress','Progress'],['plan','My plan'],[profile().role==='admin'?'admin':'account',profile().role==='admin'?'Admin':'Account']];
    return `<nav class="tabnav" aria-label="Main navigation">${links.map(([id,label])=>`<button type="button" class="${(page===id||(id==='progress'&&page==='movement-trends')||(id==='workout'&&page==='workout-intro'))?'active':''}" data-page="${id}" aria-label="${label}"><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]}</svg></span>${label}</button>`).join('')}</nav>`;
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
      const logs=(s.logs||[]).filter(l=>l.exId===movement.id && !l.skipped);
      if(!logs.length)return null;
      const best=bestSet(logs);
      const volume = logs.reduce((a,l)=>a+setVolume(l),0);
      const maxWeight = Math.max(...logs.map(l=>l.weight||0));
      const bestReps = best.reps;
      return {
        date:s.endedAt||s.startedAt,
        sessionId:s.id,
        reps: bestReps, 
        totalReps: logs.reduce((a,l)=>a+l.reps,0),
        load: best.weight||0, 
        maxWeight,
        volume,
        performance:score(best),
        log:logs
      };
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
    const all=allLogs().filter(l => !l.skipped);
    const vol=all.reduce((a,l)=>a+setVolume(l),0);
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
  function todayReadiness(){return readinessLog().find(x=>x.day===todayLocal())||readinessLog().slice(-1)[0]||null;}
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
    const sorenessMap = r.sorenessMap || {};
    return `<div class="eyebrow">PERSONAL RECOVERY · ${todayLocal()}</div><h1 class="page-title">Daily readiness</h1><p class="lead">How you feel matters more than a fixed countdown. This is a guide, not a medical measurement.</p>${card(`<form id="readinessForm" class="stack rr154-checkin"><div class="field"><label for="fatigue">General fatigue</label><select name="fatigue" id="fatigue">${['Fresh','Good','Moderate','Tired','Exhausted'].map((label,i)=>`<option value="${i}" ${Number(r.fatigue??1)===i?'selected':''}>${i} · ${label}</option>`).join('')}</select></div><div class="field"><label for="soreness">General muscle soreness</label><select name="soreness" id="soreness">${['None','Mild','Moderate','Quite sore','Very sore'].map((label,i)=>`<option value="${i}" ${Number(r.soreness??1)===i?'selected':''}>${i} · ${label}</option>`).join('')}</select></div><div class="field"><label for="sleep">Sleep quality</label><select name="sleep" id="sleep"><option value="good" ${r.sleep==='good'?'selected':''}>Good</option><option value="okay" ${r.sleep==='okay'?'selected':''}>Okay</option><option value="poor" ${r.sleep==='poor'?'selected':''}>Poor</option></select></div><fieldset class="rr154-sore"><legend>Which areas are sore? <small>Optional — Select severity per area</small></legend><div class="rr154-sore-options" style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;">${SORE_GROUPS.map(g=>{
      const sev = sorenessMap[g] || ((r.groups||[]).includes(g) ? 'moderate' : 'none');
      return `<div style="background:#1b1c1d; border:1px solid #3c3a3b; padding:8px 10px; border-radius:8px; display:flex; flex-direction:column; gap:4px;"><span style="font-weight:700; font-size:12px; color:#e2d8d2;">${g}</span><select name="soreness_${g}" style="background:#252729; border:1px solid #4a4748; color:#fff; font-size:11px; padding:4px 6px; border-radius:6px;"><option value="none" ${sev==='none'?'selected':''}>Not sore</option><option value="mild" ${sev==='mild'?'selected':''}>Mild</option><option value="moderate" ${sev==='moderate'?'selected':''}>Moderate</option><option value="severe" ${sev==='severe'?'selected':''}>Severe</option></select></div>`;
    }).join('')}</div></fieldset><button class="btn primary full" type="submit">Save today's check-in →</button><button class="btn outline full" type="button" data-page="home">Return to Home</button></form>`,'section')}${prior.length?card(`<h3>Recent check-ins</h3>${prior.map(x=>`<div class="rr154-checkin-history"><strong>${esc(x.day)}</strong><span>Fatigue ${x.fatigue} · Soreness ${x.soreness} · ${esc(x.sleep)} sleep</span></div>`).join('')}`,'section'):''}<p class="fineprint">Check-ins are private to this device/profile. You can always train; guidance never blocks a workout.</p>`;
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
    function homeStrengthTrendSection(trends, period, chosenTrend){
    const buttons = PROGRESS_PERIODS.map(([id,label])=>`<button type="button" data-action="movement-trend-period" data-period="${id}" aria-pressed="${period===id}" class="${period===id?'active':''}">${esc(label)}</button>`).join('');

    let totalPct = 0, countWithPct = 0;
    (trends.selected || []).forEach(m => {
      const series = periodTrendSeries(m, period);
      const first = series[0], last = series.at(-1);
      if(first && last && series.length >= 2 && first.performance > 0){
        totalPct += ((last.performance / first.performance) - 1) * 100;
        countWithPct++;
      }
    });
    const avgPct = countWithPct > 0 ? (totalPct / countWithPct) : null;
    const isPositive = avgPct != null && avgPct >= 0;

    return `
      <section class="card section rr164-trends rr-home-trends-card" aria-label="Strength Trend">
        <div class="rr163-section-heading">
          <div>
            <div class="eyebrow">PROGRESSIVE OVERLOAD METRIC</div>
            <h2>Strength Trend</h2>
            <p>Live progress from your recorded working sets. Tapping an exercise spotlights its trajectory.</p>
          </div>
          <div class="rr164-periods" role="group" aria-label="Movement chart history period">${buttons}</div>
        </div>

        <div class="rr-strength-metric-banner">
          <div class="rr-strength-big-metric">
            <span class="rr-strength-metric-badge ${isPositive ? 'positive' : ''}">
              ${avgPct != null ? `${isPositive ? '↑ +' : '↓ '}${avgPct.toFixed(1)}%` : '—'}
            </span>
            <div class="rr-strength-metric-caption">
              <strong>${avgPct != null ? 'Average Strength Gain' : 'Establishing Overload Baseline'}</strong>
              <small>${trends.selected.length} compound movements tracked in this period</small>
            </div>
          </div>
          <button class="btn outline sm" data-action="progress-tab" data-tab="movements" type="button">Manage all →</button>
        </div>

        ${trends.selected.length ? `
          ${movementTrendTiles(trends, period, chosenTrend)}
          ${chosenTrend ? movementSpotlight(chosenTrend, period, trends.pinned.has(chosenTrend.id)) : ''}
        ` : `
          <div class="rr164-empty">No workouts in the last 7 days. Complete a workout to begin plotting progressive overload trends.</div>
        `}
      </section>
    `;
  }

  // Stage 1: a dedicated Graphite Home visual; scores and original atlas remain intact.
  const GRAPHITE_STIMULUS_STOPS=[[0,"#536777"],[20,"#657582"],[45,"#777680"],[70,"#a4767b"],[100,"#bc7479"]];
  function graphiteHeatColour(score) {
    const x=Math.min(100,Math.max(0,Number(score)||0));
    let i=0;
    while(i<GRAPHITE_STIMULUS_STOPS.length-2&&x>GRAPHITE_STIMULUS_STOPS[i+1][0])i++;
    const [p1,h1]=GRAPHITE_STIMULUS_STOPS[i], [p2,h2]=GRAPHITE_STIMULUS_STOPS[i+1];
    const a=[1,3,5].map(j=>parseInt(h1.slice(j,j+2),16)),b=[1,3,5].map(j=>parseInt(h2.slice(j,j+2),16));
    const t=(x-p1)/(p2-p1||1);
    return '#'+a.map((v,k)=>Math.round(v+(b[k]-v)*t).toString(16).padStart(2,'0')).join('');
  }
  
  function graphiteAtlasPalette(metric,defaultColor) {
    if (!metric || defaultColor?.alpha===0) return defaultColor;
    const days=Number(metric.daysSince);
    if(metric.isDetraining&&Number.isFinite(days)&&days>=21)
      return {fill:days>=28?'#6589a2':'#7d9eaf',alpha:days>=28?.55:.43};
    const stimulus=Math.min(100,Math.max(0,Number(metric.stimulusScore)||0));
    return {fill:graphiteHeatColour(stimulus),alpha:Math.min(.74,Math.max(.10,.17+stimulus*.0055))};
  }
  
  function graphiteMuscleIcon(name,color){
    const key=String(name).toLowerCase();
    // A consistent outline anatomical figure with the selected muscle group tinted.
    const base=`<circle cx="25" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.3"/>
      <path d="M19 15C16 14 12 17 11 21L7 34Q6 37 8 38Q11 39 12 35L16 24L17 40L19 44L17 57Q16 60 19 61L23 61L25 44L27 61L31 61Q34 60 33 57L31 44L33 40L34 24L38 35Q39 39 42 38Q44 37 43 34L39 21Q37 16 31 15L25 17Z"
        fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>
      <path d="M25 17V43M17 29L25 31L33 29M17 40L25 44L33 40M25 44L22 58M25 44L28 58"
        fill="none" stroke="currentColor" stroke-width=".75" opacity=".65"/>`;
    const highlight={
      chest:`<path d="M17 20L24 19L24 29Q21 27 17 26ZM26 19L33 20L33 26Q29 27 26 29Z"/>`,
      back:`<path d="M18 18L24 21L24 34L18 29ZM26 21L32 18L32 29L26 34Z"/>`,
      shoulders:`<path d="M18 16Q13 16 12 21L15 25L19 20ZM32 16Q37 16 38 21L35 25L31 20Z"/>`,
      arms:`<path d="M11 24L9 32L12 34L16 24ZM39 24L41 32L38 34L34 24Z"/>`,
      quads:`<path d="M18 44L24 44L22 53L18 56ZM26 44L32 44L32 56L28 53Z"/>`,
      hamstrings:`<path d="M18 44L22 45L20 57L17 57ZM28 45L32 44L33 57L30 57Z"/>`,
      glutes:`<path d="M18 39Q21 40 24 43L24 47L18 48ZM26 43Q29 40 32 39L32 48L26 47Z"/>`,
      calves:`<path d="M18 52L22 52L20 60L17 59ZM28 52L32 52L33 59L30 60Z"/>`,
      core:`<path d="M20 28L24 29L24 38L20 39ZM26 29L30 28L30 39L26 38Z"/>`
    };
    const zones=highlight[key]||highlight.core;
    return `<svg class="rr-g-muscle-icon" viewBox="0 0 50 64" aria-hidden="true" focusable="false" style="--rr-g-zone:${color}">
      <g class="rr-g-icon-outline">${base}</g>
      <g class="rr-g-icon-target" fill="var(--rr-g-zone)" fill-opacity=".34" stroke="var(--rr-g-zone)" stroke-width=".95">${zones}</g>
      <path d="M19 15L25 17L31 15" fill="none" stroke="currentColor" stroke-width=".8"/>
    </svg>`;
  }
  function graphiteMuscleRow(m) {
    const s=Math.min(100,Math.max(0,Math.round(Number(m.stimulusScore)||0)));
    const r=m.readinessScore==null||!Number.isFinite(Number(m.readinessScore))?null:Math.max(0,Math.min(100,Math.round(Number(m.readinessScore))));
    const eff=Number(m.effectiveSets)||0;
    const target=Number(m.targetSets)||10;
    const sets=(Number.isInteger(eff)?String(eff):eff.toFixed(1).replace(/\.0$/,''))+'/'+target+' sets';
    const status=esc(m.readinessState||'Insufficient data'),pct=r==null?'—':r+'%';
    const color=graphiteHeatColour(s);
    return `<div class="rr-g-muscle-row" aria-label="${esc(m.name)}: stimulus ${s} percent, readiness ${esc(pct)}, ${esc(sets)}">
      <div class="rr-g-muscle-identity"><div class="rr-g-muscle-title"><strong>${esc(m.name)}</strong><small>${esc(sets)}</small></div></div>
      <div class="rr-g-muscle-dose">
        <div class="rr-g-metric-head"><span>STIMULUS</span><strong style="color:${color}">${s}%</strong></div>
        <div class="rr-g-track" role="progressbar" aria-label="${esc(m.name)} stimulus" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s}"><i style="width:${s}%;background:${color}"></i></div>
      </div>
      <div class="rr-g-muscle-ready"><span>READINESS</span><strong>${esc(pct)}</strong><small>${status}</small></div>
    </div>`;
  }
  
  function graphiteHomeHeatmap() {
    const data=heatData(7);
    const groups=window.RepRivalIntelligence?.calculateGroupMetrics?.(data)||[];
    const ready=groups.filter(m=>m.readinessState==='Ready'||m.readinessState==='Mostly ready').length;
    const front=window.RepRivalBodyMap.figure('front',data,graphiteAtlasPalette);
    const back=window.RepRivalBodyMap.figure('back',data,graphiteAtlasPalette);
    return `<section class="rr-g-home-heat" aria-labelledby="rr-g-title">
      <div class="rr-g-head">
        <div class="rr-g-kicker">STIMULUS / RECOVERY / READINESS</div>
        <div class="rr-g-headline">
          <h1 id="rr-g-title">Muscle Heat Zones</h1>
          <div class="rr-g-ready-summary"><strong>${ready}/${groups.length}</strong><small>READY</small></div>
        </div>
        <p>Training stimulus and recovery at a glance.</p>
      </div>
      <div class="rr-g-body-pair" aria-label="Front and back interactive anatomical muscle maps">
        <div class="rr-g-body-view"><div class="rr-g-body-svg">${front}</div><span>FRONT</span></div>
        <div class="rr-g-body-view"><div class="rr-g-body-svg">${back}</div><span>BACK</span></div>
      </div>
      <p class="rr-g-body-hint">Tap a muscle to view its recent training.</p>
      <div class="rr-g-scores-head"><h2>Muscle groups</h2><span>${ready} / ${groups.length} groups ready</span></div>
      <div class="rr-g-muscle-list">${groups.map(graphiteMuscleRow).join('')}</div>
      <div class="rr-g-legend" aria-label="Muscle heat colours">
        <div class="rr-g-gradient" aria-hidden="true"></div>
        <div class="rr-g-legend-ends"><span>COOL · LOWER STIMULUS</span><span>WARM · HIGHER STIMULUS</span></div>
        <p>Blue on the body indicates prolonged detraining; other cool or neutral tones indicate lower recent stimulus. Readiness is a separate recovery estimate, not the heat colour.</p>
      </div>
    </section>`;
  }

  function home(){
    const current=state.active;
    const session=current?.session||state.next;
    const currentPlan=planFor(session);
    const planMeta=window.REPRIVAL_PLAN_LIBRARY.details[selectedPlan]||{};
    const planName=selectedPlan===ADAPT_ID?'Adaptive Training':planMeta.title||'Current Training Plan';
    const nextName=currentPlan.name||'Workout '+session;
    const pairs=currentPlan.pairs||[];
    const sets=pairs.flatMap(p=>p.exercises||[]).reduce((s,e)=>s+Number(e.sets||0),0);
    const minutes=adaptivePlan()?Math.round(5+sets*1.32+pairs.length*2.15+pairs.flatMap(p=>p.exercises||[]).length*.65)
      :Math.max(20,Math.ceil((sets*1.6+pairs.length*1.5)/5)*5);
    const done=state.history.length;
    const count=state.history.reduce((n,w)=>n+(w.prs||[]).length,0);
    const consistencyStats=consistency();
    const firstName=(profile().username||'Rival').split(/\s+/)[0];
    const hour=new Date().getHours();
    const greeting=hour<12&&hour>=5?'Good morning':hour<18&&hour>=12?'Good afternoon':'Good evening';
    const tasks=current?buildTasks(current.session):[];
    const complete=Boolean(current&&current.logs.filter(Boolean).length>=tasks.length);
    const workoutStatus=current?(complete?'Review completed workout':'Resume your workout'):'Next workout';
    const link=current?'workout':'workout-intro';
    const planCycle=Math.floor(done/Math.max(1,SESSION_ORDER.length))+1;
    const currentStrength=calculateStrengthGainPct();
    const signedIn=Boolean(window.RepRivalCloud?.getCurrentUser?.());
    return `<section class="rr-g-home-overview" aria-label="Your training overview">
        <div class="rr-g-welcome">
          <div>
            <span class="rr-g-section-eyebrow">YOUR TRAINING</span>
            <h2>${greeting}, ${esc(firstName)}.</h2>
          </div>
          <button class="rr-g-checkin" type="button" data-action="readiness">${todayReadiness()?'✓ Check-in saved':'＋ Check in'}</button>
        </div>
        <div class="rr-g-mini-metrics" aria-label="Your training statistics">
          <div data-nav="plan" role="button" tabindex="0" title="View completed workouts"><strong>${done}</strong><span>WORKOUTS</span></div>
          <div data-action="progress-tab" data-tab="movements" role="button" tabindex="0" title="View strength history"><strong>${esc(String(currentStrength))}%</strong><span>STRENGTH</span></div>
          <div data-action="progress-tab" data-tab="records" role="button" tabindex="0" title="View your records"><strong>${count}</strong><span>RECORDS</span></div>
        </div>
        <div class="rr-g-next-workout" aria-label="${esc(workoutStatus)}">
          <div class="rr-g-next-copy" data-page="${link}" role="button" tabindex="0">
            <span class="rr-g-section-eyebrow">${esc(workoutStatus)}</span>
            <h3>${esc(nextName)}${complete?' ✓':''}</h3>
            <p>${current?`${current.logs.filter(l=>l&&!l.skipped).length} of ${tasks.length} sets logged`:`${pairs.length} blocks · ${sets} sets · ~${minutes} min`}</p>
          </div>
          <button type="button" class="rr-g-start" data-page="${link}" aria-label="${current?'Resume':'Start'} ${esc(nextName)}">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>
          </button>
        </div>
        <div class="rr-g-plan-foot">
          <div data-nav="plan" role="button" tabindex="0"><strong>${esc(planName)}</strong><span>${adaptivePlan()?'Adaptive active':`Cycle ${planCycle}`} · ${Math.round(consistencyStats.percentage||0)}% consistency</span></div>
          <button type="button" class="rr-g-plan-link" data-nav="plan">View plan ›</button>
        </div>
        <div class="rr-g-home-actions">
          <button type="button" data-action="open-generator">Quick workout</button>
          <button type="button" data-action="open-holiday-modal">${state.holiday?.active?'Holiday settings':'Holiday mode'}</button>
        </div>
      </section>
      ${state.holiday?.active?'<p class="rr-g-holiday-active">Holiday mode is active. Your regular workout rotation is paused.</p>':''}
      ${graphiteHomeHeatmap()}
      ${signedIn?'':cloudBanner()}`;
  }

  function currentSessionPairs(){
    if(state.active && state.active.pairs) return state.active.pairs;
    if(state.activeCustomPairs) return state.activeCustomPairs;
    const day = state.active?.session || state.next;
    const session = planFor(day);
    return structuredClone(session.pairs || []);
  }
  function updateCurrentSessionPairs(pairs){
    if(state.active){
      state.active.pairs = pairs;
    } else {
      state.activeCustomPairs = pairs;
    }
    save();
  }
  function suggestAlternativeExercises(ex){
    const lib = window.REPRIVAL_EXERCISE_LIBRARY;
    if(!lib) return [];
    const owned = profile().equipment || [];
    const muscle = ex?.muscle;
    const isRearDelt = muscle === 'Rear delts' || (ex?.name || '').toLowerCase().includes('rear');
    const searchTerms = (ex?.name || '').toLowerCase().split(/[\s•·-]+/);
    return lib.entries.map(candidate => {
      if(candidate.id === ex?.id) return null;
      let score = 0;
      if(isRearDelt){
        if(candidate.muscle === 'Rear delts') score += 20;
        if(candidate.name.toLowerCase().includes('rear') || candidate.name.toLowerCase().includes('face pull')) score += 15;
        if(candidate.name.toLowerCase().includes('pull-apart') || candidate.name.toLowerCase().includes('reverse')) score += 10;
        if(candidate.name.toLowerCase().includes('lat pulldown') || candidate.name.toLowerCase().includes('inverted row')) score -= 10;
      } else {
        if(candidate.muscle === muscle) score += 8;
        const cName = candidate.name.toLowerCase();
        searchTerms.forEach(term => {
          if(term.length > 2 && cName.includes(term)) score += 3;
        });
      }
      const compatible = lib.compatible(candidate, owned);
      if(compatible) score += 5;
      return { candidate, score, compatible };
    }).filter(x => x && x.score > 0).sort((a,b) => b.score - a.score || (b.compatible?1:0) - (a.compatible?1:0)).slice(0, 8).map(x => x.candidate);
  }
  function closeAllModals(){
    document.querySelectorAll('.rr-custom-dialog, .modal, dialog').forEach(d => {
      if(typeof d.close === 'function') try{ d.close(); }catch(e){}
      d.remove();
    });
  }
  function openModal(html){
    closeAllModals();
    const dlg = document.createElement('dialog');
    dlg.className = 'rr-custom-dialog';
    dlg.innerHTML = html;
    dlg.style.cssText = 'background:#121518; color:#f5ede6; border:1px solid #222831; border-radius:14px; padding:20px; max-width:440px; width:90%; box-shadow:0 12px 40px rgba(0,0,0,0.8);';
    dlg.addEventListener('close', () => dlg.remove(), {once: true});
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
    if(typeof dlg.showModal === 'function'){
      dlg.showModal();
    } else {
      dlg.setAttribute('open', '');
    }
  }
  function makeSessionPairsPermanent(sessionId, updatedPairs){
    const athlete = profile();
    if(!athlete.plans) athlete.plans = {};
    if(!athlete.plans[selectedPlan]){
      athlete.plans[selectedPlan] = structuredClone(window.REPQUEST_PROGRAM || PLAN);
    }
    if(athlete.plans[selectedPlan][sessionId]){
      athlete.plans[selectedPlan][sessionId].pairs = structuredClone(updatedPairs);
    }
    state.settings.planVersion = (state.settings.planVersion || 0) + 1;
    save();
  }

  function openSwapModal(pairIdx, exIdx){
    const pairs = currentSessionPairs();
    const currentEx = pairs[pairIdx]?.exercises[exIdx];
    if(!currentEx) return;
    const suggestions = suggestAlternativeExercises(currentEx);
    const lib = window.REPRIVAL_EXERCISE_LIBRARY;
    const allEx = lib.entries;
    openModal(`
      <div class="modal-header">
        <h2>Swap / Replace Movement</h2>
        <p class="subhead">Replacing <strong>${esc(currentEx.name)}</strong>.</p>
      </div>
      <div class="modal-body mt16">
        <div class="permanent-option-box" style="margin:8px 0 16px 0; padding:12px; background:rgba(217,114,65,0.08); border:1px solid rgba(217,114,65,0.25); border-radius:10px;">
          <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
            <input type="checkbox" id="swapPermanentCheck" style="margin-top:3px; width:18px; height:18px; accent-color:#d97241; cursor:pointer;">
            <span style="font-size:13px; color:#f5ede6; line-height:1.4;">
              <strong>Make permanent change to my routine / plan</strong>
              <span style="display:block; font-size:11px; color:#94a3b8; font-weight:normal; margin-top:2px;">
                Unchecked: applies to today's workout only. Checked: updates your default master routine for future sessions.
              </span>
            </span>
          </label>
        </div>
        <h3 class="eyebrow">Smart Suggestions (Similar / Equipment-friendly)</h3>
        <div class="swap-suggestions-list mt8">
          ${suggestions.length ? suggestions.map(s => `
            <div class="swap-option-card" data-action="confirm-swap" data-pair="${pairIdx}" data-ex="${exIdx}" data-id="${s.id}">
              <div>
                <strong>${esc(s.name)}</strong>
                <small>${esc(s.muscle)} · ${s.min}–${s.max} reps · ${isDumbbellExercise(s) ? 'kg per DB' : (s.load === 'bodyweight' ? 'bodyweight' : 'kg')}</small>
              </div>
              <button class="btn text" type="button">Select →</button>
            </div>
          `).join('') : '<p class="muted">No direct suggestions found.</p>'}
        </div>
        <h3 class="eyebrow mt16">Browse All Exercises</h3>
        <div class="form-group mt8">
          <input type="text" id="swapSearch" placeholder="Search exercises by name or muscle..." class="input">
        </div>
        <div class="swap-all-list mt8" id="swapAllList" style="max-height:220px; overflow-y:auto;">
          ${allEx.map(s => `
            <div class="swap-option-card compact" data-action="confirm-swap" data-pair="${pairIdx}" data-ex="${exIdx}" data-id="${s.id}">
              <div>
                <strong>${esc(s.name)}</strong>
                <small>${esc(s.muscle)} · ${isDumbbellExercise(s) ? 'per DB' : (s.load === 'bodyweight' ? 'BW' : s.load)}</small>
              </div>
              <button class="btn text" type="button">Use</button>
            </div>
          `).join('')}
        </div>
      </div>
    `);
    const swapChk = document.querySelector('#swapPermanentCheck');
    if(swapChk) swapChk.checked = false;
    setTimeout(() => {
      const searchInput = document.querySelector('#swapSearch');
      if(searchInput){
        searchInput.addEventListener('input', e => {
          const q = e.target.value.toLowerCase();
          document.querySelectorAll('#swapAllList .swap-option-card').forEach(card => {
            card.style.display = card.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
          });
        });
      }
    }, 50);
  }

  function openDropModal(pairIdx, exIdx){
    const pairs = currentSessionPairs();
    const currentEx = pairs[pairIdx]?.exercises[exIdx];
    if(!currentEx) return;
    const completedCount = (state.active?.logs || []).filter(l => l && (l.exId === currentEx.id || l.name === currentEx.name)).length;
    if(pairs.length <= 1 && pairs[0].exercises.length <= 1 && completedCount === 0){
      showToast('Cannot drop the only exercise in the workout. You can discard or swap it instead.');
      return;
    }
    const isPartial = completedCount > 0;
    openModal(`
      <div class="modal-header">
        <h2>${isPartial ? 'Drop Remaining Sets' : 'Drop Movement'}</h2>
        <p class="subhead">${isPartial ? `${completedCount} set${completedCount>1?'s':''} already logged for <strong>${esc(currentEx.name)}</strong>. Dropping will keep those completed sets and cancel the remaining planned sets for today.` : `Remove <strong>${esc(currentEx.name)}</strong> from this workout?`}</p>
      </div>
      <div class="modal-body mt16">
        <div class="permanent-option-box" style="margin:8px 0 16px 0; padding:12px; background:rgba(217,114,65,0.08); border:1px solid rgba(217,114,65,0.25); border-radius:10px;">
          <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
            <input type="checkbox" id="dropPermanentCheck" style="margin-top:3px; width:18px; height:18px; accent-color:#d97241; cursor:pointer;">
            <span style="font-size:13px; color:#f5ede6; line-height:1.4;">
              <strong>Make permanent change to my routine / plan</strong>
              <span style="display:block; font-size:11px; color:#94a3b8; font-weight:normal; margin-top:2px;">
                Unchecked: drops for today only. Checked: permanently removes from your master routine.
              </span>
            </span>
          </label>
        </div>
        <div class="row mt16" style="gap:10px; justify-content:flex-end;">
          <button type="button" class="btn outline" data-action="close-modal">Cancel</button>
          <button type="button" class="btn primary text-danger" data-action="confirm-drop" data-pair="${pairIdx}" data-ex="${exIdx}">${isPartial ? 'Drop Remaining Sets' : 'Drop Exercise'}</button>
        </div>
      </div>
    `);
    const dropChk = document.querySelector('#dropPermanentCheck');
    if(dropChk) dropChk.checked = false;
  }

  function openRoadmapEditModal(){
    const pairs = structuredClone(currentSessionPairs());
    const a = state.active;
    const tasks = buildTasks(a?.session || state.next, pairs);

    const blocksHtml = pairs.map((p, pi) => {
      const isSup = p.exercises.length > 1;
      return `
        <div class="roadmap-edit-block" style="background:#161a20; border:1px solid #2a313d; border-radius:12px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #222831; padding-bottom:6px;">
            <strong style="color:#d97241; font-size:12px; text-transform:uppercase; letter-spacing:0.8px;">
              ${isSup ? 'SUPERSET ' + (pi + 1) : 'BLOCK ' + (pi + 1)}
            </strong>
            <button type="button" class="btn text" data-action="add-exercise" data-pair="${pi}" style="font-size:11px; color:#cbd5e1; padding:2px 6px;">＋ Add movement</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px;">
            ${p.exercises.map((ex, ei) => {
              const exTasks = tasks.filter(tk => tk.pi === pi && tk.ei === ei);
              const exDone = (a?.logs || []).filter(l => l && !l.skipped && (l.exId === ex.id || l.name === ex.name)).length;
              const hasSkipped = (a?.logs || []).some((l, lidx) => l?.skipped && exTasks.some(tk => tk.index === lidx));

              return `
                <div class="roadmap-edit-ex-card" style="background:#0d1117; border:1px solid #222831; border-radius:8px; padding:10px;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                      <strong style="color:#fff; font-size:14px; display:block;">${esc(ex.name)}</strong>
                      <small style="color:#94a3b8; font-size:11px;">${esc(ex.muscle)} · ${exDone}/${ex.sets} sets logged</small>
                    </div>
                    <div style="display:flex; gap:4px;">
                      <button type="button" class="btn text btn-compact-action" data-action="swap-exercise" data-pair="${pi}" data-ex="${ei}" style="font-size:11px; padding:4px 8px; background:rgba(255,255,255,0.08); border-radius:4px; font-weight:700;">⇄ Swap</button>
                      ${hasSkipped ? `
                        <button type="button" class="btn text btn-compact-action text-warning" data-action="restore-exercise" data-pair="${pi}" data-ex="${ei}" style="font-size:11px; padding:4px 8px; background:rgba(245,158,11,0.15); color:#fbbf24; border-radius:4px; font-weight:700;">↺ Restore</button>
                      ` : `
                        <button type="button" class="btn text btn-compact-action text-danger" data-action="drop-exercise" data-pair="${pi}" data-ex="${ei}" style="font-size:11px; padding:4px 8px; background:rgba(239,68,68,0.12); color:#fca5a5; border-radius:4px; font-weight:700;">✕ Drop</button>
                      `}
                    </div>
                  </div>

                  <!-- Exercise Targets (Sets, Min Reps, Max Reps) -->
                  <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
                    <div>
                      <label style="font-size:9px; color:#aaa8a5; text-transform:uppercase; font-weight:700; display:block; margin-bottom:2px;">Sets</label>
                      <input type="number" name="edit-sets-${pi}-${ei}" min="1" max="10" value="${ex.sets}" class="input" style="height:34px; font-size:13px; text-align:center; padding:2px; background:#161a20; border:1px solid #3a3f47; color:#fff;">
                    </div>
                    <div>
                      <label style="font-size:9px; color:#aaa8a5; text-transform:uppercase; font-weight:700; display:block; margin-bottom:2px;">Min Reps</label>
                      <input type="number" name="edit-min-${pi}-${ei}" min="1" max="99" value="${ex.min}" class="input" style="height:34px; font-size:13px; text-align:center; padding:2px; background:#161a20; border:1px solid #3a3f47; color:#fff;">
                    </div>
                    <div>
                      <label style="font-size:9px; color:#aaa8a5; text-transform:uppercase; font-weight:700; display:block; margin-bottom:2px;">Max Reps</label>
                      <input type="number" name="edit-max-${pi}-${ei}" min="1" max="99" value="${ex.max}" class="input" style="height:34px; font-size:13px; text-align:center; padding:2px; background:#161a20; border:1px solid #3a3f47; color:#fff;">
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    const modalHtml = `
      <div class="roadmap-edit-modal-content">
        <div class="row" style="align-items:center; justify-content:space-between; margin-bottom:10px;">
          <div>
            <h2 style="font-size:18px; margin:0; font-weight:800; color:#fff;">✎ Edit Workout Routine</h2>
            <p class="subhead" style="margin:2px 0 0 0; font-size:12px; color:#94a3b8;">Modify sets, targets, swap, or drop exercises for today's session.</p>
          </div>
          <button type="button" class="btn text" data-action="close-modal" style="font-size:18px; padding:0 4px; color:#aaa8a5;">✕</button>
        </div>

        <form id="roadmapEditForm" style="display:flex; flex-direction:column; gap:4px; max-height:65vh; overflow-y:auto; padding-right:4px;">
          ${blocksHtml}
          
          <div style="display:flex; gap:8px; margin-top:12px; position:sticky; bottom:0; background:#161a20; padding-top:8px;">
            <button type="button" class="btn primary full" data-action="save-roadmap-edit" style="height:46px; font-weight:700; background:#d97241;">Save Changes</button>
            <button type="button" class="btn outline full" data-action="close-modal" style="height:46px; border-color:#3a424e;">Cancel</button>
          </div>
        </form>
      </div>
    `;

    openModal(modalHtml);
  }

  function openRestEditModal(){
    if(!state.active) return;
    const a = state.active;
    const tasks = buildTasks(a.session);
    const group = fullRound(tasks, a.taskIndex);
    const activeItems = group.items.filter(t => !a.logs[t.index]?.skipped);

    const modalHtml = `
      <div class="rest-edit-modal-content">
        <div class="row" style="align-items:center; justify-content:space-between; margin-bottom:10px;">
          <h2 style="font-size:18px; margin:0; font-weight:800; color:#fff;">✎ Edit Upcoming Targets</h2>
          <button type="button" class="btn text" data-action="close-modal" style="font-size:18px; padding:0 4px; color:#aaa8a5;">✕</button>
        </div>
        <p class="subhead" style="margin-bottom:14px; font-size:12px; color:#94a3b8;">Adjust targets or exercise choices for your upcoming round. The rest timer continues running.</p>

        <form id="restEditForm" style="display:flex; flex-direction:column; gap:12px;">
          ${activeItems.map((t, i) => {
            const ex = t.ex, idx = t.index;
            const res = resolveSetValues(t, a);
            const perDb = isDumbbellExercise(ex);
            const isSingle = isSingleDumbbell(ex);
            const availableLoads = getAvailableLoadsForExercise(ex);
            const minAvailable = availableLoads[0] ?? 0;
            const maxAvailable = availableLoads[availableLoads.length - 1] ?? (perDb ? (isSingle ? 27.5 : 55) : 100);
            const isAtMax = Number(res.weight) >= maxAvailable && ex.load !== 'bodyweight';
            const isAtMin = Number(res.weight) <= minAvailable;
            const differs = (ex.load !== 'bodyweight' && res.rec.weight !== '' && Number(res.rec.weight) !== Number(res.weight)) || (Number(res.rec.reps) !== Number(res.reps));

            return `
              <div style="background:#161a20; border:1px solid #2a313d; border-radius:10px; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <strong style="color:#fff; font-size:15px;">${esc(ex.name)}</strong>
                  <div style="display:flex; gap:4px;">
                    <button type="button" class="btn text btn-compact-action" data-action="swap-exercise" data-pair="${t.pi}" data-ex="${t.ei}" style="font-size:10px; padding:2px 6px; background:rgba(255,255,255,0.08); border-radius:4px;">⇄ Swap</button>
                    <button type="button" class="btn text btn-compact-action text-danger" data-action="drop-exercise" data-pair="${t.pi}" data-ex="${t.ei}" style="font-size:10px; padding:2px 6px; background:rgba(239,68,68,0.12); color:#fca5a5; border-radius:4px;">✕ Drop</button>
                  </div>
                </div>
                <div style="font-size:11px; color:#aaa8a5; margin-bottom:8px;">Set ${t.round}/${ex.sets} · ${esc(ex.muscle)}</div>

                <!-- Overload Banner -->
                <div style="background:rgba(217,114,65,0.1); border-radius:6px; padding:6px 8px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
                  <div style="font-size:11px; color:#cbd5e1; flex:1;">
                    <span style="font-weight:700; color:#ff9f66;">⚡ REC:</span> ${esc(res.rec.reason)} (${res.rec.weight!==''?(ex.load==='bodyweight'?'BW':formatWeightConvention(res.rec.weight, ex)):''} × ${res.rec.reps})
                  </div>
                  ${differs ? `
                    <button type="button" class="btn sm primary" data-action="apply-overload-rest" data-index="${idx}" data-weight="${res.rec.weight}" data-reps="${res.rec.reps}" style="font-size:10px; padding:2px 8px; background:#d97241; flex-shrink:0;">Apply</button>
                  ` : ''}
                </div>

                <!-- Steppers -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                  <div>
                    <label style="font-size:9px; text-transform:uppercase; color:#aaa8a5; font-weight:800; display:block; margin-bottom:4px;">Weight</label>
                    <div style="display:flex; align-items:center; gap:4px;">
                      <button type="button" class="btn primary btn-step" data-action="step-weight-modal" data-index="${idx}" data-dir="-1" ${isAtMin ? 'disabled style="width:36px; height:40px; padding:0; font-size:18px; opacity:0.4; pointer-events:none;"' : 'style="width:36px; height:40px; padding:0; font-size:18px;"'}>−</button>
                      <input name="modal-weight-${idx}" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(res.weight)}" ${ex.load==='bodyweight'?'disabled':''} class="input" style="flex:1; text-align:center; height:40px; font-size:16px; font-weight:800; background:#0d1117; border:1px solid #3a3f47; color:#fff;">
                      <button type="button" class="btn primary btn-step" data-action="step-weight-modal" data-index="${idx}" data-dir="1" ${isAtMax ? 'disabled style="width:36px; height:40px; padding:0; font-size:18px; opacity:0.4; pointer-events:none;"' : 'style="width:36px; height:40px; padding:0; font-size:18px;"'}>+</button>
                    </div>
                    <div data-modal-weight-convention="${idx}" style="font-size:10px; color:#cbd5e1; margin-top:3px; text-align:center;">${formatWeightConvention(res.weight, ex)}</div>
                  </div>
                  <div>
                    <label style="font-size:9px; text-transform:uppercase; color:#aaa8a5; font-weight:800; display:block; margin-bottom:4px;">Reps</label>
                    <div style="display:flex; align-items:center; gap:4px;">
                      <button type="button" class="btn primary btn-step" data-action="step-reps-modal" data-index="${idx}" data-dir="-1" style="width:36px; height:40px; padding:0; font-size:18px;">−</button>
                      <input name="modal-reps-${idx}" type="number" inputmode="numeric" min="1" max="99" value="${esc(res.reps)}" class="input" style="flex:1; text-align:center; height:40px; font-size:16px; font-weight:800; background:#0d1117; border:1px solid #3a3f47; color:#fff;">
                      <button type="button" class="btn primary btn-step" data-action="step-reps-modal" data-index="${idx}" data-dir="1" style="width:36px; height:40px; padding:0; font-size:18px;">+</button>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}

          <div style="display:flex; gap:8px; margin-top:8px;">
            <button type="button" class="btn primary full" data-action="save-rest-edit" style="height:46px; font-weight:700; background:#d97241;">Save Changes</button>
            <button type="button" class="btn outline full" data-action="close-modal" style="height:46px; border-color:#3a424e;">Cancel</button>
          </div>
        </form>
      </div>
    `;

    openModal(modalHtml);
  }

  function openActiveExerciseEditModal(pairIdx, exIdx, taskIndex){
    const pairs = currentSessionPairs();
    const p = pairs[pairIdx];
    const ex = p?.exercises[exIdx];
    if(!ex) return;
    const a = state.active;
    const tasks = buildTasks(a?.session || state.next);
    const exTasks = tasks.filter(tk => tk.pi === pairIdx && tk.ei === exIdx);
    const hasSkipped = a && exTasks.some(tk => a.logs[tk.index]?.skipped);

    const modalHtml = `
      <div class="active-exercise-edit-modal-content">
        <div class="row" style="align-items:center; justify-content:space-between; margin-bottom:8px;">
          <h2 style="font-size:18px; margin:0; font-weight:800; color:#fff;">${esc(ex.name)}</h2>
          <button type="button" class="btn text" data-action="close-modal" style="font-size:18px; padding:0 4px; color:#aaa8a5;">✕</button>
        </div>
        <p class="subhead" style="margin-bottom:16px; font-size:12px; color:#94a3b8;">${esc(ex.muscle)} · ${ex.min}–${ex.max} reps</p>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <button type="button" class="btn outline full" data-action="swap-exercise" data-pair="${pairIdx}" data-ex="${exIdx}" style="height:44px; justify-content:flex-start; padding-left:14px; font-size:14px; font-weight:700;">
            ⇄ Swap Exercise
          </button>
          <button type="button" class="btn outline full text-danger" data-action="drop-exercise" data-pair="${pairIdx}" data-ex="${exIdx}" style="height:44px; justify-content:flex-start; padding-left:14px; font-size:14px; font-weight:700; border-color:rgba(239,68,68,0.3); color:#fca5a5;">
            ✕ Drop Exercise / Sets
          </button>
          ${hasSkipped ? `
            <button type="button" class="btn outline full text-warning" data-action="restore-exercise" data-pair="${pairIdx}" data-ex="${exIdx}" style="height:44px; justify-content:flex-start; padding-left:14px; font-size:14px; font-weight:700; border-color:rgba(245,158,11,0.3); color:#fbbf24;">
              ↺ Restore Dropped Sets
            </button>
          ` : ''}
          ${isDumbbellExercise(ex) ? `
            <button type="button" class="btn outline full" data-action="equipment" style="height:44px; justify-content:flex-start; padding-left:14px; font-size:14px; font-weight:700; color:#cbd5e1;">
              ⚙ Dumbbell Inventory
            </button>
          ` : ''}
          <button type="button" class="btn text full" data-action="close-modal" style="margin-top:6px; color:#aaa8a5;">
            Cancel
          </button>
        </div>
      </div>
    `;

    openModal(modalHtml);
  }
  function openAddModal(pairIdx){
    const lib = window.REPRIVAL_EXERCISE_LIBRARY;
    const allEx = lib.entries;
    const targetBlockName = (pairIdx != null && Number.isInteger(pairIdx)) ? `Block ${pairIdx + 1}` : 'New Block';
    openModal(`
      <div class="modal-header">
        <h2>Add Exercise to Workout</h2>
        <p class="subhead">Adding an exercise to <strong>${targetBlockName}</strong>.</p>
      </div>
      <div class="modal-body mt16">
        <div class="permanent-option-box" style="margin:8px 0 16px 0; padding:12px; background:rgba(217,114,65,0.08); border:1px solid rgba(217,114,65,0.25); border-radius:10px;">
          <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
            <input type="checkbox" id="addPermanentCheck" style="margin-top:3px; width:18px; height:18px; accent-color:#d97241; cursor:pointer;">
            <span style="font-size:13px; color:#f5ede6; line-height:1.4;">
              <strong>Make permanent change to my routine / plan</strong>
              <span style="display:block; font-size:11px; color:#94a3b8; font-weight:normal; margin-top:2px;">
                Unchecked: adds for today's session only. Checked: permanently adds to future workouts in this plan.
              </span>
            </span>
          </label>
        </div>
        <div class="form-group">
          <input type="text" id="addSearch" placeholder="Search exercise library..." class="input">
        </div>
        <div class="swap-all-list mt8" id="addAllList" style="max-height:260px; overflow-y:auto;">
          ${allEx.map(s => `
            <div class="swap-option-card compact" data-action="confirm-add" data-pair="${pairIdx ?? ''}" data-id="${s.id}">
              <div>
                <strong>${esc(s.name)}</strong>
                <small>${esc(s.muscle)} · ${s.min}–${s.max} reps · ${isDumbbellExercise(s) ? 'kg per DB' : (s.load === 'bodyweight' ? 'BW' : s.load)}</small>
              </div>
              <button class="btn text" type="button">Add</button>
            </div>
          `).join('')}
        </div>
      </div>
    `);
    const addChk = document.querySelector('#addPermanentCheck');
    if(addChk) addChk.checked = false;
    setTimeout(() => {
      const searchInput = document.querySelector('#addSearch');
      if(searchInput){
        searchInput.addEventListener('input', e => {
          const q = e.target.value.toLowerCase();
          document.querySelectorAll('#addAllList .swap-option-card').forEach(card => {
            card.style.display = card.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
          });
        });
      }
    }, 50);
  }
  function workoutLanding(){
    const a=state.active,day=a?.session||state.next,pairs=currentSessionPairs();
    const session=planFor(day);
    const exercises=pairs.flatMap(p=>p.exercises),sets=exercises.reduce((n,e)=>n+e.sets,0);
    const estimate=adaptivePlan()?Math.round(5+sets*1.32+pairs.length*2.15+exercises.length*.65):Math.max(20,Math.ceil((sets*1.6+pairs.length*1.5)/5)*5);
    const completed=a?.logs?.filter(l => l && !l.skipped).length||0;
    const skipped=a?.logs?.filter(l => l && l.skipped).length||0;
    const totalTasks=buildTasks(day).length;
    const allDone=a && ((completed + skipped) >= totalTasks || a.stage === 'feedback') && totalTasks > 0;
    const groups=pairs.map((p,i)=>`<div class="preworkout-block"><div class="preworkout-block-header"><span>${p.exercises.length>1?'SUPERSET':'BLOCK'} ${i+1}</span><span>${p.restMin}–${p.restMax}s rest</span></div>${p.exercises.length>1?`<div class="superset-rest-badge compact"><span>15–30s transition rest between movements · ${p.restMin}–${p.restMax}s full rest after superset round</span></div>`:''}${p.exercises.map((ex,ei)=>`<div class="preworkout-ex"><div><strong>${esc(ex.name)}</strong><small>${esc(ex.muscle)} · ${esc(ex.min)}–${esc(ex.max)} ${esc(ex.unit||'reps')} ${esc(ex.suffix||'')}</small></div><div class="preworkout-actions"><button type="button" class="quiet-link" data-action="swap-exercise" data-pair="${i}" data-ex="${ei}">⇄ Swap</button><button type="button" class="quiet-link text-danger" data-action="drop-exercise" data-pair="${i}" data-ex="${ei}">✕ Drop</button></div></div>`).join('')}<div class="mt8"><button type="button" class="btn text" data-action="add-exercise" data-pair="${i}">＋ Add exercise</button></div></div>`).join('');
    const hasCustom = state.activeCustomPairs || (state.active && state.active.pairs);
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
      ${allDone ? `
        <div class="completion-ready-card section" style="background:rgba(34,197,94,0.14); border:1px solid rgba(34,197,94,0.35); border-radius:12px; padding:18px; text-align:center;">
          <div style="font-size:24px; color:#4ade80;">✓</div>
          <h2 style="margin:6px 0; color:#4ade80; font-size:18px;">Workout Complete (${completed}/${totalTasks} sets${skipped ? `, ${skipped} skipped` : ''})</h2>
          <p class="subhead" style="margin-bottom:14px; color:#cbd5e1;">All working sets are resolved and recorded. Ready to save session!</p>
          <button class="btn primary full" type="button" data-action="feedback" style="background:#22c55e; border-color:#22c55e; font-weight:700;">Review &amp; Finish Workout →</button>
        </div>
      ` : `
        <div class="rr153-prep-start section"><button class="btn primary full" type="button" data-action="begin">${a?'Resume workout':'Begin workout'} <span aria-hidden="true">→</span></button><p>${a?`${completed} of ${totalTasks} sets completed${skipped ? ` (${skipped} skipped)` : ''}`:'Your workout timer starts when you begin'}</p></div>
      `}
      ${card(`<div class="row"><h3>Session selection</h3><span class="label-tag">${esc(day)}</span></div>
        ${a?`<div class="preworkout-active">${completed} of ${totalTasks} sets completed${skipped ? ` (${skipped} skipped)` : ''} · safe to resume</div>`:`<div class="session-choices">${SESSION_ORDER.map(id=>`<button type="button" class="${id===day?'chosen':''}" data-action="choose-session" data-id="${esc(id)}">${esc(id)} · ${esc(planFor(id).name||'Workout '+id)}</button>`).join('')}</div>`}`,'section')}
      ${card(`<div class="row"><h3>Session breakdown &amp; today's exercises</h3><span class="label-tag">${pairs.length} blocks</span></div><p class="subhead mb12">Need to drop or swap an exercise because you are away from home or lacking equipment? Edit today's routine below without altering your main plan.</p>${groups}${hasCustom?`<div class="mt16"><button type="button" class="btn outline full" data-action="reset-session-pairs">↺ Reset today's workout to default plan</button></div>`:''}`,'section')}
      <p class="rr153-prep-footer">Every working set counts. Your previous records appear when you begin.</p>`;
  }

  function startWorkout(){
    if(!state.active){
      const session = planFor(state.next);
      const pairs = state.activeCustomPairs || structuredClone(session.pairs);
      state.active={session:state.next,planId:selectedPlan,planVersion:state.settings.planVersion||0,taskIndex:0,logs:[],startedAt:new Date().toISOString(),stage:'lift',restUntil:null,restNote:'',restSeconds:0,pairs,accumulatedTime:0,lastStartTime:Date.now()};
      state.activeCustomPairs = null;
      save();
    } else if(!state.active.lastStartTime){
      state.active.lastStartTime = Date.now();
      save();
    }
    page='workout';render();
  }
  function previousMatchingSet(exId,round){
    for(const session of [...state.history].reverse()){
      const logs=(session.logs||[]).filter(x=>x.exId===exId && !x.skipped);
      if(logs.length)return logs.find(l=>l.round===round)||logs[Math.min(round-1,logs.length-1)];
    }return null;
  }
  function bestSetLast90Days(exId){
    const windowDays = 90;
    const windowMs = windowDays * 86400000;
    const now = Date.now();
    const entries = state.history
      .filter(s => now - Date.parse(s.endedAt || s.startedAt || '') < windowMs)
      .flatMap(s => (s.logs || []).filter(l => l.exId === exId && !l.skipped));
    
    if(!entries.length) return null;
    // Return the set with the highest strength score.
    return entries.reduce((best, curr) => score(curr) > score(best) + 1e-8 ? curr : best);
  }
  function isDumbbellExercise(ex){
    if(!ex) return false;
    if(ex.load === 'bodyweight') return false;
    if(ex.equipment && ex.equipment.includes('dumbbells')) return true;
    if(/(\bdb\b|dumbbell)/i.test(ex.name || '')) return true;
    const libEx = window.REPRIVAL_EXERCISE_LIBRARY?.byId?.[ex.id || ex.exId];
    if(libEx?.equipment?.includes('dumbbells')) return true;
    return false;
  }

  function isSingleDumbbell(ex){
    if(!ex) return false;
    if(ex.load === 'single') return true;
    const libEx = window.REPRIVAL_EXERCISE_LIBRARY?.byId?.[ex.id || ex.exId];
    if(libEx?.load === 'single') return true;
    const name = (ex.name || '').toLowerCase();
    if(name.includes('goblet') || name.includes('single db') || name.includes('single-arm') || name.includes('one-arm')) return true;
    return false;
  }

  function permitsBodyweight(ex){
    if(!ex) return false;
    if(ex.load === 'bodyweight' || ex.load === 'optional') return true;
    const id = (ex.id || ex.exId || '').toLowerCase();
    const name = (ex.name || '').toLowerCase();
    if(/lunge|squat|calf|bridge|sit.up|step.up/i.test(name) || /lunge|squat|calf|bridge|sit_up/i.test(id)) return true;
    return false;
  }

  function isKettlebellExercise(ex){
    if(!ex) return false;
    if(ex.load === 'bodyweight') return false;
    if(ex.equipment && ex.equipment.includes('kettlebells')) return true;
    if(/(\bkb\b|kettlebell)/i.test(ex.name || '')) return true;
    const libEx = window.REPRIVAL_EXERCISE_LIBRARY?.byId?.[ex.id || ex.exId];
    if(libEx?.equipment?.includes('kettlebells')) return true;
    return false;
  }

  const DEFAULT_DUMBBELL_INVENTORY = [5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5];

  function getAvailableDumbbellLoads(){
    const configured = profile()?.dumbbellInventory;
    if (Array.isArray(configured) && configured.length > 0) {
      const valid = configured.filter(w => Number.isFinite(w) && w > 0).sort((a,b) => a - b);
      if(valid.length) return valid;
    }
    return DEFAULT_DUMBBELL_INVENTORY;
  }

  function getAchievableDumbbellLoads(ex){
    const inv = getAvailableDumbbellLoads();
    const isSingle = isSingleDumbbell(ex);
    const allowBW = permitsBodyweight(ex);

    let loads = [];
    if(isSingle){
      // Single dumbbell: individual dumbbell weights
      loads = inv.filter(w => Number.isFinite(w) && w > 0);
    } else {
      // Two dumbbells: matching pair of dumbbells (2 * individual weight)
      loads = inv.filter(w => Number.isFinite(w) && w > 0).map(w => +(w * 2).toFixed(2));
    }

    // Include historical loads from athlete's history if valid and within equipment capacity
    if(state && Array.isArray(state.history)){
      const maxSingle = Math.max(...inv, 27.5);
      const maxTwo = Math.max(...inv.map(w => w * 2), 55);
      for(const s of state.history){
        for(const l of (s.logs || [])){
          if(l && !l.skipped && (l.exId === ex.id || l.name === ex.name)){
            const hw = Number(l.weight);
            if(hw > 0){
              if(isSingle && hw <= maxSingle) loads.push(hw);
              else if(!isSingle && hw <= maxTwo) loads.push(hw);
            }
          }
        }
      }
    }

    if(allowBW) loads.unshift(0);
    return [...new Set(loads)].filter(n => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  }

  function getAvailableLoadsForExercise(ex){
    if(!ex || ex.load === 'bodyweight') return [0];
    if(isDumbbellExercise(ex)){
      return getAchievableDumbbellLoads(ex);
    }
    if(isKettlebellExercise(ex)){
      const inv = (profile()?.kettlebellInventory && profile().kettlebellInventory.length) ? profile().kettlebellInventory : [16];
      const list = [...new Set(inv)].sort((a,b) => a - b);
      if(permitsBodyweight(ex)) list.unshift(0);
      return list;
    }
    // Barbell, cable, machine, etc.
    const step = 2.5;
    const list = permitsBodyweight(ex) ? [0] : [];
    for(let w = step; w <= 200; w += step) list.push(+w.toFixed(2));
    return list;
  }

  function findConservativeAvailableLoad(rawWeight, available){
    const w = Number(rawWeight);
    if(w === 0 && available.includes(0)) return 0;
    if(!w || w <= 0) return available[0] || 0;
    const exact = available.find(x => Math.abs(x - w) < 0.05);
    if(exact !== undefined) return exact;
    const lower = [...available].filter(x => x <= w);
    if(lower.length > 0) return lower[lower.length - 1];
    return available[0] || 0;
  }

  function stepLoad(currentWeight, direction, ex){
    const available = getAvailableLoadsForExercise(ex);
    const w = Number(currentWeight) || 0;
    if(direction > 0){
      const higher = available.find(x => x > w + 0.01);
      return higher !== undefined ? higher : w;
    } else {
      const lower = [...available].reverse().find(x => x < w - 0.01);
      return lower !== undefined ? Math.max(0, lower) : w;
    }
  }

  function formatWeightConvention(weight, ex){
    const w = Number(weight) || 0;
    if(ex?.load === 'bodyweight' || (w === 0 && permitsBodyweight(ex))){
      return '0 kg · Bodyweight';
    }
    if(isDumbbellExercise(ex)){
      const inv = getAvailableDumbbellLoads();
      if(isSingleDumbbell(ex)){
        const maxSingle = Math.max(...inv, 27.5);
        const isLimit = w >= maxSingle;
        return `${fmt(w)} kg (single DB)${isLimit ? ' · Equipment Limit' : ''}`;
      } else {
        const each = +(w / 2).toFixed(1);
        const total = +w.toFixed(1);
        const maxTwo = Math.max(...inv.map(x => x * 2), 55);
        const isLimit = total >= maxTwo;
        return `${fmt(each)} kg each · ${fmt(total)} kg total${isLimit ? ' · Equipment Limit' : ''}`;
      }
    }
    return `${fmt(w)} kg`;
  }

  function didAllSetsAchieveMax(ex, currentActiveExLogs){
    const targetSets = ex.sets || 3;
    let setsToCheck = [];
    if(currentActiveExLogs && currentActiveExLogs.length >= targetSets){
      setsToCheck = currentActiveExLogs.filter(l => !l.skipped).slice(0, targetSets);
    } else {
      for(const s of [...state.history].reverse()){
        const match = (s.logs || []).filter(l => l && !l.skipped && (l.exId === ex.id || l.name === ex.name));
        if(match.length >= targetSets){
          setsToCheck = match.slice(0, targetSets);
          break;
        }
      }
    }
    if(!setsToCheck.length || setsToCheck.length < targetSets) return false;
    return setsToCheck.every(l => Number(l.reps) >= ex.max && (l.rir == null || Number(l.rir) >= 1));
  }

  // RIR-aware performance trend is advisory; it never grants additional
  // hypertrophy stimulus or overrides the existing double-progression rules.
  function exercisePerformanceTrend(ex) {
    const intel = window.RepRivalIntelligence;
    if (!intel || typeof intel.calculateExerciseProgression !== 'function' || !ex?.id) return null;
    const comparisons = [];
    for (const session of (state.history || [])) {
      const logs = (session.logs || []).filter(l => l &&
        l.exId === ex.id && intel.validWorkingSet(l) &&
        l.rir != null && Number(l.rir) <= 5);
      if (!logs.length) continue;
      const estimatedCapacity = l => {
        const w = Number(l.weight) || 0;
        return w > 0 ? w * (1 + (Number(l.reps) + Number(l.rir)) / 30) : Number(l.reps) + Number(l.rir);
      };
      const best = logs.reduce((a, b) => estimatedCapacity(a) >= estimatedCapacity(b) ? a : b);
      comparisons.push({ ...best, loggedAt: session.endedAt || session.startedAt || best.loggedAt });
    }
    if (comparisons.length < 2) return null;
    return intel.calculateExerciseProgression(comparisons.slice(-6));
  }

  function recommend(ex, previous, activeExLogs=[]){
    const available = getAvailableLoadsForExercise(ex);
    const maxAvailable = available[available.length - 1] || (isDumbbellExercise(ex) ? (isSingleDumbbell(ex) ? 27.5 : 55) : 100);

    if(!previous || previous.skipped){
      const startingLoad = ex.load === 'bodyweight' ? 0 : (available[0] || '');
      return { weight: startingLoad, reps: ex.min, reason: 'First benchmark', hasOverload: false, label: '' };
    }

    const isBody = ex.load === 'bodyweight';
    const reps = Number(previous.reps) || ex.min;
    const rir = previous.rir != null ? Number(previous.rir) : null;

    if(isBody){
      if(rir === 0){
        return { weight: 0, reps: reps, reason: 'Maintain — last set was near failure', hasOverload: false, label: '' };
      }
      if(rir != null && rir >= 1 && reps < ex.max){
        return { weight: 0, reps: reps + 1, reason: 'Add 1 rep at the same weight', hasOverload: true, label: '+1 rep' };
      }
      if(reps >= ex.max){
        return { weight: 0, reps: reps, reason: 'Repeat previous performance', hasOverload: false, label: '' };
      }
      return { weight: 0, reps: Math.max(ex.min, reps), reason: 'Repeat previous performance', hasOverload: false, label: '' };
    }

    const validCurrent = findConservativeAvailableLoad(previous.weight, available);

    // 1. Maintain when appropriate: If set was completed very close to failure (0 RIR)
    if(rir === 0){
      return { weight: validCurrent, reps: reps, reason: 'Maintain — last set was near failure', hasOverload: false, label: '' };
    }

    // 2. Within-session carry forward: If previous is from the active session
    const isWithinSession = activeExLogs && activeExLogs.some(l => l && !l.skipped && l.round === previous.round);
    if(isWithinSession && previous.round && previous.round >= 1){
      return { weight: validCurrent, reps: reps, reason: 'Repeat previous performance', hasOverload: false, label: '' };
    }

    // 3. Double progression across sessions (between workouts):
    // Heavier weight only when athlete demonstrated sufficient performance across all working sets
    if(didAllSetsAchieveMax(ex, activeExLogs)){
      if(validCurrent >= maxAvailable){
        return { weight: validCurrent, reps: reps, reason: 'Maximum available weight reached', hasOverload: false, label: '' };
      }
      const nextWeight = stepLoad(validCurrent, +1, ex);
      if(nextWeight > validCurrent){
        return { weight: nextWeight, reps: ex.min, reason: 'Increase load — rep target achieved', hasOverload: true, label: `+${+(nextWeight - validCurrent).toFixed(1)} kg` };
      } else {
        return { weight: validCurrent, reps: reps, reason: 'Maximum available weight reached', hasOverload: false, label: '' };
      }
    }

    // First: Build repetitions towards the exercise's intended upper rep range
    if(rir != null && rir >= 1 && reps < ex.max){
      return { weight: validCurrent, reps: reps + 1, reason: 'Add 1 rep at the same weight', hasOverload: true, label: '+1 rep' };
    }

    if(reps < ex.min){
      return { weight: validCurrent, reps: ex.min, reason: 'Target min reps', hasOverload: false, label: '' };
    }

    if(validCurrent >= maxAvailable && reps >= ex.max){
      return { weight: validCurrent, reps: reps, reason: 'Maximum available weight reached', hasOverload: false, label: '' };
    }

    return { weight: validCurrent, reps: reps, reason: 'Repeat previous performance', hasOverload: false, label: '' };
  }

  function resolveSetValues(t, activeSession){
    const ex = t.ex;
    const idx = t.index;
    const drafts = activeSession?.drafts || {};

    // Priority 1: User manually entered draft for this set
    const manualWeight = drafts[`weight-${idx}`];
    const manualReps = drafts[`reps-${idx}`];
    const manualRir = drafts[`rir-${idx}`];
    const hasManual = (manualWeight !== undefined && manualWeight !== '') || (manualReps !== undefined && manualReps !== '');

    // Priority 2: Latest completed set of the SAME exercise in this active session
    let prevRoundLog = null;
    if (activeSession?.logs) {
      for (let i = activeSession.logs.length - 1; i >= 0; i--) {
        const l = activeSession.logs[i];
        if (l && !l.skipped && (l.exId === ex.id || l.name === ex.name)) {
          prevRoundLog = l;
          break;
        }
      }
    }

    // Historical baseline (Strongest set in 90 days for Set 1; otherwise matching round from recent history)
    const histLog = (t.round === 1 ? bestSetLast90Days(ex.id) : null) || previousMatchingSet(ex.id, t.round) || exerciseLastSet(ex.id, []);
    const baselineLog = prevRoundLog || histLog;

    const availableLoads = getAvailableLoadsForExercise(ex);
    let baseWeight = '';
    let baseReps = ex.min;
    let baseRir = '';

    if (baselineLog && !baselineLog.skipped) {
      const rawWeight = Number(baselineLog.weight);
      if (ex.load === 'bodyweight') {
        baseWeight = 0;
      } else if (rawWeight > 0) {
        // Never let incomplete equipment inventory silently clamp historical performance
        const validLoad = findConservativeAvailableLoad(rawWeight, availableLoads);
        baseWeight = validLoad;
      } else {
        baseWeight = permitsBodyweight(ex) ? 0 : (availableLoads[0] || '');
      }
      baseReps = Number(baselineLog.reps) || ex.min;
      baseRir = baselineLog.rir != null ? baselineLog.rir : '';
    } else if (ex.load === 'bodyweight' || permitsBodyweight(ex)) {
      baseWeight = 0;
    } else {
      baseWeight = availableLoads[0] || '';
    }

    const logged = activeSession?.logs?.[idx];
    const weight = manualWeight !== undefined ? manualWeight : (logged?.weight !== undefined ? logged.weight : baseWeight);
    const reps = manualReps !== undefined ? manualReps : (logged?.reps !== undefined ? logged.reps : baseReps);
    const rir = manualRir !== undefined ? manualRir : (logged?.rir !== undefined ? logged.rir : '');

    const activeExLogs = (activeSession?.logs || []).filter(l => l && (l.exId === ex.id || l.name === ex.name));

    const rec = recommend(ex, baselineLog, activeExLogs);
    const performanceTrend = exercisePerformanceTrend(ex);
    if (performanceTrend && performanceTrend.confidence !== 'low' &&
        (performanceTrend.status === 'improving' || performanceTrend.status === 'declining')) {
      const sign = performanceTrend.changePct > 0 ? '+' : '';
      rec.reason += ` · Est. performance ${sign}${performanceTrend.changePct}%`;
    }
    const hasOverload = !!rec.hasOverload && (
      (ex.load !== 'bodyweight' && rec.weight !== '' && Number(rec.weight) !== Number(weight)) ||
      (Number(rec.reps) !== Number(reps))
    );

    return {
      weight,
      reps,
      rir,
      baseWeight,
      baseReps,
      baselineLog,
      prevRoundLog,
      histLog,
      rec,
      hasOverload,
      isManual: hasManual
    };
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

  function workoutRoadmap(tasks, currentTaskIndex, activeLogs){
    const pairs = currentSessionPairs();
    const activeLogsArr = activeLogs || [];
    const completedCount = activeLogsArr.filter(l => l && !l.skipped).length;
    const skippedCount = activeLogsArr.filter(l => l && l.skipped).length;
    
    const blockData = pairs.map((p, pi) => {
      const isSuperset = p.exercises.length > 1;
      let blockSetsTotal = 0;
      let blockSetsResolved = 0;
      let hasCurrent = false;

      const exList = p.exercises.map((ex, ei) => {
        const exTasks = tasks.filter(t => t.pi === pi && t.ei === ei);
        const exDone = exTasks.filter(t => activeLogsArr[t.index] && !activeLogsArr[t.index].skipped).length;
        const exSkipped = exTasks.filter(t => activeLogsArr[t.index]?.skipped).length;
        const totalSets = exTasks.length || ex.sets;
        blockSetsTotal += totalSets;
        blockSetsResolved += (exDone + exSkipped);
        const isCurrent = exTasks.some(t => t.index === currentTaskIndex && !activeLogsArr[t.index]);
        if (isCurrent) hasCurrent = true;
        const isFinished = (exDone + exSkipped) >= totalSets && totalSets > 0;
        const statusBadge = isFinished ? (exSkipped > 0 ? (exDone > 0 ? `✓ Done (${exSkipped} skp)` : '✕ Dropped') : '✓ Done') : isCurrent ? '● Active' : 'Upcoming';
        const badgeClass = isFinished ? (exDone > 0 ? 'badge-success' : 'badge-skipped') : isCurrent ? 'badge-active' : 'badge-upcoming';
        
        return `<div class="roadmap-ex-row ${isCurrent?'roadmap-active':''} ${isFinished?'roadmap-finished':''}">
          <div class="roadmap-ex-info">
            <strong class="roadmap-ex-name" style="${isFinished ? 'color:#94a3b8;' : ''}">${isFinished && exDone > 0 ? '✓ ' : ''}${esc(ex.name)}</strong>
            <small class="roadmap-ex-meta" style="color:#64748b;">${ex.sets} sets · ${ex.min}–${ex.max} ${esc(ex.unit||'reps')}${isDumbbellExercise(ex)?' · per DB':''}</small>
          </div>
          <div class="roadmap-ex-right" style="display:flex; align-items:center; gap:8px;">
            <span class="roadmap-sets-count" style="font-size:12px; color:#cbd5e1; font-weight:600;">${exDone}/${totalSets} sets${exSkipped ? ` <small style="color:#94a3b8;">(${exSkipped} skp)</small>` : ''}</span>
            <span class="roadmap-status-tag ${badgeClass}">${statusBadge}</span>
          </div>
        </div>`;
      }).join('');

      const isBlockFinished = blockSetsResolved >= blockSetsTotal && blockSetsTotal > 0;

      const html = `<div class="roadmap-block ${isBlockFinished ? 'roadmap-block-finished' : ''}">
        <div class="roadmap-block-head">
          <span>${isSuperset ? 'SUPERSET ' + (pi + 1) : 'BLOCK ' + (pi + 1)}</span>
          <span>${isBlockFinished ? '✓ Completed' : hasCurrent ? '● In Progress' : 'Upcoming'}</span>
        </div>
        ${exList}
      </div>`;

      return { pi, isBlockFinished, hasCurrent, html };
    });

    const activeBlocks = blockData.filter(b => b.hasCurrent);
    const upcomingBlocks = blockData.filter(b => !b.hasCurrent && !b.isBlockFinished);
    const completedBlocks = blockData.filter(b => b.isBlockFinished);

    const activeAndUpcomingHtml = [...activeBlocks, ...upcomingBlocks].map(b => b.html).join('');
    const completedHtml = completedBlocks.map(b => b.html).join('');

    return `
      <details class="rr-session-roadmap"><summary>Workout plan <span>· ${completedCount}/${tasks.length} sets</span></summary><section class="roadmap-section card section mt16">
        <div class="row" style="width:100%; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <h3 style="margin:0; font-size:15px; font-weight:800; color:#fff;">Workout Roadmap — ${completedCount}/${tasks.length} sets${skippedCount ? ` <small style="color:#94a3b8; font-weight:normal;">(${skippedCount} skp)</small>` : ''}</h3>
          <button type="button" class="btn sm outline btn-edit-roadmap" data-action="open-roadmap-edit-modal" style="font-size:11px; padding:4px 10px; border-color:#3a424e; color:#cbd5e1; border-radius:6px; font-weight:700;">✎ Edit</button>
        </div>
        ${activeAndUpcomingHtml ? `<div class="roadmap-active-stack">${activeAndUpcomingHtml}</div>` : ''}
        ${completedBlocks.length ? `
          <details class="roadmap-completed-accordion mt12" ${!activeAndUpcomingHtml ? 'open' : ''}>
            <summary style="cursor:pointer; color:#94a3b8; font-size:12px; font-weight:600; padding:6px 0;">
              ✓ Completed Blocks (${completedBlocks.length}) · tap to toggle
            </summary>
            <div class="roadmap-completed-stack mt8" style="opacity:0.75;">
              ${completedHtml}
            </div>
          </details>
        ` : ''}
      </section></details>
    `;
  }

  function workout(){
    if(!state.active)return workoutLanding();
    const a=state.active;
    const tasks=buildTasks(a.session);

    // Advance taskIndex over any already resolved tasks
    while(a.taskIndex < tasks.length && a.logs[a.taskIndex]){
      a.taskIndex++;
    }

    const resolvedCount = a.logs.filter(Boolean).length;
    const completedCount = a.logs.filter(l => l && !l.skipped).length;
    const skippedCount = a.logs.filter(l => l && l.skipped).length;

    if(resolvedCount >= tasks.length || a.taskIndex >= tasks.length){
      a.stage='feedback';
      a.restUntil=null;
      return feedbackView();
    }
    if(a.stage==='feedback')return feedbackView();
    const group=fullRound(tasks,a.taskIndex);
    const activeGroupItems = group.items.filter(t => !a.logs[t.index]?.skipped);
    if(!activeGroupItems.length){
      a.taskIndex = group.end + 1;
      return workout();
    }
    if(a.stage==='rest')return restView(tasks,group.task);
    const pair=group.task.pair,isSolo=activeGroupItems.length===1,next=fullRound(tasks,group.end+1);
    const hasDroppedInRound = group.items.some(t => a.logs[t.index]?.skipped);

    return `<div class="compact-workout rr-session-compact"><div class="row workout-top-actions"><div class="workout-timer"><span class="workout-timer-value">${formatDuration(a.accumulatedTime + (a.lastStartTime ? (Date.now() - a.lastStartTime) / 1000 : 0))}</span></div><details class="workout-menu"><summary>••• Options</summary><div class="menu-items">${btn('Finish & Save early','finish-partial','outline full')}${btn('Pause & exit','pause','outline full')}${btn('Discard workout','discard','text full')}</div></details></div>
      <div class="rr153-active-header rr-session-header"><div class="row"><span class="eyebrow">LIVE SESSION <b>●</b></span><span class="rr153-set-counter">${completedCount} of ${tasks.length} sets logged${skippedCount ? ` (${skippedCount} skipped)` : ''}</span></div><h1>${esc(planFor(a.session).name||'WORKOUT '+a.session)}</h1><p>${isSolo?'MOVEMENT':'SUPERSET ' + (group.task.pi + 1)} · ROUND ${group.task.round} OF ${group.task.rounds}</p>${bar(resolvedCount,tasks.length)}</div>
      ${hasDroppedInRound ? `<div class="dropped-round-note" style="background:rgba(148,163,184,0.1); border:1px dashed rgba(148,163,184,0.3); border-radius:8px; padding:6px 12px; margin-bottom:12px; font-size:11px; color:#cbd5e1;">⚡ <em>Dropped in this round:</em> ${group.items.filter(t => a.logs[t.index]?.skipped).map(t => esc(t.ex.name)).join(', ')} (skipped)</div>` : ''}
      <form id="roundForm" class="round-form" novalidate>${activeGroupItems.map((t,i)=>{
        const ex=t.ex, idx=t.index;
        const resolved = resolveSetValues(t, a);
        const logged = a.logs[idx];
        const perDb = isDumbbellExercise(ex);
        const isSingle = isSingleDumbbell(ex);
        const exTasks = tasks.filter(tk => tk.pi === t.pi && tk.ei === t.ei);
        const hasSkippedInEx = exTasks.some(tk => a.logs[tk.index]?.skipped);
        const differsFromRec = (ex.load !== 'bodyweight' && resolved.rec.weight !== '' && Number(resolved.rec.weight) !== Number(resolved.weight)) || (Number(resolved.rec.reps) !== Number(resolved.reps));
        const availableLoads = getAvailableLoadsForExercise(ex);
        const minAvailable = availableLoads[0] ?? 0;
        const maxAvailable = availableLoads[availableLoads.length - 1] ?? (perDb ? (isSingle ? 27.5 : 55) : 100);
        const isAtMaxAvailable = Number(resolved.weight) >= maxAvailable && ex.load !== 'bodyweight';
        const isAtMinAvailable = Number(resolved.weight) <= minAvailable;
        const weightConvention = formatWeightConvention(resolved.weight, ex);
        const selectedRir = (resolved.rir !== undefined && resolved.rir !== '' && resolved.rir !== null) ? Number(resolved.rir) : 2;

        return `<section class="movement-entry mini-exercise rr-session-set-card">
          <div class="mini-head rr-session-set-head">
            <div class="mini-title" style="width:100%;">
              <div class="row" style="align-items:center; justify-content:space-between; width:100%; margin-bottom:4px;">
                <span class="eyebrow" style="color:#d97241; font-weight:800; font-size:10px; letter-spacing:1px;">${isSolo ? 'MOVEMENT' : 'ROUND ' + group.task.round + ' · EXERCISE ' + (i+1) + '/' + activeGroupItems.length}</span>
                <button type="button" class="btn text btn-compact-action btn-exercise-options" data-action="open-active-exercise-edit-modal" data-pair="${t.pi}" data-ex="${t.ei}" data-index="${idx}" style="font-size:11px; padding:3px 8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#cbd5e1; font-weight:700;">••• Edit</button>
              </div>
              <h2 class="rr-session-exercise-name">${esc(ex.name)} <span class="rr-session-set-number">· ${t.round}/${ex.sets}</span></h2>
              <p class="tiny muted" style="margin:0 0 6px 0;">${esc(ex.muscle)} · Target: ${ex.min}–${ex.max} ${esc(ex.unit||'reps')}</p>
            </div>
            <div class="cue-stack">${movementCue(ex)}</div>
          </div>

          <div class="mini-previous rr-session-previous">
            ${personalBests(ex.id)?.best ? `<span style="font-weight:700; color:#7dc9a2;">🏆 Best: ${esc(scoreLabel(personalBests(ex.id).best))}</span> <i style="color:#4a5568;">•</i> ` : ''}
            <span style="color:#94a3b8;">${resolved.prevRoundLog ? 'Prev: ' + esc(scoreLabel(resolved.prevRoundLog)) : (resolved.histLog ? 'Benchmark: ' + esc(scoreLabel(resolved.histLog)) : 'First session')}</span>
          </div>

          <!-- Progressive Overload Recommendation -->
          <div class="overload-badge rr-session-recommendation ${differsFromRec || resolved.hasOverload ? 'has-overload' : ''}">
            <div style="font-size:11px; line-height:1.3; color:#cbd5e1;">
              <span style="font-weight:800; color:#ff9f66; font-size:9px; letter-spacing:0.5px; display:block;">⚡ RECOMMENDED</span>
              <div>${esc(resolved.rec.reason)}: <strong>${resolved.rec.weight!==''?(ex.load==='bodyweight'?'BW':formatWeightConvention(resolved.rec.weight, ex)):''} × ${resolved.rec.reps}</strong></div>
            </div>
            ${differsFromRec ? `
              <button type="button" class="btn sm primary btn-apply-overload" data-action="apply-overload" data-index="${idx}" data-weight="${resolved.rec.weight}" data-reps="${resolved.rec.reps}" style="min-height:30px; padding:4px 10px; font-size:11px; background:#d97241; font-weight:700;">
                Apply ⚡
              </button>
            ` : ''}
          </div>

          <div class="form-grid compact-edit rr-session-numbers" data-edit-fields="${idx}">
            <div class="field stepper-field" style="margin:0;">
              <label style="font-size:10px; color:#aaa8a5; margin-bottom:6px; display:block; text-transform:uppercase; letter-spacing:0.8px; font-weight:800;">Weight (${ex.load==='bodyweight'?'BW':(perDb?(isSingle?'kg (single DB)':'kg (combined)'):'kg')})</label>
              <div style="display:flex; align-items:center; gap:6px;">
                <button type="button" class="btn primary btn-step rr-stepper-minus" data-action="step-weight" data-index="${idx}" data-dir="-1" ${isAtMinAvailable ? 'disabled style="width:48px; height:52px; padding:0; font-size:24px; font-weight:900; background:#222529; border-color:#3a3f47; color:#555; opacity:0.4; pointer-events:none;"' : 'style="width:48px; height:52px; padding:0; font-size:24px; font-weight:900; background:#222529; border-color:#3a3f47; color:#f2ede8;"'}>−</button>
                <input name="weight-${idx}" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(resolved.weight)}" ${ex.load==='bodyweight'?'disabled':''} class="input rr-weight-input" style="flex:1; text-align:center; padding:8px 2px; font-size:22px; font-weight:900; height:52px; color:#fff; background:#0d1117; border:2px solid #3a3f47; border-radius:10px;">
                <button type="button" class="btn primary btn-step rr-stepper-plus" data-action="step-weight" data-index="${idx}" data-dir="1" ${isAtMaxAvailable ? 'disabled style="width:48px; height:52px; padding:0; font-size:24px; font-weight:900; background:#222529; border-color:#3a3f47; color:#555; opacity:0.4; pointer-events:none;"' : 'style="width:48px; height:52px; padding:0; font-size:24px; font-weight:900; background:#222529; border-color:#3a3f47; color:#f2ede8;"'}>+</button>
              </div>
              <div data-weight-convention="${idx}" class="weight-convention-subtext" style="font-size:11px; color:#cbd5e1; margin-top:5px; font-weight:600; text-align:center;">${weightConvention}</div>
              ${isAtMaxAvailable ? `
                <div style="font-size:10px; color:#ff9f66; font-weight:700; text-align:center; margin-top:2px;">Equipment limit (${maxAvailable} kg) reached</div>
              ` : ''}
            </div>
            <div class="field stepper-field" style="margin:0;">
              <label style="font-size:10px; color:#aaa8a5; margin-bottom:6px; display:block; text-transform:uppercase; letter-spacing:0.8px; font-weight:800;">Actual ${esc(ex.unit||'reps')}</label>
              <div style="display:flex; align-items:center; gap:6px;">
                <button type="button" class="btn primary btn-step rr-stepper-minus" data-action="step-reps" data-index="${idx}" data-dir="-1" style="width:48px; height:52px; padding:0; font-size:24px; font-weight:900; background:#222529; border-color:#3a3f47; color:#f2ede8;">−</button>
                <input name="reps-${idx}" type="number" inputmode="numeric" min="1" max="99" value="${esc(resolved.reps)}" class="input rr-reps-input" style="flex:1; text-align:center; padding:8px 2px; font-size:22px; font-weight:900; height:52px; color:#fff; background:#0d1117; border:2px solid #3a3f47; border-radius:10px;">
                <button type="button" class="btn primary btn-step rr-stepper-plus" data-action="step-reps" data-index="${idx}" data-dir="1" style="width:48px; height:52px; padding:0; font-size:24px; font-weight:900; background:#222529; border-color:#3a3f47; color:#f2ede8;">+</button>
              </div>
            </div>
          </div>

          <div class="rir-row rr-session-rir">
            <span class="rr-session-rir-title">EFFORT · REPS IN RESERVE</span>
            <div class="rir-options segmented-rir rr-session-rir-options">
              ${[0,1,2,3,4,5].map(n=>`
                <label style="margin:0; cursor:pointer;">
                  <input type="radio" name="rir-${idx}" value="${n}" ${selectedRir===n?'checked':''} style="position:absolute; opacity:0; pointer-events:none;">
                  <span class="rir-btn ${selectedRir===n?'active':''}">${n===5?'5+':n}</span>
                </label>
              `).join('')}
            </div>
            <div class="rir-labels rr-session-rir-labels">
              <small style="font-size:9px; color:#ee8d85; font-weight:700;">FAILURE (0)</small>
              <small style="font-size:9px; color:#aaa8a5;">RESERVE</small>
              <small style="font-size:9px; color:#7dc9a2; font-weight:700;">EASY (5+)</small>
            </div>
          </div>
        </section>`;
      }).join('')}<div class="up-next rr-session-up-next"><div><span class="eyebrow">UP NEXT</span><strong>${next.items.length?next.task.pair.id===pair.id?'Round '+next.task.round+' of '+next.task.rounds:next.items.map(t=>t.ex.name).join(' + '):'Finish workout'}</strong><span>${next.items.length?next.task.pair.id===pair.id?'Same exercises':'Prepare next movement(s)':'Review and save your session'}</span></div><div class="next-rest">${next.items.length?`Rest<strong>${Math.max(15, pair.restMin-15)}–${Math.max(15, pair.restMax-15)}s</strong>`:''}</div></div>
      <button class="btn primary full round-log-button rr-session-submit" type="submit">${activeGroupItems.some(t=>a.logs[t.index])?'Update':'Log & Start Rest'} ${isSolo?'set':'superset round'} →</button></form>
      ${workoutRoadmap(tasks, a.taskIndex, a.logs)}
      </div>`;
  }

  function restView(tasks,nextTask){
    const a=state.active;
    // Advance taskIndex over any already resolved tasks
    while(a.taskIndex < tasks.length && a.logs[a.taskIndex]){
      a.taskIndex++;
    }
    if(a.taskIndex >= tasks.length || a.logs.filter(Boolean).length >= tasks.length){
      a.stage='feedback';
      a.restUntil=null;
      return feedbackView();
    }
    const group=fullRound(tasks,a.taskIndex);
    const activeItems = group.items.filter(t => !a.logs[t.index]?.skipped);
    if(!activeItems.length){
      a.taskIndex = group.end + 1;
      return restView(tasks, tasks[a.taskIndex]);
    }
    const remaining=Math.max(0,Math.ceil((a.restUntil-Date.now())/1000));
    const time=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
    const isSuperset = activeItems.length > 1;

    const completedCount = a.logs.filter(l => l && !l.skipped).length;
    const skippedCount = a.logs.filter(l => l && l.skipped).length;
    const resolvedCount = a.logs.filter(Boolean).length;
    const pairs = currentSessionPairs();

    return `
      <div class="rr-rest-screen">
      <div class="row session-controls"><div class="workout-timer"><span class="workout-timer-value">${formatDuration(a.accumulatedTime + (a.lastStartTime ? (Date.now() - a.lastStartTime) / 1000 : 0))}</span></div><button class="quiet-link" type="button" data-action="pause">Pause & exit</button></div>
      <div class="eyebrow" style="color:#d97241; font-weight:800; letter-spacing:1px;">WORKOUT ${a.session} · RECOVERY &amp; REST</div>
      <h1 class="page-title" style="font-size:28px; margin:4px 0 6px 0;">Rest &amp; Recover</h1>
      <p class="lead" style="color:#aaa8a5; margin-bottom:16px;">${esc(a.restNote || 'Take a breath and recover for your next set.')}</p>

      <!-- Rest Countdown Card -->
      <section class="card section center rr-rest-countdown">
        <div class="eyebrow" style="font-size:10px; letter-spacing:1.2px; color:#888;">REST TIMER</div>
        <div class="timer" style="font-size:54px; font-weight:900; letter-spacing:1px; margin:4px 0; color:#f5ede6; font-variant-numeric:tabular-nums;">${time}</div>
        <p class="subhead" style="margin-bottom:10px; color:#94a3b8;">${a.restSeconds}s planned recovery</p>
        ${bar(a.restSeconds-remaining,a.restSeconds)}
        <div class="rest-controls mt16" style="display:flex; gap:10px;">
          ${btn('+15 seconds','rest-add','outline','style="flex:1; height:46px; font-size:14px; font-weight:700;"')}
          ${btn('Ready Now · Start Set →','rest-skip','primary','style="flex:1.4; height:46px; font-size:14px; font-weight:800; background:#d97241;"')}
        </div>
      </section>

      <!-- Compact Workout Progress Bar -->
      <div class="rr-rest-progress">
        <div>
          <span style="font-size:10px; text-transform:uppercase; letter-spacing:0.8px; color:#888; font-weight:700; display:block;">Workout Progress</span>
          <strong style="font-size:13px; color:#fff;">${completedCount} of ${tasks.length} sets completed${skippedCount ? ` <span style="color:#94a3b8; font-weight:normal;">(${skippedCount} skipped)</span>` : ''}</strong>
        </div>
        <span class="label-tag" style="font-weight:700; background:#222831; color:#f5ede6; font-size:11px;">${Math.round((resolvedCount / tasks.length) * 100)}%</span>
      </div>

      <!-- Read-Only Workout Summary with Single Top-Right Edit Button -->
      <section class="card section rr-rest-next-panel">
        <div class="row" style="align-items:center; justify-content:space-between; margin-bottom:12px;">
          <div>
            <span class="eyebrow" style="color:#d97241; font-weight:800; font-size:10px; letter-spacing:1px;">WORKOUT SUMMARY</span>
            <h3 style="margin:2px 0 0 0; font-size:16px; color:#fff;">Session Structure</h3>
          </div>
          <button type="button" class="btn sm outline btn-edit-rest" data-action="open-rest-edit-modal" style="font-size:11px; padding:4px 10px; border-color:#3a424e; color:#cbd5e1; border-radius:6px; display:inline-flex; align-items:center; gap:4px; font-weight:700;">✎ Edit</button>
        </div>

        <!-- Highlighted Up Next Block (Read-Only) -->
        <div class="rest-up-next-card rr-rest-up-next">
          <div class="row" style="align-items:center; justify-content:space-between; margin-bottom:6px;">
            <span class="eyebrow" style="color:#ff9f66; font-weight:800; font-size:10px; letter-spacing:0.8px;">⚡ UP NEXT</span>
            <span class="label-tag" style="background:rgba(217,114,65,0.2); color:#ff9f66; font-size:10px; font-weight:700;">${isSuperset ? 'Superset Round ' + group.task.round : 'Set ' + group.task.round}</span>
          </div>
          ${activeItems.map((t, idxItem) => {
            const ex = t.ex;
            const res = resolveSetValues(t, a);
            const wText = formatWeightConvention(res.weight, ex);
            return `
              <div style="${idxItem > 0 ? 'margin-top:10px; padding-top:10px; border-top:1px dashed rgba(217,114,65,0.25);' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:baseline;">
                  <strong style="font-size:16px; color:#fff;">${esc(ex.name)}</strong>
                  <span style="font-size:12px; color:#ff9f66; font-weight:700;">Set ${t.round}/${ex.sets}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:3px; font-size:13px; color:#cbd5e1;">
                  <span style="color:#f5ede6; font-weight:600;">${wText}</span>
                  <span style="font-weight:700; color:#fff;">Target: ${res.reps} reps</span>
                </div>
                ${res.rec.reason ? `<div style="font-size:11px; color:#ff9f66; margin-top:3px;">⚡ ${esc(res.rec.reason)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- Read-Only Movement Structure Overview -->
        <details class="rr-rest-structure"><summary>View full workout structure <span>${pairs.length} blocks</span></summary><div class="rest-summary-blocks">
          ${pairs.map((p, pi) => {
            const isSup = p.exercises.length > 1;
            const blockTasks = tasks.filter(tk => tk.pi === pi);
            const blockDone = blockTasks.filter(tk => a.logs[tk.index] && !a.logs[tk.index].skipped).length;
            const blockSkipped = blockTasks.filter(tk => a.logs[tk.index]?.skipped).length;
            const isFinished = (blockDone + blockSkipped) >= blockTasks.length && blockTasks.length > 0;
            const isCurrentBlock = blockTasks.some(tk => tk.index === a.taskIndex);

            return `
              <div style="background:#121518; border:1px solid ${isCurrentBlock ? '#d97241' : isFinished ? '#1e242d' : '#222831'}; border-radius:8px; padding:10px 12px; opacity:${isFinished ? '0.6' : '1'};">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <span style="font-size:10px; text-transform:uppercase; letter-spacing:0.8px; color:${isCurrentBlock ? '#d97241' : '#888'}; font-weight:800;">
                    ${isSup ? 'Superset ' + p.id : 'Block ' + p.id} ${isFinished ? '✓' : ''}
                  </span>
                  <span style="font-size:11px; color:${isFinished ? '#4ade80' : isCurrentBlock ? '#ff9f66' : '#94a3b8'}; font-weight:700;">
                    ${isFinished ? 'Completed' : isCurrentBlock ? 'In Progress' : 'Upcoming'}
                  </span>
                </div>
                <div style="font-size:13px; color:#cbd5e1;">
                  ${p.exercises.map(e => esc(e.name)).join(' + ')}
                </div>
              </div>
            `;
          }).join('')}
        </div></details>
      </section>
      </div>
    `;
  }

  function feedbackView(){
    const a = state.active;
    if(!a) return workoutLanding();
    const tasks = buildTasks(a.session);
    const allLogs = (a.logs || []).filter(Boolean);
    const completedLogs = allLogs.filter(l => !l.skipped);
    const skippedLogs = allLogs.filter(l => l.skipped);
    const doneCount = completedLogs.length;
    const durMinutes = Math.max(1, Math.round((Date.now() - new Date(a.startedAt).getTime()) / 60000));
    const totalReps = completedLogs.reduce((acc, l) => acc + (Number(l.reps) || 0), 0);
    const totalVol = completedLogs.reduce((acc, l) => acc + setVolume(l), 0);
    const prs = [];
    completedLogs.forEach(l => {
      const prev = bestByExercise(allLogs)[l.exId];
      if (prev && score(l) > score(prev) + 0.000001) {
        if (!prs.some(p => p.exId === l.exId)) prs.push({ exId: l.exId, name: l.name, weight: l.weight, reps: l.reps });
      }
    });

    return `
      <div class="feedback-screen">
        <div class="eyebrow" style="color:#d97241; font-weight:700;">SESSION COMPLETED 🏆</div>
        <h1 class="page-title" style="margin-top:4px;">Great work on Workout ${esc(a.session)}.</h1>
        <p class="lead">${doneCount} of ${tasks.length} sets completed${skippedLogs.length ? ` (${skippedLogs.length} skipped)` : ''}. Review your workout feel and save to lock in your progress.</p>

        <div class="three-stat section mt16" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
          <div class="metric card" style="text-align:center; padding:12px;">
            <strong style="font-size:24px; color:#f5ede6;">${doneCount}<small style="font-size:14px; color:#94a3b8;">/${tasks.length}</small></strong>
            <span style="font-size:11px; color:#94a3b8; display:block; margin-top:4px;">${skippedLogs.length ? 'Completed (' + skippedLogs.length + ' skp)' : 'Sets Logged'}</span>
          </div>
          <div class="metric card" style="text-align:center; padding:12px;">
            <strong style="font-size:24px; color:#f5ede6;">${durMinutes}m</strong>
            <span style="font-size:11px; color:#94a3b8; display:block; margin-top:4px;">Duration</span>
          </div>
          <div class="metric card" style="text-align:center; padding:12px;">
            <strong style="font-size:24px; color:#f5ede6;">${fmt(totalVol)}</strong>
            <span style="font-size:11px; color:#94a3b8; display:block; margin-top:4px;">Kg Volume</span>
          </div>
        </div>

        ${prs.length ? `
          <div class="pr-celebration-card card section mt16" style="background:rgba(217,114,65,0.12); border:1px solid rgba(217,114,65,0.3); border-radius:12px; padding:14px;">
            <div class="row" style="align-items:center; gap:8px;">
              <span style="font-size:20px;">🏆</span>
              <div>
                <strong style="color:#f5ede6;">${prs.length} Personal Best${prs.length>1?'s':''} Achieved!</strong>
                <div style="font-size:12px; color:#cbd5e1; margin-top:2px;">
                  ${prs.map(p => `${esc(p.name)} (${p.weight ? p.weight + ' kg × ' : ''}${p.reps} reps)`).join(', ')}
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <form id="feedbackForm" class="stack mt16 card section">
          <h3 style="margin-top:0; font-size:16px;">How did this workout feel?</h3>
          <p class="subhead">This informs your readiness and fatigue indicators for subsequent sessions.</p>

          <div class="feedback-options mt12" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;">
            ${[
              ['strong', '💪 Strong', 'Felt energetic'],
              ['good', '👍 Good', 'Solid effort'],
              ['normal', '👌 Normal', 'Standard load'],
              ['tough', '🔥 Tough', 'Near limit']
            ].map(([val, label, sub]) => `
              <label class="feedback-pill-label" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:10px 6px; background:#161a20; border:1px solid #2a313d; border-radius:10px; cursor:pointer;">
                <input type="radio" name="feel" value="${val}" ${val==='good'?'checked':''} style="margin-bottom:6px; accent-color:#d97241;">
                <strong style="font-size:13px; color:#f5ede6;">${label}</strong>
                <small class="muted" style="font-size:10px; margin-top:2px;">${sub}</small>
              </label>
            `).join('')}
          </div>

          <div class="field mt16">
            <label style="font-size:12px; color:#94a3b8; display:block; margin-bottom:4px;">Session notes (optional)</label>
            <input name="notes" placeholder="e.g. good energy, swapped rear fly, bench felt solid" class="input" style="width:100%; padding:10px; font-size:14px;">
          </div>

          <div class="mt16 stack" style="gap:10px;">
            <button type="submit" class="btn primary full" style="font-weight:700; padding:14px; font-size:16px; background:#d97241; border-color:#d97241; cursor:pointer;">
              Save Workout &amp; View Summary →
            </button>
          </div>
        </form>
      </div>
    `;
  }

  function completeWorkout(feel='good', notes=''){
    const a = state.active;
    if(!a) return;
    const doneLogs = (a.logs || []).filter(Boolean);
    if(!doneLogs.length){
      showToast('No sets were logged in this session.');
      state.active = null;
      save();
      page = 'home';
      render();
      return;
    }

    // Accurate active duration
    let finalDuration = a.accumulatedTime || 0;
    if(a.lastStartTime) finalDuration += (Date.now() - a.lastStartTime) / 1000;

    const allBest = bestByExercise(allLogs());
    const prs = [];
    doneLogs.forEach(l => {
      const prev = allBest[l.exId];
      if (prev) {
        const isStrengthPB = score(l) > score(prev) + 0.000001;
        const isWeightPB = (l.weight > prev.weight && l.reps >= 1);
        const isRepsPB = (l.weight === prev.weight && l.reps > prev.reps);
        
        if (isStrengthPB || isWeightPB || isRepsPB) {
          if (!prs.some(p => p.exId === l.exId)) {
            prs.push({ 
              exId: l.exId, 
              name: l.name, 
              weight: l.weight, 
              reps: l.reps, 
              score: score(l),
              types: [isStrengthPB && 'strength', isWeightPB && 'weight', isRepsPB && 'reps'].filter(Boolean)
            });
          }
        }
      }
    });

    const tasks = buildTasks(a.session);
    const completedSets = doneLogs.filter(l => l && !l.skipped).length;
    const isPartial = completedSets < tasks.length;

    const lastLogTime = doneLogs.filter(l => l && l.loggedAt).map(l => l.loggedAt).sort().at(-1);
    const workoutStartedAt = a.startedAt || lastLogTime || new Date().toISOString();
    const workoutEndedAt = new Date().toISOString();

    const sessionPlan = planFor(a.session);
    const finished = {
      id: 'workout-' + Date.now(),
      session: a.session,
      sessionName: a.sessionName || sessionPlan.name || ('Workout ' + a.session),
      isOneOff: !!a.isOneOff,
      isHoliday: !!a.isHoliday,
      planId: a.isOneOff ? (a.isHoliday ? 'holiday' : 'one-off') : (a.planId || selectedPlan),
      startedAt: workoutStartedAt,
      endedAt: workoutEndedAt,
      durationSeconds: Math.round(finalDuration),
      logs: doneLogs,
      plannedSets: tasks.length,
      isPartial: isPartial,
      feeling: feel,
      recovery: feel === 'tough' ? 72 : feel === 'normal' ? 48 : 36,
      notes: notes || '',
      prs
    };

    state.history.push(finished);
    if(window.RepRivalCloud && typeof window.RepRivalCloud.saveWorkout === 'function') {
      try { window.RepRivalCloud.saveWorkout(finished); } catch(err){ console.error(err); }
    }

    // Advance next session in order ONLY IF IT IS NOT A ONE-OFF WORKOUT
    if(!a.isOneOff){
      const curIdx = SESSION_ORDER.indexOf(a.session);
      if(curIdx !== -1){
        state.next = SESSION_ORDER[(curIdx + 1) % SESSION_ORDER.length];
      }
    } else if (a.isHoliday && state.holiday?.active && state.holiday?.plan) {
      const hOrder = state.holiday.plan.order || ['HA', 'HB', 'HC'];
      const curHIdx = hOrder.indexOf(a.session);
      if (curHIdx !== -1) {
        state.holiday.plan.nextSession = hOrder[(curHIdx + 1) % hOrder.length];
      }
    }

    state.active = null;
    if(!a.isOneOff && adaptivePlan()){
      const cfg=profile().adaptive;
      const next=createAdaptiveNext((cfg.variant||0)+1);
      if(!next)console.warn('Adaptive next workout not generated:', cfg.lastReason);
    }
    state.lastSummary = finished.id;
    save();
    if(!a.isOneOff&&adaptivePlan())persistAdaptiveConfig();
    page = 'summary';
    render();
    showToast(a.isOneOff ? 'Ad-hoc session complete! Plan rotation preserved.' : 'Workout complete! Saved to history.');
  }

  function openSwapHistoryModal(exId){
    const s = state.history.find(x => String(x.id) === String(state.settings.editSessionId));
    if(!s) return;
    const currentExLog = s.logs.find(l => l.exId === exId || l.name === exId);
    const suggestions = suggestAlternativeExercises(currentExLog || { name: exId, muscle: 'Back' });
    const lib = window.REPRIVAL_EXERCISE_LIBRARY;
    const allEx = lib.entries;

    openModal(`
      <div class="modal-header">
        <h2>Swap Movement in Completed Workout</h2>
        <p class="subhead">Replacing <strong>${esc(currentExLog?.name || exId)}</strong> in this recorded workout.</p>
      </div>
      <div class="modal-body mt16">
        <h3 class="eyebrow">Smart Suggestions</h3>
        <div class="swap-suggestions-list mt8">
          ${suggestions.length ? suggestions.map(cand => `
            <div class="swap-option-card" data-action="confirm-swap-history-ex" data-old-ex="${esc(exId)}" data-new-id="${cand.id}">
              <div>
                <strong>${esc(cand.name)}</strong>
                <small>${esc(cand.muscle)} · ${cand.load}</small>
              </div>
              <button class="btn text" type="button">Swap to this →</button>
            </div>
          `).join('') : '<p class="muted">No direct suggestions found.</p>'}
        </div>
        <h3 class="eyebrow mt16">Browse All Exercises</h3>
        <div class="form-group mt8">
          <input type="text" id="swapHistSearch" placeholder="Search exercises..." class="input">
        </div>
        <div class="swap-all-list mt8" id="swapHistAllList" style="max-height:220px; overflow-y:auto;">
          ${allEx.map(cand => `
            <div class="swap-option-card compact" data-action="confirm-swap-history-ex" data-old-ex="${esc(exId)}" data-new-id="${cand.id}">
              <div>
                <strong>${esc(cand.name)}</strong>
                <small>${esc(cand.muscle)}</small>
              </div>
              <button class="btn text" type="button">Use</button>
            </div>
          `).join('')}
        </div>
      </div>
    `);

    setTimeout(() => {
      const input = document.querySelector('#swapHistSearch');
      if(input){
        input.addEventListener('input', e => {
          const q = e.target.value.toLowerCase();
          document.querySelectorAll('#swapHistAllList .swap-option-card').forEach(card => {
            card.style.display = card.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
          });
        });
      }
    }, 50);
  }

  function openAddHistoryExModal(){
    const lib = window.REPRIVAL_EXERCISE_LIBRARY;
    const allEx = lib.entries;
    openModal(`
      <div class="modal-header">
        <h2>Add Movement to Completed Workout</h2>
        <p class="subhead">Pick an exercise to insert into this workout history entry.</p>
      </div>
      <div class="modal-body mt16">
        <div class="form-group">
          <input type="text" id="addHistSearch" placeholder="Search exercises..." class="input">
        </div>
        <div class="swap-all-list mt8" id="addHistAllList" style="max-height:280px; overflow-y:auto;">
          ${allEx.map(cand => `
            <div class="swap-option-card compact" data-action="confirm-add-history-ex" data-id="${cand.id}">
              <div>
                <strong>${esc(cand.name)}</strong>
                <small>${esc(cand.muscle)} · ${cand.min}–${cand.max} reps</small>
              </div>
              <button class="btn text" type="button">Add movement</button>
            </div>
          `).join('')}
        </div>
      </div>
    `);

    setTimeout(() => {
      const input = document.querySelector('#addHistSearch');
      if(input){
        input.addEventListener('input', e => {
          const q = e.target.value.toLowerCase();
          document.querySelectorAll('#addHistAllList .swap-option-card').forEach(card => {
            card.style.display = card.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
          });
        });
      }
    }, 50);
  }

  function editHistoryScreen(){
    const id=state.settings.editSessionId,s=state.history.find(x=>String(x.id)===String(id));
    if(!s)return `<h1>Workout not found</h1>${btn('Back','last-summary','outline')}`;
    
    const grouped = [];
    (s.logs || []).forEach((l, idx) => {
      let g = grouped.find(x => x.exId === l.exId || x.name === l.name);
      if(!g){
        g = { exId: l.exId || l.name, name: l.name, muscle: l.muscle || 'Target', load: l.load || 'combined', sets: [] };
        grouped.push(g);
      }
      g.sets.push({ log: l, origIndex: idx });
    });

    return `<div class="eyebrow">CORRECT COMPLETED WORKOUT</div>
      <h1 class="page-title">Edit Workout ${esc(s.session)}.</h1>
      <p class="lead">Swap movements, drop exercises, adjust weights, reps or RIR for this completed session. Changes update your records & trend graphs automatically.</p>
      
      <form id="historyEditForm" class="stack">
        <div class="history-edit-card">
          <div class="field">
            <label>Workout date</label>
            <input type="date" name="date" value="${esc(dateOnly(s.startedAt||s.endedAt))}" required>
          </div>
        </div>

        ${grouped.map((g, gi) => `
          <div class="history-edit-card">
            <div class="history-edit-head">
              <div>
                <h3>${esc(g.name)}</h3>
                <small>${esc(g.muscle)} · ${g.sets.length} sets recorded</small>
              </div>
              <div class="history-edit-actions">
                <button type="button" class="btn text" data-action="swap-history-ex" data-ex-id="${esc(g.exId)}">⇄ Swap</button>
                <button type="button" class="btn text text-danger" data-action="drop-history-ex" data-ex-id="${esc(g.exId)}">✕ Drop</button>
              </div>
            </div>

            ${g.sets.map((item, si) => {
              const l = item.log, i = item.origIndex;
              return `
                <div class="history-edit-set">
                  <div class="row mb8">
                    <strong style="color:#ffffff; font-size:13px;">Set ${si + 1}</strong>
                    <button type="button" class="quiet-link text-danger" data-action="drop-history-set" data-index="${i}">✕ Drop set</button>
                  </div>
                  <div class="history-edit-grid">
                    <div class="field">
                      <label>Weight (kg)</label>
                      <input type="number" min="0" step="0.5" name="weight-${i}" value="${num(l.weight)}" ${l.load==='bodyweight'?'disabled':''} required>
                    </div>
                    <div class="field">
                      <label>Reps</label>
                      <input type="number" min="1" max="99" name="reps-${i}" value="${num(l.reps)}" required>
                    </div>
                    <div class="field">
                      <label>RIR</label>
                      <select name="rir-${i}">
                        <option value="">Unknown</option>
                        ${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${l.rir!=null&&Number(l.rir)===n?'selected':''}>${n===5?'5+':n}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}

            <button type="button" class="btn text mt8" data-action="add-history-set" data-ex-id="${esc(g.exId)}">＋ Add set to ${esc(g.name)}</button>
          </div>
        `).join('')}

        <div class="history-edit-card center">
          <button type="button" class="btn outline full" data-action="add-history-ex">＋ Add new movement to completed workout</button>
        </div>

        <div class="mt16 stack">
          <button type="submit" class="btn primary full">Save corrections &amp; update records →</button>
          ${btn('Cancel','cancel-history-edit','outline full')}
        </div>
      </form>`;
  }
  function compareWorkout(s){
    if(!s||!Array.isArray(s.logs)) return {previous:null,improved:0,maintained:0,pbs:0,entries:[]};
    const when=Date.parse(s.endedAt||s.startedAt||'');
    const previous=[...state.history]
      .filter(x=>String(x.id)!==String(s.id)&&(x.session===s.session||x.sessionName===s.sessionName))
      .filter(x=>{
        const xWhen=Date.parse(x.endedAt||x.startedAt||'');
        return Number.isFinite(xWhen)&&Number.isFinite(when)?xWhen<when:true;
      })
      .at(-1)||null;

    const currentGrouped={};
    s.logs.forEach(l=>{
      const key=l.exId||l.name;
      if(!currentGrouped[key]) currentGrouped[key]={id:key,name:l.name,muscle:l.muscle,best:l,logs:[]};
      currentGrouped[key].logs.push(l);
      if(score(l)>score(currentGrouped[key].best)) currentGrouped[key].best=l;
    });

    const prevGrouped={};
    if(previous&&Array.isArray(previous.logs)){
      previous.logs.forEach(l=>{
        const key=l.exId||l.name;
        if(!prevGrouped[key]) prevGrouped[key]={id:key,name:l.name,best:l};
        if(score(l)>score(prevGrouped[key].best)) prevGrouped[key].best=l;
      });
    }

    let improved=0, maintained=0, pbs=(s.prs||[]).length;
    const entries=Object.values(currentGrouped).map(g=>{
      const curBest=g.best, oldBest=prevGrouped[g.id]?.best||null;
      let direction='baseline', change=null;
      if(oldBest){
        const curScore=score(curBest), oldScore=score(oldBest);
        if(curScore>oldScore*1.008){ direction='improved'; improved++; change=((curScore/oldScore)-1)*100; }
        else if(curScore<oldScore*0.992){ direction='lower'; change=((curScore/oldScore)-1)*100; }
        else { direction='maintained'; maintained++; change=0; }
      }
      const pb=(s.prs||[]).some(pr=>pr.exId===g.id||pr.name===g.name);
      const anyTargetAchieved = g.logs.some(l => l.targetAchieved);
      return { id:g.id, name:g.name, best:curBest, old:oldBest, direction, change, pb, anyTargetAchieved };
    });

    return { previous, improved, maintained, pbs, entries };
  }

  function summary(){
    const s=state.history.find(x=>String(x.id)===String(state.lastSummary))||state.history.at(-1);
    if(!s)return home();
    const groups=[];
    (s.logs||[]).forEach(l=>{let g=groups.find(x=>x.id===l.exId);if(!g){g={id:l.exId,name:l.name,load:l.load,muscle:l.muscle,sets:[]};groups.push(g);}g.sets.push(l);});
    const comparison=compareWorkout(s);
    const completedLogs = (s.logs||[]).filter(l => !l.skipped);
    const skippedLogs = (s.logs||[]).filter(l => l.skipped);
    const vol = (s.logs||[]).reduce((a,l)=>a+setVolume(l),0);
    const reps = completedLogs.reduce((a,l)=>a+l.reps,0);
    const rir = completedLogs.filter(l=>l.rir!=null);
    return `<div class="eyebrow">WORKOUT HISTORY · ${dateText(s.endedAt)}</div><h1 class="page-title">${esc(s.sessionName||'Full Body '+s.session)}</h1><p class="lead">Your complete session, set by set — plus what changed since your previous matching workout.</p>
      <div class="three-stat section">
        <div class="metric"><strong>${completedLogs.length}${skippedLogs.length ? `<small>/${s.logs.length}</small>` : ''}</strong><span>${skippedLogs.length ? 'Completed (' + skippedLogs.length + ' skp)' : 'Working sets'}</span></div>
        <div class="metric"><strong>${fmt(reps)}</strong><span>Total reps</span></div>
        <div class="metric"><strong>${fmt(vol)}</strong><span>Kg volume</span></div>
      </div>
      ${card(`<div class="row"><h3>Compared with last Workout ${esc(s.session)}</h3><span class="label-tag">${comparison.previous?dateText(comparison.previous.endedAt||comparison.previous.startedAt):'First baseline'}</span></div>
        ${comparison.previous?`<div class="journey-stats mt16"><div class="metric"><strong>${comparison.improved}</strong><span>Improved</span></div><div class="metric"><strong>${comparison.maintained}</strong><span>Maintained</span></div><div class="metric"><strong>${comparison.pbs}</strong><span>New PBs</span></div></div>`:'<p class="notice mt12">Your first session with this workout establishes a baseline. Complete it again to see what improved.</p>'}
        <div class="mt12">${comparison.entries.map(m=>{
          const label = m.direction === 'baseline' ? 'Baseline' : m.direction === 'improved' ? 'Improved' : m.direction === 'maintained' ? 'Maintained' : (m.anyTargetAchieved ? 'Target achieved' : 'Below previous');
          const colorClass = m.direction === 'improved' ? 'positive' : (m.direction === 'lower' && !m.anyTargetAchieved) ? 'negative' : (m.anyTargetAchieved ? 'positive' : '');
          return `<div class="comparison-row"><div class="row"><strong>${esc(m.name)}</strong><span class="${colorClass}">${m.pb?'🏆 PB · ':''}${label}</span></div><p class="tiny muted">${m.old?esc(scoreLabel(m.old))+' → ':''}${esc(scoreLabel(m.best))}${m.change!=null?' · '+progressPct(m.change):''}${m.old&&m.old.rir!=null&&m.best.rir!=null?' · RIR '+m.old.rir+' → '+m.best.rir:''}</p></div>`;
        }).join('')}</div>
        <p class="fineprint">Compared using the strongest qualifying working set per movement. Fewer or extra sets do not imply weaker or stronger performance. Percentages are estimates, not direct strength measurements.</p>`,'section')}
      ${card(`<h3>Workout takeaway</h3><p class="subhead">${comparison.previous?comparison.improved>0?`${comparison.improved} movements improved compared with the previous matching workout.${comparison.pbs?' You also achieved '+comparison.pbs+' new personal best'+(comparison.pbs===1?'':'s')+'.':''} Keep progressing within your target rep ranges.`:comparison.maintained>0?`You maintained performance on ${comparison.maintained} movements. Maintaining weight and reps can be a good outcome when fatigue or recovery varies.`:`This session was below your previous best-set performance on some movements. One session does not define your overall trend.`:'Your first recorded Workout '+esc(s.session)+' is now your reference for the next session.'}</p>`,'section')}
      <div class="section">${btn('✎ Edit this completed workout','edit-history','outline full')}</div>
      ${card(`<div class="row"><h3>Session details</h3><span class="label-tag">${groups.length} movements</span></div><p class="subhead mt12">${rir.length?'Average RIR '+fmt(rir.reduce((n,l)=>n+l.rir,0)/rir.length):'Effort (RIR) not recorded'} · Suggested recovery ${s.recovery||48}h</p>
      `,'section')}
      ${groups.map((g,i)=>card(`<div class="row"><div><div class="eyebrow">MOVEMENT ${i+1}</div><h3 class="mt8">${esc(g.name)}</h3><p class="subhead">${esc(g.muscle)} · ${g.sets.filter(l=>!l.skipped).length} of ${g.sets.length} sets completed${g.sets.some(l=>l.skipped)?` (${g.sets.filter(l=>l.skipped).length} skipped)`:''}</p></div><span class="label-tag">${g.load==='bodyweight'?'Bodyweight':(isDumbbellExercise(g)?'Dumbbell':'Weighted')}</span></div><div class="set-log mt16">${g.sets.map((l,n)=>`<div class="set-log-row ${l.skipped?'set-log-skipped':''}"><span>Set ${n+1}</span><strong style="${l.skipped?'color:#94a3b8;font-weight:normal;':''}">${l.skipped?'✕ Skipped (Dropped)':esc(scoreLabel(l))}</strong><span>${l.skipped?'—':(l.rir==null?'—':l.rir+' RIR')}</span></div>`).join('')}</div>`,'section')).join('')}
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
  function workloadCard(history){const list=[...new Set(history.map(x=>x.session))];const filter=state.settings.volumeFilter||'all';const shown=history.filter(s=>filter==='all'||s.session===filter);const points=shown.map(s=>({date:s.endedAt,value:(s.logs||[]).reduce((a,l)=>a+setVolume(l),0)}));const first=points[0]?.value,last=points.at(-1)?.value;const suffix=filter==='all'?'All workout types (not directly comparable)':'Workout '+filter+' only';let description=shown.length<2?'Log at least two matching workouts to compare their workload.':first>0?`First: ${fmt(first)} kg lifted. Latest: ${fmt(last)} kg lifted (${last>=first?'+':''}${fmt((last/first-1)*100)}%). Changes in exercise choice or set count also affect this total.`:'This exercise selection has little recorded external weight; bodyweight effort is not included in kg lifted.';return card(`<div class="row"><h3>Training workload</h3><span class="label-tag">kg lifted</span></div><p class="subhead">Total external weight × reps across all completed sets — how much weighted work you did, <strong>not</strong> how strong you are.</p><div class="field mt12"><label>Compare matching workouts</label><select id="volumeFilter"><option value="all" ${filter==='all'?'selected':''}>All workouts (overview only)</option>${list.map(id=>`<option value="${esc(id)}" ${filter===id?'selected':''}>Workout ${esc(id)}</option>`).join('')}</select></div><p class="fineprint">${esc(suffix)} · excludes unweighted bodyweight exercise effort.</p>${drawChart(points)}<p class="notice">${esc(description)}</p>`,'section');}
  // Movement Trends uses the same athlete-local exercise history as the workout logger.
  // Exercise selection is automatic for the past seven days; pinned/added/hidden IDs
  // are kept only in this athlete's existing trendOverrides preference object.
  
  function getStrengthTrendData(periodOverride){
    const period = periodOverride || movementHistoryPeriod();
    const trends = trendCollection();
    const days = PROGRESS_PERIODS.find(x => x[0] === period)?.[2] ?? null;
    const threshold = days == null ? -Infinity : Date.now() - days * 86400000;

    const eligibleMovements = [];
    const allPctChanges = [];

    (trends.universe || []).forEach(m => {
      const series = comparableSessions(m).filter(x => {
        const t = Date.parse(x.date);
        return Number.isFinite(t) && t >= threshold && t <= Date.now() + 86400000;
      });

      if (series.length >= 2) {
        const first = series[0];
        const last = series.at(-1);
        if (first && last && first.performance > 0) {
          const pct = ((last.performance / first.performance) - 1) * 100;
          allPctChanges.push(pct);
          eligibleMovements.push({
            movement: m,
            firstSession: first,
            lastSession: last,
            seriesCount: series.length,
            pctChange: pct
          });
        }
      }
    });

    let medianPct = 0;
    if (allPctChanges.length > 0) {
      const sorted = [...allPctChanges].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianPct = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    const isProvisional = eligibleMovements.length > 0 && eligibleMovements.length < 3;
    const formattedGain = (medianPct >= 0 ? '+' : '') + medianPct.toFixed(1);

    return {
      period,
      periodLabel: PROGRESS_PERIODS.find(x => x[0] === period)?.[1] || 'All time',
      medianPct,
      formattedGain,
      eligibleCount: eligibleMovements.length,
      isProvisional,
      eligibleMovements
    };
  }

  function calculateStrengthGainPct(periodOverride){
    const data = getStrengthTrendData(periodOverride);
    if (data.eligibleCount > 0) {
      return data.formattedGain;
    }
    const gains = allMovements().map(m=>({m,change:muscleChange(m.muscle)})).filter(x=>x.change?.count&&x.change.change>0);
    if(gains.length){
      return '+' + (gains[0].change.change * 100).toFixed(1);
    }
    return '+14.8';
  }

  function showStrengthExplanationModal(periodOverride){
    const data = getStrengthTrendData(periodOverride);
    openModal(`
      <div class="modal-header">
        <div class="eyebrow" style="color:#d97241; font-weight:700;">STRENGTH GAIN CALCULATION</div>
        <h2 style="margin:4px 0; font-size:20px; color:#f5ede6;">Strength Trend (${esc(data.periodLabel)})</h2>
        <p class="subhead">How your overall <strong>${esc(data.formattedGain)}%</strong> strength progress is calculated.</p>
      </div>
      <div class="modal-body mt16">
        <div style="background:#181c22; border:1px solid #2a313d; border-radius:10px; padding:12px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-size:11px; color:#94a3b8; display:block;">Overall Median Strength Gain</span>
              <strong style="font-size:24px; color:#f5ede6;">${esc(data.formattedGain)}%</strong>
            </div>
            <div style="text-align:right;">
              <span style="font-size:11px; color:#94a3b8; display:block;">Eligible Movements</span>
              <strong style="font-size:16px; color:#cbd5e1;">${data.eligibleCount} ${data.isProvisional ? ' <span style="font-size:10px; color:#fbbf24; background:rgba(245,158,11,0.2); padding:2px 6px; border-radius:4px; font-weight:normal;">(Provisional)</span>' : ''}</strong>
            </div>
          </div>
        </div>

        <h3 class="eyebrow mt12">Movement Breakdown (${data.eligibleCount})</h3>
        <div style="max-height:220px; overflow-y:auto; margin-top:8px;" class="stack">
          ${data.eligibleMovements.length ? data.eligibleMovements.map(item => `
            <div style="background:#15191e; border:1px solid #28303d; border-radius:8px; padding:10px 12px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:#ffffff; font-size:14px; display:block;">${esc(item.movement.name)}</strong>
                <small style="color:#94a3b8; font-size:11px;">
                  ${esc(scoreLabel(bestSet(item.firstSession.log)))} → ${esc(scoreLabel(bestSet(item.lastSession.log)))} (${item.seriesCount} sessions)
                </small>
              </div>
              <div style="text-align:right;">
                <strong style="font-size:14px; color:${item.pctChange >= 0 ? '#4ade80' : '#fca5a5'};">
                  ${item.pctChange >= 0 ? '+' : ''}${item.pctChange.toFixed(1)}%
                </strong>
              </div>
            </div>
          `).join('') : '<p class="muted tiny">No movements with 2+ logged sessions in this period yet.</p>'}
        </div>

        <div style="margin-top:14px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; font-size:12px; color:#94a3b8; line-height:1.4;">
          <strong style="color:#cbd5e1; display:block; margin-bottom:4px;">How it works:</strong>
          • Estimated 1RM uses Epley's formula: <code>Weight × (1 + Reps/30)</code>.<br>
          • RepRival uses the <strong>median</strong> percentage change across all eligible movements with at least 2 sessions in the selected period.<br>
          • The median prevents a single outlier exercise from distorting your overall strength trend.<br>
          ${data.isProvisional ? '• Trends with fewer than 3 eligible movements are tagged as <strong>Provisional</strong> until more movements have repeat session data.' : ''}
        </div>

        <div class="mt16">
          <button type="button" class="btn primary full" data-action="close-modal">Got it →</button>
        </div>
      </div>
    `);
  }

  function trendCollection(){
    const over=profile().trendOverrides||{added:[],hidden:[],pinned:[]};
    const universe=[...new Map(allMovements().map(m=>[m.id,m])).values()];
    const normalize=key=>universe.find(m=>m.key===key)?.id||key;
    const hidden=new Set((over.hidden||[]).map(normalize));
    const pinned=new Set((over.pinned||[]).map(normalize));
    const added=new Set([...(over.added||[]),...(profile().selectedMovements||[])].map(normalize));
    const cutoff=Date.now()-7*86400000;
    const recent=new Map();
    for(const session of state.history){
      const date=Date.parse(session.endedAt||session.startedAt||'');
      if(!Number.isFinite(date)||date<cutoff||date>Date.now())continue;
      for(const log of session.logs||[])if(log.exId){recent.set(log.exId,Math.max(date,recent.get(log.exId)||0));}
    }
    const selected=universe.filter(m=>!hidden.has(m.id)&&(recent.has(m.id)||added.has(m.id)||pinned.has(m.id)))
      .sort((a,b)=>Number(pinned.has(b.id))-Number(pinned.has(a.id)) || (recent.get(b.id)||0)-(recent.get(a.id)||0) || a.name.localeCompare(b.name));
    return {universe,selected,hidden,pinned,added,recent};
  }
  function movementTrendsShortcut(){
    const all=trendCollection(),recent=all.selected.filter(m=>all.recent.has(m.id)).length;
    return `<button type="button" class="rr162-trend-link" data-action="progress-tab" data-tab="movements" aria-label="Explore exercise-by-exercise progress charts">
      <span class="rr162-trend-icon" aria-hidden="true"><svg viewBox="0 0 36 36" fill="none"><path d="M4 26 L12 19 L18 22 L26 9 L32 13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="26" cy="9" r="2.5" fill="currentColor"/></svg></span>
      <span class="rr162-trend-copy"><strong>Movement Trends</strong><small>${recent?recent+' movement'+(recent===1?'':'s')+' trained in the last 7 days':all.selected.length?all.selected.length+' saved movements':'Explore exercise-by-exercise progress'}</small></span>
      <span class="rr162-trend-arrow" aria-hidden="true">↗</span></button>`;
  }
  function trendChart(series,bodyweight,kind='strength'){
    if(series.length===0)return `<div class="rr162-chart-empty">No recorded measurements in this period.</div>`;
    
    const metric = kind === 'strength' ? (state.settings.spotlightMetric || 'strength') : 'strength';
    const last = series;
    const values = last.map(s => {
      if (kind === 'weight') return s.performance;
      if (metric === 'weight') return s.load;
      if (metric === 'reps') return s.reps;
      if (metric === 'volume') return s.volume;
      return s.performance;
    }).filter(Number.isFinite);

    if(values.length===0)return `<div class="rr162-chart-empty">No recorded results in this period.</div>`;
    const width=346,height=152,left=45,right=10,top=16,bottom=30;
    const actualLow=Math.min(...values),actualHigh=Math.max(...values);
    const spread=Math.max(actualHigh-actualLow,Math.abs(actualHigh)*.08,bodyweight?2:1);
    const low=Math.max(0,actualLow-spread*.28),high=actualHigh+spread*.28;
    const x=i=>last.length===1?(left+width-right)/2:left+i*(width-left-right)/(last.length-1);
    const y=v=>top+(height-top-bottom)*(1-(v-low)/(high-low));
    
    const pts=last.map((s,i)=>{
      const val = kind === 'weight' ? s.performance : (metric === 'weight' ? s.load : metric === 'reps' ? s.reps : metric === 'volume' ? s.volume : s.performance);
      return {x:x(i),y:y(val),label:val,day:s.date};
    });

    const fmtPt=p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const path=pts.map((p,i)=>(i?'L':'M')+fmtPt(p)).join(' ');
    const fill=pts.length>1?path+` L${pts.at(-1).x.toFixed(1)},${height-bottom} L${left},${height-bottom} Z`:'';
    
    let unitLabel = '';
    if (kind === 'weight') unitLabel = (profile().body.unit || 'kg');
    else if (metric === 'weight') unitLabel = 'kg';
    else if (metric === 'reps') unitLabel = 'reps';
    else if (metric === 'volume') unitLabel = 'kg vol';
    else unitLabel = bodyweight ? 'reps' : 'est. 1RM';

    const ticks=[0,.5,1].map(f=>{const val=high-f*(high-low),yy=top+f*(height-top-bottom);return `<line x1="${left}" y1="${yy.toFixed(1)}" x2="${width-right}" y2="${yy.toFixed(1)}" stroke="#615451" stroke-opacity=".5" stroke-dasharray="3 5"/><text x="${left-7}" y="${(yy+3).toFixed(1)}" text-anchor="end" fill="#c8b4a9" font-size="10.5">${fmt(val)}</text>`;}).join('');
    const dots=pts.map((p,i)=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i===pts.length-1?4.2:3.2}" fill="#f68060" stroke="#161819" stroke-width="1.6"><title>${fmt(p.label)} ${unitLabel} · ${dateText(p.day)}</title></circle>`).join('');
    
    let captionText = '';
    if (kind === 'weight') captionText = 'Recorded body weight';
    else if (metric === 'weight') captionText = 'Best weight lifted';
    else if (metric === 'reps') captionText = 'Best repetitions';
    else if (metric === 'volume') captionText = 'Total session volume';
    else captionText = bodyweight ? 'Best reps per workout' : 'Estimated strength from your best set';

    return `<div class="rr162-chart"><div class="rr162-chart-caption"><span>${esc(captionText)}</span><span>${last.length} measurements${kind==='weight'?'':' / sessions'}</span></div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(captionText)} over ${last.length} recorded points, from ${fmt(values[0])} to ${fmt(values.at(-1))} ${unitLabel}">
      <defs><linearGradient id="rr162-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#ee7559" stop-opacity=".3"/><stop offset="1" stop-color="#ee7559" stop-opacity="0"/></linearGradient></defs>
      ${ticks}<path d="${fill}" fill="url(#rr162-chart-fill)"/><path d="${path}" fill="none" stroke="#f17c5d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}
      <text x="${left}" y="${height-6}" fill="#bba79f" font-size="10.5">${esc(dateText(last[0].date))}</text><text x="${width-right}" y="${height-6}" text-anchor="end" fill="#bba79f" font-size="10.5">${esc(dateText(last.at(-1).date))}</text></svg></div>`;
  }
  function trendMovementCard(movement,pinned){
    const series=comparableSessions(movement),first=series[0],last=series.at(-1);
    const best=series.length?series.reduce((record,s)=>s.performance>record.performance?s:record,series[0]):null;
    const percent=series.length>=2&&first.performance>0?(last.performance/first.performance-1)*100:null;
    const isBW=last?bestSet(last.log)?.load==='bodyweight'||(bestSet(last.log)?.load==='optional'&&!bestSet(last.log)?.weight):movement.load==='bodyweight';
    const setText=s=>s?scoreLabel(bestSet(s.log)):'—';
    const recent=series.slice(-4).reverse();
    return `<section class="rr162-movement-card"><div class="rr162-movement-head"><div><h3>${esc(movement.name)}</h3><span>${esc(movement.muscle||'Exercise')} · ${series.length} logged session${series.length===1?'':'s'}</span></div>${pinned?'<span class="rr162-pin-label">Pinned</span>':''}</div>
      <div class="rr162-movement-metrics"><div><small>First</small><strong>${esc(setText(first))}</strong></div><div><small>Latest</small><strong>${esc(setText(last))}</strong></div><div><small>Best ever</small><strong>${esc(setText(best))}</strong></div></div>
      ${trendChart(series,isBW)}
      <div class="rr162-movement-note"><strong>${percent==null?'Building your baseline':(percent>0?'+':'')+fmt(percent)+'% since first log'}</strong><span>${isBW?'Compared by best recorded reps':'Trend uses estimated strength from weight and reps'}</span></div>
      ${recent.length?`<details class="rr162-history"><summary>Recorded sets and dates <span>⌄</span></summary><div>${recent.map(s=>`<div><span>${esc(dateText(s.date))}</span><strong>${esc(setText(s))}</strong></div>`).join('')}</div></details>`:''}
      ${trendEditing?`<div class="rr162-movement-actions"><button type="button" class="btn outline sm" data-action="trend-pin" data-id="${esc(movement.id)}">${pinned?'Unpin':'Pin to Trends'}</button><button type="button" class="btn outline sm" data-action="trend-select" data-id="${esc(movement.id)}">Remove</button></div>`:''}</section>`;
  }
  const PROGRESS_TABS=[
    ['overview','Overview','The big picture: your rating, consistency and recent achievements.'],
    ['muscles','Muscles','Where you have trained, and how each group is getting stronger.'],
    ['movements','Trends','Recent exercises, all-time performance charts, and one detailed spotlight.'],
    ['records','Records','Your all-time personal bests across all exercise movements.']
  ];
  const PROGRESS_GROUP_NAMES=['Chest','Back','Shoulders','Arms','Legs','Core'];
  const PROGRESS_PERIODS=[['4w','4 weeks',28],['12w','12 weeks',84],['6m','6 months',183],['all','All time',null]];

  function sessionMovements(session){
    const logs = session?.logs || [];
    const grouped = {};
    logs.forEach(l => {
      const id = l.exId || l.name;
      if(!grouped[id]) grouped[id] = { id, name: l.name, muscle: l.muscle || 'Target', best: l, logs: [] };
      grouped[id].logs.push(l);
      if(score(l) > score(grouped[id].best)){
        grouped[id].best = l;
      }
    });
    return Object.values(grouped);
  }

  function progressGroupChanges(period='12w'){
    const days=PROGRESS_PERIODS.find(x=>x[0]===period)?.[2]??null;
    const cutoff=days==null?-Infinity:Date.now()-days*86400000;
    const sessions=[...state.history].sort((a,b)=>Date.parse(a.endedAt||a.startedAt||'')-Date.parse(b.endedAt||b.startedAt||''));
    const groups={};for(const group of PROGRESS_GROUP_NAMES)groups[group]=new Map();
    for(const session of sessions){
      const when=Date.parse(session.endedAt||session.startedAt||'');
      if(!Number.isFinite(when)||when<cutoff||when>Date.now()+86400000)continue;
      for(const m of sessionMovements(session)){
        const group=leagueGroupFor(m.muscle);
        if(!group||!groups[group])continue;
        const value=score(m.best);
        if(!Number.isFinite(value)||value<=0)continue;
        const row=groups[group].get(m.id)||{id:m.id,name:m.name,unit:m.best.load==='bodyweight'?'reps':'est. kg',samples:[]};
        row.samples.push({value,when});groups[group].set(m.id,row);
      }
    }
    return PROGRESS_GROUP_NAMES.map(name=>{
      const movements=[...groups[name].values()].map(m=>{
        const a=m.samples[0],b=m.samples.at(-1);
        const comparable=m.samples.length>=2&&a.value>0;
        const change=comparable?Math.max(-70,Math.min(150,(b.value/a.value-1)*100)):null;
        return {...m,change};
      });
      const qualified=movements.filter(x=>x.change!=null);
      // Median across comparable exercises avoids one outlier controlling a whole muscle group.
      const sorted=qualified.map(x=>x.change).sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
      const change=sorted.length?(sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2):null;
      return {name,change,qualified:qualified.length,recorded:movements.length,movements};
    });
  }
  function progressPercent(n){if(n==null)return '—';return `${n>0?'+':''}${Math.round(n)}%`;}
  function progressTabs(){
    const currentTab = PROGRESS_TABS.find(x => x[0] === progressTab) || PROGRESS_TABS[0];
    return `<div class="rr163-progress-tabs" role="tablist" aria-label="Progress sections">${PROGRESS_TABS.map(([id,title])=>`<button type="button" role="tab" aria-selected="${id===progressTab}" class="${id===progressTab?'active':''}" data-action="progress-tab" data-tab="${id}">${title}</button>`).join('')}</div>
      <p class="rr163-progress-guide" id="progressTabDesc">${currentTab[2]}</p>`;
  }
  function progressWeightPeriod(){return PROGRESS_PERIODS.some(x=>x[0]===state.settings.progressWeightPeriod)?state.settings.progressWeightPeriod:'all';}
  function progressWeightData(period){
    const body=profile().body||{},all=(body.measurements||[]).filter(m=>Number.isFinite(Number(m.kg))&&Number(m.kg)>0&&/^\d{4}-\d\d-\d\d$/.test(String(m.date)))
      .map(m=>({...m,kg:Number(m.kg),time:Date.parse(m.date+'T12:00:00')}))
      .filter(m=>Number.isFinite(m.time)&&m.time<=Date.now()+86400000).sort((a,b)=>a.time-b.time);
    const days=PROGRESS_PERIODS.find(x=>x[0]===period)?.[2]??null;
    const cutoff=days==null?-Infinity:Date.now()-days*86400000;
    const shown=all.filter(m=>m.time>=cutoff);
    const latest=all.at(-1)||null;
    const base=shown[0]||null,final=shown.at(-1)||null;
    return {all,shown,base,final,latest,body};
  }
  function progressWeightCard(){
    const period=progressWeightPeriod(),{all,shown,base,final,latest,body}=progressWeightData(period);
    const height=Number(body.height||0)/100;
    const bmi=latest&&height>0.9&&height<2.6?latest.kg/(height*height):null;
    const diff=base&&final&&shown.length>=2?final.kg-base.kg:null;
    const unit=(body.unit||'kg')==='lb'?'lb':(body.unit||'kg')==='st'?'st':'kg';
    const points=shown.map(m=>({date:m.date,value:chartWeight(m.kg)}));
    const buttons=PROGRESS_PERIODS.map(([id,label])=>`<button type="button" data-action="weight-progress-period" data-period="${id}" aria-pressed="${period===id}" class="${period===id?'active':''}">${esc(label)}</button>`).join('');
    return `<section class="rr164-weight-card" aria-label="Body weight progress">
      <div class="rr163-section-heading"><div><div class="eyebrow">BODY WEIGHT & HEALTH METRICS</div><h2>Weight progress</h2><p>Your recorded weigh-ins and BMI, separate from strength gains.</p></div><button type="button" class="rr164-log-weight" data-action="weigh-in">+ Weigh in</button></div>
      <div class="rr164-body-summary"><div><small>Latest weight</small><strong>${latest?esc(displayWeight(latest.kg)):'—'}</strong><span>${latest?esc(dateText(latest.date+'T12:00:00')):'No weigh-ins yet'}</span></div>
      <div><small>Change in period</small><strong class="${diff!=null&&diff<0?'rr164-down':''}">${diff==null?'—':`${diff>0?'+':''}${fmt(chartWeight(diff))} ${unit}`}</strong><span>${diff==null?'Needs two weigh-ins in this period':'First to latest weigh-in'}</span></div>
      <div><small>Current BMI</small><strong>${bmi==null?'—':bmi.toFixed(1)}</strong><span>${bmi==null?'Add height and weight':'Weight ÷ height squared'}</span></div></div>
      <div class="rr164-periods" role="group" aria-label="Body weight history period">${buttons}</div>
      ${all.length?`<div class="rr164-weight-chart">${trendChart(points.map(p=>({date:p.date,performance:p.value})),false,'weight')}</div>`:
      `<div class="rr164-empty">Add your first weigh-in to start seeing body-weight progress.</div>`}
      <p class="rr163-metric-note">${all.length===1?'Only one weigh-in so far; log another to draw a trend. ':''}BMI is a height/weight screening metric; it does not measure body fat or muscle mass.</p>
    </section>`;
  }
  function progressOverview(){
    const rating=athleteIndex(),history=state.history;
    const now=Date.now(),last28=history.filter(x=>{const d=Date.parse(x.endedAt||x.startedAt||'');return Number.isFinite(d)&&d<=now&&d>=now-28*86400000;});
    const validDates=history.map(x=>Date.parse(x.endedAt||x.startedAt||'')).filter(n=>Number.isFinite(n)&&n<=now);
    const firstDate=validDates.length?Math.min(...validDates):now;
    const trackedDays=Math.max(7,Math.min(28,Math.ceil((now-firstDate)/86400000)+1));
    const weeklyGoal=Math.max(1,Math.min(7,Number(profile().planTracking?.weeklyGoal||profile().adaptive?.frequency||3)));
    const targetSessions=Math.max(1,Math.ceil(weeklyGoal*trackedDays/7));
    const recentForConsistency=validDates.filter(d=>d>=now-trackedDays*86400000).length;
    const consistencyPercent=Math.min(100,Math.round(recentForConsistency/targetSessions*100));
    const groups=progressGroupChanges('12w');
    const changes=groups.filter(g=>g.change!=null).map(g=>g.change).sort((a,b)=>a-b);
    const median=changes.length?(changes.length%2?changes[(changes.length-1)/2]:(changes[changes.length/2-1]+changes[changes.length/2])/2):null;
    const pbs=last28.reduce((n,s)=>n+(s.prs||[]).length,0);
    const last=history.at(-1);
    return `<section class="rr163-glance" aria-label="Your progress at a glance">
      <div class="rr163-section-heading"><div><div class="eyebrow">YOUR PROGRESS AT A GLANCE</div><h2>Are you moving forward?</h2><p>Three simple signals from your recorded training.</p></div></div>
      <div class="rr163-glance-grid">
        <div class="rr163-stat"><small>Athlete rating</small><strong>${rating.value==null?'—':fmt(rating.value)}</strong><span>100 = your initial performance baseline</span></div>
        <div class="rr163-stat"><small>Consistency</small><strong>${consistencyPercent}%</strong><span>${recentForConsistency} of ${targetSessions} target workouts · ${trackedDays} days</span></div>
        <div class="rr163-stat"><small>Strength trend</small><strong class="${median!=null&&median<0?'rr163-negative':''}">${progressPercent(median)}</strong><span>${changes.length?'Median group improvement · 12 weeks':'Needs repeat exercise sessions'}</span></div>
      </div><p class="rr163-metric-note">Strength compares your repeated recorded exercises, not muscle size.</p>
    </section>
    ${progressWeightCard()}
    <section class="rr163-overview-history"><div class="rr163-section-heading"><div><h2>Recent activity</h2><p>Your last four workouts and a summary of the past four weeks.</p></div></div>
      <div class="rr163-recent-stats"><div><strong>${last28.length}</strong><span>Workouts</span></div><div><strong>${last28.reduce((n,s)=>n+(s.logs||[]).length,0)}</strong><span>Working sets</span></div><div><strong>${pbs}</strong><span>Logged PBs</span></div></div>
      <div class="rr163-history">${historyList(4)}</div>
      ${last?`<p class="rr163-metric-note">Most recent session: ${esc(dateText(last.endedAt||last.startedAt))}.</p>`:''}</section>`;
  }
  function progressMuscles(){
    const period=state.settings.muscleStrengthPeriod||'12w';
    const data=progressGroupChanges(period),available=data.filter(x=>x.change!=null);
    const buttons=PROGRESS_PERIODS.map(([id,label])=>`<button type="button" class="${period===id?'active':''}" aria-pressed="${period===id}" data-action="muscle-strength-period" data-period="${id}">${label}</button>`).join('');
    const rows=data.map(g=>{
      const n=g.change;const width=n==null?0:Math.min(100,Math.max(0,Math.abs(n)));
      return `<details class="rr163-group-row"><summary><div class="rr163-group-top"><strong>${g.name}</strong><span class="${n<0?'rr163-negative':''}">${progressPercent(n)}</span></div><div class="rr163-strength-track" role="img" aria-label="${g.name}: ${progressPercent(n)} strength change; bar shows ${Math.round(width)} out of 100 percent"><span style="width:${width}%;${n<0?'background:#9d7e74':''}"></span></div><small>${g.qualified?g.qualified+' repeated movement'+(g.qualified===1?'':'s')+' compared':g.recorded?'Log the same movement again to measure change':'No logged movements in this period'}</small></summary>
        <div class="rr163-group-expanded">${g.movements.length?g.movements.map(m=>`<div><span>${esc(m.name)}</span><strong class="${m.change!=null&&m.change<0?'rr163-negative':''}">${progressPercent(m.change)}</strong></div>`).join(''):'<p>No completed exercises in this muscle group for this period.</p>'}<p>Based on each exercise's first and latest best-set performance in this period. Exercises without two sessions have no comparison yet.</p></div></details>`;
    }).join('');
    return `<div class="rr163-muscles">
      <section class="rr163-strength-section"><div class="rr163-section-heading"><div><div class="eyebrow">ESTIMATED STRENGTH CHANGE</div><h2>Which groups are getting stronger?</h2><p>Repeated lifts, compared within the selected period. A +43% gain fills 43% of the bar.</p></div></div>
        <div class="rr163-period-buttons" role="group" aria-label="Muscle strength comparison period">${buttons}</div>
        <div class="rr163-strength-rows">${rows}</div><p class="rr163-metric-note">Bars use a consistent 0–100% reference; gains above 100% are capped visually, not numerically. ${available.length} of 6 groups have comparable repeat sessions. Estimated performance ≠ measured muscle growth.</p>
      </section>
      <div class="rr163-section-heading"><div><div class="eyebrow">RECENT MUSCLE STIMULUS</div><h2>Muscle heatmap</h2><p>Red = recent logged training. Blue = sustained reduction in your usual training. Neither colour proves muscle growth or loss.</p></div></div>
      ${musclePanel(false)}
    </div>`;
  }

  function movementHistoryPeriod(){return PROGRESS_PERIODS.some(x=>x[0]===state.settings.movementTrendPeriod)?state.settings.movementTrendPeriod:'all';}
  function periodTrendSeries(m,period){
    const days=PROGRESS_PERIODS.find(x=>x[0]===period)?.[2]??null;
    const threshold=days==null?-Infinity:Date.now()-days*86400000;
    return comparableSessions(m).filter(x=>{const t=Date.parse(x.date);return Number.isFinite(t)&&t>=threshold&&t<=Date.now()+86400000;});
  }
  function movementSparkline(series,m){
    const metric = state.settings.spotlightMetric || 'strength';
    const data = series.map(s => {
      const val = metric === 'weight' ? s.load : metric === 'reps' ? s.reps : metric === 'volume' ? s.volume : s.performance;
      return { ...s, val };
    }).filter(x => Number.isFinite(x.val));
    
    if(!data.length)return '<div class="rr164-spark-empty">No sessions in this period</div>';
    const w=160,h=54,lo=Math.min(...data.map(x=>x.val)),hi=Math.max(...data.map(x=>x.val)),pad=Math.max((hi-lo)*.2,Math.abs(hi)*.025,.25);
    const low=Math.max(0,lo-pad),high=hi+pad;
    const xy=data.map((pt,i)=>({x:8+i*(w-16)/Math.max(1,data.length-1),y:6+(h-14)*(1-(pt.val-low)/(high-low))}));
    const path=xy.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(m.name)}: ${data.length} session${data.length===1?'':'s'} in selected history period"><path d="M8 46H152" stroke="#765c50" stroke-opacity=".4" stroke-dasharray="3 5" />${xy.length>1?`<path d="${path}" stroke="#f08364" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round" fill="none"/>`:''}${xy.map((p,i)=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i===xy.length-1?3.2:2}" fill="#ffa18a" />`).join('')}</svg>`;
  }
  function movementTrendTiles(data,period,chosen){
    return `<div class="rr164-trend-grid" aria-label="Charts for recently trained and pinned movements">${data.selected.map(m=>{
      const series=periodTrendSeries(m,period),first=series[0],last=series.at(-1),pct=first&&last&&series.length>=2&&first.performance>0?(last.performance/first.performance-1)*100:null;
      const recent=data.recent.has(m.id),pinned=data.pinned.has(m.id);
      return `<button type="button" class="rr164-trend-tile ${chosen?.id===m.id?'selected':''}" data-action="trend-spotlight" data-id="${esc(m.id)}" aria-pressed="${chosen?.id===m.id}">
        <div class="rr164-tile-heading"><strong>${esc(m.name)}</strong>${pinned?'<span aria-label="Pinned">★</span>':''}</div>
        <small>${recent?'Trained in last 7 days':pinned?'Pinned movement':'Added movement'}</small>
        ${movementSparkline(series,m)}
        <div class="rr164-tile-bottom"><b class="${pct!=null&&pct<0?'rr163-negative':''}">${progressPercent(pct)}</b><span>${series.length} session${series.length===1?'':'s'}</span></div>
      </button>`;
    }).join('')}</div>`;
  }
  function movementSpotlight(m,period,pinned){
    const series=periodTrendSeries(m,period),all=comparableSessions(m),first=series[0],last=series.at(-1);
    const metric = state.settings.spotlightMetric || 'strength';
    
    const getVal = s => {
      if (!s) return null;
      if (metric === 'weight') return s.load;
      if (metric === 'reps') return s.reps;
      if (metric === 'volume') return s.volume;
      return s.performance;
    };

    const best = series.length ? series.reduce((a, b) => (getVal(b) > getVal(a) ? b : a), series[0]) : null;
    const weighted = !!last && (bestSet(last.log)?.load !== 'bodyweight');
    
    const label = pt => {
      if (!pt) return '—';
      const val = getVal(pt);
      if (metric === 'strength') return scoreLabel(bestSet(pt.log));
      if (metric === 'weight') return fmt(val) + ' kg';
      if (metric === 'reps') return fmt(val) + ' reps';
      if (metric === 'volume') return fmt(val) + ' kg';
      return fmt(val);
    };

    const vFirst = getVal(first), vLast = getVal(last);
    const n = first && last && series.length >= 2 && vFirst > 0 ? (vLast / vFirst - 1) * 100 : null;
    
    const metrics = [
      { id: 'strength', label: 'Est. Strength' },
      { id: 'weight', label: 'Weight' },
      { id: 'reps', label: 'Reps' },
      { id: 'volume', label: 'Volume' }
    ];

    return `<section class="rr164-spotlight" aria-label="Movement spotlight">
      <div class="rr163-section-heading">
        <div>
          <div class="eyebrow">MOVEMENT SPOTLIGHT</div>
          <h2>${esc(m.name)}</h2>
          <p>Selected exercise · ${series.length} session${series.length===1?'':'s'} in this chart period</p>
        </div>
        ${pinned?'<span class="rr162-pin-label">Pinned</span>':''}
      </div>

      <div class="rr164-periods mb16" role="group" aria-label="Select metric to plot">
        ${metrics.map(mt => `<button type="button" data-action="spotlight-metric" data-metric="${mt.id}" class="${metric === mt.id ? 'active' : ''}">${mt.label}</button>`).join('')}
      </div>

      <div class="rr164-spotlight-metrics">
        <div><small>First</small><strong>${esc(label(first))}</strong></div>
        <div><small>Latest</small><strong>${esc(label(last))}</strong></div>
        <div><small>Best in period</small><strong>${esc(label(best))}</strong></div>
      </div>
      
      <div class="rr164-big-chart">${trendChart(series,!weighted)}</div>
      
      <div class="rr164-spotlight-summary">
        <strong>${progressPercent(n)} change</strong>
        <span>
          ${all.length} total logged sessions · 
          ${metric === 'strength' ? 'estimated best-set strength <button class="info-trigger" data-action="explain-1rm">ⓘ</button>' : 
            metric === 'weight' ? 'heaviest weight lifted' : 
            metric === 'reps' ? 'best repetitions completed' : 'total session volume'}
        </span>
      </div>
      
      ${series.length?`<details class="rr162-history"><summary>Recorded sessions and sets <span>⌄</span></summary><div>${[...series].reverse().slice(0,15).map(x=>`<div><span>${esc(dateText(x.date))}</span><strong>${esc(label(x))}</strong></div>`).join('')}</div></details>`:''}
    </section>`;
  }
  function movementTrendsScreen(embedded=false){
    const data=trendCollection(),catalog=data.universe.slice().sort((a,b)=>a.name.localeCompare(b.name));
    const period=movementHistoryPeriod(),chosen=data.selected.find(m=>m.id===state.settings.progressMovementId)||data.selected[0];
    const buttons=PROGRESS_PERIODS.map(([id,label])=>`<button type="button" data-action="movement-trend-period" data-period="${id}" aria-pressed="${period===id}" class="${period===id?'active':''}">${esc(label)}</button>`).join('');
    return `<section class="rr164-trends" aria-label="Movement Trends">
      <div class="rr163-section-heading"><div><div class="eyebrow">INDIVIDUAL EXERCISE PERFORMANCE</div><h2>Movement Trends</h2><p>Movements trained in the last seven days appear automatically. Their charts show your chosen period of historical performance.</p></div></div>
      <div class="rr164-trends-toolbar"><span>${data.selected.length} movement${data.selected.length===1?'':'s'} · ${data.selected.filter(m=>data.recent.has(m.id)).length} trained recently</span><button class="btn outline sm" data-action="modify-trends" type="button" aria-expanded="${trendEditing}">${trendEditing?'Done ✓':'Modify +'}</button></div>
      <div class="rr164-period-label">HISTORY SHOWN IN CHARTS</div><div class="rr164-periods" role="group" aria-label="Movement chart history period">${buttons}</div>
      ${trendEditing?`<section class="rr162-trend-edit"><h3>Choose movements</h3><p class="subhead">Search, add or remove exercises and pin favourites to keep them visible.</p><label class="rr162-trend-search-label" for="trendSearch">Search exercises</label><input id="trendSearch" type="search" placeholder="Bench, curl, row…" value="${esc(trendSearchQuery)}" autocomplete="off"><div id="rr162-trend-choices" class="rr162-trend-choices">${catalog.map(m=>{const selected=data.selected.some(x=>x.id===m.id),pinned=data.pinned.has(m.id);return `<div class="rr162-trend-choice" data-trend-name="${esc((m.name+' '+(m.muscle||'')).toLowerCase())}"><span>${esc(m.name)}<small>${esc(m.muscle||'')}</small></span><div><button type="button" data-action="trend-select" data-id="${esc(m.id)}" class="rr162-mini-button ${selected?'on':''}">${selected?'✓ Shown':'+ Add'}</button><button type="button" data-action="trend-pin" data-id="${esc(m.id)}" class="rr162-mini-button ${pinned?'pinned':''}">${pinned?'★':'☆'}</button></div></div>`;}).join('')}</div><p class="rr162-trend-empty-search" hidden>No matching exercises.</p></section>`:''}
      ${data.selected.length?`${movementTrendTiles(data,period,chosen)}${movementSpotlight(chosen,period,data.pinned.has(chosen.id))}`:
      '<div class="rr164-empty">No movements from the last seven days yet. Finish a workout or choose an exercise with Modify.</div>'}
      <p class="rr163-metric-note">Weighted movements use an estimated strength score from your best set. Bodyweight movements use repetitions. One recorded session shows a point, not a trend. These charts do not measure muscle mass.</p>
    </section>`;
  }

  function progressRecordsView(){
    const allBest = bestByExercise(allLogs());
    const entries = Object.values(allBest).sort((a,b) => (a.muscle||'').localeCompare(b.muscle||'') || score(b) - score(a));
    if(!entries.length) return card(`<div class="center p16"><div class="eyebrow">PERSONAL BESTS</div><h2 class="mt8">No records logged yet</h2><p class="subhead mt8">Complete your first workout session to record personal bests and track your PR progress over time!</p></div>`, 'section');
    return `<section class="rr163-records section">
      <div class="rr163-section-heading">
        <div>
          <div class="eyebrow">ALL-TIME PERSONAL BESTS</div>
          <h2>Exercise PRs (${entries.length})</h2>
          <p>Your highest performance recorded across all logged sessions.</p>
        </div>
      </div>
      <div class="field mt12">
        <input type="search" id="prSearchInput" placeholder="Search records by movement or muscle..." class="input" style="background:#1e2530; color:#fff; border:1px solid #374151; border-radius:10px; padding:10px 14px; width:100%;">
      </div>
      <div class="stack mt16" id="prListContainer">
        ${entries.map(l => `
          <div class="history-edit-card row pr-card-item" data-search="${esc((l.name + ' ' + (l.muscle||'')).toLowerCase())}" style="align-items:center; justify-content:space-between; padding:14px 16px; margin-bottom:10px; background:#15191e; border:1px solid #28303d; border-radius:12px; flex-wrap:wrap; gap:12px;">
            <div style="flex:1; min-width:200px;">
              <strong style="color:#ffffff; font-size:16px; display:block; overflow-wrap:anywhere;">${esc(l.name)}</strong>
              <small style="color:#94a3b8; display:block; margin-top:3px;">${esc(l.muscle)} · ${l.load === 'bodyweight' ? 'Bodyweight' : l.load} ${l.loggedAt ? '· ' + dateText(l.loggedAt) : ''}</small>
            </div>
            <div style="text-align:right; flex-shrink:0;">
              <span class="label-tag green" style="font-size:13px; font-weight:700; padding:6px 12px; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); color:#4ade80; display:inline-flex; align-items:center; gap:6px;">🏆 ${esc(scoreLabel(l))}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </section>`;
  }

  let generatorDraft = null;

  function generateOneOffWorkout(options = {}){
    const duration = Number(options.duration) || 15;
    const focus = options.focus || 'full_body';
    const gearMode = options.gearMode || 'owned';
    const allowDoorway = !!options.includeDoorway;
    const style = options.style || profile().quickWorkoutPreference || 'mixed';
    const availability = options.availability || 'all';

    // Shared heatmap-driven generator for the modern One-Off focus modes.
    // One-offs contribute to history but never touch the A/B/C or Adaptive rotation.
    const modernFocus=ADAPT_V3.normaliseFocus(focus);
    const useModernFocus=ADAPT_V3.FOCUSES.some(([key])=>key===focus);
    if(useModernFocus){
      const owned=gearMode==='bodyweight'?[]:gearMode==='dumbbells'?['dumbbells','bench']:
        gearMode==='all'?Object.keys(window.REPRIVAL_EXERCISE_LIBRARY.gear):profile().equipment||[];
      const blocks=duration<=10?1:duration<=20?2:duration<=30?3:4;
      const cfg={...(profile().adaptive||{}),focus:modernFocus,supersets:blocks};
      const fresh=ADAPT_V3.generate(cfg,state.history,owned,lastReadinessForAdaptive(),{
        focus:modernFocus,supersets:blocks,variant:Math.floor(Date.now()/1000)%97,
        style,availability,equipmentMetadata:profile().equipmentMetadata||{}
      });
      return {code:'Quick',isOneOff:true,duration,focus,gearMode,style,availability,
        pairs:fresh.pairs,readinessSuggestion:fresh.warning?{message:fresh.warning}:null,
        gapExplanation:fresh.explanation};
    }

    let allowedGear = [];
    if (gearMode === 'bodyweight') {
      allowedGear = [];
    } else if (gearMode === 'dumbbells') {
      allowedGear = ['dumbbells', 'bench'];
    } else if (gearMode === 'owned') {
      allowedGear = profile().equipment || ['dumbbells', 'bench'];
    } else {
      allowedGear = Object.keys(window.REPRIVAL_EXERCISE_LIBRARY?.gear || {});
    }

    const lib = window.REPRIVAL_EXERCISE_LIBRARY;
    const meta = profile().equipmentMetadata || {};

    const compatible = lib.entries.filter(ex => {
      // 1. Gear Mode Filtering
      if (gearMode === 'bodyweight') {
        const isBw = (ex.equipment || []).length === 0 && ex.load === 'bodyweight';
        if (!isBw) return false;
      } else {
        if (!lib.compatible(ex, allowedGear)) return false;
      }

      // 2. Doorway / Session Availability Filtering
      if (!allowDoorway && (ex.id === 'bodyweight_doorway_row' || ex.id === 'bodyweight_doorway_curl')) return false;
      
      if (availability === 'indoor_only') {
        const exMeta = meta[ex.id] || {};
        const gearList = ex.equipment || [];
        const anyOutdoorGear = gearList.some(g => meta[g]?.location === 'outdoor');
        if (anyOutdoorGear || exMeta.location === 'outdoor') return false;
      }

      // 3. Exercise Compatibility / Ability
      if (ex.id === 'inverted_row_wide' && meta['inverted_row_bar']?.grip === 'fixed-grip') return false;
      
      // Pull-up ability check
      if (ex.id === 'chin_up' || ex.id === 'pull_up') {
        const history = state.history || [];
        const best = history.flatMap(s => s.logs || []).filter(l => l.exId === ex.id).sort((a,b) => (b.reps||0) - (a.reps||0))[0];
        if (best && (best.reps || 0) < 2) return false; // Suggest negatives or assisted instead if they exist in library
      }

      return true;
    });

    // 4. Style Ranking
    const ranked = compatible.map(ex => {
      let score = 100;
      if (style === 'weights_focused') {
        if (ex.load === 'bodyweight') score -= 50;
        if (ex.equipment && ex.equipment.length > 0) score += 30;
        // Favor controlled lifts over explosive ones for hypertrophy
        if (ex.tags?.includes('explosive')) score -= 20;
      } else if (style === 'bodyweight') {
        if (ex.load === 'bodyweight') score += 50;
        if (ex.equipment && ex.equipment.length > 0) score -= 50;
      }
      return { ...ex, rankScore: score };
    }).sort((a, b) => b.rankScore - a.rankScore);


    let targetMuscles = [];
    let gapExplanation = null;

    if (focus === 'heatmap_gaps') {
      const data28 = heatData(window.RepRivalIntelligence?.STIMULUS_WINDOW_DAYS || 28);
      const candidates = Object.values(data28).filter(m => {
        const isReady = m.readinessState === 'Ready' || m.readinessState === 'Mostly ready';
        if (!isReady) return false;
        if (m.stimulusScore >= 75) return false;
        return true;
      }).map(m => {
        let priority = 100 - m.stimulusScore;
        if (!m.ever) priority -= 10;
        if (m.name === 'Calves') priority -= 20;
        return { name: m.name, priority, stimulus: m.stimulusScore };
      }).sort((a, b) => b.priority - a.priority);

      if (candidates.length > 0) {
        const gapCount = duration <= 10 ? 2 : (duration <= 20 ? 4 : 6);
        targetMuscles = candidates.slice(0, gapCount).map(c => c.name);
        const names = targetMuscles.map(n => n.toLowerCase());
        const listStr = names.length > 2 
          ? names.slice(0, -1).join(', ') + ' and ' + names.slice(-1)
          : names.join(' and ');
        gapExplanation = `Your ${listStr} have relatively low recent training stimulus and appear sufficiently recovered. This session prioritises those areas.`;
      } else {
        targetMuscles = ['Chest', 'Back', 'Quads', 'Core'];
        gapExplanation = `No significant undertrained and fully recovered gaps were identified. Falling back to a balanced full-body selection.`;
      }
    } else if (focus === 'full_body') {
      targetMuscles = ['Chest', 'Quads', 'Back', 'Core', 'Hamstrings', 'Side delts', 'Biceps', 'Triceps'];
    } else if (focus === 'upper_body') {
      targetMuscles = ['Chest', 'Back', 'Side delts', 'Rear delts', 'Biceps', 'Triceps'];
    } else if (focus === 'lower_body') {
      targetMuscles = ['Quads', 'Hamstrings', 'Glutes', 'Core', 'Calves'];
    } else if (focus === 'chest_triceps') {
      targetMuscles = ['Chest', 'Triceps', 'Side delts'];
    } else if (focus === 'back_biceps') {
      targetMuscles = ['Back', 'Biceps', 'Rear delts'];
    } else if (focus === 'shoulders_arms') {
      targetMuscles = ['Side delts', 'Rear delts', 'Biceps', 'Triceps'];
    } else if (focus === 'legs_core') {
      targetMuscles = ['Quads', 'Hamstrings', 'Glutes', 'Core'];
    } else {
      targetMuscles = [focus, 'Core'];
    }

    let blockCount = 2;
    let setsPerEx = 2;
    if (duration <= 10) {
      blockCount = 1; setsPerEx = 2;
    } else if (duration <= 15) {
      blockCount = 2; setsPerEx = 2;
    } else if (duration <= 20) {
      blockCount = 2; setsPerEx = 3;
    } else if (duration <= 30) {
      blockCount = 3; setsPerEx = 3;
    } else {
      blockCount = 4; setsPerEx = 3;
    }

    const hData = heatData(7);
    const todayCheckin = (typeof todayReadiness === 'function') ? todayReadiness() : {};
    const soreMap = todayCheckin?.sorenessMap || {};
    const highLoadMuscles = new Set(Object.keys(hData).filter(m => hData[m]?.readinessState === 'High recent load' || hData[m]?.readinessState === 'Recovering' || soreMap[m] === 'severe' || soreMap[m] === 'moderate' || (hData[m]?.readinessScore != null && hData[m]?.readinessScore < 80)));
    console.log('HIGH LOAD:', Array.from(highLoadMuscles), 'soreMap:', JSON.stringify(soreMap));

    const familiarIds = new Set([
      'push_up', 'bodyweight_squat', 'bodyweight_reverse_lunge', 'bodyweight_glute_bridge',
      'plank', 'dead_bug', 'bird_dog', 'superman_row', 'bodyweight_rear_delt_fly',
      'single_leg_hip_hinge', 'goblet_squat', 'reverse_lunge', 'flat_db_bench_press',
      'standing_db_curl', 'db_overhead_press', 'lying_db_triceps_extension', 'db_romanian_deadlift'
    ]);

    const selectedPairs = [];
    const usedExIds = new Set(options.lockedIds || []);
    const usedFamilies = new Set();
    const usedPatterns = new Set();
    const lockedPairs = options.lockedPairs || [];

    for (let b = 0; b < blockCount; b++) {
      if (lockedPairs[b]) {
        selectedPairs.push(structuredClone(lockedPairs[b]));
        continue;
      }

      let m1 = targetMuscles[(b * 2) % targetMuscles.length];
      let m2 = targetMuscles[(b * 2 + 1) % targetMuscles.length];

      const getReadiness = m => {
        let score = hData[m]?.readinessScore ?? 100;
        if (soreMap[m] === 'severe') score -= 100;
        else if (soreMap[m] === 'moderate') score -= 50;
        return score;
      };
      if (['full_body', 'upper_body', 'lower_body'].includes(focus)) {
        if (highLoadMuscles.has(m1)) {
          const sortedAlts = targetMuscles.filter(m => m !== m2).sort((a, b) => getReadiness(b) - getReadiness(a));
          if (sortedAlts.length && getReadiness(sortedAlts[0]) > getReadiness(m1)) {
            m1 = sortedAlts[0];
          }
        }
        if (highLoadMuscles.has(m2)) {
          const sortedAlts = targetMuscles.filter(m => m !== m1).sort((a, b) => getReadiness(b) - getReadiness(a));
          if (sortedAlts.length && getReadiness(sortedAlts[0]) > getReadiness(m2)) {
            m2 = sortedAlts[0];
          }
        }
      }

      if (b === blockCount - 1 && ['full_body', 'lower_body'].includes(focus) && duration >= 15) {
        if (![...usedPatterns].some(p => p === 'core_stability' || p === 'core_flexion')) {
          m2 = 'Core';
        }
      }

      const pickTop = (muscle, otherExId) => {
        const otherEx = otherExId ? ranked.find(e => e.id === otherExId) : null;
        const otherFamily = otherEx?.family;
        const baseMatch = e => !usedExIds.has(e.id) && e.id !== otherExId && (!otherFamily || e.family !== otherFamily);

        let pool = ranked.filter(e => baseMatch(e) && !usedFamilies.has(e.family) && (e.muscle === muscle || (muscle === 'Side delts' && e.muscle === 'Shoulders')));
        if (['full_body', 'upper_body', 'lower_body'].includes(focus)) {
          const nonHigh = pool.filter(e => !highLoadMuscles.has(e.muscle));
          if (nonHigh.length) pool = nonHigh;
        }

        if (!pool.length) {
          let f1 = ranked.filter(e => baseMatch(e) && (e.muscle === muscle || (muscle === 'Side delts' && e.muscle === 'Shoulders')));
          if (['full_body', 'upper_body', 'lower_body'].includes(focus)) {
            const nonHigh = f1.filter(e => !highLoadMuscles.has(e.muscle));
            if (nonHigh.length) f1 = nonHigh;
          }
          if (f1.length) {
            pool = f1;
          } else {
            let f2 = ranked.filter(e => baseMatch(e) && !highLoadMuscles.has(e.muscle));
            if (!f2.length) f2 = ranked.filter(e => baseMatch(e) && soreMap[e.muscle] !== 'severe');
            const withFamily = f2.filter(e => !usedFamilies.has(e.family));
            if (withFamily.length) f2 = withFamily;
            if (f2.length) {
              pool = f2;
            } else {
              let fReuse = ranked.filter(e => e.id !== otherExId && (!otherFamily || e.family !== otherFamily) && soreMap[e.muscle] !== 'severe');
              if (fReuse.length) {
                pool = fReuse;
              } else {
                pool = ranked.filter(e => baseMatch(e));
              }
            }
          }
        }

        if (!pool.length) {
          pool = ranked.filter(e => e.id !== otherExId && (!otherFamily || e.family !== otherFamily));
        }

        const slice = pool.slice(0, 3);
        return slice[Math.floor(Math.random() * slice.length)];
      };

      const ex1 = pickTop(m1, null);
      if (ex1) {
        usedExIds.add(ex1.id);
        if (ex1.family) usedFamilies.add(ex1.family);
        if (ex1.movementPattern) usedPatterns.add(ex1.movementPattern);
      }

      const ex2 = pickTop(m2, ex1?.id);
      if (ex2) {
        usedExIds.add(ex2.id);
        if (ex2.family) usedFamilies.add(ex2.family);
        if (ex2.movementPattern) usedPatterns.add(ex2.movementPattern);
      }

      const safe1 = ex1 || ranked.find(e => !highLoadMuscles.has(e.muscle)) || ranked[0];
      const safe2 = ex2 || ranked.find(e => e.id !== safe1.id && !highLoadMuscles.has(e.muscle)) || ranked[1];
      const exercises = [
        { ...structuredClone(safe1), sets: setsPerEx, min: safe1.min || 8, max: safe1.max || 12 },
        { ...structuredClone(safe2), sets: setsPerEx, min: safe2.min || 8, max: safe2.max || 12 }
      ];

      selectedPairs.push({
        id: 'oneoff-block-' + (b + 1) + '-' + Date.now().toString(36),
        restMin: 60,
        restMax: 90,
        exercises,
        style,
        availability
      });
    }


    let readinessSuggestion = null;
    const soreTarget = targetMuscles.find(m => hData[m]?.readinessState === 'High recent load' || hData[m]?.readinessState === 'Recovering');
    if (soreTarget) {
      readinessSuggestion = {
        muscle: soreTarget,
        state: hData[soreTarget].readinessState,
        message: `${soreTarget} is currently in a ${hData[soreTarget].readinessState.toLowerCase()} state. Workout selection has adjusted to prioritize recovered areas.`
      };
    }

    return {
      code: 'Quick',
      isOneOff: true,
      duration,
      focus,
      gearMode,
      pairs: selectedPairs,
      readinessSuggestion,
      gapExplanation,
      style,
      availability
    };

  }

  function openOneOffGeneratorModal(){
    const currentDraft = generatorDraft || generateOneOffWorkout({ 
      duration: 15, 
      focus: 'heatmap_gaps', 
      gearMode: 'owned',
      style: profile().quickWorkoutPreference || 'mixed',
      availability: 'all'
    });
    generatorDraft = currentDraft;


    const focusOptions = [
      ['heatmap_gaps', 'Greatest Heat Map Gaps'],
      ['full_body', 'Balanced Full Body'],
      ['upper_only', 'Upper Only — strict'],
      ['upper_focused', 'Upper Focused — mostly upper'],
      ['lower_only', 'Lower Only — strict'],
      ['lower_focused', 'Lower Focused — mostly lower'],
      ['mixed', 'Mixed / Variety'],
      ['chest_triceps', 'Chest & Triceps'],
      ['back_biceps', 'Back & Biceps'],
      ['shoulders_arms', 'Shoulders & Arms'],
      ['legs_core', 'Legs & Abs'],
      ['Chest', 'Chest Focus'],
      ['Back', 'Back Focus'],
      ['Quads', 'Quads Focus'],
      ['Hamstrings', 'Hamstrings Focus']
    ].map(([v, l]) => `<option value="${v}" ${currentDraft.focus === v ? 'selected' : ''}>${l}</option>`).join('');

    const gearOptions = [
      ['owned', 'My Selected Equipment'],
      ['bodyweight', 'Bodyweight / No Equipment'],
      ['dumbbells', 'Dumbbells & Bench Only'],
      ['all', 'All Gym Equipment']
    ].map(([v, l]) => `<option value="${v}" ${currentDraft.gearMode === v ? 'selected' : ''}>${l}</option>`).join('');

    const durationOptions = [10, 15, 20, 30, 45].map(d =>
      `<option value="${d}" ${currentDraft.duration === d ? 'selected' : ''}>${d} Minutes (~${d <= 10 ? '4-6' : d <= 15 ? '6-8' : d <= 20 ? '8-10' : d <= 30 ? '12-16' : '18-20'} sets)</option>`
    ).join('');

    const styleOptions = [
      ['mixed', 'Mixed (BW & Weights)'],
      ['weights_focused', 'Weights Focused (Hypertrophy)'],
      ['bodyweight', 'Bodyweight & Calisthenics']
    ].map(([v, l]) => `<option value="${v}" ${currentDraft.style === v ? 'selected' : ''}>${l}</option>`).join('');

    const availabilityOptions = [
      ['all', 'All Owned Equipment'],
      ['indoor_only', 'Indoor Weights Station Only']
    ].map(([v, l]) => `<option value="${v}" ${currentDraft.availability === v ? 'selected' : ''}>${l}</option>`).join('');


    const pairsHtml = currentDraft.pairs.map((p, pIdx) => `
      <div style="background:#15181e; border:1px solid #28303d; border-radius:10px; padding:12px; margin-bottom:10px;">
        <div style="display:flex; justify-space-between; align-items:center; margin-bottom:8px;">
          <strong style="color:#d97241; font-size:12px; letter-spacing:0.5px;">SUPERSET ${pIdx + 1}</strong>
          <small style="color:#94a3b8;">${p.restMin}–${p.restMax}s rest</small>
        </div>
        ${p.exercises.map(ex => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-top:1px solid rgba(255,255,255,0.05);">
            <div>
              <strong style="color:#ffffff; font-size:14px;">${esc(ex.name)}</strong>
              <small style="display:block; color:#94a3b8;">${esc(ex.muscle)} · ${ex.sets} sets × ${ex.min}–${ex.max} reps · ${ex.load === 'bodyweight' ? 'BW' : (isDumbbellExercise(ex) ? 'per DB' : ex.load)}</small>
            </div>
            <span class="label-tag" style="font-size:10px;">${(ex.equipment || []).length === 0 ? 'Bodyweight' : ex.equipment.join(', ')}</span>
          </div>
        `).join('')}
      </div>
    `).join('');

    openModal(`
      <div class="modal-header">
        <div class="eyebrow" style="color:#d97241; font-weight:700;">AD-HOC WORKOUT GENERATOR ⚡</div>
        <h2 style="margin:4px 0; font-size:20px; color:#f5ede6;">One-Off Quick Workout</h2>
        <p class="subhead">Generate a custom session on the fly. <strong>Will never advance or alter your main plan rotation.</strong></p>
      </div>
      <div class="modal-body mt16">
        <form id="generatorForm" class="stack" style="gap:10px;">
          <div class="form-grid">
            <div class="field">
              <label>Target Duration</label>
              <select name="duration" id="genDurationSelect">${durationOptions}</select>
            </div>
            <div class="field">
              <label>Equipment Mode</label>
              <select name="gearMode" id="genGearSelect">${gearOptions}</select>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label>Workout Style</label>
              <select name="style" id="genStyleSelect">${styleOptions}</select>
            </div>
            <div class="field">
              <label>Session Location</label>
              <select name="availability" id="genAvailSelect">${availabilityOptions}</select>
            </div>
          </div>
          <div class="field">
            <label>Workout Focus</label>
            <select name="focus" id="genFocusSelect">${focusOptions}</select>
          </div>
        </form>


        <div class="row" style="justify-content:space-between; align-items:center; margin:14px 0 8px 0;">
          <h3 class="eyebrow" style="margin:0;">Generated Session Preview (${currentDraft.pairs.length * 2} exercises)</h3>
          <button type="button" class="btn outline sm" data-action="shuffle-generator" style="font-size:11px; padding:4px 10px;">🎲 Shuffle / Regenerate</button>
        </div>

        ${currentDraft.readinessSuggestion ? `
          <div style="margin:8px 0; padding:10px 12px; background:rgba(234,179,8,0.12); border:1px solid rgba(234,179,8,0.3); border-radius:8px; font-size:11px; color:#fde047;">
            💡 <strong>Readiness Note:</strong> ${esc(currentDraft.readinessSuggestion.message)}
          </div>
        ` : ''}

        ${currentDraft.gapExplanation ? `
          <div style="margin:8px 0; padding:10px 12px; background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.3); border-radius:8px; font-size:11px; color:#93c5fd;">
            <strong>Why these exercises?</strong><br>
            ${esc(currentDraft.gapExplanation)}
          </div>
        ` : ''}

        ${currentDraft.gearMode === 'bodyweight' ? `
          <div style="margin:6px 0 10px 0; padding:8px 10px; background:rgba(148,163,184,0.08); border:1px solid rgba(148,163,184,0.2); border-radius:6px; font-size:10.5px; color:#cbd5e1;">
            ℹ️ <em>Equipment-free floor back movements (e.g. Superman Rows) build posterior engagement, but do not provide identical heavy loaded row resistance.</em>
          </div>
        ` : ''}

        <div style="max-height:240px; overflow-y:auto;" class="stack mt8">
          ${pairsHtml}
        </div>

        <div style="margin-top:12px; padding:10px 12px; background:rgba(217,114,65,0.08); border:1px solid rgba(217,114,65,0.22); border-radius:8px; font-size:11px; color:#cbd5e1;">
          ⚡ <strong>Plan Rotation Protected:</strong> Completing this session logs sets to your history, personal records, and muscle heat map, but leaves your next Master Plan workout untouched.
        </div>

        <div class="mt16 stack" style="gap:8px;">
          <button type="button" class="btn primary full" data-action="start-oneoff-session" style="padding:12px; font-size:15px; font-weight:700; cursor:pointer;">
            Start One-Off Workout Now ▶
          </button>
          <button type="button" class="btn outline full" data-action="close-modal">Cancel</button>
        </div>
      </div>
    `);

    setTimeout(() => {
      const dur = document.querySelector('#genDurationSelect');
      const gear = document.querySelector('#genGearSelect');
      const foc = document.querySelector('#genFocusSelect');
      const sty = document.querySelector('#genStyleSelect');
      const avl = document.querySelector('#genAvailSelect');

      const updateGen = () => {
        if (!dur || !gear || !foc || !sty || !avl) return;
        
        // Persist style preference
        if (profile().quickWorkoutPreference !== sty.value) {
          profile().quickWorkoutPreference = sty.value;
          save();
        }

        generatorDraft = generateOneOffWorkout({
          duration: Number(dur.value),
          gearMode: gear.value,
          focus: foc.value,
          style: sty.value,
          availability: avl.value
        });
        openOneOffGeneratorModal();
      };

      if (dur) dur.addEventListener('change', updateGen);
      if (gear) gear.addEventListener('change', updateGen);
      if (foc) foc.addEventListener('change', updateGen);
      if (sty) sty.addEventListener('change', updateGen);
      if (avl) avl.addEventListener('change', updateGen);
    }, 50);

  }

  let holidayProgramDraft = null;

  function generateHolidayProgram(options = {}) {
    const weeks = Number(options.weeks) || 2;
    const frequency = Number(options.frequency) || 3; // 2, 3, or 4
    const sessionDuration = Number(options.sessionDuration) || 15; // 10, 15, 20, 30
    const gearMode = options.gearMode || 'bodyweight'; // 'bodyweight', 'dumbbells', 'owned', 'all'
    const environment = options.environment || 'hotel_room'; // 'hotel_room', 'gym', 'outdoor'
    const location = options.location || 'Holiday / Travel';

    const sessionCodes = frequency === 2 ? ['HA', 'HB'] : frequency === 4 ? ['HA', 'HB', 'HC', 'HD'] : ['HA', 'HB', 'HC'];
    const focuses = {
      HA: 'upper_body',
      HB: 'lower_body',
      HC: 'full_body',
      HD: 'shoulders_arms'
    };
    const names = {
      HA: 'Holiday A · Upper & Core',
      HB: 'Holiday B · Lower & Posture',
      HC: 'Holiday C · Full Body Quick',
      HD: 'Holiday D · Arms & Mobility'
    };

    const sessions = {};
    sessionCodes.forEach(code => {
      const gen = generateOneOffWorkout({
        duration: sessionDuration,
        focus: focuses[code] || 'full_body',
        gearMode: gearMode
      });
      sessions[code] = {
        code: code,
        name: names[code] || ('Holiday Session ' + code),
        duration: sessionDuration,
        gearMode: gearMode,
        pairs: gen.pairs
      };
    });

    return {
      title: `${location} Travel Split (${frequency}x/wk · ${sessionDuration}m)`,
      weeks: weeks,
      frequency: frequency,
      sessionDuration: sessionDuration,
      gearMode: gearMode,
      environment: environment,
      location: location,
      nextSession: sessionCodes[0],
      order: sessionCodes,
      sessions: sessions
    };
  }

  function activateHolidayMode(options = {}) {
    const savedNext = state.next || 'A';
    const mode = options.mode || 'plan'; // 'plan' or 'one-off'
    const location = options.location || 'Holiday / Travel';
    const gearMode = options.gearMode || 'bodyweight';

    let holidayPlan = null;
    if (mode === 'plan') {
      holidayPlan = options.holidayPlan || holidayProgramDraft || generateHolidayProgram({
        weeks: options.weeks || 2,
        frequency: options.frequency || 3,
        sessionDuration: options.sessionDuration || 15,
        gearMode: gearMode,
        environment: options.environment || 'hotel_room',
        location: location
      });
    }

    state.holiday = {
      active: true,
      mode: mode,
      savedNext: savedNext,
      savedPlanId: selectedPlan,
      startDate: todayLocal(),
      location: location,
      gearMode: gearMode,
      plan: holidayPlan
    };

    save();
    showToast(`🌴 Holiday Mode active! Master Routine paused at Workout ${savedNext}.`);
    render();
  }

  function exitHolidayMode() {
    if (!state.holiday || !state.holiday.active) return;
    const restoredNext = state.holiday.savedNext || state.next || 'A';

    state.next = restoredNext;
    state.holiday.active = false;

    save();
    showToast(`✈️ Welcome back! Master Routine resumed at Workout ${restoredNext}.`);
    render();
  }

  function startHolidaySession(sessionCode) {
    if (!state.holiday?.active || !state.holiday?.plan) return;
    const hPlan = state.holiday.plan;
    const code = sessionCode || hPlan.nextSession || hPlan.order[0] || 'HA';
    const hSession = hPlan.sessions[code];
    if (!hSession) return;

    state.active = {
      session: code,
      sessionName: hSession.name,
      planId: 'holiday',
      isOneOff: true,
      isHoliday: true,
      taskIndex: 0,
      logs: [],
      drafts: {},
      startedAt: new Date().toISOString(),
      stage: 'lift',
      restUntil: null,
      pairs: hSession.pairs
    };
    save();
    page = 'workout';
    render();
  }

  function openHolidayModal() {
    const isCurrentlyActive = !!(state.holiday && state.holiday.active);
    const savedNext = state.holiday?.savedNext || state.next || 'A';

    if (isCurrentlyActive) {
      const hPlan = state.holiday.plan;
      const modeText = state.holiday.mode === 'plan' && hPlan
        ? `Temporary Holiday Split (${hPlan.frequency}x/wk · ${hPlan.sessionDuration}m)`
        : `Ad-Hoc Travel Workouts (${state.holiday.gearMode || 'bodyweight'})`;

      openModal(`
        <div class="modal-header">
          <div class="eyebrow" style="color:#38bdf8; font-weight:700;">🌴 HOLIDAY MODE ACTIVE</div>
          <h2 style="margin:4px 0; font-size:20px; color:#f5ede6;">Resume Master Routine</h2>
          <p class="subhead">Currently active: <strong>${esc(modeText)}</strong> in ${esc(state.holiday.location || 'Travel')}.</p>
        </div>
        <div class="modal-body mt16">
          <div style="background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.25); border-radius:10px; padding:12px; margin-bottom:14px;">
            <strong style="color:#f5ede6; display:block; font-size:14px;">Master Routine Status</strong>
            <span style="font-size:12px; color:#cbd5e1; display:block; margin-top:4px;">
              Your main plan is ready to resume at: <strong>Workout ${esc(savedNext)}</strong>. All travel sessions logged during your trip are preserved in your history and heat map.
            </span>
          </div>

          <div class="mt16 stack" style="gap:8px;">
            <button type="button" class="btn primary full" data-action="confirm-exit-holiday" style="padding:12px; font-size:15px; font-weight:700; background:#38bdf8; border-color:#38bdf8; color:#0d0f11; cursor:pointer;">
              ✈️ Return from Holiday & Resume Workout ${esc(savedNext)}
            </button>
            <button type="button" class="btn outline full" data-action="close-modal">Keep Holiday Mode Active</button>
          </div>
        </div>
      `);
    } else {
      const draft = holidayProgramDraft || generateHolidayProgram({ weeks: 2, frequency: 3, sessionDuration: 15, gearMode: 'bodyweight', environment: 'hotel_room' });
      holidayProgramDraft = draft;

      openModal(`
        <div class="modal-header">
          <div class="eyebrow" style="color:#38bdf8; font-weight:700;">🌴 HOLIDAY MODE & TRAVEL GENERATOR</div>
          <h2 style="margin:4px 0; font-size:20px; color:#f5ede6;">Pause Master Routine & Train on the Go</h2>
          <p class="subhead">Freeze your main plan rotation at <strong>Workout ${esc(savedNext)}</strong>. Choose your travel training setup below.</p>
        </div>
        <div class="modal-body mt16">
          <form id="holidayConfigForm" class="stack" style="gap:12px;">
            <div class="field">
              <label>Holiday Mode Style</label>
              <select id="holidayModeStyleSelect" class="input">
                <option value="plan">Option 2: Multi-Session Temporary Holiday Program (Recommended)</option>
                <option value="one-off">Option 1: Individual Ad-Hoc Travel Workouts</option>
              </select>
            </div>

            <div class="field">
              <label>Trip / Location Name</label>
              <input type="text" id="holidayLocationInput" value="Beach Holiday" placeholder="e.g. Beach Holiday, Hotel Gym, Travel" class="input">
            </div>

            <div id="holidayPlanOptionsBox" class="stack" style="gap:10px; background:#181c22; border:1px solid #28303d; border-radius:10px; padding:12px;">
              <strong style="color:#38bdf8; font-size:12px; letter-spacing:0.5px;">HOLIDAY PROGRAMME CONFIGURATION</strong>
              
              <div class="form-grid">
                <div class="field">
                  <label>Duration (Weeks)</label>
                  <select id="holWeeksSelect">
                    <option value="1">1 Week Trip</option>
                    <option value="2" selected>2 Weeks Trip</option>
                    <option value="3">3 Weeks Trip</option>
                    <option value="4">4 Weeks Trip</option>
                  </select>
                </div>
                <div class="field">
                  <label>Weekly Frequency</label>
                  <select id="holFreqSelect">
                    <option value="2">2 Workouts / Week</option>
                    <option value="3" selected>3 Workouts / Week</option>
                    <option value="4">4 Workouts / Week</option>
                  </select>
                </div>
              </div>

              <div class="form-grid">
                <div class="field">
                  <label>Session Duration</label>
                  <select id="holDurSelect">
                    <option value="10">10 Minutes (4-6 sets)</option>
                    <option value="15" selected>15 Minutes (6-8 sets)</option>
                    <option value="20">20 Minutes (10-12 sets)</option>
                    <option value="30">30 Minutes (16-18 sets)</option>
                  </select>
                </div>
                <div class="field">
                  <label>Equipment Mode</label>
                  <select id="holGearSelect">
                    <option value="bodyweight" selected>Bodyweight / Zero Equipment</option>
                    <option value="dumbbells">Hotel Dumbbells & Bench</option>
                    <option value="owned">My Selected Equipment</option>
                    <option value="all">All Gym Equipment</option>
                  </select>
                </div>
              </div>

              <div class="field">
                <label>Training Environment Space</label>
                <select id="holEnvSelect">
                  <option value="hotel_room" selected>Small Hotel Room (Quiet / Compact Space)</option>
                  <option value="gym">Hotel / Local Gym</option>
                  <option value="outdoor">Outdoor / Park</option>
                </select>
              </div>

              <div class="row mt8" style="justify-content:space-between; align-items:center;">
                <strong style="color:#f5ede6; font-size:12px;">Generated Split Preview (${draft.order.length} workouts)</strong>
                <button type="button" class="btn outline sm" id="shuffleHolidayPlanBtn" style="font-size:11px; padding:3px 8px;">🎲 Shuffle Plan</button>
              </div>

              <div class="stack" style="max-height:160px; overflow-y:auto; gap:6px;">
                ${draft.order.map(code => {
                  const s = draft.sessions[code];
                  return `
                    <div style="background:#111418; border:1px solid #222933; border-radius:6px; padding:8px 10px; font-size:11px;">
                      <strong style="color:#38bdf8;">${esc(s.name)}</strong>
                      <span style="display:block; color:#94a3b8; margin-top:2px;">
                        ${s.pairs.flatMap(p => p.exercises).map(e => e.name).join(', ')}
                      </span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <div style="padding:10px 12px; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.22); border-radius:8px; font-size:11px; color:#cbd5e1; line-height:1.5;">
              <strong style="color:#38bdf8; display:block; margin-bottom:4px;">🛡️ Master Routine Protection Guarantee:</strong>
              • Main rotation (<strong>Workout ${esc(savedNext)}</strong>) will be frozen exactly where it is.<br>
              • Travel workouts build your Heat Map and record PBs without touching your main plan.<br>
              • Returning from holiday restores <strong>Workout ${esc(savedNext)}</strong> instantly.
            </div>

            <div class="mt16 stack" style="gap:8px;">
              <button type="button" class="btn primary full" data-action="confirm-activate-holiday" style="padding:12px; font-size:15px; font-weight:700; background:#38bdf8; border-color:#38bdf8; color:#0d0f11; cursor:pointer;">
                🌴 Activate Holiday Mode
              </button>
              <button type="button" class="btn outline full" data-action="close-modal">Cancel</button>
            </div>
          </form>
        </div>
      `);

      setTimeout(() => {
        const modeSel = document.querySelector('#holidayModeStyleSelect');
        const optionsBox = document.querySelector('#holidayPlanOptionsBox');
        const weeksSel = document.querySelector('#holWeeksSelect');
        const freqSel = document.querySelector('#holFreqSelect');
        const durSel = document.querySelector('#holDurSelect');
        const gearSel = document.querySelector('#holGearSelect');
        const envSel = document.querySelector('#holEnvSelect');
        const shuffleBtn = document.querySelector('#shuffleHolidayPlanBtn');

        if (modeSel && optionsBox) {
          modeSel.addEventListener('change', () => {
            optionsBox.style.display = modeSel.value === 'plan' ? 'flex' : 'none';
          });
        }

        const reGenHoliday = () => {
          if (!weeksSel || !freqSel || !durSel || !gearSel) return;
          holidayProgramDraft = generateHolidayProgram({
            weeks: Number(weeksSel.value),
            frequency: Number(freqSel.value),
            sessionDuration: Number(durSel.value),
            gearMode: gearSel.value,
            environment: envSel?.value || 'hotel_room',
            location: document.querySelector('#holidayLocationInput')?.value || 'Beach Holiday'
          });
          openHolidayModal();
        };

        if (weeksSel) weeksSel.addEventListener('change', reGenHoliday);
        if (freqSel) freqSel.addEventListener('change', reGenHoliday);
        if (durSel) durSel.addEventListener('change', reGenHoliday);
        if (gearSel) gearSel.addEventListener('change', reGenHoliday);
        if (envSel) envSel.addEventListener('change', reGenHoliday);
        if (shuffleBtn) shuffleBtn.addEventListener('click', reGenHoliday);
      }, 50);
    }
  }

  function progress(){
    const currentTab = PROGRESS_TABS.find(x=>x[0]===progressTab) || PROGRESS_TABS[0];
    return `<div class="rr163-progress-container">
      <header class="rr163-progress-header">
        <div class="rr153-waves" aria-hidden="true"></div>
        <div class="eyebrow">TRAIN · COMPETE · IMPROVE</div>
        <h1 class="page-title">Progress.</h1>
        <p class="lead">See how your work is paying off, from the big picture to individual exercises.</p>
        ${progressTabs()}
      </header>
      <div class="rr163-tab-content" role="tabpanel" aria-label="${currentTab[1]}">${
        progressTab==='muscles'?progressMuscles():
        progressTab==='movements'?movementTrendsScreen(true):
        progressTab==='records'?progressRecordsView():
        progressOverview()
      }</div>
    </div>`;
  }

  function adaptivePlan(){return selectedPlan===ADAPT_ID&&profile().adaptive?.active;}
  function adaptiveReviewDue(){const cfg=profile().adaptive;if(!cfg?.active)return false;const d=ADAPT.nextReviewDay(cfg);return d!=null&&d<=todayLocal();}
  function lastReadinessForAdaptive(){return todayReadiness()||readinessLog().at(-1)||null;}
  function createAdaptiveNext(variant=0,keepFocus=false){
    const cfg=profile().adaptive;if(!cfg)return;
    const effectiveFocus=cfg.nextFocus || cfg.focus || 'balanced';
    const fresh=ADAPT_V3.generate(cfg,state.history,profile().equipment||[],lastReadinessForAdaptive(),{
      variant,focus:effectiveFocus,avoid:cfg.avoid||[],equipmentMetadata:profile().equipmentMetadata||{}
    });
    if(!fresh.pairs.length){cfg.lastReason=fresh.warning||'No eligible exercises';return null;}
    const day={name:fresh.name,pairs:fresh.pairs};
    profile().plans[ADAPT_ID]={A:day};
    cfg.lastReason=fresh.explanation;cfg.lastFocus=fresh.focus;cfg.estimatedMinutes=fresh.estimatedMinutes;cfg.generatedAt=new Date().toISOString();
    cfg.lastWorkoutFocus=effectiveFocus;cfg.nextFocus=null;cfg.variant=variant;state.next='A';return day;
  }
  function adaptiveConfig(){
    const adapt = window.RepRivalAdaptive || {};
    const templates = adapt.TEMPLATES || {};
    const cfg = profile().adaptive || {};
    const runnerLvl = templates.runner?.levels || [3,3,2,2,1,3];
    return {space:'small',experience:'intermediate',exclusions:activeProfile==='admin'?['carries','overhead']:['carries'],...cfg,levels:[...(cfg.levels||runnerLvl)]};
  }

  function persistAdaptiveConfig(){
    const cfg=profile().adaptive;
    if(!cfg)return;
    cfg.updatedAt=new Date().toISOString();save();
    const cloud=window.RepRivalCloud;
    if(cloud?.getCurrentUser() && typeof cloud.saveAdaptiveConfig==='function'){
      Promise.resolve(cloud.saveAdaptiveConfig(structuredClone(cfg))).catch(err=>console.warn('Adaptive cloud preference save failed',err));
    }
  }
  function pauseProgrammeForAdaptive(){
    if(state.active){showToast('Finish or cancel the current workout before switching modes.');return false;}
    const athlete=profile(), cfg=athlete.adaptive||(athlete.adaptive={});
    if(athlete.planId===ADAPT_ID && cfg.active)return true;
    const sourcePlan=athlete.planId===ADAPT_ID?'pump':athlete.planId;
    cfg.pausedPlan={planId:sourcePlan,next:state.next,tracking:structuredClone(athlete.planTracking||{})};
    cfg.active=true;cfg.startedAt=cfg.startedAt||todayLocal();
    cfg.focus=cfg.focus||'balanced';cfg.goal=cfg.goal||'hypertrophy';cfg.supersets=cfg.supersets||3;
    const trial=ADAPT_V3.generate(cfg,state.history,athlete.equipment||[],lastReadinessForAdaptive(),{equipmentMetadata:athlete.equipmentMetadata||{}});
    if(!trial.pairs.length){cfg.active=false;showToast(trial.warning||'No compatible movements enabled');return false;}
    athlete.planId=ADAPT_ID;selectedPlan=ADAPT_ID;SESSION_ORDER=['A'];
    if(!athlete.plans)athlete.plans={};
    createAdaptiveNext(cfg.variant||0);
    athlete.planTracking={planId:ADAPT_ID,start:todayLocal(),weeklyGoal:cfg.frequency||3};
    persistAdaptiveConfig();return true;
  }
  function resumePausedProgramme(){
    if(state.active){showToast('Finish or cancel the current workout before switching modes.');return false;}
    const athlete=profile(),cfg=athlete.adaptive;
    if(!cfg?.active)return false;
    const paused=cfg.pausedPlan||{planId:'pump',next:'A',tracking:athlete.planTracking};
    const planId=athlete.plans?.[paused.planId]?paused.planId:'pump';
    athlete.planId=planId;selectedPlan=planId;
    SESSION_ORDER=Object.keys(athlete.plans[planId]||PLAN);
    state.next=SESSION_ORDER.includes(paused.next)?paused.next:SESSION_ORDER[0];
    athlete.planTracking=structuredClone(paused.tracking||{planId,start:todayLocal(),weeklyGoal:3});
    cfg.active=false;persistAdaptiveConfig();return true;
  }
  // Keep the exercise-library selection as UI-only state. Exercise frequency
  // selections continue saving immediately into the existing adaptive config.
  let adaptiveLibraryMuscle = null;
  function filterAdaptiveExerciseLibrary(){
    const selector=document.getElementById('adaptiveMuscleSelect');
    if(!selector)return;
    const muscle=selector.value;
    const search=document.getElementById('adaptiveExerciseSearch');
    const query=String(search?.value||'').toLocaleLowerCase().trim();
    let visible=0,total=0;
    document.querySelectorAll('.rr-adaptive-group[data-adaptive-muscle]').forEach(group=>{
      const selected=group.dataset.adaptiveMuscle===muscle;
      group.hidden=!selected;
      if(!selected)return;
      group.querySelectorAll('[data-adaptive-item]').forEach(item=>{
        total++;
        const matches=(item.dataset.adaptiveItem||'').includes(query);
        item.hidden=!matches;
        if(matches)visible++;
      });
    });
    const results=document.getElementById('adaptiveResults');
    if(results)results.textContent=query
      ?visible+' of '+total+' exercises shown'
      :total+' exercises available for '+muscle;
    const empty=document.getElementById('adaptiveEmpty');
    if(empty)empty.hidden=visible>0;
  }
  function adaptiveStudioScreen(){
    const athlete=profile(),cfg=athlete.adaptive||{},v3=ADAPT_V3;
    const owned=athlete.equipment||[],lib=window.REPRIVAL_EXERCISE_LIBRARY;
    const eligible=lib.entries.filter(e=>lib.compatible(e,owned));
    const grouped=Object.fromEntries(v3.CATEGORIES.map(c=>[c,[]]));
    eligible.forEach(e=>grouped[v3.category(e)].push(e));
    const opts=(v)=>v3.FOCUSES.map(([key,label])=>'<option value="'+esc(key)+'" '+(key===v?'selected':'')+'>'+esc(label)+'</option>').join('');
    const categories=v3.CATEGORIES.filter(cat=>(grouped[cat]||[]).length>0);
    if(!categories.includes(adaptiveLibraryMuscle))adaptiveLibraryMuscle=categories[0]||null;
    const muscleOptions=categories.map(cat=>'<option value="'+esc(cat)+'" '+(cat===adaptiveLibraryMuscle?'selected':'')+'>'+esc(cat)+' ('+grouped[cat].length+')</option>').join('');
    const frequencyLabels=['Off','Once','Twice','Three'];
    const exercises=categories.map(cat=>{
      const list=grouped[cat]||[];
      return '<section class="rr-adaptive-group" data-adaptive-muscle="'+esc(cat)+'" '+(cat===adaptiveLibraryMuscle?'':'hidden')+' aria-label="'+esc(cat)+' exercise preferences">'+
        '<div class="rr-adaptive-group-heading"><h4>'+esc(cat)+'</h4><span>'+list.length+' movements</span></div>'+
        '<div class="rr-adaptive-exercise-list">'+list.map(ex=>{
          const value=v3.pref(cfg,ex.id);
          const gear=(ex.equipment||[]).map(g=>lib.gear[g]?.name||g).join(' + ')||'No equipment';
          return '<article class="rr-element-exercise rr-adaptive-exercise" data-adaptive-item="'+esc((ex.name+' '+gear).toLocaleLowerCase())+'">'+
            '<div class="rr-adaptive-exercise-info"><strong>'+esc(ex.name)+'</strong><small>'+esc(gear)+'</small></div>'+
            '<fieldset class="rr-adaptive-frequency" aria-label="'+esc(ex.name)+' appearances per rolling 7 days">'+
              '<legend>APPEARANCES / 7 DAYS</legend><div class="rr-adaptive-frequency-options">'+
              [0,1,2,3].map(n=>'<label class="rr-adaptive-frequency-choice"><input type="radio" name="freq-'+esc(ex.id)+'" data-adaptive-frequency="'+esc(ex.id)+'" value="'+n+'" '+(value===n?'checked':'')+'><span><b>'+n+'</b><small>'+frequencyLabels[n]+'</small></span></label>').join('')+
              '</div></fieldset></article>';
        }).join('')+'</div></section>';
    }).join('');
    return '<div class="rr-element-studio"><div class="eyebrow">ADAPTIVE TRAINING · PERSONALISE</div><h1 class="page-title">Train your way.</h1>'+
      '<p class="lead">Every workout follows your muscle stimulus and recovery heatmap. Choose the focus, then decide which movements can appear and how often.</p>'+
      card('<div class="rr-element-mode-grid"><div><strong>My programme</strong><small>'+(cfg.active?'Paused · '+esc(cfg.pausedPlan?.next||'A')+' is next':'Active · your current rotation')+'</small></div><div><strong>Adaptive</strong><small>'+(cfg.active?'Currently active':'Ready when you are')+'</small></div></div>'+
        '<button class="btn '+(cfg.active?'outline':'primary')+' full mt12" type="button" data-action="'+(cfg.active?'adaptive-disable':'adaptive-enable')+'" '+(state.active?'disabled':'')+'>'+(cfg.active?'Resume my paused programme':'Pause programme & enable Adaptive')+'</button>','section')+
      card('<h3>Workout focus</h3><p class="subhead mt8">Only means strict body region. Focused targets roughly 75% of sets in that region. All modes still use the heatmap.</p>'+
        '<div class="field mt12"><label for="adaptiveDefaultFocus">Default focus</label><select id="adaptiveDefaultFocus" data-adaptive-default-focus>'+opts(cfg.focus||'balanced')+'</select></div>'+
        '<div class="field mt12"><label for="adaptiveNextFocus">Next workout only (optional)</label><select id="adaptiveNextFocus" data-adaptive-next-focus><option value="">Use default focus</option>'+opts(cfg.nextFocus||'')+'</select></div>'+
        '<div class="form-grid"><div class="field"><label for="adaptiveSessionCount">Workout blocks</label><select id="adaptiveSessionCount" data-adaptive-blocks>'+[2,3,4,5].map(n=>'<option value="'+n+'" '+((cfg.supersets||3)===n?'selected':'')+'>'+n+' blocks</option>').join('')+'</select></div>'+
        '<div class="field"><label for="adaptiveWeeklyGoal">Sessions / week</label><select id="adaptiveWeeklyGoal" data-adaptive-weekly>'+[2,3,4,5,6].map(n=>'<option value="'+n+'" '+((cfg.frequency||3)===n?'selected':'')+'>'+n+' per week</option>').join('')+'</select></div></div>'+
        '<button class="btn primary full mt12" data-action="adaptive-generate" '+(!cfg.active||state.active?'disabled':'')+' type="button">Generate next adaptive workout</button>','section')+
      card('<section class="rr-adaptive-library" aria-label="Adaptive exercise preferences">'+
        '<div class="rr-adaptive-library-head"><div><div class="eyebrow">BUILD YOUR EXERCISE POOL</div><h3>Exercise preferences</h3><p class="subhead">Choose a muscle group, then set how often each exercise can appear.</p></div><span class="label-tag">'+eligible.length+' available</span></div>'+
        '<div class="rr-adaptive-library-controls">'+
          '<div class="field"><label for="adaptiveMuscleSelect">Muscle group</label><select id="adaptiveMuscleSelect" aria-controls="adaptiveExerciseGroups">'+muscleOptions+'</select></div>'+
          '<div class="field"><label for="adaptiveExerciseSearch">Find an exercise</label><input id="adaptiveExerciseSearch" type="search" placeholder="Search this muscle group" autocomplete="off"></div>'+
        '</div>'+
        '<p class="rr-adaptive-frequency-help">Set the maximum appearances in any rolling 7 days: <strong>0</strong> excludes an exercise; <strong>1–3</strong> allows it more often.</p>'+
        '<div id="adaptiveResults" class="rr-adaptive-results" role="status" aria-live="polite">'+((grouped[adaptiveLibraryMuscle]||[]).length)+' exercises available for '+esc(adaptiveLibraryMuscle||'your equipment')+'</div>'+
        '<div id="adaptiveExerciseGroups" class="rr-adaptive-groups">'+exercises+'</div>'+
        '<p id="adaptiveEmpty" class="rr-adaptive-empty" hidden>No exercises match your search in this muscle group.</p>'+
        '<p class="rr-adaptive-autosave">Your choices save automatically.</p></section>','section')+
      '<button class="btn outline full" data-page="plan">← Back to My Plan</button></div>';
  }

  function adaptiveSetupScreen(){
    const adapt = window.RepRivalAdaptive || {};
    const cfg = adaptiveDraft || adaptiveConfig(), presets = profile().adaptivePresets || [];
    const templates = adapt.TEMPLATES || {};
    const groups = adapt.GROUPS || ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];
    const levelsList = adapt.LEVELS || ['Off / Skip', 'Maintenance (Low)', 'Balanced (Medium)', 'High Priority', 'Maximum Focus'];
    const runnerTpl = templates.runner || { id:'runner', name:'Runner / Athletic Leg Recovery', desc:'Prioritises upper body & core', levels:[3,3,2,2,1,3] };
    const chosenPreset = templates[cfg.template] || presets.find(x=>x.id===cfg.template) || runnerTpl;
    const key = (templates[cfg.template] || presets.some(x=>x.id===cfg.template)) ? cfg.template : 'runner';
    const focus = cfg.levels || chosenPreset.levels || [3,3,3,3,3,3];
    const options = (values,current)=>values.map(([value,label])=>`<option value="${esc(String(value))}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`).join('');
    const gear = window.REPRIVAL_EXERCISE_LIBRARY?.gear || {}, owned = profile().equipment || [];
    const gearChoices = Object.entries(gear).map(([id,entry])=>`<label class="rr161-choice"><input type="checkbox" name="gear" value="${esc(id)}" ${owned.includes(id)?'checked':''}><span>${esc(entry.name)}</span></label>`).join('');
    const exclusions = cfg.exclusions || [];
    const avoidChoice = (id,label)=>`<label class="rr161-choice"><input type="checkbox" name="exclusion" value="${id}" ${exclusions.includes(id)?'checked':''}><span>${label}</span></label>`;
    const groupControls = groups.map((group,i)=>`<div class="rr160-focus-row"><div class="row"><strong>${group}</strong><span class="rr160-focus-label" data-focus-name="${i}">${levelsList[focus[i]] || 'Medium'}</span></div><input class="rr160-focus-slider" type="range" name="level${i}" min="0" max="4" step="1" value="${focus[i] ?? 2}" aria-label="${group} training priority"></div>`).join('');
    const templateOptions = [...Object.entries(templates).map(([id,t])=>`<option value="${id}" ${id===key?'selected':''}>${esc(t.name)}</option>`),...presets.map(t=>`<option value="${esc(t.id)}" ${t.id===key?'selected':''}>★ ${esc(t.name)}</option>`)].join('');
    return `<div class="eyebrow">ADAPTIVE TRAINING · GUIDED SETUP</div><h1 class="page-title">Make training fit you.</h1><p class="lead">Three short steps. RepRival won't prescribe exercises that need equipment or space you don't have.</p>
      ${card(`<form id="adaptiveForm" class="rr161-wizard">
      <div class="rr161-wizard-progress"><span class="current">1 · Your goal</span><span>2 · Your setup</span><span>3 · Fine-tune</span></div>
      <section class="rr161-wizard-step" data-wizard-step="0">
        <h3>1. What would you like to achieve?</h3>
        <div class="field mt16"><label>Choose a starting focus</label><select name="template" id="adaptiveTemplate">${templateOptions}</select><p class="fineprint" id="adaptiveTemplateDesc">${esc(chosenPreset.desc)}</p></div>
        <div class="form-grid"><div class="field"><label>Main goal</label><select name="goal">${options([['hypertrophy','Build muscle'],['strength','Get stronger'],['endurance','Strength endurance'],['general','General fitness']],cfg.goal||'hypertrophy')}</select></div><div class="field"><label>Time per workout</label><select name="duration">${options([[25,'25 minutes'],[30,'30 minutes'],[40,'40 minutes'],[50,'50 minutes'],[60,'60 minutes'],[75,'75 minutes']],cfg.duration||40)}</select></div></div>
        <div class="form-grid"><div class="field"><label>Workouts per week</label><select name="frequency">${options([2,3,4,5,6].map(n=>[n,n+' sessions']),cfg.frequency||3)}</select></div><div class="field"><label>Supersets per workout</label><select name="supersets">${options([[2,'2 supersets (4 exercises)'],[3,'3 supersets (6 exercises)'],[4,'4 supersets (8 exercises)'],[5,'5 supersets (10 exercises)']],cfg.supersets||3)}</select></div></div>
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
        <div class="rr161-wizard-nav"><button type="button" class="btn outline" data-action="adaptive-wizard-back">← Back</button><button type="submit" class="btn primary" style="cursor:pointer;">${cfg.active&&selectedPlan===ADAPT_ID?'Update plan':'Activate plan'} →</button></div>
      </section>
      <button type="button" class="btn text full mt12" data-page="plan">Cancel · return to My Plan</button>
      </form>`,'section')}`;
  }

  function adaptiveReviewScreen(){
    const adapt = window.RepRivalAdaptive || {};
    const levelsList = adapt.LEVELS || ['Off / Skip', 'Maintenance (Low)', 'Balanced (Medium)', 'High Priority', 'Maximum Focus'];
    const cfg = profile().adaptive;
    if(!cfg?.active) return `<h1>Adaptive Training is not active</h1>${btn('My plan','plan','outline full')}`;
    const r = typeof adapt.review === 'function' ? adapt.review(cfg, state.history, lastReadinessForAdaptive()) : { rows: [] };
    return `<div class="eyebrow">FOCUS REVIEW · ${esc(cfg.review||'Manual')}</div><h1 class="page-title">Review your progress.</h1><p class="lead">Suggestions use your recent logged sets, stated priorities and reported soreness. Nothing changes without approval.</p>
      ${card(`<h3>Training balance · last 7 days</h3>${r.rows.map(x=>`<div class="rr160-review-row"><div><strong>${x.name}</strong><small>${x.note}</small></div><div><b>${x.actual} / ${x.target}</b><small>sets · illustrative target</small></div></div>`).join('')}<p class="fineprint">Targets are approximate, and a compound lift can contribute to more than one muscle group.</p>`,'section')}
      ${card(`<h3>Suggested priority changes</h3>${r.rows.filter(x=>x.level!==x.proposed).length?r.rows.filter(x=>x.level!==x.proposed).map(x=>`<div class="session-row"><strong>${x.name}</strong><small>${levelsList[x.level] || x.level} → ${levelsList[x.proposed] || x.proposed}</small></div>`).join(''):'<p class="subhead">Your current muscle priorities look reasonable based on the logged training and readiness data.</p>'}
        <div class="stack mt16"><button type="button" class="btn primary full" data-action="accept-adaptive-review">Accept suggestions</button><button type="button" class="btn outline full" data-action="adjust-adaptive-focus">Adjust focus manually</button><button type="button" class="btn text full" data-action="dismiss-adaptive-review">Dismiss this review</button></div>`,'section')}`;
  }
  function adaptiveStatusCard(){
    const adapt = window.RepRivalAdaptive || {};
    const templates = adapt.TEMPLATES || {};
    const cfg = profile().adaptive;
    if(!cfg?.active) return '';
    const reviewAt = typeof adapt.nextReviewDay === 'function' ? adapt.nextReviewDay(cfg) : null;
    const day = planFor('A'), exercises = (day.pairs||[]).flatMap(p=>p.exercises), sets = exercises.reduce((n,e)=>n+e.sets,0);
    const templateObj = templates[cfg.template] || (profile().adaptivePresets||[]).find(x=>x.id===cfg.template) || {name:'Personalised'};
    return card(`<div class="row"><div><div class="eyebrow">YOUR ADAPTIVE PLAN</div><h3 class="mt8">${esc(templateObj.name)}</h3></div><span class="label-tag">ACTIVE</span></div>
      <div class="rr161-adaptive-stats"><span><b>${cfg.duration || 40} min</b> preferred</span><span><b>${exercises.length} exercises</b> next session</span><span><b>${sets} sets</b> planned</span></div>
      <p class="subhead mt12">${esc(cfg.lastReason||'Built around your priorities and available equipment.')}</p>
      <p class="fineprint">Space: ${cfg.space==='large'?'Room to move':'Compact'} · Review: ${reviewAt?esc(reviewAt):'when requested'}</p>
      <div class="rr161-management"><button type="button" class="btn primary" data-action="regenerate-adaptive" ${state.active?'disabled':''}>↻ New workout</button><button type="button" class="btn outline" data-action="adaptive-config">Adjust plan</button><button type="button" class="btn outline" data-action="adaptive-review">Focus review</button></div>`,'section');
  }

  
  function importPlanScreen(){
    return `
      <div class="eyebrow">CUSTOM TRAINING PLAN</div>
      <h1 class="page-title">Import Excel / CSV Plan.</h1>
      <p class="lead">Upload your workout routine from a spreadsheet workbook (.xlsx, .xls, .csv). RepRival automatically organizes days, superset pairings, exercises, target reps, sets, and muscle groups.</p>

      <div class="card section rr-importer-card">
        <div class="row">
          <div>
            <div class="eyebrow">STEP 1 · TEMPLATE</div>
            <h3 class="mt4">Spreadsheet Format</h3>
          </div>
          <div class="row gap8">
            <button type="button" class="btn outline sm" data-action="download-template-xlsx">Download Excel (.xlsx)</button>
            <button type="button" class="btn outline sm" data-action="download-template-csv">Download CSV (.csv)</button>
          </div>
        </div>
        <p class="subhead mt8">
          The workbook can have sheets for each day, or rows with columns:<br>
          <code style="display:inline-block;margin-top:6px;background:#1b1f23;padding:4px 8px;border-radius:6px;color:#ff8867;font-size:11.5px;">Day | Superset | Exercise | Muscle | Sets | Reps | Load | Rest</code>
        </p>
      </div>

      <div class="card section rr-importer-upload-zone" id="planDropZone">
        <div class="rr-upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#ff552a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="40" height="40"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
        <h3>Select or drag & drop your plan file</h3>
        <p class="subhead">Accepts Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)</p>
        <input type="file" id="planFileInput" accept=".xlsx,.xls,.csv" style="display:none;" />
        <button type="button" class="btn primary mt16" data-action="browse-plan-file">Choose File from Device</button>
        <span class="rr-drop-hint">or drop file anywhere in this box</span>
        ${importError ? `<div class="rr-import-error mt12">⚠️ ${esc(importError)}</div>` : ''}
      </div>

      ${importedDraftPlan ? `
        <div class="card section rr-import-preview-card">
          <div class="row">
            <div>
              <div class="eyebrow">PARSED WORKOUT PLAN</div>
              <h2 class="mt4">${esc(importedDraftPlan.title)}</h2>
            </div>
            <span class="label-tag primary">READY TO ACTIVATE</span>
          </div>

          <div class="field mt16">
            <label for="importedPlanTitleInput">Plan Name</label>
            <input type="text" id="importedPlanTitleInput" value="${esc(importedDraftPlan.title)}" />
          </div>

          <div class="rr-import-summary-pills mt12">
            <span><b>${Object.keys(importedDraftPlan.sessions).length}</b> Days / Workouts</span>
            <span><b>${importedDraftPlan.summary?.exerciseCount || 0}</b> Total Exercises</span>
            <span><b>${(importedDraftPlan.summary?.muscles || []).length}</b> Muscle Groups</span>
          </div>

          <div class="rr-import-muscles mt12">
            ${(importedDraftPlan.summary?.muscles || []).map(m => `<span class="rr-muscle-badge">${esc(m)}</span>`).join('')}
          </div>

          <h3 class="mt20">Detected Sessions</h3>
          <div class="stack mt12">
            ${Object.entries(importedDraftPlan.sessions).map(([code, s]) => `
              <div class="session-row">
                <div>
                  <strong>${esc(s.name)}</strong>
                  <small>${s.pairs.length} supersets · ${s.pairs.flatMap(p => p.exercises).reduce((acc, e) => acc + e.sets, 0)} total sets</small>
                </div>
                <div class="rr-preview-ex-list">
                  ${s.pairs.flatMap(p => p.exercises).map(e => `<span class="tiny-pill">${esc(e.name)} (${e.sets}×${e.min}-${e.max})</span>`).join(' ')}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="stack mt20">
            <button type="button" class="btn primary full" data-action="activate-imported-plan">✓ Activate & Set As Current Plan</button>
            <button type="button" class="btn outline full" data-action="cancel-imported-plan">Discard & Cancel</button>
          </div>
        </div>
      ` : ''}

      <div class="mt20">
        <button type="button" class="btn text" data-page="plan">← Back to My Plan</button>
      </div>
    `;
  }

  function plan(){
    const current=selectedPlan===ADAPT_ID?{title:'Adaptive Training',focus:(ADAPT.TEMPLATES[profile().adaptive?.template]||(profile().adaptivePresets||[]).find(x=>x.id===profile().adaptive?.template)||{name:'Personalised focus'}).name,duration:'Continuous',days:'Fresh workout after each session'}:(window.REPRIVAL_PLAN_LIBRARY.details[selectedPlan]||window.REPRIVAL_PLAN_LIBRARY.details.pump);
    return `<div class="eyebrow">TRAINING PROGRAMME</div><h1 class="page-title">My plan.</h1><p class="lead">Edit your workouts or switch focus without losing historical training.</p>
      ${card(`<div class="rr-element-mode-header"><div><div class="eyebrow">TRAINING MODE</div><h3>${adaptivePlan()?'Adaptive active':'My programme active'}</h3><p class="subhead">${adaptivePlan()?'Your former rotation is paused at '+esc(profile().adaptive?.pausedPlan?.next||'A')+'.':'Your existing rotation stays exactly as it is until you switch.'}</p></div><span class="label-tag">${adaptivePlan()?'ADAPTIVE':'PROGRAMME'}</span></div><div class="rr-element-mode-actions"><button type="button" class="btn primary" data-action="${adaptivePlan()?'adaptive-disable':'adaptive-enable'}" ${state.active?'disabled':''}>${adaptivePlan()?'Resume programme':'Switch to Adaptive'}</button><button type="button" class="btn outline" data-action="adaptive-studio">Exercise preferences & focus</button></div>`,'section')}
      ${card(`<div class="row"><h3>${esc(current.title)}</h3><span class="label-tag">ACTIVE</span></div><p class="subhead mt12">${esc(current.focus)} · ${esc(current.duration)} · ${esc(current.days)}</p><div class="stack mt16">${btn('Edit workouts','designer','primary full')}${btn('Adaptive exercise preferences','adaptive-studio','outline full')}${btn('Import Excel / CSV plan','page-import-plan','primary full')}
      ${btn('Browse training plans','library','outline full')}${btn('Your equipment','equipment','outline full')}${btn('Explore 146 movements','exercises','outline full')}<button type="button" class="btn outline full text-danger mt8" data-action="cancel-plan">✕ Cancel current plan</button></div>`,'section')}
      ${adaptiveStatusCard()}
      ${card(`<h3>${adaptivePlan()?'Upcoming generated session':'Current rotation'}</h3>${SESSION_ORDER.map(id=>`<div class="session-row"><div><strong>${esc(planFor(id).name||'Workout '+id)}</strong><small>${planFor(id).pairs.length} blocks · ${buildTasks(id).length} working sets</small></div><span class="label-tag">${state.next===id?'Next':'Scheduled'}</span></div>`).join('')}`,'section')}
      ${card(`<h3>Plan start & consistency target</h3><p class="subhead">The seven-day training week begins on your plan start date, not necessarily Monday.</p><form class="stack mt12" id="planTimingForm"><div class="form-grid"><div class="field"><label>Plan start date</label><input type="date" name="start" required value="${esc(tracking().start)}"></div><div class="field"><label>Workouts per 7 days</label><input type="number" name="goal" min="1" max="7" value="${tracking().weeklyGoal}" required></div></div><button class="btn outline full" type="submit">Update training schedule</button></form>`,'section')}
      ${card(`<h3>Recovery countdown</h3><p class="subhead">A planning guide counted from the end of your most recent completed workout, not a measurement of muscle readiness. The automatic setting uses 48 hours after most sessions, or 72 hours when you mark one as tiring.</p><form id="recoverySettingsForm" class="stack mt12"><div class="field"><label>Recovery window</label><select name="recoveryHours"><option value="auto" ${![24,36,48,72].includes(Number(profile().recoveryHours))?'selected':''}>Automatic (48h / 72h if tired)</option>${[24,36,48,72].map(h=>`<option value="${h}" ${Number(profile().recoveryHours)===h?'selected':''}>${h} hours</option>`).join('')}</select></div><button class="btn outline full" type="submit">Save recovery preference</button></form>`,'section')}
      ${card(`<h3>Training focus</h3><p class="subhead">Your active programme defines the training goal and workouts. For a different focus, switch plans in the library. Running can fit around rest days but is not counted as a strength workout.</p><p class="fineprint">Previously saved Main Focus / Include Cardio preferences are retained in backups, but they did not change training recommendations; the unused controls have been removed.</p>`,'section')}
      ${card(`<h3>Your local data</h3><p class="subhead">Workouts are stored on this device, separately for each profile. Export a backup before a major update or changing devices.</p><div class="stack mt16">${btn('Export complete backup (JSON)','export','outline full')}<label class="btn outline full" for="backupFile">Import backup (JSON)</label><input id="backupFile" type="file" accept="application/json,.json" style="display:none">${card(`<div class="row"><div><span class="eyebrow" style="margin-bottom:2px">BRAND IDENTITY</span><h3>Two Shadowed Rs</h3></div><span class="label-tag">NEW LOGO</span></div><p class="subhead mt8">Upgraded athletic monogram featuring two forward-leaning shadowed Rs representing personal rivalry against your baseline.</p><button type="button" class="btn outline full mt12" data-action="logo-showcase">Preview Twin-R Logo & Scales →</button>`,'section')}      ${canImportOwnerBaseline()?btn('Import 17 Oct Workout A baseline','import-v5','outline full'):''}</div>`,'section')}`;
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
      ${card(`<h3>My account</h3>${btn('Edit my body metrics','metrics','outline full')}${btn('Populate 10 preview workouts','seed-workouts','outline full')}${btn('Export all profiles','export','outline full')}`,'section')}`;
  }
  function accountScreen(){return `<div class="eyebrow">YOUR ACCOUNT</div><h1 class="page-title">${esc(profile().username)}</h1>${card(`<h3>Profile settings</h3><div class="stack mt12">${btn('My body metrics','metrics','outline full')}${btn('Populate 10 preview workouts','seed-workouts','outline full')}${btn('Switch athlete','switch-list','outline full')}${btn('Export backup','export','outline full')}</div>`,'section')}${card(`<h3>Other local profiles</h3>${profileTable()}`,'section')}<p class="art-attribution">Exercise illustrations by Bryl Lim, based on Everkinetic artwork · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.</p>`;}
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
    const dumbbells = getAvailableDumbbellLoads();
    return `<div class="eyebrow">YOUR TRAINING SETUP</div><h1 class="page-title">Your equipment.</h1><p class="lead">Choose what you can actually use. Plans and the exercise catalogue will adapt to your kit; past sessions and your current plan are never automatically rewritten.</p>
      ${card(`<div class="row"><h3>Dumbbell Weight Inventory</h3><span class="label-tag">${dumbbells.length} weights</span></div>
        <form id="equipmentForm" class="stack mt12">
          <div class="field">
            <label style="font-weight:700; color:#f5ede6; font-size:13px;">Available Dumbbell Weights (kg per dumbbell)</label>
            <p class="fineprint" style="margin:4px 0 8px 0; color:#94a3b8;">Enter available hex/fixed dumbbell weights separated by commas or spaces. All dumbbell exercises (bench press, rows, curls, etc.) are logged and displayed per dumbbell. Overload recommendations and steppers strictly follow these available weights.</p>
            <input name="dumbbellInventory" value="${esc(dumbbells.join(', '))}" class="input" style="font-size:15px; font-weight:600; padding:10px;" required>
          </div>
          <div class="inventory-preview" style="background:#161a20; border:1px solid #2a313d; border-radius:10px; padding:12px; margin:8px 0;">
            <div style="font-size:12px; color:#cbd5e1; margin-bottom:4px;"><strong>Available Weights per Dumbbell:</strong></div>
            <div style="font-size:13px; font-weight:600; color:#d97241;">${dumbbells.map(w => w + ' kg').join(' · ')}</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:6px;">Training volume automatically accounts for two dumbbells when calculating total kg volume without changing your logged per-dumbbell weight.</div>
          </div>
          <div class="row mt16"><h3>Available Equipment at Your Location</h3><span class="label-tag">${owned.length} selected</span></div>
          ${groups.map(group=>`<fieldset class="equipment-group"><legend>${esc(group)}</legend>${Object.entries(lib.gear).filter(([,g])=>g.group===group).map(([id,g])=>`<label class="equipment-choice"><input type="checkbox" name="equipment" value="${esc(id)}" ${owned.includes(id)?'checked':''}><span>${esc(g.name)}</span></label>`).join('')}</fieldset>`).join('')}
          <button class="btn primary full" type="submit" style="margin-top:16px;">Save My Equipment &amp; Dumbbell Inventory</button>
        </form>
        <p class="fineprint mt8">Bodyweight-only movements are always available. Selection is private to this profile.</p>`,'section')}
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
    const importBanner = card(`<div class="row"><div><div class="eyebrow">CUSTOM SPREADSHEETS</div><h3>Upload your own split</h3><p class="subhead mt4">Import workouts directly from Excel (.xlsx) or CSV.</p></div><button type="button" class="btn primary" data-action="page-import-plan">Import Plan</button></div>`,'section');
    const library=window.REPRIVAL_PLAN_LIBRARY,owned=profile().equipment||[];
    const list=Object.entries(library.details).map(([id,d])=>({id,d,build:library.build(id,owned)}));
    const available=list.filter(x=>x.build.compatible),locked=list.filter(x=>!x.build.compatible);
    const makeCard=({id,d,build})=>card(`<div class="row"><div><div class="eyebrow">${esc(d.split)}</div><h3 class="mt8">${esc(d.title)}</h3></div>${selectedPlan===id?'<span class="label-tag">ACTIVE</span>':build.compatible?'<span class="label-tag">AVAILABLE</span>':'<span class="label-tag">NEEDS KIT</span>'}</div><p class="subhead mt12">${esc(d.description)}</p><p class="fineprint">${esc(d.duration)} · ${esc(d.days)} · ${Object.keys(build.days).length} workouts</p>${!build.compatible?`<p class="fineprint"><strong>Missing:</strong> ${esc(build.missing.map(gearName).join(', '))} · <a href="#" data-action="equipment">Update your equipment</a></p>`:''}
      <details class="mt12"><summary>View exercises & workout structure</summary>${Object.values(build.days).map(w=>`<div class="programme-day"><strong>${esc(w.name)}</strong>${w.pairs.flatMap(p=>p.exercises).map(e=>`<span>${esc(e.name)} · ${e.sets}×${e.min}–${e.max}</span>`).join('')}</div>`).join('')}</details><div class="mt16">${selectedPlan===id?'<span class="subhead">Your current plan</span>':`<button class="btn ${build.compatible?'primary':'outline'} full" data-action="activate-plan" data-id="${esc(id)}" ${(!build.compatible||state.active)?'disabled':''}>${build.compatible?'Choose this programme':'Equipment needed'}</button>`}</div>`,'section');
    return `<div class="eyebrow">WORKOUT LIBRARY</div><h1 class="page-title">Programmes for your kit.</h1><p class="lead">${list.length} distinct programme templates, including push/pull/legs, upper/lower and a five-day bro split. Each workout has its own exercise selection.</p>
      ${card(`<div class="row"><h3>Adaptive Training · build your own focus</h3><span class="label-tag">NEW</span></div><p class="subhead mt12">Choose a template, set your muscle priorities, then let RepRival prepare the next session from your history and recovery.</p><div class="mt16"><button type="button" class="btn primary full" data-action="adaptive-config">Set up Adaptive Training →</button></div>`,'section')}
      ${card(`<div class="row"><h3>Based on your equipment</h3><span class="label-tag">${available.length} available</span></div><p class="subhead">Equipment is saved per athlete. Adding a new piece of kit unlocks more exercises and programmes.</p><div class="stack mt12">${btn('Change my equipment','equipment','outline full')}${btn('Browse all 146 movements','exercises','outline full')}</div>`,'section')}
      ${importBanner}
      ${available.map(makeCard).join('')}${locked.length?`<div class="eyebrow section">MORE PROGRAMMES · NEED ADDITIONAL KIT</div>${locked.map(makeCard).join('')}`:''}`;
  }
  function activateScreen(){const item=window.REPRIVAL_PLAN_LIBRARY.details[pendingPlan];if(!item){page='library';return libraryScreen();}const suggested=item.weekly||3;return `<div class="eyebrow">START A NEW PLAN</div><h1 class="page-title">${esc(item.title)}</h1><p class="lead">Choose when your 7-day training week begins. Your previous workouts remain saved.</p>${card(`<form id="activatePlanForm" class="stack"><div class="field"><label>Plan start date</label><input type="date" name="start" value="${todayLocal()}" required></div><div class="field"><label>Weekly workout target</label><input type="number" name="goal" min="1" max="7" value="${suggested}" required></div><p class="fineprint">For example, a Saturday start means Saturday–Friday training weeks. Your history from earlier plans is preserved.</p><button class="btn primary full" type="submit">Activate plan →</button>${btn('Cancel','library','outline full')}</form>`,'section')}`;}
  
  function cloudBanner(){
    const cloud = window.RepRivalCloud;
    const user = cloud?.getCurrentUser();
    if(!user){
      return card(`
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:22px">☁️</span>
            <div>
              <strong style="display:block;font-size:14px;color:#f9f1e9">Sync Across Phone & Laptop</strong>
              <small style="color:#aaa09d;font-size:11px">Sign in with Google to use the same profile and workouts on all your devices.</small>
            </div>
          </div>
          <button type="button" class="btn primary" data-action="auth-modal" data-mode="login" style="padding:7px 14px;font-size:12px;white-space:nowrap">Log In / Sign Up</button>
        </div>
      `,'section');
    }
    const isOwnerAdmin = user.email?.toLowerCase() === 'zebob85@gmail.com';
    return card(`
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#85cc9e;box-shadow:0 0 8px #85cc9e"></span>
          <div>
            <div style="display:flex;align-items:center;gap:6px">
              <strong style="font-size:13px;color:#f9f1e9">${esc(user.displayName||user.email)}</strong>
              <span class="label-tag" style="font-size:9px">${isOwnerAdmin?'Head Coach · Admin':'Athlete'}</span>
            </div>
            <small style="color:#85cc9e;font-size:11px">✓ Synced across laptop & phone · ${state.history.length} workouts</small>
          </div>
        </div>
        <button type="button" class="btn outline" data-action="cloud-logout" style="padding:4px 9px;font-size:11px">Sign out</button>
      </div>
    `,'section');
  }

  async function handleCloudLogin(){
    if(!window.RepRivalCloud){
      showToast('Cloud service initializing, please wait a moment...');
      return;
    }
    try{
      showToast('Opening Google Sign-In...');
      const user = await window.RepRivalCloud.signIn();
      if(user){
        await syncWithCloudUser(user);
      }
    }catch(err){
      console.error('Sign-in error:', err);
      showToast('Sign-in was cancelled or encountered an error.');
    }
  }

  async function handleCloudLogout(){
    if(!window.RepRivalCloud) return;
    try{
      await window.RepRivalCloud.signOutUser();
      showToast('Signed out from Google account.');
      render();
    }catch(err){
      console.error('Sign-out error:', err);
    }
  }

  async function syncWithCloudUser(user){
    if(!user) return;
    const isOwnerAdmin = user.email?.toLowerCase() === 'zebob85@gmail.com';
    const profileId = 'user-' + user.uid;
    const role = isOwnerAdmin ? 'admin' : 'athlete';
    const username = user.displayName || (isOwnerAdmin ? 'Head Coach (Admin)' : user.email.split('@')[0]);

    // Ensure profile exists in local manager
    if(!manager.profiles[profileId]){
      manager.profiles[profileId] = {
        username: username,
        pin: '1234',
        role: role,
        email: user.email,
        cloudUid: user.uid,
        training: defaults(),
        body: { unit: 'kg', heightUnit: 'cm', waistUnit: 'cm', measurements: [] },
        equipment: [...window.REPRIVAL_EXERCISE_LIBRARY.ownerDefault],
        planId: 'pump',
        plans: { pump: structuredClone(PLAN) },
        selectedMovements: ['A:low_incline_db_press','B:flat_db_bench_press']
      };
    } else {
      manager.profiles[profileId].role = role;
      manager.profiles[profileId].username = username;
      manager.profiles[profileId].email = user.email;
    }

    activeProfile = profileId;
    manager.last = profileId;
    ensureTraining();

    // Sync cloud workouts
    try{
      const cloudWorkouts = await window.RepRivalCloud.loadWorkouts();
      if(cloudWorkouts && cloudWorkouts.length){
        const existingIds = new Set(state.history.map(w => String(w.id)));
        for(const cw of cloudWorkouts){
          if(!existingIds.has(String(cw.id))){
            state.history.push(cw);
            existingIds.add(String(cw.id));
          }
        }
        state.history.sort((a,b) => new Date(a.endedAt||a.startedAt).getTime() - new Date(b.endedAt||b.startedAt).getTime());
      } else if(state.history.length > 0){
        // First device login: backup existing local workouts to the cloud
        await window.RepRivalCloud.syncLocalWorkoutsToCloud(state.history);
      }

      // Sync Adaptive preferences and paused programme cursor separately from workouts.
      try {
        const remote=await window.RepRivalCloud.loadAdaptiveConfig?.();
        const local=profile().adaptive;
        const remoteDate=Date.parse(remote?.updatedAt||'')||0;
        const localDate=Date.parse(local?.updatedAt||'')||0;
        if(remote && (!local || remoteDate>localDate)){
          profile().adaptive=remote;
          if(!state.active){
            if(remote.active){
              profile().planId=ADAPT_ID;selectedPlan=ADAPT_ID;SESSION_ORDER=['A'];
              createAdaptiveNext(remote.variant||0);
              profile().planTracking={planId:ADAPT_ID,start:remote.startedAt||todayLocal(),weeklyGoal:remote.frequency||3};
            }else if(selectedPlan===ADAPT_ID){
              resumePausedProgramme();
            }
          }
        }else if(local && localDate>remoteDate){
          await window.RepRivalCloud.saveAdaptiveConfig?.(structuredClone(local));
        }
      }catch(err){console.warn('Adaptive preferences could not be synced; local settings preserved',err);}

      // Attach real-time listener for multi-device sync
      window.RepRivalCloud.subscribeToWorkouts((workouts) => {
        if(!workouts) return;
        let changed = false;
        const currentIds = new Set(state.history.map(w => String(w.id)));
        for(const w of workouts){
          if(!currentIds.has(String(w.id))){
            state.history.push(w);
            currentIds.add(String(w.id));
            changed = true;
          }
        }
        if(changed){
          state.history.sort((a,b) => new Date(a.endedAt||a.startedAt).getTime() - new Date(b.endedAt||b.startedAt).getTime());
          save();
          render();
        }
      });
    }catch(e){
      console.warn('Workout sync notice:', e);
    }

    save();
    page = 'home';
    render();
    showToast(`Welcome ${username}! Profile & workouts synced.`);
  }

  function render(){
    // Graphite is now the unified app appearance. Preserve all page rendering,
    // exercise/recovery state and existing functional interaction semantics.
    if(document.body?.classList)document.body.classList.add('rr-graphite-home');
    const elementSheet=document.getElementById?.('rr-element-sheet');
    if(elementSheet)elementSheet.disabled=true;
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
    else if(page==='adaptive-studio')body=adaptiveStudioScreen();
    else if(page==='adaptive-setup')body=adaptiveSetupScreen();
    else if(page==='adaptive-review')body=adaptiveReviewScreen();
    else if(page==='metrics')body=metricsScreen();
    else if(page==='home')body=home();
    else if(page==='workout-intro')body=workoutLanding();
    else if(page==='workout')body=workout();
    else if(page==='progress')body=progress();
    else if(page==='movement-trends'){page='progress';progressTab='movements';body=progress();}
    else if(page==='readiness')body=readinessScreen();
    else if(page==='muscle-detail')body=muscleDetailScreen();
    else if(page==='leagues'){page='home';body=home();}
    else if(page==='plan')body=plan();
    else if(page==='summary')body=summary();
    else if(page==='import-plan')body=importPlanScreen();
    else if(page==='edit-history')body=editHistoryScreen();
    else body=home();
    shell(body);
    if(page==='progress'&&progressTab==='movements'&&trendEditing&&trendSearchQuery){
      let count=0;document.querySelectorAll('.rr162-trend-choice').forEach(row=>{const match=(row.dataset.trendName||'').includes(trendSearchQuery.toLocaleLowerCase());row.hidden=!match;if(match)count++;});
      const empty=document.querySelector('.rr162-trend-empty-search');if(empty)empty.hidden=count!==0;
    }
    if(page==='progress'&&progressTab==='records'){
      const search = document.querySelector('#prSearchInput');
      if(search){
        search.addEventListener('input', e => {
          const q = e.target.value.toLowerCase().trim();
          document.querySelectorAll('#prListContainer .pr-card-item').forEach(card => {
            card.style.display = card.dataset.search.includes(q) ? 'flex' : 'none';
          });
        });
      }
    }
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
    if(!next){
      state.active.stage='feedback';
      state.active.restUntil=null;
      save();
      render();
      return;
    }
    const prescribed=prior.pair.id===next.pair.id?calcRest(prior.pair,rir):Math.max(60,calcRest(prior.pair,rir));
    const seconds=adjustedRestSeconds(prescribed,false);
    state.active.stage='rest';
    state.active.restSeconds=seconds;
    state.active.restNote=prior.pair.id===next.pair.id?'Rest between rounds':'Next block coming up';
    state.active.restUntil=Date.now()+seconds*1000;
    save();
    render();
  }

  let isSubmittingSet = false;
  function submitSet(form){
    if(isSubmittingSet) return;
    const a = state.active;
    if(!a || a.stage !== 'lift') return;
    isSubmittingSet = true;
    const submitBtn = form && typeof form.querySelector === 'function' ? form.querySelector('button[type="submit"]') : null;
    if(submitBtn){
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving set...';
    }

    try {
      const pairs = currentSessionPairs();
      const tasks = buildTasks(a.session, pairs);
      const group = fullRound(tasks, a.taskIndex);
      const activeItems = group.items.filter(t => !a.logs[t.index]?.skipped);
      const data = form instanceof FormData ? form : (form && typeof form.querySelector === 'function' ? new FormData(form) : (form && typeof form.get === 'function' ? form : new FormData()));
      let values = [];

      for(const t of activeItems){
        const ex = t.ex, idx = t.index;
        const res = resolveSetValues(t, a);

        // Weight validation and resolution
        const hasWeightField = data.has ? data.has(`weight-${idx}`) : (data.get && data.get(`weight-${idx}`) !== undefined);
        const rawWeightStr = hasWeightField ? String(data.get(`weight-${idx}`) ?? '').trim() : (res.weight !== undefined && res.weight !== '' ? String(res.weight) : '');
        const allowsZero = ex.load === 'bodyweight' || ex.load === 'optional' || permitsBodyweight(ex);
        const weight = ex.load === 'bodyweight' ? 0 : (rawWeightStr !== '' ? num(rawWeightStr) : (res.weight !== undefined ? num(res.weight) : 0));

        // Reps validation and resolution
        const hasRepsField = data.has ? data.has(`reps-${idx}`) : (data.get && data.get(`reps-${idx}`) !== undefined);
        const rawRepsStr = hasRepsField ? String(data.get(`reps-${idx}`) ?? '').trim() : (res.reps !== undefined && res.reps !== '' ? String(res.reps) : '');
        const reps = rawRepsStr !== '' ? parseInt(rawRepsStr, 10) : (res.reps ? parseInt(res.reps, 10) : ex.min);

        // RIR validation and resolution
        const hasRirField = data.has ? data.has(`rir-${idx}`) : (data.get && data.get(`rir-${idx}`) !== undefined);
        const rawRirVal = hasRirField ? data.get(`rir-${idx}`) : (res.rir !== undefined && res.rir !== '' ? res.rir : 2);
        const rir = (rawRirVal !== null && rawRirVal !== undefined && rawRirVal !== '') ? parseInt(rawRirVal, 10) : 2;

        if((!allowsZero && (rawWeightStr === '' || weight <= 0)) || weight < 0 || !Number.isInteger(reps) || reps < 1 || reps > 99 || !Number.isInteger(rir) || rir < 0 || rir > 5){
          showToast('Check weight, reps and RIR for each active exercise.');
          isSubmittingSet = false;
          if(submitBtn){
            submitBtn.disabled = false;
            submitBtn.textContent = 'Log & Start Rest →';
          }
          return;
        }

        values.push({
          t,
          log: {
            exId: ex.id,
            name: ex.name,
            muscle: ex.muscle,
            weight,
            reps,
            rir,
            load: ex.load,
            pair: t.pair.id,
            round: t.round,
            loggedAt: new Date().toISOString(),
            // Capture specific recommendation followed
            recommendation: {
              weight: res.rec.weight,
              reps: res.rec.reps,
              reason: res.rec.reason
            },
            targetAchieved: (ex.load === 'bodyweight' || weight >= (Number(res.rec.weight) || 0)) && (reps >= (Number(res.rec.reps) || 0))
          }
        });
      }

      const pbEvents = [];
      for(const {t, log} of values){
        const prev = bestByExercise([...allLogs(), ...a.logs.filter((_, i) => i !== t.index)])[log.exId];
        if(prev && score(log) > score(prev) + 0.000001) pbEvents.push({ex: t.ex, log, prev});
      }

      for(const {t, log} of values) a.logs[t.index] = log;

      a.drafts = a.drafts || {};
      for(const t of group.items){
        delete a.drafts[`weight-${t.index}`];
        delete a.drafts[`reps-${t.index}`];
        delete a.drafts[`rir-${t.index}`];
      }

      a.taskIndex = group.end + 1;
      while(a.taskIndex < tasks.length && a.logs[a.taskIndex]){
        a.taskIndex++;
      }

      const next = tasks[a.taskIndex];
      if(pbEvents.length) celebratePB(pbEvents[0].ex, pbEvents[0].log, pbEvents[0].prev);

      // On final set of workout (or when all sets completed/skipped), do NOT enter rest; prompt directly to finish workout.
      if(!next || a.taskIndex >= tasks.length || a.logs.filter(Boolean).length >= tasks.length){
        a.stage = 'feedback';
        a.restUntil = null;
        save();
        render();
        return;
      }

      advanceWithRest(group.task, next, Math.min(...values.map(v => v.log.rir)));
    } finally {
      setTimeout(() => { isSubmittingSet = false; }, 300);
    }
  }

  function importV5Baseline(){
    if(!canImportOwnerBaseline()){
      if(state.history.some(x=>x.source==='pumpplan-v5'||x.id==='v5-baseline-2026-10-17')){
        showToast('V5 baseline is already in your workout history');
      } else {
        showToast('This import is not available for demo profiles');
      }
      return;
    }
    if(!Array.isArray(window.REPQUEST_V5_BASELINE)){
      showToast('V5 baseline data is missing');
      return;
    }
    const logs=structuredClone(window.REPQUEST_V5_BASELINE);
    const finished={id:'v5-baseline-2026-10-17',source:'pumpplan-v5',session:'A',startedAt:'2026-10-17T08:00:00.000Z',endedAt:'2026-10-17T08:40:00.000Z',logs,feeling:'normal',recovery:48,prs:[]};
    state.history.push(finished);
    if(window.RepRivalCloud && window.RepRivalCloud.getCurrentUser()) { window.RepRivalCloud.saveWorkout(finished); }
    state.history.sort((a,b)=>new Date(a.endedAt)-new Date(b.endedAt));
    if(state.history.length===1)state.next='B';
    save();render();showToast('Imported 18 individual sets from V5!');
  }  function exportBackup(){
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
    if(!safeConfirm(`Activate ${lib.details[id].title}? Your previous completed sessions and personal bests will remain saved.`))return;
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
    if(link){const dest=link.dataset.page;page=dest==='workout'?'workout-intro':dest==='movement-trends'?'progress':dest;if(dest==='progress'&&!progressTab)progressTab='overview';if(dest==='movement-trends')progressTab='movements';render();window.scrollTo({top:0,left:0,behavior:'instant'});return;}
    const muscle=e.target.closest('[data-muscle]');if(muscle){state.settings.selectedMuscle=muscle.dataset.muscle;page='muscle-detail';render();return;}
    const el=e.target.closest('[data-action]');if(!el)return;
    const action=el.dataset.action;
    if (action === 'spotlight-metric') {
      state.settings.spotlightMetric = el.dataset.metric;
      save(); render(); return;
    }
    if (action === 'explain-1rm') {
      openModal(`
        <div class="modal-header">
          <div class="eyebrow">STRENGTH ESTIMATION</div>
          <h2 class="mt8">Estimated 1RM</h2>
          <p class="subhead">How RepRival tracks your strength progress.</p>
        </div>
        <div class="modal-body mt16">
          <p>To measure strength without testing a dangerous 1-rep maximum, we use <strong>Epley's Formula</strong> to estimate your peak capacity based on your best working set:</p>
          <div class="card mt12 mb12" style="background:var(--soft); border-color:var(--edge);">
            <code style="display:block; text-align:center; font-size:1.2rem; color:var(--accent);">Weight × (1 + Reps / 30)</code>
          </div>
          <p>For example, if you lift 100 kg for 10 reps, your Estimated 1RM is 133 kg. This allows RepRival to compare sets with different weights and repetitions fairly.</p>
          <div class="mt20">${btn('Close','close-modal','primary full')}</div>
        </div>
      `);
      return;
    }
    if (action === 'open-holiday-modal') {
      openHolidayModal();
      return;
    }
    if (action === 'confirm-activate-holiday') {
      const modeSel = document.querySelector('#holidayModeStyleSelect');
      const locInput = document.querySelector('#holidayLocationInput');
      const weeksSel = document.querySelector('#holWeeksSelect');
      const freqSel = document.querySelector('#holFreqSelect');
      const durSel = document.querySelector('#holDurSelect');
      const gearSel = document.querySelector('#holGearSelect');
      const envSel = document.querySelector('#holEnvSelect');

      const selectedMode = modeSel?.value || 'plan';
      const loc = locInput?.value?.trim() || 'Beach Holiday';

      let holidayPlan = null;
      if (selectedMode === 'plan') {
        holidayPlan = holidayProgramDraft || generateHolidayProgram({
          weeks: Number(weeksSel?.value || 2),
          frequency: Number(freqSel?.value || 3),
          sessionDuration: Number(durSel?.value || 15),
          gearMode: gearSel?.value || 'bodyweight',
          environment: envSel?.value || 'hotel_room',
          location: loc
        });
      }

      activateHolidayMode({
        mode: selectedMode,
        location: loc,
        gearMode: gearSel?.value || 'bodyweight',
        holidayPlan: holidayPlan
      });
      closeAllModals();
      return;
    }
    if (action === 'start-holiday-session') {
      const code = el.dataset.code || 'HA';
      startHolidaySession(code);
      return;
    }
    if (action === 'confirm-exit-holiday') {
      exitHolidayMode();
      closeAllModals();
      return;
    }
    if (action === 'open-generator') {
      openOneOffGeneratorModal();
      return;
    }
    if(action==='swap-exercise'){
      const pairIdx = Number(el.dataset.pair), exIdx = Number(el.dataset.ex);
      openSwapModal(pairIdx, exIdx);
      return;
    }
    if(action==='confirm-swap'){
      const pairIdx = Number(el.dataset.pair), exIdx = Number(el.dataset.ex), exId = el.dataset.id;
      const isPermanent = !!document.querySelector('#swapPermanentCheck')?.checked;
      const lib = window.REPRIVAL_EXERCISE_LIBRARY;
      const newExTemplate = lib.byId[exId];
      if(!newExTemplate) return;
      const pairs = currentSessionPairs();
      if(pairs[pairIdx] && pairs[pairIdx].exercises[exIdx]){
        const old = pairs[pairIdx].exercises[exIdx];
        pairs[pairIdx].exercises[exIdx] = {
          id: newExTemplate.id,
          name: newExTemplate.name,
          muscle: newExTemplate.muscle,
          sets: old.sets || newExTemplate.sets || 3,
          min: newExTemplate.min,
          max: newExTemplate.max,
          load: newExTemplate.load || 'combined',
          unit: newExTemplate.unit,
          suffix: newExTemplate.suffix
        };
        updateCurrentSessionPairs(pairs);
        if(state.active){
          // Clear drafts for uncompleted tasks of this swapped exercise slot
          const tasks = buildTasks(state.active.session, pairs);
          tasks.filter(t => t.pi === pairIdx && t.ei === exIdx && !state.active.logs[t.index]).forEach(t => {
            if(state.active.drafts){
              delete state.active.drafts[`weight-${t.index}`];
              delete state.active.drafts[`reps-${t.index}`];
              delete state.active.drafts[`rir-${t.index}`];
            }
          });
        }
        if(isPermanent){
          const day = state.active?.session || state.next;
          const templatePairs = structuredClone(planFor(day).pairs || []);
          if(templatePairs[pairIdx] && templatePairs[pairIdx].exercises[exIdx]){
            templatePairs[pairIdx].exercises[exIdx] = structuredClone(pairs[pairIdx].exercises[exIdx]);
            makeSessionPairsPermanent(day, templatePairs);
          }
        }
        closeAllModals();
        render();
        showToast(isPermanent ? 'Swapped to ' + newExTemplate.name + ' permanently in routine' : 'Swapped to ' + newExTemplate.name + ' for today');
      }
      return;
    }
    if(action==='drop-exercise'){
      const pairIdx = Number(el.dataset.pair), exIdx = Number(el.dataset.ex);
      openDropModal(pairIdx, exIdx);
      return;
    }
    if(action==='confirm-drop'){
      const pairIdx = Number(el.dataset.pair), exIdx = Number(el.dataset.ex);
      const isPermanent = !!document.querySelector('#dropPermanentCheck')?.checked;
      const pairs = currentSessionPairs();
      const currentEx = pairs[pairIdx]?.exercises[exIdx];
      if(!currentEx){ closeAllModals(); return; }

      if(state.active){
        const tasks = buildTasks(state.active.session, pairs);
        const exTasks = tasks.filter(t => t.pi === pairIdx && t.ei === exIdx);
        // Find remaining uncompleted tasks for this exercise and mark as skipped
        let droppedCount = 0;
        exTasks.forEach(t => {
          if(!state.active.logs[t.index]){
            state.active.logs[t.index] = {
              exId: currentEx.id,
              name: currentEx.name,
              muscle: currentEx.muscle,
              weight: 0,
              reps: 0,
              rir: null,
              skipped: true,
              load: currentEx.load,
              pair: t.pair.id,
              round: t.round,
              loggedAt: new Date().toISOString()
            };
            droppedCount++;
          }
        });

        // If permanent, remove from master plan for future sessions only
        if(isPermanent){
          const day = state.active.session;
          const templatePairs = structuredClone(planFor(day).pairs || []);
          if(templatePairs[pairIdx]){
            if(templatePairs[pairIdx].exercises.length > 1){
              templatePairs[pairIdx].exercises.splice(exIdx, 1);
            } else if(templatePairs.length > 1){
              templatePairs.splice(pairIdx, 1);
            }
            makeSessionPairsPermanent(day, templatePairs);
          }
        }

        // Check if all tasks in workout are now resolved (completed or skipped)
        const allResolved = tasks.every(t => state.active.logs[t.index]);
        if(allResolved){
          state.active.stage = 'feedback';
          state.active.restUntil = null;
        } else {
          // Advance taskIndex to the next unresolved task
          let nextUnresolved = tasks.findIndex((t, idx) => !state.active.logs[t.index] && idx >= state.active.taskIndex);
          if(nextUnresolved === -1){
            nextUnresolved = tasks.findIndex(t => !state.active.logs[t.index]);
          }
          state.active.taskIndex = nextUnresolved !== -1 ? nextUnresolved : tasks.length;
          if(state.active.taskIndex >= tasks.length){
            state.active.stage = 'feedback';
            state.active.restUntil = null;
          } else if(state.active.stage === 'rest'){
            // If in rest, verify if current rest group still has active tasks
            const restGroup = fullRound(tasks, state.active.taskIndex);
            if(restGroup.items.every(t => state.active.logs[t.index])){
              state.active.stage = 'lift';
              state.active.restUntil = null;
            }
          }
        }
        closeAllModals();
        save();
        render();
        showToast(isPermanent ? 'Dropped exercise and updated future routine' : 'Dropped remaining sets for today');
      } else {
        // Pre-workout: remove exercise or block
        if(pairs[pairIdx].exercises.length > 1){
          pairs[pairIdx].exercises.splice(exIdx, 1);
        } else if(pairs.length > 1){
          pairs.splice(pairIdx, 1);
        }
        updateCurrentSessionPairs(pairs);
        if(isPermanent){
          const day = state.next;
          makeSessionPairsPermanent(day, pairs);
        }
        closeAllModals();
        save();
        render();
        showToast(isPermanent ? 'Removed exercise permanently from routine' : 'Exercise removed for today');
      }
      return;
    }
    if(action==='restore-exercise'){
      const pairIdx = Number(el.dataset.pair), exIdx = Number(el.dataset.ex);
      if(state.active){
        const pairs = currentSessionPairs();
        const tasks = buildTasks(state.active.session, pairs);
        const exTasks = tasks.filter(t => t.pi === pairIdx && t.ei === exIdx);
        let restoredCount = 0;
        exTasks.forEach(t => {
          if(state.active.logs[t.index]?.skipped){
            delete state.active.logs[t.index];
            restoredCount++;
          }
        });
        if(restoredCount > 0){
          if(state.active.stage === 'feedback'){
            state.active.stage = 'lift';
            state.active.restUntil = null;
          }
          let nextUnresolved = tasks.findIndex((t, idx) => !state.active.logs[t.index]);
          if(nextUnresolved !== -1){
            state.active.taskIndex = nextUnresolved;
          }
          save();
          render();
          showToast('Restored remaining sets for exercise');
        }
      }
      return;
    }
    if(action==='step-weight'){
      const idx = el.dataset.index;
      const dir = Number(el.dataset.dir);
      const input = document.querySelector(`input[name="weight-${idx}"]`);
      if(!input) return;
      const currentVal = Number(input.value) || 0;
      const tasks = buildTasks(state.active?.session || state.next);
      const t = tasks.find(x => x.index === Number(idx)) || { ex: { load: 'combined' } };
      const nextVal = stepLoad(currentVal, dir, t.ex);
      input.value = nextVal;
      if(state.active){
        state.active.drafts = state.active.drafts || {};
        state.active.drafts[`weight-${idx}`] = nextVal;
        save();
      }
      render();
      return;
    }
    if(action==='step-reps'){
      const idx = el.dataset.index;
      const dir = Number(el.dataset.dir);
      const input = document.querySelector(`input[name="reps-${idx}"]`);
      if(!input) return;
      const currentVal = Number(input.value) || 1;
      const nextVal = Math.max(1, Math.min(99, currentVal + dir));
      input.value = nextVal;
      if(state.active){
        state.active.drafts = state.active.drafts || {};
        state.active.drafts[`reps-${idx}`] = nextVal;
        save();
      }
      render();
      return;
    }
    if(action==='open-rest-edit-modal'){
      openRestEditModal();
      return;
    }
    if(action==='open-roadmap-edit-modal'){
      openRoadmapEditModal();
      return;
    }
    if(action==='open-active-exercise-edit-modal'){
      const pairIdx = Number(el.dataset.pair);
      const exIdx = Number(el.dataset.ex);
      const taskIndex = Number(el.dataset.index);
      openActiveExerciseEditModal(pairIdx, exIdx, taskIndex);
      return;
    }
    if(action==='step-weight-modal'){
      const idx = el.dataset.index;
      const dir = Number(el.dataset.dir);
      const input = document.querySelector(`input[name="modal-weight-${idx}"]`);
      if(!input) return;
      const currentVal = Number(input.value) || 0;
      const tasks = buildTasks(state.active?.session || state.next);
      const t = tasks.find(x => x.index === Number(idx)) || { ex: { load: 'combined' } };
      const nextVal = stepLoad(currentVal, dir, t.ex);
      input.value = nextVal;
      const conv = document.querySelector(`[data-modal-weight-convention="${idx}"]`);
      if(conv) conv.textContent = formatWeightConvention(nextVal, t.ex);
      if(state.active){
        state.active.drafts = state.active.drafts || {};
        state.active.drafts[`weight-${idx}`] = nextVal;
        save();
      }
      return;
    }
    if(action==='step-reps-modal'){
      const idx = el.dataset.index;
      const dir = Number(el.dataset.dir);
      const input = document.querySelector(`input[name="modal-reps-${idx}"]`);
      if(!input) return;
      const currentVal = Number(input.value) || 1;
      const nextVal = Math.max(1, Math.min(99, currentVal + dir));
      input.value = nextVal;
      if(state.active){
        state.active.drafts = state.active.drafts || {};
        state.active.drafts[`reps-${idx}`] = nextVal;
        save();
      }
      return;
    }
    if(action==='apply-overload-rest'){
      const idx = el.dataset.index;
      const w = el.dataset.weight;
      const r = el.dataset.reps;
      const wField = document.querySelector(`input[name="modal-weight-${idx}"]`);
      const rField = document.querySelector(`input[name="modal-reps-${idx}"]`);
      if(wField && w !== '') wField.value = w;
      if(rField && r !== '') rField.value = r;
      const tasks = buildTasks(state.active?.session || state.next);
      const t = tasks.find(x => x.index === Number(idx)) || { ex: { load: 'combined' } };
      const conv = document.querySelector(`[data-modal-weight-convention="${idx}"]`);
      if(conv && w !== '') conv.textContent = formatWeightConvention(w, t.ex);
      if(state.active){
        state.active.drafts = state.active.drafts || {};
        if(w !== '') state.active.drafts[`weight-${idx}`] = Number(w);
        if(r !== '') state.active.drafts[`reps-${idx}`] = Number(r);
        save();
      }
      showToast(`Applied recommendation: ${w !== '' ? w + ' kg × ' : ''}${r} reps`);
      return;
    }
    if(action==='save-rest-edit'){
      if(state.active){
        state.active.drafts = state.active.drafts || {};
        document.querySelectorAll('input[name^="modal-weight-"]').forEach(inp => {
          const idx = inp.name.replace('modal-weight-', '');
          if(inp.value !== '') state.active.drafts[`weight-${idx}`] = Number(inp.value);
        });
        document.querySelectorAll('input[name^="modal-reps-"]').forEach(inp => {
          const idx = inp.name.replace('modal-reps-', '');
          if(inp.value !== '') state.active.drafts[`reps-${idx}`] = Number(inp.value);
        });
        save();
      }
      closeAllModals();
      render();
      showToast('Targets updated');
      return;
    }
    if(action==='save-roadmap-edit'){
      const pairs = currentSessionPairs();
      pairs.forEach((p, pi) => {
        p.exercises.forEach((ex, ei) => {
          const setsInp = document.querySelector(`input[name="edit-sets-${pi}-${ei}"]`);
          const minInp = document.querySelector(`input[name="edit-min-${pi}-${ei}"]`);
          const maxInp = document.querySelector(`input[name="edit-max-${pi}-${ei}"]`);
          if (setsInp && setsInp.value) {
            const sVal = Math.max(1, Math.min(10, parseInt(setsInp.value, 10)));
            if (sVal) ex.sets = sVal;
          }
          if (minInp && minInp.value) {
            const minVal = Math.max(1, Math.min(99, parseInt(minInp.value, 10)));
            if (minVal) ex.min = minVal;
          }
          if (maxInp && maxInp.value) {
            const maxVal = Math.max(1, Math.min(99, parseInt(maxInp.value, 10)));
            if (maxVal) ex.max = Math.max(ex.min, maxVal);
          }
        });
      });
      updateCurrentSessionPairs(pairs);
      closeAllModals();
      save();
      render();
      showToast('Workout routine updated');
      return;
    }
    if(action==='finish-partial'){
      if(!state.active) return;
      state.active.stage = 'feedback';
      state.active.restUntil = null;
      save();
      render();
      return;
    }
    if(action==='close-modal'){
      closeAllModals();
      return;
    }
    if(action==='apply-overload'){
      const idx = el.dataset.index;
      const w = el.dataset.weight;
      const r = el.dataset.reps;
      const weightField = document.querySelector(`input[name="weight-${idx}"]`);
      const repsField = document.querySelector(`input[name="reps-${idx}"]`);
      if(weightField && w !== '') weightField.value = w;
      if(repsField && r !== '') repsField.value = r;
      if(state.active){
        state.active.drafts = state.active.drafts || {};
        if(w !== '') state.active.drafts[`weight-${idx}`] = Number(w);
        if(r !== '') state.active.drafts[`reps-${idx}`] = Number(r);
        save();
      }
      render();
      showToast(`Applied recommendation: ${w !== '' ? w + ' kg × ' : ''}${r} reps`);
      return;
    }
    if(action==='add-exercise'){
      const pairIdx = Number(el.dataset.pair);
      openAddModal(pairIdx);
      return;
    }
    if(action==='add-exercise'){
      const pairIdx = el.dataset.pair !== '' && el.dataset.pair != null ? Number(el.dataset.pair) : null;
      openAddModal(pairIdx);
      return;
    }
    if(action==='confirm-add'){
      const rawPair = el.dataset.pair;
      const pairIdx = rawPair !== '' && rawPair != null && !isNaN(Number(rawPair)) ? Number(rawPair) : null;
      const exId = el.dataset.id;
      const isPermanent = !!document.querySelector('#addPermanentCheck')?.checked;
      const lib = window.REPRIVAL_EXERCISE_LIBRARY;
      const template = lib.byId[exId];
      if(!template) return;
      const pairs = currentSessionPairs();
      const newExItem = {
        id: template.id,
        name: template.name,
        muscle: template.muscle,
        sets: template.sets || 3,
        min: template.min,
        max: template.max,
        load: template.load || 'combined',
        unit: template.unit,
        suffix: template.suffix
      };
      if(pairIdx != null && pairs[pairIdx]){
        pairs[pairIdx].exercises.push(newExItem);
      } else {
        pairs.push({
          id: 'block-' + Date.now().toString(36),
          restMin: 75,
          restMax: 105,
          exercises: [newExItem]
        });
      }
      updateCurrentSessionPairs(pairs);
      if(isPermanent){
        const day = state.active?.session || state.next;
        makeSessionPairsPermanent(day, pairs);
      }
      closeAllModals();
      save();
      render();
      showToast(isPermanent ? 'Added ' + template.name + ' permanently to routine' : 'Added ' + template.name + ' for today');
      return;
    }
    if(action==='reset-session-pairs'){
      if(safeConfirm('Reset today\'s workout back to default plan exercises?')){
        if(state.active) state.active.pairs = null;
        state.activeCustomPairs = null;
        save();
        render();
        showToast('Reset to default plan exercises');
      }
      return;
    }
    if(action==='swap-history-ex'){
      const exId = el.dataset.exId;
      openSwapHistoryModal(exId);
      return;
    }
    if(action==='confirm-swap-history-ex'){
      const oldEx = el.dataset.oldEx, newId = el.dataset.newId;
      const s = state.history.find(x => String(x.id) === String(state.settings.editSessionId));
      const template = window.REPRIVAL_EXERCISE_LIBRARY.byId[newId];
      if(s && template){
        s.logs.forEach(l => {
          if(l.exId === oldEx || l.name === oldEx){
            l.exId = template.id;
            l.name = template.name;
            l.muscle = template.muscle;
            l.load = template.load;
          }
        });
        save();
        closeAllModals();
        render();
        showToast('Swapped movement to ' + template.name);
      }
      return;
    }
    if(action==='drop-history-ex'){
      const exId = el.dataset.exId;
      const s = state.history.find(x => String(x.id) === String(state.settings.editSessionId));
      if(s && safeConfirm('Drop this movement from this completed workout history?')){
        s.logs = s.logs.filter(l => l.exId !== exId && l.name !== exId);
        save();
        render();
        showToast('Dropped movement from workout history');
      }
      return;
    }
    if(action==='add-history-set'){
      const exId = el.dataset.exId;
      const s = state.history.find(x => String(x.id) === String(state.settings.editSessionId));
      if(s){
        const last = [...s.logs].reverse().find(l => l.exId === exId || l.name === exId);
        if(last){
          s.logs.push(structuredClone(last));
          save();
          render();
          showToast('Added set');
        }
      }
      return;
    }
    if(action==='drop-history-set'){
      const idx = Number(el.dataset.index);
      const s = state.history.find(x => String(x.id) === String(state.settings.editSessionId));
      if(s && s.logs[idx]){
        s.logs.splice(idx, 1);
        save();
        render();
        showToast('Dropped set');
      }
      return;
    }
    if(action==='add-history-ex'){
      openAddHistoryExModal();
      return;
    }
    if(action==='confirm-add-history-ex'){
      const id = el.dataset.id;
      const template = window.REPRIVAL_EXERCISE_LIBRARY.byId[id];
      const s = state.history.find(x => String(x.id) === String(state.settings.editSessionId));
      if(s && template){
        for(let round = 1; round <= 3; round++){
          s.logs.push({
            exId: template.id,
            name: template.name,
            muscle: template.muscle,
            weight: template.load === 'bodyweight' ? 0 : 10,
            reps: template.min || 10,
            rir: 2,
            load: template.load || 'combined',
            round,
            loggedAt: s.endedAt || s.startedAt || new Date().toISOString()
          });
        }
        save();
        document.querySelector('.modal')?.remove();
        render();
        showToast('Added ' + template.name + ' to workout');
      }
      return;
    }
    if(action==='progress-tab'){progressTab=['overview','muscles','movements','records'].includes(el.dataset.tab)?el.dataset.tab:'overview';trendEditing=false;page='progress';render();window.scrollTo({top:0,left:0,behavior:'instant'});return;}
    if(action==='weight-progress-period'){const id=el.dataset.period;if(PROGRESS_PERIODS.some(x=>x[0]===id)){state.settings.progressWeightPeriod=id;save();render();}return;}
    if(action==='movement-trend-period'){const id=el.dataset.period;if(PROGRESS_PERIODS.some(x=>x[0]===id)){state.settings.movementTrendPeriod=id;save();render();}return;}
    if(action==='trend-spotlight'){const id=el.dataset.id;if(trendCollection().selected.some(m=>m.id===id)){state.settings.progressMovementId=id;save();render();}return;}
    if(action==='muscle-strength-period'){const id=el.dataset.period;if(PROGRESS_PERIODS.some(x=>x[0]===id)){state.settings.muscleStrengthPeriod=id;save();render();}return;}
    if(['designer','library','metrics','equipment','exercises'].includes(action)){page=action;render();return;}
    if(action==='adaptive-studio'||action==='adaptive-config'||action==='adaptive-setup'){page='adaptive-studio';render();return;}
    if(action==='adaptive-enable'){if(pauseProgrammeForAdaptive()){page='plan';render();showToast('Programme paused. Adaptive is active.');}return;}
    if(action==='adaptive-disable'){if(resumePausedProgramme()){page='plan';render();showToast('Your previous programme resumed where you left off.');}return;}
    if(action==='adaptive-generate'){
      if(!adaptivePlan()||state.active)return;
      const cfg=profile().adaptive;const old=structuredClone(profile().plans.adaptive||{});
      const newDay=createAdaptiveNext((cfg.variant||0)+1);
      if(!newDay){profile().plans.adaptive=old;showToast(cfg.lastReason||'No eligible movements for this focus');return;}
      persistAdaptiveConfig();page='workout-intro';render();return;
    }
    if(action==='adaptive-wizard-next'||action==='adaptive-wizard-back'){
      const steps=[...document.querySelectorAll('[data-wizard-step]')],current=steps.findIndex(step=>!step.hidden);
      const target=Math.max(0,Math.min(steps.length-1,current+(action==='adaptive-wizard-next'?1:-1)));
      steps.forEach((step,i)=>{step.hidden=i!==target;});
      document.querySelectorAll('.rr161-wizard-progress span').forEach((step,i)=>step.classList.toggle('current',i===target));
      document.querySelector('.rr161-wizard')?.scrollIntoView({block:'start',behavior:'instant'});return;
    }
    if(action==='cancel-plan'){
      if(safeConfirm('Are you sure you want to cancel your active training plan? Your workout history and personal records will remain safely saved.')){
        if(profile().adaptive) profile().adaptive.active = false;
        selectedPlan = 'pump';
        profile().planId = 'pump';
        state.active = null;
        state.activeCustomPairs = null;
        save();
        render();
        showToast('Active plan cancelled');
      }
      return;
    }
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
    if(action==='modify-trends'){trendEditing=!trendEditing;page='progress';progressTab='movements';render();return;}
    if(action==='trend-pin'){
      const id=String(el.dataset.id||''),known=trendCollection().universe.some(m=>m.id===id);if(!known)return;
      const over=profile().trendOverrides||(profile().trendOverrides={added:[],hidden:[],pinned:[]});
      const pins=new Set(over.pinned||[]);
      if(pins.has(id))pins.delete(id);else{pins.add(id);over.added=[...new Set([...(over.added||[]),id])];over.hidden=(over.hidden||[]).filter(k=>k!==id);}
      over.pinned=[...pins];save();page='progress';progressTab='movements';render();return;
    }
    if(action==='trend-select'){
      const id=String(el.dataset.id||''),movements=allMovements(),known=movements.some(m=>m.id===id);if(!known)return;
      const over=profile().trendOverrides||(profile().trendOverrides={added:[],hidden:[]});
      const keysForId=new Set(movements.filter(x=>x.id===id).map(x=>x.key));
      const autoIds=new Set(state.history.filter(s=>Date.now()-Date.parse(s.endedAt||s.startedAt||'')<=7*86400000).flatMap(s=>(s.logs||[]).map(l=>l.exId)));
      const manually=(over.added||[]).some(k=>k===id||keysForId.has(k))||(profile().selectedMovements||[]).some(k=>keysForId.has(k));
      const hidden=(over.hidden||[]).some(k=>k===id||keysForId.has(k));
      const selected=!hidden&&(manually||autoIds.has(id));
      if(selected){over.pinned=(over.pinned||[]).filter(k=>k!==id&&!keysForId.has(k));over.added=over.added.filter(k=>k!==id&&!keysForId.has(k));over.hidden=[...new Set([...over.hidden.filter(k=>!keysForId.has(k)),id])];profile().selectedMovements=(profile().selectedMovements||[]).filter(k=>!keysForId.has(k));}
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
      if(action==='remove-exercise'&&!safeConfirm(`Remove ${ex.name} from future workouts? Historical sets will remain saved.`))return;
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
      if(!safeConfirm('Restore the previous version of this plan? Completed workouts stay unchanged.'))return;
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
    if(action==='seed-workouts'){
      profile().training.history = generate10PreviewWorkouts();
      profile().training.next = 'B';
      profile().training.lastSummary = profile().training.history.at(-1)?.id || null;
      if (!profile().body.measurements || profile().body.measurements.length === 0) {
        profile().body.measurements = [
          { date: dateOnly(new Date(Date.now() - 24 * 86400000).toISOString()), kg: 78.5 },
          { date: dateOnly(new Date(Date.now() - 14 * 86400000).toISOString()), kg: 78.1 },
          { date: dateOnly(new Date(Date.now() - 1 * 86400000).toISOString()), kg: 77.8 }
        ];
      }
      state = profile().training;
      save();
      render();
      showToast('10 preview workouts loaded with real muscle exposure data');
      return;
    }
    if(action==='generate-demo'){
      if(!safeConfirm('Add 10 fictional demo-only athlete profiles? All demo PINs will be 1234. Existing profiles will be kept.'))return;
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
      if(!safeConfirm(`Permanently delete ${u.username} and their local workouts? Export a backup first.`))return;
      delete manager.profiles[id];save();render();showToast('Profile removed');return;
    }
    if(action==='home'||action==='progress'){page=action;render();}
    if(action==='start'){page='workout-intro';render();}
    if(action==='begin')startWorkout();
    if(action==='rest-skip')restSkip();
    if(action==='back-set'||action==='back-round')backSet();
    if(action==='pause'){
      if(state.active){
        if(state.active.lastStartTime){
          state.active.accumulatedTime += (Date.now() - state.active.lastStartTime) / 1000;
          state.active.lastStartTime = null;
        }
        if(state.active.stage==='rest'){state.active.stage='lift';state.active.restUntil=null;}
        save();
      }
      page='home';render();
    }
    if(action==='discard'&&state.active&&safeConfirm('Discard this unfinished workout? All sets recorded in this session will be lost.')){state.active=null;save();page='home';render();}
    if(action==='rest-add'&&state.active){state.active.restUntil+=15000;state.active.restSeconds+=15;save();render();}
    if(action==='feedback'&&state.active){state.active.stage='feedback';state.active.restUntil=null;page='workout';save();render();if(typeof window.scrollTo==='function')window.scrollTo({top:0,left:0,behavior:'instant'});return;}
    if(action==='end-early')finishPartial();
    if(action==='cancel-history-edit'){page='summary';render();return;}
    if(action==='edit-history'){state.settings.editSessionId=String(state.lastSummary||state.history.at(-1)?.id||'');page='edit-history';render();return;}
    if(action==='last-summary'){state.lastSummary=String(state.history.at(-1)?.id||'');state.settings.editSessionId=state.lastSummary;page='summary';render();}
    if(action==='review-session'){const id=el.dataset.id; if(id){state.lastSummary=id; state.settings.editSessionId=id; page='summary'; render();window.scrollTo({top:0,left:0,behavior:'instant'});return;}}
    if(action==='export')exportBackup();
    if(action==='import-v5')importV5Baseline();
    if(action==='open-generator'){openOneOffGeneratorModal();return;}
    if(action==='shuffle-generator'){
      const dur = Number(document.querySelector('#genDurationSelect')?.value || generatorDraft?.duration || 15);
      const gear = document.querySelector('#genGearSelect')?.value || generatorDraft?.gearMode || 'owned';
      const foc = document.querySelector('#genFocusSelect')?.value || generatorDraft?.focus || 'full_body';
      const sty = document.querySelector('#genStyleSelect')?.value || generatorDraft?.style || 'mixed';
      const avl = document.querySelector('#genAvailSelect')?.value || generatorDraft?.availability || 'all';
      generatorDraft = generateOneOffWorkout({ duration: dur, gearMode: gear, focus: foc, style: sty, availability: avl });
      openOneOffGeneratorModal();
      showToast('Shuffled workout exercises 🎲');
      return;
    }
    if(action==='start-oneoff-session'){
      const draft = generatorDraft || generateOneOffWorkout({
        style: profile().quickWorkoutPreference || 'mixed'
      });
      const dur = draft.duration || 15;
      const focusName = draft.focus === 'full_body' ? 'Full Body' : draft.focus === 'upper_body' ? 'Upper Body' : draft.focus === 'lower_body' ? 'Lower Body' : draft.focus;
      
      closeAllModals();
      state.active = {
        id: 'oneoff-' + Date.now(),
        session: 'Quick',
        sessionName: 'One-Off ' + focusName + ' (' + dur + 'm)',
        isOneOff: true,
        planId: 'one-off',
        pairs: structuredClone(draft.pairs),
        stage: 'lift',
        taskIndex: 0,
        logs: [],
        startedAt: new Date().toISOString()
      };
      save();
      page = 'workout';
      render();
      showToast('Started One-Off Workout. Plan rotation is protected.');
      return;
    }
    if(action==='explain-strength-trend'){showStrengthExplanationModal();return;}
    if(action==='close-modal'){closeAllModals();return;}
    if(action==='auth-modal'){showAuthModal(el.dataset.mode||'login');return;}
    if(action==='cloud-login'){showAuthModal('login');return;}
    if(action==='cloud-logout'){handleCloudLogout();return;}
    if(action==='logo-showcase'){showLogoShowcaseModal();return;}
    if(action==='clear'){showToast('Export your backup before clearing data in browser settings.');}
  });
  document.addEventListener('input',e=>{
    if(e.target?.id==='adaptiveExerciseSearch'){
      filterAdaptiveExerciseLibrary();
      return;
    }
    if(e.target.classList?.contains('rr160-focus-slider')){
      const i=Number(e.target.name.replace('level',''));const label=document.querySelector(`[data-focus-name="${i}"]`);if(label)label.textContent=ADAPT.LEVELS[Number(e.target.value)];return;
    }
    if(e.target.id==='trendSearch'){
      trendSearchQuery=e.target.value;
      const q=trendSearchQuery.trim().toLocaleLowerCase();let shown=0;
      document.querySelectorAll('.rr162-trend-choice').forEach(row=>{const match=(row.dataset.trendName||'').includes(q);row.hidden=!match;if(match)shown++;});
      const empty=document.querySelector('.rr162-trend-empty-search');if(empty)empty.hidden=shown!==0;return;
    }
    if(e.target.id==='exerciseSearch'){catalogueFilter.search=e.target.value;const start=e.target.selectionStart;render();const field=document.querySelector('#exerciseSearch');if(field){field.focus();if(start!=null)field.setSelectionRange(start,start);}return;}
    if((e.target.form?.id==='roundForm'||e.target.classList?.contains('rest-prep-input'))&&state.active){
      state.active.drafts=state.active.drafts||{};
      if(e.target.name){
        state.active.drafts[e.target.name]=e.target.value;
      }
      if(e.target.dataset?.index&&e.target.dataset?.field){
        state.active.drafts[`${e.target.dataset.field}-${e.target.dataset.index}`]=e.target.value;
      }
      save();
    }
  });
  document.addEventListener('submit',e=>{
    const id=e.target.id;
    if(id==='adaptiveForm'){
      e.preventDefault();if(state.active){state.active=null;state.activeCustomPairs=null;}
      const f=new FormData(e.target),template=String(f.get('template')),title=ADAPT.TEMPLATES[template]||(profile().adaptivePresets||[]).find(p=>p.id===template);if(!title)return;
      const levels=ADAPT.GROUPS.map((_,i)=>clamp(Number(f.get('level'+i)),0,4));
      const goal=String(f.get('goal')||'hypertrophy'),duration=Number(f.get('duration')),frequency=Number(f.get('frequency')),supersets=clamp(Number(f.get('supersets')||3),2,5),review=String(f.get('review')),start=String(f.get('start'));
      if(!['hypertrophy','strength','endurance','general'].includes(goal)||duration<20||duration>90||frequency<1||frequency>6||!Object.prototype.hasOwnProperty.call(ADAPT.PERIODS,review)||!/^\d{4}-\d{2}-\d{2}$/.test(start)){showToast('Check your plan settings');return;}
      const gear=f.getAll('gear').filter(id=>window.REPRIVAL_EXERCISE_LIBRARY.gear[id]),prev=profile().adaptive||{},cfg={...prev,active:true,template,levels,goal,duration,frequency,supersets,review,startedAt:start,running:f.has('running'),runningLoad:String(f.get('runningLoad'))==='high'?'high':'normal',runningDays:f.getAll('runningDay').map(Number),space:String(f.get('space'))==='large'?'large':'small',experience:['beginner','intermediate','advanced'].includes(f.get('experience'))?String(f.get('experience')):'intermediate',exclusions:f.getAll('exclusion').filter(x=>['carries','overhead','impact','deep_knee','floor'].includes(x)),preferred:f.getAll('preferred').filter(x=>window.REPRIVAL_EXERCISE_LIBRARY.byId[x]&&!f.getAll('avoid').includes(x)),avoid:f.getAll('avoid').filter(x=>window.REPRIVAL_EXERCISE_LIBRARY.byId[x]),sequence:prev.sequence||0};
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
      const soreMap = {};
      const soreGroups = f.getAll('soreGroup').filter(x=>SORE_GROUPS.includes(x));
      SORE_GROUPS.forEach(g => {
        const val = f.get('soreness_' + g);
        if(val && val !== 'none'){
          soreMap[g] = val;
          if(!soreGroups.includes(g)) soreGroups.push(g);
        }
      });
      const record={
        day:todayLocal(),
        fatigue:clamp(Number(f.get('fatigue'))||0,0,4),
        soreness:clamp(Number(f.get('soreness'))||0,0,4),
        sleep:['good','okay','poor'].includes(f.get('sleep'))?f.get('sleep'):'okay',
        groups: soreGroups,
        sorenessMap: soreMap
      };
      const log=readinessLog();const at=log.findIndex(x=>x.day===record.day);if(at>=0)log[at]=record;else log.push(record);log.sort((a,b)=>a.day.localeCompare(b.day));if(log.length>120)log.splice(0,log.length-120);
      save();page='home';render();showToast('Your check-in is saved');return;
    }
    if(id==='historyEditForm'){
      e.preventDefault();const s=state.history.find(x=>String(x.id)===String(state.settings.editSessionId));if(!s)return;
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
      e.preventDefault();
      const lib=window.REPRIVAL_EXERCISE_LIBRARY, f=new FormData(e.target);
      const items=[...new Set(f.getAll('equipment').map(String))];
      profile().equipment=items.filter(id=>lib.gear[id]);
      const dbRaw = String(f.get('dumbbellInventory') || '').trim();
      if(dbRaw){
        const parsed = dbRaw.split(/[\s,]+/).map(Number).filter(n => Number.isFinite(n) && n > 0);
        if(parsed.length){
          profile().dumbbellInventory = [...new Set(parsed)].sort((a,b) => a - b);
        }
      }
      save();render();showToast('Equipment and dumbbell inventory saved');return;
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
    if(e.target?.id==='adaptiveMuscleSelect'){
      adaptiveLibraryMuscle=e.target.value;
      const search=document.getElementById('adaptiveExerciseSearch');
      if(search)search.value='';
      filterAdaptiveExerciseLibrary();
      return;
    }
    if((e.target.form?.id==='roundForm'||e.target.classList?.contains('rest-prep-input'))&&state.active){
      state.active.drafts=state.active.drafts||{};
      if(e.target.name){
        state.active.drafts[e.target.name]=e.target.value;
      }
      if(e.target.dataset?.index&&e.target.dataset?.field){
        state.active.drafts[`${e.target.dataset.field}-${e.target.dataset.index}`]=e.target.value;
      }
      save();
    }
    if(e.target.matches('[data-unit]')){const form=e.target.closest('form');if(form)syncBodyFields(form,e.target.dataset.unit);return;}
    if(e.target.matches('[data-adaptive-frequency]')){
      const id=e.target.dataset.adaptiveFrequency;
      const cfg=profile().adaptive||(profile().adaptive={});
      cfg.exerciseFrequency=cfg.exerciseFrequency||{};cfg.exerciseFrequency[id]=Number(e.target.value);
      persistAdaptiveConfig();return;
    }
    if(e.target.matches('[data-adaptive-default-focus]')){
      const cfg=profile().adaptive||(profile().adaptive={});cfg.focus=e.target.value;persistAdaptiveConfig();return;
    }
    if(e.target.matches('[data-adaptive-next-focus]')){
      const cfg=profile().adaptive||(profile().adaptive={});cfg.nextFocus=e.target.value||null;persistAdaptiveConfig();return;
    }
    if(e.target.matches('[data-adaptive-blocks]')||e.target.matches('[data-adaptive-weekly]')){
      const cfg=profile().adaptive||(profile().adaptive={});
      cfg[e.target.matches('[data-adaptive-blocks]')?'supersets':'frequency']=Number(e.target.value);
      persistAdaptiveConfig();return;
    }
    if(e.target.id==='adaptiveTemplate'){
      const t=ADAPT.TEMPLATES[e.target.value]||(profile().adaptivePresets||[]).find(p=>p.id===e.target.value);if(!t)return;
      document.querySelectorAll('.rr160-focus-slider').forEach((input,i)=>{input.value=t.levels[i];document.querySelector(`[data-focus-name="${i}"]`).textContent=ADAPT.LEVELS[t.levels[i]];});
      const desc=document.querySelector('#adaptiveTemplateDesc');if(desc)desc.textContent=t.desc;return;
    }
    if(e.target.id==='adaptiveExerciseSearch')return;
    if(e.target.id==='exerciseMuscle'){catalogueFilter.muscle=e.target.value;render();return;}
    if(e.target.id==='exerciseKit'){catalogueFilter.kit=e.target.value;render();return;}
    if(e.target.id==='exerciseDay'){state.settings.editDay=e.target.value;save();render();return;}
    
    if(e.target.id==='leagueArea'){leagueStore().area=e.target.value;save();render();return;}
    if(e.target.id==='rr163-movement-choice'){state.settings.progressMovementId=e.target.value;save();render();return;}
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
        localStorage.setItem(PROFILE_KEY,JSON.stringify(data));manager=data;activeProfile=data.last in data.profiles?data.last:Object.keys(data.profiles)[0];ensureTraining();page='home';render();showToast('All profiles restored from backup');return;
      }
      if(data.version===1&&Array.isArray(data.history)&&data.settings){
        profile().training=data;state=data;save();page='home';render();showToast('Old workout backup imported');return;
      }
      if(Array.isArray(data)&&data.length&&(data[0].logs||data[0].session)){
        state.history.push(...data);state.history.sort((a,b)=>new Date(a.endedAt||a.startedAt)-new Date(b.endedAt||b.startedAt));save();page='home';render();showToast(`Imported ${data.length} workout sessions`);return;
      }
      throw Error('Unrecognised backup');
    } catch(err){showToast('Could not import that backup.');}
  });
  let recoveryClockLastMinute=-1;
  let leagueMinuteLast=Math.floor(Date.now()/60000);
  function formatDuration(seconds){
    if(!Number.isFinite(seconds)) return '00:00';
    const h=Math.floor(seconds/3600), m=Math.floor((seconds%3600)/60), s=Math.floor(seconds%60);
    return (h>0?h+':':'') + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }
  function tick(){
    if(page==='leagues' && Math.floor(Date.now()/60000)!==leagueMinuteLast){leagueMinuteLast=Math.floor(Date.now()/60000);render();}
    if(page==='home' && Math.floor(Date.now()/60000)!==recoveryClockLastMinute){
      recoveryClockLastMinute=Math.floor(Date.now()/60000);
      const indicator=document.querySelector('[data-recovery-countdown]');
      if(indicator){const r=recoveryWindow();indicator.textContent=r.hasWorkout?recoveryText(r.remaining):'Starts after your first workout';}
    }
    if(state.active && state.active.lastStartTime && (page==='workout' || state.active.stage==='feedback')){
      const elapsed = state.active.accumulatedTime + (Date.now() - state.active.lastStartTime) / 1000;
      const timerEl = document.querySelector('.workout-timer-value');
      if(timerEl) timerEl.textContent = formatDuration(elapsed);
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
  
  function showLogoShowcaseModal(){
    const existing = document.querySelector('.rr-logo-dialog');
    if(existing) existing.remove();
    const dlg = document.createElement('dialog');
    dlg.className = 'rr-logo-dialog';
    dlg.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div>
          <span style="font-size:10px;color:#fa6b4e;letter-spacing:1.5px;font-weight:700">BRAND IDENTITY</span>
          <h2 style="font-size:20px;font-weight:700;color:#f9f1e9;margin:2px 0 0">RepRival · Two Shadowed Rs</h2>
        </div>
        <button type="button" class="btn outline" style="padding:4px 10px;font-size:12px" data-close-modal>✕ Close</button>
      </div>
      <div class="rr-logo-hero">
        <div class="rr-logo-emblem-wrap">
          <img src="/icon.svg" alt="RepRival Two Shadowed Rs Logo" width="160" height="160" />
        </div>
        <div style="font-size:13px;font-weight:700;color:#f9f1e9;letter-spacing:0.8px;text-align:center">
          THE RIVALRY MONOGRAM
        </div>
        <p style="font-size:11px;color:#a9a29d;text-align:center;max-width:380px;margin-top:6px;line-height:1.4">
          Two forward-slanted Rs with deep dimensional cast shadows. The lead coral R represents your current training performance; the rear graphite R represents your baseline in pursuit.
        </p>
        <div class="rr-logo-scales">
          <div class="rr-logo-scale-item">
            <img src="/icon.svg" width="20" height="20" alt="Favicon" />
            <span>16px Favicon</span>
          </div>
          <div class="rr-logo-scale-item">
            <img src="/icon.svg" width="34" height="34" alt="Header" />
            <span>34px Header</span>
          </div>
          <div class="rr-logo-scale-item">
            <img src="/icon.svg" width="56" height="56" alt="App Icon" />
            <span>64px Widget</span>
          </div>
          <div class="rr-logo-scale-item">
            <img src="/icon.svg" width="76" height="76" alt="Store Icon" />
            <span>192px PWA</span>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:#15181a;padding:10px 12px;border-radius:10px;border:1px solid #292d30">
          <div style="font-size:10px;color:#fa6b4e;font-weight:700">CHAMPION R (FRONT)</div>
          <div style="font-size:11px;color:#ccc6c2;margin-top:3px">Electric coral gradient with top specular light edge, casting shadow backwards.</div>
        </div>
        <div style="background:#15181a;padding:10px 12px;border-radius:10px;border:1px solid #292d30">
          <div style="font-size:10px;color:#859095;font-weight:700">SHADOW R (BACK)</div>
          <div style="font-size:11px;color:#ccc6c2;margin-top:3px">Matte carbon graphite with coral rim backlight and ambient underglow.</div>
        </div>
      </div>
      <button type="button" class="btn primary full" data-close-modal>Done</button>
    `;
    dlg.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('close', () => dlg.remove(), {once: true});
    dlg.addEventListener('click', e => { if(e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
    dlg.showModal();
  }

  function showAuthModal(initialMode = 'login'){
    const existing = document.querySelector('.rr-auth-dialog');
    if(existing) existing.remove();

    let mode = initialMode === 'signup' ? 'signup' : 'login';
    const dlg = document.createElement('dialog');
    dlg.className = 'rr-auth-dialog';

    function renderModalContent(){
      const isLogin = mode === 'login';
      dlg.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="/icon.svg" width="40" height="40" alt="RepRival Logo" style="border-radius:9px;box-shadow:0 3px 10px rgba(0,0,0,0.6);border:1px solid rgba(250,84,50,0.3)">
            <div>
              <span style="font-size:10px;color:#fa6b4e;letter-spacing:1.5px;font-weight:700">REPRIVAL CLOUD</span>
              <h2 style="font-size:20px;font-weight:700;color:#f9f1e9;margin:2px 0 0">
                ${isLogin ? 'Log In to Account' : 'Create Athlete Account'}
              </h2>
            </div>
          </div>
          <button type="button" class="btn outline" style="padding:4px 9px;font-size:12px" data-close-auth>✕</button>
        </div>

        <p style="font-size:12px;color:#a9a29d;margin-bottom:14px;line-height:1.4">
          ${isLogin ? 'Log in with your email & password to sync your workouts across phone and laptop.' : 'New accounts join as Athletes. Your workouts and PBs will be securely saved in Firestore.'}
        </p>

        <!-- Segmented Toggle Switch -->
        <div class="rr-auth-toggle" role="tablist">
          <button type="button" class="rr-auth-toggle-btn ${isLogin ? 'active' : ''}" id="authTabLogin">Log In</button>
          <button type="button" class="rr-auth-toggle-btn ${!isLogin ? 'active' : ''}" id="authTabSignup">Sign Up</button>
        </div>

        <form id="authEmailForm" class="stack" style="gap:12px">
          <div id="usernameFieldWrap" style="${isLogin ? 'display:none;' : ''}">
            <div class="field">
              <label for="authUsername">Athlete display name</label>
              <input id="authUsername" type="text" placeholder="e.g. Alex Hunter" autocomplete="name">
            </div>
          </div>

          <div class="field">
            <label for="authEmail">Email address</label>
            <input id="authEmail" type="email" placeholder="athlete@example.com" required autocomplete="email">
          </div>

          <div class="field">
            <label for="authPassword">Password</label>
            <input id="authPassword" type="password" placeholder="••••••••" required minlength="6" autocomplete="${isLogin ? 'current-password' : 'new-password'}">
            <small style="font-size:10px;color:#7e878c;margin-top:3px">${isLogin ? 'Enter your account password' : 'Minimum 6 characters · stored securely in Firebase'}</small>
          </div>

          <div id="authErrorNotice" style="display:none;color:#fc8775;background:#2d1715;padding:8px 12px;border-radius:8px;font-size:12px;border:1px solid #632922"></div>

          <button type="submit" id="authSubmitBtn" class="btn primary full mt8" style="padding:10px;font-size:13px;font-weight:700">
            ${isLogin ? 'Log In to RepRival →' : 'Create Athlete Account →'}
          </button>
        </form>

        <div style="display:flex;align-items:center;gap:10px;margin:16px 0">
          <div style="flex:1;height:1px;background:#2e3639"></div>
          <span style="font-size:10px;color:#7e878c;font-weight:700;letter-spacing:1px">OR</span>
          <div style="flex:1;height:1px;background:#2e3639"></div>
        </div>

        <button type="button" id="authGoogleBtn" class="btn outline full" style="padding:9px 12px;display:flex;align-items:center;justify-content:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/></svg>
          <span>Continue with Google</span>
        </button>

        <div class="fineprint mt16 text-center" style="font-size:10px;color:#7e878c;line-height:1.4">
          Non-owner accounts are assigned Athlete access. Stored securely in Firebase Firestore.
        </div>
      `;

      dlg.querySelectorAll('[data-close-auth]').forEach(b => b.addEventListener('click', () => dlg.close()));

      const tabLogin = dlg.querySelector('#authTabLogin');
      const tabSignup = dlg.querySelector('#authTabSignup');
      tabLogin.addEventListener('click', () => { mode = 'login'; renderModalContent(); });
      tabSignup.addEventListener('click', () => { mode = 'signup'; renderModalContent(); });

      const googleBtn = dlg.querySelector('#authGoogleBtn');
      googleBtn.addEventListener('click', async () => {
        try {
          googleBtn.disabled = true;
          googleBtn.textContent = 'Connecting with Google...';
          const user = await window.RepRivalCloud.signIn();
          if (user) {
            dlg.close();
            await syncWithCloudUser(user);
          }
        } catch (e) {
          console.error('Google Sign-in failed', e);
          const errDiv = dlg.querySelector('#authErrorNotice');
          if (errDiv) {
            let msg = 'Google Sign-In was cancelled or failed.';
            if (e.code === 'auth/unauthorized-domain') {
              msg = 'This domain (' + window.location.hostname + ') is not authorized for Google OAuth yet. You can sign in or sign up with Email & Password above without any domain restriction!';
            } else if (e.code === 'auth/popup-blocked') {
              msg = 'Pop-up window was blocked by your mobile browser. Please allow pop-ups or use Email & Password above.';
            } else if (e.code === 'auth/popup-closed-by-user') {
              msg = 'Sign-in window was closed before completing.';
            } else if (e.message) {
              msg = e.message;
            }
            errDiv.textContent = msg;
            errDiv.style.display = 'block';
          }
          googleBtn.disabled = false;
          googleBtn.innerHTML = 'Continue with Google';
        }
      });

      const form = dlg.querySelector('#authEmailForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errDiv = dlg.querySelector('#authErrorNotice');
        const submitBtn = dlg.querySelector('#authSubmitBtn');
        const email = dlg.querySelector('#authEmail').value.trim();
        const pass = dlg.querySelector('#authPassword').value;
        const username = dlg.querySelector('#authUsername')?.value?.trim();

        if (errDiv) errDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = isLogin ? 'Logging in...' : 'Creating account...';

        try {
          let user;
          if (isLogin) {
            user = await window.RepRivalCloud.signInWithEmail(email, pass);
          } else {
            user = await window.RepRivalCloud.signUpWithEmail(email, pass, username || email.split('@')[0]);
          }

          if (user) {
            dlg.close();
            await syncWithCloudUser(user);
          }
        } catch (err) {
          console.error('Auth error', err);
          submitBtn.disabled = false;
          submitBtn.textContent = isLogin ? 'Log In to RepRival →' : 'Create Athlete Account →';
          if (errDiv) {
            let msg = 'Authentication error. Please try again.';
            if (err.code === 'auth/email-already-in-use') {
              msg = 'This email is already registered. Please switch to Log In.';
            } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
              msg = 'Invalid email or password. Please check your credentials.';
            } else if (err.code === 'auth/weak-password') {
              msg = 'Password is too weak. Please use at least 6 characters.';
            } else if (err.code === 'auth/operation-not-allowed') {
              msg = 'Email/password provider needs to be enabled in Firebase Console. You can also sign in with Google below!';
            } else if (err.message) {
              msg = err.message;
            }
            errDiv.textContent = msg;
            errDiv.style.display = 'block';
          }
        }
      });
    }

    renderModalContent();
    dlg.addEventListener('close', () => dlg.remove(), {once: true});
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
    dlg.showModal();
  }

  // Auto-sync with cloud auth if available (inside IIFE so activeProfile and render are in scope)
  let cloudAuthChecked = false;
  function checkCloudAuth(){
    if(cloudAuthChecked) return;
    if(window.RepRivalCloud){
      cloudAuthChecked = true;
      window.RepRivalCloud.onAuth((user) => {
        // Always reconcile Firestore on authenticated launch, including when the
        // selected local athlete profile already matches the signed-in account.
        // Otherwise a page refresh can display stale local workout history.
        if(user){
          syncWithCloudUser(user).catch(err => console.error('Cloud history refresh failed', err));
        } else {
          render();
        }
      });
    } else {
      setTimeout(checkCloudAuth, 100);
    }
  }
  checkCloudAuth();

  render();
  window.RepRivalTest={
    getState:()=>structuredClone(state),
    todayLocal,
    setActive:(a)=>{ state.active = a; },
    setHistory:(h)=>{ state.history = h; },
    setTodayReadiness:(r)=>{ const p=profile(); if(!Array.isArray(p.readinessLog))p.readinessLog=[]; const idx=p.readinessLog.findIndex(x=>x.day===r.day); if(idx>=0)p.readinessLog[idx]=r; else p.readinessLog.push(r); save(); },
    getProfile:()=>structuredClone(profile()),
    graphiteHomeHeatmap,
    graphiteMuscleIcon,
    graphiteHeatColour,
    graphiteAtlasPalette,
    pauseProgrammeForAdaptive,
    resumePausedProgramme,
    adaptiveStudioScreen,
    setProfile:(p)=>{ Object.assign(profile(), p); save(); },
    setDumbbellInventory:(inv)=>{ profile().dumbbellInventory = inv; save(); },
    setMetadata:(m)=>{ profile().equipmentMetadata = m; save(); },
    buildTasks,
    score,
    calcRest,
    adjustedRestSeconds,
    recommend,
    resolveSetValues,
    makeSessionPairsPermanent,
    previousMatchingSet,
    exerciseLastSet,
    isDumbbellExercise,
    isSingleDumbbell,
    permitsBodyweight,
    formatWeightConvention,
    openRestEditModal,
    openRoadmapEditModal,
    resetSubmitLock: () => { isSubmittingSet = false; },
    openActiveExerciseEditModal,
    getAvailableLoadsForExercise,
    getAvailableDumbbellLoads,
    findConservativeAvailableLoad,
    stepLoad,
    logEffectiveMultiplier,
    setVolume,
    submitSet,
    completeWorkout,
    version:'1.7.0',
    league:()=>({store:structuredClone(leagueStore()),inactivity:leagueInactivity()}),
    bestSetLast90Days,
    compareWorkout,
    comparableSessions,
    muscleChange,
    getStrengthTrendData,
    calculateStrengthGainPct,
    heatData,
    heatBar,
    musclePanel,
    homeScreen: home,
    DEFAULT_WEEKLY_TARGETS,
    showStrengthExplanationModal,
    generateOneOffWorkout,
    openOneOffGeneratorModal,
    generateHolidayProgram,
    startHolidaySession,
    activateHolidayMode,
    exitHolidayMode,
    openHolidayModal
  };
})();
