import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import {
  Home,
  Ruler,
  Calculator,
  Target,
  Dumbbell,
  BarChart2,
  BookOpen,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Crown,
  Lock,
  Settings,
  Sun,
  Moon,
  TrendingUp,
  LayoutGrid,
  X,
  Palette,
  Check,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import './Sidebar.css';

const FREE_NAV_ITEMS = [
  { to: '/home',          label: 'Home',             icon: Home             },
  { to: '/calculators',   label: 'Calculators',      icon: Calculator       },
  { to: '/workouts',      label: 'Workouts',         icon: Dumbbell         },
  { to: '/exercises',     label: 'Exercise Library',  icon: BookOpen         },
  { to: '/measurements',  label: 'Measurements',     icon: Ruler            },
];

const PRO_NAV_ITEMS = [
  { to: '/goalplanner',   label: 'Goal Planner',     icon: Target            },
  { to: '/meal-planner',  label: 'Meal Planner',     icon: UtensilsCrossed   },
  { to: '/progress',      label: 'Progress',         icon: BarChart2         },
];

const MOBILE_TABS = [
  { to: '/home',         icon: Home,            label: 'Home'     },
  { to: '/workouts',     icon: Dumbbell,        label: 'Workouts' },
  { to: '/meal-planner', icon: UtensilsCrossed, label: 'Meals'    },
  { to: '/progress',     icon: TrendingUp,      label: 'Progress' },
];

const MORE_PAGES = [
  { to: '/goalplanner',  icon: Target,     label: 'Goal Planner', proBadge: true },
  { to: '/calculators',  icon: Calculator, label: 'Calculators' },
  { to: '/exercises',    icon: BookOpen,   label: 'Exercise Library' },
  { to: '/measurements', icon: Ruler,      label: 'Measurements' },
  { to: '/settings',     icon: Settings,   label: 'Settings' },
];

const MORE_ROUTES = ['/goalplanner', '/calculators', '/exercises', '/measurements', '/settings'];

const QUICK_THEMES = [
  { id: 'teal',       label: 'Teal',       color: '#1D9E75' },
  { id: 'blue',       label: 'Blue',       color: '#3B82F6' },
  { id: 'orange',     label: 'Orange',     color: '#F97316' },
  { id: 'rose',       label: 'Rose',       color: '#F43F5E' },
  { id: 'violet',     label: 'Violet',     color: '#8B5CF6' },
  { id: 'crimson',    label: 'Crimson',    color: '#DC2626' },
  { id: 'spectrum',   label: 'Spectrum',   color: '#7C3AED',  gradient: 'linear-gradient(135deg, #7C3AED, #2563EB, #DB2777)' },
  { id: 'xp-aqua',    label: 'XP Aqua',    color: '#00BFFF',  gradient: 'linear-gradient(135deg, #00BFFF, #39FF14)', retro: true },
  { id: 'myspace',    label: 'MySpace',    color: '#FF00FF',  gradient: 'linear-gradient(135deg, #FF00FF, #8800FF)', retro: true },
  { id: 'y2k-chrome', label: 'Y2K Chrome', color: '#FFD700',  gradient: 'linear-gradient(135deg, #888, #FFD700)', retro: true },
];

const getNavColor = (route, accent) => {
  if (accent === 'spectrum') {
    const map = {
      '/home':         { bg:'#0a1a0f', border:'#1D9E75', text:'#5DCAA5', icon:'#5DCAA5' },
      '/calculators':  { bg:'#1a0d30', border:'#7C3AED', text:'#A78BFA', icon:'#A78BFA' },
      '/workouts':     { bg:'#0a1a0f', border:'#1D9E75', text:'#5DCAA5', icon:'#5DCAA5' },
      '/exercises':    { bg:'#2a0d1a', border:'#DB2777', text:'#F472B6', icon:'#F472B6' },
      '/measurements': { bg:'#2a0d1a', border:'#DB2777', text:'#F472B6', icon:'#F472B6' },
      '/goalplanner':  { bg:'#0a1a3a', border:'#2563EB', text:'#60A5FA', icon:'#60A5FA' },
      '/meal-planner': { bg:'#2a1208', border:'#EA580C', text:'#FB923C', icon:'#FB923C' },
      '/progress':     { bg:'#2a1a04', border:'#EF9F27', text:'#FAC775', icon:'#FAC775' },
      '/settings':     { bg:'#1e1a30', border:'#7C3AED', text:'#A78BFA', icon:'#A78BFA' },
    };
    return map[route] || map['/home'];
  }
  if (accent === 'xp-aqua') {
    return { bg:'#0a1a2a', border:'#00BFFF', text:'#66D9FF', icon:'#66D9FF' };
  }
  if (accent === 'myspace') {
    return { bg:'#2a002a', border:'#FF00FF', text:'#FF66FF', icon:'#FF66FF' };
  }
  if (accent === 'y2k-chrome') {
    return { bg:'#1a1a00', border:'#FFD700', text:'#FFE566', icon:'#FFE566' };
  }
  return null;
};

const getMobileDotColor = (route, accent) => {
  if (accent === 'spectrum') {
    const map = { '/home': '#1D9E75', '/workouts': '#1D9E75', '/meal-planner': '#EA580C', '/progress': '#EF9F27' };
    return map[route] || null;
  }
  if (accent === 'xp-aqua') return '#39FF14';
  if (accent === 'myspace') return '#FF00FF';
  if (accent === 'y2k-chrome') return '#FFD700';
  return null;
};

export default function Sidebar({ session, onLogout, isPro, isProPlus, usage }) {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isOverflowPage = MORE_ROUTES.some((r) => location.pathname.startsWith(r));
  const isMoreActive = moreOpen || isOverflowPage;

  // Close More sheet on route change
  useEffect(() => { setMoreOpen(false); setThemeSheetOpen(false); }, [location.pathname]);
  const { theme, toggle: toggleTheme, isDark, isSpectrum, isXpAqua, isMyspace, isY2kChrome, isRetro, accent, isY2K, uiMode, setAccent, setUiMode } = useTheme();

  const userEmail = session?.user?.email ?? '';
  const emailFallback = userEmail.split('@')[0] || 'User';
  const [displayName, setDisplayName] = useState(emailFallback);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;

    supabase.from('profiles').select('display_name').eq('id', uid).maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name?.trim() || emailFallback);
      });

    const channel = supabase.channel(`sidebar_profile_${uid}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` }, (payload) => {
        const name = payload.new?.display_name?.trim();
        if (name) setDisplayName(name);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    setMoreOpen(false);
    setActionSheetOpen(false);
    await onLogout();
    navigate('/auth');
  };

  const SidebarContent = () => (
    <div className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon" style={isSpectrum ? { background: 'linear-gradient(135deg, #7C3AED, #2563EB)' } : isXpAqua ? { background: 'linear-gradient(135deg, #00BFFF, #39FF14)' } : isMyspace ? { background: 'linear-gradient(135deg, #FF00FF, #8800FF)' } : isY2kChrome ? { background: 'linear-gradient(135deg, #888888, #FFD700)' } : undefined}><Lock size={18} /></div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className="sidebar__logo-name"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
            >
              MacroVault
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Y2K section label */}
      {isY2K && !collapsed && <div className="sidebar__y2k-label">Navigation</div>}

      {/* Nav — Free items */}
      <nav className="sidebar__nav">
        {FREE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
              }
              title={collapsed ? item.label : undefined}
              style={({ isActive }) => {
                const sc = getNavColor(item.to, accent);
                if (!isActive || !sc) return undefined;
                return {
                  background: sc.bg,
                  borderLeftColor: sc.border,
                  color: sc.text,
                };
              }}
            >
              {({ isActive }) => {
                const sc = getNavColor(item.to, accent);
                return (
                  <>
                    <Icon size={18} className="sidebar__nav-icon" style={isActive && sc ? { color: sc.icon } : undefined} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          className="sidebar__nav-label"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </nav>

      {/* Nav — Pro section */}
      <div className={`sidebar__section-label${isY2K ? ' sidebar__section-label--y2k' : ''}`}>
        <AnimatePresence>
          {!collapsed ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={(isSpectrum || isRetro) ? { color: 'var(--accent)' } : undefined}
            >
              {isY2K ? '⭐ Pro Features' : 'PRO'}
            </motion.span>
          ) : (
            <motion.div
              className="sidebar__section-divider"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
          )}
        </AnimatePresence>
      </div>
      <nav className="sidebar__nav sidebar__nav--pro">
        {PRO_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
              }
              title={collapsed ? item.label : undefined}
              style={({ isActive }) => {
                const sc = getNavColor(item.to, accent);
                if (!isActive || !sc) return undefined;
                return {
                  background: sc.bg,
                  borderLeftColor: sc.border,
                  color: sc.text,
                };
              }}
            >
              {({ isActive }) => {
                const sc = getNavColor(item.to, accent);
                return (
                  <>
                    <Icon size={18} className="sidebar__nav-icon" style={isActive && sc ? { color: sc.icon } : undefined} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          className="sidebar__nav-label"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {!isPro && !collapsed && (
                      <Lock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: 'auto' }} title="Pro feature" />
                    )}
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="sidebar__spacer" />

      {/* Theme toggle — pinned above Settings (hidden for retro themes) */}
      {!isRetro && (
        <div style={{ padding: '0 8px 2px' }}>
          <button
            className="sidebar__theme-toggle"
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {isDark ? 'Light mode' : 'Dark mode'}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      )}

      {/* Settings — pinned above user section */}
      <div style={{ padding: '0 8px 4px' }}>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
          title={collapsed ? 'Settings' : undefined}
          style={({ isActive }) => {
            const sc = getNavColor('/settings', accent);
            if (!isActive || !sc) return undefined;
            return {
              background: sc.bg,
              borderLeftColor: sc.border,
              color: sc.text,
            };
          }}
        >
          {({ isActive }) => {
            const sc = getNavColor('/settings', accent);
            return (
              <>
                <Settings size={18} className="sidebar__nav-icon" style={isActive && sc ? { color: sc.icon } : undefined} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      className="sidebar__nav-label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      Settings
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            );
          }}
        </NavLink>
      </div>

      {/* User section */}
      <div className="sidebar__user">
        <div className="sidebar__avatar" style={isSpectrum ? { background: 'linear-gradient(135deg, #7C3AED, #DB2777)' } : isXpAqua ? { background: 'linear-gradient(135deg, #00BFFF, #39FF14)' } : isMyspace ? { background: 'linear-gradient(135deg, #FF00FF, #8800FF)' } : isY2kChrome ? { background: 'linear-gradient(135deg, #888888, #FFD700)' } : undefined}>
          <User size={14} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              className="sidebar__user-info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <span className="sidebar__user-name">{displayName}</span>
              {isPro ? (
                <span className="sidebar__pro-badge">
                  <Crown size={10} /> {isProPlus ? 'Pro+' : 'Pro'}
                </span>
              ) : (
                <span className="sidebar__free-badge">Free</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {!collapsed && (
            <motion.button
              className="sidebar__logout"
              onClick={handleLogout}
              title="Sign out"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <LogOut size={15} />
            </motion.button>
          )}
        </AnimatePresence>
        {collapsed && (
          <button
            className="sidebar__logout sidebar__logout--collapsed"
            onClick={handleLogout}
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        className="sidebar__collapse-btn"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — hidden on mobile via CSS */}
      <div className="sidebar-desktop">
        <SidebarContent />
      </div>

      {/* ── Mobile top bar ── */}
      <div className="mob-topbar">
        <Link to="/home" className="mob-topbar__logo">
          <div className="mob-topbar__logo-icon" style={isSpectrum ? { background: 'linear-gradient(135deg, #7C3AED, #2563EB)' } : isXpAqua ? { background: 'linear-gradient(135deg, #00BFFF, #39FF14)' } : isMyspace ? { background: 'linear-gradient(135deg, #FF00FF, #8800FF)' } : isY2kChrome ? { background: 'linear-gradient(135deg, #888888, #FFD700)' } : undefined}><Lock size={16} /></div>
          <span className="mob-topbar__logo-name">MacroVault</span>
        </Link>
        <div className="mob-topbar__right">
          <button
            className="mob-topbar__theme-btn"
            onClick={() => setThemeSheetOpen(true)}
            aria-label="Quick theme switcher"
          >
            <Palette size={16} />
          </button>
          <button
            className="mob-topbar__avatar"
            onClick={() => setActionSheetOpen(true)}
            aria-label="Open user menu"
            style={isSpectrum ? { background: 'linear-gradient(135deg, #7C3AED, #DB2777)' } : isXpAqua ? { background: 'linear-gradient(135deg, #00BFFF, #39FF14)' } : isMyspace ? { background: 'linear-gradient(135deg, #FF00FF, #8800FF)' } : isY2kChrome ? { background: 'linear-gradient(135deg, #888888, #FFD700)' } : undefined}
          >
            {initials}
          </button>
        </div>
      </div>

      {/* ── Mobile bottom nav — 5 tabs ── */}
      <nav className="mob-bottom-nav">
        {MOBILE_TABS.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
          const customDotColor = getMobileDotColor(to, accent);
          return (
            <motion.button
              key={to}
              className={`mob-nav-tab${isActive ? ' mob-nav-tab--active' : ''}`}
              onClick={() => navigate(to)}
              whileTap={{ scale: 0.9 }}
            >
              {isActive && <span className="mob-nav-tab__dot" style={customDotColor ? { background: customDotColor } : undefined} />}
              <Icon size={20} />
              <span className="mob-nav-tab__label">{label}</span>
            </motion.button>
          );
        })}
        <motion.button
          className={`mob-nav-tab${isMoreActive ? ' mob-nav-tab--active' : ''}`}
          onClick={() => setMoreOpen((p) => !p)}
          whileTap={{ scale: 0.9 }}
        >
          {isMoreActive && <span className="mob-nav-tab__dot" style={getMobileDotColor('/home', accent) ? { background: accent === 'spectrum' ? '#7C3AED' : accent === 'xp-aqua' ? '#00BFFF' : accent === 'myspace' ? '#FF00FF' : accent === 'y2k-chrome' ? '#FFD700' : undefined } : undefined} />}
          <LayoutGrid size={20} />
          <span className="mob-nav-tab__label">More</span>
        </motion.button>
      </nav>

      {/* ── More sheet ── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              className="mob-more-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              className="mob-more-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            >
              <div className="mob-more-sheet__handle" />
              <div className="mob-more-sheet__header">
                <span className="mob-more-sheet__title">All pages</span>
                <button className="mob-more-sheet__close" onClick={() => setMoreOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="mob-more-sheet__grid">
                {MORE_PAGES.map(({ to, icon: Icon, label, proBadge }, idx) => {
                  const isPageActive = location.pathname.startsWith(to);
                  return (
                    <motion.button
                      key={to}
                      className={`mob-more-item${isPageActive ? ' mob-more-item--active' : ''}`}
                      onClick={() => { setMoreOpen(false); navigate(to); }}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      whileTap={{ scale: 0.94 }}
                    >
                      {proBadge && !isPro && (
                        <span className="mob-more-item__badge">Pro</span>
                      )}
                      <div className={`mob-more-item__icon${isPageActive ? ' mob-more-item__icon--active' : ''}`}>
                        <Icon size={18} />
                      </div>
                      <span className="mob-more-item__label">{label}</span>
                    </motion.button>
                  );
                })}
                <div className="mob-more-item mob-more-item--empty" />
              </div>
              {/* Theme indicator row */}
              <button
                className="mob-more-theme-row"
                onClick={() => { setMoreOpen(false); setTimeout(() => setThemeSheetOpen(true), 200); }}
              >
                <span
                  className="mob-more-theme-row__dot"
                  style={{ background: (QUICK_THEMES.find(t => t.id === accent)?.gradient || QUICK_THEMES.find(t => t.id === accent)?.color || 'var(--accent)') }}
                />
                <span className="mob-more-theme-row__text">
                  {uiMode === 'y2k' ? 'Y2K' : 'Modern'} · {QUICK_THEMES.find(t => t.id === accent)?.label || accent}
                </span>
                <Palette size={14} className="mob-more-theme-row__icon" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Quick Theme Sheet ── */}
      <AnimatePresence>
        {themeSheetOpen && (
          <>
            <motion.div
              className="mob-theme-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setThemeSheetOpen(false)}
            />
            <motion.div
              className="mob-theme-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            >
              <div className="mob-theme-sheet__handle" />
              <div className="mob-theme-sheet__header">
                <span className="mob-theme-sheet__title">Appearance</span>
                <button className="mob-theme-sheet__done" onClick={() => setThemeSheetOpen(false)}>Done</button>
              </div>

              {/* UI Mode */}
              <div className="mob-theme-sheet__section">
                <span className="mob-theme-sheet__label">UI Mode</span>
                <div className="mob-theme-sheet__pills">
                  <button
                    className={`mob-theme-pill${uiMode === 'modern' ? ' mob-theme-pill--active' : ''}`}
                    onClick={() => isPro && setUiMode('modern')}
                  >
                    Modern
                  </button>
                  <button
                    className={`mob-theme-pill${uiMode === 'y2k' ? ' mob-theme-pill--active' : ''}`}
                    onClick={() => isPro && setUiMode('y2k')}
                  >
                    Y2K
                  </button>
                </div>
              </div>

              {/* Dark / Light */}
              {!isRetro && (
                <div className="mob-theme-sheet__section">
                  <span className="mob-theme-sheet__label">Mode</span>
                  <div className="mob-theme-sheet__pills">
                    <button
                      className={`mob-theme-pill${isDark ? ' mob-theme-pill--active' : ''}`}
                      onClick={() => isPro && !isDark && toggleTheme()}
                    >
                      <Moon size={14} /> Dark
                    </button>
                    <button
                      className={`mob-theme-pill${!isDark ? ' mob-theme-pill--active' : ''}`}
                      onClick={() => isPro && isDark && toggleTheme()}
                    >
                      <Sun size={14} /> Light
                    </button>
                  </div>
                </div>
              )}

              {/* Color themes */}
              <div className="mob-theme-sheet__section">
                <span className="mob-theme-sheet__label">Color</span>
                <div className="mob-theme-sheet__colors">
                  {QUICK_THEMES.map((t) => (
                    <button
                      key={t.id}
                      className={`mob-theme-dot${accent === t.id ? ' mob-theme-dot--active' : ''}`}
                      onClick={() => {
                        if (!isPro) return;
                        if (t.retro && theme !== 'dark') toggleTheme();
                        setAccent(t.id);
                      }}
                    >
                      <span
                        className="mob-theme-dot__circle"
                        style={{ background: t.gradient || t.color }}
                      />
                      {accent === t.id && <Check size={10} className="mob-theme-dot__check" />}
                      <span className="mob-theme-dot__name">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Full settings link */}
              <button
                className="mob-theme-sheet__link"
                onClick={() => { setThemeSheetOpen(false); navigate('/settings'); }}
              >
                Full appearance settings →
              </button>

              {!isPro && (
                <div className="mob-theme-sheet__pro-note">
                  <Lock size={12} />
                  <span>Pro feature — themes require a Pro subscription</span>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Mobile action sheet (sign out) ── */}
      <AnimatePresence>
        {actionSheetOpen && (
          <>
            <motion.div
              className="mob-action-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionSheetOpen(false)}
            />
            <motion.div
              className="mob-action-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <button
                className="mob-action-sheet__item mob-action-sheet__item--danger"
                onClick={handleLogout}
              >
                Sign out
              </button>
              <button
                className="mob-action-sheet__item mob-action-sheet__item--cancel"
                onClick={() => setActionSheetOpen(false)}
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
