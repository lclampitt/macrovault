import React, { memo, useMemo } from 'react';

const PRIMARY   = '#1D9E75';
const SECONDARY = '#0F6E56';
const INACTIVE  = '#2a3548';
const STRUCT    = '#2a3548'; // head, neck, forearms — never highlighted

/* ── Muscle name → region IDs ───────────────────────────────── */
const MUSCLE_MAP = {
  // Chest
  'pectoralis major':  ['chest-left', 'chest-right'],
  'upper pectoralis':  ['chest-left', 'chest-right'],
  'lower pectoralis':  ['chest-left', 'chest-right'],
  'chest':             ['chest-left', 'chest-right'],
  // Back
  'latissimus dorsi':  ['lat-left', 'lat-right'],
  'lats':              ['lat-left', 'lat-right'],
  'back':              ['lat-left', 'lat-right', 'lower-back'],
  'trapezius':         ['traps'],
  'traps':             ['traps'],
  'rhomboids':         ['traps'],
  'lower back':        ['lower-back'],
  'erector spinae':    ['lower-back'],
  'erectors':          ['lower-back'],
  'lumbar':            ['lower-back'],
  // Shoulders
  'deltoid':           ['front-delt-left', 'front-delt-right', 'rear-delt-left', 'rear-delt-right'],
  'deltoids':          ['front-delt-left', 'front-delt-right', 'rear-delt-left', 'rear-delt-right'],
  'shoulders':         ['front-delt-left', 'front-delt-right', 'rear-delt-left', 'rear-delt-right'],
  'front deltoids':    ['front-delt-left', 'front-delt-right'],
  'anterior deltoid':  ['front-delt-left', 'front-delt-right'],
  'lateral deltoid':   ['front-delt-left', 'front-delt-right', 'rear-delt-left', 'rear-delt-right'],
  'rear deltoids':     ['rear-delt-left', 'rear-delt-right'],
  'posterior deltoid': ['rear-delt-left', 'rear-delt-right'],
  // Arms
  'biceps':            ['bicep-left', 'bicep-right'],
  'bicep':             ['bicep-left', 'bicep-right'],
  'biceps brachii':    ['bicep-left', 'bicep-right'],
  'triceps':           ['tricep-left', 'tricep-right'],
  'tricep':            ['tricep-left', 'tricep-right'],
  'triceps brachii':   ['tricep-left', 'tricep-right'],
  // Core
  'abs':               ['abs'],
  'abdominals':        ['abs'],
  'rectus abdominis':  ['abs'],
  'core':              ['abs', 'oblique-left', 'oblique-right'],
  'obliques':          ['oblique-left', 'oblique-right'],
  'external obliques': ['oblique-left', 'oblique-right'],
  'serratus anterior': ['oblique-left', 'oblique-right'],
  // Legs
  'quadriceps':        ['quad-left', 'quad-right'],
  'quads':             ['quad-left', 'quad-right'],
  'quadriceps femoris':['quad-left', 'quad-right'],
  'legs':              ['quad-left', 'quad-right'],
  'hamstrings':        ['hamstring-left', 'hamstring-right'],
  'hamstring':         ['hamstring-left', 'hamstring-right'],
  'glutes':            ['glute-left', 'glute-right'],
  'gluteus':           ['glute-left', 'glute-right'],
  'gluteus maximus':   ['glute-left', 'glute-right'],
  'glute':             ['glute-left', 'glute-right'],
  'calves':            ['calf-left', 'calf-right'],
  'calf':              ['calf-left', 'calf-right'],
  'gastrocnemius':     ['calf-left', 'calf-right'],
  'adductors':         ['adductor-left', 'adductor-right'],
  'inner thigh':       ['adductor-left', 'adductor-right'],
  'tibialis anterior': ['tibialis-left', 'tibialis-right'],
  // No-ops
  'forearms':          [],
  'wrists':            [],
};

function muscleToRegions(muscle) {
  if (!muscle) return [];
  const lower = muscle.toLowerCase().trim();
  if (MUSCLE_MAP[lower] !== undefined) return MUSCLE_MAP[lower];
  // partial match
  for (const [key, regions] of Object.entries(MUSCLE_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return regions;
  }
  return [];
}

const SIZE_MAP = {
  sm: { width: 87,  height: 80  },
  md: { width: 142, height: 130 },
  lg: { width: 240, height: 220 },
};

const MuscleMap = memo(function MuscleMap({ targetMuscle, secondaryMuscles = [], size = 'md' }) {
  const { width, height } = SIZE_MAP[size] || SIZE_MAP.md;

  const primarySet = useMemo(
    () => new Set(muscleToRegions(targetMuscle)),
    [targetMuscle],
  );

  const secondarySet = useMemo(() => {
    const s = new Set();
    (secondaryMuscles || []).forEach((m) => muscleToRegions(m).forEach((r) => s.add(r)));
    return s;
  }, [secondaryMuscles]);

  function regionFill(id) {
    if (primarySet.has(id))   return PRIMARY;
    if (secondarySet.has(id)) return SECONDARY;
    return INACTIVE;
  }

  function regionOpacity(id) {
    return secondarySet.has(id) ? 0.75 : 1;
  }

  // Shorthand: props for a highlightable region
  function rp(id) {
    return { fill: regionFill(id), opacity: regionOpacity(id) };
  }

  return (
    <svg
      viewBox="0 0 120 110"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="120" height="110" fill="#0a0d13" />

      {/* Divider */}
      <line x1="60" y1="4" x2="60" y2="106" stroke="#1a2538" strokeWidth="0.6" />

      {/* ═══════════ FRONT FIGURE (center x=30) ═══════════ */}

      {/* Head */}
      <ellipse cx="30" cy="8" rx="6" ry="7" fill={STRUCT} />
      {/* Neck */}
      <rect x="27.5" y="14" width="5" height="4" rx="1" fill={STRUCT} />

      {/* Front Delts */}
      <ellipse cx="18.5" cy="22.5" rx="5" ry="5.5" {...rp('front-delt-left')} />
      <ellipse cx="41.5" cy="22.5" rx="5" ry="5.5" {...rp('front-delt-right')} />

      {/* Chest */}
      <ellipse cx="24"   cy="26.5" rx="6" ry="5"   {...rp('chest-left')} />
      <ellipse cx="36"   cy="26.5" rx="6" ry="5"   {...rp('chest-right')} />

      {/* Biceps */}
      <rect x="11"  y="27" width="5.5" height="13" rx="2.5" {...rp('bicep-left')} />
      <rect x="43.5" y="27" width="5.5" height="13" rx="2.5" {...rp('bicep-right')} />

      {/* Forearms (structural) */}
      <rect x="11.5" y="42" width="4.5" height="10" rx="2" fill={STRUCT} />
      <rect x="44"   y="42" width="4.5" height="10" rx="2" fill={STRUCT} />

      {/* Abs */}
      <rect x="24.5" y="31.5" width="11" height="17" rx="2" {...rp('abs')} />

      {/* Obliques */}
      <rect x="17" y="32" width="7.5" height="13" rx="2" {...rp('oblique-left')} />
      <rect x="35.5" y="32" width="7.5" height="13" rx="2" {...rp('oblique-right')} />

      {/* Quads */}
      <rect x="21"  y="50" width="8.5" height="20" rx="3" {...rp('quad-left')} />
      <rect x="30.5" y="50" width="8.5" height="20" rx="3" {...rp('quad-right')} />

      {/* Adductors (inner quads) */}
      <ellipse cx="26.5" cy="59" rx="3" ry="7" {...rp('adductor-left')} />
      <ellipse cx="33.5" cy="59" rx="3" ry="7" {...rp('adductor-right')} />

      {/* Tibialis (lower leg front) */}
      <rect x="22"  y="72" width="6" height="13" rx="2" {...rp('tibialis-left')} />
      <rect x="32"  y="72" width="6" height="13" rx="2" {...rp('tibialis-right')} />

      {/* ═══════════ BACK FIGURE (center x=90) ═══════════ */}

      {/* Head */}
      <ellipse cx="90" cy="8" rx="6" ry="7" fill={STRUCT} />
      {/* Neck */}
      <rect x="87.5" y="14" width="5" height="4" rx="1" fill={STRUCT} />

      {/* Rear Delts */}
      <ellipse cx="78.5" cy="22.5" rx="5" ry="5.5" {...rp('rear-delt-left')} />
      <ellipse cx="101.5" cy="22.5" rx="5" ry="5.5" {...rp('rear-delt-right')} />

      {/* Traps */}
      <polygon points="82.5,18 97.5,18 102,30 78,30" {...rp('traps')} />

      {/* Lats */}
      <rect x="72"  y="30" width="10" height="16" rx="3" {...rp('lat-left')} />
      <rect x="98"  y="30" width="10" height="16" rx="3" {...rp('lat-right')} />

      {/* Lower Back */}
      <rect x="83.5" y="39" width="13" height="9" rx="2" {...rp('lower-back')} />

      {/* Triceps */}
      <rect x="70"   y="27" width="5.5" height="13" rx="2.5" {...rp('tricep-left')} />
      <rect x="104.5" y="27" width="5.5" height="13" rx="2.5" {...rp('tricep-right')} />

      {/* Forearms back (structural) */}
      <rect x="70.5" y="42" width="4.5" height="10" rx="2" fill={STRUCT} />
      <rect x="105"  y="42" width="4.5" height="10" rx="2" fill={STRUCT} />

      {/* Glutes */}
      <ellipse cx="84"  cy="53" rx="7"  ry="6.5" {...rp('glute-left')} />
      <ellipse cx="96"  cy="53" rx="7"  ry="6.5" {...rp('glute-right')} />

      {/* Hamstrings */}
      <rect x="80"  y="60" width="9" height="19" rx="3" {...rp('hamstring-left')} />
      <rect x="91"  y="60" width="9" height="19" rx="3" {...rp('hamstring-right')} />

      {/* Calves */}
      <rect x="81.5" y="81" width="7" height="14" rx="3" {...rp('calf-left')} />
      <rect x="91.5" y="81" width="7" height="14" rx="3" {...rp('calf-right')} />

      {/* Labels */}
      <text x="30" y="107" textAnchor="middle" fontSize="5" fill="#3d4f6a" fontFamily="system-ui,sans-serif">FRONT</text>
      <text x="90" y="107" textAnchor="middle" fontSize="5" fill="#3d4f6a" fontFamily="system-ui,sans-serif">BACK</text>
    </svg>
  );
});

export default MuscleMap;
