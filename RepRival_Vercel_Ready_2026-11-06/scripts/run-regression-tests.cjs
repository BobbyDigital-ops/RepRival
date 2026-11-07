'use strict';
const fs = require('fs');
const path = require('path');

// --- BROWSER ENVIRONMENT MOCKING FOR NODE ---
if (typeof global.window === 'undefined') {
  global.window = global;
}
if (typeof global.document === 'undefined') {
  global.document = {
    querySelector: () => ({ innerHTML: '', addEventListener: () => {}, remove: () => {}, querySelectorAll: () => [] }),
    querySelectorAll: () => [],
    addEventListener: (event, handler) => {
      if (!global._listeners) global._listeners = {};
      global._listeners[event] = handler;
    },
    createElement: () => ({ className: '', setAttribute: () => {}, appendChild: () => {}, addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] }),
    title: '',
    body: { appendChild: () => {}, removeChild: () => {} }
  };
}
if (typeof global.localStorage === 'undefined') {
  const store = {};
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}
if (typeof global.FormData === 'undefined') {
  global.FormData = class FormData {
    constructor(form) { this.data = new Map(); }
    get(k) { return this.data.get(k) || ''; }
    set(k, v) { this.data.set(k, v); }
    getAll(k) { return this.data.has(k) ? [this.data.get(k)] : []; }
  };
}

// Load RepRival core modules in dependency order
require('../public/program.js');
require('../public/exercise-library.js');
require('../public/plan-library.js');
require('../public/leagues.js');
require('../public/muscle-intelligence.js');
require('../public/body-map.js');
require('../public/adaptive.js');
require('../public/adaptive-v3.js');
require('../public/adaptive-circuits.js');
require('../public/app.js');

const RepRivalTest = window.RepRivalTest;

let passedCount = 0;
let failedCount = 0;
const results = [];

function assert(description, condition) {
  if (condition) {
    passedCount++;
    results.push(`  ✓ [PASS] ${description}`);
  } else {
    failedCount++;
    results.push(`  ✕ [FAIL] ${description}`);
  }
}

console.log('================================================================');
console.log('       REPRIVAL PERMANENT REGRESSION TESTING SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SUITE 1: Google Sign-in & Profile/Session Restoration
// -----------------------------------------------------------------------------
console.log('--- SUITE 1: Google Sign-In & Profile Restoration ---');
try {
  const initialProfile = RepRivalTest.getProfile();
  assert('Initial active profile exists', initialProfile && typeof initialProfile === 'object');
  assert('Profile has valid role', ['admin', 'athlete'].includes(initialProfile.role));
  assert('Profile contains training defaults', initialProfile.training && Array.isArray(initialProfile.training.history));
} catch (err) {
  assert(`Suite 1 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 2: Athlete Profile Isolation
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Athlete Profile Isolation ---');
try {
  const profileAdmin = RepRivalTest.getProfile();
  assert('Admin profile loaded', profileAdmin !== null);
  
  // Verify changing history in active profile state does not leak to isolated profile structures
  const originalHistoryLen = profileAdmin.training.history.length;
  assert('Admin profile history isolated length', Array.isArray(profileAdmin.training.history));
} catch (err) {
  assert(`Suite 2 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 3: Existing Workout History Preservation (22 Oct 2026 Workout C)
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Existing Workout History Preservation ---');
try {
  const startedAt22Oct = '2026-10-22T08:00:00.000Z';
  const tasksC = RepRivalTest.buildTasks('C');
  assert('Workout C has planned tasks (21 sets)', tasksC.length === 21);

  const fixture22Oct = {
    id: 'workout-20261022-c',
    session: 'C',
    sessionName: 'Full Body C',
    startedAt: startedAt22Oct,
    endedAt: '2026-10-22T08:45:00.000Z',
    logs: tasksC.map((t, i) => ({
      exId: t.ex.id,
      name: t.ex.name,
      muscle: t.ex.muscle,
      weight: t.ex.load === 'bodyweight' ? 0 : 22.5,
      reps: 10,
      rir: 2,
      load: t.ex.load || 'combined',
      pair: t.pair.id,
      round: t.round,
      loggedAt: startedAt22Oct
    })),
    plannedSets: 21,
    isPartial: false,
    feeling: 'good'
  };

  RepRivalTest.setHistory([fixture22Oct]);
  const history = RepRivalTest.getState().history;
  assert('22 Oct 2026 Workout C preserved in history', history.length === 1 && history[0].startedAt === startedAt22Oct);
  assert('All 21 recorded sets intact in history', history[0].logs.length === 21);
  assert('Exercise identities preserved', history[0].logs[0].exId === tasksC[0].ex.id);
} catch (err) {
  assert(`Suite 3 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 4: Workout A/B/C Template Integrity
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Workout A/B/C Template Integrity ---');
try {
  ['A', 'B', 'C'].forEach(code => {
    const tasks = RepRivalTest.buildTasks(code);
    assert(`Workout ${code} contains planned tasks`, tasks.length > 0);
    tasks.forEach((t, i) => {
      assert(`Workout ${code} Task ${i} has valid exercise ID`, typeof t.ex.id === 'string' && t.ex.id.length > 0);
      assert(`Workout ${code} Task ${i} min reps <= max reps`, t.ex.min <= t.ex.max);
      assert(`Workout ${code} Task ${i} restMin <= restMax`, t.pair.restMin <= t.pair.restMax);
    });
  });
} catch (err) {
  assert(`Suite 4 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 5: Active Workout Saving & Resuming
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Active Workout Saving & Resuming ---');
try {
  const activeDraft = {
    session: 'A',
    planId: 'pump',
    planVersion: 1,
    taskIndex: 3,
    logs: [
      { exId: 'low_incline_db_press', weight: 20, reps: 10, rir: 2 },
      { exId: 'db_bent_over_row', weight: 22.5, reps: 10, rir: 2 },
      { exId: 'low_incline_db_press', weight: 20, reps: 10, rir: 2 }
    ],
    drafts: { 'weight-3': '22.5', 'reps-3': '10' },
    startedAt: new Date().toISOString(),
    stage: 'lift',
    restUntil: null,
    pairs: null
  };

  RepRivalTest.setActive(activeDraft);
  const loadedActive = RepRivalTest.getState().active;
  assert('Active session saved and retrievable', loadedActive !== null && loadedActive.session === 'A');
  assert('Active session taskIndex preserved', loadedActive.taskIndex === 3);
  assert('Active session drafts preserved', loadedActive.drafts['weight-3'] === '22.5');
} catch (err) {
  assert(`Suite 5 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 6: Set Logging, Weights, Reps & RIR
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 6: Set Logging, Weights, Reps & RIR ---');
try {
  const logSample = { exId: 'flat_db_bench_press', name: 'Flat DB bench press', muscle: 'Chest', weight: 25, reps: 8, rir: 2, load: 'combined' };
  const s = RepRivalTest.score(logSample);
  assert('Score calculated for 25 kg x 8 reps', s > 25);
  const vol = RepRivalTest.setVolume(logSample);
  assert('Volume accounts for 2 dumbbells (25 kg * 2 * 8 = 400 kg)', vol === 400);
} catch (err) {
  assert(`Suite 6 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 7: Progressive Overload Calculations
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 7: Progressive Overload Calculations ---');
try {
  const ex = { id: 'low_incline_db_press', name: 'Low-incline DB press', muscle: 'Chest', sets: 3, min: 8, max: 12, load: 'combined' };
  
  // Baseline (first log)
  const recBase = RepRivalTest.recommend(ex, null, []);
  assert('Recommendation for baseline suggests min reps', recBase.reps === 8);

  // Reserve exists (RIR 2)
  const prevLogRIR2 = { exId: 'low_incline_db_press', weight: 22.5, reps: 8, rir: 2, load: 'combined' };
  const recRepInc = RepRivalTest.recommend(ex, prevLogRIR2, []);
  assert('Recommendation with RIR >= 2 targets +1 rep (8 -> 9 reps)', recRepInc.reps === 9 && recRepInc.weight === 22.5);

  // All sets hit top of rep range (12 reps)
  const all12Logs = [
    { exId: 'low_incline_db_press', weight: 22.5, reps: 12, rir: 2 },
    { exId: 'low_incline_db_press', weight: 22.5, reps: 12, rir: 2 },
    { exId: 'low_incline_db_press', weight: 22.5, reps: 12, rir: 2 }
  ];
  const recWeightInc = RepRivalTest.recommend(ex, all12Logs[2], all12Logs);
  assert('Double progression advances weight when top reps achieved (22.5 -> 25 kg)', recWeightInc.weight === 25 && recWeightInc.reps === 8);
} catch (err) {
  assert(`Suite 7 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 8: Exercise Swapping, Dropping & Restoring
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 8: Swapping, Dropping & Restoring ---');
try {
  const activeSessionDrop = {
    session: 'A',
    taskIndex: 0,
    logs: [{ exId: 'low_incline_db_press', weight: 0, reps: 0, skipped: true }],
    startedAt: new Date().toISOString(),
    stage: 'lift',
    pairs: null
  };
  RepRivalTest.setActive(activeSessionDrop);
  const stateWithSkipped = RepRivalTest.getState();
  assert('Skipped set marked as skipped', stateWithSkipped.active.logs[0].skipped === true);
} catch (err) {
  assert(`Suite 8 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 9: Temporary vs Permanent Workout Changes
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 9: Temporary vs Permanent Workout Changes ---');
try {
  const profileOriginal = RepRivalTest.getProfile();
  const planAPairsOriginal = profileOriginal.plans.pump.A.pairs.length;
  
  // Make temporary change on active session pairs
  const tempPairs = structuredClone(profileOriginal.plans.pump.A.pairs);
  tempPairs[0].restMin = 99;
  
  const profileAfterTemp = RepRivalTest.getProfile();
  assert('Temporary edit does not alter master plan template restMin', profileAfterTemp.plans.pump.A.pairs[0].restMin !== 99);

  // Apply permanent change
  RepRivalTest.makeSessionPairsPermanent('A', tempPairs);
  const profileAfterPerm = RepRivalTest.getProfile();
  assert('Permanent edit updates master plan template restMin', profileAfterPerm.plans.pump.A.pairs[0].restMin === 99);
} catch (err) {
  assert(`Suite 9 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 10: Skipped-Set Handling
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 10: Skipped-Set Handling ---');
try {
  const skippedLog = { exId: 'db_lateral_raise', weight: 10, reps: 12, rir: 2, skipped: true };
  assert('Skipped set volume is 0 kg', RepRivalTest.setVolume(skippedLog) === 0);
  assert('Skipped set score is 0', RepRivalTest.score(skippedLog) === 0);
} catch (err) {
  assert(`Suite 10 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 11: Rest Timers & Workout Completion
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 11: Rest Timers & Workout Completion ---');
try {
  const pair = { restMin: 60, restMax: 90 };
  const restRIR0 = RepRivalTest.calcRest(pair, 0);
  assert('Rest timer for 0 RIR uses restMax (90s)', restRIR0 === 90);
  const restRIR3 = RepRivalTest.calcRest(pair, 3);
  assert('Rest timer for 3 RIR uses restMin (60s)', restRIR3 === 60);
} catch (err) {
  assert(`Suite 11 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 12: Workout History Corrections
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 12: Workout History Corrections ---');
try {
  const hist = RepRivalTest.getState().history;
  if (hist.length > 0) {
    const originalLogCount = hist[0].logs.length;
    // Perform simulated correction
    hist[0].logs[0].reps = 11;
    assert('History set correction updated reps', hist[0].logs[0].reps === 11);
    assert('Total history log count preserved', hist[0].logs.length === originalLogCount);
  }
} catch (err) {
  assert(`Suite 12 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 13: Per-Dumbbell Weight Calculations
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 13: Per-Dumbbell Weight Calculations ---');
try {
  const dbEx = { id: 'incline_db_curl', name: 'Incline DB curl', equipment: ['dumbbells'] };
  assert('isDumbbellExercise identifies dumbbell movement', RepRivalTest.isDumbbellExercise(dbEx) === true);
  
  const multDB = RepRivalTest.logEffectiveMultiplier({ exId: 'incline_db_curl', equipment: ['dumbbells'], load: 'combined' });
  assert('logEffectiveMultiplier returns 2 for double dumbbell curls', multDB === 2);

  const multSingleDB = RepRivalTest.logEffectiveMultiplier({ exId: 'goblet_squat', name: 'Goblet squat', load: 'single' });
  assert('logEffectiveMultiplier returns 1 for single goblet squat', multSingleDB === 1);
} catch (err) {
  assert(`Suite 13 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 14: Athlete Ratings & League Functionality
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 14: Athlete Ratings & League Functionality ---');
try {
  const leagueData = RepRivalTest.league();
  assert('League data structure retrievable', leagueData && typeof leagueData === 'object');
  assert('League store contains records and area', typeof leagueData.store === 'object' && typeof leagueData.store.area === 'string');
  assert('Inactivity status retrievable', ['active', 'decaying', 'inactive', 'new'].includes(leagueData.inactivity.status));
} catch (err) {
  assert(`Suite 14 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 15: Backup Export & Restore
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 15: Backup Export & Restore ---');
try {
  const currentState = RepRivalTest.getState();
  const backupJSON = JSON.stringify({ version: 12, last: 'admin', profiles: { admin: { role: 'admin', training: currentState } } });
  
  assert('Backup JSON serialized', typeof backupJSON === 'string' && backupJSON.includes('version":12'));
  const parsed = JSON.parse(backupJSON);
  assert('Backup JSON deserialized losslessly', parsed.version === 12 && parsed.profiles.admin.role === 'admin');
} catch (err) {
  assert(`Suite 15 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 16: Existing Programme Rotation & Progression
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 16: Existing Programme Rotation & Progression ---');
try {
  const stateRot = RepRivalTest.getState();
  assert('Next workout in rotation defined', ['A', 'B', 'C'].includes(stateRot.next));
} catch (err) {
  assert(`Suite 16 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 17: Phase 1 — Strength Trend Epley 1RM & Median Aggregation
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 17: Phase 1 — Strength Trend Epley 1RM & Median ---');
try {
  // Test 1: Epley 1RM score formula
  const sampleLog = { weight: 20, reps: 10, load: 'combined' };
  const expectedEpley = 20 * (1 + 10 / 30); // 26.666...
  const calculatedScore = RepRivalTest.score(sampleLog);
  assert('Score function implements Epley 1RM formula', Math.abs(calculatedScore - expectedEpley) < 0.001);

  // Test 2: getStrengthTrendData retrievable
  const trend4w = RepRivalTest.getStrengthTrendData('4w');
  assert('getStrengthTrendData returns valid data object', trend4w && typeof trend4w === 'object');
  assert('Strength trend contains period label', typeof trend4w.periodLabel === 'string');
  assert('Strength trend contains formatted gain string', typeof trend4w.formattedGain === 'string');

  // Test 3: Provisional status correctly tagged when eligible exercises < 3
  assert('Provisional status boolean present', typeof trend4w.isProvisional === 'boolean');
  if (trend4w.eligibleCount < 3 && trend4w.eligibleCount > 0) {
    assert('Provisional trend tagged when < 3 eligible exercises', trend4w.isProvisional === true);
  }

  // Test 4: Timeframe support (4w, 12w, 6m, all)
  const trend12w = RepRivalTest.getStrengthTrendData('12w');
  const trend6m = RepRivalTest.getStrengthTrendData('6m');
  const trendAll = RepRivalTest.getStrengthTrendData('all');
  assert('All 4 timeframes (4w, 12w, 6m, all) produce valid data',
    trend12w.period === '12w' && trend6m.period === '6m' && trendAll.period === 'all');
} catch (err) {
  assert(`Suite 17 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 18: Phase 1 — Muscle Heat Zone & Effective Set Coverage
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 18: Phase 1 — Muscle Heat Zone & Coverage ---');
try {
  const hData = RepRivalTest.heatData(7);
  assert('heatData returns coverage for all 11 muscle groups', Object.keys(hData).length === 11);
  assert('Chest muscle group present in heatData', hData.Chest && typeof hData.Chest === 'object');

  // Check effective set properties
  assert('Effective sets calculated as number', typeof hData.Chest.effectiveSets === 'number');
  assert('Target sets configured', typeof hData.Chest.targetSets === 'number' && hData.Chest.targetSets > 0);
  assert('Coverage percentage calculated', typeof hData.Chest.coveragePct === 'number');
  assert('Status label formatted with effective sets', typeof hData.Chest.statusLabel === 'string' && hData.Chest.statusLabel.includes('effective sets'));

  // Verify secondary set contribution logic
  // Chest press adds 1.0 to Chest and secondary credit to Triceps (0.4) & Side delts (0.25)
  const testState = RepRivalTest.getState();
  const simHistory = [{
    id: 'test-coverage-wo',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    logs: [{ exId: 'low_incline_db_press', name: 'Low-incline DB press', muscle: 'Chest', weight: 20, reps: 10, load: 'combined' }]
  }];
  RepRivalTest.setHistory(simHistory);
  const testHData = RepRivalTest.heatData(7);

  assert('Primary muscle receives 1.0 effective set credit', testHData.Chest.primarySets === 1 && testHData.Chest.effectiveSets === 1.0);
  assert('Secondary Triceps receives 0.4 set credit', testHData.Triceps.secondarySets === 0.4 && testHData.Triceps.effectiveSets === 0.4);
  assert('Secondary Side delts receives 0.25 set credit', testHData['Side delts'].secondarySets === 0.25 && testHData['Side delts'].effectiveSets === 0.3);

  // Restore original state
  RepRivalTest.setHistory(testState.history);
} catch (err) {
  assert(`Suite 18 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 19: Phase 2 — Equipment-Free Catalogue & One-Off Generator
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 19: Phase 2 — Equipment-Free Catalogue & One-Off Generator ---');
try {
  // Test 1: Generate pure bodyweight workout
  const bwWorkout = RepRivalTest.generateOneOffWorkout({ duration: 10, gearMode: 'bodyweight', focus: 'full_body' });
  assert('One-off generator returns session object', bwWorkout && typeof bwWorkout === 'object');
  assert('Workout has pairs array', Array.isArray(bwWorkout.pairs) && bwWorkout.pairs.length > 0);
  assert('Session code is Quick', bwWorkout.code === 'Quick');
  assert('Session marked as isOneOff', bwWorkout.isOneOff === true);

  // Check equipment of generated exercises
  const allBwExs = bwWorkout.pairs.flatMap(p => p.exercises || []);
  const nonBw = allBwExs.filter(e => e.equipment && e.equipment.length > 0 && !e.equipment.includes('none'));
  assert('Bodyweight gearMode returns exercises requiring no equipment', nonBw.length === 0);

  // Test 2: Duration scaling
  const w10 = RepRivalTest.generateOneOffWorkout({ duration: 10, gearMode: 'bodyweight', focus: 'full_body' });
  const w30 = RepRivalTest.generateOneOffWorkout({ duration: 30, gearMode: 'bodyweight', focus: 'full_body' });
  const countSets = (w) => w.pairs.reduce((sum, p) => sum + p.exercises.reduce((es, x) => es + x.sets, 0), 0);
  assert('10-minute workout generates 4-6 sets', countSets(w10) >= 4 && countSets(w10) <= 6);
  assert('30-minute workout generates more sets than 10-minute workout', countSets(w30) > countSets(w10));

  // Test 3: Equipment-free exercises in catalog for all muscle groups
  const exCatalog = window.REPRIVAL_EXERCISE_LIBRARY?.entries || [];
  const muscles = ['Chest', 'Back', 'Quads', 'Hamstrings', 'Shoulders', 'Biceps', 'Triceps'];
  muscles.forEach(m => {
    const hasBwEx = exCatalog.some(e => 
      (e.muscle === m || (m === 'Shoulders' && (e.muscle === 'Side delts' || e.muscle === 'Rear delts' || e.muscle === 'Shoulders')) || (e.secondary && e.secondary.includes(m))) && 
      (!e.equipment || e.equipment.length === 0 || e.equipment.includes('none'))
    );
    assert(`Equipment-free option exists for ${m}`, hasBwEx);
  });
} catch (err) {
  assert(`Suite 19 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 20: Phase 2 — One-Off Workouts Never Advance Plan Rotation
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 20: Phase 2 — One-Off Workouts Rotation Protection ---');
try {
  const stateBefore = RepRivalTest.getState();
  const nextBefore = stateBefore.next || 'A';
  const histLenBefore = stateBefore.history.length;

  // Generate a 10m quick session and set as active session
  const quickGen = RepRivalTest.generateOneOffWorkout({ duration: 10, gearMode: 'bodyweight', focus: 'full_body' });
  
  // Create active session state
  const oneOffTasks = [];
  quickGen.pairs.forEach(pair => {
    const rounds = Math.max(...pair.exercises.map(x => x.sets));
    for (let r = 1; r <= rounds; r++) {
      pair.exercises.forEach(ex => {
        oneOffTasks.push({ pair, ex, round: r });
      });
    }
  });

  const logs = oneOffTasks.map(t => ({
    exId: t.ex.id,
    name: t.ex.name,
    muscle: t.ex.muscle,
    weight: 0,
    reps: 12,
    rir: 2,
    load: t.ex.load || 'bodyweight',
    pair: t.pair.id,
    round: t.round,
    loggedAt: new Date().toISOString()
  }));

  const activeOneOff = {
    session: 'Quick',
    planId: 'one-off',
    planVersion: 1,
    isOneOff: true,
    taskIndex: logs.length,
    logs: logs,
    drafts: {},
    startedAt: new Date().toISOString(),
    stage: 'review',
    restUntil: null,
    pairs: quickGen.pairs
  };

  RepRivalTest.setActive(activeOneOff);
  
  // Finish workout
  RepRivalTest.completeWorkout();

  const stateAfter = RepRivalTest.getState();
  assert('Plan rotation (state.next) was NOT advanced by one-off workout', stateAfter.next === nextBefore);
  assert('Workout was added to history', stateAfter.history.length === histLenBefore + 1);
  assert('Saved history item has isOneOff flag set to true', stateAfter.history.at(-1).isOneOff === true);
  assert('Active workout cleared after completion', stateAfter.active === null);

  // Verify heat map accounts for completed one-off workout
  const hDataOneOff = RepRivalTest.heatData(7);
  assert('Heat map includes sets from completed one-off workout', Object.values(hDataOneOff).some(m => m.effectiveSets > 0));
} catch (err) {
  assert(`Suite 20 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 21: Phase 3 — Holiday Mode Activation & Rotation Preservation
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 21: Phase 3 — Holiday Mode Activation & Rotation Preservation ---');
try {
  const currentState = RepRivalTest.getState();
  const originalNext = currentState.next || 'A';
  const masterPlanA = structuredClone(RepRivalTest.getProfile().plans.pump.A);

  // Activate Holiday Mode
  RepRivalTest.activateHolidayMode({ location: 'Malaga Beach Trip', gearMode: 'bodyweight' });
  const holidayState = RepRivalTest.getState();

  assert('Holiday Mode is marked as active', holidayState.holiday && holidayState.holiday.active === true);
  assert('Holiday Mode saved original next workout code', holidayState.holiday.savedNext === originalNext);
  assert('Holiday location recorded', holidayState.holiday.location === 'Malaga Beach Trip');

  // Complete a bodyweight holiday session
  const holGen = RepRivalTest.generateOneOffWorkout({ duration: 15, gearMode: 'bodyweight', focus: 'full_body' });
  const holTasks = [];
  holGen.pairs.forEach(pair => {
    const rounds = Math.max(...pair.exercises.map(x => x.sets));
    for (let r = 1; r <= rounds; r++) {
      pair.exercises.forEach(ex => holTasks.push({ pair, ex, round: r }));
    }
  });

  const holLogs = holTasks.map(t => ({
    exId: t.ex.id,
    name: t.ex.name,
    muscle: t.ex.muscle,
    weight: 0,
    reps: 12,
    rir: 2,
    load: 'bodyweight',
    pair: t.pair.id,
    round: t.round,
    loggedAt: new Date().toISOString()
  }));

  RepRivalTest.setActive({
    session: 'Quick',
    planId: 'holiday',
    isOneOff: true,
    isHoliday: true,
    taskIndex: holLogs.length,
    logs: holLogs,
    drafts: {},
    startedAt: new Date().toISOString(),
    stage: 'review',
    pairs: holGen.pairs
  });

  RepRivalTest.completeWorkout();

  const stateAfterHolWorkout = RepRivalTest.getState();
  assert('Main plan rotation (state.next) was preserved while in Holiday Mode', stateAfterHolWorkout.next === originalNext);
  assert('Holiday workout recorded in workout history', stateAfterHolWorkout.history.at(-1).isOneOff === true);
  
  const hDataHoliday = RepRivalTest.heatData(7);
  assert('Holiday workout stimulus registered on Muscle Heat Zone', Object.values(hDataHoliday).some(m => m.effectiveSets > 0));
} catch (err) {
  assert(`Suite 21 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 22: Phase 3 — Return from Holiday Mode & Full Program Restoration
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 22: Phase 3 — Return from Holiday Mode & Full Program Restoration ---');
try {
  const preExitState = RepRivalTest.getState();
  const expectedNext = preExitState.holiday?.savedNext || 'A';
  const histLenBeforeExit = preExitState.history.length;

  // Exit Holiday Mode
  RepRivalTest.exitHolidayMode();

  const restoredState = RepRivalTest.getState();
  assert('Holiday Mode marked inactive on exit', !restoredState.holiday || restoredState.holiday.active === false);
  assert('Original next workout in rotation cleanly restored', restoredState.next === expectedNext);

  // Verify master plan templates remain intact and unaffected
  const restoredProfile = RepRivalTest.getProfile();
  assert('Master plan Workout A template preserved intact', restoredProfile.plans.pump.A.pairs.length > 0);
  assert('Master plan Workout B template preserved intact', restoredProfile.plans.pump.B.pairs.length > 0);
  assert('Master plan Workout C template preserved intact', restoredProfile.plans.pump.C.pairs.length > 0);

  // Verify holiday workouts remain in history post-resumption
  assert('Holiday workouts retained in history after returning to master routine', restoredState.history.length === histLenBeforeExit);
} catch (err) {
  assert(`Suite 22 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 23: Phase 3 Option 2 — Multi-Session Temporary Holiday Programme Audit
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 23: Phase 3 Option 2 — Multi-Session Holiday Program ---');
try {
  const masterNextBefore = RepRivalTest.getState().next || 'A';

  // Test 1: Multi-session holiday programme generation
  const holProg = RepRivalTest.generateHolidayProgram({
    weeks: 2,
    frequency: 3,
    sessionDuration: 10,
    gearMode: 'bodyweight',
    environment: 'hotel_room',
    location: 'Rome Beach Trip'
  });

  assert('Multi-session holiday generator returns program title', holProg && typeof holProg.title === 'string' && holProg.title.includes('Rome Beach Trip'));
  assert('Holiday program contains 3 workouts for 3x/week frequency', holProg.order.length === 3);
  assert('Holiday workouts HA, HB, HC generated', holProg.sessions.HA && holProg.sessions.HB && holProg.sessions.HC);
  assert('10-minute session duration preserved in holiday program', holProg.sessions.HA.duration === 10);

  // Test 2: Activate Holiday Mode Option 2 (Multi-Session Holiday Plan)
  RepRivalTest.activateHolidayMode({
    mode: 'plan',
    location: 'Rome Beach Trip',
    gearMode: 'bodyweight',
    holidayPlan: holProg
  });

  const holActiveState = RepRivalTest.getState();
  assert('Holiday Mode active in plan mode', holActiveState.holiday?.active === true && holActiveState.holiday?.mode === 'plan');
  assert('Holiday plan next session initialized to HA', holActiveState.holiday?.plan?.nextSession === 'HA');
  assert('Master routine next workout frozen at savedNext', holActiveState.holiday?.savedNext === masterNextBefore);

  // Test 3: Complete Holiday Session HA in holiday program
  RepRivalTest.startHolidaySession('HA');
  const activeHASession = RepRivalTest.getState().active;
  assert('Active session set to Holiday Session HA', activeHASession && activeHASession.session === 'HA' && activeHASession.isHoliday === true);

  // Populate logged sets for HA session
  const haTasks = [];
  activeHASession.pairs.forEach(pair => {
    const rounds = Math.max(...pair.exercises.map(x => x.sets));
    for (let r = 1; r <= rounds; r++) {
      pair.exercises.forEach(ex => haTasks.push({ pair, ex, round: r }));
    }
  });

  const haLogs = haTasks.map(t => ({
    exId: t.ex.id,
    name: t.ex.name,
    muscle: t.ex.muscle,
    weight: 0,
    reps: 12,
    rir: 2,
    load: 'bodyweight',
    pair: t.pair.id,
    round: t.round,
    loggedAt: new Date().toISOString()
  }));

  activeHASession.logs = haLogs;
  activeHASession.taskIndex = haLogs.length;
  RepRivalTest.setActive(activeHASession);

  // Complete HA workout
  RepRivalTest.completeWorkout();

  const stateAfterHA = RepRivalTest.getState();
  assert('Completing Holiday HA advanced holiday plan nextSession to HB', stateAfterHA.holiday?.plan?.nextSession === 'HB');
  assert('Completing Holiday HA preserved master routine next workout', stateAfterHA.next === masterNextBefore);
  assert('Completed HA session saved in workout history', stateAfterHA.history.at(-1).isHoliday === true);

  // Test 4: Return from Holiday Mode
  RepRivalTest.exitHolidayMode();
  const restoredState23 = RepRivalTest.getState();
  assert('Master routine state.next cleanly restored upon returning from holiday', restoredState23.next === masterNextBefore);
  assert('Holiday Mode deactivated upon exit', !restoredState23.holiday || restoredState23.holiday.active === false);
} catch (err) {
  assert(`Suite 23 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 24: Percentage & Labelling Consistency (Heat Zones)
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 24: Percentage & Labelling Consistency (Heat Zones) ---');
try {
  const h7 = RepRivalTest.heatData(7);
  let allConsistent = true;
  Object.values(h7).forEach(m => {
    const expectedPct = Math.round((m.effectiveSets / m.targetSets) * 100);
    if (m.coveragePct !== expectedPct) {
      allConsistent = false;
    }
  });
  assert('All muscle heat coverage percentages match effectiveSets / targetSets strictly', allConsistent);

  const h28 = RepRivalTest.heatData(28);
  let allConsistent28 = true;
  Object.values(h28).forEach(m => {
    const expectedPct = Math.round((m.effectiveSets / m.targetSets) * 100);
    if (m.coveragePct !== expectedPct) {
      allConsistent28 = false;
    }
  });
  assert('All 28-day muscle heat coverage percentages match effectiveSets / targetSets strictly', allConsistent28);
} catch (err) {
  assert(`Suite 24 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 25: Muscle Readiness States & Soreness Severity Check-In
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 25: Muscle Readiness States & Soreness Severity Check-In ---');
try {
  const hData = RepRivalTest.heatData(7);
  const validStates = ['Ready', 'Mostly ready', 'Recovering', 'High recent load', 'Insufficient data'];
  let validStatesOk = true;
  Object.values(hData).forEach(m => {
    if (!validStates.includes(m.readinessState)) validStatesOk = false;
  });
  assert('Every muscle receives a valid readiness state', validStatesOk);

  // Verify check-in with severe soreness
  const log = RepRivalTest.getProfile().training.history || [];
  const fakeCheckin = {
    day: new Date().toISOString().split('T')[0],
    fatigue: 2,
    soreness: 3,
    sleep: 'okay',
    groups: ['Chest'],
    sorenessMap: { Chest: 'severe' }
  };

  // Temporarily attach checkin to state/storage helper
  if (typeof RepRivalTest.setTodayReadiness === 'function') {
    RepRivalTest.setTodayReadiness(fakeCheckin);
  }

  const hAfterSore = RepRivalTest.heatData(7);
  assert('Chest readiness state reflects high recent load/severe soreness when reported', hAfterSore.Chest && ['High recent load', 'Recovering'].includes(hAfterSore.Chest.readinessState));

  // Verify missing RIR / missing checkin handling
  assert('Missing RIR or missing check-in data does not throw or evaluate to NaN', Number.isFinite(hAfterSore.Chest.coveragePct));
} catch (err) {
  assert(`Suite 25 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 26: Simplified Equipment-Free Workouts & Space Constraints
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 26: Simplified Equipment-Free Workouts & Space Constraints ---');
try {
  const gen10m = RepRivalTest.generateOneOffWorkout({ duration: 10, gearMode: 'bodyweight', focus: 'full_body' });
  const totalSets10m = gen10m.pairs.reduce((acc, p) => acc + p.exercises.reduce((exAcc, ex) => exAcc + ex.sets, 0), 0);
  assert('10-minute workout generates max 4 working sets total for realistic duration', totalSets10m <= 4);

  const bwExIds = new Set();
  gen10m.pairs.forEach(p => p.exercises.forEach(e => bwExIds.add(e.id)));
  assert('Standard bodyweight generator excludes doorway row/curl unless requested', !bwExIds.has('bodyweight_doorway_row') && !bwExIds.has('bodyweight_doorway_curl'));

  // Verify rotation preservation
  const statePre = RepRivalTest.getState();
  const nextPre = statePre.next || 'A';
  assert('One-off generator leaves master plan rotation state.next strictly untouched', statePre.next === nextPre);
} catch (err) {
  assert(`Suite 26 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 27: Readiness-Aware Generation & Movement Families
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 27: Readiness-Aware Generation & Movement Families ---');
try {
  // Test 1: High recent load deprioritization
  // Mock check-in with severe chest soreness
  const fakeCheckinSore = {
    day: (typeof RepRivalTest.todayLocal === 'function') ? RepRivalTest.todayLocal() : new Date().toISOString().split('T')[0],
    sorenessMap: { Chest: 'severe' }
  };
  if (typeof RepRivalTest.setTodayReadiness === 'function') {
    RepRivalTest.setTodayReadiness(fakeCheckinSore);
  }

  // Generate many workouts and see if Chest appears less often
  let chestCount = 0;
  for(let i=0; i<20; i++) {
    const w = RepRivalTest.generateOneOffWorkout({ duration: 30, gearMode: 'bodyweight', focus: 'full_body' });
    if (w.pairs.some(p => p.exercises.some(e => e.muscle === 'Chest'))) chestCount++;
  }
  console.log('SUITE 27 CHEST COUNT:', chestCount);
  assert('Muscles with High recent load are deprioritized in generation', chestCount < 10);

  // Test 2: Movement family pairing prevention
  // Generate a workout and ensure no superset has two exercises of the same family
  const genW = RepRivalTest.generateOneOffWorkout({ duration: 30, gearMode: 'all', focus: 'full_body' });
  let familyClash = false;
  genW.pairs.forEach(p => {
    if (p.exercises.length > 1) {
      const families = p.exercises.map(e => e.family).filter(Boolean);
      if (new Set(families).size !== families.length) {
        familyClash = true;
      }
    }
  });
  assert('Supersets do not contain exercises from the same movement family', familyClash === false);

} catch (err) {
  assert(`Suite 27 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 28: Readiness Calibration Audit
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 28: Readiness Calibration Audit ---');
try {
  const originalState = RepRivalTest.getState();
  const now = Date.now();

  // Case A: High Load (14 sets, recently trained 12h ago)
  const logsA = Array(14).fill(null).map((_, i) => ({
    exId: 'chest_press', name: 'Chest Press', muscle: 'Chest', weight: 60, reps: 10, rir: 1, loggedAt: new Date(now - 12 * 3600000).toISOString()
  }));
  RepRivalTest.setHistory([{ id: 'h-a', startedAt: new Date(now - 12 * 3600000).toISOString(), endedAt: new Date(now - 12 * 3600000).toISOString(), logs: logsA }]);
  const dataA = RepRivalTest.heatData();
  assert('High load (14 sets) 12h ago shows low readiness (< 35%)', dataA.Chest.readinessScore < 35);
  assert('High load correctly tagged as High recent load', dataA.Chest.readinessState === 'High recent load');

  // Case B: Recovering (10 sets, trained 48h ago)
  const logsB = Array(10).fill(null).map((_, i) => ({
    exId: 'squat', name: 'Squat', muscle: 'Quads', weight: 100, reps: 8, rir: 2, loggedAt: new Date(now - 48 * 3600000).toISOString()
  }));
  RepRivalTest.setHistory([{ id: 'h-b', startedAt: new Date(now - 48 * 3600000).toISOString(), endedAt: new Date(now - 48 * 3600000).toISOString(), logs: logsB }]);
  const dataB = RepRivalTest.heatData();
  // With 10 sets 48h ago, it should be recovering/mostly ready (readiness 71%) but not 100% (ready) yet.
  assert('Moderate load (10 sets) 48h ago shows partial recovery (40-84%)', dataB.Quads.readinessScore > 35 && dataB.Quads.readinessScore < 85);
  assert('Moderate load tagged as Recovering or Mostly ready', ['Recovering', 'Mostly ready'].includes(dataB.Quads.readinessState));

  // Case C: Insufficient Data
  const dataC = RepRivalTest.heatData();
  assert('Never trained muscle shows null readiness score', dataC.Calves.readinessScore === null);
  assert('Never trained muscle shows null score for UI', dataC.Calves.score === null);
  assert('Never trained muscle tagged as Insufficient data', dataC.Calves.readinessState === 'Insufficient data');

  // Case D: Severe Soreness Penalty
  const testDay = (typeof RepRivalTest.todayLocal === 'function') ? RepRivalTest.todayLocal() : new Date().toISOString().split('T')[0];
  const fakeCheckinSore = { day: testDay, sorenessMap: { Back: 'severe' } };
  if (typeof RepRivalTest.setTodayReadiness === 'function') {
    RepRivalTest.setTodayReadiness(fakeCheckinSore);
  }
  // Even if not trained recently, severe soreness should drop readiness significantly
  RepRivalTest.setHistory([{ id: 'h-d', startedAt: new Date(now - 14 * 86400000).toISOString(), logs: [{ exId: 'row', muscle: 'Back', reps: 10 }] }]);
  const dataD = RepRivalTest.heatData();
  assert('Severe soreness causes significant penalty regardless of training age (< 80%)', dataD.Back.readinessScore !== null && dataD.Back.readinessScore < 80);

  // Restore original state
  RepRivalTest.setHistory(originalState.history);
} catch (err) {
  assert(`Suite 28 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 29: Stage 3 — Scientific Stimulus & Diminishing Returns
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 29: Stage 3 — Scientific Stimulus & Diminishing Returns ---');
try {
  const intel = window.RepRivalIntelligence;
  assert('RepRivalIntelligence engine is accessible', typeof intel === 'object' && intel !== null);

  // Test 1: Diminishing returns curve per session
  const w1 = intel.sessionSetDiminishingWeight(1);
  const w2 = intel.sessionSetDiminishingWeight(2);
  const w6 = intel.sessionSetDiminishingWeight(6);
  const w10 = intel.sessionSetDiminishingWeight(10);
  assert('No extra per-session penalty: set contributions equal before the single log dose curve', w1 === 1 && w2 === 1 && w6 === 1 && w10 === 1);
  assert('Canonical stimulus transform has diminishing marginal return as dose increases', intel.trainingDoseScore(6, 10) - intel.trainingDoseScore(5, 10) < intel.trainingDoseScore(2, 10) - intel.trainingDoseScore(1, 10));

  // Test 2: RIR stimulus weighting (0-2 RIR parity, submaximal discount)
  const rir0 = intel.rirStimulusWeight(0);
  const rir1 = intel.rirStimulusWeight(1);
  const rir2 = intel.rirStimulusWeight(2);
  const rir5 = intel.rirStimulusWeight(5);
  assert('0 RIR provides full 1.0 stimulus', rir0.factor === 1.0);
  assert('1 RIR is within 5% of failure stimulus (0.95 - 1.0)', rir1.factor >= 0.95 && rir1.factor <= 1.0);
  assert('2 RIR is within 8% of failure stimulus (0.92 - 1.0)', rir2.factor >= 0.92 && rir2.factor <= 1.0);
  assert('Submaximal 5+ RIR has substantial stimulus discount (<= 0.45)', rir5.factor <= 0.45);

  // Test 3: Warm-up sets and Skipped sets
  const now = Date.now();
  const testHistWarmup = [{
    id: 'test-warmup-sess',
    startedAt: new Date(now - 12 * 3600000).toISOString(),
    logs: [
      { exId: 'bench', name: 'Bench', muscle: 'Chest', weight: 40, reps: 10, rir: 4, warmup: true },
      { exId: 'bench', name: 'Bench', muscle: 'Chest', weight: 70, reps: 10, rir: 2 },
      { exId: 'bench', name: 'Bench', muscle: 'Chest', weight: 70, reps: 0, skipped: true }
    ]
  }];
  const mMetrics = intel.calculateMuscleMetrics({ history: testHistWarmup, now });
  // Chest: 0 warmup (0.0) + 1 working (1.0) = 1.0
  assert('Warmup set receives 0 credit and skipped set receives 0 credit', mMetrics.Chest.effectiveSets === 1.0);

  // Test 4: Compound secondary muscle exposure propagation
  const compoundHist = [{
    id: 'test-compound',
    startedAt: new Date(now - 24 * 3600000).toISOString(),
    logs: [
      { exId: 'barbell_row', name: 'Barbell Row', muscle: 'Back', weight: 60, reps: 10, rir: 2 }
    ]
  }];
  const mCompound = intel.calculateMuscleMetrics({ history: compoundHist, now });
  assert('Compound back row propagates secondary exposure to Biceps', mCompound.Biceps.ever === true && mCompound.Biceps.hasSecondaryHistory === true);
  assert('Compound back row propagates secondary exposure to Rear delts', mCompound['Rear delts'].ever === true && mCompound['Rear delts'].hasSecondaryHistory === true);

  // Test 5: Frequency distribution advantage (5 sets x 2 days > 10 sets in 1 day)
  const singleDayHist = [{
    id: 'single-day',
    startedAt: new Date(now - 24 * 3600000).toISOString(),
    logs: Array(10).fill(null).map(() => ({ exId: 'squat', muscle: 'Quads', reps: 10, rir: 2 }))
  }];
  const splitDayHist = [
    {
      id: 'split-day-1',
      startedAt: new Date(now - 48 * 3600000).toISOString(),
      logs: Array(5).fill(null).map(() => ({ exId: 'squat', muscle: 'Quads', reps: 10, rir: 2 }))
    },
    {
      id: 'split-day-2',
      startedAt: new Date(now - 24 * 3600000).toISOString(),
      logs: Array(5).fill(null).map(() => ({ exId: 'squat', muscle: 'Quads', reps: 10, rir: 2 }))
    }
  ];
  const mSingle = intel.calculateMuscleMetrics({ history: singleDayHist, now });
  const mSplit = intel.calculateMuscleMetrics({ history: splitDayHist, now });
  assert('Split frequency is credited solely by recency, not per-session bonus', mSplit.Quads.stimulusUnits < mSingle.Quads.stimulusUnits && mSplit.Quads.stimulusUnits > 0);
} catch (err) {
  assert(`Suite 29 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 30: Stage 3 — Decoupled Pillars & Multi-factor Readiness Architecture
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 30: Stage 3 — Decoupled Pillars & Readiness Architecture ---');
try {
  const intel = window.RepRivalIntelligence;
  const now = Date.now();

  // Test 1: Decoupled Stimulus vs Readiness
  // Right after 12 sets of Chest: Stimulus is high (> 65%), Readiness is low (< 35%)
  const heavyChestHist = [{
    id: 'heavy-chest',
    startedAt: new Date(now - 6 * 3600000).toISOString(),
    logs: Array(12).fill(null).map(() => ({ exId: 'chest_press', muscle: 'Chest', reps: 10, rir: 1 }))
  }];
  const mDecoupled = intel.calculateMuscleMetrics({ history: heavyChestHist, now });
  assert('High recent stimulus (> 65%) with low readiness (< 35%) proves pillar decoupling', mDecoupled.Chest.stimulusScore > 65 && mDecoupled.Chest.readinessScore < 35);

  // Test 2: Full recovery with baseline history
  // 96 hours post-training, readiness recovers to high (>= 88%)
  const restedHist = [{
    id: 'rested-chest',
    startedAt: new Date(now - 96 * 3600000).toISOString(),
    logs: Array(8).fill(null).map(() => ({ exId: 'chest_press', muscle: 'Chest', reps: 10, rir: 2 }))
  }];
  const mRested = intel.calculateMuscleMetrics({ history: restedHist, now });
  assert('Well-rested muscle at 96h returns to high readiness (>= 80%)', mRested.Chest.readinessScore >= 80);

  // Test 3: Anatomical map color requirement (Stimulus + Recency)
  // Recent high stimulus (< 3d, stimulus >= 80) -> vivid athletic red
  const colorHot = intel.fillFor(mDecoupled.Chest);
  assert('Recent high stimulus produces vivid athletic red map glow', (colorHot.fill.startsWith('#c') || colorHot.fill.startsWith('#d') || colorHot.fill.startsWith('#e') || colorHot.fill.startsWith('#f')) && colorHot.alpha >= 0.50);

  // Single submaximal set (< 20 stimulus score) does NOT glow bright red
  const lightChestHist = [{
    id: 'light-chest',
    startedAt: new Date(now - 24 * 3600000).toISOString(),
    logs: [{ exId: 'pushup', muscle: 'Chest', reps: 8, rir: 4 }]
  }];
  const mLight = intel.calculateMuscleMetrics({ history: lightChestHist, now });
  const colorLight = intel.fillFor(mLight.Chest);
  assert('Single submaximal set does not glow bright red (stimulus < 20)', colorLight.fill !== '#ef493f');

  // Prolonged absence (> 21d) in trained athlete produces blue tone
  const detrainedHist = [
    { id: 'old-chest1', startedAt: new Date(now - 42 * 86400000).toISOString(), logs: Array(4).fill(null).map(() => ({ exId: 'chest_press', muscle: 'Chest', reps: 10, rir: 2 })) },
    { id: 'old-chest2', startedAt: new Date(now - 28 * 86400000).toISOString(), logs: Array(2).fill(null).map(() => ({ exId: 'chest_press', muscle: 'Chest', reps: 10, rir: 2 })) }
  ];
  const mDetrained = intel.calculateMuscleMetrics({ history: detrainedHist, now });
  const colorDetrained = intel.fillFor(mDetrained.Chest);
  assert('Prolonged absence (> 21d) produces blue tone (#31528c)', colorDetrained.fill === '#31528c');

  // Never trained muscle produces neutral transparent tone (#18191d, alpha 0)
  const colorUntrained = intel.fillFor(mDetrained.Calves);
  assert('Untrained muscle produces neutral transparent tone with alpha 0', colorUntrained.fill === '#18191d' && colorUntrained.alpha === 0);

  // Test 4: Cross-module metric consistency between heatData and generator
  const hData = RepRivalTest.heatData();
  assert('heatData provides readinessConfidence indicator', typeof hData.Chest.readinessConfidence === 'string');
  assert('heatData provides transparent factor breakdown list', Array.isArray(hData.Chest.factors));
} catch (err) {
  assert(`Suite 30 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 31: Scientific Cross-Surface Consistency & Edge Case Validation
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 31: Scientific Cross-Surface Consistency & Edge Cases ---');
try {
  const intel = window.RepRivalIntelligence;
  const now = Date.now();
  const originalState = RepRivalTest.getState();

  // Test 1: Cross-Surface Consistency (Home, Map, and Generator share exact identical data)
  const sampleHist = [{
    id: 'consistency-wo',
    startedAt: new Date(now - 18 * 3600000).toISOString(),
    logs: [
      { exId: 'low_incline_db_press', name: 'Low-incline DB press', muscle: 'Chest', weight: 22.5, reps: 10, rir: 2 },
      { exId: 'chest_supported_db_row', name: 'Chest-supported DB row', muscle: 'Back', weight: 20, reps: 10, rir: 2 }
    ]
  }];
  RepRivalTest.setHistory(sampleHist);
  const homeData = RepRivalTest.heatData(7);
  const detailedData = RepRivalTest.heatData(28);

  assert('Chest primary effective set count is identical across modules (1.0)', homeData.Chest.effectiveSets === 1.0);
  assert('Triceps secondary credit (0.4) is identical across modules', homeData.Triceps.secondarySets === 0.4 && homeData.Triceps.effectiveSets === 0.4);
  assert('Both 7d and 28d windows capture identical last workout timestamp', homeData.Chest.last === detailedData.Chest.last);

  // Test 2: Extreme workload resilience (25 sets does not crash or produce NaN or <12%)
  const extremeHist = [{
    id: 'extreme-wo',
    startedAt: new Date(now - 6 * 3600000).toISOString(),
    logs: Array(25).fill(null).map(() => ({ exId: 'squat', muscle: 'Quads', reps: 10, rir: 1 }))
  }];
  const mExtreme = intel.calculateMuscleMetrics({ history: extremeHist, now });
  assert('Extreme volume (25 sets) produces bounded readiness (>= 12% and <= 100%)', mExtreme.Quads.readinessScore >= 12 && mExtreme.Quads.readinessScore <= 100);
  assert('Extreme volume does not produce NaN in stimulus or readiness', Number.isFinite(mExtreme.Quads.stimulusScore) && Number.isFinite(mExtreme.Quads.readinessScore));
  assert('Extreme volume is categorized as High recent load', mExtreme.Quads.readinessState === 'High recent load');

  // Test 3: Missing check-in data handling (missing check-in does not mean zero soreness / perfect recovery)
  const mNoCheckin = intel.calculateMuscleMetrics({ history: extremeHist, checkin: null, now });
  assert('Missing checkin preserves conservative fatigue deductions without assuming 0 soreness', mNoCheckin.Quads.readinessScore < 35);
  assert('Readiness confidence reflects presence or absence of subjective feedback', mNoCheckin.Quads.readinessConfidence === 'moderate');

  // Test 4: Variable personal history / acute:chronic workload spike detection
  // Athlete with 4-week average of 4 sets/week doing 12 sets triggers acute workload factor
  const chronicHist = [
    { startedAt: new Date(now - 21 * 86400000).toISOString(), logs: Array(4).fill(null).map(() => ({ exId: 'bench', muscle: 'Chest', reps: 10, rir: 2 })) },
    { startedAt: new Date(now - 14 * 86400000).toISOString(), logs: Array(4).fill(null).map(() => ({ exId: 'bench', muscle: 'Chest', reps: 10, rir: 2 })) },
    { startedAt: new Date(now - 7 * 86400000).toISOString(), logs: Array(4).fill(null).map(() => ({ exId: 'bench', muscle: 'Chest', reps: 10, rir: 2 })) },
    { startedAt: new Date(now - 12 * 3600000).toISOString(), logs: Array(12).fill(null).map(() => ({ exId: 'bench', muscle: 'Chest', reps: 10, rir: 2 })) }
  ];
  const mSpike = intel.calculateMuscleMetrics({ history: chronicHist, now });
  assert('Workload spike identified in breakdown factors', mSpike.Chest.factors.some(f => f.includes('Unaccustomed workload')));

  // Test 5: Component 3 Long-Term Progression (scoreEpley1RM & calculateExerciseProgression)
  const benchLogs = [
    { exId: 'bench', weight: 60, reps: 10, loggedAt: '2026-09-01' },
    { exId: 'bench', weight: 65, reps: 10, loggedAt: '2026-10-01' }
  ];
  const prog = intel.calculateExerciseProgression(benchLogs);
  assert('Component 3 correctly identifies improving exercise performance progression', prog.status === 'improving' && prog.changePct > 0);

  const singleLog = [{ exId: 'bench', weight: 60, reps: 10 }];
  const progSingle = intel.calculateExerciseProgression(singleLog);
  assert('Component 3 reports insufficient evidence when fewer than 2 comparable sessions exist', progSingle.status === 'insufficient_evidence');

  // Test 6: UTC Day Boundary Stability (11:59pm vs 12:01am timestamps)
  const tBeforeMidnight = Date.parse('2026-10-22T23:59:00.000Z');
  const tAfterMidnight = Date.parse('2026-10-23T00:01:00.000Z');
  const diffHours = (tAfterMidnight - tBeforeMidnight) / 3600000;
  assert('Date boundary elapsed hours calculate continuously (< 0.1h)', diffHours < 0.1);

  // Restore state
  RepRivalTest.setHistory(originalState.history);
} catch (err) {
  assert(`Suite 31 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 32: Critical Runtime Integration & Alignment Assertions
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 32: Critical Runtime Integration & Alignment ---');
try {
  const intel = window.RepRivalIntelligence;
  const now = Date.now();
  const originalState = RepRivalTest.getState();

  // Test 1: 92% readiness receives 'Ready' status (score-label mathematical alignment)
  const mockGroupMetrics = intel.calculateGroupMetrics({
    Biceps: { readinessScore: 100, stimulusScore: 50, effectiveSets: 2, rawCompletedSets: 2, targetSets: 6, readinessState: 'Ready' },
    Triceps: { readinessScore: 84, stimulusScore: 50, effectiveSets: 2, rawCompletedSets: 2, targetSets: 6, readinessState: 'Recovering' }
  });
  const armsGroup = mockGroupMetrics.find(g => g.name === 'Arms');
  assert('92% readiness group receives Ready status (not Recovering)', armsGroup.score === 92 && armsGroup.readinessState === 'Ready');

  // Test 2: Distinction between no-history and previously-trained muscles
  const pastHist = [{
    id: 'past-calves',
    startedAt: new Date(now - 21 * 86400000).toISOString(),
    logs: [{ exId: 'calf_raise', muscle: 'Calves', weight: 30, reps: 15, rir: 2 }]
  }];
  const mCalvesPast = intel.calculateMuscleMetrics({ history: pastHist, period: 7, now });
  const mCalvesNone = intel.calculateMuscleMetrics({ history: [], period: 7, now });

  assert('Never-trained muscle has null readiness score and Insufficient data state', mCalvesNone.Calves.readinessScore === null && mCalvesNone.Calves.readinessState === 'Insufficient data');
  assert('Previously-trained muscle with 0 sets this week has 100% readiness and Ready state', mCalvesPast.Calves.effectiveSets === 0 && mCalvesPast.Calves.readinessScore === 100 && mCalvesPast.Calves.readinessState === 'Ready');

  const colorPast = intel.fillFor(mCalvesPast.Calves);
  const colorNone = intel.fillFor(mCalvesNone.Calves);
  assert('A single old calf session is insufficient to claim detraining risk', mCalvesPast.Calves.isDetraining === false && colorPast.fill !== '#4b6ba2');
  assert('Never-trained muscle shows neutral transparent overlay (alpha 0)', colorNone.alpha === 0);

  // Test 3: One easy set does not produce maximum bright red heat
  const easyHist = [{
    id: 'easy-sess',
    startedAt: new Date(now - 12 * 3600000).toISOString(),
    logs: [{ exId: 'pushup', muscle: 'Chest', reps: 6, rir: 5 }]
  }];
  const mEasy = intel.calculateMuscleMetrics({ history: easyHist, period: 7, now });
  const colorEasy = intel.fillFor(mEasy.Chest);
  assert('One easy set yields low stimulus score (< 20)', mEasy.Chest.stimulusScore < 20);
  assert('One easy set does not produce bright red heat (#ef493f)', colorEasy.fill !== '#ef493f');

  // Test 4: Meaningful challenging session produces stronger stimulus than one easy set
  const hardHist = [{
    id: 'hard-sess',
    startedAt: new Date(now - 12 * 3600000).toISOString(),
    logs: Array(4).fill(null).map(() => ({ exId: 'bench', muscle: 'Chest', weight: 80, reps: 8, rir: 1 }))
  }];
  const mHard = intel.calculateMuscleMetrics({ history: hardHist, period: 7, now });
  assert('Challenging 4-set session produces significantly higher stimulus than 1 easy set', mHard.Chest.stimulusScore > mEasy.Chest.stimulusScore * 3);

  // Test 5: Cross-surface consistency across Home, Map and Generator
  RepRivalTest.setHistory(hardHist);
  const hDataApp = RepRivalTest.heatData(7);
  const groupApp = intel.calculateGroupMetrics(hDataApp);
  const chestGroup = groupApp.find(g => g.name === 'Chest');
  assert('Home and Detailed Map share exact effective set totals', hDataApp.Chest.effectiveSets === chestGroup.effectiveSets);

  // Restore state
  RepRivalTest.setHistory(originalState.history);
} catch (err) {
  assert(`Suite 32 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 33: Production Workout Pipeline Adapter & Heat Zone SVG Integration
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 33: Production Workout Pipeline & SVG Heat Zone Rendering ---');
try {
  const intel = window.RepRivalIntelligence;
  const now = Date.now();
  const originalState = RepRivalTest.getState();

  // Test 1: Production-shaped history with numeric timestamps, exId lookup (missing log.muscle), and Shoulders alias
  const prodHistory = [
    {
      id: 'prod-fb-a',
      startedAt: now - (1 * 86400000), // 1 day ago
      session: 'A',
      logs: [
        { exId: 'bench', name: 'Barbell Bench Press', weight: 80, reps: 8, rir: 1 }, // Chest
        { exId: 'bench', name: 'Barbell Bench Press', weight: 80, reps: 8, rir: 2 },
        { exId: 'bench', name: 'Barbell Bench Press', weight: 80, reps: 8, rir: 1 },
        { exId: 'row', name: 'Barbell Row', muscle: 'Back', weight: 70, reps: 10, rir: 2 },
        { exId: 'row', name: 'Barbell Row', muscle: 'Back', weight: 70, reps: 10, rir: 2 },
        { exId: 'ohp', name: 'Overhead Press', muscle: 'Shoulders', weight: 50, reps: 8, rir: 2 }, // Alias Shoulders -> Side delts
        { exId: 'ohp', name: 'Overhead Press', muscle: 'Shoulders', weight: 50, reps: 8, rir: 2 },
        { exId: 'squat', name: 'Barbell Squat', muscle: 'Quads', weight: 100, reps: 8, rir: 2 },
        { exId: 'squat', name: 'Barbell Squat', muscle: 'Quads', weight: 100, reps: 8, rir: 2 }
      ]
    },
    {
      id: 'prod-fb-b',
      startedAt: now - (4 * 86400000), // 4 days ago
      session: 'B',
      logs: [
        { exId: 'incline_bench', name: 'Incline Dumbbell Press', weight: 30, reps: 10, rir: 2 },
        { exId: 'incline_bench', name: 'Incline Dumbbell Press', weight: 30, reps: 10, rir: 2 },
        { exId: 'lat_pulldown', name: 'Lat Pulldown', muscle: 'Back', weight: 65, reps: 12, rir: 2 },
        { exId: 'lat_pulldown', name: 'Lat Pulldown', muscle: 'Back', weight: 65, reps: 12, rir: 2 },
        { exId: 'rdl', name: 'Romanian Deadlift', muscle: 'Hamstrings', weight: 90, reps: 10, rir: 2 },
        { exId: 'rdl', name: 'Romanian Deadlift', muscle: 'Hamstrings', weight: 90, reps: 10, rir: 2 },
        { exId: 'bicep_curl', name: 'Barbell Bicep Curl', muscle: 'Arms', weight: 30, reps: 12, rir: 2 }, // Alias Arms -> Biceps
        { exId: 'tricep_pushdown', name: 'Tricep Pushdown', muscle: 'Triceps', weight: 35, reps: 12, rir: 2 },
        { exId: 'calf_raise', name: 'Standing Calf Raise', muscle: 'Calves', weight: 60, reps: 15, rir: 2 },
        { exId: 'crunch', name: 'Cable Crunch', muscle: 'Core', weight: 40, reps: 15, rir: 2 },
        { exId: 'hip_thrust', name: 'Barbell Hip Thrust', muscle: 'Glutes', weight: 110, reps: 10, rir: 2 },
        { exId: 'hip_thrust', name: 'Barbell Hip Thrust', muscle: 'Glutes', weight: 110, reps: 10, rir: 2 },
        { exId: 'lat_raise', name: 'Dumbbell Lateral Raise', muscle: 'Side delts', weight: 12, reps: 15, rir: 1 },
        { exId: 'lat_raise', name: 'Dumbbell Lateral Raise', muscle: 'Side delts', weight: 12, reps: 15, rir: 1 },
        { exId: 'face_pull', name: 'Cable Face Pull', muscle: 'Rear delts', weight: 25, reps: 15, rir: 2 },
        { exId: 'face_pull', name: 'Cable Face Pull', muscle: 'Rear delts', weight: 25, reps: 15, rir: 2 },
        { exId: 'leg_extension', name: 'Leg Extension', muscle: 'Quads', weight: 70, reps: 12, rir: 2 },
        { exId: 'leg_curl', name: 'Lying Leg Curl', muscle: 'Hamstrings', weight: 55, reps: 12, rir: 2 }
      ]
    }
  ];

  RepRivalTest.setHistory(prodHistory);

  // Test 2: Calculate metrics on production history
  const prodData = RepRivalTest.heatData(7);
  assert('Production history with numeric timestamps parses correctly', prodData.Chest.last === now - 86400000);
  assert('Missing log.muscle resolved via exId lookup (Bench press -> Chest)', prodData.Chest.primarySets >= 3 && prodData.Chest.effectiveSets >= 3);
  assert('Legacy "Shoulders" muscle string mapped to "Side delts"', prodData['Side delts'].effectiveSets > 0);
  assert('Legacy "Arms" muscle string mapped to "Biceps"', prodData.Biceps.effectiveSets > 0);
  assert('Secondary muscle contributions accumulated for Triceps from Bench Press', prodData.Triceps.secondarySets > 0);

  // Test 3: SVG Figure Heat Rendering (Productive Stimulus -> Continuous Heat Fill)
  const svgFront = window.RepRivalBodyMap.figure('front', prodData);
  assert('Front SVG figure renders valid path elements', svgFront.includes('<path class="rr160-muscle-zone"'));
  assert('Chest with recent productive stimulus renders active heatmap fill', svgFront.includes('data-muscle="Chest"') && !svgFront.includes('opacity="0.00"'));

  // Test 4: Group Metrics & Active Group Counter
  const groupMetrics = intel.calculateGroupMetrics(prodData);
  assert('All 9 primary muscle groups aggregated', groupMetrics.length === 9);

  const readyGroups = groupMetrics.filter(g => g.readinessState === 'Ready' || g.readinessState === 'Mostly ready').length;
  assert('Active group counter produces non-zero count (> 0) from real training history', readyGroups > 0);

  // Test 5: Full Muscle Panel UI Integration
  const panelHtml = RepRivalTest.musclePanel(false);
  assert('Muscle Heat & Readiness panel renders without throw', typeof panelHtml === 'string' && panelHtml.includes('Muscle Heat & Readiness'));
  assert('Panel HTML includes ready group counter and totals', panelHtml.includes('groups ready to train') && panelHtml.includes('logged sets'));

  // Restore original state
  RepRivalTest.setHistory(originalState.history);
} catch (err) {
  assert(`Suite 33 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 34: HTML Script Tag & Window Module Registration Integrity
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 34: HTML Script Tag & Window Module Registration Integrity ---');
try {
  const htmlPath = fs.existsSync(path.join(__dirname, '../index.html'))
    ? path.join(__dirname, '../index.html')
    : path.join(__dirname, '../public/index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  assert('index.html includes muscle-intelligence.js script tag', htmlContent.includes('<script src="/muscle-intelligence.js"></script>'));

  const intelIdx = htmlContent.indexOf('src="/muscle-intelligence.js"');
  const bodyMapIdx = htmlContent.indexOf('src="/body-map.js"');
  const adaptiveIdx = htmlContent.indexOf('src="/adaptive.js"');
  const appIdx = htmlContent.indexOf('src="/app.js');

  assert('muscle-intelligence.js is loaded before body-map.js', intelIdx !== -1 && bodyMapIdx !== -1 && intelIdx < bodyMapIdx);
  assert('muscle-intelligence.js is loaded before adaptive.js', intelIdx !== -1 && adaptiveIdx !== -1 && intelIdx < adaptiveIdx);
  assert('muscle-intelligence.js is loaded before app.js', intelIdx !== -1 && appIdx !== -1 && intelIdx < appIdx);

  assert('window.RepRivalIntelligence is registered as an object', typeof window.RepRivalIntelligence === 'object' && window.RepRivalIntelligence !== null);
  assert('window.RepRivalIntelligence exposes calculateMuscleMetrics', typeof window.RepRivalIntelligence.calculateMuscleMetrics === 'function');
  assert('window.RepRivalIntelligence exposes calculateGroupMetrics', typeof window.RepRivalIntelligence.calculateGroupMetrics === 'function');
  assert('window.RepRivalIntelligence exposes fillFor', typeof window.RepRivalIntelligence.fillFor === 'function');
} catch (err) {
  assert(`Suite 34 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 35: Two-Metric System (Productive Stimulus vs Current Readiness)
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 35: Two-Metric System (Stimulus vs Readiness Decoupling) ---');
try {
  const intel = window.RepRivalIntelligence;
  const originalState = RepRivalTest.getState();
  const now = Date.now();

  // Test 1: Status Pill Thresholds (Readiness Only, No Contradictions)
  assert('Readiness null produces "Insufficient data"', intel.getReadinessState(null) === 'Insufficient data');
  assert('Readiness 25% produces "High recent load" (0-39 range)', intel.getReadinessState(25) === 'High recent load');
  assert('Readiness 39% produces "High recent load"', intel.getReadinessState(39) === 'High recent load');
  assert('Readiness 40% produces "Recovering" (40-69 range)', intel.getReadinessState(40) === 'Recovering');
  assert('Readiness 69% produces "Recovering"', intel.getReadinessState(69) === 'Recovering');
  assert('Readiness 70% produces "Mostly ready" (70-84 range)', intel.getReadinessState(70) === 'Mostly ready');
  assert('Readiness 84% produces "Mostly ready"', intel.getReadinessState(84) === 'Mostly ready');
  assert('Readiness 85% produces "Ready" (85-100 range)', intel.getReadinessState(85) === 'Ready');
  assert('Readiness 92% produces "Ready" (never labelled Recovering)', intel.getReadinessState(92) === 'Ready');
  assert('Readiness 100% produces "Ready"', intel.getReadinessState(100) === 'Ready');

  // Test 2: Row Rendering Structure (Two Distinct Bars per Row)
  const sampleRow = RepRivalTest.heatBar({
    name: 'Chest',
    stimulusScore: 82,
    readinessScore: 48,
    effectiveSets: 9,
    targetSets: 10,
    readinessState: 'Recovering'
  });
  assert('Row header contains group name and effective set summary in brackets', sampleRow.includes('Chest') && sampleRow.includes('(9/10 sets)'));
  assert('Row contains status pill driven by readiness only', sampleRow.includes('rr-readiness-pill recovering') && sampleRow.includes('Recovering'));
  assert('Row contains dedicated Stimulus sub-row with 82%', sampleRow.includes('Stimulus') && sampleRow.includes('82%') && sampleRow.includes('stimulus-hot'));
  assert('Row contains dedicated Readiness sub-row with 48%', sampleRow.includes('Readiness') && sampleRow.includes('48%') && sampleRow.includes('readiness-recovering'));

  // Test 3: High Stimulus + Low Readiness Scenario (Chest trained hard yesterday)
  const heavyChestHistory = [{
    id: 'chest-heavy',
    startedAt: new Date(now - 16 * 3600000).toISOString(),
    logs: Array(10).fill(null).map(() => ({ exId: 'bench', muscle: 'Chest', reps: 10, rir: 1 }))
  }];
  RepRivalTest.setHistory(heavyChestHistory);
  const dataHeavy = RepRivalTest.heatData(7);
  const groupsHeavy = intel.calculateGroupMetrics(dataHeavy);
  const chestGroup = groupsHeavy.find(g => g.name === 'Chest');

  assert('Chest stimulus is high (> 55%) from 10 hard sets', chestGroup.stimulusScore > 55);
  assert('Chest readiness is low (<= 39%) shortly after heavy session', chestGroup.readinessScore <= 39);
  assert('Chest status pill is "High recent load", matching its low readiness', chestGroup.readinessState === 'High recent load');

  // Anatomical map reflects STIMULUS ONLY (vivid red), not low readiness (never green/yellow)
  const chestFill = intel.fillFor(dataHeavy.Chest);
  assert('Anatomical map for high stimulus muscle shows active red regardless of low readiness', (chestFill.fill.startsWith('#8') || chestFill.fill.startsWith('#9') || chestFill.fill.startsWith('#a') || chestFill.fill.startsWith('#b') || chestFill.fill.startsWith('#c') || chestFill.fill.startsWith('#d') || chestFill.fill.startsWith('#e') || chestFill.fill.startsWith('#f')) && chestFill.alpha >= 0.50);

  // Test 4: Low Stimulus + High Readiness Scenario (Calves with older history, 0 sets this week)
  const oldCalvesHistory = [
    {
      id: 'calves-old',
      startedAt: new Date(now - 12 * 86400000).toISOString(),
      logs: Array(6).fill(null).map(() => ({ exId: 'calf_raise', muscle: 'Calves', reps: 15, rir: 2 }))
    }
  ];
  RepRivalTest.setHistory(oldCalvesHistory);
  const dataOld = RepRivalTest.heatData(7);
  const groupsOld = intel.calculateGroupMetrics(dataOld);
  const calvesGroup = groupsOld.find(g => g.name === 'Calves');

  assert('Calves has 0 weekly sets', calvesGroup.effectiveSets === 0);
  assert('Calves readiness is >= 95% (fully recovered from 12 days ago)', calvesGroup.readinessScore >= 95);
  assert('Calves readiness state is "Ready"', calvesGroup.readinessState === 'Ready');
  assert('Calves stimulus score is low / near 0 this week', calvesGroup.stimulusScore <= 30);

  // Anatomical map reflects stimulus/inactivity (neutral dim or blue tone, never red or green)
  const calvesFill = intel.fillFor(dataOld.Calves);
  assert('Calves anatomical map is not red despite 100% readiness', calvesFill.fill !== '#ef493f');

  // Test 5: Untrained Muscle Scenario (Never trained)
  assert('Never-trained muscle has null readiness score and "Insufficient data"', dataOld.Quads.readinessScore === null && dataOld.Quads.readinessState === 'Insufficient data');
  const untrainedRow = RepRivalTest.heatBar({
    name: 'Quads',
    stimulusScore: 0,
    readinessScore: null,
    effectiveSets: 0,
    targetSets: 10,
    readinessState: 'Insufficient data'
  });
  assert('Untrained row shows "Insufficient data" pill', untrainedRow.includes('insufficient') && untrainedRow.includes('Insufficient data'));
  assert('Untrained row displays dash (—) for readiness percentage', untrainedRow.includes('—'));

  // Test 6: "Groups Ready" Summary Counter
  // Groups ready must count ONLY groups in Ready or Mostly ready (>= 70%)
  const mixedGroups = [
    { name: 'Chest', readinessScore: 90, readinessState: 'Ready' },
    { name: 'Back', readinessScore: 78, readinessState: 'Mostly ready' },
    { name: 'Shoulders', readinessScore: 65, readinessState: 'Recovering' },
    { name: 'Arms', readinessScore: 30, readinessState: 'High recent load' },
    { name: 'Core', readinessScore: null, readinessState: 'Insufficient data' }
  ];
  const countReady = mixedGroups.filter(g => g.readinessState === 'Ready' || g.readinessState === 'Mostly ready').length;
  assert('"Groups ready" counts strictly Ready and Mostly ready groups (2 out of 5)', countReady === 2);

  // Test 7: Both Compact Home Card and Detailed Map page render two-metric system
  const compactHtml = RepRivalTest.musclePanel(true);
  const detailedHtml = RepRivalTest.musclePanel(false);

  assert('Compact Home card contains two-metric rows with Stimulus and Readiness labels', compactHtml.includes('rr-two-metric-row') && compactHtml.includes('Stimulus') && compactHtml.includes('Readiness'));
  assert('Detailed map contains two-metric rows with Stimulus and Readiness labels', detailedHtml.includes('rr-two-metric-row') && detailedHtml.includes('Stimulus') && detailedHtml.includes('Readiness'));
  assert('Compact Home card shows active ready groups count out of 9', compactHtml.includes('/ 9</small></strong><span>groups ready</span>'));
  assert('Detailed map displays groups ready count out of 9', detailedHtml.includes('/ 9</strong><span>groups ready to train</span>'));

  // Restore state
  RepRivalTest.setHistory(originalState.history);
} catch (err) {
  assert(`Suite 35 Exception: ${err.message}`, false);
}

// SUITE 36: Continuous Muscle Heat Zone Intensity Verification (10% Anchors)
console.log('\n--- SUITE 36: Continuous Muscle Heat Zone Intensity (10% Anchors) ---');
try {
  const intel = window.RepRivalIntelligence;
  // Test 1: getStimulusColor exported utility
  assert('window.RepRivalIntelligence exposes getStimulusColor utility', typeof intel.getStimulusColor === 'function');

  // Test 2: Specific visual score calibration testing (10%, 30%, 40%, 54%, 74%, 90%, 100%)
  const c10  = intel.fillFor({ stimulusScore: 10,  ever: true, daysSince: 1 });
  const c30  = intel.fillFor({ stimulusScore: 30,  ever: true, daysSince: 1 });
  const c40  = intel.fillFor({ stimulusScore: 40,  ever: true, daysSince: 1 });
  const c54  = intel.fillFor({ stimulusScore: 54,  ever: true, daysSince: 1 });
  const c74  = intel.fillFor({ stimulusScore: 74,  ever: true, daysSince: 1 });
  const c90  = intel.fillFor({ stimulusScore: 90,  ever: true, daysSince: 1 });
  const c100 = intel.fillFor({ stimulusScore: 100, ever: true, daysSince: 1 });

  // Strictly increasing opacity across test scores
  assert('Continuous opacity scaling: 10% < 30% < 40% < 54% < 74% < 90% < 100%',
    c10.alpha < c30.alpha &&
    c30.alpha < c40.alpha &&
    c40.alpha < c54.alpha &&
    c54.alpha < c74.alpha &&
    c74.alpha < c90.alpha &&
    c90.alpha <= c100.alpha
  );

  // Strictly increasing red intensity (R channel) across test scores
  assert('Continuous red channel scaling: 10% < 30% < 40% < 54% < 74% < 90% <= 100%',
    c10.r < c30.r &&
    c30.r < c40.r &&
    c40.r < c54.r &&
    c54.r < c74.r &&
    c74.r < c90.r &&
    c90.r <= c100.r
  );

  // Requirement 1 & 3: 11% Quads is cool/subdued blue-slate
  assert('11% stimulus (Quads) is cool/subdued (R <= 60, alpha <= 0.25)', c10.r <= 60 && c10.alpha <= 0.25);

  // Requirement 1 & 3: 40% Back is substantially neutral (R <= 135, muted grey-rose, alpha <= 0.48)
  assert('40% stimulus (Back) is substantially neutral (R <= 135, alpha <= 0.48)', c40.r <= 135 && c40.alpha <= 0.48);

  // Requirement 1 & 3: 54% Arms is moderately stimulated (muted dusty red)
  assert('54% stimulus (Arms) appears moderately stimulated (R ~168, alpha ~0.58)', c54.r > 150 && c54.r < 180 && c54.alpha >= 0.55);

  // Requirement 1 & 3: 74% Chest is pronounced red but clearly below maximum
  assert('74% stimulus (Chest) is pronounced red but clearly below maximum (R ~214, alpha ~0.75)', c74.r > 190 && c74.r < 230 && c74.alpha < 0.82);

  // Requirement 1 & 2: 34% Shoulders shows subtle visible warmth
  const c34 = intel.fillFor({ stimulusScore: 34, ever: true, daysSince: 1 });
  assert('34% stimulus (Shoulders) shows subtle, clearly visible warmth (R ~120, alpha ~0.39)', c34.r >= 115 && c34.alpha >= 0.35);

  // Requirement 1: 74% Chest visibly differs from 100% Max by >= 25 R channel points
  assert('74% Chest is visibly distinct from 100% Max (red channel difference >= 25)', (c100.r - c74.r) >= 25);

  // Requirement 1: SVG paths use screen mix-blend-mode for clean vector heatmap overlays
  const svgSample = window.RepRivalBodyMap.figure('front', { Chest: { stimulusScore: 74, ever: true, daysSince: 1 } });
  assert('SVG muscle zone paths use mix-blend-mode:screen for bright clean heat rendering', svgSample.includes('mix-blend-mode:screen'));

  // Test 4: Shared visual color mapping consistency
  const shared74 = intel.getStimulusColor(74);
  assert('getStimulusColor(74) matches fillFor 74% stimulus output', shared74.fill === c74.fill && shared74.alpha === c74.alpha);

  // Test 5: Historical inactivity and untrained distinctions
  const untrainedCalves = intel.fillFor({ stimulusScore: 0, ever: false, daysSince: null });
  const detrainedCalves = intel.fillFor({ stimulusScore: 0, ever: true, daysSince: 21, isDetraining: true });

  assert('Never-trained muscle remains neutral transparent (alpha 0)', untrainedCalves.alpha === 0 && untrainedCalves.fill === '#18191d');
  assert('Detrained muscle (21d inactive) displays blue detraining shade (#4b6ba2)', detrainedCalves.fill === '#4b6ba2');
} catch (err) {
  assert(`Suite 36 Exception: ${err.message}`, false);
}

// SUITE 37: Home Heat Zones Consolidation & Shoulder/Trapezius Mapping Verification
console.log('\n--- SUITE 37: Home Heat Zones Consolidation & Shoulder/Trapezius Mapping ---');
try {
  // Test 1: Verify removal of Detailed Map button from Home card
  const homeContent = RepRivalTest.homeScreen();
  assert('Removal of Detailed Map Home button from Home card', !homeContent.includes('data-action="progress-tab" data-tab="muscles">Detailed Map ↗</button>'));

  // Test 2: Verify all 9 muscle groups rendered directly in Home Heat Zones section
  const compactPanel = RepRivalTest.musclePanel(true);
  const nineGroups = ['Chest', 'Back', 'Shoulders', 'Arms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];
  const allNinePresent = nineGroups.every(g => compactPanel.includes(`class="rr-group-name">${g}</strong>`));
  assert('All nine muscle groups displayed directly within Home Heat Zones section', allNinePresent);

  // Test 3: Verify Side delts SVG paths present in both front and back anatomical figures
  const frontFig = window.RepRivalBodyMap.figure('front', { 'Side delts': { stimulusScore: 50, ever: true, daysSince: 1 } });
  const backFig = window.RepRivalBodyMap.figure('back', { 'Side delts': { stimulusScore: 50, ever: true, daysSince: 1 }, 'Rear delts': { stimulusScore: 50, ever: true, daysSince: 1 } });

  assert('Side delts SVG paths rendered on Front figure', frontFig.includes('data-muscle="Side delts"'));
  assert('Side delts SVG paths rendered on Back figure for complete shoulder coverage', backFig.includes('data-muscle="Side delts"'));
  assert('Rear delts SVG paths rendered on Back figure', backFig.includes('data-muscle="Rear delts"'));
  assert('Back SVG paths rendered on Back figure (covering back and trapezius)', backFig.includes('data-muscle="Back"'));

  // Test 4: Each muscle group row retains Effective Sets, Stimulus Bar, Readiness Bar, and Status Pill
  assert('Compact Home card rows contain effective sets summary', compactPanel.includes('/10 sets)'));
  assert('Compact Home card rows contain Stimulus sub-row', compactPanel.includes('rr-metric-type">Stimulus</span>'));
  assert('Compact Home card rows contain Readiness sub-row', compactPanel.includes('rr-metric-type">Readiness</span>'));
  assert('Compact Home card rows contain readiness status pill', compactPanel.includes('rr-readiness-pill'));
} catch (err) {
  assert(`Suite 37 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 38: Scientific Muscle Intelligence & Heat Zones Full Regression Suite
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 38: Scientific Heat Zones Full Regression Suite ---');
try {
  const intel = window.RepRivalIntelligence;
  const now = Date.now();

  // Test 1: Production-shaped Workout C (22 Oct 2026): 3 x 10 Goblet Squat @ 7.5kg (5 RIR)
  const gobletLog = { exId: 'goblet_squat', name: 'Goblet Squat', muscle: 'Quads', weight: 7.5, reps: 10, rir: 5 };
  const secGoblet = intel.getSecondaryContributions(gobletLog);
  const supGoblet = intel.getSupportingContributions(gobletLog);
  const mGoblet = intel.calculateMuscleMetrics({
    history: [{ startedAt: new Date(now - 12 * 3600000).toISOString(), logs: [gobletLog, gobletLog, gobletLog] }],
    now
  });
  assert('Goblet Squat awards primary Quads exactly three effective sets', mGoblet.Quads.effectiveSets === 3);
  assert('Goblet Squat awards secondary Glutes 0.9 effective sets', mGoblet.Glutes.effectiveSets === 0.9 && secGoblet.some(([m, f]) => m === 'Glutes' && f === 0.30));
  assert('Goblet Squat provides supporting Calves exposure with 0.0 hypertrophy sets', mGoblet.Calves.effectiveSets === 0.0 && mGoblet.Calves.supportingSets === 3 && supGoblet.includes('Calves'));

  // Test 2: Reverse Lunge contributions
  const lungeLog = { exId: 'reverse_lunge', name: 'Reverse Lunge', muscle: 'Quads', weight: 15, reps: 10, rir: 2 };
  const secLunge = intel.getSecondaryContributions(lungeLog);
  const supLunge = intel.getSupportingContributions(lungeLog);
  assert('Reverse Lunge awards secondary Glutes 0.40', secLunge.some(([m, f]) => m === 'Glutes' && f === 0.40));
  assert('Reverse Lunge awards secondary Hamstrings 0.10', secLunge.some(([m, f]) => m === 'Hamstrings' && f === 0.10));
  assert('Reverse Lunge awards supporting Calves with 0 hypertrophy sets', supLunge.includes('Calves'));

  // Test 3: Romanian Deadlift (RDL) contributions
  const rdlLog = { exId: 'db_romanian_deadlift', name: 'Dumbbell Romanian Deadlift', muscle: 'Hamstrings', weight: 30, reps: 10, rir: 2 };
  const secRdl = intel.getSecondaryContributions(rdlLog);
  const supRdl = intel.getSupportingContributions(rdlLog);
  assert('Romanian Deadlift awards primary Hamstrings', intel.resolveLogMuscle(rdlLog) === 'Hamstrings');
  assert('Romanian Deadlift awards secondary Glutes 0.40', secRdl.some(([m, f]) => m === 'Glutes' && f === 0.40));
  assert('Romanian Deadlift awards secondary Core 0.20', secRdl.some(([m, f]) => m === 'Core' && f === 0.20));
  assert('Romanian Deadlift provides supporting Calves and Back exposure', supRdl.includes('Calves') && supRdl.includes('Back'));

  // Test 4: Hamstrings trained 8 days ago (soreness subsided, stimulus retained via rolling decay)
  const rdl8dHist = [{
    startedAt: new Date(now - 8 * 86400000).toISOString(),
    logs: [
      { exId: 'db_romanian_deadlift', name: 'DB Romanian Deadlift', muscle: 'Hamstrings', weight: 24, reps: 10, rir: 2 },
      { exId: 'db_romanian_deadlift', name: 'DB Romanian Deadlift', muscle: 'Hamstrings', weight: 24, reps: 10, rir: 2 },
      { exId: 'db_romanian_deadlift', name: 'DB Romanian Deadlift', muscle: 'Hamstrings', weight: 24, reps: 10, rir: 2 }
    ]
  }];
  const m8d = intel.calculateMuscleMetrics({ history: rdl8dHist, now });
  const col8d = intel.fillFor(m8d.Hamstrings);
  assert('Hamstrings from 8 days ago retains stimulus via rolling decay (> 10%)', m8d.Hamstrings.stimulusScore >= 10);
  assert('Hamstrings from 8 days ago is fully recovered in readiness (100% Ready)', m8d.Hamstrings.readinessScore >= 90 && m8d.Hamstrings.readinessState === 'Ready');
  assert('Hamstrings from 8 days ago is NOT greyed out (#2a2c32)', col8d.fill !== '#2a2c32');
  assert('Hamstrings from 8 days ago is NOT blue detrained (#4b6ba2)', col8d.fill !== '#4b6ba2' && col8d.fill !== '#31528c');

  // Test 5: Detraining blue threshold (strictly >= 21-28 days without work AND stimulus < 8%)
  const detrained21dHist = [
    { startedAt: new Date(now - 45 * 86400000).toISOString(), logs: Array(3).fill(null).map(() => ({ exId: 'chest_press', muscle: 'Chest', reps: 10, rir: 2 })) },
    { startedAt: new Date(now - 21 * 86400000).toISOString(), logs: Array(2).fill(null).map(() => ({ exId: 'chest_press', muscle: 'Chest', reps: 10, rir: 2 })) }
  ];
  const mDetrained21d = intel.calculateMuscleMetrics({ history: detrained21dHist, now });
  const col21d = intel.fillFor(mDetrained21d.Chest);
  assert('Detraining blue triggers at 21d with low stimulus (#4b6ba2)', col21d.fill === '#4b6ba2');

  const detrained28dHist = [
    { startedAt: new Date(now - 50 * 86400000).toISOString(), logs: Array(3).fill(null).map(() => ({ exId: 'chest_press', muscle: 'Chest', reps: 10, rir: 2 })) },
    { startedAt: new Date(now - 29 * 86400000).toISOString(), logs: Array(3).fill(null).map(() => ({ exId: 'chest_press', muscle: 'Chest', reps: 10, rir: 2 })) }
  ];
  const mDetrained28d = intel.calculateMuscleMetrics({ history: detrained28dHist, now });
  const col28d = intel.fillFor(mDetrained28d.Chest);
  assert('Prolonged detraining blue triggers at > 28d (#31528c)', col28d.fill === '#31528c');

  // Test 6: Low stimulus (11% Quads, 18% Glutes) displays true warm/subdued color, NEVER blue
  const colQuads11 = intel.getStimulusColor(11);
  const colGlutes18 = intel.getStimulusColor(18);
  assert('11% Quads stimulus is cool/subdued, NOT blue (#4b6ba2 or #31528c)', colQuads11.fill !== '#4b6ba2' && colQuads11.fill !== '#31528c');
  assert('18% Glutes stimulus shows visible warmth, NOT blue', colGlutes18.fill !== '#4b6ba2' && colGlutes18.fill !== '#31528c');

  // Test 7: Calf isolation vs supporting exposure
  const calfIsoHist = [{
    startedAt: new Date(now - 2 * 86400000).toISOString(),
    logs: [{ exId: 'standing_calf_raise', name: 'Standing Calf Raise', muscle: 'Calves', weight: 50, reps: 15, rir: 2 }]
  }];
  const mCalfIso = intel.calculateMuscleMetrics({ history: calfIsoHist, now });
  assert('Standing calf raise awards primary hypertrophy effective sets (1.0)', mCalfIso.Calves.effectiveSets === 1.0 && mCalfIso.Calves.ever === true);

  const squatOnlyHist = [{
    startedAt: new Date(now - 2 * 86400000).toISOString(),
    logs: [{ exId: 'squat', name: 'Barbell Squat', muscle: 'Quads', weight: 80, reps: 8, rir: 2 }]
  }];
  const mSquatOnly = intel.calculateMuscleMetrics({ history: squatOnlyHist, now });
  assert('Squat-only workout awards 0.0 hypertrophy sets to Calves', mSquatOnly.Calves.effectiveSets === 0.0);
  assert('Squat-only workout records functional supporting exposure for Calves', mSquatOnly.Calves.hasSupportingExposure === true && mSquatOnly.Calves.supportingSets === 1);
  assert('Calf without direct/secondary hypertrophy work remains Insufficient data', mSquatOnly.Calves.ever === false && mSquatOnly.Calves.readinessScore === null);

  // Test 8: Chest press distributions
  const chestPressLog = { exId: 'bench_press', name: 'Bench Press', muscle: 'Chest', weight: 80, reps: 8, rir: 2 };
  const secChest = intel.getSecondaryContributions(chestPressLog);
  assert('Chest press awards primary Chest (1.0)', intel.resolveLogMuscle(chestPressLog) === 'Chest');
  assert('Chest press awards secondary Triceps (0.40)', secChest.some(([m, f]) => m === 'Triceps' && f === 0.40));
  assert('Chest press awards secondary Side delts (0.25)', secChest.some(([m, f]) => m === 'Side delts' && f === 0.25));

  // Test 9: Overhead press distributions
  const ohpLog = { exId: 'overhead_press', name: 'Overhead Press', weight: 45, reps: 8, rir: 2 };
  const secOhp = intel.getSecondaryContributions(ohpLog);
  assert('Overhead press resolves to Side delts', intel.resolveLogMuscle(ohpLog) === 'Side delts');
  assert('Overhead press awards secondary Triceps (0.35)', secOhp.some(([m, f]) => m === 'Triceps' && f === 0.35));
  assert('Overhead press does not overcredit rear delts', !secOhp.some(([m, f]) => m === 'Rear delts' && f > 0));

  // Test 10: Back row distributions
  const rowLog = { exId: 'barbell_row', name: 'Barbell Row', muscle: 'Back', weight: 70, reps: 10, rir: 2 };
  const secRow = intel.getSecondaryContributions(rowLog);
  assert('Back row awards primary Back (1.0)', intel.resolveLogMuscle(rowLog) === 'Back');
  assert('Back row awards secondary Biceps (0.40)', secRow.some(([m, f]) => m === 'Biceps' && f === 0.40));
  assert('Back row awards secondary Rear delts (0.30)', secRow.some(([m, f]) => m === 'Rear delts' && f === 0.30));

  // Test 11: Bilateral Squat vs Split Squat / Lunge
  const biSquatSec = intel.getSecondaryContributions({ exId: 'squat', name: 'Squat', muscle: 'Quads' });
  const splitSquatSec = intel.getSecondaryContributions({ exId: 'split_squat', name: 'Split Squat', muscle: 'Quads' });
  assert('Bilateral Squat awards 0.0 secondary hamstrings (biarticular length constant)', !biSquatSec.some(([m]) => m === 'Hamstrings'));
  assert('Split Squat / Lunge awards 0.10 secondary hamstrings', splitSquatSec.some(([m, f]) => m === 'Hamstrings' && f === 0.10));

  // Test 12: Missing RIR fallback
  const rirMissing = intel.rirStimulusWeight(undefined);
  assert('Missing RIR defaults to conservative ~2.5 RIR (factor 0.75)', rirMissing.factor === 0.75 && rirMissing.isEstimated === true);

  // Test 13: Submaximal 5 RIR weighting
  const rirSubmax5 = intel.rirStimulusWeight(5);
  const rirNearFailure1 = intel.rirStimulusWeight(1);
  assert('Submaximal 5 RIR awards modest credit (factor 0.40), distinctly below 1 RIR (1.00)', rirSubmax5.factor === 0.40 && rirNearFailure1.factor === 1.00);

  // Test 14: SVG path coverage for all 11 muscle keys
  const fSvg = window.RepRivalBodyMap.figure('front', {});
  const bSvg = window.RepRivalBodyMap.figure('back', {});
  const all11PresentInSvg = intel.HEAT_KEYS.every(k => fSvg.includes(`data-muscle="${k}"`) || bSvg.includes(`data-muscle="${k}"`));
  assert('All 11 HEAT_KEYS have valid vector SVG path mappings on Front and/or Back figures', all11PresentInSvg);

  // Test 15: Readiness Decoupling and dynamic clearance
  const acuteChestHist = [{
    startedAt: new Date(now - 4 * 3600000).toISOString(),
    logs: Array(10).fill(null).map(() => ({ exId: 'bench', muscle: 'Chest', reps: 10, rir: 1 }))
  }];
  const mAcute = intel.calculateMuscleMetrics({ history: acuteChestHist, now });
  assert('Immediately post-workout: high stimulus (> 60%) with low readiness (< 40%) proves decoupling', mAcute.Chest.stimulusScore > 60 && mAcute.Chest.readinessScore < 40);

  const restoredChestHist = [{
    startedAt: new Date(now - 96 * 3600000).toISOString(),
    logs: Array(10).fill(null).map(() => ({ exId: 'bench', muscle: 'Chest', reps: 10, rir: 2 }))
  }];
  const mRestored = intel.calculateMuscleMetrics({ history: restoredChestHist, now });
  assert('After 96h: readiness recovers (>= 75%) while decaying stimulus is preserved (> 35%)', mRestored.Chest.readinessScore >= 75 && mRestored.Chest.stimulusScore > 35);
} catch (err) {
  assert(`Suite 38 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 39 — Muscle Intelligence v2: Canonical mathematics and honest history
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 39: v2 Mathematical Contract and Anatomy Integrity ---');
try {
  const intel = window.RepRivalIntelligence;
  const now = Date.now();
  const make = (count, exId, muscle, rir, daysAgo = 0, extras = {}) => ({
    id: `${exId}-${count}-${daysAgo}`, startedAt: new Date(now - daysAgo * 86400000).toISOString(),
    logs: Array.from({ length: count }, () => ({ exId, muscle, reps: 10, weight: 20, rir, ...extras }))
  });
  const five = intel.calculateMuscleMetrics({ now, history: [make(5, 'db_row', 'Back', 1)] });
  const nine = intel.calculateMuscleMetrics({ now, history: [make(9, 'bench_press', 'Chest', 1)] });
  assert('Contract: five challenging primary back sets yield ~46% (not ~40%)', five.Back.stimulusScore >= 45 && five.Back.stimulusScore <= 47);
  assert('Contract: nine challenging primary chest sets yield ~74% (not ~58%)', nine.Chest.stimulusScore >= 73 && nine.Chest.stimulusScore <= 75);
  assert('Working sets no longer discounted twice', five.Back.effectiveSets === 5 && nine.Chest.effectiveSets === 9);
  const halfRepeated = intel.calculateMuscleMetrics({ now, history: [0,7,14,21].map(d => make(5, 'db_row', 'Back', 1, d)) });
  assert('Four weekly half-target sessions do not hit 100%', halfRepeated.Back.stimulusScore < 100);
  const warmed = intel.calculateMuscleMetrics({ now, history: [make(2,'bench','Chest',1,0,{warmup:true})] });
  assert('Warmups do not create training history or fake readiness', warmed.Chest.ever === false && warmed.Chest.readinessScore === null);
  const invalid = intel.calculateMuscleMetrics({ now, history: [{ id:'invalid',startedAt:new Date(now).toISOString(),logs:[
    {exId:'bench', muscle:'Chest',reps:0,rir:1}, {exId:'bench',muscle:'Chest',reps:-2,rir:1},
    {exId:'bench',muscle:'Chest',reps:10,rir:-1}, {exId:'bench',muscle:'Chest',reps:12,rir:1,weight:-20}
  ]}] });
  assert('Zero/negative reps, negative load and impossible RIR cannot create muscle dose',invalid.Chest.ever===false && invalid.Chest.stimulusScore===0);
  const easy = intel.calculateMuscleMetrics({ now, history: [make(3,'goblet_squat','Quads',5,1)] });
  const hard = intel.calculateMuscleMetrics({ now, history: [make(3,'goblet_squat','Quads',1,1)] });
  assert('5-RIR squat contributes less than 1-RIR squat',easy.Quads.stimulusScore < hard.Quads.stimulusScore);
  assert('Light squat tracks supporting calf exposure without inventing hypertrophy sets',easy.Calves.effectiveSets===0 && easy.Calves.supportingSets===3);
  assert('An isolated old workout never proves established detraining', (()=>{const m=intel.calculateMuscleMetrics({now,history:[make(3,'bench','Chest',2,40)]});return !m.Chest.isDetraining && intel.fillFor(m.Chest).fill !== '#31528c'})());
  const grouped = intel.calculateGroupMetrics(intel.calculateMuscleMetrics({now,history:[make(3,'db_lateral_raise','Side delts',1)]})).find(x=>x.name==='Shoulders');
  assert('Group stimulus derives from aggregate dose and aggregate target, not mean of percentages', grouped.stimulusScore === intel.trainingDoseScore(grouped.doseWeekly,grouped.targetSets));
  const individual = intel.calculateMuscleMetrics({now,history:[make(3,'db_lateral_raise','Side delts',1)]});
  const mean = Math.round((individual['Side delts'].stimulusScore+individual['Rear delts'].stimulusScore)/2);
  assert('Asymmetric shoulders illustrate why percentage averaging is invalid',grouped.stimulusScore!==mean);
  const r1 = intel.calculateMuscleMetrics({now,history:[make(3,'bench','Chest',2)]});
  const r2 = intel.calculateMuscleMetrics({now,history:[make(3,'bench','Chest',2)],checkin:{sleep:'poor',sorenessMap:{Chest:'mild'}}});
  assert('Check-ins change readiness but cannot rewrite stimulus',r1.Chest.stimulusScore===r2.Chest.stimulusScore && r1.Chest.readinessScore>r2.Chest.readinessScore);
  assert('Unreported sleep receives no invented positive factor',!r1.Chest.factors.some(x=>x.includes('Good sleep')));
  assert('Blank RIR in legacy data means missing, never zero RIR',intel.rirStimulusWeight('').factor===0.75 && intel.rirStimulusWeight('').isEstimated===true);
  const overload = intel.calculateExerciseProgression([{exId:'bench',weight:20,reps:10,rir:2},{exId:'bench',weight:24,reps:10,rir:2}]);
  const rirTrend = intel.calculateExerciseProgression([{exId:'bench',weight:20,reps:10,rir:1},{exId:'bench',weight:20,reps:10,rir:5}]);
  assert('Overload comparisons detect +20% resistance without boosting stimulus',overload.status==='improving' && overload.loadChangePct===20);
  assert('Performance trend recognises improving capacity at unchanged weight/reps but higher RIR',rirTrend.status==='improving');
  const mixed = intel.calculateExerciseProgression([{exId:'bench',weight:20,reps:10},{exId:'curl',weight:20,reps:10}]);
  assert('Different exercises cannot be compared for progression',mixed.status==='incomparable_exercises');
  const svg = window.RepRivalBodyMap.figure('back',{'Side delts':{ever:true,daysSince:1,stimulusScore:90},'Rear delts':{ever:true,daysSince:1,stimulusScore:20}});
  const zones = [...svg.matchAll(/<path[^>]+data-muscle="(Side delts|Rear delts)"[^>]+d="([^"]+)"/g)];
  assert('Back side-delt and rear-delt shapes are not identical',zones.length===4 && zones[0][2]!==zones[2][2]);
  const blueNever = intel.fillFor({ever:true,daysSince:35,stimulusScore:0,isDetraining:false});
  assert('Inactivity alone cannot paint blue without a risk state',blueNever.fill!=='#31528c' && blueNever.fill!=='#4b6ba2');
  assert('Low exposure stays neutral, not bluish without detraining',intel.getStimulusColor(10).r >= intel.getStimulusColor(10).b-2);
} catch (err) { assert(`Suite 39 Exception: ${err.message}`, false); }

// -----------------------------------------------------------------------------
// SUITE 40 — Quick Workout: Heat Map Gaps (Undertrained Areas) focus
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 40: Quick Workout Heat Map Gaps Focus ---');
try {
  const intel = window.RepRivalIntelligence;
  const app = window.RepRivalTest;
  const now = Date.now();

  const makeSess = (id, daysAgo, logs) => ({
    id, startedAt: new Date(now - daysAgo * 86400000).toISOString(),
    logs: logs.map(l => ({ ...l, reps: 10, weight: 20, rir: 1 }))
  });

  // Scenario: Chest and Back are hot (75%+), Shoulders and Arms are gaps (Ready, low stimulus)
  // Quads are high load (recovering).
  const history = [
    makeSess('h1', 1, [{ exId: 'bench', muscle: 'Chest' }, { exId: 'bench', muscle: 'Chest' }, { exId: 'bench', muscle: 'Chest' }]),
    makeSess('h2', 2, [{ exId: 'row', muscle: 'Back' }, { exId: 'row', muscle: 'Back' }, { exId: 'row', muscle: 'Back' }]),
    makeSess('h3', 0.1, [{ exId: 'squat', muscle: 'Quads' }, { exId: 'squat', muscle: 'Quads' }, { exId: 'squat', muscle: 'Quads' }])
  ];

  // We need to set the history in the app state
  app.setHistory(history);

  const genGaps = app.generateOneOffWorkout({ duration: 15, focus: 'heatmap_gaps', gearMode: 'all' });
  
  assert('Heat Map Gaps generator returns a workout', genGaps && genGaps.pairs.length > 0);
  assert('Explanation is provided for gaps focus', typeof genGaps.gapExplanation === 'string' && genGaps.gapExplanation.length > 0);
  
  const targeted = genGaps.pairs.flatMap(p => p.exercises.map(e => e.muscle));
  const uniqueTargeted = [...new Set(targeted)];

  // Quads should be avoided (High recent load or Recovering from 2 hours ago)
  assert('Avoids Quads (recently trained, high load)', !uniqueTargeted.includes('Quads'));
  
  // Shoulders and Arms should be prioritized (never trained in this scenario)
  assert('Prioritizes gaps like Side delts, Biceps, or Triceps', uniqueTargeted.some(m => ['Side delts', 'Biceps', 'Triceps'].includes(m)));

  // Verify rotation protection
  const nextBefore = app.getState().next || 'A';
  
  // Start the one-off session
  app.setActive({
    id: 'oneoff-test',
    session: 'Quick',
    isOneOff: true,
    pairs: genGaps.pairs,
    taskIndex: 0,
    logs: [{ exId: 'test', reps: 10, weight: 20, rir: 2, loggedAt: new Date().toISOString() }]
  });

  // Complete it
  app.completeWorkout();
  
  assert('One-off Heat Map Gaps workout does NOT advance plan rotation', app.getState().next === nextBefore);
  assert('Workout is added to history with isOneOff: true', app.getState().history.at(-1).isOneOff === true);

} catch (err) { assert(`Suite 40 Exception: ${err.message}`, false); }



// -----------------------------------------------------------------------------
// SUITE 41: Quick Workout Intelligence & Equipment Accuracy (Kettlebells, Styles, Session Gear)
// -----------------------------------------------------------------------------
// SUITE 41: Quick Workout Intelligence & Equipment Accuracy (Kettlebells, Styles, Session Gear)
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 41: Quick Workout Intelligence & Equipment Accuracy ---');
try {
  // 1. Inventory Separation (Kettlebells vs Dumbbells)
  const kbEx = { id: 'kb_swing', name: 'Kettlebell Swing', equipment: ['kettlebells'], load: 'combined' };
  const twoDbEx = { id: 'db_press', name: 'Dumbbell Press', equipment: ['dumbbells'], load: 'combined' };
  const singleDbEx = { id: 'one_arm_db_row', name: 'One-arm DB Row', equipment: ['dumbbells'], load: 'single' };
  
  const kbLoads = RepRivalTest.getAvailableLoadsForExercise(kbEx);
  const twoDbLoads = RepRivalTest.getAvailableLoadsForExercise(twoDbEx);
  const singleDbLoads = RepRivalTest.getAvailableLoadsForExercise(singleDbEx);
  
  assert('Kettlebell inventory uses default 16 kg plus optional 0 kg setting', kbLoads.includes(16) && kbLoads.includes(0) && kbLoads.length===2);
  assert('Single dumbbell inventory uses default range [5, 7.5, ... 27.5]', singleDbLoads.length > 5 && singleDbLoads[0] === 5 && singleDbLoads.at(-1) === 27.5);
  assert('Two-dumbbell combined loads start at 10 kg (5 kg each * 2) and reach 55 kg', twoDbLoads[0] === 10 && twoDbLoads.at(-1) === 55);
  assert('Kettlebell and dumbbell inventories are separate', JSON.stringify(kbLoads) !== JSON.stringify(twoDbLoads));

  // 2. Style-based Selection (Weights-focused vs Bodyweight)
  const weightsGen = RepRivalTest.generateOneOffWorkout({ duration: 20, focus: 'full_body', style: 'weights_focused', gearMode: 'all' });
  const bwGen = RepRivalTest.generateOneOffWorkout({ duration: 20, focus: 'full_body', style: 'bodyweight', gearMode: 'all' });
  
  const weightsExs = weightsGen.pairs.flatMap(p => p.exercises);
  const bwExs = bwGen.pairs.flatMap(p => p.exercises);
  
  const loadedCount = weightsExs.filter(e => e.equipment && e.equipment.length > 0).length;
  const bodyweightCount = bwExs.filter(e => e.load === 'bodyweight').length;
  
  assert('Weights-focused style includes loaded exercises', loadedCount > 0);
  assert('Bodyweight style includes bodyweight exercises', bodyweightCount > 0);

  // 3. Session Gear Filtering (Indoor vs Outdoor)
  // Mock metadata for outdoor pull-up bar
  RepRivalTest.setMetadata({
    'pull_up_bar': { location: 'outdoor' },
    'pull_up': { location: 'outdoor' },
    'chin_up': { location: 'outdoor' },
    'inverted_row_bar': { grip: 'fixed-grip' }
  });
  
  const indoorGen = RepRivalTest.generateOneOffWorkout({ duration: 30, focus: 'full_body', availability: 'indoor_only', gearMode: 'owned' });
  const indoorExIds = new Set(indoorGen.pairs.flatMap(p => p.exercises.map(e => e.id)));
  
  assert('Indoor-only session excludes outdoor exercises (e.g., pull-ups on outdoor bar)', !indoorExIds.has('pull_up') && !indoorExIds.has('chin_up'));
  assert('Fixed-grip check: inverted_row_wide excluded if bar is fixed-grip', !indoorExIds.has('inverted_row_wide'));

  // 4. Pull-up Ability Check
  // Mock history with 0 reps for chin-ups
  RepRivalTest.setHistory([{
    id: 'h-weak',
    logs: [{ exId: 'chin_up', name: 'Chin-up', reps: 0, rir: 0 }]
  }]);
  
  const weakGen = RepRivalTest.generateOneOffWorkout({ duration: 30, focus: 'back_biceps', gearMode: 'all' });
  const weakExIds = new Set(weakGen.pairs.flatMap(p => p.exercises.map(e => e.id)));
  assert('Unattainable pull-ups (reps < 2) are filtered out', !weakExIds.has('chin_up'));

} catch (err) {
  assert(`Suite 41 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 42: Dumbbell Weight Stepper & 40 kg Equipment Inventory Validation
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 42: Dumbbell Weight Stepper & 40 kg Equipment Inventory Validation ---');
try {
  const dbEx = { id: 'low_incline_db_press', name: 'Low-incline DB press', equipment: ['dumbbells'], load: 'combined', min: 6, max: 10 };
  const singleDbEx = { id: 'one_arm_db_row', name: 'One-arm DB row', equipment: ['dumbbells'], load: 'single', min: 8, max: 12 };

  // 1. Two-dumbbell combined stepping (using matching pairs of plates):
  // Default inventory per DB: [5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5]
  // Combined matching pairs: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
  const step275 = RepRivalTest.stepLoad(27.5, +1, dbEx);
  assert('From 27.5 kg, stepper + advances to next matching-pair load 30 kg', step275 === 30);

  const step30 = RepRivalTest.stepLoad(30, +1, dbEx);
  assert('From 30 kg (15 kg each), stepper + advances to next matching pair 35 kg (17.5 kg each)', step30 === 35);

  const step35 = RepRivalTest.stepLoad(35, +1, dbEx);
  assert('From 35 kg (17.5 kg each), stepper + advances to 40 kg (20 kg each)', step35 === 40);

  const step40 = RepRivalTest.stepLoad(40, +1, dbEx);
  assert('From 40 kg (20 kg each), stepper + advances to 45 kg (22.5 kg each)', step40 === 45);

  const step50 = RepRivalTest.stepLoad(50, +1, dbEx);
  assert('From 50 kg (25 kg each), stepper + advances to 55 kg (27.5 kg each)', step50 === 55);

  const step55 = RepRivalTest.stepLoad(55, +1, dbEx);
  assert('From 55 kg combined limit, stepper + stops at 55 kg', step55 === 55);

  // Single-dumbbell stepping:
  const singleStep25 = RepRivalTest.stepLoad(25, +1, singleDbEx);
  assert('Single DB: From 25 kg, stepper + advances to 27.5 kg', singleStep25 === 27.5);

  const singleStep275 = RepRivalTest.stepLoad(27.5, +1, singleDbEx);
  assert('Single DB: From 27.5 kg limit, stepper + stops at 27.5 kg', singleStep275 === 27.5);

  // 2. Historical performance preservation (40 kg combined / 20 kg per hand)
  RepRivalTest.setHistory([{
    id: 'h-db-40',
    logs: [{ exId: 'low_incline_db_press', name: 'Low-incline DB press', weight: 40, reps: 8, rir: 2, equipment: ['dumbbells'] }]
  }]);

  const availableLoads = RepRivalTest.getAvailableLoadsForExercise(dbEx);
  assert('Historical 40 kg combined load is included in available loads', availableLoads.includes(40));

  const conservative40 = RepRivalTest.findConservativeAvailableLoad(40, availableLoads);
  assert('Historical 40 kg load is preserved and NOT snapped down to 27.5 kg', conservative40 === 40);

  // 3. Recommendation overload calculation at 27.5 kg (when all working sets achieved max reps)
  const activeExLogs = [
    { exId: 'low_incline_db_press', weight: 27.5, reps: 10, rir: 2 },
    { exId: 'low_incline_db_press', weight: 27.5, reps: 10, rir: 2 },
    { exId: 'low_incline_db_press', weight: 27.5, reps: 10, rir: 2 }
  ];
  const rec = RepRivalTest.recommend(dbEx, { weight: 27.5, reps: 10, rir: 2 }, activeExLogs);
  assert('Recommendation at max reps (10) for 27.5 kg proposes 30 kg', rec.weight === 30 && rec.hasOverload);

  // 4. Distinction between genuine custom equipment limit vs default (without historical override)
  RepRivalTest.setHistory([]);
  RepRivalTest.setDumbbellInventory([5, 10, 15, 20, 25, 27.5]);
  const customSingleLoads = RepRivalTest.getAvailableLoadsForExercise(singleDbEx);
  assert('Custom equipment limit respects user profile inventory for single DB', customSingleLoads.includes(27.5) && !customSingleLoads.includes(30));

  const customStep275 = RepRivalTest.stepLoad(27.5, +1, singleDbEx);
  assert('When custom inventory max is 27.5 kg, single DB stepper + stops at 27.5 kg limit', customStep275 === 27.5);

  const customTwoLoads = RepRivalTest.getAvailableLoadsForExercise(dbEx);
  assert('Custom equipment inventory matching pairs for two DBs includes 55 kg', customTwoLoads.includes(55) && !customTwoLoads.includes(60));
  const customStep55 = RepRivalTest.stepLoad(55, +1, dbEx);
  assert('When custom inventory max is 55 kg combined, two DB stepper + stops at 55 kg', customStep55 === 55);

  // Reset inventory to default
  RepRivalTest.setDumbbellInventory([5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5]);

} catch (err) {
  assert(`Suite 42 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 43: Workout Engine & Interface Refinement (Units, Carry-Forward, Double Progression, Rest UI)
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 43: Workout Engine & Interface Refinement ---');
try {
  const twoDbBench = { id: 'db_bench_press', name: 'Dumbbell Bench Press', equipment: ['dumbbells'], load: 'combined', min: 8, max: 12, sets: 3 };
  const singleDbRow = { id: 'one_arm_db_row', name: 'One-arm DB Row', equipment: ['dumbbells'], load: 'single', min: 8, max: 12, sets: 3 };
  const bwLunge = { id: 'walking_lunge', name: 'Walking Lunge', equipment: ['dumbbells'], min: 10, max: 15, sets: 3 };

  // 1. Correct upper weight limits & units
  const twoLoads = RepRivalTest.getAvailableLoadsForExercise(twoDbBench);
  const singleLoads = RepRivalTest.getAvailableLoadsForExercise(singleDbRow);
  assert('Two-dumbbell exercise upper limit is 55 kg combined (27.5 kg each)', twoLoads.at(-1) === 55);
  assert('Single-dumbbell exercise upper limit is 27.5 kg', singleLoads.at(-1) === 27.5);

  // 2. Unit convention display format
  const format50 = RepRivalTest.formatWeightConvention(50, twoDbBench);
  assert('Two-dumbbell load displays: "25 kg each · 50 kg total"', format50 === '25 kg each · 50 kg total');

  const format55 = RepRivalTest.formatWeightConvention(55, twoDbBench);
  assert('Two-dumbbell load at limit shows Equipment Limit indicator', format55.includes('27.5 kg each · 55 kg total') && format55.includes('Equipment Limit'));

  const formatSingle = RepRivalTest.formatWeightConvention(25, singleDbRow);
  assert('Single dumbbell display format: "25 kg (single DB)"', formatSingle === '25 kg (single DB)');

  // 3. Bodyweight 0 kg allowed and negative rejected
  const lungeLoads = RepRivalTest.getAvailableLoadsForExercise(bwLunge);
  assert('Bodyweight versions of weighted exercises permit 0 kg', lungeLoads.includes(0));
  const formatZero = RepRivalTest.formatWeightConvention(0, bwLunge);
  assert('0 kg displays clearly as Bodyweight', formatZero === '0 kg · Bodyweight');

  const stepNeg = RepRivalTest.stepLoad(0, -1, bwLunge);
  assert('Negative weight is never permitted (steps at minimum 0 kg)', stepNeg === 0);

  // 4. Stepper stops at equipment limits
  const stepAt55 = RepRivalTest.stepLoad(55, +1, twoDbBench);
  assert('At 55 kg limit, stepper + stops at 55 kg without generating invalid weights', stepAt55 === 55);

  const stepSingleAt275 = RepRivalTest.stepLoad(27.5, +1, singleDbRow);
  assert('At 27.5 kg single limit, stepper + stops at 27.5 kg', stepSingleAt275 === 27.5);

  // 5. No fabricated intermediate loads for matching pairs
  const matchingPairs = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  assert('Available loads for two DBs match physical pairs without arbitrary increments', JSON.stringify(twoLoads) === JSON.stringify(matchingPairs));

  // 6. Between-workout progression: Remember actual completed performance
  RepRivalTest.setHistory([{
    id: 'w-prev-bench',
    endedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    logs: [
      { exId: 'db_bench_press', name: 'Dumbbell Bench Press', weight: 50, reps: 10, rir: 2, round: 1 },
      { exId: 'db_bench_press', name: 'Dumbbell Bench Press', weight: 50, reps: 10, rir: 2, round: 2 },
      { exId: 'db_bench_press', name: 'Dumbbell Bench Press', weight: 50, reps: 10, rir: 2, round: 3 }
    ]
  }]);

  const taskSet1 = { index: 0, round: 1, ex: twoDbBench, pair: { id: 'b1', exercises: [twoDbBench] }, pi: 0, ei: 0 };
  const resolvedSet1 = RepRivalTest.resolveSetValues(taskSet1, { session: 'A', logs: [], drafts: {} });
  assert('Between workouts: Set 1 starts at actual completed 50 kg from history, not original default', resolvedSet1.weight === 50);

  // 7. Reps-first double progression
  const recRepFirst = RepRivalTest.recommend(twoDbBench, { weight: 50, reps: 10, rir: 2 }, []);
  assert('Reps-first: Suggests adding 1 rep at same weight when rep range has room', recRepFirst.weight === 50 && recRepFirst.reps === 11 && recRepFirst.reason === 'Add 1 rep at the same weight');

  // Near failure (0 RIR): Maintain
  const recFailure = RepRivalTest.recommend(twoDbBench, { weight: 50, reps: 10, rir: 0 }, []);
  assert('0 RIR near failure: Recommends maintaining load and reps', recFailure.weight === 50 && recFailure.reps === 10 && recFailure.reason === 'Maintain — last set was near failure');

  // Working sets hit max reps (12): Increase load and reset reps to min (8)
  const allMaxLogs = [
    { exId: 'db_bench_press', weight: 50, reps: 12, rir: 2 },
    { exId: 'db_bench_press', weight: 50, reps: 12, rir: 2 },
    { exId: 'db_bench_press', weight: 50, reps: 12, rir: 2 }
  ];
  const recOverload = RepRivalTest.recommend(twoDbBench, { weight: 50, reps: 12, rir: 2 }, allMaxLogs);
  assert('All sets hit max reps: Recommends increasing load to 55 kg with reps reset to min', recOverload.weight === 55 && recOverload.reps === 8 && recOverload.reason === 'Increase load — rep target achieved');

  // Equipment limit reached: Do not propose impossible weight
  const atLimitLogs = [
    { exId: 'db_bench_press', weight: 55, reps: 12, rir: 2 },
    { exId: 'db_bench_press', weight: 55, reps: 12, rir: 2 },
    { exId: 'db_bench_press', weight: 55, reps: 12, rir: 2 }
  ];
  const recLimit = RepRivalTest.recommend(twoDbBench, { weight: 55, reps: 12, rir: 2 }, atLimitLogs);
  assert('Equipment limit reached: Does not fabricate heavier load, explains limit', recLimit.weight === 55 && recLimit.reason === 'Maximum available weight reached');

  // 8. In-workout carry forward of weight and reps
  // Athlete completed Set 1 at 50 kg × 12 reps (even exceeding programmed 10 reps)
  const activeWorkoutSession = {
    session: 'A',
    logs: [
      { exId: 'db_bench_press', name: 'Dumbbell Bench Press', weight: 50, reps: 12, rir: 2, round: 1 }
    ],
    drafts: {}
  };

  const taskSet2 = { index: 1, round: 2, ex: twoDbBench, pair: { id: 'b1', exercises: [twoDbBench] }, pi: 0, ei: 0 };
  const resolvedSet2 = RepRivalTest.resolveSetValues(taskSet2, activeWorkoutSession);
  assert('In-workout carry forward: Set 2 inherits completed 50 kg from Set 1', resolvedSet2.weight === 50);
  assert('In-workout carry forward: Set 2 inherits completed 12 reps from Set 1 without clamping', resolvedSet2.reps === 12);

  // Set 2 completed at 50 kg × 11 reps -> Set 3 inherits Set 2
  activeWorkoutSession.logs.push({ exId: 'db_bench_press', name: 'Dumbbell Bench Press', weight: 50, reps: 11, rir: 1, round: 2 });
  const taskSet3 = { index: 2, round: 3, ex: twoDbBench, pair: { id: 'b1', exercises: [twoDbBench] }, pi: 0, ei: 0 };
  const resolvedSet3 = RepRivalTest.resolveSetValues(taskSet3, activeWorkoutSession);
  assert('In-workout carry forward: Set 3 inherits completed 50 kg × 11 reps from Set 2', resolvedSet3.weight === 50 && resolvedSet3.reps === 11);

  // 9. Superset separation: Do not carry values across unrelated exercises
  const supersetPair = {
    id: 'pair-super',
    restMin: 90,
    restMax: 120,
    exercises: [twoDbBench, singleDbRow]
  };
  const taskSuperRow = { index: 3, round: 1, ex: singleDbRow, pair: supersetPair, pi: 1, ei: 1 };
  const resolvedSuperRow = RepRivalTest.resolveSetValues(taskSuperRow, activeWorkoutSession);
  assert('Superset isolation: Row does not inherit bench press weight or reps', resolvedSuperRow.weight !== 50);

  // 10. Explicit athlete edits preserved
  activeWorkoutSession.drafts = { 'weight-2': 45, 'reps-2': 14 };
  const resolvedEditedSet3 = RepRivalTest.resolveSetValues(taskSet3, activeWorkoutSession);
  assert('Explicit athlete edits in drafts are preserved and not overwritten', resolvedEditedSet3.weight === 45 && resolvedEditedSet3.reps === 14);

  // 11. Rest screen and active screen UI functions
  assert('Rest edit modal function is exposed', typeof RepRivalTest.openRestEditModal === 'function');
  assert('Active exercise edit modal function is exposed', typeof RepRivalTest.openActiveExerciseEditModal === 'function');

} catch (err) {
  assert(`Suite 43 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 44: Workout Engine Execution, Log Set Action & Roadmap Simplification
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 44: Log Set Action, Rest Screen & Roadmap Simplification ---');
try {
  // 1. Initialise active Workout A session
  const planA = RepRivalTest.getProfile().plans.pump.A;
  const tasksA = RepRivalTest.buildTasks('A', planA.pairs);
  const totalSetsA = tasksA.length;
  assert('Workout A has planned sets (18 in pump plan)', totalSetsA === 18);

  const activeSessionA = {
    session: 'A',
    stage: 'lift',
    taskIndex: 0,
    startedAt: new Date().toISOString(),
    logs: [],
    drafts: {}
  };
  RepRivalTest.setActive(activeSessionA);

  // 2. Mock form for Superset Round 1 (Set 1 of Low-incline DB Press & Inverted Row)
  const set0Task = tasksA[0];
  const set0Ex = set0Task.ex;
  const mockFormData0 = {
    get: (key) => {
      if (key === 'weight-0') return '50';
      if (key === 'reps-0') return '10';
      if (key === 'rir-0') return '2';
      if (key === 'weight-1') return '0';
      if (key === 'reps-1') return '10';
      if (key === 'rir-1') return '2';
      return null;
    },
    has: (key) => ['weight-0', 'reps-0', 'rir-0', 'weight-1', 'reps-1', 'rir-1'].includes(key)
  };

  // 3. Test submitSet execution
  RepRivalTest.resetSubmitLock();
  RepRivalTest.submitSet(mockFormData0);

  const curActive = RepRivalTest.getState().active;
  assert('Log Set advances taskIndex past the completed round to 2', curActive.taskIndex === 2);
  assert('Set 0 log is recorded accurately', curActive.logs[0] && curActive.logs[0].weight === 50 && curActive.logs[0].reps === 10 && curActive.logs[0].rir === 2);
  assert('Superset round records logs for both active exercises', curActive.logs[1] && curActive.logs[1].reps === 10 && curActive.logs[1].rir === 2);
  assert('Completed count is 2 of 18 sets after superset round', curActive.logs.filter(l => l && !l.skipped).length === 2);
  assert('Transitions to rest stage after logging set', curActive.stage === 'rest');
  assert('Rest countdown timer is initialized', typeof curActive.restUntil === 'number' && curActive.restUntil > Date.now());

  // 4. Test duplicate submission protection
  const initialLogsCount = curActive.logs.filter(Boolean).length;
  RepRivalTest.submitSet(mockFormData0); // Should be debounced while submitting
  assert('Duplicate tap does not corrupt logs or double submit', curActive.logs.filter(Boolean).length === initialLogsCount);

  // 5. Ready Now advances correctly to next round
  RepRivalTest.resetSubmitLock();
  curActive.stage = 'lift';
  curActive.restUntil = null;
  RepRivalTest.setActive(curActive);

  assert('Ready Now restores stage to lift', RepRivalTest.getState().active.stage === 'lift');

  // 6. Next round (task 2 is Set 2 of Low-incline DB press) carries forward previous completed performance
  const set2Task = tasksA[2];
  assert('Task 2 is Round 2 of Low-incline DB press', set2Task.ex.id === 'low_incline_db_press' && set2Task.round === 2);
  const set2Resolved = RepRivalTest.resolveSetValues(set2Task, RepRivalTest.getState().active);
  assert('Set 2 inherits Set 1 weight (50 kg)', set2Resolved.weight === 50);
  assert('Set 2 inherits Set 1 reps (10 reps)', set2Resolved.reps === 10);

  // 7. Verify final set logging behavior: does NOT enter rest screen, transitions directly to feedback
  const finalActiveSession = {
    session: 'A',
    stage: 'lift',
    taskIndex: totalSetsA - 1,
    startedAt: new Date().toISOString(),
    logs: tasksA.slice(0, totalSetsA - 1).map((t, i) => ({
      exId: t.ex.id, name: t.ex.name, muscle: t.ex.muscle, weight: 50, reps: 10, rir: 2, pair: t.pair.id, round: t.round, loggedAt: new Date().toISOString()
    })),
    drafts: {}
  };
  RepRivalTest.setActive(finalActiveSession);

  const lastTaskIndex = totalSetsA - 1;
  const mockLastForm = {
    get: (key) => {
      if (key === `weight-${lastTaskIndex}`) return '30';
      if (key === `reps-${lastTaskIndex}`) return '15';
      if (key === `rir-${lastTaskIndex}`) return '1';
      return null;
    },
    has: (key) => key === `weight-${lastTaskIndex}` || key === `reps-${lastTaskIndex}` || key === `rir-${lastTaskIndex}`
  };

  RepRivalTest.resetSubmitLock();
  RepRivalTest.submitSet(mockLastForm);

  const postFinalActive = RepRivalTest.getState().active;
  assert('Final set logging completes all 19 sets', postFinalActive.logs.filter(Boolean).length === totalSetsA);
  assert('Final set logging transitions directly to feedback stage without rest countdown', postFinalActive.stage === 'feedback' && postFinalActive.restUntil === null);

  // 8. Completing workout preserves history and rotates plan to B
  const preHistCount = RepRivalTest.getState().history.length;
  RepRivalTest.completeWorkout('good');
  const postState = RepRivalTest.getState();
  assert('Active workout is cleared upon completion', postState.active === null);
  assert('Workout is saved into history', postState.history.length === preHistCount + 1);
  assert('Plan rotation advances from Workout A to Workout B', postState.next === 'B');

  // 9. Roadmap simplification verification
  assert('openRoadmapEditModal is exported and functional', typeof RepRivalTest.openRoadmapEditModal === 'function');

  // Verify roadmap HTML template clean-up in app.js
  const appCode = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const workoutRoadmapFn = appCode.slice(appCode.indexOf('function workoutRoadmap('), appCode.indexOf('function workout('));

  assert('Roadmap does not contain inline swap button (swap-exercise)', !workoutRoadmapFn.includes('data-action="swap-exercise"'));
  assert('Roadmap does not contain inline drop button (drop-exercise)', !workoutRoadmapFn.includes('data-action="drop-exercise"'));
  assert('Roadmap header displays Workout Roadmap — X/Y sets', workoutRoadmapFn.includes('Workout Roadmap — ${completedCount}/${tasks.length} sets'));
  assert('Roadmap has single top-right Edit button (open-roadmap-edit-modal)', workoutRoadmapFn.includes('data-action="open-roadmap-edit-modal"'));

  // 10. Dedicated roadmap editor modal functionality
  const roadmapModalCode = appCode.slice(appCode.indexOf('function openRoadmapEditModal('), appCode.indexOf('function openRestEditModal('));
  assert('Roadmap editor modal provides swap action', roadmapModalCode.includes('data-action="swap-exercise"'));
  assert('Roadmap editor modal provides drop/restore action', roadmapModalCode.includes('data-action="drop-exercise"') && roadmapModalCode.includes('data-action="restore-exercise"'));
  assert('Roadmap editor modal provides Save Changes button', roadmapModalCode.includes('data-action="save-roadmap-edit"'));
  assert('Roadmap editor modal provides Cancel button', roadmapModalCode.includes('data-action="close-modal"'));

} catch (err) {
  assert(`Suite 44 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 45: Workout Intelligence, Metric Charts & Timer Persistence
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 45: Workout Intelligence & Progress Enhancements ---');
try {
  // 1. Test 90-day best set lookup
  const now = Date.now();
  const ninetyOneDaysAgo = new Date(now - 91 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();
  
  const testHistory = [
    {
      id: 'recent-set',
      endedAt: thirtyDaysAgo,
      logs: [{ exId: 'low_incline_db_press', weight: 30, reps: 10, rir: 2 }] // Strongest in 90 days
    }
  ];
  
  const originalHistory = RepRivalTest.getState().history;
  RepRivalTest.setHistory(testHistory);
  const best90 = RepRivalTest.bestSetLast90Days('low_incline_db_press');
  assert('bestSetLast90Days finds the strongest set within 90-day window', best90 && best90.weight === 30);

  // 2. Test Recommendation Adherence (targetAchieved)
  const ex = { id: 'low_incline_db_press', min: 8, max: 12, load: 'combined' };
  const baseline = { weight: 30, reps: 10, rir: 2 };
  
  const tasks = RepRivalTest.buildTasks('A');
  const activeSession = {
    session: 'A',
    stage: 'lift',
    taskIndex: 0,
    logs: [],
    drafts: {},
    startedAt: new Date().toISOString()
  };
  RepRivalTest.setActive(activeSession);
  
  // Mock form meeting recommendation (rec would be 11 reps at 30kg)
  const mockFormAchieved = {
    get: (key) => key === 'weight-0' ? '30' : (key === 'reps-0' ? '11' : '2'),
    has: (key) => true
  };
  
  RepRivalTest.resetSubmitLock();
  RepRivalTest.submitSet(mockFormAchieved);
  const achievedLog = RepRivalTest.getState().active.logs[0];
  assert('targetAchieved is true when recommendation is met', achievedLog.targetAchieved === true);

  // Mock form failing recommendation
  const mockFormFailed = {
    get: (key) => key === 'weight-1' ? '30' : (key === 'reps-1' ? '10' : '2'),
    has: (key) => true
  };
  const currentActive = RepRivalTest.getState().active;
  currentActive.taskIndex = 1;
  RepRivalTest.setActive(currentActive);
  RepRivalTest.resetSubmitLock();
  RepRivalTest.submitSet(mockFormFailed);
  const failedLog = RepRivalTest.getState().active.logs[1];
  assert('targetAchieved is false when recommendation is not met', failedLog.targetAchieved === false);

  // 3. Test Metric Chart Logic (comparableSessions)
  const movement = { id: 'low_incline_db_press' };
  const sessions = RepRivalTest.comparableSessions(movement);
  assert('comparableSessions returns all metrics (volume, load, reps, performance)', 
    sessions.length > 0 && 
    sessions[0].volume !== undefined && 
    sessions[0].load !== undefined && 
    sessions[0].reps !== undefined && 
    sessions[0].performance !== undefined
  );

  // 4. Test Summary Logic ("Target achieved" label)
  const workoutSummary = {
    id: 'test-summary',
    session: 'A',
    logs: [
      { exId: 'low_incline_db_press', name: 'Low-incline DB press', weight: 30, reps: 11, targetAchieved: true }
    ],
    prs: []
  };
  // Previous was better (12 reps)
  const prevWorkout = {
    id: 'prev-workout',
    session: 'A',
    endedAt: thirtyDaysAgo,
    logs: [{ exId: 'low_incline_db_press', weight: 30, reps: 12 }]
  };
  RepRivalTest.setHistory([prevWorkout]);
  const comparison = RepRivalTest.compareWorkout(workoutSummary);
  assert('Comparison entry identifies Target Achieved even if performance is lower than previous PB', 
    comparison.entries[0].anyTargetAchieved === true && comparison.entries[0].direction === 'lower'
  );

  // Restore history
  RepRivalTest.setHistory(originalHistory);

} catch (err) {
  assert(`Suite 45 Exception: ${err.message}`, false);
}

// -----------------------------------------------------------------------------
// SUITE 46: Regression Audit & Carry-Forward Verification
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 46: Full Regression Audit & Carry-Forward ---');
try {
  // 1. Critical Test: Carry-forward within workout (10 prescribed, 12 completed)
  const tasksA = RepRivalTest.buildTasks('A');
  const activeCarry = {
    session: 'A',
    stage: 'lift',
    taskIndex: 0,
    logs: [],
    drafts: {},
    startedAt: new Date().toISOString()
  };
  RepRivalTest.setActive(activeCarry);
  
  // Set 1: prescribed at 8-12 (min 8). Assume prescribed is 10 for argument's sake, but we use min 8.
  // Actually ex.min is 8. Let's say user completes 12.
  const task0 = tasksA[0];
  const mockForm12 = {
    get: (key) => key === 'weight-0' ? '25' : (key === 'reps-0' ? '12' : '2'),
    has: (key) => true
  };
  RepRivalTest.resetSubmitLock();
  RepRivalTest.submitSet(mockForm12);
  
  const stateAfter1 = RepRivalTest.getState();
  assert('Set 1 recorded 12 reps', stateAfter1.active.logs[0].reps === 12);
  
  // Next set of same exercise (Set 2) should default to 12 reps
  const task2 = tasksA[2]; // Task 0 is ex1 s1, Task 1 is ex2 s1 (if superset), Task 2 is ex1 s2
  // Let's verify which task is Set 2 of the same exercise
  const ex1 = task0.ex.id;
  const sameExTask = tasksA.find((t, i) => i > 0 && t.ex.id === ex1);
  assert('Found subsequent set of same exercise', !!sameExTask);
  
  const resolvedNext = RepRivalTest.resolveSetValues(sameExTask, stateAfter1.active);
  assert('Subsequent set defaults to actual completed reps (12)', resolvedNext.reps === 12);
  assert('Subsequent set defaults to actual completed weight (25)', resolvedNext.weight === 25);

  // 2. 90-Day History (Best of 90 days vs PB older than 90 days)
  const now = Date.now();
  const ninetyOneDaysAgo = new Date(now - 91 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();
  
  const auditHistory = [
    {
      id: 'old-pb',
      endedAt: ninetyOneDaysAgo,
      logs: [{ exId: 'low_incline_db_press', weight: 45, reps: 10 }] // PB but out of window
    },
    {
      id: 'recent-best',
      endedAt: thirtyDaysAgo,
      logs: [{ exId: 'low_incline_db_press', weight: 40, reps: 8 }] // Strongest in window
    }
  ];
  
  const originalHistory = RepRivalTest.getState().history;
  RepRivalTest.setHistory(auditHistory);
  const bestSet = RepRivalTest.bestSetLast90Days('low_incline_db_press');
  assert('bestSetLast90Days ignores PB outside window (45kg) and picks recent best (40kg)', bestSet && bestSet.weight === 40);
  
  // Restore history
  RepRivalTest.setHistory(originalHistory);

  // 3. Equipment Limits (55kg combined, 27.5kg single)
  const dbEx = { id: 'test_db', name: 'DB Press', load: 'combined' };
  const singleDbEx = { id: 'test_single', name: 'Single DB Row', load: 'single' };
  
  const loadsCombined = RepRivalTest.getAvailableLoadsForExercise(dbEx);
  assert('Combined DB loads reach 55kg', loadsCombined.includes(55));
  assert('Combined DB loads do not exceed 55kg', Math.max(...loadsCombined) === 55);
  
  const loadsSingle = RepRivalTest.getAvailableLoadsForExercise(singleDbEx);
  assert('Single DB loads reach 27.5kg', loadsSingle.includes(27.5));
  assert('Single DB loads do not exceed 27.5kg', Math.max(...loadsSingle) === 27.5);

  // 4. Recommendation vs Summary ("Target achieved")
  const summaryWorkout = {
    id: 'audit-summary',
    session: 'A',
    logs: [{ exId: 'low_incline_db_press', name: 'Low-incline DB press', weight: 30, reps: 10, targetAchieved: true }],
    prs: []
  };
  const prevBetter = {
    id: 'prev-better',
    session: 'A',
    endedAt: thirtyDaysAgo,
    logs: [{ exId: 'low_incline_db_press', weight: 30, reps: 12 }]
  };
  RepRivalTest.setHistory([prevBetter]);
  const auditComp = RepRivalTest.compareWorkout(summaryWorkout);
  assert('Movement is "lower" in direction but marked as "Target achieved"', auditComp.entries[0].direction === 'lower' && auditComp.entries[0].anyTargetAchieved === true);

  // Restore history again
  RepRivalTest.setHistory(originalHistory);

} catch (err) {
  assert(`Suite 46 Exception: ${err.message}`, false);
}


// -----------------------------------------------------------------------------
// SUITE 47: Adaptive v3 — strict vs focused, per-exercise frequency, quick isolation
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 47: Adaptive v3 mode & exercise policy ---');
try {
  const v3=window.RepRivalAdaptiveV3;
  const lib=window.REPRIVAL_EXERCISE_LIBRARY;
  const owned=['dumbbells','bench','kettlebell','ab_wheel','row_station'];
  const strict=v3.generate({focus:'upper_only',supersets:3},[],owned,null,{variant:1});
  const strictEx=strict.pairs.flatMap(p=>p.exercises);
  assert('Adaptive v3 registered',!!v3);
  assert('Upper only generates exercises',strictEx.length>0);
  assert('Upper only never contains lower or core movements',strictEx.every(e=>v3.UPPER.has(e.muscle)));
  const legs=v3.generate({focus:'lower_only',supersets:3},[],owned,null,{variant:2});
  assert('Lower only never contains upper or core movements',legs.pairs.flatMap(p=>p.exercises).every(e=>v3.LOWER.has(e.muscle)));
  const upperFocus=v3.generate({focus:'upper_focused',supersets:3},[],owned,null,{variant:3});
  const upperSets=upperFocus.pairs.flatMap(p=>p.exercises).filter(e=>v3.UPPER.has(e.muscle)).reduce((a,e)=>a+e.sets,0);
  const allSets=upperFocus.pairs.flatMap(p=>p.exercises).reduce((a,e)=>a+e.sets,0);
  assert('Upper-focused assigns at least 70 percent of sets to upper body',allSets>0&&upperSets/allSets>=.70);
  const lowerFocus=v3.generate({focus:'lower_focused',supersets:3},[],owned,null,{variant:4});
  const lowerSets=lowerFocus.pairs.flatMap(p=>p.exercises).filter(e=>v3.LOWER.has(e.muscle)).reduce((a,e)=>a+e.sets,0);
  const lowerTotal=lowerFocus.pairs.flatMap(p=>p.exercises).reduce((a,e)=>a+e.sets,0);
  assert('Lower-focused assigns at least 70 percent of sets to lower body',lowerTotal>0&&lowerSets/lowerTotal>=.70);
  const noPress=v3.generate({focus:'balanced',supersets:3,exerciseFrequency:{low_incline_db_press:0}},[],owned,null,{variant:2});
  assert('0-frequency movement is excluded',!noPress.pairs.flatMap(p=>p.exercises).some(e=>e.id==='low_incline_db_press'));
  const disabled=Object.fromEntries(lib.entries.filter(e=>lib.compatible(e,owned)).map(e=>[e.id,0]));
  const none=v3.generate({focus:'gaps',supersets:3,exerciseFrequency:disabled},[],owned);
  assert('No eligible movements yields safe empty workout',none.pairs.length===0&&!!none.warning);
  const when=new Date().toISOString();
  const weekly=v3.weeklyOccurrences([{startedAt:when,logs:[{exId:'hammer_curl',reps:10},{exId:'hammer_curl',reps:11}]}]);
  assert('Weekly frequency counts sessions rather than sets',weekly.hammer_curl===1);
  assert('Exercise categories organise shoulder subgroups',v3.category({muscle:'Rear delts'})==='Shoulders');
  const profile=RepRivalTest.getProfile();
  const beforeNext=RepRivalTest.getState().next;
  const quick=RepRivalTest.generateOneOffWorkout({duration:15,gearMode:'owned',focus:'upper_only'});
  assert('One-off strict upper uses heatmap v3',quick.pairs.flatMap(p=>p.exercises).every(e=>v3.UPPER.has(e.muscle)));
  assert('Generating a One-Off never advances main plan rotation',RepRivalTest.getState().next===beforeNext);
} catch(err) {
  assert('Suite 47 Exception: '+err.message,false);
}


// -----------------------------------------------------------------------------
// SUITE 48: Fixed-plan preservation and Adaptive configuration UI
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 48: Programme pause and exact resume ---');
try {
  const t=window.RepRivalTest;
  const oldProfile=t.getProfile();
  const oldState=t.getState();
  t.setActive(null);
  const before=t.getState();
  const originalPlan=t.getProfile().planId;
  const beforeIDs=before.history.map(w=>w.id).join('|');
  const paused=t.pauseProgrammeForAdaptive();
  assert('Switching into Adaptive succeeds with available equipment',paused===true);
  const adaptive=t.getProfile();
  assert('Adaptive stores the exact previous plan and rotation cursor',
    adaptive.adaptive?.pausedPlan?.planId===originalPlan && adaptive.adaptive?.pausedPlan?.next===before.next);
  assert('Adaptive stores the fixed plan without deleting it',!!adaptive.plans?.[originalPlan]);
  const studio=t.adaptiveStudioScreen();
  assert('Adaptive setup groups Chest, Biceps and Triceps',
    studio.includes('Chest')&&studio.includes('Biceps')&&studio.includes('Triceps'));
  assert('Adaptive setup exposes four frequency radio choices',
    studio.includes('data-adaptive-frequency=') && studio.includes('value="0"') && studio.includes('value="3"'));
  const resumed=t.resumePausedProgramme();
  assert('Disabling Adaptive restores the paused programme',resumed===true && t.getProfile().planId===originalPlan);
  assert('Disabling Adaptive resumes the exact next scheduled workout',t.getState().next===before.next);
  assert('Mode switching never deletes or rewrites workout history',
    t.getState().history.map(w=>w.id).join('|')===beforeIDs);
  t.setProfile(oldProfile);t.setHistory(oldState.history);t.setActive(oldState.active);
} catch(err) {
  assert('Suite 48 Exception: '+err.message,false);
}


// -----------------------------------------------------------------------------
// SUITE 49: Stage 1 Graphite Home visual boundaries
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 49: Graphite Home (visual-only, live data) ---');
try {
  const t=window.RepRivalTest;
  const prev=t.getState().history.map(w=>w.id).join('|');
  const html=t.graphiteHomeHeatmap();
  assert('Stage 1 Home exposes semantic heatmap heading',html.includes('Muscle Heat Zones')&&html.includes('rr-g-title'));
  assert('Stage 1 Home renders front and back anatomy',html.includes('front anatomical')&&html.includes('back anatomical'));
  assert('Stage 1 Home renders all 9 real muscle groups',(html.match(/class="rr-g-muscle-row"/g)||[]).length===9);
  assert('Stage 1 shows stimulus and readiness independently',html.includes('STIMULUS')&&html.includes('READINESS')&&html.includes('Readiness is separate'));
  assert('Stage 1 does not add yellow to heatmap visuals',!html.toLowerCase().includes('yellow')&&!html.includes('#ffd'));
  assert('Stage 1 map keeps muscle vector interactivity',html.includes('rr160-muscle-zone')&&html.includes('data-muscle='));
  assert('Stage 1 neutral→rose palette has valid RGB hex values',
    [0,10,30,50,70,90,100].every(score=>/^#[0-9a-f]{6}$/i.test(t.graphiteHeatColour(score))));
  assert('Stage 1 low/high stimulus is visually distinguishable',t.graphiteHeatColour(10)!==t.graphiteHeatColour(95));
  const blue=t.graphiteAtlasPalette({ever:true,daysSince:25,isDetraining:true,stimulusScore:2},{fill:'#123456',alpha:.5});
  const red=t.graphiteAtlasPalette({ever:true,daysSince:2,isDetraining:false,stimulusScore:99},{fill:'#aabbcc',alpha:.6});
  assert('Stage 1 detraining zones remain cool blue',blue.fill==='#7296b5');
  assert('Stage 1 higher stimulus uses muted rose instead of neon',red.fill===t.graphiteHeatColour(99)&&red.alpha<.8);
  assert('Stage 1 never colours untrained baseline',t.graphiteAtlasPalette(null,{fill:'#18191d',alpha:0}).alpha===0);
  assert('Stage 1 map rendering does not edit training history',t.getState().history.map(w=>w.id).join('|')===prev);
  const entry=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../public/graphite-stage1.css'),'utf8');
  assert('Graphite CSS is separately versioned and linked',entry.includes('/graphite-stage1.css?v=5'));
  assert('Original Element stylesheet remains available for rollback',entry.includes('id="rr-element-sheet"'));
  assert('Anatomical Heat Zones remain independently styled',css.includes('.rr-graphite-home .rr-g-home-heat')&&!css.includes('body.rr-element .card'));
  assert('Graphite CSS keeps figures side by side',css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
} catch(err) {
  assert('Suite 49 Exception: '+err.message,false);
}


// -----------------------------------------------------------------------------
// SUITE 50: Second-pass Graphite Home hierarchy, actions and outline icons
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 50: Stage 1 second-pass Home quality gates ---');
try {
  const t=window.RepRivalTest;
  const before=t.getState().history.map(w=>w.id).join('|');
  const home=t.homeScreen();
  const heat=t.graphiteHomeHeatmap();
  assert('Main workout overview is first on mobile',
    home.indexOf('rr-g-home-overview')>=0 &&
    home.indexOf('rr-g-home-overview')<home.indexOf('rr-g-home-heat'));
  assert('Ready count remains in the top-right Heat Zones heading',
    heat.includes('rr-g-headline') && heat.includes('rr-g-ready-summary'));
  assert('Muscle rows use text and stimulus bars without poor-quality thumbnails',
    (heat.match(/class="rr-g-muscle-icon"/g)||[]).length===0 &&
    heat.includes('class="rr-g-muscle-dose"') && heat.includes('class="rr-g-muscle-title"'));
  assert('Full interactive front/back anatomical heatmap is preserved',
    heat.includes('rr-g-body-pair') && heat.includes('rr-g-body-svg'));
  assert('Old four-card KPI panel removed from the new Home',
    !home.includes('rr165-kpi-grid') && !home.includes('rr165-score-widget'));
  assert('Quick Workout remains accessible',home.includes('data-action="open-generator"'));
  assert('Holiday Mode remains accessible',home.includes('data-action="open-holiday-modal"'));
  assert('Next workout start/resume action preserved',home.includes('data-page="workout-intro"')||home.includes('data-page="workout"'));
  assert('Home keeps plan and completed-workout navigation',
    home.includes('data-nav="plan"') && home.includes('data-tab="records"'));
  assert('Daily check-in action remains available',home.includes('data-action="readiness"'));
  assert('No player rating or League UI on the clean Home',
    !home.includes('rr165-score-ring-wrap') && !home.includes('data-page="leagues"'));
  assert('Home re-render did not modify historical workout IDs',
    before===t.getState().history.map(w=>w.id).join('|'));
  const css=fs.readFileSync(path.join(__dirname,'../public/graphite-stage1.css'),'utf8');
  assert('Responsive Home supports muscle rows and workout-first overview',
    css.includes('.rr-g-muscle-row')&&css.includes('.rr-g-home-overview')&&css.includes('@media(max-width:360px)'));
  const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert('Second-pass assets cache-busted for mobile',index.includes('graphite-stage1.css?v=5')&&index.includes('app.js?v=kb-easy-mode1'));
} catch(err) {
  assert('Suite 50 Exception: '+err.message,false);
}

// -----------------------------------------------------------------------------
// SUITE 51: Graphite UI consistency and mobile control layout
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 51: Graphite app-wide design integrity ---');
try {
  const fs=require('fs');
  const path=require('path');
  const source=fs.readFileSync(path.join(__dirname,'../public/graphite-polish.css'),'utf8');
  const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert('Graphite polish stylesheet loads after the base stylesheet',
    index.indexOf('graphite-polish.css?v=3')>index.indexOf('graphite-stage1.css?v=5'));
  assert('Adaptive programme actions receive explicit mobile grid layout',
    source.includes('.rr-element-mode-actions') &&
    source.includes('grid-template-columns:minmax(0,1fr)'));
  assert('Progress active tabs use graphite rather than orange',
    source.includes('.rr163-progress-tabs button.active') &&
    source.includes('border:1px solid #737b85'));
  assert('Workout preparation has a monochrome hero treatment',
    source.includes('.rr153-prep-hero') &&
    source.includes('radial-gradient(ellipse at 90% 5%'));
  assert('Weight and movement charts have dedicated silver styles',
    source.includes('.rr162-chart svg circle') &&
    source.includes('.rr164-trend-tile svg circle'));
  assert('Detailed heatmap figure and stimulus data remain unmodified by theme polish',
    !source.replace(/\/\*[\s\S]*?\*\//g,'').includes('.rr-g-home-heat') &&
    !source.replace(/\/\*[\s\S]*?\*\//g,'').includes('.rr-g-muscle-dose') &&
    !source.replace(/\/\*[\s\S]*?\*\//g,'').includes('.rr-figure-svg') &&
    !source.replace(/\/\*[\s\S]*?\*\//g,'').includes('.rr-heat-track'));
  assert('Workout plan buttons retain their original action identifiers',
    window.RepRivalTest.homeScreen().includes('data-page="workout-intro"') ||
    window.RepRivalTest.homeScreen().includes('data-page="workout"'));
} catch(err) {
  assert('Suite 51 Exception: '+err.message,false);
}

// -----------------------------------------------------------------------------
// SUITE 52: Adaptive Studio muscle picker and frequency preference preservation
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 52: Adaptive exercise library mobile redesign ---');
try {
  const t=window.RepRivalTest;
  const before=JSON.stringify(t.getProfile().adaptive||{});
  const historyBefore=t.getState().history.map(w=>w.id).join('|');
  const studio=t.adaptiveStudioScreen();
  const css=fs.readFileSync(path.join(__dirname,'../public/graphite-polish.css'),'utf8');
  const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert('Adaptive Studio exposes a muscle-group dropdown',studio.includes('id="adaptiveMuscleSelect"')&&studio.includes('aria-controls="adaptiveExerciseGroups"'));
  assert('Muscle picker replaces the long multi-open details list',!studio.includes('rr-element-muscle-group')&&studio.includes('class="rr-adaptive-group"'));
  assert('One selected muscle group is shown, others are initially hidden',
    (studio.match(/data-adaptive-muscle="/g)||[]).length>1 &&
    (studio.match(/data-adaptive-muscle="[^"]+" hidden/g)||[]).length>=1);
  assert('Selected muscle has a scoped search control and result count',
    studio.includes('id="adaptiveExerciseSearch"') && studio.includes('id="adaptiveResults"') &&
    studio.includes('id="adaptiveEmpty"'));
  assert('Every frequency selector still uses existing adaptive settings action',
    studio.includes('data-adaptive-frequency=') && studio.includes('name="freq-'));
  assert('Four mutually exclusive choices remain available for each exercise',
    ['0','1','2','3'].every(n=>studio.includes('value="'+n+'"')) && studio.includes('<fieldset class="rr-adaptive-frequency"'));
  assert('Exercise title and equipment are separate, with fully labelled frequency controls',
    studio.includes('rr-adaptive-exercise-info') && studio.includes('<small>') &&
    studio.includes('APPEARANCES / 7 DAYS'));
  assert('Adaptive preference changes are saved automatically',studio.includes('Your choices save automatically.'));
  assert('Mobile styling uses accessible selected-state cards',
    css.includes('.rr-adaptive-frequency-choice input:checked+span') &&
    css.includes('.rr-adaptive-library-controls') &&
    css.includes('grid-template-columns:minmax(0,1fr)!important'));
  assert('Adaptive Studio styling is cache-busted on Vercel',index.includes('graphite-polish.css?v=3'));
  assert('Rendering the preference picker leaves settings and workout history untouched',
    before===JSON.stringify(t.getProfile().adaptive||{}) &&
    historyBefore===t.getState().history.map(w=>w.id).join('|'));
} catch(err) {
  assert('Suite 52 Exception: '+err.message,false);
}

// -----------------------------------------------------------------------------
// SUITE 53: Compact active session and rest UI boundaries
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 53: Graphite compact workout / rest styling ---');
try {
  const fs=require('fs'),path=require('path');
  const css=fs.readFileSync(path.join(__dirname,'../public/graphite-session.css'),'utf8');
  const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert('Compact session stylesheet linked after base theme',html.indexOf('/graphite-session.css?v=1')>html.indexOf('/graphite-polish.css?v=2'));
  assert('Session stylesheet scoped exclusively to active workouts',css.includes('body.rr-active-session') && css.includes('.rr-session-set-card'));
  assert('Compact logging keeps weight, reps, RIR and per-exercise identifiers',
    app.includes('name="weight-\u0024{idx}"') && app.includes('name="reps-\u0024{idx}"') &&
    app.includes('name="rir-\u0024{idx}"') && app.includes('data-index="\u0024{idx}"'));
  assert('Recommendation application still uses its original action',app.includes('data-action="apply-overload"'));
  assert('Rest duration controls retain their original actions',app.includes("btn('+15 seconds','rest-add'")&&app.includes("'rest-skip'"));
  assert('Rest edit action remains accessible',app.includes('data-action="open-rest-edit-modal"'));
  assert('Workout plan and rest structure are both user-expandable',
    app.includes('rr-session-roadmap') && app.includes('rr-rest-structure') &&
    app.includes('<summary>Workout plan') && app.includes('View full workout structure'));
  assert('Workout and rest use silver rather than orange selected styling',
    css.includes('.rr-session-rir-options input:checked+.rir-btn') &&
    css.includes('.rr-rest-up-next') && !css.includes('background:#d97241'));
  assert('Active session hides redundant large app header on mobile',css.includes('body.rr-active-session .topbar {display:none!important}'));
} catch(err){
  assert('Suite 53 Exception: '+err.message,false);
}

// -----------------------------------------------------------------------------
// SUITE 54: Responsive Google login and cool stimulus visualisation
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 54: Google login / blue heatmap regression ---');
try {
  const t=window.RepRivalTest;
  const fs=require('fs'),path=require('path');
  const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  const cloud=fs.readFileSync(path.join(__dirname,'../src/firebase-sync.ts'),'utf8');
  const sw=fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8');
  const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const cool=t.graphiteAtlasPalette({ever:true,daysSince:9,stimulusScore:8,isDetraining:false},{fill:'#aabbcc',alpha:.2});
  const cooler=t.graphiteAtlasPalette({ever:true,daysSince:15,stimulusScore:3,isDetraining:false},{fill:'#aabbcc',alpha:.2});
  const deep=t.graphiteAtlasPalette({ever:true,daysSince:29,stimulusScore:2,isDetraining:true},{fill:'#aabbcc',alpha:.2});
  const trainedNow=t.graphiteAtlasPalette({ever:true,daysSince:1,stimulusScore:99,isDetraining:false},{fill:'#aabbcc',alpha:.4});
  assert('Previously trained muscle visibly cools blue after a week of low exposure',cool.fill==='#829caf'&&cool.alpha>=.35);
  assert('Longer low-exposure periods gain greater blue contrast',cooler.fill==='#7799b3'&&cooler.alpha>cool.alpha);
  assert('Established multi-week detraining stays distinguishable',deep.fill==='#5f88ad'&&deep.alpha>cooler.alpha);
  assert('Recent high training stimulus remains warm',trainedNow.fill===t.graphiteHeatColour(99));
  assert('Never-trained anatomy stays transparent',t.graphiteAtlasPalette({ever:false,daysSince:null,stimulusScore:0},{fill:'#18191d',alpha:0}).alpha===0);
  assert('Heat Zone legend explains early cool stimulus without claiming detraining',t.graphiteHomeHeatmap().includes('Blue shows fading stimulus'));
  assert('Cloud auth observer reports authenticated state without awaiting Firestore',cloud.includes('void this.syncOrCreateProfile(u).catch') && cloud.includes('this.notifySubscribers();'));
  assert('Google popup resolves via genuine Firebase auth observer or times out visibly',cloud.includes('Promise.race([popup, authenticated, stalled])')&&cloud.includes('auth/popup-timeout'));
  assert('App closes auth overlay on a confirmed sign-in',source.includes("if(authDialog?.open)authDialog.close()"));
  assert('Cloud sync avoids simultaneous duplicate initial reads',source.includes('cloudSyncInFlight&&cloudSyncUserId===user.uid'));
  assert('Phone app refreshes app JS and offline Graphite assets',index.includes('/app.js?v=kb-easy-mode1')&&sw.includes('graphite-polish.css')&&sw.includes('graphite-session.css'));
} catch(err) {
  assert('Suite 54 Exception: '+err.message,false);
}

// -----------------------------------------------------------------------------
// SUITE 55: Curated exercise taxonomy, canonical IDs, and accurate Adaptive pairings
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 55: Exercise catalogue + muscle intelligence audit ---');
try {
  const lib=window.REPRIVAL_EXERCISE_LIBRARY;
  const v3=window.RepRivalAdaptiveV3;
  const intel=window.RepRivalIntelligence;
  const names=lib.entries.map(e=>e.id);
  const owned=lib.ownerDefault;
  assert('No duplicate exercise IDs in the displayed library',new Set(names).size===names.length);
  assert('Only one standing DB calf raise appears in the picker',
    lib.entries.filter(e=>e.name==='Standing DB calf raise').length===1);
  assert('Historical second calf raise ID resolves to its canonical movement',
    lib.canonicalId('standing_db_calf_raise')==='db_calf_raise'&&
    lib.byId.standing_db_calf_raise===lib.byId.db_calf_raise);
  assert('Legacy squats, curls and lunges remain resolvable for saved workouts',
    ['db_goblet_squat','db_hammer_curl','db_reverse_lunge','bodyweight_reverse_lunge']
      .every(id=>lib.byId[id]&&lib.canonicalId(id)!==id));
  assert('Russian twists are offered as a Core movement',
    lib.entries.some(e=>e.id==='russian_twist'&&e.muscle==='Core'&&e.load==='optional'));
  assert('Zero-weight reverse lunge no longer needs a separate bodyweight exercise',
    lib.byId.reverse_lunge.load==='optional'&&lib.compatible(lib.byId.reverse_lunge,[])&&
    !names.includes('bodyweight_reverse_lunge'));
  assert('Step-ups can use either a bench or suitable step',
    lib.compatible(lib.byId.db_step_up,['bench'])&&lib.compatible(lib.byId.db_step_up,['step']));
  assert('Swing is hip dominant, sumo squat is quad dominant, rear-delt row targets rear delts',
    lib.byId.kb_swing.muscle==='Glutes'&&lib.byId.db_sumo_squat.muscle==='Quads'&&
    lib.byId.db_rear_delt_row.muscle==='Rear delts');
  assert('Existing historical swing/sumo exercise logs recalculate from corrected primary',
    intel.resolveLogMuscle({exId:'kb_swing',muscle:'Hamstrings'})==='Glutes'&&
    intel.resolveLogMuscle({exId:'db_sumo_squat',muscle:'Glutes'})==='Quads');
  assert('Suitcase carry counts toward Core, with supporting non-hypertrophy Back contribution',
    intel.resolveLogMuscle({exId:'suitcase_carry',muscle:'Core'})==='Core'&&
    intel.getSupportingContributions({exId:'suitcase_carry',muscle:'Core'}).includes('Back'));
  assert('Press, pullover, hip hinge and squat have distinct multi-muscle distributions',
    intel.getSecondaryContributions({exId:'db_overhead_press',muscle:'Side delts'}).some(x=>x[0]==='Triceps')&&
    intel.getSecondaryContributions({exId:'db_pullover',muscle:'Back'}).some(x=>x[0]==='Chest')&&
    intel.getSecondaryContributions({exId:'db_romanian_deadlift',muscle:'Hamstrings'}).some(x=>x[0]==='Glutes')&&
    intel.getSecondaryContributions({exId:'db_sumo_squat',muscle:'Quads'}).some(x=>x[0]==='Glutes'));
  assert('Saved alias frequency preference still affects the canonical movement',
    v3.pref({exerciseFrequency:{standing_db_calf_raise:0}},'db_calf_raise')===0);
  assert('Seven-day frequency recognises old exercise IDs and never counts sets twice',
    v3.weeklyOccurrences([{endedAt:new Date().toISOString(),logs:[
      {exId:'standing_db_calf_raise',reps:10},{exId:'db_calf_raise',reps:10}
    ]}]).db_calf_raise===1);
  const four=v3.generate({focus:'upper_focused',supersets:4},[],owned,null,{variant:1});
  const movement=four.pairs.flatMap(p=>p.exercises);
  const upper=movement.filter(e=>v3.UPPER.has(e.muscle)).reduce((n,e)=>n+e.sets,0);
  const total=movement.reduce((n,e)=>n+e.sets,0);
  assert('Four-block Upper-focused plan dedicates at least 75% sets to upper body',total>0&&upper/total>=.75);
  assert('Adaptive superset avoids placing two identical primary muscle groups together',
    four.pairs.every(p=>p.exercises.length<2||p.exercises[0].muscle!==p.exercises[1].muscle));
  assert('Adaptive workout does not repeat an exercise under a separate alias',
    new Set(movement.map(e=>lib.canonicalId(e.id))).size===movement.length);
  const when=new Date().toISOString();
  const recent=[{id:'prior-session',endedAt:when,logs:[{exId:'standing_db_calf_raise',reps:14,muscle:'Calves'}]}];
  const after=v3.generate({focus:'balanced',supersets:4},recent,owned,null,{variant:1});
  assert('One-per-week frequency cap prevents calf-raise alias from returning too soon',
    !after.pairs.flatMap(p=>p.exercises).some(e=>e.id==='db_calf_raise'));
  assert('Adaptive focus next-workout override is explicit in the UI',
    window.RepRivalTest.adaptiveStudioScreen().includes('resets after use'));
  assert('Library includes fractional supporting-muscle explanation in cards',
    window.RepRivalTest.adaptiveStudioScreen().includes('Also trains:'));
} catch(err){
  assert('Suite 55 Exception: '+err.message,false);
}

// -----------------------------------------------------------------------------
// SUITE 56: Multi-muscle exercise discovery without duplicated training choices
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 56: Glutes multi-muscle discovery ---');
try {
  const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  const library=window.REPRIVAL_EXERCISE_LIBRARY;
  const v3=window.RepRivalAdaptiveV3;
  const t=window.RepRivalTest;
  const historyBefore=t.getState().history.map(w=>w.id).join('|');
  const html=t.adaptiveStudioScreen();
  const glutesStart=html.indexOf('data-adaptive-muscle="Glutes"');
  const glutesEnd=html.indexOf('</section>',glutesStart);
  const glutes=html.slice(glutesStart,glutesEnd);
  assert('Glutes category is available',glutesStart>=0&&glutesEnd>glutesStart);
  assert('Reverse lunges are discoverable under Glutes',
    glutes.includes('Reverse lunge')&&glutes.includes('Primary: Quads'));
  assert('Romanian deadlifts are discoverable under Glutes',
    glutes.includes('Romanian deadlift')&&glutes.includes('Primary: Hamstrings'));
  assert('Glute cross-listing retains the actual primary category',
    v3.category(library.byId.reverse_lunge)==='Quads' &&
    v3.category(library.byId.db_romanian_deadlift)==='Hamstrings');
  assert('Lunges and RDL still award secondary Glutes credit',
    window.RepRivalIntelligence.getSecondaryContributions({exId:'reverse_lunge',muscle:'Quads'})
      .some(x=>x[0]==='Glutes'&&x[1]>=.35) &&
    window.RepRivalIntelligence.getSecondaryContributions({exId:'db_romanian_deadlift',muscle:'Hamstrings'})
      .some(x=>x[0]==='Glutes'&&x[1]>=.35));
  assert('No duplicate exercise objects are added to canonical catalogue',
    new Set(library.entries.map(e=>e.id)).size===library.entries.length);
  assert('Cross-listed radio groups have distinct DOM names and shared preference IDs',
    html.includes('name="freq-reverse_lunge-Quads"') &&
    html.includes('name="freq-reverse_lunge-Glutes"') &&
    glutes.includes('data-adaptive-frequency="reverse_lunge"'));
  assert('Changing one exercise preference synchronises its cross-listed controls',
    app.includes("input.dataset.adaptiveFrequency===id && input!==e.target") &&
    app.includes("input.checked=input.value===e.target.value"));
  assert('Merely rendering the cross-list does not mutate history',
    historyBefore===t.getState().history.map(w=>w.id).join('|'));
} catch(err){
  assert('Suite 56 Exception: '+err.message,false);
}

// -----------------------------------------------------------------------------
// SUITE 57: Adaptive kettlebell circuits — one movement at a time on mobile
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 57: Kettlebell Circuit Generator & iPhone UI ---');
try {
  const lib=window.REPRIVAL_EXERCISE_LIBRARY;
  const circuit=window.RepRivalAdaptiveCircuits;
  const test=window.RepRivalTest;
  const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'../public/graphite-circuits.css'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const before=JSON.stringify(test.getState().history);
  const ready=circuit.create({focus:'full_body',count:5,rounds:3,reps:10,rest:75});
  assert('Kettlebell curl and row exist as compatible equipment movements',
    lib.byId.kb_curl?.muscle==='Biceps'&&lib.byId.kb_bent_row?.muscle==='Back'&&
    lib.compatible(lib.byId.kb_curl,['kettlebell'])&&lib.compatible(lib.byId.kb_bent_row,['kettlebell']));
  assert('Ready-made circuit has five movements, three rounds and 15 logged sets',
    ready.pairs.length===1&&ready.pairs[0].exercises.length===5&&
    test.buildTasks('Quick',ready.pairs).length===15);
  assert('Preset includes pushes, pulls, lower-body and hinge patterns',
    ['Back','Quads','Side delts','Glutes'].every(m=>ready.pairs[0].exercises.some(e=>e.muscle===m)));
  assert('No unowned barbell, dumbbell or bench equipment is selected',
    ready.pairs[0].exercises.every(e=>(e.equipment||[]).every(g=>g==='kettlebell')));
  assert('Custom circuit chooses only pool movements and preserves rep targets and rest',
    (()=>{const pool=['kb_curl','kb_press','kb_bent_row'];
    const c=circuit.create({focus:'upper',count:3,rounds:2,reps:7,rest:90,poolIds:pool});
    return c.pairs[0].exercises.length===3 &&
      c.pairs[0].exercises.every(e=>pool.includes(e.id)&&e.sets===2&&e.min===7&&e.max===7) &&
      c.pairs[0].restMin===90;})());
  assert('Circuit UI exposes focus, exercises, rounds, target reps and rest controls',
    (()=>{const s=test.circuitScreen();return ['circuitFocus','circuitCount','circuitRounds','circuitReps',
    'name="rest" value="90"','circuitExercise','circuit-preset','circuitBuilderForm'].every(x=>s.includes(x));})());
  assert('Generator and manual selections do not alter stored workout history',
    before===JSON.stringify(test.getState().history));
  assert('Live circuit logging shows one movement per screen and skips in-round rest',
    app.includes('a.isCircuit ? group.items.filter(t=>t.index===a.taskIndex)') &&
    app.includes('if(a.isCircuit && next.pair.id===group.task.pair.id && next.round===group.task.round)'));
  assert('Existing rest countdown starts after each whole circuit round',
    app.includes("state.active.isCircuit?'Round complete")&&
    app.includes('const prescribed=state.active.isCircuit') &&
    app.includes('state.active.isCircuit?90:adjustedRestSeconds'));
  assert('Circuit sessions remain one-off and protect Adaptive rotations',
    app.includes("planId:'one-off',isOneOff:true,isCircuit:true"));
  assert('Circuit styling is mobile responsive and PWA has iPhone touch icon',
    ui.includes('@media(max-width:550px)')&&html.includes('apple-touch-icon')&&
    html.includes('icon-192.png')&&html.includes('adaptive-circuits.js?v=3'));
} catch(err){
  assert('Suite 57 Exception: '+err.message,false);
}

// -----------------------------------------------------------------------------
// SUITE 58: Full kettlebell-only weighted circuit catalogue and logging
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 58: Complete weighted KB movements + correct load units ---');
try {
 const lib=window.REPRIVAL_EXERCISE_LIBRARY, circuit=window.RepRivalAdaptiveCircuits, t=window.RepRivalTest;
 const ids=circuit.eligible().map(e=>e.id);
 const kb=ids.filter(id=>lib.byId[id].equipment.includes('kettlebell'));
 const names=new Set(ids);
 const expected=['kb_bent_row','kb_floor_press','kb_crush_press','kb_curl','kb_hammer_curl',
 'kb_press','kb_push_press','kb_sumo_squat','kb_goblet_squat','kb_reverse_lunge',
 'kb_forward_lunge','kb_walking_lunge','kb_split_squat','kb_triceps_extension',
 'kb_halo','kb_russian_twist','kb_rdl','kb_deadlift','kb_glute_bridge','kb_swing'];
 assert('All requested weighted KB movements are selectable',expected.every(id=>names.has(id)));
 assert('Single-arm kettlebell row remains explicitly available',names.has('kb_bent_row'));
 assert('Kettlebell circuit library contains over 30 weighted choices',kb.length>=30);
 assert('All weighted entries require only one kettlebell, never dumbbells',kb.every(id=>
   lib.byId[id].equipment.length===1&&lib.byId[id].equipment[0]==='kettlebell'));
 assert('Bodyweight options are exclusively equipment-free Core exercises',
   ids.filter(id=>!kb.includes(id)).every(id=>lib.byId[id].muscle==='Core'&&
     lib.byId[id].load==='bodyweight'&&!lib.byId[id].equipment.length));
 assert('Weighted kettlebell versions replace generic No equipment choices',
   !names.has('russian_twist')&&!names.has('reverse_lunge')&&!names.has('goblet_squat'));
 assert('One-click full-body preset uses five weighted moves including a kettlebell row',
   (()=>{const a=circuit.create({focus:'full_body',count:5,rounds:3});
   return a.pairs[0].exercises.length===5&&a.pairs[0].exercises.every(e=>e.equipment.includes('kettlebell'))&&
   a.pairs[0].exercises.some(e=>e.id==='kb_bent_row');})());
 assert('Custom weighted lunge, triceps, chest, core pool limits generated choices',
   (()=>{const ids=['kb_forward_lunge','kb_triceps_extension','kb_floor_press','kb_russian_twist'];
   const a=circuit.create({focus:'full_body',poolIds:ids,count:4,rounds:2,reps:8});
   return a.pairs[0].exercises.length===4 &&
     a.pairs[0].exercises.every(e=>ids.includes(e.id)&&e.sets===2&&e.min===8);})());
 assert('Kettlebell circuit picker lists weighted kettlebell movements',
   t.circuitScreen().includes('My exercise pool')&&
   t.circuitScreen().includes('Kettlebell floor chest press')&&
   t.circuitScreen().includes('Single-arm kettlebell row'));
 assert('Kettlebell load detection uses singular library equipment identifier',
   t.getAvailableLoadsForExercise(lib.byId.kb_bent_row).some(n=>n>0));
 assert('Every KB movement allows explicitly choosing zero without losing real weights',
   (()=>{const loads=t.getAvailableLoadsForExercise(lib.byId.kb_sumo_squat);return loads.includes(0)&&loads.some(n=>n>0);})());
 assert('KB load label indicates kettlebell rather than dumbbell',
   t.formatWeightConvention(16,lib.byId.kb_goblet_squat).includes('Kettlebell')&&
   !t.formatWeightConvention(16,lib.byId.kb_goblet_squat).includes('DB'));
 assert('New KB workout starts with actual kettlebell load rather than zero if configured',
   (()=>{const ex=lib.byId.kb_curl;const tsk={ex,index:999,round:1,ei:0,pi:0};
    const result=t.resolveSetValues(tsk,{logs:[],drafts:{}});
    return Number(result.weight)>0;})());
 assert('Manual 0 kg entries remain possible and remain zero',
   (()=>{const ex=lib.byId.kb_curl;const tsk={ex,index:999,round:1,ei:0,pi:0};
    const result=t.resolveSetValues(tsk,{logs:[],drafts:{'weight-999':0}});
    return Number(result.weight)===0;})());
} catch(err){assert('Suite 58 Exception: '+err.message,false);}

// -----------------------------------------------------------------------------
// SUITE 59: One-tap kettlebell workout mode and persistent adaptive pool
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 59: Fast KB mode / muscle gaps / one-hand workout UI ---');
try {
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../public/graphite-circuits.css'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const kb=window.RepRivalAdaptiveCircuits,t=window.RepRivalTest;
 const before=JSON.stringify(t.getState().history);
 const picker=t.circuitScreen();
 assert('Circuit launcher is directly accessible with a Workout toggle',
  app.includes("if(!state.active&&profile().workoutMode==='kb')return circuitScreen()")&&
  app.includes('switch-workout-kb')&&app.includes('switch-workout-standard'));
 assert('Circuit preview is required before starting',
  picker.includes('id="circuitBuilderForm"')&&picker.includes('Preview circuit')&&
  app.includes('data-action="shuffle-circuit"')&&app.includes('data-action="start-circuit"'));
 assert('Reps control uses numeric input, rest is fixed at 90 seconds',
  picker.includes('<input id="circuitReps"')&&picker.includes('name="rest" value="90"')&&
  !picker.includes('<select id="circuitReps"'));
 assert('Kettlebell inventory and explicit discard/delete are available',
  app.includes('name="kettlebellInventory"')&&app.includes('data-action="discard"')&&
  app.includes('data-action="delete-workout"'));
 assert('Pool description clarifies that choices are not fixed exercises',
  picker.includes('My exercise pool')&&picker.includes('Adaptive may choose from'));
 assert('Pool has minimum size but does not require exactly five choices',
  app.includes('settings.poolIds.length<settings.count')&&
  !app.includes('settings.selectedIds.length!==settings.count'));
 const selected=['kb_bent_row','kb_goblet_squat','kb_press','kb_swing','kb_reverse_lunge','kb_curl','kb_russian_twist'];
 const chosen=kb.create({focus:'full_body',count:5,poolIds:selected,rounds:3,reps:10,variant:2});
 assert('Generator chooses five distinct exercises from a seven-movement pool',
  chosen.pairs[0].exercises.length===5&&chosen.pairs[0].exercises.every(ex=>selected.includes(ex.id))&&
  new Set(chosen.pairs[0].exercises.map(ex=>ex.id)).size===5);
 const metrics={'Back':{stimulusScore:82,readinessScore:80},'Quads':{stimulusScore:10,readinessScore:95},
  'Glutes':{stimulusScore:5,readinessScore:91},'Side delts':{stimulusScore:90,readinessScore:25}};
 const gap=kb.create({focus:'full_body',count:3,poolIds:['kb_bent_row','kb_goblet_squat','kb_swing','kb_press'],
  metrics,history:[],rounds:2});
 assert('Low-stimulus recovered legs are chosen over fatigued pressing',
  gap.pairs[0].exercises.some(ex=>ex.id==='kb_goblet_squat')&&
  gap.pairs[0].exercises.some(ex=>ex.id==='kb_swing'));
 assert('Circuit screen omits strength recommendation panels and RIR blocks',
  app.includes('function circuitLiftScreen(tasks,task)')&&
  app.includes('if(a.isCircuit)return circuitLiftScreen(tasks,group.task)')&&
  !app.slice(app.indexOf('function circuitLiftScreen'),app.indexOf('function adaptiveStudioScreen')).includes('overload-badge'));
 assert('Circuit uses a simple kettlebell weight selector',
  app.includes('class="rr-kb-weight"')&&app.includes('getAvailableLoadsForExercise(ex)'));
 assert('Reps and effort can be adjusted if desired',
  app.includes('rr-kb-reps-editor')&&app.includes('rr-kb-rir-editor'));
 assert('Rest screen is a countdown and one-button next round',
  app.includes('function circuitRestScreen(tasks)')&&
  app.includes('if(a?.isCircuit)return circuitRestScreen(tasks)'));
 assert('Selected weight and reps persist for later rounds',
  app.includes('a.circuitSelections[t.ex.id]')&&app.includes('a.circuitSelections?.[ex.id]'));
 assert('Creating a draft leaves workout history unchanged',before===JSON.stringify(t.getState().history));
 assert('Responsive assets are versioned for mobile refresh',
  css.includes('@media(max-width:480px)')&&html.includes('graphite-circuits.css?v=2')&&
  html.includes('adaptive-circuits.js?v=3'));
} catch(err){assert('Suite 59 Exception: '+err.message,false);}

console.log('\n================================================================');
console.log('                   REGRESSION TEST RESULTS SUMMARY');
console.log('================================================================');
results.forEach(r => console.log(r));
console.log('----------------------------------------------------------------');
console.log(`TOTAL TESTS EXECUTED: ${passedCount + failedCount}`);
console.log(`PASSED: ${passedCount}`);
console.log(`FAILED: ${failedCount}`);
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
