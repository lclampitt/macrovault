import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanLine, BarChart2, Dumbbell, BookOpen, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import BentoCard from '../components/ui/BentoCard';
import '../styles/dashboard.css';

/* ============================================================
   CONSISTENCY CALENDAR
   ============================================================ */
function ConsistencyCalendar() {
  const STORAGE_KEY = 'gainlytics_consistency_calendar_v1';
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear]   = useState(today.getFullYear());
  const [activeDays, setActiveDays]     = useState({});
  const [ripple, setRipple]             = useState(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) setActiveDays(saved);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activeDays));
  }, [activeDays]);

  const formatKey = (y, m, d) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const toggleDay = (day) => {
    const key = formatKey(currentYear, currentMonth, day);
    setRipple(key);
    setTimeout(() => setRipple(null), 400);
    setActiveDays((prev) => {
      const next = { ...prev };
      next[key] ? delete next[key] : (next[key] = true);
      return next;
    });
  };

  const daysInMonth  = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startWeekday = new Date(currentYear, currentMonth, 1).getDay();
  const monthLabel   = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const activeCount = Object.keys(activeDays).filter((k) => {
    const [y, m] = k.split('-').map(Number);
    return y === currentYear && m - 1 === currentMonth;
  }).length;
  const consistency = daysInMonth > 0 ? Math.round((activeCount / daysInMonth) * 100) : 0;

  const goBack = () => {
    if (currentMonth === 0) { setCurrentYear((y) => y - 1); setCurrentMonth(11); }
    else setCurrentMonth((m) => m - 1);
  };
  const goForward = () => {
    if (currentMonth === 11) { setCurrentYear((y) => y + 1); setCurrentMonth(0); }
    else setCurrentMonth((m) => m + 1);
  };

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="cal">
      <div className="cal__top">
        <div className="cal__nav">
          <button onClick={goBack}>‹</button>
          <span>{monthLabel}</span>
          <button onClick={goForward}>›</button>
        </div>
        <span className="cal__consistency">{consistency}% consistent</span>
      </div>
      <div className="cal__weekdays">
        {['S','M','T','W','T','F','S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="cal__grid">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="cal__cell cal__cell--empty" />;
          const key = formatKey(currentYear, currentMonth, day);
          const isActive = !!activeDays[key];
          return (
            <motion.button
              key={i}
              className={`cal__cell ${isActive ? 'cal__cell--active' : ''}`}
              onClick={() => toggleDay(day)}
              whileTap={{ scale: 0.8 }}
            >
              <span className="cal__day-num">{day}</span>
              {!isActive && <span className="cal__rest">✕</span>}
            </motion.button>
          );
        })}
      </div>
      <p className="cal__hint">Click a day to mark it active</p>
    </div>
  );
}

/* ============================================================
   ONBOARDING CHECKLIST
   ============================================================ */
function OnboardingChecklist() {
  const STORAGE_KEY = 'gainlytics_checklist_v1';
  const navigate = useNavigate();

  const steps = [
    { id: 'photo',    label: 'Add measurements or photo', route: '/analyzer' },
    { id: 'goal',     label: 'Set a goal',                route: '/goalplanner' },
    { id: 'workout',  label: 'Log your first workout',    route: '/workouts' },
    { id: 'progress', label: 'Update your progress',      route: '/progress' },
  ];

  const [completed, setCompleted] = useState({});
  const confettiFired = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) setCompleted(saved);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  }, [completed]);

  const toggle = (id) => setCompleted((prev) => ({ ...prev, [id]: !prev[id] }));

  const doneCount = steps.filter((s) => completed[s.id]).length;
  const allDone   = doneCount === steps.length;
  const pct       = Math.round((doneCount / steps.length) * 100);

  useEffect(() => {
    if (allDone && !confettiFired.current) {
      confettiFired.current = true;
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#1D9E75', '#5DCAA5', '#fff'] });
    }
  }, [allDone]);

  if (allDone) {
    return (
      <motion.div
        className="checklist-done"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <span className="checklist-done__emoji">🎉</span>
        <p className="checklist-done__title">You're all set!</p>
        <p className="checklist-done__sub">You've completed the getting started guide.</p>
      </motion.div>
    );
  }

  return (
    <div className="checklist">
      <div className="checklist__bar-track">
        <motion.div
          className="checklist__bar-fill"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <p className="checklist__progress-label">{doneCount} of {steps.length} complete</p>
      <ul className="checklist__list">
        {steps.map((step) => (
          <li key={step.id} className="checklist__item">
            <motion.button
              className={`checklist__check ${completed[step.id] ? 'checklist__check--done' : ''}`}
              onClick={() => toggle(step.id)}
              whileTap={{ scale: 0.75 }}
              animate={completed[step.id] ? { scale: [1, 1.35, 1] } : {}}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {completed[step.id] && <span>✓</span>}
            </motion.button>
            <span className="checklist__label" onClick={() => navigate(step.route)}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
   STAT CARD (count-up animation)
   ============================================================ */
function StatCard({ label, value, unit, color, max }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 800;
    const step = Math.ceil(value / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  const fillPct = Math.min((value / max) * 100, 100);

  return (
    <div className="stat-card">
      <p className="stat-card__value" style={{ color }}>
        {display.toLocaleString()}
        <span className="stat-card__unit">{unit}</span>
      </p>
      <div className="stat-card__bar-track">
        <div className="stat-card__bar-fill" style={{ background: color, width: `${fillPct}%` }} />
      </div>
    </div>
  );
}

/* ============================================================
   QUICK LINKS
   ============================================================ */
function QuickLinks() {
  const navigate = useNavigate();
  const links = [
    { label: 'Body Analysis', icon: ScanLine,  route: '/analyzer' },
    { label: 'Progress',      icon: BarChart2, route: '/progress' },
    { label: 'Workouts',      icon: Dumbbell,  route: '/workouts' },
    { label: 'Exercise Lib',  icon: BookOpen,  route: '/exercises' },
  ];
  return (
    <div className="quick-links">
      {links.map(({ label, icon: Icon, route }) => (
        <button key={route} className="quick-links__item" onClick={() => navigate(route)}>
          <Icon size={20} className="quick-links__icon" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   STREAK BADGE
   ============================================================ */
function StreakBadge({ streak }) {
  return (
    <motion.div
      className="streak-badge"
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
    >
      <Flame size={14} />
      {streak}-day streak
    </motion.div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
export default function Dashboard() {
  const hour     = new Date().getHours();
  const today    = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Placeholder values — wire to Supabase once new DB is set up
  const caloriesLogged = 1840;
  const proteinLogged  = 132;
  const streak         = 7;

  return (
    <div className="dashboard-v2">
      {/* Greeting header */}
      <div className="dashboard-v2__header">
        <div>
          <h1 className="dashboard-v2__greeting">{greeting}</h1>
          <p className="dashboard-v2__date">{today}</p>
        </div>
        <StreakBadge streak={streak} />
      </div>

      {/* Bento grid */}
      <div className="bento-grid">
        <BentoCard title="Consistency Calendar" span="wide" index={0}>
          <ConsistencyCalendar />
        </BentoCard>

        <BentoCard title="Getting Started" index={1}>
          <OnboardingChecklist />
        </BentoCard>

        <BentoCard title="Today's Calories" index={2}>
          <StatCard label="Calories" value={caloriesLogged} unit=" kcal" color="var(--accent-light)" max={2500} />
        </BentoCard>

        <BentoCard title="Today's Protein" index={3}>
          <StatCard label="Protein" value={proteinLogged} unit="g" color="var(--accent-light)" max={180} />
        </BentoCard>

        <BentoCard title="Quick Access" index={4}>
          <QuickLinks />
        </BentoCard>
      </div>
    </div>
  );
}
