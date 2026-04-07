/**
 * Universal toast utility.
 * When Y2K mode is active, routes to Y2K-styled toasts.
 * Otherwise, routes to Sonner.
 */
import { toast as sonnerToast } from 'sonner';
import { y2kToast } from '../components/ui/Y2KToast';

const UI_MODE_KEY = 'macrovault-ui-mode';

function isY2KActive() {
  return document.documentElement.getAttribute('data-ui-mode') === 'y2k'
    || localStorage.getItem(UI_MODE_KEY) === 'y2k';
}

function show(type, message, opts = {}) {
  if (isY2KActive()) {
    y2kToast({
      type,
      title: opts.title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Information'),
      message: message || '',
      duration: opts.duration,
    });
  } else {
    const fn = sonnerToast[type] || sonnerToast;
    fn(message, opts);
  }
}

export const appToast = Object.assign(
  (message, opts) => show('info', message, opts),
  {
    success: (msg, opts) => show('success', msg, opts),
    error:   (msg, opts) => show('error',   msg, opts),
    info:    (msg, opts) => show('info',     msg, opts),
    warning: (msg, opts) => show('warning',  msg, opts),
  }
);
