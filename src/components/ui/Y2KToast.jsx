import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import './Y2KToast.css';

/* ── Toast state (module-level singleton) ─── */
let toastId = 0;
let listeners = [];

function subscribe(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

function notify(toasts) {
  listeners.forEach((fn) => fn(toasts));
}

let toastQueue = [];

export function y2kToast(options) {
  const id = ++toastId;
  const t = {
    id,
    type: options.type || 'info',
    title: options.title || '',
    message: options.message || options.title || '',
    duration: options.duration ?? (options.type === 'error' ? null : options.type === 'warning' ? 6000 : 4000),
    createdAt: Date.now(),
  };

  toastQueue = [t, ...toastQueue].slice(0, 3);
  notify([...toastQueue]);
  return id;
}

export function y2kDismiss(id) {
  toastQueue = toastQueue.filter((t) => t.id !== id);
  notify([...toastQueue]);
}

/* ── Icon by type ──────────────────────── */
function ToastIcon({ type }) {
  const map = {
    success: { Icon: CheckCircle, bg: 'linear-gradient(135deg, #1D9E75, #0a6644)' },
    error:   { Icon: XCircle,     bg: 'linear-gradient(135deg, #ee4444, #aa2222)' },
    info:    { Icon: Info,         bg: 'linear-gradient(135deg, var(--accent), var(--accent-dark, #1a3a99))' },
    warning: { Icon: AlertTriangle, bg: 'linear-gradient(135deg, #FFD700, #cc9900)' },
  };
  const { Icon, bg } = map[type] || map.info;
  const isWarning = type === 'warning';
  return (
    <div className={`y2k-toast__icon y2k-toast__icon--${type}`} style={{ background: bg }}>
      <Icon size={14} color={isWarning ? '#000' : '#fff'} />
    </div>
  );
}

/* ── Single Toast ──────────────────────── */
function SingleToast({ t, onDismiss }) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!t.duration) return;
    const start = startRef.current;
    let raf;
    function tick() {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / t.duration) * 100);
      setProgress(pct);
      if (pct <= 0) { onDismiss(); return; }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [t.duration, onDismiss]);

  return (
    <motion.div
      className="y2k-toast"
      layout
      initial={{ opacity: 0, x: 40, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.9 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      {/* Title bar */}
      <div className="y2k-toast__titlebar">
        <div className="y2k-toast__titlebar-left">
          <div className="y2k-toast__app-icon">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
              <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 5-9" />
            </svg>
          </div>
          <span className="y2k-toast__titlebar-text">
            MacroVault — {t.title || (t.type === 'success' ? 'Success' : t.type === 'error' ? 'Error' : t.type === 'warning' ? 'Warning' : 'Information')}
          </span>
        </div>
        <button className="y2k-toast__close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>

      {/* Body */}
      <div className="y2k-toast__body">
        <div className="y2k-toast__content-row">
          <ToastIcon type={t.type} />
          <div className="y2k-toast__message-wrap">
            {t.title && <div className="y2k-toast__msg-title">{t.title}</div>}
            <div className="y2k-toast__msg-body">{t.message}</div>
          </div>
        </div>

        {/* OK button */}
        <div className="y2k-toast__btn-row">
          <button className="y2k-toast__ok-btn" onClick={onDismiss}>[ OK ]</button>
        </div>
      </div>

      {/* Progress bar (auto-dismiss only) */}
      {t.duration && (
        <div className="y2k-toast__progress-track">
          <div className="y2k-toast__progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
    </motion.div>
  );
}

/* ── Toast Container (renders all visible toasts) ── */
export default function Y2KToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => subscribe(setToasts), []);

  const handleDismiss = useCallback((id) => y2kDismiss(id), []);

  return (
    <div className="y2k-toast-container">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <SingleToast key={t.id} t={t} onDismiss={() => handleDismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
