import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
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

const BOTTOM_NAV_ITEMS = [
  { to: '/home',      icon: Home      },
  { to: '/measurements',  icon: Ruler     },
  { to: '/workouts',  icon: Dumbbell  },
  { to: '/exercises', icon: BookOpen  },
  { to: '/settings',  icon: Settings  },
];

export default function Sidebar({ session, onLogout, isPro, isProPlus, usage }) {
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme, isDark } = useTheme();

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
    setSheetOpen(false);
    await onLogout();
    navigate('/auth');
  };

  const SidebarContent = () => (
    <div className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar__logo">
        <img src="/images/macrolock.png" alt="MacroVault" className="sidebar__logo-icon" />
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

      {/* Nav — Free items */}
      <nav className="sidebar__nav">
        {FREE_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="sidebar__nav-icon" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  className="sidebar__nav-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      {/* Nav — Pro section */}
      <div className="sidebar__section-label">
        <AnimatePresence>
          {!collapsed ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              PRO
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
        {PRO_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="sidebar__nav-icon" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  className="sidebar__nav-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
            {!isPro && !collapsed && (
              <Lock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: 'auto' }} title="Pro feature" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Spacer */}
      <div className="sidebar__spacer" />

      {/* Theme toggle — pinned above Settings */}
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

      {/* Settings — pinned above user section */}
      <div style={{ padding: '0 8px 4px' }}>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings size={18} className="sidebar__nav-icon" />
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
        </NavLink>
      </div>

      {/* User section */}
      <div className="sidebar__user">
        <div className="sidebar__avatar">
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
          <img src="/images/macrolock.png" alt="MacroVault" className="mob-topbar__logo-icon" />
          <span className="mob-topbar__logo-name">MacroVault</span>
        </Link>
        <button
          className="mob-topbar__avatar"
          onClick={() => setSheetOpen(true)}
          aria-label="Open user menu"
        >
          {initials}
        </button>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="mob-bottom-nav">
        {BOTTOM_NAV_ITEMS.map(({ to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `mob-bottom-nav__item${isActive ? ' mob-bottom-nav__item--active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="mob-bottom-nav__dot" />}
                <Icon size={22} />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Mobile user slide-up sheet ── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              className="mob-sheet-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              className="mob-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="mob-sheet__handle" />

              <div className="mob-sheet__user">
                <div className="mob-sheet__avatar-circle">{initials}</div>
                <div className="mob-sheet__user-info">
                  <div className="mob-sheet__name">{displayName}</div>
                  <div className="mob-sheet__email">{userEmail}</div>
                </div>
                {isPro ? (
                  <span className="sidebar__pro-badge" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <Crown size={10} /> {isProPlus ? 'Pro+' : 'Pro'}
                  </span>
                ) : (
                  <span className="sidebar__free-badge" style={{ marginLeft: 'auto' }}>Free</span>
                )}
              </div>

              <div className="mob-sheet__divider" />

              <Link
                to="/settings"
                className="mob-sheet__item"
                onClick={() => setSheetOpen(false)}
              >
                <Settings size={18} />
                Settings
              </Link>

              <button
                className="mob-sheet__item mob-sheet__item--danger"
                onClick={handleLogout}
              >
                <LogOut size={18} />
                Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
