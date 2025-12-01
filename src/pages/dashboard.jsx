import React from 'react';
import { Link } from 'react-router-dom';
import GoalPlanner from '../components/GoalPlanner/goalplanner';
import '../styles/dashboard.css';

function Card({ title, cta, children }) {
  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <h2 className="dashboard-card-title">{title}</h2>
        {cta && (
          <Link to={cta.href} className="dashboard-cta">
            {cta.label}
          </Link>
        )}
      </div>
      <div className="dashboard-card-content">{children}</div>
    </div>
  );
}

function OnboardingChecklist() {
  const STORAGE_KEY = 'gainlytics_checklist_v1';

  const defaultSteps = [
    { id: 'photo', label: 'Add measurements or photo', route: '/analyzer' },
    { id: 'goal', label: 'Make a goal', route: '/goalplanner' },
    { id: 'workout', label: 'Log workout', route: '/workouts' },
    { id: 'progress', label: 'Update progress', route: '/progress' },
  ];

  const [completed, setCompleted] = React.useState({});

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) setCompleted(saved);
    } catch {}
  }, []);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  }, [completed]);

  const toggle = (id) => {
    setCompleted((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="onboarding-box">
      <p className="onboarding-title">Getting started</p>
      <ul className="onboarding-list">
        {defaultSteps.map((step) => (
          <li key={step.id} className="onboarding-item">
            <button
              className={`onboarding-checkbox ${
                completed[step.id] ? 'checked' : ''
              }`}
              onClick={() => toggle(step.id)}
            >
              {completed[step.id] && <span className="checkmark">✓</span>}
            </button>

            <div
              className="onboarding-text"
              onClick={() => (window.location.href = step.route)}
            >
              <span className="onboarding-label">{step.label}</span>
              <span className="onboarding-open">Open</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ConsistencyCalendar
 * - Simple month view
 * - Click a day to toggle an "X" for a rest/off day
 * - Data persisted in localStorage
 */
function ConsistencyCalendar() {
  const STORAGE_KEY = 'gainlytics_consistency_calendar_v1';
  const today = new Date();

  const [currentMonth, setCurrentMonth] = React.useState(today.getMonth()); // 0-11
  const [currentYear, setCurrentYear] = React.useState(today.getFullYear());
  const [offDays, setOffDays] = React.useState({});

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) setOffDays(saved);
    } catch {}
  }, []);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(offDays));
  }, [offDays]);

  const formatDateKey = (year, monthIndex, day) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const toggleDay = (day) => {
    const key = formatDateKey(currentYear, currentMonth, day);
    setOffDays((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  };

  const goToPrevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const firstOfMonth = new Date(currentYear, currentMonth, 1);
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0 = Sun
  const monthLabel = firstOfMonth.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  const weeks = [];
  let dayCounter = 1 - startWeekday; // can be negative to create leading blanks

  while (dayCounter <= daysInMonth) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      if (dayCounter < 1 || dayCounter > daysInMonth) {
        week.push(null);
      } else {
        week.push(dayCounter);
      }
      dayCounter += 1;
    }
    weeks.push(week);
  }

  const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="calendar-wrapper">
      <div className="calendar-header-row">
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={goToPrevMonth}
        >
          ‹
        </button>
        <div className="calendar-month-label">{monthLabel}</div>
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={goToNextMonth}
        >
          ›
        </button>
      </div>

      <div className="calendar-weekdays">
        {weekdayLabels.map((label) => (
          <div key={label} className="calendar-weekday">
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) {
              return <div key={`${wi}-${di}`} className="calendar-day empty" />;
            }
            const key = formatDateKey(currentYear, currentMonth, day);
            const isOff = !!offDays[key];
            return (
              <button
                key={`${wi}-${di}`}
                type="button"
                className={`calendar-day ${isOff ? 'off' : ''}`}
                onClick={() => toggleDay(day)}
              >
                <span className="calendar-day-number">{day}</span>
                {isOff && <span className="calendar-day-x">✕</span>}
              </button>
            );
          })
        )}
      </div>

      <p className="calendar-caption">
        Click a day to mark an <span className="calendar-caption-x">X</span> for
        a rest day and keep an eye on your consistency.
      </p>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-hero">
          <p className="dashboard-eyebrow">Gainlytics Dashboard</p>
          <h1 className="dashboard-page-title">Home</h1>
          <p className="dashboard-page-subtitle">
            Welcome back! Your body analysis, goals, and tools in one place.
          </p>
        </div>
        <OnboardingChecklist />
      </div>

      <div className="dashboard-grid">
        {/* Row 1: Calendar + Your Plan (both tall, primary) */}
        <Card title="Consistency Calendar">
          <ConsistencyCalendar />
        </Card>

        <Card title="Your Plan" cta={{ href: '/goalplanner', label: 'Open' }}>
          <GoalPlanner compact />
        </Card>

        {/* Row 2: smaller Body Analysis + Calculators */}
        <Card
          title="Body Analysis"
          cta={{ href: '/analyzer', label: 'Start Analysis' }}
        >
          <p>
            Upload a photo (JPG/PNG) or enter measurements to estimate your body
            type and body fat % with the AI Analyzer.
          </p>
        </Card>

        <Card title="Calculators" cta={{ href: '/calculators', label: 'Open' }}>
          <ul>
            <li>Calorie (TDEE) &amp; Protein</li>
            <li>1RM Estimator</li>
            <li>Deficit Time Calculator</li>
          </ul>
        </Card>

        {/* Rest of dashboard */}
        <Card title="Progress" cta={{ href: '/progress', label: 'View' }}>
          <p>
            See charts for weight, body fat %, and measurements over time from
            your logged data.
          </p>
        </Card>

        <div className="dashboard-subgrid">
          <Card
            title="Exercise Library"
            cta={{ href: '/exercises', label: 'Browse' }}
          >
            <p>Filter by muscle group and learn form cues for each exercise.</p>
          </Card>

          <Card
            title="Workouts"
            cta={{ href: '/workouts', label: 'Log Workout' }}
          >
            <p>Track sets, reps, weight, RPE, and notes for every session.</p>
          </Card>
        </div>

      </div>
    </div>
  );
}
