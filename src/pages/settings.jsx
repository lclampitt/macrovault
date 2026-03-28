import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Sliders, CreditCard, AlertTriangle, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import { usePlan } from '../hooks/usePlan';
import '../styles/settings.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';

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
  const { plan, stripeCustomerId, isLoading: planLoading } = usePlan();

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

      {/* ── Profile ── */}
      <SettingsCard icon={User} title="Profile" index={0}>
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
      <SettingsCard icon={Sliders} title="Preferences" index={1}>
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
      <SettingsCard icon={CreditCard} title="Subscription" index={2}>
        <div className="settings-row">
          <div className="settings-row__left">
            <span className="settings-row__label">Current plan</span>
            <span className="settings-row__sub">
              {plan === 'pro' ? 'Full access to all Pro features' : 'Limited to free tier usage'}
            </span>
          </div>
          <div className="settings-row__control">
            <span className={`settings-plan-badge settings-plan-badge--${plan}`}>
              {plan === 'pro' ? <><Crown size={11} /> Pro</> : 'Free'}
            </span>
          </div>
        </div>

        <div className="settings-divider" />

        {planLoading ? null : plan === 'free' ? (
          <div className="settings-row">
            <div className="settings-row__left">
              <span className="settings-row__label">Upgrade to Pro</span>
              <span className="settings-row__sub">$9/mo — AI Analyzer, unlimited logs, advanced charts</span>
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
      <SettingsCard icon={AlertTriangle} title="Danger zone" danger index={3}>
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
