import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { useUsage } from '../../hooks/useUsage';
import './AppShell.css';

/* Map routes to page titles and optional quick-action buttons */
const PAGE_META = {
  '/home':        { title: 'Home' },
  '/measurements':    { title: 'Measurements' },
  '/calculators': { title: 'Calculators' },
  '/goalplanner': { title: 'Goal Planner' },
  '/meal-planner': { title: 'Meal Planner' },
  '/workouts':    { title: 'Workouts' },
  '/progress':    { title: 'Progress' },
  '/billing':     { title: 'Billing' },
  '/exercises':   { title: 'Exercise Library' },
  '/settings':    { title: 'Settings' },
};

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.15 } },
};

export default function AppShell({ session, onLogout, isPro, isProPlus, children }) {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? { title: 'MacroVault' };
  const userId = session?.user?.id ?? null;
  const { usage } = useUsage(userId);

  return (
    <div className="app-shell">
      <Sidebar session={session} onLogout={onLogout} isPro={isPro} isProPlus={isProPlus} usage={usage} />

      <div className="app-shell__main">
        {/* Top bar */}
        <div className="app-shell__topbar">
          <div className="app-shell__topbar-left">
            <h1 className="app-shell__page-title">{meta.title}</h1>
          </div>
          {meta.action && (
            <button className="app-shell__action-btn">{meta.action}</button>
          )}
        </div>

        {/* Page content with animation */}
        <div className="app-shell__content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
