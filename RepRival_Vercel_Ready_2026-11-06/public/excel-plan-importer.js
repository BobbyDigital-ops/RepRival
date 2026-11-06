/* RepRival Excel & CSV Plan Importer — client-side parser using SheetJS (XLSX).
   Supports .xlsx, .xls and .csv workout plan workbooks. */
(function(){
  'use strict';

  // Normalize column headers
  function normKey(k){
    return String(k||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  }

  function parseReps(val){
    if(typeof val === 'number') return { min: val, max: val };
    const s = String(val||'').trim();
    const rangeMatch = s.match(/(\d+)\s*[-–—to]+\s*(\d+)/i);
    if(rangeMatch){
      return { min: parseInt(rangeMatch[1],10), max: parseInt(rangeMatch[2],10) };
    }
    const singleMatch = s.match(/(\d+)/);
    if(singleMatch){
      const n = parseInt(singleMatch[1],10);
      return { min: n, max: n };
    }
    return { min: 8, max: 12 };
  }

  function parseSets(val){
    const n = parseInt(val, 10);
    return (Number.isFinite(n) && n > 0 && n <= 10) ? n : 3;
  }

  function parseRest(val){
    if(!val) return { min: 75, max: 90 };
    const s = String(val).replace(/s|sec|seconds/gi,'').trim();
    const m = s.match(/(\d+)\s*[-–—to]+\s*(\d+)/);
    if(m) return { min: parseInt(m[1],10), max: parseInt(m[2],10) };
    const n = parseInt(s, 10);
    if(Number.isFinite(n) && n > 0) return { min: Math.max(30, n - 15), max: n + 15 };
    return { min: 75, max: 90 };
  }

  function detectMuscle(name, fallback){
    if(fallback && window.HEAT_KEYS && window.HEAT_KEYS.includes(fallback)) return fallback;
    const lib = window.REPRIVAL_EXERCISE_LIBRARY;
    if(lib && lib.entries){
      const match = lib.entries.find(e => e.name.toLowerCase() === name.toLowerCase() || e.id === name.toLowerCase().replace(/[^a-z0-9]+/g,'_'));
      if(match) return match.muscle;
    }
    const s = name.toLowerCase();
    if(/bench|press.*chest|push.up|pec|fly|dip/i.test(s)) return 'Chest';
    if(/row|pulldown|pull.up|chin.up|lat/i.test(s)) return 'Back';
    if(/lateral.raise|overhead.*press|shoulder|military/i.test(s)) return 'Side delts';
    if(/rear.delt|face.pull|reverse.fly/i.test(s)) return 'Rear delts';
    if(/curl|bicep/i.test(s)) return 'Biceps';
    if(/tricep|skull|pushdown|extension/i.test(s)) return 'Triceps';
    if(/squat|lunge|leg.press|step.up|quad/i.test(s)) return 'Quads';
    if(/deadlift|rdl|romanian|hamstring|leg.curl/i.test(s)) return 'Hamstrings';
    if(/thrust|glute|bridge/i.test(s)) return 'Glutes';
    if(/calf|calves/i.test(s)) return 'Calves';
    if(/abs|core|rollout|plank|sit.up|crunch/i.test(s)) return 'Core';
    return fallback || 'Chest';
  }

  function parseWorkbook(workbook, defaultTitle){
    const days = {};
    const sheetNames = workbook.SheetNames || [];

    sheetNames.forEach((sheetName, sIdx) => {
      const sheet = workbook.Sheets[sheetName];
      if(!sheet) return;
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if(!rows || !rows.length) return;

      rows.forEach((rawRow, rIdx) => {
        // Map keys
        const mapped = {};
        for(const [k, v] of Object.entries(rawRow)){
          mapped[normKey(k)] = v;
        }

        const dayRaw = mapped['day'] || mapped['session'] || mapped['workout'] || mapped['split'] || mapped['routine'] || (sheetNames.length > 1 ? sheetName : 'Session A');
        const dayName = String(dayRaw).trim() || 'Session A';

        const exNameRaw = mapped['exercise'] || mapped['exercisename'] || mapped['movement'] || mapped['lift'] || mapped['name'];
        if(!exNameRaw || !String(exNameRaw).trim()) return;
        const exName = String(exNameRaw).trim();

        const pairRaw = mapped['superset'] || mapped['pair'] || mapped['block'] || mapped['group'] || mapped['pairid'];
        let pairLabel = String(pairRaw||'').trim().toUpperCase();
        if(!pairLabel){
          // Auto-pair every 2 exercises into superset A, B, C...
          const currentDayCount = days[dayName]?.exercises?.length || 0;
          const pairLetter = String.fromCharCode(65 + Math.floor(currentDayCount / 2));
          pairLabel = pairLetter;
        }

        const muscleRaw = mapped['muscle'] || mapped['musclegroup'] || mapped['target'] || mapped['bodypart'];
        const muscle = detectMuscle(exName, String(muscleRaw).trim());

        const sets = parseSets(mapped['sets'] || mapped['setcount']);
        const reps = parseReps(mapped['reps'] || mapped['repmut'] || mapped['reprange']);
        const rest = parseRest(mapped['rest'] || mapped['restseconds'] || mapped['resttime']);
        const load = String(mapped['load'] || mapped['loadtype'] || mapped['weight'] || 'combined').toLowerCase().includes('body') ? 'bodyweight' : 'combined';

        if(!days[dayName]){
          days[dayName] = { name: dayName, exercises: [] };
        }

        const exId = 'custom_' + exName.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');

        days[dayName].exercises.push({
          id: exId,
          name: exName,
          muscle: muscle,
          sets: sets,
          min: reps.min,
          max: reps.max,
          load: load,
          pairLabel: pairLabel,
          restMin: rest.min,
          restMax: rest.max
        });
      });
    });

    const dayKeys = Object.keys(days);
    if(!dayKeys.length) return null;

    // Build RepRival plan format: { A: { name, pairs: [ { id, restMin, restMax, exercises } ] } }
    const letters = ['A','B','C','D','E','F','G','H'];
    const sessions = {};
    let totalExercises = 0;
    const allMuscles = new Set();

    dayKeys.forEach((dName, idx) => {
      const code = letters[idx] || ('D' + (idx+1));
      const dayData = days[dName];

      // Group exercises into pairs
      const pairGroups = {};
      dayData.exercises.forEach(e => {
        const pKey = e.pairLabel || 'A';
        if(!pairGroups[pKey]) pairGroups[pKey] = [];
        pairGroups[pKey].push(e);
        allMuscles.add(e.muscle);
        totalExercises++;
      });

      const pairs = Object.entries(pairGroups).map(([pId, exs], pIdx) => {
        const restMin = exs[0]?.restMin || 75;
        const restMax = exs[0]?.restMax || 90;
        return {
          id: pId || letters[pIdx] || String(pIdx+1),
          restMin: restMin,
          restMax: restMax,
          exercises: exs.map(e => ({
            id: e.id,
            name: e.name,
            muscle: e.muscle,
            sets: e.sets,
            min: e.min,
            max: e.max,
            load: e.load
          }))
        };
      });

      sessions[code] = {
        name: dayData.name || ('Workout ' + code),
        subtitle: `${pairs.length} blocks · guided sets`,
        pairs: pairs
      };
    });

    const planId = 'imported_' + Date.now().toString(36);
    const planTitle = defaultTitle || (dayKeys.length > 1 ? `${dayKeys.length}-Day Custom Split` : (dayKeys[0] || 'Imported Workout Plan'));

    return {
      id: planId,
      title: planTitle,
      sessions: sessions,
      summary: {
        sessionCount: dayKeys.length,
        exerciseCount: totalExercises,
        muscles: Array.from(allMuscles)
      }
    };
  }

  function generateSampleTemplate(format){
    const sampleRows = [
      { Day: 'Full Body A', Superset: 'A', Exercise: 'Low-incline DB press', Muscle: 'Chest', Sets: 3, Reps: '6-10', Load: 'combined', Rest: '90s' },
      { Day: 'Full Body A', Superset: 'A', Exercise: 'Inverted row • neutral', Muscle: 'Back', Sets: 3, Reps: '8-12', Load: 'bodyweight', Rest: '90s' },
      { Day: 'Full Body A', Superset: 'B', Exercise: 'Reverse lunge', Muscle: 'Quads', Sets: 3, Reps: '8-10', Load: 'combined', Rest: '75s' },
      { Day: 'Full Body A', Superset: 'B', Exercise: 'Incline DB curl', Muscle: 'Biceps', Sets: 2, Reps: '10-15', Load: 'combined', Rest: '75s' },
      { Day: 'Full Body A', Superset: 'C', Exercise: 'DB lateral raise', Muscle: 'Side delts', Sets: 2, Reps: '12-15', Load: 'combined', Rest: '60s' },
      { Day: 'Full Body A', Superset: 'C', Exercise: 'Ab rollout', Muscle: 'Core', Sets: 2, Reps: '10-12', Load: 'bodyweight', Rest: '60s' },

      { Day: 'Full Body B', Superset: 'A', Exercise: 'Flat DB bench press', Muscle: 'Chest', Sets: 3, Reps: '6-8', Load: 'combined', Rest: '90s' },
      { Day: 'Full Body B', Superset: 'A', Exercise: 'Chest-supported DB row', Muscle: 'Back', Sets: 3, Reps: '8-10', Load: 'combined', Rest: '90s' },
      { Day: 'Full Body B', Superset: 'B', Exercise: 'DB Romanian deadlift', Muscle: 'Hamstrings', Sets: 3, Reps: '8-10', Load: 'combined', Rest: '90s' },
      { Day: 'Full Body B', Superset: 'B', Exercise: 'Chest-supported rear fly', Muscle: 'Rear delts', Sets: 2, Reps: '12-15', Load: 'combined', Rest: '60s' },
      { Day: 'Full Body B', Superset: 'C', Exercise: 'Overhead DB triceps extension', Muscle: 'Triceps', Sets: 2, Reps: '10-12', Load: 'combined', Rest: '60s' },
      { Day: 'Full Body B', Superset: 'C', Exercise: 'DB calf raise', Muscle: 'Calves', Sets: 3, Reps: '15-20', Load: 'combined', Rest: '60s' },

      { Day: 'Full Body C', Superset: 'A', Exercise: 'Goblet squat', Muscle: 'Quads', Sets: 3, Reps: '8-10', Load: 'single', Rest: '90s' },
      { Day: 'Full Body C', Superset: 'A', Exercise: 'Chin-up', Muscle: 'Back', Sets: 3, Reps: '6-8', Load: 'bodyweight', Rest: '90s' },
      { Day: 'Full Body C', Superset: 'B', Exercise: 'DB glute bridge', Muscle: 'Glutes', Sets: 3, Reps: '10-12', Load: 'combined', Rest: '75s' },
      { Day: 'Full Body C', Superset: 'B', Exercise: 'Hammer curl', Muscle: 'Biceps', Sets: 2, Reps: '10-12', Load: 'combined', Rest: '60s' },
      { Day: 'Full Body C', Superset: 'C', Exercise: 'Flat DB pec fly', Muscle: 'Chest', Sets: 2, Reps: '10-12', Load: 'combined', Rest: '60s' },
      { Day: 'Full Body C', Superset: 'C', Exercise: 'Decline sit-up', Muscle: 'Core', Sets: 2, Reps: '12-15', Load: 'optional', Rest: '60s' }
    ];

    if(format === 'csv'){
      const headers = ['Day','Superset','Exercise','Muscle','Sets','Reps','Load','Rest'];
      const csv = [headers.join(',')].concat(sampleRows.map(r => [
        `"${r.Day}"`,
        `"${r.Superset}"`,
        `"${r.Exercise}"`,
        `"${r.Muscle}"`,
        r.Sets,
        `"${r.Reps}"`,
        `"${r.Load}"`,
        `"${r.Rest}"`
      ].join(','))).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'RepRival_Workout_Plan_Template.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    }

    if(window.XLSX){
      const ws = window.XLSX.utils.json_to_sheet(sampleRows);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Workout Plan');
      window.XLSX.writeFile(wb, 'RepRival_Workout_Plan_Template.xlsx');
    }
  }

  function parseFile(file){
    return new Promise((resolve, reject) => {
      if(!file){
        reject(new Error('No file provided'));
        return;
      }
      if(!window.XLSX){
        reject(new Error('SheetJS (XLSX) library is not loaded.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = function(e){
        try{
          const data = new Uint8Array(e.target.result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          const baseName = (file.name || 'Custom Plan').replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
          const planTitle = baseName.charAt(0).toUpperCase() + baseName.slice(1);
          const result = parseWorkbook(workbook, planTitle);
          if(!result || !result.sessions || !Object.keys(result.sessions).length){
            reject(new Error('No valid workout sessions could be parsed from the file. Ensure headers like Day, Exercise, Sets, Reps are present.'));
            return;
          }
          resolve(result);
        }catch(err){
          reject(new Error('Failed to parse spreadsheet: ' + (err.message || err)));
        }
      };
      reader.onerror = function(){
        reject(new Error('Error reading uploaded file.'));
      };
      reader.readAsArrayBuffer(file);
    });
  }

  window.RepRivalPlanImporter = {
    parseWorkbook,
    parseFile,
    generateSampleTemplate
  };
})();
