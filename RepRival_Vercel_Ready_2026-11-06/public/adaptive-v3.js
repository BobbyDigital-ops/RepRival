/* RepRival Adaptive v3 — uses Muscle Intelligence v2 without modifying its formulas. */
(function () {
  'use strict';
  const UPPER = new Set(['Chest','Back','Side delts','Rear delts','Biceps','Triceps','Shoulders']);
  const LOWER = new Set(['Quads','Hamstrings','Glutes','Calves']);
  const CATEGORIES = ['Chest','Back','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Core'];
  const FOCUSES = [
    ['balanced','Balanced full body'], ['upper_only','Upper only'], ['upper_focused','Upper focused'],
    ['lower_only','Lower only'], ['lower_focused','Lower focused'],
    ['mixed','Mixed / variety'], ['gaps','Greatest heatmap gaps']
  ];
  const normaliseFocus = v => ({full_body:'balanced',upper_body:'upper_only',lower_body:'lower_only',heatmap_gaps:'gaps'}[v] || v || 'balanced');
  function category(e) {
    return ['Side delts','Rear delts','Shoulders'].includes(e.muscle) ? 'Shoulders'
      : CATEGORIES.includes(e.muscle) ? e.muscle : 'Core';
  }
  function weeklyOccurrences(history, now=Date.now()) {
    const counts = {};
    const cutoff = now - 7*86400000;
    for (const s of history || []) {
      const when = Date.parse(s.endedAt || s.startedAt || '');
      if (!Number.isFinite(when) || when < cutoff || when > now) continue;
      const ids = new Set((s.logs||[]).filter(l => l && !l.skipped && l.exId).map(l => l.exId));
      for (const id of ids) counts[id] = (counts[id]||0)+1;
    }
    return counts;
  }
  const pref = (cfg,id) => {
    const n=cfg?.exerciseFrequency?.[id];
    return n == null ? 1 : Math.max(0,Math.min(3,Number(n)||0));
  };
  function generate(cfg={},history=[],owned=[],checkin=null,opts={}) {
    const lib=window.REPRIVAL_EXERCISE_LIBRARY;
    if (!lib?.entries) throw Error('Exercise library unavailable');
    const focus=normaliseFocus(opts.focus || cfg.focus || 'balanced');
    const now=Number.isFinite(opts.now)?opts.now:Date.now();
    const variant=Number(opts.variant)||0;
    const groups=window.RepRivalAdaptive.calculateHeatScores(history,now,28);
    const weekly=weeklyOccurrences(history,now);
    const avoid=new Set([...(cfg.avoid||[]),...(opts.avoid||[])]);
    const sore=new Set([...(checkin?.groups||[]),...Object.entries(checkin?.sorenessMap||{}).filter(([,v])=>v==='severe').map(([k])=>k)]);
    const style=opts.style || 'mixed';
    const gearMeta=opts.equipmentMetadata || {};
    const eligible=lib.entries.filter(e=>{
      if (!e?.id || !lib.compatible(e,owned) || avoid.has(e.id) || pref(cfg,e.id)===0) return false;
      if (opts.availability==='indoor_only' && ((e.equipment||[]).some(g=>gearMeta[g]?.location==='outdoor') || gearMeta[e.id]?.location==='outdoor')) return false;
      if (e.id==='bodyweight_doorway_row' || e.id==='bodyweight_doorway_curl') return false;
      if (e.id==='inverted_row_wide' && gearMeta.inverted_row_bar?.grip==='fixed-grip') return false;
      if (['pull_up','chin_up'].includes(e.id)) {
        const best=history.flatMap(s=>s.logs||[]).filter(l=>l.exId===e.id).reduce((m,l)=>Math.max(m,l.reps||0),0);
        if(best<2)return false;
      }
      if (style==='bodyweight' && e.load!=='bodyweight')return false;
      if (focus==='upper_only' && !UPPER.has(e.muscle))return false;
      if (focus==='lower_only' && !LOWER.has(e.muscle))return false;
      return true;
    });
    const supersets=Math.max(1,Math.min(5,Number(opts.supersets || cfg.supersets || 3)));
    const setsPerPair=p=>supersets===1?2:p<2?3:2;
    const plannedTotal=Array.from({length:supersets},(_,p)=>setsPerPair(p)*2).reduce((a,b)=>a+b,0);
    const desiredDominant=Math.ceil(plannedTotal*.75);
    let dominantSets=0, usedSets=0;
    const picked=new Set(),families=new Set(),muscleDose={};
    const pairs=[],focusedMuscles=[];
    const metrics=m=>{
      const h=groups?.[m]||{};
      return {score:Number(h.stimulusScore??h.score??0),readiness:Number(h.readinessScore??100),
        daysSince:Number(h.daysSince??30), ever:!!h.ever};
    };
    function pick(needDominant,firstFamily) {
      const candidates=eligible.filter(e=>!picked.has(e.id));
      let pool=candidates.filter(e=>{
        const region=UPPER.has(e.muscle)?'upper':LOWER.has(e.muscle)?'lower':'other';
        if(needDominant==='upper')return region==='upper';
        if(needDominant==='lower')return region==='lower';
        if(needDominant==='other-upper')return region!=='upper';
        if(needDominant==='other-lower')return region!=='lower';
        return true;
      });
      if(!pool.length && needDominant?.startsWith('other-')) pool=candidates;
      if(!pool.length)return null;
      const safe=pool.filter(e=>!sore.has(e.muscle) && metrics(e.muscle).readiness>=30);
      if(safe.length)pool=safe;
      else return null; // Never override severe soreness or very low readiness.
      const distinct=pool.filter(e=>!families.has(e.family || e.id) && (e.family||e.id)!==firstFamily);
      if(distinct.length)pool=distinct;
      const ranked=pool.map(e=>{
        const h=metrics(e.muscle),weeklyUsed=weekly[e.id]||0,frequency=pref(cfg,e.id);
        const remaining=Math.max(0,frequency-weeklyUsed);
        const trainedRecently=history.slice(-2).some(s=>(s.logs||[]).some(l=>l.exId===e.id));
        const fatigue=Math.max(0,65-h.readiness)*1.1;
        const coverage=(muscleDose[e.muscle]||0)*5;
        const quality=style==='weights_focused'?(e.load==='bodyweight'?-38:8):0;
        const variety=focus==='mixed'?(trainedRecently?-35:15):trainedRecently?-8:4;
        const frequencyScore=remaining>0?35+remaining*3:-25;
        const tie=[...e.id].reduce((n,c)=>(n*31+c.charCodeAt(0))%997,variant+11)/997;
        return {e,score:(100-h.score)*1.2+Math.min(18,h.daysSince)*1.1+(h.readiness-65)*.4
          +frequencyScore+variety+quality-coverage-fatigue+tie};
      }).sort((a,b)=>b.score-a.score);
      return ranked[0]?.e||null;
    }
    for(let p=0;p<supersets;p++){
      const chosen=[],count=setsPerPair(p);
      for(let slot=0;slot<2;slot++){
        let region=null;
        if(focus==='upper_focused')region=dominantSets<desiredDominant?'upper':'other-upper';
        if(focus==='lower_focused')region=dominantSets<desiredDominant?'lower':'other-lower';
        const e=pick(region,chosen[0]?.family);
        if(!e)continue;
        const copy={...e,sets:count};
        if(cfg.goal==='strength'){copy.min=5;copy.max=8;}
        else if(cfg.goal==='endurance'){copy.min=12;copy.max=16;}
        chosen.push(copy);picked.add(e.id);families.add(e.family||e.id);
        muscleDose[e.muscle]=(muscleDose[e.muscle]||0)+count;focusedMuscles.push(e.muscle);
        usedSets+=count;
        if((focus==='upper_focused'&&UPPER.has(e.muscle))||(focus==='lower_focused'&&LOWER.has(e.muscle)))dominantSets+=count;
      }
      if(chosen.length)pairs.push({id:String.fromCharCode(65+p),restMin:75,restMax:105,exercises:chosen});
    }
    const setCount=pairs.reduce((n,p)=>n+p.exercises.reduce((m,e)=>m+e.sets,0),0);
    const label=FOCUSES.find(([id])=>id===focus)?.[1]||'Adaptive';
    const caution=pairs.length?null:'No compatible, sufficiently recovered exercises are enabled for this focus. Adjust your exercise frequencies, equipment or focus.';
    return {
      name:label+' · Adaptive',subtitle:setCount+' working sets · ~'+Math.round(setCount*1.7+pairs.length*2)+' min',
      pairs,focus:focusedMuscles,estimatedMinutes:Math.round(setCount*1.7+pairs.length*2),
      explanation:caution || 'Selected from your 28-day muscle stimulus, readiness, last seven days of training and exercise preferences. '+label+'.',
      focusType:focus,warning:caution,weekly,dominantShare:usedSets?dominantSets/usedSets:0
    };
  }
  window.RepRivalAdaptiveV3={FOCUSES,CATEGORIES,UPPER,LOWER,category,pref,weeklyOccurrences,normaliseFocus,generate};
})();