import React from 'react';
import '../styles/about.css';

export default function About() {
  return (
    <div className="about-page">
      <div className="about-card">
        <h1 className="about-title">About Gainlytics</h1>

        <p className="about-text">
          Gainlytics was built to help bring clarity to fitness. No more guessing.
          Our mission is to combine clean UI, data insights, and practicality to help you reach your goals faster.
        </p>

        <p className="about-text">
          Whether you're analyzing your physique, planning a goal, tracking your progress,
          or logging workouts. Gainlytics brings everything into one seamless experience.
        </p>

        <p className="about-text">
          Built proudly for those who want to stay consistent, stay informed, and stay improving.
        </p>
      </div>
    </div>
  );
}
