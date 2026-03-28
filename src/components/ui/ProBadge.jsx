import React from 'react';
import { Crown } from 'lucide-react';
import './ProBadge.css';

export default function ProBadge({ size = 'sm' }) {
  return (
    <span className={`pro-badge pro-badge--${size}`}>
      <Crown size={size === 'sm' ? 9 : 11} />
      Pro
    </span>
  );
}
