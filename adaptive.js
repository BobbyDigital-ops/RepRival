/* RepRival Adaptive Training v1.6.1 — local, deterministic and equipment/space aware.
   Training stimulus and recovery are estimates, never medical measurements. */
(function(){
'use strict';
const GROUPS=['Chest','Back','Shoulders','Arms','Legs','Core'];
const TEMPLATES={
 balanced:{name:'Balanced',desc:'Develop the whole body steadily',levels:[3,3,3,3,3,3]},
 upper:{name:'Upper Body Focus',desc:'Develop upper body, maintain lower body',levels:[4,4,4,3,1,2]},
 lower:{name:'Lower Body Focus',desc:'Prioritise legs and posterior chain',levels:[2,2,2,2,4,3]},
 runner:{name:"Runner's Strength",desc:'Prioritise upper body with lighter gym leg loading',levels:[4,4,3,3,1,3]},
 arms:{name:'Arms & Shoulders',desc:'More direct arm and deltoid work',levels:[2,3,4,4,2,2]},
 maintenance:{name:'Maintenance',desc:'Maintain strength with lower volume',levels:[1,1,1,1,1,1]}
};
const LEVELS=['Minimal','Maintenance','Balanced','Focus','High focus'];
const PERIODS={weekly:7,fortnightly:14,monthly:28,manual:null};
const groupFor=m=>m==='Chest'?'Chest':m==='Back'?'Back':['Side delts','Rear delts','Shoulders'].includes(m)?'Shoulders':['Biceps','Triceps','Arms'].includes(m)?'Arms':['Quads','Hamstrings','Glutes','Calves','Legs'].includes(m)?'Legs':'Core';
const clip=(n,a,b)=>Math.max(a,Math.min(b,n));
const daysSince=(when,now)=>Math.max(0,(now-Date.parse(when||''))/86400000);
const isoDay=t=>new Date(t).toISOString().slice(0,10);
const charHash=s=>[...s].reduce((a,c)=>(a*33+c.charCodeAt(0))%1000003,7);
function nextReviewDay(cfg){if(PERIODS[cfg.review]==null)return null;const t=Date.parse((cfg.reviewedAt||cfg.startedAt||isoDay(Date.now()))+'T12:00:00Z');return isoDay(t+PERIODS[cfg.review]*86400000);}
function metrics(history=[],now=Date.now()){
 const out=Object.fromEntries(GROUPS.map(name=>[name,{recent:0,last:null,sets7:0,sets28:0,sessions:0}]));
 for(const session of history){const t=Date.parse(session.endedAt||session.startedAt||'');if(!Number.isFinite(t)||t>now)continue;
   const age=(now-t)/86400000,seen=new Set();
   for(const l of session.logs||[]){const g=groupFor(l.muscle||'Core'),m=out[g];if(!m)continue;
     if(age<28){m.sets28++;seen.add(g);m.recent+=Math.pow(.5,age/5)*((l.rir!=null&&Number(l.rir)<=2)?1:.8);}
     if(age<7)m.sets7++;
     m.last=Math.max(m.last||0,t);
   }
   for(const g of seen)out[g].sessions++;
 }
 return out;
}
// One movement pattern per session avoids doing two effectively identical lifts.
function pattern(e){const id=e.id.toLowerCase(),name=e.name.toLowerCase(),muscle=e.muscle;
 if(/carry|farmer|suitcase/.test(id+' '+name))return 'loaded_carry';
 if(/walking.lunge|walking.lunges/.test(id+' '+name))return 'travel_lunge';
 if((/overhead.*press|shoulder.press|arnold.press|db_press|pike.push.up|handstand/.test(id))&&muscle==='Side delts')return 'overhead_press';
 if(/bench.press|floor.press|push.up|chest.press|squeeze.press/.test(id))return 'chest_press';
 if(/fly/.test(id)&&muscle==='Chest')return 'chest_fly';
 if(/pulldown|pull.up|chin.up|scapular.pull/.test(id))return 'vertical_pull';
 if(/row/.test(id)&&muscle==='Back')return 'horizontal_row';
 if(/rear.fly|reverse.fly|face.pull|pull.apart|wide.row/.test(id))return 'rear_delt';
 if(/lateral.raise|front.raise|upright.row/.test(id))return 'lateral_raise';
 if(/curl/.test(id))return 'curl';
 if(/tricep|skull.crush|close.push|dip/.test(id))return 'triceps';
 if(/romanian|rdl|good.morning|deadlift|hip.hinge/.test(id))return 'hinge';
 if(/split.squat|lunge|step.up|pistol/.test(id))return 'single_leg';
 if(/squat|leg.press|leg.extension/.test(id))return 'squat';
 if(/hip.thrust|glute.bridge/.test(id))return 'hip_extension';
 if(/hamstring.curl|leg.curl|nordic/.test(id))return 'ham_curl';
 if(/calf/.test(id))return 'calves';
 if(/rollout|ab.wheel|plank/.test(id))return 'anti_extension';
 if(/sit.up|crunch|leg.raise|knee.raise/.test(id))return 'core_flexion';
 if(/twist|rotation|pallof|side.plank/.test(id))return 'core_rotation';
 if(/swing/.test(id))return 'hinge';
 return groupFor(muscle)+'-'+id.replace(/_\d+/g,'');
}
function allowed(e,cfg,owned,avoid){
 const lib=window.REPRIVAL_EXERCISE_LIBRARY,id=e.id.toLowerCase(),name=e.name.toLowerCase(),p=pattern(e);
 if(!lib.compatible(e,owned)||avoid.has(e.id))return false;
 // 'Small space' defaults on: no exercises requiring walking back and forth.
 if((cfg.space||'small')!=='large'&&(p==='loaded_carry'||p==='travel_lunge'||/sprint|walking|sled|shuttle/.test(id+' '+name)))return false;
 const exclusions=new Set(cfg.exclusions||[]);
 if(exclusions.has('carries')&&p==='loaded_carry')return false;
 if(exclusions.has('overhead')&&p==='overhead_press')return false;
 if(exclusions.has('impact')&&/jump|hop|plyo|burpee|box.jump/.test(id+' '+name))return false;
 if(exclusions.has('deep_knee')&&/squat|lunge|step.up|leg.press|leg.extension|pistol/.test(id))return false;
 if(exclusions.has('floor')&&/floor|sit.up|ab.wheel|rollout|plank|push.up|crunch/.test(id))return false;
 if(cfg.experience==='beginner'&&/pistol|muscle.up|dragon.flag|handstand|weighted.pull|advanced/.test(id))return false;
 return true;
}
function generate(cfg,history=[],owned=[],checkin=null,{now=Date.now(),variant=0,avoid=[],focusLock=[]}={}){
 const lib=window.REPRIVAL_EXERCISE_LIBRARY;
 const levels=Array.isArray(cfg.levels)&&cfg.levels.length===6?cfg.levels:(TEMPLATES[cfg.template]||TEMPLATES.balanced).levels;
 const duration=clip(Number(cfg.duration)||40,20,90),frequency=clip(Number(cfg.frequency)||3,1,7),training=metrics(history,now);
 const light=Number(checkin?.fatigue)>=3||Number(checkin?.soreness)>=3||checkin?.sleep==='poor';
 const hardRunTomorrow=Array.isArray(cfg.runningDays)&&cfg.runningDays.includes((new Date(now).getDay()+1)%7);
 const sore=new Set(checkin?.groups||[]),avoidIds=new Set([...(cfg.avoid||[]),...(avoid||[])]);
 const allEligible=lib.entries.filter(e=>allowed(e,cfg,owned,avoidIds));
 const locked=new Set(focusLock||[]);
 const lockedEligible=allEligible.filter(e=>locked.has(groupFor(e.muscle)));
 const options=lockedEligible.length>=4&&new Set(lockedEligible.map(pattern)).size>=4?lockedEligible:allEligible;
 const recentIds=new Set(history.slice(-2).flatMap(s=>(s.logs||[]).map(l=>l.exId)));
 const historicalIds=new Set(history.flatMap(s=>(s.logs||[]).map(l=>l.exId)));
 const preferred=new Set(cfg.preferred||[]);
 const sessionExerciseTarget=duration<=25?4:duration<=35?5:duration<=45?6:duration<=55?7:duration<=65?8:9;
 const exerciseTarget=Math.min(sessionExerciseTarget,options.length);
 const targets=[1,3,6,9,12];
 const ratings=Object.fromEntries(GROUPS.map((g,i)=>{
   const level=clip(Number(levels[i])||0,0,4),m=training[g],target=targets[level],need=clip((target-m.sets7)/Math.max(target,1),-.6,1.5),elapsed=m.last?clip((now-m.last)/86400000/4,0,1.7):1.3;
   let p=.5+level*.7+Math.max(0,need)*1.3+elapsed*.45;
   if(sore.has(g))p*=.35;
   if(m.last&&now-m.last<36*3600000)p*=.62;
   if(g==='Legs'&&cfg.running){p*=level>=3?.90:(cfg.runningLoad==='high'?.52:.75);if(hardRunTomorrow)p*=.5;}
   return [g,{level,priority:p,sets:0,number:0,m}];
 }));
 const usedPatterns=new Set(),usedIds=new Set(),picked=[];
 const seed=Number(cfg.sequence||0)*101+variant*673;
 function suitability(e,slot){
   const g=groupFor(e.muscle),r=ratings[g],p=pattern(e);
   if(usedIds.has(e.id)||usedPatterns.has(p))return -Infinity;
   const base=r.priority/(1+r.number*.84+r.sets*.11);
   const typical=lib.entries.findIndex(x=>x.id===e.id);
   let familiarity=preferred.has(e.id)?1.5:historicalIds.has(e.id)?.58:0;
   if(recentIds.has(e.id))familiarity-=.26;
   // Prefer simple repeatable exercises instead of novelty for its own sake.
   const movementBonus=['chest_press','horizontal_row','hinge','squat','single_leg','vertical_pull'].includes(p)&&slot<5?.65:0;
   const variety=((charHash(e.id+'|'+seed)%97)/97)*(.72+(variant%3)*.17);
   return base+familiarity+movementBonus+variety-.002*Math.max(0,typical);
 }
 for(let slot=0;slot<exerciseTarget;slot++){
   const candidates=options.map(e=>({e,v:suitability(e,slot)})).filter(x=>Number.isFinite(x.v)).sort((a,b)=>b.v-a.v);
   if(!candidates.length)break;
   const item=candidates[0].e,g=groupFor(item.muscle),p=pattern(item);
   let sets=ratings[g].level>=4?4:ratings[g].level<=1?2:3;
   if(light)sets=Math.max(2,sets-1);
   // Extra sets often overrun shorter sessions; 40 minutes aims for ~16–19 working sets.
   if(duration<=45&&ratings[g].level>=4)sets=3;
   const ex={...item,sets};
   if(cfg.goal==='strength'){ex.min=Math.max(3,Math.min(6,ex.min));ex.max=Math.max(ex.min,Math.min(9,ex.max));}
   if(cfg.goal==='endurance'){ex.min=Math.max(10,ex.min);ex.max=Math.max(ex.min,Math.min(25,ex.max+4));}
   picked.push({ex,group:g,pattern:p});usedIds.add(ex.id);usedPatterns.add(p);
   ratings[g].sets+=sets;ratings[g].number++;
 }
 // Pair different muscle groups, avoiding near-identical exercises in the same superset.
 const arranged=[];const pending=[...picked];
 while(pending.length){const a=pending.shift(),partnerIndex=pending.findIndex(b=>b.group!==a.group&&b.pattern!==a.pattern);
   const b=partnerIndex>=0?pending.splice(partnerIndex,1)[0]:pending.shift();arranged.push(b?[a,b]:[a]);}
 const pairs=arranged.map((items,i)=>({id:'adaptive-block-'+(i+1),restMin:light?85:70,restMax:light?135:110,exercises:items.map(x=>x.ex)}));
 const sets=picked.reduce((n,x)=>n+x.ex.sets,0);
 const estimate=Math.round(5+sets*1.32+pairs.length*2.15+picked.length*.65);
 const focus=[...new Set(picked.map(x=>x.group))];
 const title=focus.slice(0,2).join(' + ')||'Adaptive Workout';
 const reason=`${picked.length} movements · ${sets} sets · approximately ${estimate} min. ${light?'Readiness suggests a lighter effort. ':'Training focus: '+focus.slice(0,3).join(', ')+'. '}${(cfg.space||'small')==='small'?'No travelling carries. ':''}Different movement patterns are paired to avoid repetition.`;
 return {name:title,pairs,focus,explanation:reason,estimatedMinutes:estimate,metrics:training};
}
function review(cfg,history,checkin,now=Date.now()){
 const data=metrics(history,now),levels=cfg.levels||(TEMPLATES[cfg.template]||TEMPLATES.balanced).levels;
 const rows=GROUPS.map((name,i)=>{const m=data[name],level=levels[i],target=[1,3,6,9,12][level],actual=m.sets7;
   const proposed=(checkin?.groups||[]).includes(name)&&Number(checkin?.soreness)>=3?Math.max(0,level-1):level;
   return {name,actual,target,level,proposed,note:actual<target*.55?'Below your current target':actual>target*1.6?'Above your chosen emphasis':'Within your intended range'};
 });
 return {rows,levels:rows.map(x=>x.proposed),due:nextReviewDay(cfg)!=null&&nextReviewDay(cfg)<=isoDay(now)};
}
window.RepRivalAdaptive={GROUPS,TEMPLATES,LEVELS,PERIODS,groupFor,pattern,allowed,metrics,generate,review,nextReviewDay};
})();
