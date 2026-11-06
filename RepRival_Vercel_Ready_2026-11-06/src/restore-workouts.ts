import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, collection, doc, getDocs, runTransaction, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
const app = initializeApp(firebaseConfig, 'reprival-recovery');
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const el = (id: string) => document.getElementById(id) as HTMLElement;
const login = el('login') as HTMLButtonElement;
const review = el('review') as HTMLButtonElement;
const upload = el('import') as HTMLButtonElement;
const picker = el('backup') as HTMLInputElement;
const status = el('status');
let proposed: any[] = [];
let ownerUid: string | null = null;
function message(s: string) { status.textContent = s; }
onAuthStateChanged(auth, user => {
  el('account').textContent = user ? 'Signed in as ' + (user.email || user.uid) : 'Not signed in. Please use the same Google account as RepRival.';
  login.textContent = user ? 'Switch Google account' : 'Sign in with Google';
  proposed=[]; ownerUid=null; upload.disabled=true;
});
login.onclick=async()=>{
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch(e:any){ message('Google sign-in error: '+(e?.message||String(e))); }
};
function getWorkouts(data:any,userUid:string):any[] {
  if(Array.isArray(data)) return data;
  if(Array.isArray(data?.workouts))return data.workouts;
  if(data?.version===12 && data?.profiles) {
    const ps=Object.values(data.profiles as Record<string,any>).filter((p:any)=>p?.cloudUid===userUid) as any[];
    if(ps.length!==1)throw Error('Your backup does not have exactly one profile for this Google account.');
    return ps[0].training?.history||[];
  }
  throw Error('File is not a supported RepRival workout JSON backup.');
}
review.onclick=async()=>{
  proposed=[];ownerUid=null;upload.disabled=true;
  const file=picker.files?.[0];const user=auth.currentUser;
  if(!user){message('Sign in with Google first.');return;}
  if(!file){message('Choose the JSON backup file first.');return;}
  review.disabled=true;message('Reading backup and checking Firebase…');
  try {
    if(file.size>7e6)throw Error('Backup is larger than expected.');
    const items=getWorkouts(JSON.parse(await file.text()),user.uid);
    if(!Array.isArray(items)||items.length===0||items.length>1000)throw Error('No valid workouts found.');
    const ids=new Set<string>();
    for(const w of items){
      const id=String(w?.id??'');
      if(!id||id.includes('/')||!Array.isArray(w.logs)||!w.startedAt||!Number.isFinite(Date.parse(w.startedAt))||ids.has(id))throw Error('Backup has an invalid or duplicate workout ID.');
      ids.add(id);
    }
    const snap=await getDocs(collection(db,'users',user.uid,'workouts'));
    const existing=new Set(snap.docs.map(d=>d.id));
    proposed=items.filter(w=>!existing.has(String(w.id)));
    ownerUid=user.uid;
    message(items.length+' workouts in backup.\n'+existing.size+' workouts in Firebase.\n'+proposed.length+' missing workouts ready to add.\nNo existing records will be replaced.');
    upload.textContent='Import '+proposed.length+' missing workouts';
    upload.disabled=proposed.length===0;
  }catch(e:any){message('Review error: '+(e?.message||String(e)));}
  finally{review.disabled=false;}
};
upload.onclick=async()=>{
  const user=auth.currentUser;
  if(!user||user.uid!==ownerUid||!proposed.length){message('Review your backup after signing in.');return;}
  if(!window.confirm('Add '+proposed.length+' missing workouts to Firebase? Existing workout documents will not be changed.'))return;
  upload.disabled=true;review.disabled=true;
  let inserted=0;
  try{
    for(const w of proposed){
      const target=doc(db,'users',user.uid,'workouts',String(w.id));
      const added=await runTransaction(db, async transaction=>{
        const found=await transaction.get(target);
        if(found.exists())return false;
        transaction.set(target,{...w,id:String(w.id),userId:user.uid});
        return true;
      });
      if(added)inserted++;
      message('Restoring '+inserted+' of '+proposed.length+'…');
    }
    const checks=await Promise.all(proposed.map(w=>getDocFromServer(doc(db,'users',user.uid,'workouts',String(w.id)))));
    const missing=checks.filter(s=>!s.exists()).length;
    if(missing)throw Error(missing+' workout documents were not confirmed in Firestore.');
    message('SUCCESS: '+inserted+' workouts added and verified in Firebase.\nOpen RepRival and refresh to see your combined history.');
    proposed=[];ownerUid=null;upload.textContent='Import complete';
  }catch(e:any){message('Import stopped after '+inserted+' additions. '+(e?.message||String(e))+'\nKeep the backup. Review and retry safely.');proposed=[];ownerUid=null;}
  finally{review.disabled=false;}
};