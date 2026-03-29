import { Link } from 'react-router-dom';
import '../styles/footer.css';

export default function Footer() {
  // Always show the current year dynamically
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">

        {/* Brand / tagline block on the left */}
        <div className="footer-column footer-brand">
          <div className="footer-logo-dot" />
          <div>
            <div className="footer-logo-text">Gainlytics</div>
            <p className="footer-tagline">
              Data-driven fitness insights, without the guesswork.
            </p>
          </div>
        </div>

        {/* App navigation links in the middle */}
        <div className="footer-column footer-links">
          <div className="footer-column-title">App</div>

          <div className="footer-links-grid">
            <div className="footer-links-list">
              <Link to="/" className="footer-link">Home</Link>
              <Link to="/measurements" className="footer-link">Measurements</Link>
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

        {/* Disclaimer + contact information on the right */}
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

      {/* Bottom row with copyright + credit */}
      <div className="footer-bottom">
        <span>© {year} Gainlytics. All rights reserved.</span>
        <span className="footer-built-by">Built by Logan Clampitt.</span>
      </div>
    </footer>
  );
}
