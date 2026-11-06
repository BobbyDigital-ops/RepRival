/* Equipment-aware programme recipes. Original Pump Plan is kept untouched.
   Existing user-edited rotations are never rebuilt automatically. */
(function(){
 'use strict';
 const original=window.REPQUEST_PROGRAM, catalog=window.REPRIVAL_EXERCISE_LIBRARY;
 const spec={
 pump:{title:'Current Pump Plan',duration:'Ongoing',focus:'Upper-body-focused hypertrophy',days:'3 workouts in rotation',weekly:3,split:'Full body',description:'Your original Pump Plan, preserved exactly as recorded. Edits and history are kept.'},
 strength:{title:'Strength Foundation',duration:'8 weeks',focus:'Progressive strength',days:'3 workouts per week',weekly:3,split:'Full body',description:'Compound lifts first, lower rep targets and longer rests.'},
 athletic:{title:'Athletic Engine',duration:'6 weeks',focus:'Single-leg balance, hinges and carries',days:'3 workouts per week',weekly:3,split:'Athletic',description:'Different movements each day with kettlebell power, unilateral legs and trunk control.'},
 hypertrophy:{title:'Hypertrophy Specialist',duration:'8 weeks',focus:'Build muscle with more weekly volume',days:'4 workouts per week',weekly:4,split:'Upper/lower',description:'Two upper and two lower sessions with enough variety to cover major muscle groups.'},
 endurance:{title:'Strength Endurance',duration:'6 weeks',focus:'Higher repetitions and moderate rests',days:'3 workouts per week',weekly:3,split:'Full body',description:'Muscular endurance through manageable weights and higher-rep targets.'},
 balanced:{title:'Balanced Performance',duration:'8 weeks',focus:'Strength alongside running',days:'3 workouts per week',weekly:3,split:'Full body',description:'Moderate volume and complementary work to leave energy for running.'},
 ppl3:{title:'Push / Pull / Legs',duration:'8 weeks',focus:'Classic three-way split',days:'3 workouts per week',weekly:3,split:'Push / Pull / Legs',description:'Dedicated push, pull and leg days using your available equipment.'},
 ppl6:{title:'Push / Pull / Legs × 2',duration:'8 weeks',focus:'High-frequency six-day split',days:'6 workouts per week',weekly:6,split:'Push / Pull / Legs',description:'Push, pull and legs twice each week, using different movements across sessions.'},
 upperlower4:{title:'Upper / Lower × 2',duration:'8 weeks',focus:'Balanced four-day strength and size',days:'4 workouts per week',weekly:4,split:'Upper / Lower',description:'Two distinct upper days and two lower days, with unilateral movements included.'},
 bro5:{title:'Classic Bro Split',duration:'8 weeks',focus:'Dedicated muscle-group days',days:'5 workouts per week',weekly:5,split:'Bro split',description:'Chest, back, shoulders, legs and arms each have their own session.'},
 fullbody2:{title:'Two-Day Full Body',duration:'Ongoing',focus:'Efficient and sustainable',days:'2 workouts per week',weekly:2,split:'Full body',description:'A compact strength plan for busier weeks or extra recovery.'},
 fullbody4:{title:'Four-Day Full Body',duration:'8 weeks',focus:'Higher-frequency whole-body training',days:'4 workouts per week',weekly:4,split:'Full body',description:'Shorter, varied full-body sessions across the week.'},
 homeupper3:{title:'Upper-Body Builder',duration:'8 weeks',focus:'Chest, arms, back and shoulders',days:'3 workouts per week',weekly:3,split:'Upper emphasis',description:'Extra upper-body work, with a smaller lower-body maintenance dose.'},
 kettlebell3:{title:'Kettlebell & Dumbbell',duration:'6 weeks',focus:'Kettlebell skill and whole-body strength',days:'3 workouts per week',weekly:3,split:'Full body',description:'Swings, carries, goblet squats, presses and controlled accessory work.'},
 calisthenics3:{title:'Bodyweight Foundations',duration:'8 weeks',focus:'Strength using bars and bodyweight',days:'3 workouts per week',weekly:3,split:'Calisthenics',description:'Rows, chin-ups, dips, push-ups and core with practical progressions.'},
 barbell4:{title:'Gym Strength / Powerbuilding',duration:'8 weeks',focus:'Barbell compound lifts',days:'4 workouts per week',weekly:4,split:'Upper / Lower',description:'Requires a barbell, rack and bench. Appropriate for a properly equipped gym.'},
 bodyweight2:{title:'Travel / No-Equipment',duration:'Ongoing',focus:'Bodyweight strength away from home',days:'2 workouts per week',weekly:2,split:'Full body',description:'No equipment required; built around different push-up, squat, hinge and core patterns.'}
 };
 // Each array is a block. "|" separates meaningful equipment-based alternatives.
 // Paired entries form a superset, single entries are a solo block.
 const plans={
 strength:[
  ['Full Body A', [['flat_db_bench_press|barbell_bench_press','chest_supported_db_row|inverted_row_neutral'],['goblet_squat|barbell_back_squat'],['db_romanian_deadlift|barbell_rdl'],['db_overhead_press'],['ab_rollout|dead_bug']]],
  ['Full Body B', [['low_incline_db_press','chin_up|inverted_row_neutral'],['bulgarian_split_squat|split_squat'],['db_floor_press'],['db_calf_raise'],['suitcase_carry|plank']]],
  ['Full Body C', [['db_neutral_press|flat_db_bench_press','chest_supported_db_row'],['staggered_stance_rdl|db_romanian_deadlift'],['db_front_squat|goblet_squat'],['hammer_curl'],['lying_db_triceps_extension']]]
 ],
 athletic:[
  ['Strength & Power', [['kb_swing|db_romanian_deadlift'],['db_step_up|bulgarian_split_squat'],['single_arm_db_press'],['inverted_row_neutral|chest_supported_db_row'],['dead_bug']]],
  ['Stability & Balance', [['single_leg_db_rdl'],['bulgarian_split_squat|bodyweight_bulgarian_split_squat'],['db_neutral_press'],['chin_up|inverted_row_neutral'],['suitcase_carry']]],
  ['Engine & Core', [['kb_goblet_squat|goblet_squat'],['kb_clean_press|db_overhead_press'],['reverse_lunge|bodyweight_reverse_lunge'],['push_up'],['ab_rollout|plank']]]
 ],
 hypertrophy:[
  ['Upper A · Chest & Back', [['flat_db_bench_press','chest_supported_db_row|inverted_row_neutral'],['incline_db_fly'],['db_lateral_raise'],['incline_db_curl','lying_db_triceps_extension']]],
  ['Lower A · Quad Emphasis', [['bulgarian_split_squat|split_squat'],['db_front_squat|goblet_squat'],['db_step_up|bodyweight_step_up'],['db_calf_raise'],['dead_bug']]],
  ['Upper B · Shoulders & Arms', [['low_incline_db_press','chin_up|chest_supported_db_row'],['seated_db_press|db_overhead_press'],['chest_supported_rear_fly'],['hammer_curl','overhead_db_triceps_extension']]],
  ['Lower B · Hinge Emphasis', [['db_romanian_deadlift'],['hip_thrust_bench|db_glute_bridge'],['reverse_lunge'],['single_leg_db_rdl'],['ab_rollout']]]
 ],
 endurance:[
  ['Full Body A · Reps', [['push_up','inverted_row_neutral|chest_supported_db_row'],['bodyweight_squat'],['db_romanian_deadlift'],['db_lateral_raise'],['plank']]],
  ['Full Body B · Circuit', [['db_floor_press','db_bent_over_row'],['reverse_lunge|bodyweight_reverse_lunge'],['kb_swing|db_deadlift'],['hammer_curl'],['reverse_crunch']]],
  ['Full Body C · Conditioning', [['goblet_squat'],['db_neutral_press'],['inverted_row_neutral|db_bent_over_row'],['single_leg_db_rdl'],['suitcase_carry|mountain_climbers']]]
 ],
 balanced:[
  ['Full Body A · Push & Hinge', [['low_incline_db_press','inverted_row_neutral|chest_supported_db_row'],['db_romanian_deadlift'],['db_lateral_raise'],['dead_bug']]],
  ['Full Body B · Single Leg', [['bulgarian_split_squat|bodyweight_bulgarian_split_squat'],['db_floor_press'],['chest_supported_db_row|inverted_row_neutral'],['hammer_curl'],['side_plank']]],
  ['Full Body C · Balanced', [['goblet_squat'],['seated_db_press|db_overhead_press'],['chin_up|inverted_row_neutral'],['kb_swing|db_deadlift'],['ab_rollout']]]
 ],
 ppl3:[
  ['Push · Chest, Shoulders, Triceps', [['low_incline_db_press'],['flat_db_bench_press'],['seated_db_press|db_overhead_press'],['db_lateral_raise'],['lying_db_triceps_extension'],['parallel_bar_dip|close_push_up']]],
  ['Pull · Back, Rear Delts, Biceps', [['chin_up|inverted_row_neutral'],['chest_supported_db_row'],['db_pullover'],['chest_supported_rear_fly'],['incline_db_curl'],['hammer_curl']]],
  ['Legs · Quads, Hams, Glutes, Core', [['goblet_squat'],['bulgarian_split_squat'],['db_romanian_deadlift'],['hip_thrust_bench|bodyweight_glute_bridge'],['db_calf_raise'],['ab_rollout']]]
 ],
 ppl6:[
  ['Push A · Chest', [['flat_db_bench_press'],['low_incline_db_press'],['db_lateral_raise'],['lying_db_triceps_extension']]],
  ['Pull A · Thickness', [['chest_supported_db_row'],['inverted_row_neutral'],['chest_supported_rear_fly'],['hammer_curl']]],
  ['Legs A · Quads', [['goblet_squat'],['bulgarian_split_squat'],['db_calf_raise'],['ab_rollout']]],
  ['Push B · Shoulders', [['db_overhead_press'],['db_neutral_press'],['leaning_lateral_raise'],['overhead_db_triceps_extension']]],
  ['Pull B · Width', [['chin_up|inverted_row_neutral'],['db_pullover'],['reverse_db_fly'],['standing_db_curl']]],
  ['Legs B · Posterior Chain', [['db_romanian_deadlift'],['hip_thrust_bench'],['single_leg_db_rdl'],['side_plank']]]
 ],
 upperlower4:[
  ['Upper A · Horizontal', [['flat_db_bench_press','chest_supported_db_row'],['incline_db_fly'],['db_lateral_raise'],['incline_db_curl','lying_db_triceps_extension']]],
  ['Lower A · Quad', [['goblet_squat'],['bulgarian_split_squat'],['db_step_up|bodyweight_step_up'],['db_calf_raise'],['dead_bug']]],
  ['Upper B · Vertical', [['db_overhead_press','chin_up|inverted_row_neutral'],['low_incline_db_press'],['chest_supported_rear_fly'],['hammer_curl','overhead_db_triceps_extension']]],
  ['Lower B · Hinge', [['db_romanian_deadlift'],['hip_thrust_bench|db_glute_bridge'],['reverse_lunge'],['single_leg_calf_raise'],['ab_rollout']]]
 ],
 bro5:[
  ['Chest', [['flat_db_bench_press'],['low_incline_db_press'],['db_neutral_press'],['flat_db_pec_fly'],['decline_push_up|push_up']]],
  ['Back', [['chin_up|inverted_row_neutral'],['chest_supported_db_row'],['db_pullover'],['db_bent_over_row'],['db_shrug']]],
  ['Shoulders', [['db_overhead_press'],['seated_lateral_raise'],['chest_supported_rear_fly'],['arnold_press'],['leaning_lateral_raise']]],
  ['Legs', [['goblet_squat'],['bulgarian_split_squat'],['db_romanian_deadlift'],['db_step_up|bodyweight_step_up'],['db_calf_raise']]],
  ['Arms & Core', [['incline_db_curl','lying_db_triceps_extension'],['hammer_curl','overhead_db_triceps_extension'],['concentration_curl','parallel_bar_dip|close_push_up'],['ab_rollout']]]
 ],
 fullbody2:[
  ['Full Body A', [['low_incline_db_press','chest_supported_db_row'],['goblet_squat'],['db_romanian_deadlift'],['db_lateral_raise'],['ab_rollout']]],
  ['Full Body B', [['flat_db_bench_press','inverted_row_neutral|chest_supported_db_row'],['bulgarian_split_squat'],['db_overhead_press'],['hammer_curl'],['side_plank']]]
 ],
 fullbody4:[
  ['Full Body A', [['flat_db_bench_press','chest_supported_db_row'],['goblet_squat'],['ab_rollout']]],
  ['Full Body B', [['bulgarian_split_squat'],['db_overhead_press'],['chin_up|inverted_row_neutral'],['db_lateral_raise']]],
  ['Full Body C', [['db_romanian_deadlift'],['low_incline_db_press'],['reverse_db_fly'],['hammer_curl']]],
  ['Full Body D', [['db_step_up|bodyweight_step_up'],['db_floor_press'],['db_bent_over_row'],['suitcase_carry']]]
 ],
 homeupper3:[
  ['Chest & Arms', [['flat_db_bench_press'],['low_incline_db_press'],['flat_db_pec_fly'],['incline_db_curl','lying_db_triceps_extension'],['db_lateral_raise']]],
  ['Back & Shoulders', [['chin_up|inverted_row_neutral'],['chest_supported_db_row'],['db_overhead_press'],['chest_supported_rear_fly'],['hammer_curl'],['ab_rollout']]],
  ['Upper Mix & Legs', [['db_neutral_press','inverted_row_neutral'],['leaning_lateral_raise'],['overhead_db_triceps_extension'],['bulgarian_split_squat'],['db_romanian_deadlift']]]
 ],
 kettlebell3:[
  ['KB A · Power', [['kb_swing'],['kb_goblet_squat'],['kb_press'],['inverted_row_neutral|db_bent_over_row'],['kb_suitcase_carry']]],
  ['KB B · Strength', [['kb_deadlift'],['kb_reverse_lunge'],['low_incline_db_press|push_up'],['chest_supported_db_row|ring_row'],['ab_rollout|dead_bug']]],
  ['KB C · Control', [['kb_clean_press'],['single_leg_db_rdl|kb_rdl'],['goblet_squat'],['db_lateral_raise'],['kb_halo']]]
 ],
 calisthenics3:[
  ['Push & Core', [['push_up'],['parallel_bar_dip'],['pike_push_up'],['close_push_up'],['ab_rollout|dead_bug']]],
  ['Pull & Balance', [['chin_up'],['inverted_row_neutral'],['negative_chin_up'],['scapular_pull_up'],['hanging_knee_raise']]],
  ['Legs & Full Body', [['bodyweight_bulgarian_split_squat|bodyweight_reverse_lunge'],['tempo_squat'],['bodyweight_glute_bridge'],['single_leg_calf_raise'],['decline_push_up|push_up'],['side_plank']]]
 ],
 barbell4:[
  ['Upper Strength', [['barbell_bench_press'],['barbell_row'],['barbell_overhead_press'],['lat_pulldown|chin_up'],['barbell_curl']]],
  ['Lower Strength', [['barbell_back_squat'],['barbell_rdl'],['leg_press|bulgarian_split_squat'],['leg_curl|bodyweight_glute_bridge'],['plank']]],
  ['Upper Volume', [['barbell_incline_press'],['cable_seated_row|barbell_row'],['cable_chest_fly|db_floor_press'],['cable_lateral_raise|db_lateral_raise'],['cable_triceps_pushdown|close_push_up']]],
  ['Lower Volume', [['barbell_front_squat'],['barbell_deadlift'],['barbell_hip_thrust'],['leg_extension|bodyweight_squat'],['hanging_knee_raise|reverse_crunch']]]
 ],
 bodyweight2:[
  ['Bodyweight A', [['push_up'],['bodyweight_squat'],['bodyweight_reverse_lunge'],['dead_bug'],['side_plank']]],
  ['Bodyweight B', [['pike_push_up'],['tempo_squat'],['bodyweight_glute_bridge'],['reverse_crunch'],['mountain_climbers']]]
 ]
 };
 function make(id,gear){
   if(id==='pump')return structuredClone(original);
   const missing=new Set();const result={};
   (plans[id]||[]).forEach(([name,groups],i)=>{
     const pairs=[];
     groups.forEach((group,j)=>{
       const exercises=[];
       group.forEach(choice=>{
         const choices=choice.split('|').map(n=>catalog.byId[n]);
         const selected=choices.find(x=>catalog.compatible(x,gear));
         if(!selected){const first=choices[0];if(first)first.equipment.filter(g=>!gear.includes(g)).forEach(g=>missing.add(g));return;}
         const e=structuredClone(selected);
         if(['endurance'].includes(id)){e.min=Math.max(e.min,12);e.max=Math.max(e.max,20);e.sets=Math.min(3,e.sets);}
         if(['strength','barbell4'].includes(id)&&e.load!=='bodyweight'){e.min=5;e.max=8;}
         if(['ppl6','fullbody4'].includes(id))e.sets=Math.min(e.sets,3);
         exercises.push(e);
       });
       if(exercises.length===group.length)pairs.push({id:`${String(j+1).padStart(2,'0')}`,restMin: id==='strength'||id==='barbell4'?105:60,restMax:id==='strength'||id==='barbell4'?180:110,exercises});
     });
     result[String.fromCharCode(65+i)]={name,subtitle:spec[id].focus,pairs};
   });
   const expected=(plans[id]||[]).reduce((n,d)=>n+d[1].length,0),actual=Object.values(result).reduce((n,d)=>n+d.pairs.length,0);
   if(actual!==expected)return {compatible:false,missing:[...missing],days:result};
   return {compatible:true,missing:[],days:result};
 }
 const templates={pump:structuredClone(original)};
 // Keep a complete default example for compatibility with existing app versions.
 for(const id of Object.keys(spec)){if(id==='pump')continue;templates[id]=make(id,Object.keys(catalog.gear)).days;}
 const build=(id,gear)=>id==='pump'?{compatible:true,missing:[],days:structuredClone(original)}:make(id,gear);
 window.REPRIVAL_PLAN_LIBRARY={details:spec,templates,build};
})();
