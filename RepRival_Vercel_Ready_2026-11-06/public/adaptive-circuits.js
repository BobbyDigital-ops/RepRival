/* RepRival Adaptive Circuit Builder — independent of athlete profile storage.
   Produces one round-robin circuit block, which the existing logger can
   safely consume exercise-by-exercise; does not update any saved programme. */
(function(){
  'use strict';
  // Entire preset is weighted with a kettlebell. Core-only movements can be
  // offered as optional bodyweight additions in the custom list below.
  const PRESETS={
    full_body:['kb_bent_row','kb_goblet_squat','kb_press','kb_swing','kb_reverse_lunge','kb_floor_press','kb_curl','kb_triceps_extension','kb_russian_twist'],
    upper:['kb_bent_row','kb_floor_press','kb_press','kb_curl','kb_triceps_extension','kb_hammer_curl','kb_crush_press','kb_push_press'],
    lower:['kb_goblet_squat','kb_rdl','kb_reverse_lunge','kb_sumo_squat','kb_deadlift','kb_glute_bridge','kb_calf_raise','kb_single_leg_rdl'],
    core:['kb_russian_twist','kb_halo','kb_suitcase_carry','kb_around_world','kb_side_bend','kb_windmill','kb_goblet_squat','kb_bent_row']
  };
  const FOCUSES=[['full_body','Full body'],['upper','Upper body'],['lower','Lower body'],['core','Core & stability']];
  const safeInt=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback;};
  const isAvailable=(ex,kit=['kettlebell'])=>{
    const lib=window.REPRIVAL_EXERCISE_LIBRARY;
    if(!ex||!lib?.compatible(ex,kit))return false;
    const required=ex.equipment||[];
    const weighted=required.includes('kettlebell')&&required.every(x=>x==='kettlebell');
    // Truly equipment-free core moves stay available as optional alternatives;
    // generic DB exercises are NOT misrepresented as kettlebell movements.
    const coreBW=ex.muscle==='Core'&&ex.load==='bodyweight'&&!required.length;
    return weighted||coreBW;
  };
  function eligible(){
    const lib=window.REPRIVAL_EXERCISE_LIBRARY;
    const available=(lib?.entries||[]).filter(ex=>isAvailable(ex));
    // Weighted kettlebell movements first. Bodyweight core follows as extras.
    return [...available.filter(ex=>(ex.equipment||[]).includes('kettlebell')),
      ...available.filter(ex=>!(ex.equipment||[]).includes('kettlebell'))];
  }
  const focusTargets={
    full_body:{upper:65,lower:55,core:45},
    upper:{upper:75,lower:30,core:45},
    lower:{upper:30,lower:75,core:45},
    core:{upper:35,lower:35,core:65}
  };
  const region=muscle=>muscle==='Core'?'core':
    ['Quads','Hamstrings','Glutes','Calves'].includes(muscle)?'lower':'upper';
  const targetFor=(muscle,focus)=>focusTargets[focus]?.[region(muscle)]||55;
  function choose({focus='full_body',count=5,selectedIds=[],poolIds=[],variant=0,previousIds=[],metrics=null,history=[]}={}){
    const available=eligible();
    const byId=new Map(available.map(x=>[x.id,x]));
    const countSafe=safeInt(count,2,8,5);
    const actualPool=Array.isArray(poolIds)&&poolIds.length?poolIds:selectedIds;
    const ids=Array.isArray(actualPool)&&actualPool.length
      ? [...new Set(actualPool)].filter(id=>byId.has(id)) : available.map(x=>x.id);
    const candidates=ids.map(id=>byId.get(id));
    if(candidates.length<countSafe)throw new Error('Your exercise pool has '+candidates.length+
      ' available movements. Add more or lower the exercise count.');
    const normalizedFocus=PRESETS[focus]?focus:'full_body';
    const weights=metrics&&typeof metrics==='object'?metrics:{};
    const recent=new Map();
    const cutoff=Date.now()-7*86400000;
    for(const session of history||[]){
      const at=Date.parse(session.endedAt||session.startedAt||'');
      if(!Number.isFinite(at)||at<cutoff)continue;
      const used=new Set((session.logs||[]).filter(l=>l&&!l.skipped&&l.reps>0).map(l=>l.exId));
      for(const id of used)recent.set(id,(recent.get(id)||0)+1);
    }
    const selected=[],represented=new Map();
    const preset=PRESETS[normalizedFocus]||PRESETS.full_body;
    const variantNumber=safeInt(variant,0,99999,0);
    const previous=new Set(Array.isArray(previousIds)?previousIds:[]);
    const hasAlternatives=candidates.length>countSafe;
    const shuffling=hasAlternatives&&previous.size>0;
    const rotation=(id)=>{
      // Exercise-specific variation, rather than the same global variant
      // offset applied to every candidate (which barely changed rankings).
      let hash=(variantNumber+1)*2654435761;
      for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619);
      return ((hash>>>0)%1000)/1000;
    };
    const hasUsefulMetrics=Object.values(weights).some(x=>x&&Number.isFinite(Number(x.stimulusScore)));
    while(selected.length<countSafe){
      let winner=null,best=-Infinity;
      for(const ex of candidates){
        if(selected.some(x=>x.id===ex.id))continue;
        const zone=region(ex.muscle);
        const group=weights[ex.muscle]||weights[zone]||{};
        const stimulus=Number.isFinite(Number(group.stimulusScore))?Number(group.stimulusScore):55;
        const ready=group.readinessScore!=null&&Number.isFinite(Number(group.readinessScore))?Number(group.readinessScore):75;
        const deficit=Math.max(0,targetFor(ex.muscle,normalizedFocus)-stimulus);
        const base=hasUsefulMetrics?deficit*.9:0;
        const priorInZone=represented.get(zone)||0;
        const primaryAlready=selected.filter(x=>x.muscle===ex.muscle).length;
        const rotationIndex=preset.indexOf(ex.id);
        const presetPriority=rotationIndex>=0?Math.max(0,20-rotationIndex*2.2):0;
        // Fill a balanced circuit even if history is sparse; when a user
        // chooses a narrow pool, honour it rather than introducing exercises.
        const diversity=priorInZone===0?19:-priorInZone*8;
        const reusePenalty=primaryAlready*17+(recent.get(ex.id)||0)*17;
        const tiredPenalty=ready<45?40:ready<60?15:0;
        // Prefer alternatives when the user shuffles, without ignoring
        // muscle needs, recovery, equipment, or the chosen exercise pool.
        const wasPrevious=previous.has(ex.id);
        const previousPenalty=shuffling&&wasPrevious?38:0;
        const variation=shuffling?rotation(ex.id)*24:rotation(ex.id)*.2;
        const score=base+presetPriority+diversity-reusePenalty-tiredPenalty-previousPenalty+variation;
        if(score>best){best=score;winner=ex;}
      }
      if(!winner)break;
      selected.push(winner);
      const z=region(winner.muscle);
      represented.set(z,(represented.get(z)||0)+1);
    }
    return selected;
  }
  function create(options={}){
    const count=safeInt(options.count,2,8,5);
    const rounds=safeInt(options.rounds,1,6,3);
    const reps=safeInt(options.reps,1,40,10);
    const rest=safeInt(options.rest,30,180,75);
    const exerciseList=choose({...options,count});
    if(exerciseList.length<2)throw new Error('Select at least two compatible exercises.');
    const exercises=exerciseList.map(ex=>{
      const perSide=ex.suffix&&/per (side|leg|arm)/i.test(ex.suffix);
      return {...ex,sets:rounds,min:reps,max:reps,suffix:perSide?ex.suffix:(ex.suffix||'')};
    });
    const focus=PRESETS[options.focus]?options.focus:'full_body';
    return {
      code:'Circuit',isOneOff:true,isCircuit:true,
      focus,rounds,reps,count:exercises.length,rest,
      sessionName:FOCUSES.find(x=>x[0]===focus)?.[1]+' Kettlebell Circuit',
      pairs:[{id:'KB-CIRCUIT',restMin:rest,restMax:rest,exercises}],
      estimatedMinutes:Math.ceil(rounds*exercises.length*.7+(rounds-1)*rest/60),
      explanation:'Adaptive chooses exercises from the saved pool, guided by recent training, muscle stimulus, readiness and session focus. One movement at a time; rest after each round.'
    };
  }
  window.RepRivalAdaptiveCircuits={PRESETS,FOCUSES,eligible,choose,create};
})();
