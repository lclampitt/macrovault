import { Link } from 'react-router-dom';
import '../styles/footer.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">

        {/* Brand / tagline */}
        <div className="footer-column footer-brand">
          <div className="footer-logo-dot" />
          <div>
            <div className="footer-logo-text">Gainlytics</div>
            <p className="footer-tagline">
              Data-driven fitness insights, without the guesswork.
            </p>
          </div>
        </div>

        {/* App links (2 columns) */}
        <div className="footer-column footer-links">
          <div className="footer-column-title">App</div>

          <div className="footer-links-grid">
            <div className="footer-links-list">
              <Link to="/" className="footer-link">Home</Link>
              <Link to="/analyzer" className="footer-link">Analyzer</Link>
              <Link to="/calculators" className="footer-link">Calculators</Link>
            </div>

            <div className="footer-links-list">
              <Link to="/goalplanner" className="footer-link">Goal Planner</Link>
              <Link to="/progress" className="footer-link">Progress</Link>
              <Link to="/help" className="footer-link">Contact Us</Link>
              <Link to="/about" className="footer-link">About Us</Link>
            </div>
          </div>
        </div>

        {/* Disclaimer / contact */}
        <div className="footer-column footer-meta">
          <div className="footer-column-title">Info</div>
          <p className="footer-disclaimer">
            Gainlytics is for educational and informational purposes only and
            is not a substitute for professional medical advice, diagnosis, or treatment.
          </p>
          <p className="footer-contact">
            Questions? <a href="mailto:support@gainlytics.org">support@gainlytics.org</a>
          </p>
        </div>

      </div>

      <div className="footer-bottom">
        <span>© {year} Gainlytics. All rights reserved.</span>
        <span className="footer-built-by">Built by Logan Clampitt.</span>
      </div>
    </footer>
  );
}
