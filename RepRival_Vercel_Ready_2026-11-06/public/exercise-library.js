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
 add('db_bent_over_row','Bent-over DB row','Back',['dumbbells'],'combined',3,8,12);
 add('db_wide_row','DB wide-elbow row','Rear delts',['dumbbells']);
 add('db_pullover','DB pullover','Back',['dumbbells','bench'],'single');
 add('chin_up','Chin-up','Back',['pullup_bar'],'bodyweight',3,4,10);
 add('pull_up','Pull-up','Back',['pullup_bar'],'bodyweight',3,4,10);
 add('neutral_pull_up','Neutral-grip pull-up','Back',['pullup_bar'],'bodyweight',3,4,10,'Requires a bar with neutral handles');
 add('scapular_pull_up','Scapular pull-up','Back',['pullup_bar'],'bodyweight',2,8,15);
 add('negative_chin_up','Eccentric chin-up','Back',['pullup_bar'],'bodyweight',3,3,6);
 add('chest_supported_rear_fly','Chest-supported rear fly','Rear delts',['dumbbells','bench'],'combined',2,12,20);
 add('standing_rear_fly','Standing DB rear-delt fly','Rear delts',['dumbbells'],'combined',2,12,20,'Hinged standing rear lateral fly');
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
 add('bodyweight_doorway_row','Doorway row','Back',[],'bodyweight',3,10,15,'Grasp doorway frame and lean back to row (requires sturdy doorframe)');
 add('superman_row','Prone cobra / superman row','Back',[],'bodyweight',3,12,20,'Lying face down, lift chest and squeeze shoulder blades (floor bodyweight)');
 add('bodyweight_doorway_curl','Doorway biceps curl','Biceps',[],'bodyweight',3,10,15,'Isometric doorway arm pull (requires sturdy doorframe)');
 add('bodyweight_rear_delt_fly','Prone rear-delt Y-fly','Rear delts',[],'bodyweight',3,12,20,'Lying face down, raise arms in Y shape (floor bodyweight)');
 add('single_leg_hip_hinge','Single-leg bodyweight RDL','Hamstrings',[],'bodyweight',3,10,15,'Balance on one leg and hinge hips','per side');
 add('single_leg_glute_bridge','Single-leg glute bridge','Glutes',[],'bodyweight',3,10,15,'Lying bridge with one leg extended','per side');

  // ADDITIONAL COMPREHENSIVE DUMBBELL VARIATIONS
  add('standing_db_row','Standing bent-over DB row','Back',['dumbbells'],'combined',3,8,12,'Hinge at hips, pull dumbbells to lower ribs');
  add('standing_single_arm_db_row','Standing one-arm DB row (free stance)','Back',['dumbbells'],'single',3,8,12,'Brace opposite hand on knee or thigh','per side');
  add('standing_strict_db_press','Standing strict DB overhead press','Side delts',['dumbbells'],'combined',3,6,10,'Strict standing press without leg drive');
  add('standing_db_high_pull','Standing DB high pull','Side delts',['dumbbells'],'combined',3,8,12,'Explosive pull to upper chest');
  add('standing_db_side_bend','Standing DB side bend','Core',['dumbbells'],'single',3,12,18,'Isolate obliques','per side');
  add('standing_db_calf_raise','Standing DB calf raise','Calves',['dumbbells'],'combined',3,15,25,'Full extension at top');
  add('db_goblet_squat','DB goblet squat','Quads',['dumbbells'],'combined',3,8,12,'Hold dumbbell vertically at chest');
  add('db_front_squat','DB dual front squat','Quads',['dumbbells'],'combined',3,8,12,'Dumbbells racked on shoulders');
  add('db_sumo_squat','DB sumo squat','Glutes',['dumbbells'],'combined',3,10,15,'Wide stance, toes pointed outward');
  add('db_split_squat','DB split squat (stationary lunge)','Quads',['dumbbells'],'combined',3,8,12,'Stationary rear-foot split squat','per side');
  add('db_bulgarian_split_squat','DB Bulgarian split squat','Quads',['dumbbells','bench'],'combined',3,8,12,'Rear foot elevated on bench','per side');
  add('db_romanian_deadlift','DB Romanian deadlift (RDL)','Hamstrings',['dumbbells'],'combined',3,8,12,'Hinge with slight knee bend');
  add('db_stiff_leg_deadlift','DB stiff-leg deadlift','Hamstrings',['dumbbells'],'combined',3,10,15,'Minimal knee bend for hamstring stretch');
  add('db_sumo_deadlift','DB sumo deadlift','Glutes',['dumbbells'],'combined',3,8,12,'Wide stance deadlift with dumbbells');
  add('db_reverse_lunge','DB reverse lunge','Quads',['dumbbells'],'combined',3,8,12,'Step backward into lunge','per side');
  add('db_walking_lunge','DB walking lunge (steps)','Quads',['dumbbells'],'combined',3,20,40,'Continuous walking lunges','per side');
  add('db_side_lunge','DB lateral side lunge','Quads',['dumbbells'],'combined',3,8,12,'Lateral lunge movement','per side');
  add('db_curtsy_lunge','DB curtsy lunge','Glutes',['dumbbells'],'combined',3,8,12,'Cross rear leg behind','per side');
  add('db_step_up','DB step-up onto box','Quads',['dumbbells','step'],'combined',3,8,12,'Step up onto stable platform','per side');
  add('db_floor_press','DB floor press (heavy)','Chest',['dumbbells'],'combined',3,6,10,'Floor-restricted bench press alternative');
  add('db_floor_fly','DB floor pec fly','Chest',['dumbbells'],'combined',2,10,15,'Controlled descent to floor touch');
  add('db_floor_skullcrusher','DB floor skullcrusher (triceps)','Triceps',['dumbbells'],'combined',3,8,12,'Lying on floor tricep extension');
  add('db_overhead_tricep_extension','Standing DB overhead tricep extension','Triceps',['dumbbells'],'combined',3,8,12,'Both hands holding single dumbbell overhead');
  add('db_kickback','DB tricep kickback','Triceps',['dumbbells'],'single',3,10,15,'Hinged upper-arm lock extension','per side');
  add('db_zottman_curl','DB Zottman curl','Biceps',['dumbbells'],'combined',3,8,12,'Up with supinated, down with pronated grip');
  add('db_concentration_curl_standing','Standing concentration curl','Biceps',['dumbbells'],'single',3,10,15,'Elbow braced against inner thigh','per side');
  add('db_thruster','DB thruster (squat to press)','Quads',['dumbbells'],'combined',3,6,10,'Explosive squat clean into overhead press');
  add('db_clean','DB hang clean','Hamstrings',['dumbbells'],'combined',3,6,10,'Explosive hip hinge clean to shoulders');
  add('db_snatch','DB single-arm snatch','Side delts',['dumbbells'],'single',3,5,8,'Explosive ground-to-overhead pull','per side');
  add('db_windmill','DB dumbbell windmill','Core',['dumbbells'],'single',3,5,8,'Mobility and core stability hinge','per side');
  add('db_renegade_row','DB renegade row in plank','Back',['dumbbells'],'combined',3,6,10,'Plank position alternate dumbbell row');
  add('chest_supported_db_row_incline','Chest-supported incline DB row','Back',['dumbbells','bench'],'combined',3,8,12,'Prone on incline bench, row to waist');
  add('db_seal_row','Dumbbell seal row','Back',['dumbbells','bench'],'combined',3,8,12,'Lying face down on elevated bench row');
  add('meadows_db_row','Meadows DB row','Back',['dumbbells'],'single',3,8,12,'Staggered stance overhand dumbbell row','per side');
  add('db_kroc_row','Kroc DB row (high-rep)','Back',['dumbbells','bench'],'single',3,12,20,'Heavy high-rep single arm dumbbell row','per side');
  add('hammer_db_row','Hammer-grip DB row','Back',['dumbbells'],'combined',3,8,12,'Neutral grip bent-over dumbbell row');
  add('db_rear_delt_row','Flared rear-delt DB row','Back',['dumbbells'],'combined',3,10,15,'Elbows flared out 90 degrees to hit rear delts');
  add('standing_db_upright_row','Standing DB upright row','Side delts',['dumbbells'],'combined',3,10,15,'Pull dumbbells up to chest height with elbows high');
  add('db_arnold_press','Arnold DB press','Side delts',['dumbbells'],'combined',3,8,12,'Rotate palms from inside to forward as you overhead press');
  add('db_spider_curl','Spider DB curl (incline bench)','Biceps',['dumbbells','bench'],'combined',3,10,14,'Chest against incline bench, strict arm isolation curl');
  add('db_hammer_curl','Standing DB hammer curl','Biceps',['dumbbells'],'combined',3,8,12,'Neutral grip curl targeting brachialis');
  add('db_cross_body_hammer_curl','Cross-body DB hammer curl','Biceps',['dumbbells'],'single',3,8,12,'Curl dumbbell across chest towards opposite shoulder','per side');
  add('db_concentration_curl','Seated DB concentration curl','Biceps',['dumbbells','bench'],'single',3,10,14,'Triceps braced against inner thigh for isolation','per side');
  add('db_jm_press','Dumbbell JM press','Triceps',['dumbbells','bench'],'combined',3,8,12,'Hybrid skullcrusher and press to upper chest');
  add('db_tate_press','Lying DB Tate press','Triceps',['dumbbells','bench'],'combined',3,10,15,'Flared elbow extension on flat bench');
  add('db_single_leg_rdl','Single-leg DB RDL','Hamstrings',['dumbbells'],'single',3,8,12,'Balance on one leg while hinging with dumbbells','per side');
  add('db_hip_thrust','DB hip thrust','Glutes',['dumbbells','bench'],'combined',3,10,15,'Dumbbell placed across hips, bridge up');
  add('db_farmers_walk','DB farmer\'s walk (steps)','Core',['dumbbells'],'combined',3,30,60,'Heavy farmer carry for distance or steps','steps');
  add('db_waiters_carry','DB waiter\'s carry (steps)','Core',['dumbbells'],'single',3,20,40,'Overhead single dumbbell carry','steps');
  add('db_suitcase_carry','DB suitcase carry (steps)','Core',['dumbbells'],'single',3,20,40,'Single dumbbell hold at side walk','steps');

  function inferPatternAndFamily(ex) {
    let pattern = 'isolation';
    let family = ex.id;

    if (/push_up/i.test(ex.id)) {
      pattern = /pike/i.test(ex.id) ? 'vertical_push' : 'horizontal_push';
      family = 'push_ups';
    } else if (/dip/i.test(ex.id)) {
      pattern = 'vertical_push';
      family = 'dips';
    } else if (/press/i.test(ex.id) && ex.muscle === 'Chest') {
      pattern = 'horizontal_push';
      family = 'chest_presses';
    } else if (/fly/i.test(ex.id) && ex.muscle === 'Chest') {
      pattern = 'horizontal_push';
      family = 'chest_flys';
    } else if ((/press|overhead/i.test(ex.id) || /press/i.test(ex.name)) && (ex.muscle === 'Side delts' || ex.muscle === 'Shoulders')) {
      pattern = 'vertical_push';
      family = 'overhead_presses';
    } else if (/lateral_raise|front_raise|upright_row/i.test(ex.id)) {
      pattern = 'isolation';
      family = 'delt_raises';
    } else if (/row/i.test(ex.id) || /row/i.test(ex.name)) {
      pattern = 'horizontal_pull';
      family = 'rows';
    } else if (/pull_up|chin_up|pulldown/i.test(ex.id)) {
      pattern = 'vertical_pull';
      family = 'pullups';
    } else if (/squat/i.test(ex.id) || /squat/i.test(ex.name)) {
      pattern = 'squat';
      family = 'squats';
    } else if (/lunge|step_up|split_squat/i.test(ex.id)) {
      pattern = 'lunge';
      family = 'lunges';
    } else if (/deadlift|rdl|hinge|good_morning/i.test(ex.id)) {
      pattern = 'hip_hinge';
      family = 'hip_hinges';
    } else if (/bridge|thrust/i.test(ex.id)) {
      pattern = 'glute_dominant';
      family = 'glute_bridges';
    } else if (/plank|dead_bug|bird_dog|hold|carry/i.test(ex.id)) {
      pattern = 'core_stability';
      family = 'core_stability';
    } else if (/crunch|sit_up|leg_raise|knee_raise|rollout|mountain_climbers/i.test(ex.id)) {
      pattern = 'core_flexion';
      family = 'core_flexion';
    } else if (/curl/i.test(ex.id)) {
      pattern = 'isolation';
      family = 'bicep_curls';
    } else if (/tricep|skullcrusher|extension|kickback|pressdown|pushdown/i.test(ex.id)) {
      pattern = 'isolation';
      family = 'tricep_extensions';
    }

    return { pattern, family };
  }

  entries.forEach(e=>{
    if(/\(seconds/i.test(e.name))e.unit='seconds';
    else if(/\(steps/i.test(e.name))e.unit='steps';
    const pf = inferPatternAndFamily(e);
    e.movementPattern = pf.pattern;
    e.family = pf.family;
  });
  const byId=Object.fromEntries(entries.map(e=>[e.id,e]));
  if(byId['standing_rear_fly']){
    byId['standing_db_rear_fly'] = byId['standing_rear_fly'];
  }
  const compatible=(ex,gear)=>!!ex&&(ex.equipment||[]).every(g=>gear.includes(g));
  window.REPRIVAL_EXERCISE_LIBRARY={gear:GEAR,ownerDefault:OWNER_DEFAULT,entries,byId,compatible};
})();
