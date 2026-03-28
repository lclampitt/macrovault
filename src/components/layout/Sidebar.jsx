import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  ScanLine,
  Calculator,
  Target,
  Dumbbell,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Crown,
  Lock,
  Settings,
} from 'lucide-react';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/home',        label: 'Home',        icon: Home       },
  { to: '/analyzer',   label: 'Analyzer',    icon: ScanLine,  pro: true },
  { to: '/calculators',label: 'Calculators', icon: Calculator, pro: true },
  { to: '/goalplanner',label: 'Goal Planner',icon: Target      },
  { to: '/workouts',   label: 'Workouts',    icon: Dumbbell    },
  { to: '/progress',   label: 'Progress',    icon: BarChart2   },
];

export default function Sidebar({ session, onLogout, isPro, usage }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const userEmail = session?.user?.email ?? '';
  const displayName = userEmail.split('@')[0] || 'User';

  const handleLogout = async () => {
    await onLogout();
    navigate('/auth');
  };

  const SidebarContent = () => (
    <div className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">G</div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className="sidebar__logo-name"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
            >
              Gainlytics
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, pro }) => (
          <React.Fragment key={to}>
            <NavLink
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
              {!isPro && pro && !collapsed && (
                <span className="sidebar__pro-dot" title="Pro feature" />
              )}
            </NavLink>
            {/* Usage hint below Analyzer for free users */}
            {to === '/analyzer' && !isPro && !collapsed && usage && (
              <div className={`sidebar__usage-hint${usage.analyzerUsed >= usage.analyzerLimit ? ' sidebar__usage-hint--locked' : ''}`}>
                {usage.analyzerUsed >= usage.analyzerLimit && (
                  <Lock size={10} className="sidebar__usage-lock" />
                )}
                {usage.analyzerUsed} / {usage.analyzerLimit} analyses used
              </div>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Spacer */}
      <div className="sidebar__spacer" />

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
                  <Crown size={10} /> Pro
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
      {/* Desktop sidebar */}
      <div className="sidebar-desktop">
        <SidebarContent />
      </div>

      {/* Mobile hamburger */}
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <span /><span /><span />
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="sidebar-mobile-drawer"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
