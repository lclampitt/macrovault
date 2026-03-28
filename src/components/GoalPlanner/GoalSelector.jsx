import React from 'react';

// Small reusable component for choosing high-level goal type.
// Used in places where we want more Tailwind-style styling.
const GoalSelector = ({ goal, setGoal }) => {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Your Goal
      </label>
      <div className="flex gap-4">
        {['Cutting', 'Bulking', 'Maintenance'].map((option) => (
          <button
            key={option}
            onClick={() => setGoal(option)}
            style={goal === option
              ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent-dark)', borderRadius: '6px', padding: '8px 16px' }
              : { background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 16px' }
            }
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GoalSelector;
