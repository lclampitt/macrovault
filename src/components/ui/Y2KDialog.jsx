import React, { useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import './Y2KDialog.css';

const TYPE_CONFIG = {
  confirm: {
    Icon: HelpCircle,
    bg: 'linear-gradient(135deg, var(--accent), var(--accent-dark, #145a44))',
    border: '1px outset var(--accent-light, #3be0a8)',
    iconColor: '#fff',
    titleSuffix: 'Confirm Action',
  },
  warning: {
    Icon: AlertTriangle,
    bg: 'linear-gradient(135deg, #FFD700, #cc9900)',
    border: '1px outset #ffee44',
    iconColor: '#000',
    titleSuffix: 'Warning',
  },
  error: {
    Icon: XCircle,
    bg: 'linear-gradient(135deg, #ee4444, #aa2222)',
    border: '1px outset #ff6666',
    iconColor: '#fff',
    titleSuffix: 'Error',
  },
  alert: {
    Icon: Info,
    bg: 'linear-gradient(135deg, #2563EB, #1a3a99)',
    border: '1px outset #4488ff',
    iconColor: '#fff',
    titleSuffix: 'Information',
  },
};

export default function Y2KDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  type = 'confirm',
}) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.confirm;
  const { Icon, bg, border, iconColor, titleSuffix } = cfg;

  const handleConfirm = useCallback(() => {
    onConfirm?.();
    onClose();
  }, [onConfirm, onClose]);

  /* Keyboard: Enter = confirm, Escape = close */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleConfirm, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="y2k-dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="y2k-dialog"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            role="dialog"
            aria-modal="true"
          >
            {/* Title bar */}
            <div className="y2k-dialog__titlebar">
              <div className="y2k-dialog__titlebar-left">
                <div className="y2k-dialog__app-icon">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 5-9" />
                  </svg>
                </div>
                <span className="y2k-dialog__titlebar-text">
                  {title || `MacroVault — ${titleSuffix}`}
                </span>
              </div>
              <button className="y2k-dialog__close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>

            {/* Body */}
            <div className="y2k-dialog__body">
              <div className="y2k-dialog__content-row">
                <div className="y2k-dialog__icon" style={{ background: bg, border }}>
                  <Icon size={18} color={iconColor} />
                </div>
                <div className="y2k-dialog__message">{message}</div>
              </div>
            </div>

            {/* Button row */}
            <div className="y2k-dialog__btn-row">
              {type === 'confirm' || type === 'warning' ? (
                <>
                  <button className="y2k-dialog__btn y2k-dialog__btn--cancel" onClick={onClose}>
                    [ {cancelLabel} ]
                  </button>
                  <button className="y2k-dialog__btn y2k-dialog__btn--confirm" onClick={handleConfirm}>
                    [ {confirmLabel} ]
                  </button>
                </>
              ) : (
                <button className="y2k-dialog__btn y2k-dialog__btn--confirm" onClick={handleConfirm}>
                  [ {confirmLabel} ]
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
