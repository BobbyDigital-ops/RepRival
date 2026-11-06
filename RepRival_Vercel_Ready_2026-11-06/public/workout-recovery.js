/* RepRival recovery: additive, authenticated workout-only import. */
(() => {
  'use strict';
  const readWorkouts = data => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.workouts)) return data.workouts;
    if (data?.version === 12 && data?.profiles) {
      const cloud = window.RepRivalCloud?.getCurrentUser();
      if (!cloud) throw Error('Sign in with Google before importing a profile backup.');
      const matched = Object.values(data.profiles).filter(p => p?.cloudUid === cloud.uid);
      if (matched.length !== 1) throw Error('The backup does not contain exactly one profile matching your signed-in Google account.');
      return matched[0]?.training?.history || [];
    }
    throw Error('Choose a RepRival extracted-workouts JSON or a complete profile backup.');
  };
  let panel, file, preview;
  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('section');
    panel.id = 'rr-workout-recovery';
    panel.style.cssText = 'position:fixed;z-index:2147483640;bottom:82px;right:12px;max-width:min(370px,calc(100vw - 24px));background:#162021;color:#fff;border:1px solid #759e8c;border-radius:12px;padding:15px;font:14px system-ui;box-shadow:0 12px 32px #0008';
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><strong>Restore missing workouts</strong><button type="button" data-close style="border:0;background:transparent;color:white;font-size:23px;cursor:pointer">×</button></div><p style="line-height:1.4">Select your RepRival workout JSON. Existing cloud workouts will be preserved; only missing workout IDs will be added.</p><input type="file" accept=".json,application/json" style="max-width:100%"><p data-status role="status" style="line-height:1.5"></p><button type="button" data-import disabled style="display:block;background:#8dbb9c;color:#101910;border:0;border-radius:8px;padding:11px;font-weight:700;width:100%">Review backup first</button>';
    document.body.append(panel);
    panel.querySelector('[data-close]').onclick = () => panel.remove(), panel=null;
    panel.querySelector('input').onchange = async e => {
      const f=e.target.files?.[0]; file=null;preview=null;
      const status=panel.querySelector('[data-status]');const button=panel.querySelector('[data-import]');
      button.disabled=true;button.textContent='Review backup first';
      if(!f)return;
      try {
        if(f.size>7e6)throw Error('Backup is too large; expected a RepRival JSON export.');
        const user=window.RepRivalCloud?.getCurrentUser();
        if(!user)throw Error('Sign in with Google before restoring workouts.');
        const data=JSON.parse(await f.text());const items=readWorkouts(data);
        if(!Array.isArray(items)||items.length<1||items.length>1000)throw Error('No valid workout history found.');
        const ids=new Set();
        for(const w of items) {
          if(!w||typeof w.id!=='string'||!w.id.trim()||w.id.includes('/')||!Array.isArray(w.logs)||!w.startedAt||!Number.isFinite(Date.parse(w.startedAt))||ids.has(w.id))throw Error('Backup contains invalid or duplicate workout IDs; nothing was uploaded.');
          ids.add(w.id);
        }
        const existing=await window.RepRivalCloud.loadWorkouts();
        const remote=new Set(existing.map(w=>String(w.id)));
        const missing=items.filter(w=>!remote.has(w.id));
        preview={all:items,missing,userId:user.uid};
        status.textContent=items.length+' workouts in backup; '+existing.length+' already in Firestore; '+missing.length+' missing. No records will be deleted or overwritten.';
        button.textContent=missing.length?'Import '+missing.length+' missing workouts':'No missing workouts';
        button.disabled=!missing.length;
      } catch(err) {status.textContent=err?.message||String(err);}
    };
    panel.querySelector('[data-import]').onclick = async()=>{
      const status=panel.querySelector('[data-status]'),button=panel.querySelector('[data-import]');
      if(!preview||!preview.missing.length)return;
      const user=window.RepRivalCloud?.getCurrentUser();
      if(!user||user.uid!==preview.userId){status.textContent='Your signed-in account changed. Choose the file again.';return;}
      if(!window.confirm('Add '+preview.missing.length+' missing workouts to your signed-in Google account? No existing cloud workouts will be changed.'))return;
      button.disabled=true;
      let imported=0;
      try{
        const latest=await window.RepRivalCloud.loadWorkouts();
        const IDs=new Set(latest.map(w=>String(w.id)));
        for(const w of preview.missing) {
          if(IDs.has(w.id))continue;
          const copy=JSON.parse(JSON.stringify(w));
          await window.RepRivalCloud.saveWorkout(copy);
          IDs.add(w.id);imported++;
          status.textContent='Imported '+imported+' of '+preview.missing.length+'…';
        }
        status.textContent='Success: '+imported+' missing workouts uploaded. Refresh to view updated history across devices.';
        button.textContent='Import complete';
      }catch(err) {
        status.textContent='Stopped after '+imported+' uploads: '+(err?.message||err)+'. Keep your backup; you can retry safely.';
        button.disabled=false;
      }
    };
  }
  function addLauncher(){
    if(document.querySelector('#rr-recovery-launch'))return;
    const b=document.createElement('button');b.type='button';b.id='rr-recovery-launch';b.textContent='Restore workouts';
    b.style.cssText='position:fixed;z-index:2147483639;bottom:14px;right:14px;padding:10px 13px;border-radius:25px;background:#233b33;color:#fff;border:1px solid #9bc8b0;box-shadow:0 4px 14px #0007;font:600 12px system-ui;cursor:pointer';
    b.onclick=ensurePanel; document.body.append(b);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addLauncher);else addLauncher();
})();