# MacroVault Landing Page — Redesign Spec (v2)

> Single source of truth for the landing page redesign.
> This spec is **CRA + plain CSS native**. No Tailwind, no Next.js, no new build infrastructure.
> Reference this file from every Claude Code prompt during the refactor.
> Companion file: `hero-redesign-reference.png` (visual target of the new hero).

---

## 0. What this redesign is and isn't

**Goal:** Make `src/pages/LandingPage.jsx` (rendered under `.lp-page` styled by `src/styles/landing.css`) feel like a designed-by-a-human product page rather than an AI/SaaS template, while preserving the existing Live Demo section (which is the strongest part of the current page).

**Sections being redesigned:**
- Hero (`.lp-hero`) — major redesign
- Feature strip (`.lp-strip`) — refresh
- Features grid (`.lp-features`) — convert from 3×2 uniform grid to bento layout
- Pricing (`.lp-pricing`) — drop the three-equal-cards-with-MOST-POPULAR-middle pattern
- Final CTA (`.lp-cta`) — new copy and treatment
- Footer (`.lp-footer`) — minor refresh
- Navbar (`.lp-nav`) — minor refresh (version tag chip)

**Section being preserved:**
- Live Demo (`.lp-demo*`) — kept structurally intact. Only small consistency tweaks:
  - Apply `font-variant-numeric: tabular-nums` more aggressively
  - Apply `font-family: var(--lp-font-mono)` to numerical values in the demo's stat cards, gauge value, and any displayed counts/percentages/dates/times
  - No layout, no class renames, no JSX restructure

**Sections NOT in scope:**
- About page styles (`.about-lp .*`) — leave entirely alone, they share this file but render on a different route
- Any app-side styles (anything in `src/styles/*` that isn't `landing.css`)
- Any theme tokens in `src/styles/theme.css` — the landing page uses its own `--lp-*` tokens by design

---

## 1. Project context (don't relearn this every phase)

- **Stack:** Create React App (react-scripts 5) at repo root. React 19, react-router-dom 7, framer-motion 12, Supabase JS.
- **NOT Next.js. NOT Tailwind.** Plain CSS with custom properties.
- **Landing page is intentionally isolated** per CLAUDE.md: uses `lp-*` class prefix and `--lp-*` CSS variables, deliberately does not pick up app theme tokens so the marketing visual is stable across user theme settings.
- **Icons:** Lucide React (`import { X } from 'lucide-react'`). Already a project dependency. Never emoji.
- **Animation:** framer-motion 12 already installed. Use `motion.div`, `useMotionValue`, `useSpring`, `useTransform` for interactive animations. Use CSS transitions for simple hover states only.
- **Build:** `npm run build` (already wraps in `CI=false`). On Windows PowerShell/cmd, that env var syntax fails — use `npx react-scripts build` after `set CI=false`. From git-bash it works as-is.
- **Mobile breakpoint:** `max-width: 767px` (per CLAUDE.md). NOT 768. The existing landing.css uses 960 and 480 — those are landing-page-specific and fine to keep.
- **Touch targets:** add `touch-action: manipulation` to any new tappable element in mobile flows.

### Existing tokens already in `landing.css` (reuse these, don't duplicate)

```css
.lp-page {
  --lp-bg: #0a0d12;
  --lp-surface: #0e1117;
  --lp-border: rgba(255, 255, 255, 0.07);
  --lp-border-strong: rgba(255, 255, 255, 0.1);
  --lp-text: #ffffff;
  --lp-muted: rgba(255, 255, 255, 0.5);
  --lp-faint: rgba(255, 255, 255, 0.35);
  --lp-dim: rgba(255, 255, 255, 0.3);
  --lp-teal: #1d9e75;
  --lp-teal-light: #5dcaa5;
  --lp-teal-dark: #0f6e56;
  --lp-ease: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### What's wrong with the current landing page (the "AI tells")

In priority order:

1. **Color-split headline** — `.lp-hero__heading--accent` puts the second clause in teal. Most overused SaaS pattern of the era.
2. **macOS browser chrome on the preview** — `.lp-preview__dots` (red/yellow/green) + `.lp-preview__url`. Template-shop default.
3. **Three-equal pricing cards with "MOST POPULAR" middle** — `.lp-price-card--featured` pattern.
4. **3×2 uniform feature grid** with identical icon-in-rounded-square + heading + 2-line description on every card.
5. **Section eyebrows** in uppercase teal ("FEATURES", "PRICING") above each section heading.
6. **Generic copy** — "Everything you need to reach your goals", "Simple, transparent pricing", "Stop guessing. Start tracking."
7. **Symmetric 1fr 1fr hero grid** with everything centered vertically.
8. **Pure white text** (`#ffffff` set as `--lp-text`).
9. **No monospace numerics anywhere** — every number renders in the same Inter as the body copy.
10. **Generic "Track smarter. Train harder." kicker pill** at the top of the hero.

The redesign fixes all ten.

---

## 2. New design tokens to ADD to `.lp-page`

Add these inside the existing `.lp-page` declaration in `landing.css`. Do not remove or rename any existing tokens — only add.

```css
.lp-page {
  /* … existing tokens stay exactly as-is … */

  /* ── NEW: softer text + surface tier ── */
  --lp-text-soft:     #F4F5F7;            /* replaces #ffffff for most headline + body */
  --lp-text-tertiary: rgba(255, 255, 255, 0.4);
  --lp-bg-void:       #08090D;            /* deepest, for footer + section dividers */
  --lp-bg-raised:     #14171E;            /* dashboard / featured cards */

  /* ── NEW: typography ── */
  --lp-font-display:  'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --lp-font-mono:     'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;

  /* ── NEW: easing curves for the redesign animations ── */
  --lp-ease-out-expo: cubic-bezier(0.22, 1, 0.36, 1);
  --lp-ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);

  /* ── NEW: brand-glow tint for box-shadows ── */
  --lp-teal-glow-soft:   rgba(29, 158, 117, 0.15);
  --lp-teal-glow-strong: rgba(29, 158, 117, 0.35);
}
```

### Font loading

`landing.css` already imports Inter from Google Fonts at the top of `theme.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
```

**Extend that import** (in `theme.css`, not `landing.css`, since it's already there) to add JetBrains Mono AND additional Inter weights (300 italic for editorial contrast, 700 + 800 for display):

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

Note: this is a deliberate, scoped exception to the CLAUDE.md "no external font imports" rule. The rule is partially already broken (Inter is imported) and the landing page needs typographic differentiation. Document the decision in a comment above the import in `theme.css`:

```css
/* Inter (app-wide) + JetBrains Mono (landing-page numerics only).
   See docs/design/landing-redesign-spec.md §2 for rationale. */
@import url('…');
```

---

## 3. Typography rules

These apply to the redesigned sections. The Live Demo section follows them only via the small consistency tweak (mono font on numerics).

### Headlines

- **Use weight contrast, NEVER color contrast.** Delete `.lp-hero__heading--accent` and `.lp-features__heading--accent` and `.lp-cta__heading--accent`. Replace with weight contrast: `font-weight: 700/800` for primary words, `font-weight: 300` + `font-style: italic` + muted gray (`var(--lp-muted)`) for editorial contrast clauses.
- **Display sizes are big.** Hero headline uses `clamp(48px, 8vw, 88px)`. The current 52px is too small.
- **Tight tracking.** Display type uses `letter-spacing: -0.045em` minimum. Current `-1.5px` translates to roughly `-0.029em` at 52px — too loose.
- **Tight leading.** Display headlines use `line-height: 0.94`. Current `1.1` is too airy for the new scale.
- **Sentence case throughout.** No Title Case in headlines.
- **Hand-break headlines** with `<br/>` for rhythm. Don't let big type auto-wrap.
- **Body lead paragraphs** use `font-size: 17px`, `line-height: 1.6`, `max-width: 460px`.

### Numerics

- **Every quantitative value uses `font-family: var(--lp-font-mono)`.** Stats, prices, percentages, dates, version numbers, counts, weights, sets, reps. Numbers are mono. Always.
- **Apply `font-variant-numeric: tabular-nums` everywhere mono is applied.** Prevents number-jitter on animated counters.
- **Units are smaller and muted.** `120g` renders as `<span class="lp-mono">120<small class="lp-mono__unit">g</small></span>`. The unit visually recedes.
- **Thousand separators.** `1,640` not `1640`.

### Eyebrows / kickers / labels

- **No rounded teal-tinted pill kickers** with background fill — current `.lp-hero__badge` is the problem pattern. Replace with inline monospace text + leading dot.
- **Eyebrow labels use monospace, uppercase, tracked `+0.08em`.**
- **Specific, lived-in copy in kickers** — "Shipping weekly · Built solo", "2,847 athletes tracking", "v2.4 — Body comp now live". Not "Track smarter. Train harder."

---

## 4. New utility classes to ADD to `landing.css`

Add these in a new section near the top of `landing.css`, after the `.lp-page` declaration but before the `.lp-nav` block. They're reusable across the redesigned sections.

```css
/* ==================================================================
   REDESIGN UTILITIES
   Used across redesigned sections. Mono numerics, display headings,
   kicker labels, ambient backgrounds.
   ================================================================== */

.lp-page .lp-mono {
  font-family: var(--lp-font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.lp-page .lp-mono__unit {
  font-family: var(--lp-font-mono);
  font-size: 0.55em;
  color: var(--lp-faint);
  font-weight: 400;
  margin-left: 1px;
}

.lp-page .lp-mono-label {
  font-family: var(--lp-font-mono);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--lp-teal-light);
}

.lp-page .lp-kicker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--lp-font-mono);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--lp-teal-light);
  margin-bottom: 28px;
}

.lp-page .lp-kicker__dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lp-teal);
  box-shadow: 0 0 12px var(--lp-teal);
  animation: lp-pulse 2s ease-in-out infinite;
}

.lp-page .lp-kicker__sep {
  color: var(--lp-dim);
}

.lp-page .lp-kicker__muted {
  color: var(--lp-muted);
}

.lp-page .lp-display {
  font-family: var(--lp-font-display);
  font-size: clamp(48px, 8vw, 88px);
  line-height: 0.94;
  letter-spacing: -0.045em;
  font-weight: 700;
  color: var(--lp-text-soft);
  margin: 0 0 28px;
}

.lp-page .lp-display em {
  font-style: italic;
  font-weight: 300;
  color: var(--lp-muted);
}

.lp-page .lp-lead {
  font-size: 17px;
  line-height: 1.6;
  color: var(--lp-muted);
  max-width: 460px;
  margin: 0 0 40px;
}

/* Hairline divider for stat rows */
.lp-page .lp-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
}

/* Vertical hairline for inline stat groups */
.lp-page .lp-vrule {
  width: 1px;
  height: 36px;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}
```

---

## 5. Hero section — full rewrite

### Layout

**Current:** `1fr 1fr` symmetric grid with everything centered. Preview wrapped in macOS browser chrome and rotated `-1deg` flat.

**New:** asymmetric `1.05fr 1fr` grid with the preview overflowing the right edge and rotated in 3D perspective space.

### CSS changes

**Modify `.lp-hero__grid`:**

```css
.lp-hero__grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1.05fr 1fr;  /* was 1fr 1fr */
  gap: 32px;                           /* was 48px */
  align-items: start;                  /* was center */
  max-width: 1280px;                   /* was 1200px */
  margin: 0 auto;
}
```

**Remove `.lp-hero__heading--accent`. Replace `.lp-hero__heading` with display-class usage in JSX** (see JSX section). Keep the old class definition in CSS only if other code references it, otherwise delete.

**Modify `.lp-hero__badge` block** — keep the class name for backwards compatibility but redesign to be the new monospace kicker. Or better: replace `.lp-hero__badge` usage in JSX with `.lp-kicker` (defined in §4) and delete the old badge styles. **Delete `.lp-hero__badge` and `.lp-hero__badge-dot` styles entirely.**

**Modify `.lp-hero__stats-wrap` and `.lp-hero__stats`** for monospace stat treatment:

```css
.lp-hero__stats-wrap {
  width: 100%;
  max-width: 520px;          /* was 480px */
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.lp-hero__stats {
  display: flex;
  align-items: flex-start;
  gap: 32px;                 /* was 24px */
}

.lp-hero__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lp-hero__stat-value {
  font-family: var(--lp-font-mono);   /* NEW */
  font-size: 22px;
  font-weight: 500;                    /* was 800 */
  color: var(--lp-text-soft);          /* was --lp-text */
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;  /* NEW */
}

.lp-hero__stat-label {
  font-family: var(--lp-font-mono);    /* NEW */
  font-size: 11px;
  text-transform: uppercase;            /* NEW */
  letter-spacing: 0.06em;               /* NEW */
  color: var(--lp-faint);              /* was 0.4 white */
}
```

### Preview / dashboard mockup

**Remove the macOS browser chrome entirely.** Delete `.lp-preview__header`, `.lp-preview__dots`, `.lp-preview__dot`, `.lp-preview__url` styles. The preview stands on its own with a thin border + subtle teal glow.

**Add a small "Live · macro-vault.com" pill above the preview** instead of a fake browser bar. This is a new element:

```css
.lp-hero__preview-tag {
  position: absolute;
  top: -14px;
  right: 28px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 11px;
  font-family: var(--lp-font-mono);
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--lp-teal-light);
  background: var(--lp-bg);
  border: 1px solid rgba(29, 158, 117, 0.3);
  border-radius: 999px;
}

.lp-hero__preview-tag-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--lp-teal);
  animation: lp-pulse 2s ease-in-out infinite;
}
```

**Modify `.lp-preview` and `.lp-preview__frame`** for perspective + glow:

```css
.lp-preview {
  position: relative;
  width: 100%;
  max-width: 560px;
  margin-right: -60px;        /* bleed off the right edge */
  perspective: 1800px;
  transform: none;            /* remove the flat rotate */
  filter: none;               /* remove old drop-shadows */
}

.lp-preview__frame {
  position: relative;
  background: linear-gradient(160deg, var(--lp-bg-raised) 0%, var(--lp-surface) 100%);
  border: 1px solid var(--lp-border-strong);
  border-radius: 14px;
  overflow: hidden;
  transform: rotateY(-8deg) rotateX(4deg) translateZ(0);
  transform-origin: left center;
  transform-style: preserve-3d;
  transition: transform 0.6s var(--lp-ease-out-expo);
  box-shadow:
    0 60px 100px -40px rgba(0, 0, 0, 0.8),
    0 30px 60px -30px var(--lp-teal-glow-soft),
    0 0 0 1px rgba(29, 158, 117, 0.04);
}
```

### Inside-preview content

Keep `.lp-preview__body` and the inner stat-grid layout largely as-is, but:

- **Add `font-family: var(--lp-font-mono)` and `font-variant-numeric: tabular-nums` to `.lp-preview__stat-value`** so the calorie/protein numbers inside the preview render in mono. Same for the bar percentages and meal kcal values.
- **Add a "macro hero" stat block** at the top — a big calorie reading in mono with a progress bar. The current preview shows a 2×2 stat grid; the new preview has one prominent stat + a 3-column macro row + a workout log block, matching the new hero design.

(Full inside-preview JSX is in the prototype — see `hero-redesign-prototype.html` if it exists. If not, see §10 below for the JSX structure.)

### Ambient orbs (keep, just tweak)

Modify `.lp-hero__orb--1` and `.lp-hero__orb--2`:

```css
.lp-hero__orb--1 {
  top: -180px;
  right: -180px;             /* moved right to balance the asymmetric layout */
  left: auto;                /* was -80px */
  width: 600px;              /* was 400px */
  height: 600px;
  background: rgba(29, 158, 117, 0.12);  /* was 0.08 — slightly stronger */
  filter: blur(80px);
}

.lp-hero__orb--2 {
  bottom: -240px;
  left: -120px;              /* moved left */
  right: auto;
  width: 500px;
  height: 500px;
  background: rgba(29, 158, 117, 0.05);
  filter: blur(80px);
}
```

### Subtle grid + grain (NEW depth layers)

Add two new pseudo-elements on `.lp-hero` for depth:

```css
.lp-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
  z-index: 0;
}

.lp-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.04 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");
  opacity: 0.4;
  mix-blend-mode: overlay;
  pointer-events: none;
  z-index: 0;
}
```

Note `.lp-hero__grid` already has `z-index: 1` so it sits above these.

### JSX changes (in `src/pages/LandingPage.jsx`)

Inside the hero block, replace:

**Old kicker:**
```jsx
<div className="lp-hero__badge">
  <span className="lp-hero__badge-dot" />
  Track smarter. Train harder.
</div>
```

**New kicker:**
```jsx
<div className="lp-kicker">
  <span className="lp-kicker__dot" />
  <span>Shipping weekly · Built solo</span>
  <span className="lp-kicker__sep">/</span>
  <span className="lp-kicker__muted">2,847 athletes tracking</span>
</div>
```
(Replace "2,847" with a real-ish number you're comfortable showing. If you don't have real numbers, use "Built for people who lift" or similar specific-sounding non-numeric copy.)

**Old headline:**
```jsx
<h1 className="lp-hero__heading">
  Data-driven fitness,<br/>
  <span className="lp-hero__heading--accent">without the guesswork.</span>
</h1>
```

**New headline:**
```jsx
<h1 className="lp-display">
  Train like<br/>
  <em>someone who</em><br/>
  reads the data.
</h1>
```

**Old subheading:**
```jsx
<p className="lp-hero__sub">Track workouts, estimate your body composition and hit your goals all in one place. Built for people who want real data, not just motivation.</p>
```

**New subheading:**
```jsx
<p className="lp-lead">
  Most fitness apps optimize for motivation. MacroVault optimizes for the spreadsheet underneath it. Track macros, log lifts, model body comp — built for people who'd rather see the math.
</p>
```

**Stats row JSX:** wrap stat values in `<span className="lp-mono">` and use the unit treatment:

```jsx
<div className="lp-hero__stats-wrap">
  <div className="lp-hero__stats">
    <div className="lp-hero__stat">
      <div className="lp-hero__stat-value">96<span className="lp-mono__unit">+</span></div>
      <div className="lp-hero__stat-label">Exercises logged</div>
    </div>
    <div className="lp-vrule" />
    <div className="lp-hero__stat">
      <div className="lp-hero__stat-value">0<span className="lp-mono__unit">.0s</span></div>
      <div className="lp-hero__stat-label">Onboarding friction</div>
    </div>
    <div className="lp-vrule" />
    <div className="lp-hero__stat">
      <div className="lp-hero__stat-value">$0</div>
      <div className="lp-hero__stat-label">Free tier, forever</div>
    </div>
  </div>
</div>
```

**Preview JSX:** wrap the preview in the new perspective container and prepend the floating "Live" pill:

```jsx
<div className="lp-hero__right">
  <div className="lp-preview">
    <div className="lp-hero__preview-tag">
      <span className="lp-hero__preview-tag-dot" />
      Live · macro-vault.com
    </div>
    <div className="lp-preview__frame">
      {/* preview body content — keep the existing 2×2 stats + bars + meals,
          but add font-family: var(--lp-font-mono) to all numerical values
          via the lp-mono class on the value spans. Delete the macOS chrome header. */}
    </div>
  </div>
</div>
```

---

## 6. Animation specs (framer-motion)

framer-motion 12 is already installed. Use it for:

### Word-stagger entrance on the headline

```jsx
import { motion } from 'framer-motion';

const headlineWords = ['Train', 'like', 'someone', 'who', 'reads', 'the', 'data.'];

<h1 className="lp-display">
  {headlineWords.map((word, i) => (
    <motion.span
      key={i}
      style={{ display: 'inline-block', marginRight: '0.25em' }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: i * 0.05,
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* Apply italic/muted styling to words 2-3 ("someone who") */}
      {i === 2 || i === 3 ? <em>{word}</em> : word}
    </motion.span>
  ))}
</h1>
```

If word-by-word is too fiddly, use a simpler line-by-line stagger with `motion.span` wrapping each line.

### Cursor-tracked perspective tilt on the preview

```jsx
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

const PreviewWithTilt = ({ children }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-14, -2]), { stiffness: 150, damping: 20 });
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [10, -2]), { stiffness: 150, damping: 20 });

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleLeave = () => { x.set(0); y.set(0); };

  return (
    <div className="lp-preview" onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <motion.div
        className="lp-preview__frame"
        style={{ rotateX, rotateY, transformPerspective: 1800 }}
      >
        {children}
      </motion.div>
    </div>
  );
};
```

Replace the existing `.lp-preview` wrapper in JSX with this component. The spring physics (stiffness 150, damping 20) give it weight without floatiness.

### Hover animations on primary CTA

```jsx
<motion.button
  className="lp-hero__cta-primary"
  whileHover={{ y: -1, boxShadow: '0 12px 28px -10px rgba(29, 158, 117, 0.55)' }}
  whileTap={{ scale: 0.97 }}
  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
  onClick={…}
>
  Start tracking — free forever
</motion.button>
```

### Respect reduced-motion

The existing `landing.css` has a `@media (prefers-reduced-motion: reduce)` block — extend it to disable the word-stagger and perspective tilt:

```css
@media (prefers-reduced-motion: reduce) {
  .lp-preview__frame {
    transform: none !important;
  }
  /* framer-motion respects prefers-reduced-motion automatically when
     `useReducedMotion()` is used; ideally wrap the tilt component in that. */
}
```

In the React component, use framer-motion's `useReducedMotion` hook to disable tilt:

```jsx
const reduceMotion = useReducedMotion();
// skip the motion-value setup when reduceMotion is true
```

---

## 7. Subsequent sections (later phases — outline only here)

### Feature strip (`.lp-strip`)

Currently a 3-item horizontal row with separators. Keep the structure but:
- Add monospace sub-labels (`6 steps · ~90s`, `NHANES-trained`, `96 illustrated`)
- Apply `var(--lp-font-mono)` + `var(--lp-faint)` color to the descriptors
- Tighten copy to be specific (counts, methods, real attributes)

### Features section (`.lp-features`)

Currently 3×2 uniform grid. Convert to **bento**:

```css
.lp-features__grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-auto-rows: minmax(200px, auto);
  gap: 14px;
}

.lp-feat-card--hero    { grid-column: span 4; grid-row: span 2; }  /* big card */
.lp-feat-card--medium  { grid-column: span 2; }                    /* two stacked */
.lp-feat-card--wide    { grid-column: span 3; }                    /* below big */
.lp-feat-card--narrow  { grid-column: span 3; }
```

Layout proposal:
- **Big card (4×2):** Workout Logger with a live-looking mini chart (use recharts or hand-drawn SVG bar/line)
- **Two medium cards (2×1 stacked):** Macro Calculator + Goal Planner — each with monospace metric callouts instead of just icon+text
- **Two wide cards (3×1):** Exercise Library (with a `96` mono number) + Body Comp Analyzer (with `NHANES` callout)

At mobile (`max-width: 960px`) collapse to `grid-template-columns: 1fr` and let cards stack — much of the bento sizing only applies at desktop.

### Pricing section (`.lp-pricing`)

Drop the three-equal-cards-with-MOST-POPULAR pattern. Two options:

**Option A — Comparison table.** One row per plan, columns for the features. Prices in mono.

**Option B — One prominent Pro card flanked by smaller Free and Pro+.** Asymmetric. Pro card is roughly 1.4× the size of the satellites. Use the monospace price treatment. Drop the "MOST POPULAR" / "BEST VALUE" badges entirely or replace with subtler treatment.

I recommend Option B for visual interest. Spec'd later.

### Final CTA (`.lp-cta`)

Replace "Stop guessing. Start tracking." (parallel-three-word-sentence is an AI tell). Replace with one of:
- "You've tried every other app. Try the one built by someone who lifts."
- "Start with the calculator. The rest follows."
- "Free forever. No upsells in the workout flow."

Pick one. Stay opinionated.

### Footer (`.lp-footer`)

Mostly fine. Add:
- A small version chip next to the logo (`v2.4`) matching the navbar treatment
- A "Made by Logan in California" line near the copyright (specificity is the antidote to AI feel)

---

## 8. Live demo consistency tweaks (`.lp-demo*`)

**Do not restructure or rename anything.** Only apply these targeted changes:

Add `font-family: var(--lp-font-mono); font-variant-numeric: tabular-nums;` to:

- `.lp-demo__stat-value`
- `.lp-demo__home-greeting` — NO, this is a word heading, skip it
- `.lp-demo__home-gauge-value`
- `.lp-demo__home-macro-pct`
- `.lp-demo__home-macro-val`
- `.lp-demo__home-remaining-val`
- `.lp-demo__target-val`
- `.lp-demo__tdee-val`
- `.lp-demo__plan-macros b`
- `.lp-demo__meal-kcal`
- `.lp-demo__meals-total`
- `.lp-demo__meal-macros b`
- `.lp-demo__phase-bar-val`
- `.lp-demo__progress-stats .lp-demo__stat-value`
- `.lp-demo__history-row` (the cells containing weight, body-fat, date values)
- `.lp-demo__set-table-row` (the set/rep/weight cells)
- `.lp-demo__workout-date`
- `.lp-demo__date-chip`
- `.lp-demo__home-date`
- `.lp-demo__timeline-meta`

Many already have `font-variant-numeric: tabular-nums` — just add the mono family to those.

The Home greeting ("Good morning"), section titles, button labels — those stay in Inter.

---

## 9. Anti-AI principles ("don't do this")

This is the most important checklist. After every phase, verify the rendered output against this list.

### Hard No's

- ❌ Color-split headlines (`.lp-hero__heading--accent`)
- ❌ Teal-pill kicker with background fill (the old `.lp-hero__badge`)
- ❌ macOS browser chrome around product mockups
- ❌ Uppercase teal section eyebrows ("FEATURES", "PRICING", "READY TO START?")
- ❌ Three-equal pricing cards with "MOST POPULAR" middle
- ❌ 3×2 uniform feature grid with identical cards
- ❌ Parallel three-word sentence pairs as headlines ("Stop guessing. Start tracking.")
- ❌ Pure `#ffffff` text on dark — use `--lp-text-soft` (#F4F5F7)
- ❌ Default tracking on display headings
- ❌ Center-everything symmetric layouts
- ❌ Generic micro-copy ("Everything you need", "Simple, transparent pricing")
- ❌ Numerics in body sans font

### Hard Yes's

- ✅ Weight contrast for headlines (700/800 + 300 italic muted)
- ✅ Monospace for every number
- ✅ Asymmetric hero grid with bleed-off-right preview
- ✅ Perspective transform on product mockups
- ✅ Specific, opinionated copy with numbers/dates/names
- ✅ Pulsing live indicators with green dots
- ✅ Monospace eyebrow labels with leading dots or slash separators
- ✅ Version tags as monospace chips
- ✅ Bento feature layout with varied card sizes
- ✅ Ambient depth (grain + grid + radial glows, layered)

---

## 10. Refactor phases (Claude Code workflow)

Each phase = one Claude Code prompt. Verify build + render + scope before committing.

### Phase 1 — Tokens + fonts
- Extend `@import` in `src/styles/theme.css` to load JetBrains Mono + additional Inter weights
- Add new `--lp-*` tokens to `.lp-page` in `src/styles/landing.css`
- Add utility classes (`.lp-mono`, `.lp-mono-label`, `.lp-kicker`, `.lp-display`, `.lp-lead`, `.lp-divider`, `.lp-vrule`) to `landing.css`
- Verify: `npm start`, visit landing page, confirm nothing breaks. The page should look identical (no JSX changes yet) but the new tokens + utilities are available.

### Phase 2 — Hero CSS
- Modify `.lp-hero__grid`, `.lp-hero__orb--1`, `.lp-hero__orb--2` per §5
- Add `.lp-hero::before` and `.lp-hero::after` for grid + grain depth layers
- Delete `.lp-hero__badge`, `.lp-hero__badge-dot`, `.lp-hero__heading--accent`, `.lp-preview__header`, `.lp-preview__dots`, `.lp-preview__dot`, `.lp-preview__url`
- Add `.lp-hero__preview-tag`, `.lp-hero__preview-tag-dot`
- Modify `.lp-preview`, `.lp-preview__frame` for perspective + glow
- Update `.lp-hero__stat-value`, `.lp-hero__stat-label` for mono treatment
- Verify: page will look broken because JSX still uses old class names. That's expected. Don't commit yet — go straight to Phase 3.

### Phase 3 — Hero JSX
- Update `src/pages/LandingPage.jsx` hero section per §5 JSX block
- Replace `.lp-hero__badge` JSX with `.lp-kicker`
- Replace `.lp-hero__heading` with `.lp-display` and `<em>` for the editorial middle
- Replace `.lp-hero__sub` with `.lp-lead`
- Wrap stat values in `lp-mono` class
- Restructure preview to use the new perspective wrapper component (see §6)
- Delete the JSX for macOS browser chrome
- Verify: render the page, hero should look like the new design. Hover the preview — perspective tilt should respond to cursor.

### Phase 4 — Hero animations
- Add framer-motion word-stagger on headline
- Add `useReducedMotion` support
- Add `whileHover` / `whileTap` on primary CTA
- Verify: page reloads, headline words fade in sequentially, CTA has subtle hover lift.

### Phase 5 — Feature strip + features bento
- Per §7

### Phase 6 — Pricing redesign
- Per §7

### Phase 7 — Final CTA + footer polish
- Per §7

### Phase 8 — Demo consistency tweaks
- Per §8

### Phase 9 — Mobile responsive pass
- Verify every breakpoint (960px, 767px, 480px) on every redesigned section
- The hero's bleed-off-right needs to be removed on mobile; preview should stack below copy

### Phase 10 — Final review
- Run the anti-AI checklist (§9) against the rendered page
- Verify reduced-motion behavior
- Check both Chrome and Safari
- Take screenshots, compare to reference

---

## 11. Constraints (read every phase)

- **Do not install new dependencies** without asking. framer-motion 12 and lucide-react are already installed and that's all you need.
- **Do not modify files outside the landing-page scope** unless explicitly required by the phase. In scope: `src/pages/LandingPage.jsx`, `src/styles/landing.css`, `src/styles/theme.css` (only for the font import line).
- **Do not modify the `.about-lp` styles** in `landing.css` — that's for a different route.
- **Do not modify any `.lp-demo__*` styles** except the targeted mono-numeric additions in §8.
- **Do not commit** without explicit instruction per CLAUDE.md.
- **Do not delete files** without confirmation per CLAUDE.md.
- **Use exact values** from the spec. No approximations on hex codes, sizes, or easing curves.
- **Match existing code style.** No bringing in new patterns (CSS-in-JS, styled-components, etc).
- **Never use emoji as icons.** Lucide React only.
- **Stage only files relevant to the current task** when committing — repo often has unrelated in-progress work.

---

## 12. Resolving ambiguity

If anything in this spec conflicts with `CLAUDE.md`, **CLAUDE.md wins** except for:
- The "no external font imports" rule, which is explicitly overridden for the landing page only (Inter is already imported, JetBrains Mono is being added) — see §2

If anything in this spec is ambiguous or seems wrong for the codebase, **stop and ask before proceeding**. Better to clarify than guess.
