import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Compact calculator card — icon inline with title, subtitle, description, open button.
 *
 * Props:
 *   title       string      — calculator name
 *   subtitle    string      — short category label (e.g. "Calories & energy")
 *   description string      — one-sentence description
 *   icon        LucideIcon  — Lucide icon component
 *   href        string      — react-router navigation target
 *   index       number      — stagger delay index (0, 1, 2)
 */
export default function CalculatorCard({ title, subtitle, description, icon: Icon, href, index = 0 }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.07, ease: 'easeOut' }}
      onClick={() => navigate(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#0e1624',
        border: `1px solid ${hovered ? '#1D9E75' : '#1a2538'}`,
        borderRadius: 12,
        padding: '18px 20px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'border-color 0.2s ease, transform 0.15s ease',
      }}
    >
      {/* ── Top row: icon + title/subtitle ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        {/* Icon square */}
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          background: '#0a2a1e',
          border: '1px solid #1D9E75',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon width={16} height={16} stroke="#1D9E75" strokeWidth={1.5} fill="none" />
        </div>

        {/* Title + subtitle */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{title}</div>
          <div style={{ fontSize: 10, color: '#5DCAA5', marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>

      {/* ── Description ── */}
      <p style={{
        fontSize: 11,
        color: '#555',
        lineHeight: 1.6,
        margin: 0,
        marginBottom: 14,
      }}>
        {description}
      </p>

      {/* ── Open button ── */}
      <div style={{
        border: `1px solid ${hovered ? '#1D9E75' : '#1a2538'}`,
        borderRadius: 6,
        padding: '6px 0',
        fontSize: 11,
        color: hovered ? '#5DCAA5' : '#888',
        background: 'transparent',
        width: '100%',
        textAlign: 'center',
        transition: 'border-color 0.15s ease, color 0.15s ease',
      }}>
        Open calculator →
      </div>
    </motion.div>
  );
}
