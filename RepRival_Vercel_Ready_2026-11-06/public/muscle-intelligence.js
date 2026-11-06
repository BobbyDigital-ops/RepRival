/* RepRival Scientific Muscle Intelligence Engine v3.0
   Separates training into three decoupled domains:
   1. Productive Muscle Stimulus (hypertrophy-oriented training exposure & recency)
   2. Estimated Muscle Readiness (recovery demand vs. capacity for further training)
   3. Long-Term Progression (comparable strength trends, Epley 1RM, overload)

   Scientific Foundation:
   - ACSM 2026 Resistance Training Position Stand (DOI 10.1249/MSS.0000000000003897)
   - Pelland et al., Resistance Training Dose Response (DOI 10.1007/s40279-025-02344-w)
   - Robinson et al., Proximity to Failure and Hypertrophy (DOI 10.1007/s40279-024-02069-2)
*/
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

  const DEFAULT_WEEKLY_TARGETS = {
    'Chest': 10,
    'Back': 10,
    'Side delts': 6,
    'Rear delts': 6,
    'Biceps': 6,
    'Triceps': 6,
    'Quads': 10,
    'Hamstrings': 8,
    'Glutes': 8,
    'Calves': 6,
    'Core': 6
  };

  const UI_GROUPS = [
    ['Chest', ['Chest']],
    ['Back', ['Back']],
    ['Shoulders', ['Side delts', 'Rear delts']],
    ['Arms', ['Biceps', 'Triceps']],
    ['Quads', ['Quads']],
    ['Hamstrings', ['Hamstrings']],
    ['Glutes', ['Glutes']],
    ['Calves', ['Calves']],
    ['Core', ['Core']]
  ];

  /**
   * Scientific RIR Weighting for Hypertrophy Stimulus
   * Robinson et al. (2024): 0-2 RIR achieve near-identical peak motor unit recruitment
   * and mechanical tension. Stimulus declines moderately from 3-4 RIR and drops sharply at 5+ RIR.
   */
  function rirStimulusWeight(rir) {
    if (rir == null || rir === '' || !Number.isFinite(Number(rir))) {
      // Missing RIR fallback as per v2 spec
      return { factor: 0.75, isEstimated: true };
    }
    const r = Math.max(0, Number(rir));
    if (r <= 1) return { factor: 1.00, isEstimated: false };
    if (r === 2) return { factor: 0.95, isEstimated: false };
    if (r === 3) return { factor: 0.85, isEstimated: false };
    if (r === 4) return { factor: 0.65, isEstimated: false };
    if (r === 5) return { factor: 0.40, isEstimated: false };
    if (r === 6) return { factor: 0.20, isEstimated: false };
    return { factor: 0.10, isEstimated: false };
  }

  /**
   * Neuromuscular & Structural Fatigue Multiplier for Recovery Demand
   * Robinson et al. (2024): True failure (0 RIR) generates disproportionately more
   * acute central/peripheral fatigue and tissue damage than submaximal (2-3 RIR) sets.
   */
  function rirFatigueMultiplier(rir) {
    if (rir == null || rir === '' || !Number.isFinite(Number(rir))) {
      return 1.0;
    }
    const r = Math.max(0, Math.min(6, Number(rir)));
    // 0 RIR: 1.35x fatigue, 1 RIR: 1.2x, 2 RIR: 1.05x, 3 RIR: 0.9x, 4 RIR: 0.75x, 5+ RIR: 0.6x
    return Math.max(0.60, 1.35 - 0.15 * r);
  }

  /**
   * The v2 stimulus contract applies diminishing returns ONCE: log(1 + D/10).
   * Keep this compatibility helper neutral; never use a second per-session
   * penalty or silently distort weekly effective-set counts.
   */
  function sessionSetDiminishingWeight(_setIndexInSession) {
    return 1;
  }

  const STIMULUS_WINDOW_DAYS = 28;
  const STIMULUS_TIME_CONSTANT_DAYS = 10;
  const STIMULUS_NORMALIZER = (10 / 7) * (1 - Math.exp(-STIMULUS_WINDOW_DAYS / STIMULUS_TIME_CONSTANT_DAYS));

  // D is a 28-day, exponentially recency-weighted weekly-equivalent dose.
  // T is an EXPLICIT weekly training-dose reference, not a biological maximum.
  function trainingDoseScore(dose, target) {
    if (!Number.isFinite(dose) || !Number.isFinite(target) || target <= 0) return null;
    return Math.round(100 * Math.min(1, Math.max(0, Math.log1p(Math.max(0, dose) / 10) / Math.log1p(target / 10))));
  }

  function validWorkingSet(log) {
    return Boolean(log && !log.skipped && !log.warmup && !log.isWarmup &&
      log.type !== 'warmup' && log.tag !== 'warmup' &&
      Number.isFinite(Number(log.reps)) && Number(log.reps) > 0 && Number(log.reps) <= 300 &&
      (log.rir == null || log.rir === '' || (Number.isFinite(Number(log.rir)) && Number(log.rir) >= 0 && Number(log.rir) <= 20)) &&
      (log.weight == null || (Number.isFinite(Number(log.weight)) && Number(log.weight) >= 0)));
  }

  function parseTimestamp(raw) {
    if (raw == null) return NaN;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (raw instanceof Date) return raw.getTime();
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return NaN;
      const num = Number(trimmed);
      if (Number.isFinite(num) && !trimmed.includes('-') && !trimmed.includes('/') && !trimmed.includes('T')) {
        return num;
      }
      const parsed = Date.parse(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
    return NaN;
  }

  function resolveLogMuscle(log) {
    if (!log) return null;
    const raw = String(log.muscle || '').trim();

    if (HEAT_KEYS.includes(raw)) return raw;

    const lower = raw.toLowerCase();
    if (/chest|pec/i.test(lower)) return 'Chest';
    if (/back|lat|upper_back/i.test(lower)) return 'Back';
    if (/side_delt|side delt|lateral|shoulder/i.test(lower)) return 'Side delts';
    if (/rear_delt|rear delt|posterior_delt/i.test(lower)) return 'Rear delts';
    if (/bicep|arm/i.test(lower)) return 'Biceps';
    if (/tricep|triceps/i.test(lower)) return 'Triceps';
    if (/quad|quadriceps|leg/i.test(lower)) return 'Quads';
    if (/hamstring|ham/i.test(lower)) return 'Hamstrings';
    if (/glute/i.test(lower)) return 'Glutes';
    if (/calf|calves/i.test(lower)) return 'Calves';
    if (/core|abs|abdominal/i.test(lower)) return 'Core';

    const exId = log.exId || log.name;
    if (exId && window.REPRIVAL_EXERCISE_LIBRARY?.byId) {
      const libEx = window.REPRIVAL_EXERCISE_LIBRARY.byId[exId] || window.REPRIVAL_EXERCISE_LIBRARY.byId[String(exId).toLowerCase()];
      if (libEx && libEx.muscle && HEAT_KEYS.includes(libEx.muscle)) {
        return libEx.muscle;
      }
    }

    const exName = String(log.name || log.exId || '').toLowerCase();
    if (/overhead|shoulder|lateral_raise|delt/i.test(exName) && !/rear/i.test(exName)) return 'Side delts';
    if (/rear_delt|rear_fly|face_pull/i.test(exName)) return 'Rear delts';
    if (/press|bench|chest|pec|fly/i.test(exName)) return 'Chest';
    if (/row|lat|pull|chin|back|shrug|trap/i.test(exName)) return 'Back';
    if (/squat|lunge|leg_extension|quad/i.test(exName)) return 'Quads';
    if (/rdl|deadlift|leg_curl|hamstring/i.test(exName)) return 'Hamstrings';
    if (/hip_thrust|glute/i.test(exName)) return 'Glutes';
    if (/curl|bicep/i.test(exName)) return 'Biceps';
    if (/tricep|dip|skull|extension/i.test(exName)) return 'Triceps';
    if (/calf|calves/i.test(exName)) return 'Calves';
    if (/plank|crunch|rollout|core|sit_up/i.test(exName)) return 'Core';

    return null;
  }

  /**
   * Exercise-Specific Secondary Hypertrophy Distribution Matrix
   * Based on ACSM (2026), Pelland et al. (2025), Robinson et al. (2024).
   */
  function getSecondaryContributions(log) {
    if (!log) return [];
    const exId = String(log.exId || log.name || '').toLowerCase();
    const primary = resolveLogMuscle(log);

    if (primary === 'Chest') {
      if (/fly/i.test(exId)) {
        return [['Side delts', 0.15]];
      }
      return [['Triceps', 0.40], ['Side delts', 0.25]];
    }

    if (primary === 'Back') {
      if (/shrug/i.test(exId)) {
        return [['Rear delts', 0.15]];
      }
      return [['Biceps', 0.40], ['Rear delts', 0.30]];
    }

    if (primary === 'Side delts') {
      if (/press/i.test(exId)) {
        return [['Triceps', 0.35], ['Rear delts', 0.15]];
      }
      return [['Rear delts', 0.15]];
    }

    if (primary === 'Rear delts') {
      return [['Back', 0.25]];
    }

    if (primary === 'Quads') {
      if (/leg_extension/i.test(exId)) {
        return [];
      }
      if (/lunge|split_squat/i.test(exId)) {
        return [['Glutes', 0.40], ['Hamstrings', 0.10]];
      }
      // Bilateral squats (goblet, barbell, front, hack): Glutes 0.30, Hamstrings 0.0 (biarticular length constant)
      return [['Glutes', 0.30]];
    }

    if (primary === 'Hamstrings') {
      if (/leg_curl/i.test(exId)) {
        return [];
      }
      // RDL, Deadlift: Glutes 0.40, Core 0.20
      return [['Glutes', 0.40], ['Core', 0.20]];
    }

    if (primary === 'Glutes') {
      return [['Hamstrings', 0.25], ['Quads', 0.15]];
    }

    return [];
  }

  /**
   * Exercise-Specific Supporting Involvement Matrix
   * Dynamic ankle stabilization, isometric trunk bracing, and grip/bar stability.
   * Awards 0.0 hypertrophy sets, but tracks neuromuscular stabilization exposure.
   */
  function getSupportingContributions(log) {
    if (!log) return [];
    const exId = String(log.exId || log.name || '').toLowerCase();
    const primary = resolveLogMuscle(log);

    if (primary === 'Quads') {
      if (/squat|lunge|split_squat|leg_press/i.test(exId)) {
        return ['Calves', 'Core'];
      }
    }
    if (primary === 'Hamstrings') {
      if (/rdl|deadlift/i.test(exId)) {
        return ['Calves', 'Back'];
      }
    }
    if (primary === 'Glutes') {
      if (/thrust|bridge|squat|lunge/i.test(exId)) {
        return ['Core'];
      }
    }
    if (/squat/i.test(exId)) {
      return ['Calves', 'Core'];
    }
    if (/lunge|split_squat/i.test(exId)) {
      return ['Calves', 'Core'];
    }
    if (/deadlift|rdl/i.test(exId)) {
      return ['Calves', 'Back'];
    }
    return [];
  }

  /**
   * Universal Readiness State Categorization
   * Thresholds:
   * - null / no confidence: 'Insufficient data'
   * - 0–39: 'High recent load'
   * - 40–69: 'Recovering'
   * - 70–84: 'Mostly ready'
   * - 85–100: 'Ready'
   */
  function getReadinessState(score) {
    if (score == null || !Number.isFinite(Number(score))) {
      return 'Insufficient data';
    }
    const s = Math.round(Number(score));
    if (s <= 39) return 'High recent load';
    if (s <= 69) return 'Recovering';
    if (s <= 84) return 'Mostly ready';
    return 'Ready';
  }

  /**
   * Core Calculation: Computes Productive Stimulus, Muscle Readiness & Map Colors
   */
  function calculateMuscleMetrics(params = {}) {
    try {
      const history = params.history || [];
      const checkin = params.checkin || null;
      const period = params.period === 28 ? 28 : 7;
      const now = params.now || Date.now();
      const targets = { ...DEFAULT_WEEKLY_TARGETS, ...(params.customTargets || {}) };

      // Initialize 11 muscle data structures
      const muscles = Object.fromEntries(HEAT_KEYS.map(m => [m, {
        name: m,
        targetSets: targets[m] || 10,
        rawCompletedSets: 0,
        primarySets: 0,
        secondarySets: 0,
        effectiveSets: 0,
        supportingSets: 0,
        lastSupporting: null,
        hasSupportingExposure: false,
        stimulusUnits: 0,
        stimulusScore: 0,
        readinessScore: null,
        readinessState: 'Insufficient data',
        readinessConfidence: 'none',
        breakdown: '',
        factors: [],
        last: null,
        lastPrimary: null,
        daysSince: null,
        ever: false,
        hasPrimaryHistory: false,
        hasSecondaryHistory: false,
        historySets: 0,
        historySessions: new Set(),
        rollingWeeklySets: 0,
        rirCount: 0,
        rirSum: 0,
        estimatedRirSets: 0,
        doseWeekly: 0,
        hasEstablishedTraining: false,
        isDetraining: false,
        mapScore: 0
      }]));

      // Sort history chronologically (oldest to newest) to track intra-session sequence
      const sortedHistory = [...history]
        .filter(s => {
          const time = parseTimestamp(s.endedAt || s.startedAt || s.date || s.loggedAt || s.when);
          return Number.isFinite(time) && time <= now;
        })
        .sort((a, b) => {
          const ta = parseTimestamp(a.endedAt || a.startedAt || a.date || a.loggedAt || a.when) || 0;
          const tb = parseTimestamp(b.endedAt || b.startedAt || b.date || b.loggedAt || b.when) || 0;
          return ta - tb;
        });

      // Track total historical sets for baselines
      for (const session of sortedHistory) {
        const time = parseTimestamp(session.endedAt || session.startedAt || session.date || session.loggedAt || session.when);
        const sId = session.id || String(time);

        for (const log of (session.logs || [])) {
          if (!validWorkingSet(log)) continue;
          const p = resolveLogMuscle(log);
          if (!p || !muscles[p]) continue;

          // Mark primary history
          muscles[p].ever = true;
          muscles[p].hasPrimaryHistory = true;
          muscles[p].historySets++;
          muscles[p].historySessions.add(sId);
          muscles[p].last = Math.max(muscles[p].last || 0, time);
          muscles[p].lastPrimary = Math.max(muscles[p].lastPrimary || 0, time);

          // Mark secondary history - secondary work counts as genuine training exposure!
          const secList = getSecondaryContributions(log);
          for (const [secM, factor] of secList) {
            if (muscles[secM]) {
              muscles[secM].ever = true;
              muscles[secM].hasSecondaryHistory = true;
              muscles[secM].historySets += factor;
              muscles[secM].historySessions.add(sId);
              muscles[secM].last = Math.max(muscles[secM].last || 0, time);
            }
          }

          // Mark supporting involvement (0 hypertrophy sets, tracks functional stabilization exposure)
          const supList = getSupportingContributions(log);
          for (const supM of supList) {
            if (muscles[supM]) {
              muscles[supM].hasSupportingExposure = true;
              muscles[supM].lastSupporting = Math.max(muscles[supM].lastSupporting || 0, time);
            }
          }
        }
      }

      // Multi-week rolling evaluation for Muscle Intelligence v2
      const weeklyWindowStart = now - (period * 86400000);
      const stimulusWindowStart = now - (28 * 86400000);
      const C_NORM = STIMULUS_NORMALIZER;

      const acuteFatigue = Object.fromEntries(HEAT_KEYS.map(m => [m, 0]));
      const stimulusDoseSums = Object.fromEntries(HEAT_KEYS.map(m => [m, 0]));

      for (const session of sortedHistory) {
        const time = parseTimestamp(session.endedAt || session.startedAt || session.date || session.loggedAt || session.when);
        if (!Number.isFinite(time) || time < stimulusWindowStart) continue;

        const ageDays = Math.max(0, (now - time) / 86400000);
        if (ageDays > 28) continue;
        const ageHours = Math.max(0, (now - time) / 3600000);

        const recencyDecay = Math.exp(-ageDays / 10);
        const fatigueDecay = Math.exp(-ageHours / 48);
        const inWeeklyWindow = time >= weeklyWindowStart;

        for (const log of (session.logs || [])) {
          if (!validWorkingSet(log)) continue;

          const primary = resolveLogMuscle(log);
          if (!primary || !muscles[primary]) continue;

          // All qualifying sets count once. Logarithmic normalisation below
          // supplies the *only* diminishing-returns function.
          const setWeight = 1;

          const rirData = rirStimulusWeight(log.rir);
          const fMult = rirFatigueMultiplier(log.rir);

          if (inWeeklyWindow) {
            if (rirData.isEstimated) muscles[primary].estimatedRirSets++;
            if (log.rir != null && log.rir !== '' && Number.isFinite(Number(log.rir))) {
              muscles[primary].rirSum += Number(log.rir);
              muscles[primary].rirCount++;
            }

            muscles[primary].rawCompletedSets += 1;
            muscles[primary].primarySets += 1;
            muscles[primary].effectiveSets += 1.0 * setWeight;
          }

          stimulusDoseSums[primary] += 1.0 * rirData.factor * setWeight * recencyDecay;
          acuteFatigue[primary] += 1.0 * fMult * fatigueDecay;

          const secList = getSecondaryContributions(log);
          for (const [secM, fraction] of secList) {
            if (!muscles[secM]) continue;

            if (inWeeklyWindow) {
              muscles[secM].secondarySets += fraction * setWeight;
              muscles[secM].effectiveSets += fraction * setWeight;
            }

            stimulusDoseSums[secM] += fraction * rirData.factor * setWeight * recencyDecay;
            acuteFatigue[secM] += fraction * fMult * fatigueDecay;
          }

          const supList = getSupportingContributions(log);
          for (const supM of supList) {
            if (!muscles[supM]) continue;
            if (inWeeklyWindow) {
              muscles[supM].supportingSets += 1;
            }
          }
        }
      }

      const checkinData = checkin || {};
      const sorenessMap = checkinData.sorenessMap || {};
      const soreGroups = checkinData.groups || [];
      const fatigue = checkinData.fatigue == null ? null : Number(checkinData.fatigue);
      const sleep = checkinData.sleep || null;

      const fourWeeksAgo = now - (28 * 86400000);
      const recentHistory = sortedHistory.filter(s => {
        const t = parseTimestamp(s.endedAt || s.startedAt || '');
        return t >= fourWeeksAgo;
      });
      const weeksSampled = Math.max(1, Math.min(4, (now - Math.min(...sortedHistory.map(s => parseTimestamp(s.endedAt || s.startedAt || '')).filter(Number.isFinite))) / (7 * 86400000)));

      for (const m of HEAT_KEYS) {
        const p = muscles[m];
        const target = p.targetSets || 10;

        p.effectiveSets = Math.round(p.effectiveSets * 10) / 10;
        p.coveragePct = Math.round((p.effectiveSets / target) * 100);

        const fourWeekHistorySets = recentHistory.reduce((acc, s) => {
          return acc + (s.logs || []).filter(l => !l.skipped && resolveLogMuscle(l) === m).length;
        }, 0);
        p.rollingWeeklySets = Math.round((fourWeekHistorySets / weeksSampled) * 10) / 10;

        // Acute:Chronic Workload Ratio (ACWR) - identifies unaccustomed spikes
        const currentWindowSets = recentHistory.filter(s => {
          const t = parseTimestamp(s.endedAt || s.startedAt || '');
          return t >= now - (7 * 86400000);
        }).reduce((acc, s) => {
          return acc + (s.logs || []).filter(l => !l.skipped && resolveLogMuscle(l) === m).length;
        }, 0);
        const isWorkloadSpike = p.rollingWeeklySets > 0 && currentWindowSets >= 1.2 * p.rollingWeeklySets && currentWindowSets >= 5;

        // Canonical Stimulus Formula v2
        const Sm = stimulusDoseSums[m];
        const Dm = Sm / C_NORM;
        p.doseWeekly = Dm; // full precision for correct aggregation; never sum rounded values
        p.stimulusUnits = Math.round(Sm * 100) / 100;
        p.uncappedDose = Math.round(Dm * 100) / 100;
        p.stimulusScore = trainingDoseScore(Dm, target);

        p.daysSince = p.last ? Math.max(0, (now - p.last) / 86400000) : null;
        p.hoursSince = p.last ? Math.max(0, (now - p.last) / 3600000) : null;

        // Detraining RISK is a separate conservative state, not a colour
        // inferred from low stimulus. One old session is not a trained baseline.
        p.hasEstablishedTraining = p.historySets >= 3 && p.historySessions.size >= 2;
        p.isDetraining = Boolean(p.hasEstablishedTraining && p.daysSince >= 21 && p.stimulusScore < 8);

        const factors = [];

        if (!p.ever || p.daysSince === null) {
          p.readinessScore = null;
          p.score = null;
          p.readinessState = 'Insufficient data';
          p.readinessConfidence = 'none';
          p.factors = [];
          p.breakdown = 'No recorded training history for this muscle';
        } else {
          // Canonical Acute Fatigue & Readiness Base Formula v2
          const Am = acuteFatigue[m];
          const readinessBase = 100 / (1 + (Am / (0.5 * target)));
          let ready = readinessBase;

          const fatiguePts = Math.round(100 - readinessBase);
          if (fatiguePts > 0) {
            factors.push(`Workload fatigue: -${fatiguePts}%`);
          }

          if (isWorkloadSpike) {
            factors.push('Unaccustomed workload');
          }

          let soreLevel = 'none';
          if (sorenessMap[m]) soreLevel = sorenessMap[m];
          else if (soreGroups.includes(m)) soreLevel = 'moderate';

          if (soreLevel === 'severe') {
            ready -= 25;
            factors.push('Severe soreness: -25%');
          } else if (soreLevel === 'moderate') {
            ready -= 16;
            factors.push('Moderate soreness: -16%');
          } else if (soreLevel === 'mild') {
            ready -= 8;
            factors.push('Mild soreness: -8%');
          }

          if (fatigue >= 4) {
            ready -= 10;
            factors.push('High fatigue: -10%');
          } else if (fatigue >= 3) {
            ready -= 5;
            factors.push('Moderate fatigue: -5%');
          }

          if (sleep === 'poor') {
            ready -= 8;
            factors.push('Poor sleep: -8%');
          } else if (sleep === 'good' || sleep === 'great') {
            ready += 4;
            factors.push('Good sleep: +4%');
          }

          p.readinessScore = Math.max(12, Math.min(100, Math.round(ready)));
          p.score = p.readinessScore;
          p.readinessState = getReadinessState(p.readinessScore);

          const hasCheckin = Boolean(checkin && (checkin.sorenessMap || (checkin.groups && checkin.groups.length) || checkin.fatigue != null || checkin.sleep));
          p.readinessConfidence = hasCheckin ? (p.estimatedRirSets > 0 ? 'moderate' : 'high') : 'moderate';
          p.factors = factors;
          p.breakdown = factors.length ? factors.join(' · ') : (p.daysSince && p.daysSince >= 4 ? 'Rested & recovered' : 'Ready to train');
        }

        p.mapScore = p.stimulusScore;

        const formattedSets = Number.isInteger(p.effectiveSets) ? p.effectiveSets : p.effectiveSets.toFixed(1).replace(/\.0$/, '');
        const setsNote = `${formattedSets}/${target} effective sets`;
        p.statusLabel = `${m} (${setsNote})`;
        p.avgRir = p.rirCount > 0 ? (p.rirSum / p.rirCount).toFixed(1) : null;
      }

      return muscles;
    } catch (err) {
      console.error('Error in calculateMuscleMetrics:', err);
      return Object.fromEntries(HEAT_KEYS.map(m => [m, {
        name: m,
        targetSets: 10,
        rawCompletedSets: 0,
        primarySets: 0,
        secondarySets: 0,
        effectiveSets: 0,
        stimulusUnits: 0,
        stimulusScore: 0,
        readinessScore: null,
        readinessState: 'Insufficient data',
        readinessConfidence: 'none',
        breakdown: 'Calculation error',
        factors: [],
        last: null,
        lastPrimary: null,
        daysSince: null,
        ever: false,
        hasPrimaryHistory: false,
        hasSecondaryHistory: false,
        historySets: 0,
        historySessions: new Set(),
        rollingWeeklySets: 0,
        rirCount: 0,
        rirSum: 0,
        estimatedRirSets: 0,
        doseWeekly: 0,
        hasEstablishedTraining: false,
        isDetraining: false,
        mapScore: 0,
        statusLabel: `${m} (0/10 effective sets)`
      }]));
    }
  }

  // Visual color anchors tuned for clean, perceptually distinct screen-blend overlays
  const STIMULUS_ANCHORS_10 = [
    { score: 0,   fill: '#353437', r: 53,  g: 52,  b: 55,  alpha: 0.15 }, // 0%: neutral
    { score: 10,  fill: '#393539', r: 57,  g: 53,  b: 57,  alpha: 0.22 }, // 10%: neutral, faint warmth
    { score: 20,  fill: '#4a4048', r: 74,  g: 64,  b: 72,  alpha: 0.28 }, // 20%: faint warm neutral
    { score: 30,  fill: '#6e484a', r: 110, g: 72,  b: 74,  alpha: 0.36 }, // 30%: subtle warmth
    { score: 35,  fill: '#7a4e51', r: 122, g: 78,  b: 81,  alpha: 0.40 }, // 35%: subtle visible warmth (34% Shoulders)
    { score: 40,  fill: '#844c4e', r: 132, g: 76,  b: 78,  alpha: 0.45 }, // 40%: moderate neutral grey-rose (40% Back)
    { score: 50,  fill: '#9e403c', r: 158, g: 64,  b: 60,  alpha: 0.54 }, // 50%: moderate muted red
    { score: 55,  fill: '#aa3a35', r: 170, g: 58,  b: 53,  alpha: 0.59 }, // 55%: moderate dusty red (54% Arms)
    { score: 60,  fill: '#b8322c', r: 184, g: 50,  b: 44,  alpha: 0.65 }, // 60%: warm red
    { score: 70,  fill: '#ce2822', r: 206, g: 40,  b: 34,  alpha: 0.72 }, // 70%: strong red
    { score: 75,  fill: '#d8221c', r: 216, g: 34,  b: 28,  alpha: 0.76 }, // 75%: strong red below max (74% Chest)
    { score: 80,  fill: '#e41c16', r: 228, g: 28,  b: 22,  alpha: 0.82 }, // 80%: vivid red
    { score: 90,  fill: '#ee1512', r: 238, g: 21,  b: 18,  alpha: 0.88 }, // 90%: vivid athletic red
    { score: 100, fill: '#f81010', r: 248, g: 16,  b: 16,  alpha: 0.94 }  // 100%: max bright athletic red glow
  ];

  /**
   * Continuous Stimulus Intensity & Color Mapper
   * Interpolates RGB and alpha continuously across 0–100% productive stimulus score.
   */
  function getStimulusColor(stimulusScore) {
    const s = Math.max(0, Math.min(100, Number(stimulusScore) || 0));
    let lower = STIMULUS_ANCHORS_10[0], upper = STIMULUS_ANCHORS_10[STIMULUS_ANCHORS_10.length - 1];
    for (let i = 0; i < STIMULUS_ANCHORS_10.length - 1; i++) {
      if (s >= STIMULUS_ANCHORS_10[i].score && s <= STIMULUS_ANCHORS_10[i+1].score) {
        lower = STIMULUS_ANCHORS_10[i];
        upper = STIMULUS_ANCHORS_10[i+1];
        break;
      }
    }

    const t = (s - lower.score) / (upper.score - lower.score || 1);

    const r = Math.round(lower.r + t * (upper.r - lower.r));
    const g = Math.round(lower.g + t * (upper.g - lower.g));
    const b = Math.round(lower.b + t * (upper.b - lower.b));
    const alpha = Math.round((lower.alpha + t * (upper.alpha - lower.alpha)) * 100) / 100;

    const fill = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    return { fill, alpha, r, g, b };
  }

  /**
   * Anatomical Atlas Color Resolver
   * Maps a muscle's training state to continuous Red-to-Neutral-to-Blue visual design.
   */
  function fillFor(muscleData) {
    if (!muscleData) return { fill: '#18191d', alpha: 0 };

    const days = muscleData.daysSince != null
      ? muscleData.daysSince
      : (muscleData.last ? Math.max(0, (Date.now() - Number(muscleData.last)) / 86400000) : null);
    const wasTrained = Boolean(muscleData.ever || (muscleData.historySets && muscleData.historySets > 0) || muscleData.last);
    const stimulus = muscleData.stimulusScore != null ? Number(muscleData.stimulusScore) : 0;

    // 1. Untrained / Baseline: neutral transparent
    if (!wasTrained || days === null) {
      return { fill: '#18191d', alpha: 0 };
    }

    // 2. Prolonged / Sustained inactivity (Blue tones reserved strictly for >= 21d and stimulus < 8%)
    if (muscleData.isDetraining === true && days >= 28) {
      return { fill: '#31528c', alpha: 0.70 };
    }
    if (muscleData.isDetraining === true && days >= 21) {
      return { fill: '#4b6ba2', alpha: 0.55 };
    }

    // 3. Continuous stimulus intensity (0% to 100% stimulus)
    return getStimulusColor(stimulus);
  }

  /**
   * Aggregate 11 Muscle Metrics into the 9 User-Facing UI Groups
   */
  function calculateGroupMetrics(muscleMetrics) {
    return UI_GROUPS.map(([name, keys]) => {
      const ms = keys.map(k => muscleMetrics[k]).filter(Boolean);
      const sumEff = ms.reduce((a, m) => a + (m.effectiveSets || 0), 0);
      const sumRaw = ms.reduce((a, m) => a + (m.rawCompletedSets || 0), 0);
      const sumTarget = ms.reduce((a, m) => a + (m.targetSets || 10), 0);

      const validReadiness = ms.map(m => m.readinessScore).filter(s => s != null);
      const avgReadiness = validReadiness.length
        ? Math.round(validReadiness.reduce((a, b) => a + b, 0) / validReadiness.length)
        : null;

      const sumDose = ms.reduce((a, m) => a + (Number.isFinite(m.doseWeekly) ? m.doseWeekly :
        (Number.isFinite(m.uncappedDose) ? m.uncappedDose : 0)), 0);
      const groupStimulus = trainingDoseScore(sumDose, sumTarget) ?? 0;
      const formattedSets = Number.isInteger(sumEff) ? sumEff : sumEff.toFixed(1).replace(/\.0$/, '');

      const groupReadiness = getReadinessState(avgReadiness);

      const statusLabel = `${name} (${formattedSets}/${sumTarget} sets)`;


      return {
        name,
        keys,
        score: avgReadiness,
        readinessScore: avgReadiness,
        stimulusScore: groupStimulus,
        doseWeekly: sumDose,
        statusLabel,
        effectiveSets: sumEff,
        rawCompletedSets: sumRaw,
        targetSets: sumTarget,
        readinessState: groupReadiness
      };
    });
  }

  /**
   * Component 3: Long-Term Progression
   * Evaluates historical performance progression across comparable exercises.
   * Keeps exercise performance trend strictly separate from short-term fatigue or weekly set volume.
   */
  function scoreEpley1RM(log) {
    if (!log || log.skipped || !log.reps || Number(log.reps) <= 0) return 0;
    const w = Number(log.weight) || 0;
    const r = Number(log.reps) || 0;
    if (log.load === 'bodyweight' || (log.load === 'optional' && !w)) {
      return r;
    }
    // Epley formula: w * (1 + reps/30), capped at 30 reps for reasonable extrapolation
    return w * (1 + Math.min(r, 30) / 30);
  }

  function calculateExerciseProgression(exerciseLogs) {
    const insufficient = { status: 'insufficient_evidence', changePct: null, baseline: null, latest: null };
    if (!Array.isArray(exerciseLogs) || exerciseLogs.length < 2) return insufficient;
    // Never infer progression by comparing unrelated exercises.
    const valid = exerciseLogs.filter(validWorkingSet);
    if (valid.length < 2) return insufficient;
    const ids = new Set(valid.map(l => String(l.exId || l.name || '').trim().toLowerCase()).filter(Boolean));
    if (ids.size !== 1 || !ids.size) return { ...insufficient, status: 'incomparable_exercises' };

    // Records with timestamps are compared chronologically, not by arbitrary input order.
    const ordered = [...valid].sort((a, b) => {
      const ta = parseTimestamp(a.loggedAt || a.endedAt || a.startedAt || a.date);
      const tb = parseTimestamp(b.loggedAt || b.endedAt || b.startedAt || b.date);
      return Number.isFinite(ta) && Number.isFinite(tb) ? ta - tb : 0;
    });
    const estimate = l => {
      const w = Number(l.weight) || 0;
      const reps = Number(l.reps);
      const hasRir = l.rir != null && Number.isFinite(Number(l.rir));
      const reserve = hasRir ? Math.max(0, Math.min(5, Number(l.rir))) : 0;
      if (w <= 0) return reps + reserve; // comparable bodyweight reps-to-failure estimate
      return w * (1 + Math.min(30, reps + reserve) / 30);
    };
    const first = ordered[0], last = ordered[ordered.length - 1];
    // A per-dumbbell value must always be compared to the same exercise unit.
    if (first.load && last.load && first.load !== last.load) return { ...insufficient, status: 'incomparable_exercises' };
    const baseline = estimate(first), latest = estimate(last);
    if (baseline <= 0 || !Number.isFinite(latest)) return insufficient;
    const changePct = Math.round(((latest - baseline) / baseline) * 1000) / 10;
    const status = changePct > 1.5 ? 'improving' : (changePct < -1.5 ? 'declining' : 'stable');
    const confidence = first.rir == null || last.rir == null || Number(first.rir) > 5 || Number(last.rir) > 5
      ? 'low' : 'moderate';
    return { status, changePct, baseline, latest, count: ordered.length, confidence,
      loadChangePct: Number(first.weight) > 0 ? Math.round((Number(last.weight) / Number(first.weight) - 1) * 1000) / 10 : null,
      repChange: Number(last.reps) - Number(first.reps),
      rirChange: first.rir != null && last.rir != null ? Number(last.rir) - Number(first.rir) : null };
  }

  // Export engine globally
  window.RepRivalIntelligence = {
    HEAT_KEYS,
    DEFAULT_WEEKLY_TARGETS,
    UI_GROUPS,
    rirStimulusWeight,
    rirFatigueMultiplier,
    sessionSetDiminishingWeight,
    trainingDoseScore,
    validWorkingSet,
    resolveLogMuscle,
    getSecondaryContributions,
    getSupportingContributions,
    calculateMuscleMetrics,
    calculateGroupMetrics,
    getReadinessState,
    scoreEpley1RM,
    calculateExerciseProgression,
    getStimulusColor,
    fillFor,
    STIMULUS_WINDOW_DAYS
  };
})();

