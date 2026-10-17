/* Offline templates using the equipment in the original Pump Plan. All weights logged in kg. */
(function(){
 const base=window.REPQUEST_PROGRAM;
 const clone=()=>structuredClone(base);
 const targets={
  pump:{title:'Current Pump Plan',duration:'Ongoing',focus:'Upper-body-focused hypertrophy',days:'3 workouts in rotation',description:'Your established programme; preserves your imported history.'},
  strength:{title:'Strength Foundation',duration:'8 weeks',focus:'Maximal strength',days:'3 workouts per week',description:'Lower repetitions, deliberate technique, longer recovery and progressive loading.'},
  athletic:{title:'Athletic Engine',duration:'6 weeks',focus:'Power, stability and athletic performance',days:'3 workouts per week',description:'Full-body strength, unilateral balance, kettlebell work and core control.'},
  hypertrophy:{title:'Hypertrophy Specialist',duration:'8 weeks',focus:'Build muscle',days:'4 workouts per week',description:'More upper-body sets and balanced back and lower-body training, with fatigue management.'},
  endurance:{title:'Strength Endurance',duration:'6 weeks',focus:'Muscular endurance',days:'3 workouts per week',description:'Moderate loads, higher reps and slightly shorter rests.'},
  balanced:{title:'Balanced Performance',duration:'8 weeks',focus:'All-round strength and fitness',days:'3 workouts per week',description:'Strength, unilateral legs, trunk work and recovery-friendly training around running.'}
 };
 const templates={pump:clone()};
 function transform(id,{min,max,sets,restMin,restMax}){
  const p=clone();Object.values(p).forEach(w=>{
   w.subtitle=targets[id].description;
   w.pairs.forEach(pair=>{
    if(restMin)pair.restMin=restMin;if(restMax)pair.restMax=restMax;
    pair.exercises.forEach(ex=>{
     if(min)ex.min=ex.load==='bodyweight'?Math.max(5,min):min;
     if(max)ex.max=ex.load==='bodyweight'?Math.max(10,max):max;
     if(sets)ex.sets=sets;
    });
   });
  });return p;
 }
 templates.strength=transform('strength',{min:5,max:8,sets:3,restMin:120,restMax:180});
 templates.athletic=transform('athletic',{min:8,max:12,sets:3,restMin:75,restMax:120});
 templates.athletic.B.pairs[0].exercises[0]={id:'kb_swing',name:'Kettlebell swing',muscle:'Hamstrings',sets:3,min:12,max:20,load:'single'};
 templates.athletic.C.pairs[0].exercises[0]={id:'suitcase_carry',name:'Suitcase carry (steps per side)',muscle:'Core',sets:3,min:25,max:50,load:'single'};
 templates.hypertrophy=transform('hypertrophy',{min:8,max:15,sets:3,restMin:60,restMax:105});
 templates.hypertrophy.D=structuredClone(templates.hypertrophy.A);templates.hypertrophy.D.name='Full Body D';
 templates.hypertrophy.D.pairs[0].exercises[0]={id:'db_overhead_press',name:'DB overhead press',muscle:'Side delts',sets:3,min:8,max:12,load:'combined'};
 templates.endurance=transform('endurance',{min:12,max:20,sets:2,restMin:45,restMax:75});
 templates.balanced=transform('balanced',{min:8,max:12,sets:3,restMin:75,restMax:120});
 templates.balanced.C.pairs[0].exercises[0]={id:'db_overhead_press',name:'DB overhead press',muscle:'Side delts',sets:3,min:8,max:12,load:'combined'};
 window.REPRIVAL_PLAN_LIBRARY={details:targets,templates};
})();
