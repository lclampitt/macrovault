import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Reusable custom dropdown that replaces native <select> elements.
 *
 * Props:
 *   value      string          — controlled value
 *   onChange   (val) => void   — called with new value on selection
 *   options    { label, value }[] — list of options
 *   label      string?         — optional label rendered above
 *   placeholder string?        — shown when no value is selected
 *   width      string?         — CSS width (default '100%')
 */
export default function Dropdown({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select…',
  width = '100%',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listboxId = useRef(`dropdown-listbox-${Math.random().toString(36).slice(2)}`).current;

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : null;

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Keyboard navigation
  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      setFocusedIndex(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < options.length) {
        onChange(options[focusedIndex].value);
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }
  }

  function select(val) {
    onChange(val);
    setIsOpen(false);
    setFocusedIndex(-1);
  }

  // Panel animation variants
  const panelVariants = {
    hidden: { height: 0, opacity: 0 },
    visible: { height: 'auto', opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
    exit:   { height: 0, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } },
  };

  // Item animation variants (staggered slide-in)
  const itemVariants = {
    hidden:  { opacity: 0, x: -4 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.03, duration: 0.15, ease: 'easeOut' },
    }),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width }}>
      {label && (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>
          {label}
        </span>
      )}

      <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
        {/* ── Trigger button ── */}
        <button
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          onClick={() => { setIsOpen((o) => !o); setFocusedIndex(isOpen ? -1 : 0); }}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-base)',
            border: `1px solid ${isOpen ? '#1D9E75' : '#1e2536'}`,
            borderRadius: isOpen ? '8px 8px 0 0' : '8px',
            padding: '8px 12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
            color: displayLabel ? '#fff' : '#555',
            transition: 'border-color 0.15s ease, border-radius 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            if (!isOpen) e.currentTarget.style.borderColor = '#1D9E75';
          }}
          onMouseLeave={(e) => {
            if (!isOpen) e.currentTarget.style.borderColor = '#1e2536';
          }}
        >
          <span>{displayLabel ?? placeholder}</span>
          <ChevronDown
            size={14}
            style={{
              color: '#5DCAA5',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              flexShrink: 0,
            }}
          />
        </button>

        {/* ── Dropdown panel ── */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id={listboxId}
              role="listbox"
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                background: '#161b27',
                border: '1px solid #1D9E75',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                overflow: 'hidden',
              }}
            >
              {options.map((opt, i) => {
                const isSelected = opt.value === value;
                const isFocused  = i === focusedIndex;
                return (
                  <motion.div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    custom={i}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    onClick={() => select(opt.value)}
                    onMouseEnter={() => setFocusedIndex(i)}
                    style={{
                      padding: '9px 12px',
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: isSelected || isFocused ? '#0a2a1e' : 'transparent',
                      color: isSelected ? '#1D9E75' : isFocused ? '#5DCAA5' : '#ccc',
                      fontWeight: isSelected ? 500 : 400,
                      transition: 'background 0.1s ease, color 0.1s ease',
                    }}
                  >
                    {isSelected && (
                      <span style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: '#1D9E75', flexShrink: 0,
                      }} />
                    )}
                    {opt.label}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
