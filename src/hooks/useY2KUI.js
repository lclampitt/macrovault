import { useCallback, useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import { useTheme } from './useTheme';
import { y2kToast } from '../components/ui/Y2KToast';

/**
 * Centralized hook for Y2K UI enhancements.
 * When isY2K: uses Y2K-styled toasts, dialogs, and progress bars.
 * When modern: falls through to existing Sonner toasts and browser defaults.
 */
export function useY2KUI() {
  const { isY2K } = useTheme();

  /* ── Dialog state ──────────────────────── */
  const [dialog, setDialog] = useState(null);

  /**
   * Show a toast notification.
   * Automatically routes to Y2K-style or Sonner.
   */
  const showToast = useCallback((type, messageOrOpts) => {
    const opts = typeof messageOrOpts === 'string'
      ? { message: messageOrOpts }
      : messageOrOpts || {};

    if (isY2K) {
      y2kToast({
        type,
        title: opts.title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Information'),
        message: opts.message || opts.title || '',
        duration: opts.duration,
      });
    } else {
      // Sonner fallback
      const fn = sonnerToast[type] || sonnerToast;
      fn(opts.message || opts.title || '', opts.sonnerOpts);
    }
  }, [isY2K]);

  /* Convenience wrappers */
  const toastSuccess = useCallback((msg, opts) => showToast('success', { message: msg, ...opts }), [showToast]);
  const toastError   = useCallback((msg, opts) => showToast('error',   { message: msg, ...opts }), [showToast]);
  const toastInfo    = useCallback((msg, opts) => showToast('info',    { message: msg, ...opts }), [showToast]);
  const toastWarning = useCallback((msg, opts) => showToast('warning', { message: msg, ...opts }), [showToast]);

  /**
   * Show a confirmation dialog.
   * In Y2K mode: opens Y2KDialog.
   * In modern mode: uses a Promise-based confirm (triggers onConfirm immediately).
   */
  const showDialog = useCallback((opts) => {
    if (isY2K) {
      return new Promise((resolve) => {
        setDialog({
          ...opts,
          onConfirm: () => { resolve(true); setDialog(null); },
          onClose:   () => { resolve(false); setDialog(null); },
        });
      });
    } else {
      // Modern: just call onConfirm if provided, or return resolved promise
      if (opts.onConfirm) { opts.onConfirm(); return Promise.resolve(true); }
      return Promise.resolve(true);
    }
  }, [isY2K]);

  const closeDialog = useCallback(() => setDialog(null), []);

  return {
    isY2K,
    showToast,
    toastSuccess,
    toastError,
    toastInfo,
    toastWarning,
    showDialog,
    closeDialog,
    dialog,
  };
}
