import { Link, useLocation } from 'react-router-dom';
import '../styles/header.css';

export default function Header({ onLogout, session }) {
  const location = useLocation();

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Analyzer', path: '/analyzer' },
    { label: 'Calculators', path: '/calculators' },
    { label: 'Goal Planner', path: '/goalplanner' },
    { label: 'Workouts', path: '/workouts' },   // ⭐ ADDED HERE
    { label: 'Progress', path: '/progress' },
  ];

  return (
    <header className="header">
      <div className="header-inner">

        {/* Brand Section */}
        <Link to="/" className="header-brand">
          <div className="header-logo-wrapper">
            <img
              src="/images/gainlytics-logo.png"
              alt="Gainlytics Logo"
              className="header-logo-img"
            />
          </div>
          <span className="header-logo-text">Gainlytics</span>
        </Link>

        {/* Navigation Links */}
        <nav className="header-nav">
          <ul>
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={
                    location.pathname === link.path ? 'nav-link active' : 'nav-link'
                  }
                >
                  {link.label}
                </Link>
              </li>
            ))}

            {/* Logout Button */}
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
