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
    const canonical=id=>window.REPRIVAL_EXERCISE_LIBRARY?.canonicalId?.(id)||id;
    for (const s of history || []) {
      const when = Date.parse(s.endedAt || s.startedAt || '');
      if (!Number.isFinite(when) || when < cutoff || when > now) continue;
      const ids = new Set((s.logs||[])
        .filter(l=>l&&!l.skipped&&l.exId&&l.reps!==0)
        .map(l=>canonical(l.exId)));
      for (const id of ids) counts[id] = (counts[id]||0)+1;
    }
    return counts;
  }
  const pref = (cfg,id) => {
    const preferences=cfg?.exerciseFrequency||{};
    const canonical=window.REPRIVAL_EXERCISE_LIBRARY?.canonicalId?.(id)||id;
    // Explicitly saved canonical preference wins; otherwise honour saved
    // choices for formerly separate aliases (without rewriting cloud data).
    let n=preferences[canonical];
    if(n==null){
      const aliases=window.REPRIVAL_EXERCISE_LIBRARY?.legacyAliases||{};
      const old=Object.keys(aliases).filter(key=>aliases[key]===canonical&&preferences[key]!=null);
      if(old.length)n=preferences[old[0]];
    }
    return n == null ? 1 : Math.max(0,Math.min(3,Number(n)||0));
  };
  const PAIR_COMPAT={
    'Chest':['Back','Rear delts','Biceps','Hamstrings','Calves'],
    'Back':['Chest','Triceps','Side delts','Quads','Calves'],
    'Side delts':['Back','Rear delts','Biceps','Hamstrings','Calves'],
    'Rear delts':['Chest','Side delts','Triceps','Quads'],
    'Biceps':['Triceps','Chest','Quads','Calves'],
    'Triceps':['Biceps','Back','Quads','Hamstrings'],
    'Quads':['Back','Hamstrings','Rear delts','Core'],
    'Hamstrings':['Chest','Side delts','Quads','Calves'],
    'Glutes':['Chest','Rear delts','Biceps','Calves'],
    'Calves':['Chest','Back','Biceps','Hamstrings'],
    'Core':['Chest','Back','Quads','Calves']
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
      // A preference is a cap per *completed workout appearance* in the last
      // rolling seven days, not just a ranking hint.
      if((weekly[e.id]||0)>=pref(cfg,e.id))return false;
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
    // Without history, keep a sensible focus-first default. Once training data
    // exists, let muscle deficits and recovery outrank rigid region quotas.
    const hasHistorySignal=Object.values(groups||{}).some(g=>g&&g.ever);
    const desiredDominant=Math.ceil(plannedTotal*.75);
    const maintenanceTargets={
      upper_focused:{upper:70,lower:30,core:50},
      lower_focused:{upper:30,lower:70,core:50},
      balanced:{upper:60,lower:60,core:50},
      mixed:{upper:55,lower:55,core:50},
      gaps:{upper:55,lower:55,core:50}
    };
    const targets=maintenanceTargets[focus]||maintenanceTargets.balanced;
    const zone=m=>UPPER.has(m)?'upper':LOWER.has(m)?'lower':'core';
    const coverageFor=e=>{
      const contribution=[[e.muscle,1],...(window.RepRivalIntelligence?.getSecondaryContributions?.({exId:e.id,name:e.name,muscle:e.muscle})||[])];
      return contribution.reduce((total,[m,share])=>{
        const h=metrics(m);
        if(!h.ever)return total;
        const goal=targets[zone(m)];
        const deficit=Math.max(0,goal-h.score);
        // Don't repeatedly schedule a muscle already covered in this workout.
        return total+Math.max(0,deficit-(muscleDose[m]||0)*9)*share;
      },0);
    };
    let dominantSets=0, usedSets=0;
    const picked=new Set(),families=new Set(),muscleDose={};
    const pairs=[],focusedMuscles=[];
    const metrics=m=>{
      const h=groups?.[m]||{};
      return {score:Number(h.stimulusScore??h.score??55),readiness:Number(h.readinessScore??75),
        daysSince:Number(h.daysSince??30), ever:!!h.ever};
    };
    function pick(needDominant,firstExercise) {
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
      const distinct=pool.filter(e=>!families.has(e.family || e.id) &&
        (!firstExercise||(e.family||e.id)!==(firstExercise.family||firstExercise.id)));
      if(distinct.length)pool=distinct;
      // Avoid repeating the same primary muscle in a superset whenever there
      // are compatible alternatives. Exact duplicate IDs are already removed.
      if(firstExercise){
        const otherMuscles=pool.filter(e=>e.muscle!==firstExercise.muscle);
        if(otherMuscles.length)pool=otherMuscles;
      }
      const ranked=pool.map(e=>{
        const h=metrics(e.muscle),weeklyUsed=weekly[e.id]||0,frequency=pref(cfg,e.id);
        const remaining=Math.max(0,frequency-weeklyUsed);
        const trainedRecently=history.slice(-2).some(s=>(s.logs||[]).some(l=>l.exId===e.id));
        const fatigue=Math.max(0,65-h.readiness)*1.1;
        const coverage=(muscleDose[e.muscle]||0)*5;
        const quality=style==='weights_focused'?(e.load==='bodyweight'?-38:8):0;
        const variety=focus==='mixed'?(trainedRecently?-35:15):trainedRecently?-8:4;
        const frequencyScore=remaining>0?35+remaining*3:-25;
        const pairing=firstExercise
          ? (PAIR_COMPAT[firstExercise.muscle]?.includes(e.muscle)?22:0)
          : 0;
        const tie=[...e.id].reduce((n,c)=>(n*31+c.charCodeAt(0))%997,variant+11)/997;
        const adaptivePriority=hasHistorySignal?
          (coverageFor(e)*3.2+(zone(e.muscle)==='core'&&metrics('Core').ever?6:0)):
          (100-h.score)*1.2;
        const focusNudge=hasHistorySignal&&focus==='upper_focused'&&zone(e.muscle)==='upper'?8:
          hasHistorySignal&&focus==='lower_focused'&&zone(e.muscle)==='lower'?8:0;
        return {e,score:adaptivePriority+focusNudge+Math.min(18,h.daysSince)*.35+(h.readiness-65)*.4
          +frequencyScore+variety+quality+pairing-coverage-fatigue+tie};
      }).sort((a,b)=>b.score-a.score);
      return ranked[0]?.e||null;
    }
    for(let p=0;p<supersets;p++){
      const chosen=[],count=setsPerPair(p);
      for(let slot=0;slot<2;slot++){
        let region=null;
        if(!hasHistorySignal&&focus==='upper_focused')region=dominantSets<desiredDominant?'upper':'other-upper';
        if(!hasHistorySignal&&focus==='lower_focused')region=dominantSets<desiredDominant?'lower':'other-lower';
        const e=pick(region,chosen[0]);
        if(!e)continue;
        const copy={...e,sets:count};
        if(cfg.goal==='strength'){copy.min=5;copy.max=8;}
        else if(cfg.goal==='endurance'){copy.min=12;copy.max=16;}
        chosen.push(copy);picked.add(e.id);families.add(e.family||e.id);
        const allocations=[[e.muscle,1],...(window.RepRivalIntelligence?.getSecondaryContributions?.({exId:e.id,name:e.name,muscle:e.muscle})||[])];
        allocations.forEach(([m,share])=>{muscleDose[m]=(muscleDose[m]||0)+count*share;});
        focusedMuscles.push(e.muscle);
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
      explanation:caution || (hasHistorySignal?'Selected against upper/lower/core stimulus-maintenance targets, accounting for recovery, supporting muscles, seven-day frequency and your preferred focus. ':'Selected using your exercise preferences, recovery and training focus until enough history is available. ')+label+'.',
      focusType:focus,warning:caution,weekly,dominantShare:usedSets?dominantSets/usedSets:0
    };
  }
  window.RepRivalAdaptiveV3={FOCUSES,CATEGORIES,UPPER,LOWER,category,pref,weeklyOccurrences,normaliseFocus,generate};
})();