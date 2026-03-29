import React, { memo } from 'react';

const C = '#1D9E75';

/* ── Size variants ──────────────────────────────────────────── */
const SIZE_PX = { sm: 70, md: 100, lg: 180 };

/* ── Muscle name normalization ──────────────────────────────── */
export function normalizeMuscle(name = '') {
  const n = name.toLowerCase().trim();
  if (/pectoralis|pectoral|chest/.test(n))                       return 'chest';
  if (/latissimus|lat(s)?$|^back$/.test(n))                      return 'lats';
  if (/quadricep|quad(s)?|^legs$/.test(n))                       return 'quadriceps';
  if (/hamstring/.test(n))                                        return 'hamstrings';
  if (/glut|buttock/.test(n))                                    return 'glutes';
  if (/deltoid|shoulder/.test(n))                                return 'deltoids';
  if (/bicep/.test(n))                                           return 'biceps';
  if (/tricep/.test(n))                                          return 'triceps';
  if (/trapezius|trap(s)?$/.test(n))                             return 'traps';
  if (/^abs$|abdominal|rectus abdominis/.test(n))                return 'abs';
  if (/gastrocnemius|calv|calf/.test(n))                         return 'calves';
  if (/oblique|^core$|serratus|lower back|erector/.test(n))      return 'core';
  if (/rhomboid|upper back/.test(n))                             return 'traps';
  if (/adductor|inner thigh/.test(n))                            return 'quadriceps';
  if (/tibialis/.test(n))                                        return 'calves';
  return 'default';
}

/* ── Glow layer helper ──────────────────────────────────────── */
// Renders three concentric copies of a shape function at decreasing opacities.
// shapeFn receives a scale factor (1 = outer, smaller = inner).
function GlowEllipse({ cx, cy, rx, ry }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx * 1.55} ry={ry * 1.55} fill={C} opacity="0.13" />
      <ellipse cx={cx} cy={cy} rx={rx * 1.25} ry={ry * 1.25} fill={C} opacity="0.22" />
      <ellipse cx={cx} cy={cy} rx={rx}         ry={ry}         fill={C} opacity="0.90" />
    </>
  );
}

function GlowRect({ x, y, w, h, rx: r }) {
  const pad1 = 7, pad2 = 4;
  return (
    <>
      <rect x={x - pad1} y={y - pad1} width={w + pad1 * 2} height={h + pad1 * 2} rx={(r || 0) + pad1} fill={C} opacity="0.13" />
      <rect x={x - pad2} y={y - pad2} width={w + pad2 * 2} height={h + pad2 * 2} rx={(r || 0) + pad2} fill={C} opacity="0.22" />
      <rect x={x}         y={y}         width={w}             height={h}             rx={r || 0}           fill={C} opacity="0.90" />
    </>
  );
}

/* ── Shape definitions ──────────────────────────────────────── */
const SHAPES = {

  chest: () => (
    <g>
      <GlowEllipse cx={27} cy={45} rx={13} ry={11} />
      <GlowEllipse cx={63} cy={45} rx={13} ry={11} />
      {/* centre divider */}
      <line x1="45" y1="30" x2="45" y2="62" stroke="#0a0d13" strokeWidth="2.5" />
    </g>
  ),

  lats: () => {
    const leftPath  = 'M36 20 C36 20 40 30 40 50 C40 64 32 72 24 70 C16 68 12 56 14 42 C16 28 22 20 36 20 Z';
    const rightPath = 'M54 20 C54 20 50 30 50 50 C50 64 58 72 66 70 C74 68 78 56 76 42 C74 28 68 20 54 20 Z';
    return (
      <g>
        {/* Outer glow */}
        <path d={leftPath}  fill={C} opacity="0.13" transform="scale(1.15) translate(-5 -5)" />
        <path d={rightPath} fill={C} opacity="0.13" transform="scale(1.15) translate(-5 -5)" />
        {/* Mid */}
        <path d={leftPath}  fill={C} opacity="0.22" transform="scale(1.07) translate(-2.5 -2.5)" />
        <path d={rightPath} fill={C} opacity="0.22" transform="scale(1.07) translate(-2.5 -2.5)" />
        {/* Inner */}
        <path d={leftPath}  fill={C} opacity="0.90" />
        <path d={rightPath} fill={C} opacity="0.90" />
      </g>
    );
  },

  quadriceps: () => (
    <g>
      <GlowRect x={16} y={12} w={22} h={66} rx={11} />
      <GlowRect x={52} y={12} w={22} h={66} rx={11} />
    </g>
  ),

  hamstrings: () => (
    <g>
      <GlowRect x={18} y={10} w={20} h={70} rx={10} />
      <GlowRect x={52} y={10} w={20} h={70} rx={10} />
    </g>
  ),

  glutes: () => (
    <g>
      <GlowEllipse cx={26} cy={48} rx={20} ry={22} />
      <GlowEllipse cx={64} cy={48} rx={20} ry={22} />
      {/* hide centre overlap with bg colour */}
      <rect x={36} y={28} width={18} height={44} fill="#0a0d13" />
    </g>
  ),

  deltoids: () => (
    <g>
      <GlowEllipse cx={16} cy={45} rx={13} ry={17} />
      <GlowEllipse cx={74} cy={45} rx={13} ry={17} />
      {/* dark connector bar in the middle */}
      <rect x={27} y={34} width={36} height={22} rx={4} fill="#0a0d13" />
      {/* small visible bridge */}
      <rect x={30} y={40} width={30} height={10} rx={3} fill={C} opacity="0.18" />
    </g>
  ),

  biceps: () => (
    <g>
      <GlowRect x={18} y={16} w={18} h={58} rx={9} />
      <GlowRect x={54} y={16} w={18} h={58} rx={9} />
    </g>
  ),

  triceps: () => (
    <g>
      <GlowRect x={16} y={16} w={20} h={58} rx={10} />
      <GlowRect x={54} y={16} w={20} h={58} rx={10} />
    </g>
  ),

  traps: () => (
    <g>
      {/* outer glow */}
      <ellipse cx="45" cy="40" rx="33" ry="26" fill={C} opacity="0.13" />
      {/* mid */}
      <ellipse cx="45" cy="40" rx="27" ry="21" fill={C} opacity="0.22" />
      {/* inner solid */}
      <polygon points="20,65 28,16 62,16 70,65" fill={C} opacity="0.90" />
    </g>
  ),

  abs: () => {
    const cells = [
      [20, 14], [52, 14],
      [20, 35], [52, 35],
      [20, 56], [52, 56],
    ];
    return (
      <g>
        {/* background glow */}
        <ellipse cx="45" cy="45" rx="30" ry="36" fill={C} opacity="0.10" />
        <ellipse cx="45" cy="45" rx="22" ry="28" fill={C} opacity="0.12" />
        {/* six-pack segments */}
        {cells.map(([x, y], i) => (
          <rect key={i} x={x} y={y} width={18} height={15} rx={5} fill={C} opacity="0.90" />
        ))}
        {/* centre divider */}
        <line x1="45" y1="10" x2="45" y2="76" stroke="#0a0d13" strokeWidth="1.8" />
      </g>
    );
  },

  calves: () => (
    <g>
      <GlowEllipse cx={26} cy={50} rx={14} ry={22} />
      <GlowEllipse cx={64} cy={50} rx={14} ry={22} />
    </g>
  ),

  core: () => (
    <g>
      <ellipse cx="45" cy="45" rx="34" ry="38" fill={C} opacity="0.13" />
      <ellipse cx="45" cy="45" rx="27" ry="30" fill={C} opacity="0.22" />
      <ellipse cx="45" cy="45" rx="20" ry="23" fill={C} opacity="0.90" />
    </g>
  ),

  default: () => (
    <g>
      <ellipse cx="45" cy="45" rx="32" ry="32" fill={C} opacity="0.13" />
      <ellipse cx="45" cy="45" rx="25" ry="25" fill={C} opacity="0.22" />
      <ellipse cx="45" cy="45" rx="18" ry="18" fill={C} opacity="0.90" />
    </g>
  ),
};

/* ── Component ──────────────────────────────────────────────── */
const MuscleShape = memo(function MuscleShape({ muscle = 'default', size = 'md', className }) {
  const px = SIZE_PX[size] || SIZE_PX.md;
  const ShapeFn = SHAPES[muscle] || SHAPES.default;

  return (
    <svg
      viewBox="0 0 90 90"
      width={px}
      height={px}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <ShapeFn />
    </svg>
  );
});

export default MuscleShape;
