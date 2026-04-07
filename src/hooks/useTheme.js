import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const MODE_KEY = 'macrovault-theme';
const ACCENT_KEY = 'macrovault-accent';

export function useTheme() {
  const [mode, setMode] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return localStorage.getItem(MODE_KEY) || 'dark';
  });

  const [accent, setAccentState] = useState(() => {
    if (typeof window === 'undefined') return 'teal';
    return localStorage.getItem(ACCENT_KEY) || 'teal';
  });

  /* Apply mode to DOM + localStorage */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  /* Apply accent to DOM + localStorage */
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem(ACCENT_KEY, accent);
  }, [accent]);

  /* On mount: load accent from Supabase profile (overrides localStorage) */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (!userId || !mounted) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('accent_theme')
        .eq('id', userId)
        .maybeSingle();

      if (!mounted) return;
      if (profile?.accent_theme && profile.accent_theme !== accent) {
        setAccentState(profile.accent_theme);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMode = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'));

  /* Set accent: update state + persist to Supabase in background */
  const setAccent = useCallback((a) => {
    setAccentState(a);
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (!userId) return;
      await supabase
        .from('profiles')
        .update({ accent_theme: a })
        .eq('id', userId);
    })();
  }, []);

  const isSpectrum = accent === 'spectrum';

  return {
    mode,
    accent,
    toggleMode,
    setAccent,
    isDark: mode === 'dark',
    isSpectrum,
    // backward compat aliases
    theme: mode,
    toggle: toggleMode,
  };
}
