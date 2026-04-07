import { Link, useLocation } from 'react-router-dom';
import '../styles/header.css';

export default function Header({ onLogout, session }) {
  const location = useLocation();

  // Main navigation entries used across the app
  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Measurements', path: '/measurements' },
    { label: 'Calculators', path: '/calculators' },
    { label: 'Goal Planner', path: '/goalplanner' },
    { label: 'Workouts', path: '/workouts' },   // Workouts page
    { label: 'Progress', path: '/progress' },
  ];

  return (
    <header className="header">
      <div className="header-inner">

        {/* Brand section: logo + app name */}
        <Link to="/" className="header-brand">
          <div className="header-logo-wrapper">
            <img
              src="/images/macrolock.png"
              alt="MacroVault Logo"
              className="header-logo-img"
            />
          </div>
          <span className="header-logo-text">MacroVault</span>
        </Link>

        {/* Top navigation links */}
        <nav className="header-nav">
          <ul>
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  // Highlight the active route based on current URL
                  className={
                    location.pathname === link.path ? 'nav-link active' : 'nav-link'
                  }
                >
                  {link.label}
                </Link>
              </li>
            ))}

            {/* Logout button only when a user session exists */}
            {session && (
              <li>
                <button onClick={onLogout} className="logout-btn">
                  Sign Out
                </button>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
