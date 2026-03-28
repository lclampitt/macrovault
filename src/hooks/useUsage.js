import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';

/**
 * Fetches the current user's usage summary from the backend.
 * Returns { usage, loadingUsage, refetchUsage }
 *
 * usage shape:
 *   { analyzerUsed, analyzerLimit, workoutCount, workoutLimit, plan }
 *   Limits are null for Pro users (unlimited).
 */
export function useUsage(userId) {
  const [usage, setUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!userId) {
      setLoadingUsage(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/usage/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    } finally {
      setLoadingUsage(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return { usage, loadingUsage, refetchUsage: fetchUsage };
}
