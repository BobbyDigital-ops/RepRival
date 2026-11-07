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
  function choose({focus='full_body',count=5,selectedIds=[],variant=0}={}){
    const lib=window.REPRIVAL_EXERCISE_LIBRARY;
    const available=eligible(),byId=new Map(available.map(x=>[x.id,x]));
    const num=safeInt(count,2,8,5);
    const chosen=[];
    const append=id=>{const ex=byId.get(id);if(ex&&!chosen.some(x=>x.id===ex.id))chosen.push(ex);};
    // User's manual selection takes priority; choices never include equipment
    // outside the circuit's kettlebell / equipment-free allowance.
    const manual=Array.isArray(selectedIds)?selectedIds.filter(id=>byId.has(id)):[];
    if(manual.length){
      manual.forEach(append);
      return chosen.slice(0,num);
    }
    const key=PRESETS[focus]?focus:'full_body';
    const primary=PRESETS[key];
    const rotation=safeInt(variant,0,10000,0)%primary.length;
    const rotated=[...primary.slice(rotation),...primary.slice(0,rotation)];
    rotated.forEach(append);
    const suitable=available.filter(ex=>{
      if(key==='upper')return ['Chest','Back','Biceps','Triceps','Side delts','Rear delts'].includes(ex.muscle);
      if(key==='lower')return ['Quads','Hamstrings','Glutes','Calves'].includes(ex.muscle);
      if(key==='core')return ['Core','Glutes','Back','Quads'].includes(ex.muscle);
      return true;
    });
    // Prioritise weighted candidates; bodyweight core is selectable manually.
    suitable.filter(ex=>(ex.equipment||[]).includes('kettlebell')).forEach(ex=>append(ex.id));
    suitable.filter(ex=>ex.load==='bodyweight').forEach(ex=>append(ex.id));
    return chosen.slice(0,num);
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
      explanation:'Circuit: one exercise at a time, then rest after each complete round. Exercise choices can be changed before starting.'
    };
  }
  window.RepRivalAdaptiveCircuits={PRESETS,FOCUSES,eligible,choose,create};
})();
