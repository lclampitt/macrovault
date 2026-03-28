import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { usePlan } from '../hooks/usePlan';
import '../styles/billing.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';

export default function BillingPage() {
  const { plan, stripeCustomerId, isLoading } = usePlan();
  const [session, setSession] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  // Read URL params for success / cancel redirects from Stripe
  const params = new URLSearchParams(window.location.search);
  const didSucceed = params.get('success') === 'true';
  const didCancel  = params.get('canceled') === 'true';

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
    });
  }, []);

  async function handleUpgrade() {
    setError('');
    if (!session?.user) return;
    setWorking(true);
    try {
      const res = await fetch(`${API_BASE}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          email: session.user.email,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Checkout failed.');
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setWorking(false);
    }
  }

  async function handleManageBilling() {
    setError('');
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
      setError(err.message);
      setWorking(false);
    }
  }

  if (isLoading) {
    return <div className="billing"><p className="billing__muted">Loading…</p></div>;
  }

  return (
    <div className="billing">
      <div className="billing__card">

        {/* Current plan badge */}
        <div className="billing__plan-row">
          <span className="billing__plan-label">Current plan</span>
          <span className={`billing__plan-badge billing__plan-badge--${plan}`}>
            {plan === 'pro' ? '⭐ Pro' : 'Free'}
          </span>
        </div>

        {/* Redirect feedback */}
        {didSucceed && (
          <p className="billing__alert billing__alert--success">
            You're now on Pro! Thanks for subscribing.
          </p>
        )}
        {didCancel && (
          <p className="billing__alert billing__alert--warn">
            Checkout was canceled — no charge was made.
          </p>
        )}
        {error && (
          <p className="billing__alert billing__alert--error">{error}</p>
        )}

        {plan === 'free' ? (
          <>
            <div className="billing__perks">
              <p className="billing__perks-title">Upgrade to Pro — $4.99/month</p>
              <ul>
                <li>✓ AI Body Analyzer (measurements + photo)</li>
                <li>✓ TDEE, Protein &amp; 1RM calculators</li>
                <li>✓ Unlimited progress tracking</li>
                <li>✓ Cancel anytime</li>
              </ul>
            </div>
            <button
              className="billing__btn billing__btn--upgrade"
              onClick={handleUpgrade}
              disabled={working}
            >
              {working ? 'Redirecting…' : 'Upgrade to Pro'}
            </button>
          </>
        ) : (
          <>
            <p className="billing__muted">
              You have full access to all Pro features.
            </p>
            <button
              className="billing__btn billing__btn--manage"
              onClick={handleManageBilling}
              disabled={working || !stripeCustomerId}
            >
              {working ? 'Redirecting…' : 'Manage billing'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
