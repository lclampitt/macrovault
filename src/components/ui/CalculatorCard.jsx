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
export default function CalculatorCard({ title, subtitle, description, icon: Icon, href, index = 0, spectrumIconBg, spectrumIconBorder, spectrumIconStroke }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="calc-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.07, ease: 'easeOut' }}
      onClick={() => navigate(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
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
          background: spectrumIconBg || 'var(--accent-bg)',
          border: spectrumIconBorder || '1px solid var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon width={16} height={16} stroke={spectrumIconStroke || 'var(--accent)'} strokeWidth={1.5} fill="none" />
        </div>

        {/* Title + subtitle */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
          <div style={{ fontSize: 10, color: 'var(--accent-light)', marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>

      {/* ── Description ── */}
      <p style={{
        fontSize: 11,
        color: 'var(--text-muted)',
        lineHeight: 1.6,
        margin: 0,
        marginBottom: 14,
      }}>
        {description}
      </p>

      {/* ── Open button ── */}
      <div style={{
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 6,
        padding: '6px 0',
        fontSize: 11,
        color: hovered ? 'var(--accent-light)' : 'var(--text-secondary)',
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
