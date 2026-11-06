/* RepRival Adaptive Training Engine v2.0 — Heat-Zone Driven Intelligence.
   Objective: Keep all 11 muscle groups hot in the anatomical heat map.
   Dynamically programs the next session based on user-configured:
   - workoutsPerWeek (2–6 days/week)
   - supersetsPerWorkout (2–5 supersets/session)
   Prioritises the coldest/least worked/detraining muscles to bring them back to glowing red. */
(function(){
  'use strict';

  const HEAT_KEYS = [
    'Chest',
    'Back',
    'Side delts',
    'Rear delts',
    'Biceps',
    'Triceps',
    'Quads',
    'Hamstrings',
    'Glutes',
    'Calves',
    'Core'
  ];

  // Antagonistic / non-competing pairing matrix for high-quality supersets
  const PAIR_SYNERGIES = {
    'Chest': ['Back', 'Rear delts', 'Core', 'Hamstrings', 'Calves'],
    'Back': ['Chest', 'Side delts', 'Quads', 'Core', 'Biceps'],
    'Side delts': ['Back', 'Hamstrings', 'Core', 'Glutes', 'Calves'],
    'Rear delts': ['Chest', 'Side delts', 'Quads', 'Core', 'Biceps'],
    'Biceps': ['Triceps', 'Core', 'Calves', 'Side delts', 'Hamstrings'],
    'Triceps': ['Biceps', 'Back', 'Core', 'Quads', 'Glutes'],
    'Quads': ['Hamstrings', 'Glutes', 'Back', 'Rear delts', 'Core'],
    'Hamstrings': ['Quads', 'Chest', 'Side delts', 'Biceps', 'Calves'],
    'Glutes': ['Quads', 'Chest', 'Side delts', 'Triceps', 'Calves'],
    'Calves': ['Core', 'Side delts', 'Chest', 'Back', 'Biceps'],
    'Core': ['Chest', 'Back', 'Side delts', 'Biceps', 'Triceps', 'Calves']
  };

  const clip = (n, a, b) => Math.max(a, Math.min(b, n));
  const isoDay = t => new Date(t).toISOString().slice(0, 10);
  const charHash = s => [...s].reduce((a, c) => (a * 33 + c.charCodeAt(0)) % 1000003, 7);

  function calculateHeatScores(history = [], now = Date.now(), days = 7){
    if (window.RepRivalIntelligence && typeof window.RepRivalIntelligence.calculateMuscleMetrics === 'function') {
      const metrics = window.RepRivalIntelligence.calculateMuscleMetrics({
        history,
        period: days,
        now
      });
      for (const m of HEAT_KEYS) {
        if (metrics[m]) {
          metrics[m].stimulus = metrics[m].stimulusUnits;
          metrics[m].score = metrics[m].stimulusScore;
          metrics[m].sets = metrics[m].effectiveSets;
          metrics[m].daysSince = metrics[m].daysSince != null ? metrics[m].daysSince : 30;
        }
      }
      return metrics;
    }

    const out = Object.fromEntries(HEAT_KEYS.map(m => [m, {
      name: m,
      stimulus: 0,
      sets: 0,
      last: null,
      ever: false,
      historySets: 0
    }]));

    const secondary = {
      'Chest': [['Triceps', 0.24], ['Side delts', 0.15]],
      'Back': [['Biceps', 0.29], ['Rear delts', 0.18]],
      'Quads': [['Glutes', 0.23]],
      'Hamstrings': [['Glutes', 0.23]],
      'Glutes': [['Hamstrings', 0.16]]
    };

    for(const s of history){
      const time = Date.parse(s.endedAt || s.startedAt || '');
      if(!Number.isFinite(time) || time > now + 86400000) continue;
      const age = Math.max(0, (now - time) / 86400000);

      for(const l of s.logs || []){
        const primary = l.muscle;
        if(!out[primary]) continue;
        out[primary].ever = true;
        out[primary].historySets++;
        out[primary].last = Math.max(out[primary].last || 0, time);

        if(age >= days) continue;
        const rir = Number(l.rir);
        const effort = (l.rir == null || l.rir === '' || !Number.isFinite(rir))
          ? 0.82
          : Math.max(0.43, 1 - Math.min(5, Math.max(0, rir)) * 0.11);
        const q = Math.pow(0.5, age / (days === 7 ? 3.8 : 11)) * effort;

        for(const [key, factor] of [[primary, 1], ...(secondary[primary] || [])]){
          if(out[key]){
            out[key].stimulus += q * factor;
            out[key].sets += factor;
            if(factor >= 0.5){
              out[key].ever = true;
              out[key].last = Math.max(out[key].last || 0, time);
            }
          }
        }
      }
    }

    const targets = {
      'Chest': 6, 'Back': 6, 'Side delts': 4, 'Rear delts': 4,
      'Biceps': 4.5, 'Triceps': 4.5, 'Quads': 6, 'Hamstrings': 5,
      'Glutes': 5, 'Calves': 4, 'Core': 4.5
    };

    for(const m of HEAT_KEYS){
      const p = out[m];
      p.score = Math.round(Math.min(100, (p.stimulus / targets[m]) * 100));
      p.daysSince = p.last ? Math.max(0, (now - p.last) / 86400000) : 30;
      p.isDetraining = Boolean(p.ever && (p.daysSince >= 7 || p.score < 16));
    }

    return out;
  }

  // Identify movement pattern to avoid redundant lifts in same session
  function pattern(e){
    const id = e.id.toLowerCase(), name = e.name.toLowerCase(), muscle = e.muscle;
    if(/carry|farmer|suitcase/.test(id+' '+name)) return 'loaded_carry';
    if(/bench.press|floor.press|push.up|chest.press|squeeze.press/.test(id)) return 'chest_press';
    if(/fly/.test(id) && muscle === 'Chest') return 'chest_fly';
    if(/pulldown|pull.up|chin.up/.test(id)) return 'vertical_pull';
    if(/row/.test(id) && muscle === 'Back') return 'horizontal_row';
    if(/rear.fly|reverse.fly|face.pull/.test(id)) return 'rear_delt';
    if(/lateral.raise|front.raise|upright.row/.test(id)) return 'lateral_raise';
    if(/overhead.*press|shoulder.press|military/.test(id)) return 'overhead_press';
    if(/curl/.test(id)) return 'curl';
    if(/tricep|skull.crush|close.push|dip|pushdown/.test(id)) return 'triceps';
    if(/romanian|rdl|deadlift|hinge/.test(id)) return 'hinge';
    if(/lunge|split.squat|step.up/.test(id)) return 'single_leg';
    if(/squat|leg.press|hack/.test(id)) return 'squat';
    if(/hip.thrust|glute.bridge/.test(id)) return 'hip_extension';
    if(/calf/.test(id)) return 'calves';
    if(/rollout|plank|ab.wheel/.test(id)) return 'anti_extension';
    if(/sit.up|crunch|leg.raise/.test(id)) return 'core_flexion';
    return muscle + '-' + id.replace(/_\d+/g,'');
  }

  function allowed(e, cfg, owned, avoid){
    const lib = window.REPRIVAL_EXERCISE_LIBRARY;
    if(lib && lib.compatible && !lib.compatible(e, owned)) return false;
    if(avoid.has(e.id)) return false;
    return true;
  }

  function generate(cfg = {}, history = [], owned = [], checkin = null, { now = Date.now(), variant = 0, avoid = [] } = {}){
    const lib = window.REPRIVAL_EXERCISE_LIBRARY;
    const allEntries = lib?.entries || [];

    // User preferences
    const workoutsPerWeek = clip(Number(cfg.frequency || cfg.weeklyGoal || 3), 2, 6);
    const supersetsTarget = clip(Number(cfg.supersets || 3), 2, 5);
    const exerciseTarget = supersetsTarget * 2;
    const goal = cfg.goal || 'muscle'; // muscle, strength, endurance

    // 1. Calculate live heat status across all 11 muscle groups using unified calculation engine
    const heat = calculateHeatScores(history, now, 7);

    // 2. Compute urgency score for each muscle:
    // Higher urgency = colder, decaying, or detraining -> needs immediate heat
    const rankedMuscles = HEAT_KEYS.map(m => {
      const h = heat[m];
      let urgency = 100 - h.score + (h.daysSince * 3.5);

      // Deep detraining bonus
      if(h.isDetraining){
        urgency += 80 + Math.min(50, (h.daysSince - 7) * 4);
      }

      // Recovery readiness awareness:
      // If muscle is in High recent load / recovery demand, significantly deprioritize it to protect recovery!
      if(h.readinessScore != null && h.readinessScore < 35){
        urgency -= 95;
      } else if(h.readinessScore != null && h.readinessScore < 65){
        urgency -= 40;
      }

      // Checkin adjustments: if athlete reports soreness, lower urgency to give recovery
      const soreGroups = checkin?.groups || [];
      if(soreGroups.includes(m)){
        urgency -= 75;
      }

      // If trained within last 36 hours and score is high, enforce rest
      if(h.daysSince < 1.5 && h.score >= 50){
        urgency -= 90;
      }

      return {
        muscle: m,
        score: h.score,
        daysSince: h.daysSince,
        isDetraining: h.isDetraining,
        urgency
      };
    }).sort((a, b) => b.urgency - a.urgency);

    const avoidIds = new Set([...(cfg.avoid || []), ...(avoid || [])]);
    const eligibleExercises = allEntries.filter(e => allowed(e, cfg, owned, avoidIds));
    const recentExerciseIds = new Set(history.slice(-2).flatMap(s => (s.logs || []).map(l => l.exId)));

    // 3. Build supersets from coldest to hottest
    const selectedPairs = [];
    const usedExerciseIds = new Set();
    const usedPatterns = new Set();
    const targetedMuscles = [];

    // Helper to find best exercise for a given muscle
    function pickExerciseForMuscle(muscle, existingPattern){
      const candidates = eligibleExercises.filter(e => {
        if(e.muscle !== muscle) return false;
        if(usedExerciseIds.has(e.id)) return false;
        const p = pattern(e);
        if(usedPatterns.has(p) || p === existingPattern) return false;
        return true;
      });

      if(!candidates.length){
        // Fallback: allow without pattern clash
        const fallback = eligibleExercises.find(e => e.muscle === muscle && !usedExerciseIds.has(e.id));
        return fallback || null;
      }

      // Score candidate for quality & variety
      candidates.sort((a, b) => {
        let sa = 0, sb = 0;
        if(!recentExerciseIds.has(a.id)) sa += 2;
        if(!recentExerciseIds.has(b.id)) sb += 2;
        // Prefer compound lifts in primary slots
        const pA = pattern(a), pB = pattern(b);
        if(['chest_press', 'horizontal_row', 'vertical_pull', 'squat', 'hinge', 'hip_extension'].includes(pA)) sa += 3;
        if(['chest_press', 'horizontal_row', 'vertical_pull', 'squat', 'hinge', 'hip_extension'].includes(pB)) sb += 3;
        // Seeded variety
        const ha = charHash(a.id + variant) % 10;
        const hb = charHash(b.id + variant) % 10;
        return (sb + hb * 0.1) - (sa + ha * 0.1);
      });

      return candidates[0];
    }

    // Assign muscles to pairs
    const assignedMuscles = new Set();

    for(let pIdx = 0; pIdx < supersetsTarget; pIdx++){
      // Pick the coldest unassigned muscle
      const primaryCandidate = rankedMuscles.find(r => !assignedMuscles.has(r.muscle));
      if(!primaryCandidate) break;
      const m1 = primaryCandidate.muscle;
      assignedMuscles.add(m1);

      // Find compatible partner muscle that also needs work
      const synergies = PAIR_SYNERGIES[m1] || [];
      const partnerCandidate = rankedMuscles.find(r => !assignedMuscles.has(r.muscle) && synergies.includes(r.muscle))
        || rankedMuscles.find(r => !assignedMuscles.has(r.muscle))
        || rankedMuscles[0];

      const m2 = partnerCandidate ? partnerCandidate.muscle : (m1 === 'Chest' ? 'Back' : 'Core');
      if(partnerCandidate) assignedMuscles.add(m2);

      // Pick movements
      const ex1 = pickExerciseForMuscle(m1, null);
      const ex2 = ex1 ? pickExerciseForMuscle(m2, pattern(ex1)) : null;

      if(ex1){
        usedExerciseIds.add(ex1.id);
        usedPatterns.add(pattern(ex1));
      }
      if(ex2){
        usedExerciseIds.add(ex2.id);
        usedPatterns.add(pattern(ex2));
      }

      const pairExercises = [];
      const setTarget = pIdx === 0 ? 3 : (pIdx === 1 ? 3 : 2);

      if(ex1){
        const copy1 = { ...ex1, sets: setTarget };
        if(goal === 'strength'){ copy1.min = 5; copy1.max = 8; }
        else if(goal === 'endurance'){ copy1.min = 12; copy1.max = 16; }
        pairExercises.push(copy1);
        targetedMuscles.push({ muscle: m1, score: heat[m1].score, days: heat[m1].daysSince });
      }

      if(ex2){
        const copy2 = { ...ex2, sets: setTarget };
        if(goal === 'strength'){ copy2.min = 5; copy2.max = 8; }
        else if(goal === 'endurance'){ copy2.min = 12; copy2.max = 16; }
        pairExercises.push(copy2);
        targetedMuscles.push({ muscle: m2, score: heat[m2].score, days: heat[m2].daysSince });
      }

      if(pairExercises.length){
        const letter = String.fromCharCode(65 + pIdx);
        selectedPairs.push({
          id: letter,
          restMin: 75,
          restMax: 90,
          exercises: pairExercises
        });
      }
    }

    // Compute workout meta
    const totalSets = selectedPairs.reduce((acc, p) => acc + p.exercises.reduce((s, e) => s + e.sets, 0), 0);
    const estTime = Math.round(totalSets * 2.2 + selectedPairs.length * 2);

    // Primary cold targets to highlight
    const coldestTargets = rankedMuscles.slice(0, 3).map(r => `${r.muscle} (${r.score}%)`).join(', ');
    const title = selectedPairs.length > 0
      ? `${selectedPairs[0].exercises.map(e => e.muscle).join(' & ')} Focus`
      : 'Adaptive Full Body';

    const explanation = `Configured for ${workoutsPerWeek} sessions/wk with ${supersetsTarget} supersets (${totalSets} sets · ~${estTime} min). Specifically programmed to re-ignite your coldest zones: ${coldestTargets} to maintain full-body heat map coverage.`;

    return {
      name: title,
      subtitle: `${supersetsTarget} supersets · ${totalSets} working sets · ~${estTime} min`,
      pairs: selectedPairs,
      focus: targetedMuscles.map(t => t.muscle),
      coldTargets: rankedMuscles.slice(0, 4),
      explanation: explanation,
      estimatedMinutes: estTime,
      supersetsTarget,
      workoutsPerWeek
    };
  }

  const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];
  const LEVELS = ['Off / Skip', 'Maintenance (Low)', 'Balanced (Medium)', 'High Priority', 'Maximum Focus'];
  const PERIODS = { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', manual: 'Manual' };

  const TEMPLATES = {
    runner: {
      id: 'runner',
      name: 'Runner / Athletic Leg Recovery',
      desc: 'Prioritises upper body & core while managing leg volume for runners.',
      levels: [3, 3, 2, 2, 1, 3]
    },
    hypertrophy: {
      id: 'hypertrophy',
      name: 'Balanced Muscle Building',
      desc: 'Equal focus across all major muscle groups for hypertrophy.',
      levels: [3, 3, 3, 3, 3, 3]
    },
    upper: {
      id: 'upper',
      name: 'Upper Body Focus',
      desc: 'Emphasises Chest, Back, Shoulders, and Arms.',
      levels: [4, 4, 4, 4, 1, 2]
    },
    lower: {
      id: 'lower',
      name: 'Legs & Core Power',
      desc: 'High priority on Quads, Hamstrings, Glutes, and Core.',
      levels: [1, 1, 1, 1, 4, 4]
    }
  };

  function nextReviewDay(cfg) {
    if (!cfg || cfg.review === 'manual' || !cfg.startedAt) return null;
    const intervalMap = { weekly: 7, fortnightly: 14, monthly: 28 };
    const daysInterval = intervalMap[cfg.review] || 14;
    const start = Date.parse(cfg.startedAt + 'T12:00:00');
    if (!Number.isFinite(start)) return null;
    const elapsedDays = Math.floor((Date.now() - start) / 86400000);
    const rem = daysInterval - (elapsedDays % daysInterval);
    return rem;
  }

  function review(cfg, history, readiness) {
    const currentLevels = cfg?.levels || [3, 3, 3, 3, 3, 3];
    const proposed = [...currentLevels];
    const rows = GROUPS.map((g, i) => {
      const curLvl = currentLevels[i] ?? 2;
      return {
        name: g,
        level: curLvl,
        proposed: curLvl,
        actual: 6,
        target: (curLvl + 1) * 2,
        note: 'Balanced training dose'
      };
    });
    return { rows, levels: proposed };
  }

  window.RepRivalAdaptive = {
    HEAT_KEYS,
    GROUPS,
    LEVELS,
    PERIODS,
    TEMPLATES,
    nextReviewDay,
    review,
    calculateHeatScores,
    generate,
    pattern,
    allowed
  };
})();
