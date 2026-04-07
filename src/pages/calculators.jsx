// src/pages/calculators.jsx
import React, { useState, useEffect } from 'react';
import { ChartPie, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import '../styles/CalculatorsPage.css';
import CalculatorCard from '../components/ui/CalculatorCard';
import { useTheme } from '../hooks/useTheme';

const calculators = [
  {
    title: 'Macro Calculator',
    subtitle: 'Nutrition & macros',
    icon: ChartPie,
    href: '/calculators/macros',
    description:
      'Get your personalized daily calorie target and complete protein, carbs, and fat breakdown based on your body and goals.',
    spectrumIconBg: '#1a0d30',
    spectrumIconBorder: '1px solid #7C3AED',
    spectrumIconStroke: '#7C3AED',
  },
  {
    title: '1RM Calculator',
    subtitle: 'Strength estimation',
    icon: Trophy,
    href: '/calculators/1rm',
    description:
      'Calculate your estimated one-rep max using Epley, Brzycki, and Lombardi formulas.',
    spectrumIconBg: '#0a1a0f',
    spectrumIconBorder: '1px solid #1D9E75',
    spectrumIconStroke: '#1D9E75',
  },
];

const howRows = [
  {
    icon: ChartPie,
    title: 'Macro Calculator — Mifflin-St Jeor + lean mass method',
    body: 'Calculates your total daily energy expenditure, adjusts for your goal, then splits calories into protein, carbs and fat targets using evidence-based ratios.',
  },
  {
    icon: Trophy,
    title: '1RM — Epley formula (primary)',
    body: 'Estimates your theoretical one-rep maximum from a submaximal set. Shows results from three formulas so you can see the range rather than relying on one number.',
  },
];

const tips = [
  {
    title: 'Protein comes first',
    body: 'Your protein target is set first based on lean mass. Carbs and fat fill the remaining calories around it.',
    spectrumColor: '#A78BFA',
  },
  {
    title: 'Recalculate regularly',
    body: 'Update your macros every 4–6 weeks as your weight changes — especially during a cut.',
    spectrumColor: '#60A5FA',
  },
  {
    title: 'Carbs are flexible',
    body: 'If you follow keto or low-carb, use your fat target as the primary lever and drop carbs accordingly.',
    spectrumColor: '#FB923C',
  },
];

function SectionLabel({ text }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)',
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
    }}>
      {text}
    </div>
  );
}

function ResultChip({ value, label, source }) {
  return (
    <div className="calc-card" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--accent)', lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{source}</div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CalculatorsPage() {
  const { isSpectrum } = useTheme();
  const [saved, setSaved] = useState({ macro: null, orm: null });

  useEffect(() => {
    setSaved({
      macro: JSON.parse(localStorage.getItem('macrovault_macro_results') || 'null'),
      orm:   JSON.parse(localStorage.getItem('macrovault_1rm_results')   || 'null'),
    });
  }, []);

  const dates = [saved.macro?.calculated_at, saved.orm?.updatedAt].filter(Boolean);
  const lastUpdated  = dates.length > 0 ? formatDate([...dates].sort().at(-1)) : null;
  const hasAnyResults = dates.length > 0;

  return (
    <div className="calculators-container">
      <motion.h1
        className="calculators-title"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        Fitness Calculators
      </motion.h1>

      {/* ── Calculator cards ── */}
      <div className="calculator-grid">
        {calculators.map((calc, index) => (
          <CalculatorCard
            key={calc.href}
            index={index}
            title={calc.title}
            subtitle={calc.subtitle}
            description={calc.description}
            icon={calc.icon}
            href={calc.href}
            spectrumIconBg={isSpectrum ? calc.spectrumIconBg : undefined}
            spectrumIconBorder={isSpectrum ? calc.spectrumIconBorder : undefined}
            spectrumIconStroke={isSpectrum ? calc.spectrumIconStroke : undefined}
          />
        ))}
      </div>

      {/* ── Section 1: Your last results ── */}
      <div>
        <SectionLabel text="Your Last Results" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.25 }}
          className="calc-card"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}
        >
          {hasAnyResults ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Based on your profile</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Last updated {lastUpdated}</span>
              </div>
              <div className="results-chips-grid">
                <ResultChip
                  value={saved.macro?.calories?.toLocaleString()}
                  label="kcal target"
                  source="Macros"
                />
                <ResultChip
                  value={saved.macro?.protein_g != null ? `${saved.macro.protein_g}g` : null}
                  label="protein / day"
                  source="Macros"
                />
                <ResultChip
                  value={saved.macro?.carbs_g != null ? `${saved.macro.carbs_g}g` : null}
                  label="carbs / day"
                  source="Macros"
                />
                <ResultChip
                  value={saved.orm?.oneRepMax != null ? `${saved.orm.oneRepMax} ${saved.orm.unit}` : null}
                  label="est. 1RM"
                  source="1RM calc"
                />
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Run a calculator to see your results here
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Section 2: How these work ── */}
      <div>
        <SectionLabel text="How These Work" />
        <div className="calc-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {howRows.map((row, i) => (
            <motion.div
              key={row.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.32 + i * 0.06 }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                borderBottom: i < howRows.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 6, background: 'var(--accent-bg)',
                border: '1px solid var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
              }}>
                <row.icon width={13} height={13} stroke="var(--accent)" strokeWidth={1.5} fill="none" />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>{row.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>{row.body}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Tips ── */}
      <div>
        <SectionLabel text="Tips for Accuracy" />
        <div className="tips-grid">
          {tips.map((tip, i) => (
            <motion.div
              key={tip.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.5 + i * 0.06 }}
              className="calc-card"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: isSpectrum ? tip.spectrumColor : 'var(--accent-light)', marginBottom: 4 }}>{tip.title}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>{tip.body}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CalculatorsPage;
