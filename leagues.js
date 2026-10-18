/* RepRival 1.4.9. Deterministic, local-only fictional league sandbox.
 * No account service, requests, or collection of other users' data.
 */
'use strict';
(function(root){
  const POPULATION=10000, OPPONENTS=14, DAY=86400000, STEP=6*3600000, HOLD=24*3600000;
  const LOCATIONS={
    'United Kingdom': ['Taunton','Exeter','Bristol','Bath','Plymouth','Cardiff','Southampton','Oxford','Reading','Birmingham','Nottingham','Manchester','Liverpool','Leeds','Sheffield','Newcastle','Glasgow','Edinburgh','Belfast','Norwich','Brighton','London'],
    'Taunton': ['Taunton','Bridgwater','Wellington','Minehead','Yeovil','Burnham-on-Sea','Tiverton','Exeter','Bristol'],
    'Bristol': ['Bristol','Bath','Weston-super-Mare','Clevedon','Portishead','Taunton','Gloucester','Chippenham'],
    'Exeter': ['Exeter','Exmouth','Tiverton','Newton Abbot','Torquay','Taunton','Plymouth'],
    'Plymouth': ['Plymouth','Saltash','Tavistock','Torquay','Exeter','Truro'],
    'Cardiff': ['Cardiff','Newport','Barry','Bridgend','Swansea','Bristol'],
    'London': ['London','Croydon','Watford','Bromley','Romford','Reading','Slough'],
    'Birmingham': ['Birmingham','Solihull','Coventry','Wolverhampton','Dudley','Redditch'],
    'Manchester': ['Manchester','Salford','Stockport','Bolton','Oldham','Rochdale','Warrington'],
    'Leeds': ['Leeds','Bradford','Wakefield','Harrogate','Huddersfield','York'],
    'Glasgow': ['Glasgow','Paisley','East Kilbride','Hamilton','Clydebank','Edinburgh']
  };
  const FIRST=['Atlas','Iron','North','Peak','Stone','Orbit','Ridge','Apex','Vale','Ember','Nova','Summit','Forge','Horizon','Wild','Cedar','Moss','Pace','Echo','Motion','Strong','River','Focus','Flint','Slate','Drift','Pulse','Harbour','Coast','Cobalt'];
  const LAST=['Fox','Runner','Form','Lift','Fit','Wolf','Trail','Bear','Oak','Frame','Stride','Bolt','Hawk','Peak','Pine','Motion','Rook','Edge','Rider','Glide'];
  function hash(s){let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function random(s){return hash(s)/4294967296;}
  function clamp(n,min,max){return Math.min(max,Math.max(min,n));}
  function initialDivision(rating){return clamp(8-Math.floor(Math.max(0,(Number(rating)||100)-100)/20),2,10);}
  function athlete(id,area){
    const suffix=String(id).padStart(4,'0');
    const name=FIRST[hash('first|'+id)%FIRST.length]+LAST[hash('last|'+id)%LAST.length]+suffix.slice(-2);
    const towns=LOCATIONS[area]||LOCATIONS['United Kingdom'];
    // Mostly local when an area is selected, otherwise drawn across the UK.
    const town=area!=='United Kingdom'&&random('local|'+id)<.7?towns[hash('place|'+id)%towns.length]:LOCATIONS['United Kingdom'][hash('uk|'+id)%LOCATIONS['United Kingdom'].length];
    return {id,name,town,simulated:true};
  }
  function candidateIds(record,exId){
    const ids=[],used=new Set();let cursor=0;
    while(ids.length<OPPONENTS+10&&cursor<200){
      const id=hash(record.key+'|'+exId+'|'+cursor)%POPULATION;cursor++;
      if(!used.has(id)){used.add(id);ids.push(id);}
    }
    return ids;
  }
  function opponentRows(record,exId,at,area='United Kingdom'){
    const slot=Math.floor(at/STEP),elapsed=Math.max(0,(at-record.joinedAt)/DAY);
    return candidateIds(record,exId).map(id=>{
      const baseline=.885+random(record.key+'|ability|'+id)*.235;
      const slope=(random('trend|'+id+'|'+exId)-.5)*.0009;
      const drift=clamp(elapsed*slope,-.035,.035);
      const fluctuation=(random('form|'+id+'|'+exId+'|'+slot)-.5)*.025;
      const inactive=random('away|'+id+'|'+Math.floor(at/(14*DAY)))<.16;
      const member=athlete(id,area);
      return {...member,score:Math.max(0.1,record.seedScore*(baseline+drift+fluctuation)),inactive};
    }).filter(x=>!x.inactive).slice(0,OPPONENTS);
  }
  function stand(record,exId,performance,at,area='United Kingdom',me='You'){
    const rivals=opponentRows(record,exId,at,area);
    const player={id:'player',name:me,town:'You',score:performance,player:true};
    const rows=[...rivals,player].sort((a,b)=>b.score-a.score||(a.player?1:-1));
    return {rows,rank:rows.findIndex(x=>x.player)+1,leader:rows[0],gap:Math.max(0,rows[0].score-performance)};
  }
  function newEntry(exId,performance,rating,profileId,now,division=null,cycle=0){
    const div=division==null?initialDivision(rating):clamp(division,1,10);
    return {division:div,cycle,seedScore:Math.max(.5,performance),joinedAt:now,key:String(profileId)+'|'+exId+'|'+div+'|'+cycle,firstSince:null,lastCheckedAt:now,lastScore:performance,lastTrainingAt:null,promotions:0,peakDivision:div};
  }
  function update(entry,exId,performance,rating,profileId,at,area,lastWorkoutAt){
    if(!entry)entry=newEntry(exId,performance,rating,profileId,at);
    let changed=false,promoted=false,reentered=false;
    if(Number.isFinite(lastWorkoutAt)){
      if(entry.lastTrainingAt!=null&&lastWorkoutAt>entry.lastTrainingAt+30*DAY){
        // Long period of no workouts: previous slot was forfeited. Re-seed in a new pool.
        const fresh=newEntry(exId,performance,rating,profileId,at,clamp(Math.max(entry.division,initialDivision(rating)),1,10),entry.cycle+1);
        fresh.promotions=entry.promotions||0;fresh.peakDivision=entry.peakDivision||entry.division;
        entry=fresh;changed=true;reentered=true;
      }
      if(entry.lastTrainingAt!==lastWorkoutAt){entry.lastTrainingAt=lastWorkoutAt;changed=true;}
    }
    const daysInactive=Number.isFinite(lastWorkoutAt)?Math.max(0,(at-lastWorkoutAt)/DAY):Infinity;
    const status=daysInactive>=30?'inactive':daysInactive>=14?'decaying':'active';
    const decayedRating=Number.isFinite(Number(rating))&&rating!=null?Math.round(rating*Math.pow(.99,Math.max(0,daysInactive-14))*10)/10:null;
    const effectiveScore=performance; // Do not falsify or delete historical performance records.
    if(entry.lastScore!==performance){entry.lastScore=performance;entry.firstSince=null;entry.lastCheckedAt=at;changed=true;}
    if(status!=='active'){
      if(entry.firstSince!==null){entry.firstSince=null;changed=true;}
      if(entry.lastCheckedAt!==at){entry.lastCheckedAt=at;changed=true;}
      return {entry,status,decayedRating,standings:stand(entry,exId,effectiveScore,at,area),promoted,reentered,changed};
    }
    // Opponents update on fixed 6h boundaries. Inspect every elapsed boundary,
    // including while the app was closed, before awarding an uninterrupted 24h hold.
    let since=entry.firstSince;
    let cursor=Math.max(0,Math.min(at,entry.lastCheckedAt||at));
    const checkpoints=[];
    let step=Math.floor(cursor/STEP)*STEP+STEP;
    // Cap history checked to 36 days; long gaps already move the athlete to inactive.
    while(step<at&&checkpoints.length<150){checkpoints.push(step);step+=STEP;}
    checkpoints.push(at);
    for(const moment of checkpoints){
      const snapshot=stand(entry,exId,effectiveScore,moment,area);
      if(snapshot.rank===1){if(since==null)since=moment;}
      else since=null;
      if(since!=null&&moment-since>=HOLD&&entry.division>1){
        const next=newEntry(exId,performance,rating,profileId,moment,entry.division-1,entry.cycle+1);
        next.seedScore=Math.max(next.seedScore,entry.seedScore*1.055);
        next.lastTrainingAt=entry.lastTrainingAt;
        next.promotions=(entry.promotions||0)+1;
        next.peakDivision=Math.min(entry.peakDivision||entry.division,next.division);
        entry=next;since=null;promoted=true;changed=true;
        break;
      }
    }
    if(entry.firstSince!==since){entry.firstSince=since;changed=true;}
    if(entry.lastCheckedAt!==at){entry.lastCheckedAt=at;changed=true;}
    return {entry,status,decayedRating,standings:stand(entry,exId,effectiveScore,at,area),promoted,reentered,changed};
  }
  root.RepRivalLeagues={POPULATION,OPPONENTS,STEP,HOLD,LOCATIONS,hash,athlete,initialDivision,newEntry,opponentRows,stand,update};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.RepRivalLeagues;
})(typeof window!=='undefined'?window:globalThis);
