import React from 'react';
import { motion } from 'framer-motion';
import './BentoCard.css';

/**
 * BentoCard — reusable card for the bento grid dashboard.
 *
 * Props:
 *  - title        string
 *  - action       { label, onClick } optional top-right button
 *  - span         'wide' | 'tall' | undefined  (CSS class modifier)
 *  - index        number  (stagger delay)
 *  - className    string  (extra classes)
 *  - children
 */
export default function BentoCard({ title, action, span, index = 0, className = '', children }) {
  return (
    <motion.div
      className={`bento-card ${span ? `bento-card--${span}` : ''} ${className}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
    >
      {(title || action) && (
        <div className="bento-card__header">
          {title && <h2 className="bento-card__title">{title}</h2>}
          {action && (
            <button className="bento-card__action" onClick={action.onClick}>
              {action.label}
            </button>
          )}
        </div>
      )}
      <div className="bento-card__body">{children}</div>
    </motion.div>
  );
}
