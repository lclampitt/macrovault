import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Ruler, BarChart2, Dumbbell, BookOpen, Flame, Info, X, ArrowUpRight, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';
import posthog from '../lib/posthog';
import { getStreak, invalidateStreakCache } from '../lib/streak';
import { usePlan } from '../hooks/usePlan';
import { useUpgrade } from '../context/UpgradeContext';
import BentoCard from '../components/ui/BentoCard';
import { supabase } from '../supabaseClient';
import '../styles/dashboard.css';

/* ============================================================
   CONSISTENCY CALENDAR
   ============================================================ */
function ConsistencyCalendar({ userId }) {
  const STORAGE_KEY = 'macrovault_consistency_calendar_v1';
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear]   = useState(today.getFullYear());
  const [activeDays, setActiveDays]     = useState({});
  // eslint-disable-next-line no-unused-vars
  const [ripple, setRipple]             = useState(null);

  // Supabase data for dots + popovers
  const [monthWorkouts,  setMonthWorkouts]  = useState({}); // { 'YYYY-MM-DD': [name, ...] }
  const [monthNutrition, setMonthNutrition] = useState({}); // { 'YYYY-MM-DD': { calories, protein } }
  const [popoverKey, setPopoverKey] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [pinnedKey,  setPinnedKey]  = useState(null); // stays open until clicked away
  const hideTimer = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) setActiveDays(saved);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activeDays));
  }, [activeDays]);

  // Fetch workouts + food_logs for the visible month
  useEffect(() => {
    if (!userId) return;
    const mm     = String(currentMonth + 1).padStart(2, '0');
    const last   = new Date(currentYear, currentMonth + 1, 0).getDate();
    const first  = `${currentYear}-${mm}-01`;
    const end    = `${currentYear}-${mm}-${String(last).padStart(2, '0')}`;

    (async () => {
      const [{ data: workouts }, { data: logs }] = await Promise.all([
        supabase.from('workouts').select('workout_date, workout_name')
          .eq('user_id', userId).gte('workout_date', first).lte('workout_date', end),
        supabase.from('food_logs').select('logged_date, calories, protein_g')
          .eq('user_id', userId).gte('logged_date', first).lte('logged_date', end),
      ]);

      const wMap = {};
      (workouts || []).forEach((w) => {
        if (!wMap[w.workout_date]) wMap[w.workout_date] = [];
        wMap[w.workout_date].push(w.workout_name);
      });
      setMonthWorkouts(wMap);

      const nMap = {};
      (logs || []).forEach((l) => {
        if (!nMap[l.logged_date]) nMap[l.logged_date] = { calories: 0, protein: 0 };
        nMap[l.logged_date].calories += Number(l.calories)  || 0;
        nMap[l.logged_date].protein  += Number(l.protein_g) || 0;
      });
      setMonthNutrition(nMap);
    })();
  }, [userId, currentMonth, currentYear]);

  // Unpin + close on outside click (only when pinned)
  useEffect(() => {
    if (!pinnedKey) return;
    const handle = (e) => {
      if (!e.target.closest('.cal__popover') && !e.target.closest('.cal__info-btn')) {
        setPinnedKey(null);
        setPopoverKey(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [pinnedKey]);

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

  function calcPos(el) {
    const rect = el.getBoundingClientRect();
    let top  = rect.bottom + 6;
    let left = rect.left + rect.width / 2 - 110;
    left = Math.max(8, Math.min(left, window.innerWidth - 228));
    if (top + 180 > window.innerHeight) top = rect.top - 186;
    return { top, left };
  }

  function handleInfoEnter(e, key) {
    clearTimeout(hideTimer.current);
    setPopoverPos(calcPos(e.currentTarget));
    setPopoverKey(key);
  }

  function handleInfoLeave() {
    if (pinnedKey) return;
    hideTimer.current = setTimeout(() => setPopoverKey(null), 120);
  }

  function handlePopoverEnter() {
    clearTimeout(hideTimer.current);
  }

  function handlePopoverLeave() {
    if (pinnedKey) return;
    hideTimer.current = setTimeout(() => setPopoverKey(null), 120);
  }

  function handleInfoClick(e, key) {
    e.stopPropagation();
    if (pinnedKey === key) {
      setPinnedKey(null);
      setPopoverKey(null);
    } else {
      setPinnedKey(key);
      setPopoverPos(calcPos(e.currentTarget));
      setPopoverKey(key);
    }
  }

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

  // Active popover data
  const pwNames = popoverKey ? (monthWorkouts[popoverKey]  || []) : [];
  const pNutr   = popoverKey ? (monthNutrition[popoverKey] || null) : null;
  const pDay    = popoverKey ? Number(popoverKey.split('-')[2]) : null;
  const pDate   = pDay
    ? new Date(currentYear, currentMonth, pDay).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : '';

  return (
    <>
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
            const key      = formatKey(currentYear, currentMonth, day);
            const isActive = !!activeDays[key];
            const hasData  = !!(monthWorkouts[key]?.length || monthNutrition[key]);
            return (
              <motion.button
                key={i}
                className={`cal__cell ${isActive ? 'cal__cell--active' : ''}`}
                onClick={() => toggleDay(day)}
                whileTap={{ scale: 0.8 }}
              >
                <span className="cal__day-num">{day}</span>
                {hasData && <span className="cal__dot" />}
                {userId && (
                  <span
                    className="cal__info-btn"
                    role="button"
                    aria-label="View day history"
                    onMouseEnter={(e) => handleInfoEnter(e, key)}
                    onMouseLeave={handleInfoLeave}
                    onClick={(e) => handleInfoClick(e, key)}
                  >
                    <Info size={18} />
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
        <p className="cal__hint">Click a day to mark it active</p>
      </div>

      {/* Popover rendered via portal so it escapes overflow:hidden */}
      {createPortal(
        <AnimatePresence>
          {popoverKey && (
            <motion.div
              className="cal__popover"
              style={{ top: popoverPos.top, left: popoverPos.left }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={handlePopoverEnter}
              onMouseLeave={handlePopoverLeave}
            >
              <div className="cal__popover-header">
                <span>{pDate}</span>
                <button className="cal__popover-close" onClick={() => setPopoverKey(null)}>
                  <X size={12} />
                </button>
              </div>
              <div className="cal__popover-section">
                <span className="cal__popover-label">Workouts</span>
                {pwNames.length > 0
                  ? pwNames.map((n, idx) => <p key={idx} className="cal__popover-item">{n}</p>)
                  : <p className="cal__popover-empty">No workouts logged.</p>}
              </div>
              <div className="cal__popover-section">
                <span className="cal__popover-label">Nutrition</span>
                {pNutr
                  ? <>
                      <p className="cal__popover-item">{Math.round(pNutr.calories)} kcal</p>
                      <p className="cal__popover-item">{Math.round(pNutr.protein)}g protein</p>
                    </>
                  : <p className="cal__popover-empty">No nutrition logged.</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

/* ============================================================
   DAILY CHECKLIST
   ============================================================ */
function CheckCircle({ checked }) {
  return (
    <div className={`dc__circle ${checked ? 'dc__circle--checked' : ''}`}>
      <AnimatePresence>
        {checked && (
          <motion.span
            className="dc__checkmark"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            ✓
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function DailyChecklist({ userId }) {
  const navigate = useNavigate();
  const confettiFired = useRef(false);

  const items = [
    { key: 'workout',   label: 'Log your workout',     route: '/workouts' },
    { key: 'nutrition', label: 'Log your nutrition',   route: '/goalplanner' },
    { key: 'progress',  label: 'Update your progress', route: '/progress' },
  ];

  const [checks,  setChecks]  = useState({ workout: false, nutrition: false, progress: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const today = new Date().toISOString().slice(0, 10);

    (async () => {
      const [{ data: workouts }, { data: foodLogs }, { data: progressRows }] = await Promise.all([
        supabase.from('workouts').select('id').eq('user_id', userId).eq('workout_date', today).limit(1),
        supabase.from('food_logs').select('id').eq('user_id', userId).eq('logged_date', today).limit(1),
        supabase.from('progress').select('id').eq('user_id', userId).eq('date', today).limit(1),
      ]);
      setChecks({
        workout:   (workouts?.length   ?? 0) > 0,
        nutrition: (foodLogs?.length   ?? 0) > 0,
        progress:  (progressRows?.length ?? 0) > 0,
      });
      setLoading(false);
    })();
  }, [userId]);

  const doneCount = Object.values(checks).filter(Boolean).length;
  const allDone   = doneCount === 3;
  const pct       = Math.round((doneCount / 3) * 100);

  useEffect(() => {
    if (allDone && !confettiFired.current) {
      confettiFired.current = true;
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#1D9E75', '#5DCAA5', '#fff'] });
    }
  }, [allDone]);

  if (loading) return <p className="dc__loading">Checking today…</p>;

  return (
    <div className="dc">
      {allDone ? (
        <p className="dc__all-done">All done for today!</p>
      ) : (
        <>
          <p className="dc__progress-label">{doneCount} of 3 complete</p>
          <div className="dc__bar-track">
            <motion.div
              className="dc__bar-fill"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </>
      )}
      <ul className="dc__list">
        {items.map(({ key, label, route }) => (
          <motion.li
            key={key}
            className={`dc__item ${checks[key] ? 'dc__item--done' : ''}`}
            onClick={() => navigate(route)}
            whileHover={{ backgroundColor: checks[key] ? 'var(--accent-bg)' : 'rgba(29,158,117,0.06)' }}
            transition={{ duration: 0.15 }}
          >
            <CheckCircle checked={checks[key]} />
            <span className="dc__label">{label}</span>
            <ArrowUpRight size={12} className="dc__arrow" />
          </motion.li>
        ))}
      </ul>
    </div>
  );
}


/* ============================================================
   QUICK LINKS
   ============================================================ */
function QuickLinks() {
  const navigate = useNavigate();
  const links = [
    { label: 'Measurements', icon: Ruler,     route: '/measurements' },
    { label: 'Progress',      icon: BarChart2, route: '/progress' },
    { label: 'Workouts',      icon: Dumbbell,  route: '/workouts' },
    { label: 'Exercise Library', icon: BookOpen, route: '/exercises' },
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
      {streak > 0 ? `${streak}-day streak` : 'Start your streak!'}
    </motion.div>
  );
}

/* ============================================================
   DAILY MACROS CARD
   ============================================================ */
const CIRC = 2 * Math.PI * 40;

function DailyMacrosCard({ caloriesLogged, calorieGoal, proteinLogged, proteinGoal, carbsLogged, carbsGoal, fatLogged, fatGoal }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);

  const calPct    = calorieGoal > 0 ? Math.min(caloriesLogged / calorieGoal, 1) : 0;
  const calOver   = calorieGoal != null && caloriesLogged > calorieGoal;
  const ringOffset = mounted ? CIRC * (1 - calPct) : CIRC;
  const ringColor  = calOver ? '#EF9F27' : '#1D9E75';

  const macros = [
    { name: 'Protein', logged: proteinLogged, goal: proteinGoal, color: '#1D9E75' },
    { name: 'Carbs',   logged: carbsLogged,   goal: carbsGoal,   color: '#5DCAA5' },
    { name: 'Fat',     logged: fatLogged,     goal: fatGoal,     color: '#0F6E56' },
  ];

  const hasGoal = calorieGoal != null || proteinGoal != null;

  return (
    <div className="dm">
      {/* Left — calorie ring */}
      <div className="dm__ring-col">
        <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
          {/* track */}
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="8" />
          {/* progress arc */}
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={ringOffset}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease' }}
          />
          <text x="50" y="43" textAnchor="middle" fontSize="15" fontWeight="500" fill="var(--text-primary)" fontFamily="inherit">{caloriesLogged.toLocaleString()}</text>
          <text x="50" y="60" textAnchor="middle" fontSize="9"  fill="var(--text-muted)" fontFamily="inherit">kcal</text>
        </svg>
        <p className="dm__ring-sub">
          {calorieGoal != null ? `of ${calorieGoal.toLocaleString()} kcal goal` : 'No goal set'}
        </p>
      </div>

      {/* Right — macro bars */}
      <div className="dm__bars-col">
        {macros.map(({ name, logged, goal, color }, i) => {
          const pct  = goal > 0 ? Math.min((logged / goal) * 100, 100) : 0;
          const over = goal != null && logged > goal;
          return (
            <div key={name} className="dm__bar-row">
              <div className="dm__bar-header">
                <span className="dm__bar-name">{name}</span>
                <span className="dm__bar-values">{goal != null ? `${logged}g / ${goal}g` : '— / —'}</span>
              </div>
              <div className="dm__bar-track">
                <motion.div
                  className="dm__bar-fill"
                  style={{ background: over ? '#EF9F27' : color }}
                  initial={{ width: '0%' }}
                  animate={{ width: mounted ? `${pct}%` : '0%' }}
                  transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}
        {!hasGoal && <p className="dm__no-goal">Set a goal to track macros</p>}
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
export default function Dashboard() {
  const navigate = useNavigate();
  const { triggerUpgrade } = useUpgrade();
  const { plan, isPro } = usePlan();
  const hour     = new Date().getHours();
  const today    = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Feature flag — reserved for future dashboard redesign
  // eslint-disable-next-line no-unused-vars
  const showNewDashboard = posthog.isFeatureEnabled('new_dashboard');

  const [session, setSession]         = useState(null);
  const [streak,  setStreak]          = useState(0);
  const [caloriesLogged, setCalories] = useState(0);
  const [proteinLogged, setProtein]   = useState(0);
  const [carbsLogged, setCarbsLogged] = useState(0);
  const [fatLogged, setFatLogged]     = useState(0);
  const [calorieGoal, setCalorieGoal] = useState(null);
  const [proteinGoal, setProteinGoal] = useState(null);
  const [carbsGoal, setCarbsGoal]     = useState(null);
  const [fatGoal, setFatGoal]         = useState(null);

  // Get session once on mount, then fetch streak
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const sess = data?.session ?? null;
      setSession(sess);
      if (sess?.user?.id) {
        const s = await getStreak(sess.user.id);
        if (mounted) setStreak(s);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch goals + today's food totals, then subscribe to live changes
  useEffect(() => {
    if (!session?.user?.id || !isPro) return;
    const uid       = session.user.id;
    const todayDate = new Date().toISOString().slice(0, 10);

    async function loadNutrition() {
      const [{ data: goal }, { data: logs }] = await Promise.all([
        supabase.from('goals').select('calories, protein, carbs, fat').eq('user_id', uid).maybeSingle(),
        supabase.from('food_logs').select('calories, protein_g, carbs_g, fat_g').eq('user_id', uid).eq('logged_date', todayDate),
      ]);

      setCalorieGoal(goal?.calories ?? null);
      setProteinGoal(goal?.protein  ?? null);
      setCarbsGoal(goal?.carbs      ?? null);
      setFatGoal(goal?.fat          ?? null);

      if (logs) {
        setCalories(Math.round(logs.reduce((s, r) => s + (r.calories  ?? 0), 0)));
        setProtein(Math.round(logs.reduce((s, r)  => s + (r.protein_g ?? 0), 0)));
        setCarbsLogged(Math.round(logs.reduce((s, r) => s + (r.carbs_g ?? 0), 0)));
        setFatLogged(Math.round(logs.reduce((s, r)   => s + (r.fat_g   ?? 0), 0)));
      } else {
        setCalories(0); setProtein(0); setCarbsLogged(0); setFatLogged(0);
      }
    }

    async function loadNutritionAndStreak() {
      await loadNutrition();
      invalidateStreakCache(uid);
      const s = await getStreak(uid);
      setStreak(s);
    }

    loadNutritionAndStreak();

    const channel = supabase
      .channel(`food_logs_dashboard_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_logs', filter: `user_id=eq.${uid}` }, loadNutritionAndStreak)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, plan]);

  return (
    <div className="dashboard-v2">
      {/* Greeting header */}
      <div className="dashboard-v2__header">
        <div>
          <h1 className="dashboard-v2__greeting">{greeting}</h1>
          <p className="dashboard-v2__date">{today}</p>
        </div>
        {streak > 1 && <StreakBadge streak={streak} />}
      </div>

      {/* Bento grid */}
      {(() => {
        return (
          <div className="bento-grid">
            <BentoCard title="Consistency Calendar" span="wide" index={0}>
              <ConsistencyCalendar userId={session?.user?.id} />
            </BentoCard>

            <BentoCard title="Daily checklist" index={1}>
              <DailyChecklist userId={session?.user?.id} />
            </BentoCard>

            <BentoCard
              title="Daily Macros"
              action={{ label: 'Log nutrition', onClick: () => navigate('/goalplanner') }}
              span="wide"
              index={2}
            >
              <div style={{ position: 'relative' }}>
                <div style={{ filter: !isPro ? 'blur(4px)' : 'none', pointerEvents: !isPro ? 'none' : 'auto', userSelect: !isPro ? 'none' : 'auto' }}>
                  <DailyMacrosCard
                    caloriesLogged={caloriesLogged}
                    calorieGoal={calorieGoal}
                    proteinLogged={proteinLogged}
                    proteinGoal={proteinGoal}
                    carbsLogged={carbsLogged}
                    carbsGoal={carbsGoal}
                    fatLogged={fatLogged}
                    fatGoal={fatGoal}
                  />
                </div>
                {!isPro && (
                  <div className="dm__lock-overlay">
                    <Lock size={18} style={{ color: '#1D9E75' }} />
                    <span className="dm__lock-label">Pro feature</span>
                    <button className="dm__lock-btn" onClick={() => triggerUpgrade('goals')}>
                      Upgrade to Pro
                    </button>
                  </div>
                )}
              </div>
            </BentoCard>

            <BentoCard title="Quick Access" index={3}>
              <QuickLinks />
            </BentoCard>
          </div>
        );
      })()}
    </div>
  );
}
