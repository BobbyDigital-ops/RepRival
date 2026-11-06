import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User 
} from 'firebase/auth';
import { 
  initializeFirestore,
  getFirestore,
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  getDocFromServer,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isPermissionError = errMsg.includes('Missing or insufficient permissions') ||
                            errMsg.includes('permission-denied') ||
                            errMsg.includes('PERMISSION_DENIED');

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (isPermissionError) {
    throw new Error(JSON.stringify(errInfo));
  }
}

// Validate connection to Firestore on boot as required by system skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client appears offline:", error.message);
    }
  }
}
testConnection();

export const ADMIN_EMAIL = 'zebob85@gmail.com';

export interface CloudAthleteProfile {
  uid: string;
  email: string;
  username: string;
  role: 'admin' | 'athlete';
  planId?: string;
  equipment?: string[];
  adaptiveConfig?: any;
  selectedMovements?: string[];
  body?: any;
  createdAt: string;
  updatedAt?: string;
}

export interface CloudWorkout {
  id: string;
  userId: string;
  session: string;
  sessionName?: string;
  planId?: string;
  startedAt: string;
  endedAt?: string;
  logs: any[];
  feeling?: string;
  recovery?: number;
  prs?: any[];
}

export class RepRivalCloudService {
  private user: User | null = null;
  private profile: CloudAthleteProfile | null = null;
  private authSubscribers: Array<(user: User | null, profile: CloudAthleteProfile | null) => void> = [];
  private workoutUnsubscribe: (() => void) | null = null;

  constructor() {
    onAuthStateChanged(auth, (u) => {
      this.user = u;
      if (u) {
        // A slow Firestore profile read must never hold the Auth transition
        // hostage. syncOrCreateProfile installs the safe local fallback before
        // its first await, so listeners can use the authenticated user now.
        void this.syncOrCreateProfile(u).catch(error => {
          console.warn('Cloud profile refresh unavailable; signed-in session retained.', error);
        });
      } else {
        this.profile = null;
        if (this.workoutUnsubscribe) {
          this.workoutUnsubscribe();
          this.workoutUnsubscribe = null;
        }
      }
      this.notifySubscribers();
    });
  }

  public onAuth(callback: (user: User | null, profile: CloudAthleteProfile | null) => void) {
    this.authSubscribers.push(callback);
    callback(this.user, this.profile);
    return () => {
      this.authSubscribers = this.authSubscribers.filter(cb => cb !== callback);
    };
  }

  private notifySubscribers() {
    for (const cb of this.authSubscribers) {
      try {
        cb(this.user, this.profile);
      } catch (e) {
        console.error('Auth subscriber error:', e);
      }
    }
  }

  public async signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    // Embedded mobile browsers sometimes return from Google's chooser while
    // leaving the popup promise pending. An actual Firebase-authenticated user
    // is equally authoritative, so also observe the real auth state.
    let stopListening: (() => void) | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const authenticated = new Promise<User>((resolve, reject) => {
      stopListening = onAuthStateChanged(auth, (u) => {
        if (u) resolve(u);
      }, reject);
    });
    const stalled = new Promise<never>((_, reject) => {
      watchdog = setTimeout(() => {
        const error = Object.assign(new Error('Google sign-in did not finish. Open RepRival directly in Chrome and try again.'), {code:'auth/popup-timeout'});
        reject(error);
      }, 20000);
    });
    try {
      const popup = signInWithPopup(auth, provider).then(result => result.user);
      // The race attaches rejection handlers to both promises: a later popup
      // completion cannot accidentally trigger an unhandled rejection.
      return await Promise.race([popup, authenticated, stalled]);
    } catch (e) {
      console.warn('Google sign-in did not complete:', e);
      throw e;
    } finally {
      if (stopListening) stopListening();
      if (watchdog) clearTimeout(watchdog);
    }
  }

  public async signUpWithEmail(email: string, pass: string, username?: string) {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (username && res.user) {
        await updateProfile(res.user, { displayName: username });
      }
      await this.syncOrCreateProfile(res.user, username);
      return res.user;
    } catch (e) {
      console.error('Sign-up error:', e);
      throw e;
    }
  }

  public async signInWithEmail(email: string, pass: string) {
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      await this.syncOrCreateProfile(res.user);
      return res.user;
    } catch (e) {
      console.error('Email sign-in error:', e);
      throw e;
    }
  }

  public async signOutUser() {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Sign-out error:', e);
      throw e;
    }
  }

  public getCurrentUser(): User | null {
    return this.user;
  }

  public getProfile(): CloudAthleteProfile | null {
    return this.profile;
  }

  // Adaptive preferences and paused-plan cursor belong to the signed-in athlete.
  // Stored on the existing user document so the deployed Firestore owner rules apply.
  public async loadAdaptiveConfig(): Promise<any | null> {
    if (!this.user) return null;
    const userRef=doc(db,'users',this.user.uid);
    const snap=await getDoc(userRef);
    return snap.exists() ? snap.data()?.adaptiveConfig || null : null;
  }

  public async saveAdaptiveConfig(config: any): Promise<void> {
    if (!this.user || !config || typeof config !== 'object') return;
    const userRef=doc(db,'users',this.user.uid);
    await setDoc(userRef,{adaptiveConfig:config}, {merge:true});
    if(this.profile)this.profile.adaptiveConfig=config;
  }

  public isUserAdmin(): boolean {
    if (!this.user || !this.user.email) return false;
    return this.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }

  // Sync profile document or create if first time
  private async syncOrCreateProfile(u: User, customName?: string) {
    const isOwnerAdmin = u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const displayName = customName || u.displayName || (isOwnerAdmin ? 'Head Coach (Admin)' : (u.email ? u.email.split('@')[0] : 'Athlete'));

    // Set fallback profile immediately so the athlete is never blocked
    this.profile = {
      uid: u.uid,
      email: u.email || '',
      username: displayName,
      role: isOwnerAdmin ? 'admin' : 'athlete',
      planId: 'pump',
      createdAt: new Date().toISOString()
    };

    const path = `users/${u.uid}`;
    try {
      const userRef = doc(db, 'users', u.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data() as CloudAthleteProfile;
        // Verify role enforcement: non-owner emails can NEVER have role 'admin'
        if (!isOwnerAdmin && data.role === 'admin') {
          data.role = 'athlete';
          await setDoc(userRef, { role: 'athlete' }, { merge: true });
        }
        if (customName && data.username !== customName) {
          data.username = customName;
          await setDoc(userRef, { username: customName }, { merge: true });
        }
        this.profile = data;
      } else {
        await setDoc(userRef, this.profile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  // Save/sync a workout to Firestore
  public async saveWorkout(workout: CloudWorkout) {
    if (!this.user) return;
    const path = `users/${this.user.uid}/workouts/${workout.id}`;
    try {
      const workoutRef = doc(db, 'users', this.user.uid, 'workouts', workout.id);
      await setDoc(workoutRef, {
        ...workout,
        userId: this.user.uid
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  // Load all cloud workouts for current user
  public async loadWorkouts(): Promise<CloudWorkout[]> {
    if (!this.user) return [];
    const path = `users/${this.user.uid}/workouts`;
    try {
      const colRef = collection(db, 'users', this.user.uid, 'workouts');
      const snap = await getDocs(colRef);
      const workouts: CloudWorkout[] = [];
      snap.forEach(d => {
        workouts.push(d.data() as CloudWorkout);
      });
      workouts.sort((a, b) => new Date(a.endedAt || a.startedAt).getTime() - new Date(b.endedAt || b.startedAt).getTime());
      return workouts;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }

  // Listen to cloud workouts in real time
  public subscribeToWorkouts(onUpdate: (workouts: CloudWorkout[]) => void) {
    if (!this.user) return () => {};
    const path = `users/${this.user.uid}/workouts`;
    const colRef = collection(db, 'users', this.user.uid, 'workouts');
    
    this.workoutUnsubscribe = onSnapshot(colRef, (snapshot) => {
      const workouts: CloudWorkout[] = [];
      snapshot.forEach(d => workouts.push(d.data() as CloudWorkout));
      workouts.sort((a, b) => new Date(a.endedAt || a.startedAt).getTime() - new Date(b.endedAt || b.startedAt).getTime());
      onUpdate(workouts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => {
      if (this.workoutUnsubscribe) {
        this.workoutUnsubscribe();
        this.workoutUnsubscribe = null;
      }
    };
  }

  // Push local history to cloud on first login
  public async syncLocalWorkoutsToCloud(localHistory: any[]) {
    if (!this.user || !localHistory || !localHistory.length) return;
    for (const w of localHistory) {
      if (!w || !w.id) continue;
      await this.saveWorkout({
        id: String(w.id),
        userId: this.user.uid,
        session: w.session || 'A',
        sessionName: w.sessionName,
        planId: w.planId || 'pump',
        startedAt: w.startedAt || new Date().toISOString(),
        endedAt: w.endedAt,
        logs: w.logs || [],
        feeling: w.feeling,
        recovery: w.recovery,
        prs: w.prs || []
      });
    }
  }
}

// Expose globally for app.js integration
const cloudService = new RepRivalCloudService();
(window as any).RepRivalCloud = cloudService;
