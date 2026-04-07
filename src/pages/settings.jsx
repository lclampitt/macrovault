import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Sliders, CreditCard, AlertTriangle, Crown, Sun, Moon, Palette, Lock } from 'lucide-react';
import { appToast as toast } from '../utils/toast';
import { supabase } from '../supabaseClient';
import { usePlan } from '../hooks/usePlan';
import { useUpgrade } from '../context/UpgradeContext';
import { useTheme } from '../hooks/useTheme';
import '../styles/settings.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';

const ACCENT_THEMES = [
  { id: 'teal',    label: 'Teal',    color: '#1D9E75' },
  { id: 'blue',    label: 'Blue',    color: '#3B82F6' },
  { id: 'orange',  label: 'Orange',  color: '#F97316' },
  { id: 'rose',    label: 'Rose',    color: '#F43F5E' },
  { id: 'violet',  label: 'Violet',  color: '#8B5CF6' },
  { id: 'crimson', label: 'Crimson', color: '#DC2626' },
];

const RETRO_THEMES = [
  {
    id: 'xp-aqua',
    label: 'XP Aqua',
    bg: '#080d14',
    stripBg: '#0d1e3a',
    bars: [{ color: '#39FF14', w: '60%' }, { color: '#00BFFF', w: '40%' }],
    swatches: ['#00BFFF', '#39FF14', '#FF69B4'],
    toast: 'XP Aqua applied. Welcome to the internet.',
  },
  {
    id: 'myspace',
    label: 'MySpace',
    bg: '#080008',
    stripBg: '#120012',
    bars: [{ color: '#8800FF', w: '60%' }, { color: '#FF00FF', w: '40%' }],
    swatches: ['#FF00FF', '#8800FF', '#FF4488'],
    toast: 'MySpace theme applied. Don\'t forget to add songs to your profile.',
  },
  {
    id: 'y2k-chrome',
    label: 'Y2K Chrome',
    bg: '#0c0c0c',
    stripBg: '#1a1a1a',
    bars: [{ color: '#FFD700', w: '60%' }, { color: '#C0C0C0', w: '40%' }],
    swatches: ['#FFD700', '#C0C0C0', '#666666'],
    toast: 'Y2K Chrome applied. Looking crispy.',
  },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: 'easeOut' },
});

/* ── Card wrapper ── */
function SettingsCard({ icon: Icon, title, children, danger, index = 0 }) {
  return (
    <motion.div
      className={`settings-card${danger ? ' settings-card--danger' : ''}`}
      {...fadeUp(index * 0.07)}
    >
      <div className="settings-card__header">
        <span className="settings-card__icon"><Icon size={15} /></span>
        <span className="settings-card__title">{title}</span>
      </div>
      <div className="settings-card__body">{children}</div>
    </motion.div>
  );
}

/* ── Toggle ── */
function Toggle({ options, value, onChange }) {
  return (
    <div className="settings-toggle">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`settings-toggle__opt${value === opt.value ? ' settings-toggle__opt--active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ── Delete confirmation modal ── */
function DeleteModal({ onClose }) {
  const [typed, setTyped] = useState('');

  const handleConfirm = () => {
    // Deletion not yet implemented
    toast.info('Account deletion is coming soon. Contact support to delete your account.');
    onClose();
  };

  return (
    <motion.div
      className="settings-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="settings-modal"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{ opacity: 0, scale: 0.95,    y: 16 }}
        transition={{ duration: 0.25 }}
      >
        <div className="settings-modal__title">Delete account</div>
        <p className="settings-modal__body">
          This action is permanent and cannot be undone. All your data — workouts, progress,
          goals and analysis history — will be permanently removed.
          <br /><br />
          Type <strong>DELETE</strong> below to confirm.
        </p>
        <input
          className="settings-input"
          placeholder="Type DELETE to confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
        />
        <div className="settings-modal__actions">
          <button className="settings-btn settings-btn--outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="settings-btn settings-btn--danger"
            disabled={typed !== 'DELETE'}
            onClick={handleConfirm}
          >
            Delete my account
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main page ── */
export default function SettingsPage() {
  const { plan, isPro, isProPlus, stripeCustomerId, isLoading: planLoading } = usePlan();
  const { triggerUpgrade } = useUpgrade();
  const { theme, toggle: toggleTheme, accent, setAccent, isDark, isRetro, toggleMode, uiMode, setUiMode, isY2K } = useTheme();

  const [session,     setSession]     = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [units,       setUnits]       = useState('lbs');
  const [dateFormat,  setDateFormat]  = useState('MM/DD/YYYY');
  const [savingName,  setSavingName]  = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [working,     setWorking]     = useState(false);
  const [showDelete,  setShowDelete]  = useState(false);

  /* Load session + profile */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const sess = data?.session ?? null;
      setSession(sess);
      if (!sess?.user?.id) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, units_preference, date_format')
        .eq('id', sess.user.id)
        .maybeSingle();

      if (!mounted) return;
      setDisplayName(profile?.display_name ?? sess.user.email?.split('@')[0] ?? '');
      setUnits(profile?.units_preference ?? 'lbs');
      setDateFormat(profile?.date_format ?? 'MM/DD/YYYY');
    })();
    return () => { mounted = false; };
  }, []);

  /* Derive initials for avatar */
  const initials = (() => {
    const name = displayName.trim() || session?.user?.email?.split('@')[0] || '?';
    return name.slice(0, 2).toUpperCase();
  })();

  /* Save display name */
  const handleSaveName = async () => {
    if (!session?.user?.id) return;
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, display_name: displayName.trim() }, { onConflict: 'id' });
    setSavingName(false);
    if (error) toast.error('Failed to save name.');
    else toast.success('Display name updated.');
  };

  /* Save preferences (units + date format) */
  const handleSavePrefs = async () => {
    if (!session?.user?.id) return;
    setSavingPrefs(true);
    const { error } = await supabase
      .from('profiles')
      .upsert(
        { id: session.user.id, units_preference: units, date_format: dateFormat },
        { onConflict: 'id' }
      );
    setSavingPrefs(false);
    if (error) toast.error('Failed to save preferences.');
    else toast.success('Preferences saved.');
  };

  /* Stripe checkout */
  const handleUpgrade = async () => {
    if (!session?.user) return;
    setWorking(true);
    try {
      const res = await fetch(`${API_BASE}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.user.id, email: session.user.email }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Checkout failed.');
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      toast.error(err.message);
      setWorking(false);
    }
  };

  /* Stripe portal */
  const handlePortal = async () => {
    if (!stripeCustomerId) return;
    setWorking(true);
    try {
      const res = await fetch(`${API_BASE}/stripe/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripe_customer_id: stripeCustomerId }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Portal failed.');
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      toast.error(err.message);
      setWorking(false);
    }
  };

  return (
    <div className="settings">

      {/* ── Appearance ── */}
      <SettingsCard icon={Sun} title="Appearance" index={0}>
        <div className="settings-appearance-wrap">
          {!isRetro && (
            <>
              <div className="settings-row">
                <span className="settings-row__label">Color theme</span>
                <div className="settings-theme-picker">
                  <button
                    className={`settings-theme-card${theme === 'dark' ? ' settings-theme-card--active' : ''}`}
                    onClick={() => isPro && theme !== 'dark' && toggleTheme()}
                  >
                    <div className="settings-theme-card__preview settings-theme-card__preview--dark">
                      <div /><div /><div />
                    </div>
                    <span>Dark</span>
                  </button>
                  <button
                    className={`settings-theme-card${theme === 'light' ? ' settings-theme-card--active' : ''}`}
                    onClick={() => isPro && theme !== 'light' && toggleTheme()}
                  >
                    <div className="settings-theme-card__preview settings-theme-card__preview--light">
                      <div /><div /><div />
                    </div>
                    <span>Light</span>
                  </button>
                </div>
              </div>

              <div className="settings-divider" />
            </>
          )}

          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="settings-row__label">Accent color</span>
            <div className="settings-accent-grid">
              {ACCENT_THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`settings-accent-card${accent === t.id ? ' settings-accent-card--active' : ''}`}
                  onClick={() => isPro && setAccent(t.id)}
                  style={{ '--preview-accent': t.color }}
                >
                  <div className="settings-accent-card__preview">
                    <div /><div /><div />
                  </div>
                  <span>{t.label}</span>
                </button>
              ))}

              {/* Spectrum — full-width card */}
              <button
                className={`settings-spectrum-card${accent === 'spectrum' ? ' settings-spectrum-card--active' : ''}`}
                onClick={() => isPro && setAccent('spectrum')}
              >
                <div className="settings-spectrum-card__preview" style={{ background: isDark ? '#09080f' : '#FAFAF7' }}>
                  {[
                    { label: 'Protein', color: '#7C3AED', fill: '70%' },
                    { label: 'Carbs',   color: '#EA580C', fill: '45%' },
                    { label: 'Fat',     color: '#DB2777', fill: '25%' },
                    { label: 'Calories', color: '#2563EB', fill: '55%' },
                  ].map((m) => (
                    <div key={m.label} className="settings-spectrum-card__bar-col">
                      <span className="settings-spectrum-card__bar-label">{m.label}</span>
                      <div className="settings-spectrum-card__bar-track">
                        <div className="settings-spectrum-card__bar-fill" style={{ background: m.color, width: m.fill }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="settings-spectrum-card__info">
                  <div>
                    <div className="settings-spectrum-card__name">Spectrum</div>
                    <div className="settings-spectrum-card__desc">Each macro gets its own color</div>
                  </div>
                  <div className="settings-spectrum-card__swatches">
                    {['#7C3AED','#EA580C','#DB2777','#2563EB','#1D9E75','#EF9F27'].map((c) => (
                      <div key={c} className="settings-spectrum-card__dot" style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </button>

            {/* Retro section */}
            <div className="settings-retro-divider">Retro</div>
            {RETRO_THEMES.map((rt) => (
              <button
                key={rt.id}
                className={`settings-retro-card${accent === rt.id ? ' settings-retro-card--active' : ''}`}
                onClick={() => {
                  if (isPro) {
                    if (theme !== 'dark') toggleTheme();
                    setAccent(rt.id);
                    toast.success(rt.toast);
                  }
                }}
                style={{ '--retro-border': rt.swatches[0] }}
              >
                <div className="settings-retro-card__preview" style={{ background: rt.bg }}>
                  {rt.bars.map((bar, i) => (
                    <div key={i} className="settings-retro-card__bar" style={{ background: bar.color, width: bar.w }} />
                  ))}
                </div>
                <div className="settings-retro-card__info" style={{ background: rt.stripBg }}>
                  <span className="settings-retro-card__name">{rt.label}</span>
                  <div className="settings-retro-card__swatches">
                    {rt.swatches.map((c) => (
                      <div key={c} className="settings-retro-card__dot" style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </button>
            ))}
            </div>
          </div>

          <div className="settings-divider" />

          <div className="settings-row">
            <div className="settings-row__left">
              <span className="settings-row__label">UI Mode</span>
              <span className="settings-row__sub">Change the overall interface style</span>
            </div>
            <div className="settings-row__control">
              <div className="settings-toggle">
                <button
                  type="button"
                  className={`settings-toggle__opt${uiMode === 'modern' ? ' settings-toggle__opt--active' : ''}`}
                  onClick={() => isPro && setUiMode('modern')}
                >
                  Modern
                </button>
                <button
                  type="button"
                  className={`settings-toggle__opt${uiMode === 'y2k' ? ' settings-toggle__opt--active' : ''}`}
                  onClick={() => isPro && setUiMode('y2k')}
                >
                  Y2K
                </button>
              </div>
            </div>
          </div>

          {!isPro && (
            <div className="settings-lock-overlay">
              <Lock size={18} style={{ color: 'var(--accent)' }} />
              <span className="settings-lock-label">Pro feature</span>
              <button className="settings-lock-btn" onClick={() => triggerUpgrade('appearance')}>
                Upgrade to Pro
              </button>
            </div>
          )}
        </div>
      </SettingsCard>

      {/* ── Profile ── */}
      <SettingsCard icon={User} title="Profile" index={1}>
        {/* Avatar row */}
        <div className="settings-avatar">
          <div className="settings-avatar__circle">{initials}</div>
          <div className="settings-avatar__info">
            <span className="settings-avatar__name">{displayName || '—'}</span>
            <span className="settings-avatar__email">{session?.user?.email ?? ''}</span>
          </div>
        </div>

        <div className="settings-divider" />

        {/* Display name */}
        <div className="settings-row__left">
          <span className="settings-row__label">Display name</span>
          <span className="settings-row__sub">Shown across the app</span>
        </div>
        <div className="settings-input-row">
          <input
            className="settings-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
          />
          <button
            className="settings-btn settings-btn--teal"
            onClick={handleSaveName}
            disabled={savingName}
          >
            {savingName ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="settings-divider" />

        {/* Email (read-only) */}
        <div className="settings-row__left">
          <span className="settings-row__label">Email</span>
          <span className="settings-row__sub">Managed by your auth provider</span>
        </div>
        <input
          className="settings-input"
          value={session?.user?.email ?? ''}
          readOnly
        />
      </SettingsCard>

      {/* ── Preferences ── */}
      <SettingsCard icon={Sliders} title="Preferences" index={2}>
        <div className="settings-row">
          <div className="settings-row__left">
            <span className="settings-row__label">Units</span>
            <span className="settings-row__sub">Used for weight across the app</span>
          </div>
          <div className="settings-row__control">
            <Toggle
              options={[{ value: 'lbs', label: 'lbs' }, { value: 'kg', label: 'kg' }]}
              value={units}
              onChange={setUnits}
            />
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-row">
          <div className="settings-row__left">
            <span className="settings-row__label">Date format</span>
            <span className="settings-row__sub">How dates appear throughout the app</span>
          </div>
          <div className="settings-row__control">
            <Toggle
              options={[
                { value: 'MM/DD/YYYY', label: 'MM/DD' },
                { value: 'DD/MM/YYYY', label: 'DD/MM' },
              ]}
              value={dateFormat}
              onChange={setDateFormat}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="settings-btn settings-btn--teal"
            onClick={handleSavePrefs}
            disabled={savingPrefs}
          >
            {savingPrefs ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      </SettingsCard>

      {/* ── Subscription ── */}
      <SettingsCard icon={CreditCard} title="Subscription" index={3}>
        <div className="settings-row">
          <div className="settings-row__left">
            <span className="settings-row__label">Current plan</span>
            <span className="settings-row__sub">
              {isProPlus ? 'Full access to all Pro+ features including AI suggestions' : isPro ? 'Full access to all Pro features' : 'Limited to free tier usage'}
            </span>
          </div>
          <div className="settings-row__control">
            <span className={`settings-plan-badge settings-plan-badge--${plan}`}>
              {isProPlus ? <><Crown size={11} /> Pro+</> : isPro ? <><Crown size={11} /> Pro</> : 'Free'}
            </span>
          </div>
        </div>

        <div className="settings-divider" />

        {planLoading ? null : plan === 'free' ? (
          <div className="settings-row">
            <div className="settings-row__left">
              <span className="settings-row__label">Upgrade to Pro</span>
              <span className="settings-row__sub">$4.99/mo — AI Analyzer, unlimited logs, advanced charts</span>
            </div>
            <div className="settings-row__control">
              <button
                className="settings-btn settings-btn--teal"
                onClick={handleUpgrade}
                disabled={working}
              >
                {working ? 'Redirecting…' : 'Upgrade to Pro'}
              </button>
            </div>
          </div>
        ) : (
          <div className="settings-row">
            <div className="settings-row__left">
              <span className="settings-row__label">Billing &amp; invoices</span>
              <span className="settings-row__sub">Update payment method, view invoices, or cancel</span>
            </div>
            <div className="settings-row__control">
              <button
                className="settings-btn settings-btn--outline"
                onClick={handlePortal}
                disabled={working || !stripeCustomerId}
              >
                {working ? 'Redirecting…' : 'Manage billing'}
              </button>
            </div>
          </div>
        )}
      </SettingsCard>

      {/* ── Danger zone ── */}
      <SettingsCard icon={AlertTriangle} title="Danger zone" danger index={4}>
        <div className="settings-row">
          <div className="settings-row__left">
            <span className="settings-row__label">Delete account</span>
            <span className="settings-row__sub">
              Permanently remove your account and all associated data. This cannot be undone.
            </span>
          </div>
          <div className="settings-row__control">
            <button
              className="settings-btn settings-btn--danger"
              onClick={() => setShowDelete(true)}
            >
              Delete account
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* Delete modal */}
      <AnimatePresence>
        {showDelete && <DeleteModal onClose={() => setShowDelete(false)} />}
      </AnimatePresence>
    </div>
  );
}
