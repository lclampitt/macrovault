import React from 'react';

/* ── Color tokens ─────────────────────────────────────────── */
const BG       = '#0f1117';
const SILHOUETTE = '#2a3548';
const PRIMARY  = '#1D9E75';
const SECONDARY = '#0F6E56';

/* ══════════════════════════════════════════════════════════════
   CHEST SVG
══════════════════════════════════════════════════════════════ */
function ChestSVG({ primary, secondary }) {
  const isPrimary   = (g) => primary.includes(g);
  const isSecondary = (g) => secondary.includes(g);
  const color = (g) => isPrimary(g) ? PRIMARY : isSecondary(g) ? SECONDARY : SILHOUETTE;

  return (
    <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      {/* Background */}
      <rect width="120" height="160" fill={BG} />
      {/* Body silhouette */}
      <ellipse cx="60" cy="38" rx="18" ry="20" fill={SILHOUETTE} /> {/* Head */}
      <path d="M34 65 Q60 58 86 65 L90 130 Q60 138 30 130 Z" fill={SILHOUETTE} /> {/* Torso */}
      <path d="M34 65 L18 105 L26 108 L38 75" fill={SILHOUETTE} /> {/* Left arm */}
      <path d="M86 65 L102 105 L94 108 L82 75" fill={SILHOUETTE} /> {/* Right arm */}
      <path d="M38 130 L34 160 L46 160 L50 130" fill={SILHOUETTE} /> {/* Left leg */}
      <path d="M82 130 L86 160 L74 160 L70 130" fill={SILHOUETTE} /> {/* Right leg */}

      {/* Pecs */}
      <path d="M38 70 Q60 65 82 70 L80 88 Q60 93 40 88 Z" fill={color('chest')} opacity="0.9" />
      {/* Upper pecs */}
      <path d="M40 68 Q60 64 80 68 L82 72 Q60 68 38 72 Z" fill={color('upper-pec')} opacity="0.8" />
      {/* Front delts */}
      <ellipse cx="34" cy="68" rx="6" ry="8" fill={color('front-delt')} opacity="0.85" />
      <ellipse cx="86" cy="68" rx="6" ry="8" fill={color('front-delt')} opacity="0.85" />
      {/* Triceps */}
      <path d="M18 80 L26 80 L32 100 L22 102 Z" fill={color('tricep')} opacity="0.8" />
      <path d="M102 80 L94 80 L88 100 L98 102 Z" fill={color('tricep')} opacity="0.8" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   BACK SVG
══════════════════════════════════════════════════════════════ */
function BackSVG({ primary, secondary }) {
  const isPrimary   = (g) => primary.includes(g);
  const isSecondary = (g) => secondary.includes(g);
  const color = (g) => isPrimary(g) ? PRIMARY : isSecondary(g) ? SECONDARY : SILHOUETTE;

  return (
    <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="120" height="160" fill={BG} />
      {/* Body (back view) */}
      <ellipse cx="60" cy="38" rx="18" ry="20" fill={SILHOUETTE} />
      <path d="M34 65 Q60 58 86 65 L90 130 Q60 138 30 130 Z" fill={SILHOUETTE} />
      <path d="M34 65 L18 105 L26 108 L38 75" fill={SILHOUETTE} />
      <path d="M86 65 L102 105 L94 108 L82 75" fill={SILHOUETTE} />
      <path d="M38 130 L34 160 L46 160 L50 130" fill={SILHOUETTE} />
      <path d="M82 130 L86 160 L74 160 L70 130" fill={SILHOUETTE} />

      {/* Traps */}
      <path d="M42 62 Q60 56 78 62 L76 72 Q60 68 44 72 Z" fill={color('trap')} opacity="0.9" />
      {/* Lats */}
      <path d="M36 72 L48 72 L52 105 L36 110 Z" fill={color('lat')} opacity="0.9" />
      <path d="M84 72 L72 72 L68 105 L84 110 Z" fill={color('lat')} opacity="0.9" />
      {/* Rhomboids */}
      <path d="M48 72 Q60 68 72 72 L70 88 Q60 84 50 88 Z" fill={color('rhomboid')} opacity="0.85" />
      {/* Erectors */}
      <rect x="55" y="88" width="5" height="38" rx="2" fill={color('erector')} opacity="0.8" />
      <rect x="60" y="88" width="5" height="38" rx="2" fill={color('erector')} opacity="0.8" />
      {/* Rear delts */}
      <ellipse cx="34" cy="69" rx="6" ry="7" fill={color('rear-delt')} opacity="0.85" />
      <ellipse cx="86" cy="69" rx="6" ry="7" fill={color('rear-delt')} opacity="0.85" />
      {/* Glutes */}
      <ellipse cx="48" cy="126" rx="14" ry="10" fill={color('glute')} opacity="0.85" />
      <ellipse cx="72" cy="126" rx="14" ry="10" fill={color('glute')} opacity="0.85" />
      {/* Hamstrings */}
      <path d="M36 136 L52 136 L50 158 L34 158 Z" fill={color('hamstring')} opacity="0.8" />
      <path d="M84 136 L68 136 L70 158 L86 158 Z" fill={color('hamstring')} opacity="0.8" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   SHOULDERS SVG
══════════════════════════════════════════════════════════════ */
function ShouldersSVG({ primary, secondary }) {
  const isPrimary   = (g) => primary.includes(g);
  const isSecondary = (g) => secondary.includes(g);
  const color = (g) => isPrimary(g) ? PRIMARY : isSecondary(g) ? SECONDARY : SILHOUETTE;

  return (
    <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="120" height="160" fill={BG} />
      <ellipse cx="60" cy="38" rx="18" ry="20" fill={SILHOUETTE} />
      <path d="M34 65 Q60 58 86 65 L90 130 Q60 138 30 130 Z" fill={SILHOUETTE} />
      <path d="M34 65 L18 105 L26 108 L38 75" fill={SILHOUETTE} />
      <path d="M86 65 L102 105 L94 108 L82 75" fill={SILHOUETTE} />
      <path d="M38 130 L34 160 L46 160 L50 130" fill={SILHOUETTE} />
      <path d="M82 130 L86 160 L74 160 L70 130" fill={SILHOUETTE} />

      {/* Deltoids — lateral */}
      <ellipse cx="30" cy="70" rx="9" ry="10" fill={color('lateral-delt')} opacity="0.95" />
      <ellipse cx="90" cy="70" rx="9" ry="10" fill={color('lateral-delt')} opacity="0.95" />
      {/* Front deltoids */}
      <ellipse cx="36" cy="67" rx="7" ry="8" fill={color('front-delt')} opacity="0.85" />
      <ellipse cx="84" cy="67" rx="7" ry="8" fill={color('front-delt')} opacity="0.85" />
      {/* Rear deltoids */}
      <ellipse cx="34" cy="73" rx="6" ry="7" fill={color('rear-delt')} opacity="0.75" />
      <ellipse cx="86" cy="73" rx="6" ry="7" fill={color('rear-delt')} opacity="0.75" />
      {/* Traps */}
      <path d="M44 62 Q60 56 76 62 L74 70 Q60 66 46 70 Z" fill={color('trap')} opacity="0.85" />
      {/* Triceps */}
      <path d="M20 78 L28 78 L32 100 L22 102 Z" fill={color('tricep')} opacity="0.75" />
      <path d="M100 78 L92 78 L88 100 L98 102 Z" fill={color('tricep')} opacity="0.75" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   ARMS SVG
══════════════════════════════════════════════════════════════ */
function ArmsSVG({ primary, secondary }) {
  const isPrimary   = (g) => primary.includes(g);
  const isSecondary = (g) => secondary.includes(g);
  const color = (g) => isPrimary(g) ? PRIMARY : isSecondary(g) ? SECONDARY : SILHOUETTE;

  return (
    <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="120" height="160" fill={BG} />
      <ellipse cx="60" cy="38" rx="18" ry="20" fill={SILHOUETTE} />
      <path d="M34 65 Q60 58 86 65 L90 130 Q60 138 30 130 Z" fill={SILHOUETTE} />
      <path d="M38 130 L34 160 L46 160 L50 130" fill={SILHOUETTE} />
      <path d="M82 130 L86 160 L74 160 L70 130" fill={SILHOUETTE} />

      {/* Upper arms silhouette */}
      <path d="M34 65 L16 108 L26 112 L38 76" fill={SILHOUETTE} />
      <path d="M86 65 L104 108 L94 112 L82 76" fill={SILHOUETTE} />
      {/* Forearms */}
      <path d="M16 108 L10 138 L20 140 L26 112" fill={SILHOUETTE} />
      <path d="M104 108 L110 138 L100 140 L94 112" fill={SILHOUETTE} />

      {/* Biceps */}
      <path d="M22 72 L34 72 L36 96 L20 92 Z" fill={color('bicep')} opacity="0.95" />
      <path d="M98 72 L86 72 L84 96 L100 92 Z" fill={color('bicep')} opacity="0.95" />
      {/* Triceps */}
      <path d="M16 76 L24 76 L26 104 L14 100 Z" fill={color('tricep')} opacity="0.85" />
      <path d="M104 76 L96 76 L94 104 L106 100 Z" fill={color('tricep')} opacity="0.85" />
      {/* Forearms */}
      <path d="M14 104 L22 104 L20 136 L10 134 Z" fill={color('forearm')} opacity="0.8" />
      <path d="M106 104 L98 104 L100 136 L110 134 Z" fill={color('forearm')} opacity="0.8" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   LEGS SVG
══════════════════════════════════════════════════════════════ */
function LegsSVG({ primary, secondary }) {
  const isPrimary   = (g) => primary.includes(g);
  const isSecondary = (g) => secondary.includes(g);
  const color = (g) => isPrimary(g) ? PRIMARY : isSecondary(g) ? SECONDARY : SILHOUETTE;

  return (
    <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="120" height="160" fill={BG} />
      <ellipse cx="60" cy="22" rx="14" ry="16" fill={SILHOUETTE} />
      <path d="M38 44 Q60 38 82 44 L84 90 Q60 96 36 90 Z" fill={SILHOUETTE} />

      {/* Left leg */}
      <path d="M36 90 L32 160 L48 160 L50 90" fill={SILHOUETTE} />
      {/* Right leg */}
      <path d="M84 90 L88 160 L72 160 L70 90" fill={SILHOUETTE} />

      {/* Quads */}
      <path d="M37 90 L50 90 L48 130 L35 128 Z" fill={color('quad')} opacity="0.95" />
      <path d="M83 90 L70 90 L72 130 L85 128 Z" fill={color('quad')} opacity="0.95" />
      {/* Hamstrings */}
      <path d="M34 92 L42 92 L40 132 L32 130 Z" fill={color('hamstring')} opacity="0.85" />
      <path d="M86 92 L78 92 L80 132 L88 130 Z" fill={color('hamstring')} opacity="0.85" />
      {/* Glutes */}
      <ellipse cx="43" cy="92" rx="10" ry="8" fill={color('glute')} opacity="0.9" />
      <ellipse cx="77" cy="92" rx="10" ry="8" fill={color('glute')} opacity="0.9" />
      {/* Calves */}
      <path d="M34 130 L48 130 L46 158 L34 158 Z" fill={color('calf')} opacity="0.85" />
      <path d="M86 130 L72 130 L74 158 L86 158 Z" fill={color('calf')} opacity="0.85" />
      {/* Adductors */}
      <path d="M46 92 L56 92 L54 130 L44 128 Z" fill={color('adductor')} opacity="0.75" />
      <path d="M74 92 L64 92 L66 130 L76 128 Z" fill={color('adductor')} opacity="0.75" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   CORE SVG
══════════════════════════════════════════════════════════════ */
function CoreSVG({ primary, secondary }) {
  const isPrimary   = (g) => primary.includes(g);
  const isSecondary = (g) => secondary.includes(g);
  const color = (g) => isPrimary(g) ? PRIMARY : isSecondary(g) ? SECONDARY : SILHOUETTE;

  return (
    <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="120" height="160" fill={BG} />
      <ellipse cx="60" cy="28" rx="16" ry="18" fill={SILHOUETTE} />
      <path d="M36 54 Q60 48 84 54 L86 130 Q60 136 34 130 Z" fill={SILHOUETTE} />
      <path d="M36 54 L22 95 L30 98 L42 62" fill={SILHOUETTE} />
      <path d="M84 54 L98 95 L90 98 L78 62" fill={SILHOUETTE} />
      <path d="M40 130 L36 160 L48 160 L52 130" fill={SILHOUETTE} />
      <path d="M80 130 L84 160 L72 160 L68 130" fill={SILHOUETTE} />

      {/* Rectus abdominis — segmented */}
      <rect x="54" y="62" width="6" height="9" rx="2" fill={color('rectus')} opacity="0.95" />
      <rect x="60" y="62" width="6" height="9" rx="2" fill={color('rectus')} opacity="0.95" />
      <rect x="54" y="73" width="6" height="9" rx="2" fill={color('rectus')} opacity="0.95" />
      <rect x="60" y="73" width="6" height="9" rx="2" fill={color('rectus')} opacity="0.95" />
      <rect x="54" y="84" width="6" height="9" rx="2" fill={color('rectus')} opacity="0.95" />
      <rect x="60" y="84" width="6" height="9" rx="2" fill={color('rectus')} opacity="0.95" />
      <rect x="54" y="95" width="6" height="9" rx="2" fill={color('rectus')} opacity="0.9" />
      <rect x="60" y="95" width="6" height="9" rx="2" fill={color('rectus')} opacity="0.9" />

      {/* Obliques */}
      <path d="M38 68 L52 68 L50 116 L36 112 Z" fill={color('oblique')} opacity="0.85" />
      <path d="M82 68 L68 68 L70 116 L84 112 Z" fill={color('oblique')} opacity="0.85" />

      {/* Transverse (deep) — subtle */}
      <ellipse cx="60" cy="108" rx="14" ry="8" fill={color('transverse')} opacity="0.6" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   FULL BODY SVG
══════════════════════════════════════════════════════════════ */
function FullBodySVG({ primary, secondary }) {
  return (
    <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="120" height="160" fill={BG} />
      <ellipse cx="60" cy="20" rx="14" ry="16" fill={PRIMARY} opacity="0.9" />
      <path d="M36 42 Q60 36 84 42 L86 88 Q60 94 34 88 Z" fill={PRIMARY} opacity="0.9" />
      <path d="M36 42 L20 82 L28 86 L40 52" fill={SECONDARY} opacity="0.85" />
      <path d="M84 42 L100 82 L92 86 L80 52" fill={SECONDARY} opacity="0.85" />
      <path d="M38 88 L34 158 L48 158 L50 88" fill={PRIMARY} opacity="0.85" />
      <path d="M82 88 L86 158 L72 158 L70 88" fill={PRIMARY} opacity="0.85" />
      {/* Muscle highlights */}
      <path d="M40 46 Q60 42 80 46 L78 60 Q60 64 42 60 Z" fill={PRIMARY} opacity="0.95" />
      <ellipse cx="36" cy="46" rx="7" ry="9" fill={PRIMARY} opacity="0.9" />
      <ellipse cx="84" cy="46" rx="7" ry="9" fill={PRIMARY} opacity="0.9" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   MUSCLE → REGION MAPPING
══════════════════════════════════════════════════════════════ */
const MUSCLE_MAP = {
  // chest
  'pectoralis major': ['chest'],
  'pectoralis': ['chest'],
  'upper pectoralis': ['upper-pec', 'chest'],
  'lower pectoralis': ['chest'],
  'chest': ['chest'],
  // back
  'latissimus dorsi': ['lat'],
  'lats': ['lat'],
  'rhomboids': ['rhomboid'],
  'trapezius': ['trap'],
  'traps': ['trap'],
  'erector spinae': ['erector'],
  'rear deltoids': ['rear-delt'],
  'rear delts': ['rear-delt'],
  // shoulders
  'deltoids': ['lateral-delt', 'front-delt', 'rear-delt'],
  'lateral deltoids': ['lateral-delt'],
  'front deltoids': ['front-delt'],
  // arms
  'biceps brachii': ['bicep'],
  'biceps': ['bicep'],
  'brachialis': ['bicep'],
  'triceps brachii': ['tricep'],
  'triceps': ['tricep'],
  'forearms': ['forearm'],
  // legs
  'quadriceps': ['quad'],
  'quads': ['quad'],
  'hamstrings': ['hamstring'],
  'glutes': ['glute'],
  'gastrocnemius': ['calf'],
  'soleus': ['calf'],
  'calves': ['calf'],
  'adductors': ['adductor'],
  // core
  'transverse abdominis': ['transverse', 'rectus'],
  'rectus abdominis': ['rectus'],
  'obliques': ['oblique'],
  'core': ['rectus', 'oblique'],
  // full body
  'full body': [],
};

function resolveRegions(muscles) {
  const regions = new Set();
  muscles.forEach((m) => {
    const key = m.toLowerCase();
    const mapped = MUSCLE_MAP[key] || [];
    mapped.forEach((r) => regions.add(r));
  });
  return Array.from(regions);
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function MuscleIllustration({ bodyPart, targetMuscle, secondaryMuscles = [], style = {} }) {
  const primaryRegions   = resolveRegions([targetMuscle || '']);
  const secondaryRegions = resolveRegions(secondaryMuscles || []);

  const props = { primary: primaryRegions, secondary: secondaryRegions };
  const bp = (bodyPart || '').toLowerCase();

  let SVGComponent;
  if (bp === 'chest') SVGComponent = ChestSVG;
  else if (bp === 'back') SVGComponent = BackSVG;
  else if (bp === 'shoulders') SVGComponent = ShouldersSVG;
  else if (bp === 'arms') SVGComponent = ArmsSVG;
  else if (bp === 'legs') SVGComponent = LegsSVG;
  else if (bp === 'core') SVGComponent = CoreSVG;
  else SVGComponent = FullBodySVG;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <SVGComponent {...props} />
    </div>
  );
}
