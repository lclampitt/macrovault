import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Palette } from 'lucide-react';

const QUICK_DOTS = [
  { id: 'teal',   label: 'Teal',   color: '#1D9E75' },
  { id: 'blue',   label: 'Blue',   color: '#2563EB' },
  { id: 'violet', label: 'Violet', color: '#7C3AED' },
  { id: 'orange', label: 'Orange', color: '#EA580C' },
  { id: 'rose',   label: 'Rose',   color: '#DB2777' },
];

const ALL_COLORS = [
  { id: 'teal',       label: 'Teal',       color: '#1D9E75' },
  { id: 'blue',       label: 'Blue',       color: '#2563EB' },
  { id: 'violet',     label: 'Violet',     color: '#7C3AED' },
  { id: 'orange',     label: 'Orange',     color: '#EA580C' },
  { id: 'rose',       label: 'Rose',       color: '#DB2777' },
  { id: 'crimson',    label: 'Crimson',    color: '#DC2626' },
  { id: 'xp-aqua',    label: 'XP Aqua',    color: '#00BFFF' },
  { id: 'myspace',    label: 'MySpace',    color: '#FF00FF' },
  { id: 'y2k-chrome', label: 'Chrome',     color: '#FFD700' },
];

const RETRO = new Set(['xp-aqua', 'myspace', 'y2k-chrome']);

export default function SidebarThemeSwitcher({
  accent, setAccent, uiMode, setUiMode,
  isDark, toggleTheme, isPro, collapsed,
}) {
  const [popOpen, setPopOpen] = useState(false);
  const [popPos, setPopPos] = useState({});
  const [tip, setTip] = useState(null);
  const wrapRef = useRef(null);
  const popRef = useRef(null);

  /* Close popover on outside click / Escape */
  useEffect(() => {
    if (!popOpen) return;
    const down = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (wrapRef.current?.contains(e.target)) return;
      setPopOpen(false);
    };
    const key = (e) => e.key === 'Escape' && setPopOpen(false);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [popOpen]);

  /* Auto-dismiss tooltip */
  useEffect(() => {
    if (!tip) return;
    const id = setTimeout(() => setTip(null), 1200);
    return () => clearTimeout(id);
  }, [tip]);

  const openPop = useCallback(() => {
    if (popOpen) { setPopOpen(false); return; }
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    setPopPos(collapsed
      ? { bottom: Math.max(8, window.innerHeight - r.bottom), left: r.right + 8 }
      : { bottom: window.innerHeight - r.top + 8, left: 8 }
    );
    setPopOpen(true);
  }, [popOpen, collapsed]);

  const pick = useCallback((id, label, e) => {
    if (!isPro) return;
    if (RETRO.has(id) && !isDark) toggleTheme();
    setAccent(id);
    if (e && wrapRef.current) {
      const dr = e.currentTarget.getBoundingClientRect();
      const wr = wrapRef.current.getBoundingClientRect();
      setTip({ label, left: dr.left - wr.left + dr.width / 2 });
    }
  }, [isPro, isDark, toggleTheme, setAccent]);

  const pickPop = useCallback((id) => {
    if (!isPro) return;
    if (RETRO.has(id) && !isDark) toggleTheme();
    setAccent(id);
    setPopOpen(false);
  }, [isPro, isDark, toggleTheme, setAccent]);

  /* ── Popover (portal) ── */
  const popover = popOpen && createPortal(
    <AnimatePresence>
      {popOpen && (
        <motion.div
          ref={popRef}
          className="sbt-pop"
          style={{ position: 'fixed', ...popPos, zIndex: 1000 }}
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        >
          <div className="sbt-pop__head">
            <span className="sbt-pop__title">Color theme</span>
            <button className="sbt-pop__x" onClick={() => setPopOpen(false)}><X size={12} /></button>
          </div>
          <div className="sbt-pop__label">Colors</div>
          <div className="sbt-pop__grid">
            {ALL_COLORS.map((t) => (
              <button
                key={t.id}
                className={`sbt-pop__item${accent === t.id ? ' sbt-pop__item--on' : ''}`}
                onClick={() => pickPop(t.id)}
              >
                <span className="sbt-pop__swatch" style={{ background: t.color }} />
                <span className="sbt-pop__name">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="sbt-pop__hr" />
          <div className="sbt-pop__label">Special</div>
          <button
            className={`sbt-pop__item sbt-pop__item--wide${accent === 'spectrum' ? ' sbt-pop__item--on' : ''}`}
            onClick={() => pickPop('spectrum')}
          >
            <span className="sbt-pop__spectrum" />
            <span className="sbt-pop__col">
              <span className="sbt-pop__name">Spectrum</span>
              <span className="sbt-pop__sub">Each macro gets a color</span>
            </span>
          </button>
          <div className="sbt-pop__hr" />
          <div className="sbt-pop__label">Interface</div>
          <div className="sbt-pop__pills">
            <button className={`sbt-pop__pill${uiMode === 'modern' ? ' sbt-pop__pill--on' : ''}`} onClick={() => isPro && setUiMode('modern')}>Modern</button>
            <button className={`sbt-pop__pill${uiMode === 'y2k' ? ' sbt-pop__pill--on' : ''}`} onClick={() => isPro && setUiMode('y2k')}>Y2K</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );

  /* ── Collapsed: palette icon ── */
  if (collapsed) {
    return (
      <div ref={wrapRef} className="sbt sbt--col">
        <button className="sbt__pal" onClick={openPop} title="Theme"><Palette size={14} /></button>
        {popover}
      </div>
    );
  }

  /* ── Expanded: dot row ── */
  return (
    <div ref={wrapRef} className="sbt">
      <div className="sbt__row">
        {QUICK_DOTS.map((t) => (
          <motion.button
            key={t.id}
            className={`sbt__dot${accent === t.id ? ' sbt__dot--on' : ''}`}
            style={{ background: t.color }}
            onClick={(e) => pick(t.id, t.label, e)}
            whileTap={{ scale: 0.8 }}
            title={t.label}
          />
        ))}
        <button className="sbt__more" onClick={openPop} title="More themes">
          <span>···</span>
        </button>
      </div>
      <AnimatePresence>
        {tip && (
          <motion.div
            key={tip.label}
            className="sbt__tip"
            style={{ left: tip.left }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {tip.label}
          </motion.div>
        )}
      </AnimatePresence>
      {popover}
    </div>
  );
}
