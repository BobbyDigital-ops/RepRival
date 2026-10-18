/* RepRival equipment-led movement catalogue. The requirements are explicit:
   unowned equipment is never silently substituted into an active routine. */
(function(){
 'use strict';
 const GEAR={
  dumbbells:{name:'Dumbbells',group:'Free weights'},
  bench:{name:'Adjustable weight bench',group:'Benches & supports'},
  kettlebell:{name:'Kettlebell',group:'Free weights'},
  ab_wheel:{name:'Ab roller / wheel',group:'Other'},
  pullup_bar:{name:'Pull-up / chin-up bar',group:'Bars & stations'},
  dip_bars:{name:'Dip bars',group:'Bars & stations'},
  row_station:{name:'Stable low bar for inverted rows',group:'Bars & stations'},
  resistance_bands:{name:'Resistance bands',group:'Other'},
  barbell:{name:'Barbell and plates',group:'Free weights'},
  rack:{name:'Squat rack with safeties',group:'Benches & supports'},
  cable:{name:'Cable station',group:'Gym equipment'},
  lat_machine:{name:'Lat pulldown machine',group:'Gym equipment'},
  leg_machine:{name:'Leg extension / curl machine',group:'Gym equipment'},
  press_machine:{name:'Chest / shoulder press machine',group:'Gym equipment'},
  leg_press:{name:'Leg press',group:'Gym equipment'},
  suspension:{name:'Suspension trainer (TRX)',group:'Other'},
  step:{name:'Stable step / plyo box',group:'Benches & supports'},
  rings:{name:'Gymnastic rings',group:'Bars & stations'},
  medicine_ball:{name:'Medicine ball',group:'Other'}
 };
 const OWNER_DEFAULT=['dumbbells','bench','kettlebell','ab_wheel','pullup_bar','dip_bars','row_station'];
 const entries=[];
 const add=(id,name,muscle,gear=[],load='combined',sets=3,min=8,max=12,details='',suffix='')=>entries.push({id,name,muscle,equipment:gear,load,sets,min,max,details,suffix});
 // CHEST: bench, floor, angle, grip and bodyweight variations.
 add('low_incline_db_press','Low-incline DB press','Chest',['dumbbells','bench'],'combined',3,6,10);
 add('flat_db_bench_press','Flat DB bench press','Chest',['dumbbells','bench'],'combined',3,6,10);
 add('incline_db_press_high','High-incline DB press','Chest',['dumbbells','bench']);
 add('db_neutral_press','Neutral-grip DB bench press','Chest',['dumbbells','bench']);
 add('db_close_grip_press','Close-grip DB press','Chest',['dumbbells','bench']);
 add('db_floor_press','DB floor press','Chest',['dumbbells']);
 add('db_alternating_press','Alternating DB bench press','Chest',['dumbbells','bench']);
 add('flat_db_pec_fly','Flat DB pec fly','Chest',['dumbbells','bench'],'combined',2,10,15);
 add('incline_db_fly','Incline DB fly','Chest',['dumbbells','bench'],'combined',2,10,15);
 add('db_squeeze_press','DB squeeze press','Chest',['dumbbells','bench']);
 add('push_up','Push-up','Chest',[],'bodyweight',3,8,20);
 add('close_push_up','Close-grip push-up','Triceps',[],'bodyweight');
 add('wide_push_up','Wide push-up','Chest',[],'bodyweight');
 add('incline_push_up','Incline push-up (hands on bench)','Chest',['bench'],'bodyweight');
 add('decline_push_up','Decline push-up (feet on bench)','Chest',['bench'],'bodyweight');
 add('tempo_push_up','Tempo push-up','Chest',[],'bodyweight');
 add('band_chest_press','Band chest press','Chest',['resistance_bands'],'single');
 add('band_fly','Band chest fly','Chest',['resistance_bands'],'single');
 add('barbell_bench_press','Barbell bench press','Chest',['barbell','bench','rack'],'combined',3,5,8);
 add('barbell_incline_press','Barbell incline press','Chest',['barbell','bench','rack'],'combined');
 add('cable_chest_fly','Cable chest fly','Chest',['cable'],'combined');
 add('machine_chest_press','Machine chest press','Chest',['press_machine'],'combined');
 // BACK / REAR DELTS
 add('inverted_row_neutral','Inverted row · neutral','Back',['row_station'],'bodyweight',3,8,12);
 add('inverted_row_wide','Inverted row · wide grip','Back',['row_station'],'bodyweight');
 add('inverted_row_feet_up','Feet-elevated inverted row','Back',['row_station','bench'],'bodyweight');
 add('chest_supported_db_row','Chest-supported DB row','Back',['dumbbells','bench']);
 add('single_arm_db_row','One-arm DB row (bench support)','Back',['dumbbells','bench'],'single',3,8,12,'Load per hand','per side');
 add('db_bent_over_row','Bent-over DB row','Back',['dumbbells']);
 add('db_wide_row','DB wide-elbow row','Rear delts',['dumbbells']);
 add('db_pullover','DB pullover','Back',['dumbbells','bench'],'single');
 add('chin_up','Chin-up','Back',['pullup_bar'],'bodyweight',3,4,10);
 add('pull_up','Pull-up','Back',['pullup_bar'],'bodyweight',3,4,10);
 add('neutral_pull_up','Neutral-grip pull-up','Back',['pullup_bar'],'bodyweight',3,4,10,'Requires a bar with neutral handles');
 add('scapular_pull_up','Scapular pull-up','Back',['pullup_bar'],'bodyweight',2,8,15);
 add('negative_chin_up','Eccentric chin-up','Back',['pullup_bar'],'bodyweight',3,3,6);
 add('chest_supported_rear_fly','Chest-supported rear fly','Rear delts',['dumbbells','bench'],'combined',2,12,20);
 add('reverse_db_fly','Bent-over reverse DB fly','Rear delts',['dumbbells']);
 add('db_shrug','DB shrug','Back',['dumbbells'],'combined',3,10,15);
 add('band_row','Resistance-band row','Back',['resistance_bands'],'single');
 add('band_pull_apart','Band pull-apart','Rear delts',['resistance_bands'],'single',2,12,20);
 add('band_face_pull','Band face pull','Rear delts',['resistance_bands'],'single',3,12,20);
 add('lat_pulldown','Lat pulldown','Back',['lat_machine'],'combined');
 add('cable_seated_row','Seated cable row','Back',['cable'],'combined');
 add('cable_face_pull','Cable face pull','Rear delts',['cable'],'combined');
 add('barbell_row','Barbell bent-over row','Back',['barbell'],'combined',3,6,10);
 add('ring_row','Ring row','Back',['rings'],'bodyweight');
 add('trx_row','Suspension trainer row','Back',['suspension'],'bodyweight');
 // SHOULDERS
 add('db_overhead_press','DB overhead press','Side delts',['dumbbells'],'combined',3,8,12);
 add('seated_db_press','Seated DB overhead press','Side delts',['dumbbells','bench']);
 add('arnold_press','Arnold press','Side delts',['dumbbells']);
 add('single_arm_db_press','Single-arm DB press','Side delts',['dumbbells'],'single');
 add('db_lateral_raise','DB lateral raise','Side delts',['dumbbells'],'combined',2,12,20);
 add('leaning_lateral_raise','Leaning one-arm lateral raise','Side delts',['dumbbells'],'single',3,10,15);
 add('seated_lateral_raise','Seated lateral raise','Side delts',['dumbbells','bench']);
 add('db_front_raise','DB front raise','Side delts',['dumbbells']);
 add('db_upright_row','DB upright row','Side delts',['dumbbells']);
 add('pike_push_up','Pike push-up','Side delts',[],'bodyweight');
 add('band_lateral_raise','Band lateral raise','Side delts',['resistance_bands'],'single');
 add('barbell_overhead_press','Barbell overhead press','Side delts',['barbell'],'combined',3,5,8);
 add('cable_lateral_raise','Cable lateral raise','Side delts',['cable'],'single');
 add('machine_shoulder_press','Machine shoulder press','Side delts',['press_machine'],'combined');
 // ARMS
 add('incline_db_curl','Incline DB curl','Biceps',['dumbbells','bench'],'combined',2,10,15);
 add('standing_db_curl','Standing DB curl','Biceps',['dumbbells']);
 add('alternating_db_curl','Alternating DB curl','Biceps',['dumbbells']);
 add('hammer_curl','Hammer curl','Biceps',['dumbbells'],'combined',2,10,15);
 add('cross_body_hammer_curl','Cross-body hammer curl','Biceps',['dumbbells']);
 add('concentration_curl','Concentration curl','Biceps',['dumbbells','bench'],'single');
 add('spider_curl','Spider curl on bench','Biceps',['dumbbells','bench']);
 add('preacher_style_curl','Seated incline-supported curl','Biceps',['dumbbells','bench']);
 add('zottman_curl','Zottman curl','Biceps',['dumbbells']);
 add('reverse_db_curl','Reverse-grip DB curl','Biceps',['dumbbells']);
 add('band_curl','Band biceps curl','Biceps',['resistance_bands'],'single');
 add('cable_curl','Cable biceps curl','Biceps',['cable'],'combined');
 add('barbell_curl','Barbell curl','Biceps',['barbell'],'combined');
 add('lying_db_triceps_extension','Lying DB triceps extension','Triceps',['dumbbells','bench'],'combined',2,10,15);
 add('overhead_db_triceps_extension','Overhead DB triceps extension','Triceps',['dumbbells'],'single',2,10,15);
 add('single_arm_overhead_extension','Single-arm DB overhead extension','Triceps',['dumbbells'],'single');
 add('db_kickback','DB triceps kickback','Triceps',['dumbbells'],'single');
 add('close_grip_db_floor_press','Close-grip DB floor press','Triceps',['dumbbells']);
 add('bench_dip','Bench dip','Triceps',['bench'],'bodyweight',2,8,15,'Only if comfortable for shoulders');
 add('parallel_bar_dip','Parallel-bar dip','Triceps',['dip_bars'],'bodyweight',3,5,12);
 add('band_triceps_pressdown','Band triceps pressdown','Triceps',['resistance_bands'],'single');
 add('cable_triceps_pushdown','Cable triceps pushdown','Triceps',['cable'],'combined');
 add('close_grip_barbell_press','Close-grip barbell bench press','Triceps',['barbell','bench','rack'],'combined');
 // LEGS
 add('goblet_squat','Goblet squat','Quads',['dumbbells'],'single',3,8,12);
 add('kb_goblet_squat','Kettlebell goblet squat','Quads',['kettlebell'],'single');
 add('db_front_squat','Double DB front squat','Quads',['dumbbells']);
 add('db_sumo_squat','DB sumo squat','Quads',['dumbbells'],'single');
 add('bodyweight_squat','Bodyweight squat','Quads',[],'bodyweight',3,12,20);
 add('tempo_squat','Slow-tempo squat','Quads',[],'bodyweight');
 add('reverse_lunge','Reverse lunge','Quads',['dumbbells'],'combined',2,8,10,'','per leg');
 add('forward_lunge','Forward lunge','Quads',['dumbbells'],'combined',3,8,12,'','per leg');
 add('walking_lunge','Walking DB lunge','Quads',['dumbbells'],'combined',3,10,16,'','per leg');
 add('bodyweight_reverse_lunge','Bodyweight reverse lunge','Quads',[],'bodyweight',3,10,15,'','per leg');
 add('bulgarian_split_squat','Bulgarian split squat · DB','Quads',['dumbbells','bench'],'combined',3,8,12,'Rear foot on stable bench','per leg');
 add('bodyweight_bulgarian_split_squat','Bulgarian split squat · bodyweight','Quads',['bench'],'bodyweight',3,8,12,'Rear foot on stable bench','per leg');
 add('front_foot_elevated_split_squat','Front-foot-elevated DB split squat','Quads',['dumbbells','step'],'combined',3,8,12,'','per leg');
 add('split_squat','Static DB split squat','Quads',['dumbbells'],'combined',3,8,12,'','per leg');
 add('db_step_up','DB step-up','Quads',['dumbbells','bench'],'combined',3,8,12,'Bench must be stable and suitable height','per leg');
 add('bodyweight_step_up','Bodyweight step-up','Quads',['step'],'bodyweight',3,10,15,'','per leg');
 add('db_romanian_deadlift','DB Romanian deadlift','Hamstrings',['dumbbells'],'combined',3,8,12);
 add('single_leg_db_rdl','Single-leg DB RDL','Hamstrings',['dumbbells'],'single',3,8,12,'','per leg');
 add('staggered_stance_rdl','B-stance DB Romanian deadlift','Hamstrings',['dumbbells'],'combined',3,8,12,'','per leg');
 add('db_deadlift','DB deadlift','Hamstrings',['dumbbells'],'combined',3,8,12);
 add('db_glute_bridge','DB glute bridge','Glutes',['dumbbells'],'single',3,10,15);
 add('bodyweight_glute_bridge','Glute bridge','Glutes',[],'bodyweight',3,12,20);
 add('hip_thrust_bench','DB hip thrust on bench','Glutes',['bench','dumbbells'],'single',3,8,15);
 add('single_leg_hip_thrust','Single-leg hip thrust on bench','Glutes',['bench'],'bodyweight',3,8,12,'','per leg');
 add('db_calf_raise','Standing DB calf raise','Calves',['dumbbells'],'combined',3,12,20);
 add('single_leg_calf_raise','Single-leg calf raise','Calves',[],'bodyweight',3,12,20,'','per leg');
 add('kb_swing','Kettlebell swing','Hamstrings',['kettlebell'],'single',3,12,20);
 add('kb_rdl','Kettlebell Romanian deadlift','Hamstrings',['kettlebell'],'single');
 add('kb_deadlift','Kettlebell deadlift','Hamstrings',['kettlebell'],'single');
 add('kb_reverse_lunge','Kettlebell reverse lunge','Quads',['kettlebell'],'single',3,8,12,'','per leg');
 add('barbell_back_squat','Barbell back squat','Quads',['barbell','rack'],'combined',3,5,8);
 add('barbell_front_squat','Barbell front squat','Quads',['barbell','rack'],'combined');
 add('barbell_deadlift','Barbell deadlift','Hamstrings',['barbell'],'combined',3,4,8);
 add('barbell_rdl','Barbell Romanian deadlift','Hamstrings',['barbell'],'combined');
 add('barbell_hip_thrust','Barbell hip thrust','Glutes',['barbell','bench'],'combined');
 add('leg_press','Leg press','Quads',['leg_press'],'combined');
 add('leg_extension','Leg extension','Quads',['leg_machine'],'combined');
 add('leg_curl','Leg curl','Hamstrings',['leg_machine'],'combined');
 // CORE, CARRIES, MOVEMENT
 add('ab_rollout','Ab rollout','Core',['ab_wheel'],'bodyweight',2,6,12);
 add('kneeling_ab_rollout','Kneeling ab wheel rollout','Core',['ab_wheel'],'bodyweight',3,6,12);
 add('standing_ab_rollout','Standing ab wheel rollout','Core',['ab_wheel'],'bodyweight',2,3,8);
 add('plank','Forearm plank (seconds)','Core',[],'bodyweight',3,25,60,'Log duration in seconds');
 add('side_plank','Side plank (seconds per side)','Core',[],'bodyweight',3,20,45,'Log duration in seconds','per side');
 add('dead_bug','Dead bug','Core',[],'bodyweight',3,8,14,'','per side');
 add('bird_dog','Bird dog','Core',[],'bodyweight',3,8,14,'','per side');
 add('hollow_hold','Hollow hold (seconds)','Core',[],'bodyweight',3,15,40,'Log duration in seconds');
 add('reverse_crunch','Reverse crunch','Core',[],'bodyweight',3,10,20);
 add('bicycle_crunch','Bicycle crunch','Core',[],'bodyweight',3,12,25);
 add('decline_sit_up','Decline sit-up','Core',['bench'],'bodyweight',2,8,15,'Requires a bench able to decline securely');
 add('leg_raise','Lying leg raise','Core',[],'bodyweight',3,10,15);
 add('hanging_knee_raise','Hanging knee raise','Core',['pullup_bar'],'bodyweight',3,8,15);
 add('hanging_leg_raise','Hanging leg raise','Core',['pullup_bar'],'bodyweight',3,6,12);
 add('farmer_carry','DB farmer carry (steps)','Core',['dumbbells'],'combined',3,25,50,'Log steps as reps');
 add('suitcase_carry','Suitcase carry (steps per side)','Core',['dumbbells'],'single',3,25,50,'Log steps as reps','per side');
 add('kb_suitcase_carry','Kettlebell suitcase carry (steps)','Core',['kettlebell'],'single',3,25,50,'Log steps as reps','per side');
 add('kb_clean','Kettlebell clean','Hamstrings',['kettlebell'],'single',3,6,10,'','per side');
 add('kb_press','Kettlebell strict press','Side delts',['kettlebell'],'single',3,6,10,'','per side');
 add('kb_clean_press','Kettlebell clean and press','Side delts',['kettlebell'],'single',3,6,10,'','per side');
 add('kb_halo','Kettlebell halo','Core',['kettlebell'],'single',3,8,12);
 add('kb_turkish_getup','Kettlebell Turkish get-up','Core',['kettlebell'],'single',2,2,5,'Technique-intensive; start light','per side');
 add('mountain_climbers','Mountain climbers','Core',[],'bodyweight',3,20,40);
 add('med_ball_slam','Medicine ball slam','Core',['medicine_ball'],'single',3,10,15);
 entries.forEach(e=>{if(/\(seconds/i.test(e.name))e.unit='seconds';else if(/\(steps/i.test(e.name))e.unit='steps';});
 const byId=Object.fromEntries(entries.map(e=>[e.id,e]));
 const compatible=(ex,gear)=>!!ex&&(ex.equipment||[]).every(g=>gear.includes(g));
 window.REPRIVAL_EXERCISE_LIBRARY={gear:GEAR,ownerDefault:OWNER_DEFAULT,entries,byId,compatible};
})();
