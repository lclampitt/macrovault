import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader, ChevronLeft } from 'lucide-react';
import '../../styles/foodsearch.css';

/* ── Open Food Facts helpers ──────────────────── */
function parseServingGrams(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (match) return parseFloat(match[1].replace(',', '.'));
  return null;
}

function formatOffProduct(p) {
  const nutriments = p.nutriments || {};
  const servingGrams = parseServingGrams(p.serving_size) || 100;
  const per100 = {
    calories: Number(nutriments['energy-kcal_100g']) || 0,
    protein: Number(nutriments.proteins_100g) || 0,
    carbs: Number(nutriments.carbohydrates_100g) || 0,
    fat: Number(nutriments.fat_100g) || 0,
  };
  return {
    id: p.code || `${p.product_name}-${Math.random()}`,
    name: (p.product_name || '').trim() || 'Unknown product',
    brand: ((p.brands || '').split(',')[0] || '').trim(),
    servingGrams,
    servingLabel: p.serving_size || `${servingGrams}g`,
    per100,
  };
}

function roundMacro(v, decimals = 1) {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

/**
 * Reusable Food Search that wraps the Open Food Facts API.
 *
 * Props:
 *   onAdd({ meal_name, ingredients, calories, protein, carbs, fat })
 *     → called when user confirms adding a food. Parent is responsible
 *        for persisting / closing / toasts.
 *   submitLabel?: string — button label on the detail view (default "Add").
 *   adding?: boolean — disables the button and shows "Adding..." state.
 *   autoFocus?: boolean — autofocus the search input on mount.
 */
export default function FoodSearch({
  onAdd,
  submitLabel = 'Add',
  adding = false,
  autoFocus = true,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState(null);
  const [servings, setServings] = useState(1);
  const [weight, setWeight] = useState(100);

  /* Debounced fetch */
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=true&page_size=10`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        const products = (data.products || [])
          .filter(
            (p) =>
              p.product_name &&
              p.nutriments &&
              p.nutriments['energy-kcal_100g'] != null
          )
          .map(formatOffProduct);
        setResults(products);
        setSearched(true);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setSearched(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function handleSelect(p) {
    setSelected(p);
    setServings(1);
    setWeight(p.servingGrams);
  }

  function handleBack() {
    setSelected(null);
  }

  function handleServingsChange(val) {
    const n = parseFloat(val);
    if (Number.isNaN(n) || n < 0) return;
    setServings(n);
    if (selected) setWeight(roundMacro(n * selected.servingGrams, 1));
  }

  function handleWeightChange(val) {
    const n = parseFloat(val);
    if (Number.isNaN(n) || n < 0) return;
    setWeight(n);
  }

  const live = useMemo(() => {
    if (!selected) return null;
    const w = Number(weight) || 0;
    const p100 = selected.per100;
    return {
      calories: Math.round((p100.calories * w) / 100),
      protein: roundMacro((p100.protein * w) / 100),
      carbs: roundMacro((p100.carbs * w) / 100),
      fat: roundMacro((p100.fat * w) / 100),
    };
  }, [selected, weight]);

  async function handleAdd() {
    if (!selected || !live) return;
    const displayName = selected.brand
      ? `${selected.brand} — ${selected.name}`
      : selected.name;
    const servingsStr = servings === 1 ? '1 serving' : `${servings} servings`;
    const ingredients = `${servingsStr} × ${Number(weight)}g`;
    await onAdd({
      meal_name: displayName,
      ingredients,
      calories: live.calories,
      protein: live.protein,
      carbs: live.carbs,
      fat: live.fat,
    });
  }

  return (
    <div className="fs">
      {!selected ? (
        <>
          <div className="fs-search">
            <Search size={14} className="fs-search__icon" />
            <input
              type="text"
              className="input fs-search__input"
              placeholder="Search branded foods (e.g. Oreos, Oikos yogurt)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus={autoFocus}
            />
          </div>

          {loading ? (
            <div className="fs__loading">
              <Loader size={16} className="fs__spinner" />
              <span>Searching...</span>
            </div>
          ) : !query.trim() ? (
            <div className="fs__empty">
              <p style={{ margin: 0 }}>
                Start typing to search the Open Food Facts database for branded
                foods.
              </p>
            </div>
          ) : searched && results.length === 0 ? (
            <div className="fs__empty">
              <p style={{ margin: 0 }}>
                No foods match "{query}". Try a different search.
              </p>
            </div>
          ) : (
            <div className="fs-results">
              <AnimatePresence>
                {results.map((p, i) => {
                  const servingCal = Math.round(
                    (p.per100.calories * p.servingGrams) / 100
                  );
                  const servingP = roundMacro(
                    (p.per100.protein * p.servingGrams) / 100
                  );
                  const servingC = roundMacro(
                    (p.per100.carbs * p.servingGrams) / 100
                  );
                  const servingF = roundMacro(
                    (p.per100.fat * p.servingGrams) / 100
                  );
                  return (
                    <motion.button
                      type="button"
                      key={p.id}
                      className="fs-result"
                      onClick={() => handleSelect(p)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                    >
                      <div className="fs-result__info">
                        {p.brand && (
                          <span className="fs-result__brand">{p.brand}</span>
                        )}
                        <span className="fs-result__name">{p.name}</span>
                        <span className="fs-result__serving">
                          {p.servingLabel} · {servingCal} kcal
                        </span>
                      </div>
                      <div className="fs-result__macros">
                        <span className="fs-chip">P: {servingP}g</span>
                        <span className="fs-chip">C: {servingC}g</span>
                        <span className="fs-chip">F: {servingF}g</span>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      ) : (
        <motion.div
          className="fs-detail"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button type="button" className="fs-detail__back" onClick={handleBack}>
            <ChevronLeft size={14} /> Back to results
          </button>

          <div className="fs-detail__header">
            {selected.brand && (
              <span className="fs-detail__brand">{selected.brand}</span>
            )}
            <span className="fs-detail__name">{selected.name}</span>
            <span className="fs-detail__subtext">
              Serving size: {selected.servingLabel}
            </span>
          </div>

          <div className="fs-detail__inputs">
            <div className="fs-field">
              <label className="fs-field__label">Servings</label>
              <input
                type="number"
                className="input"
                min="0"
                step="0.5"
                value={servings}
                onChange={(e) => handleServingsChange(e.target.value)}
              />
            </div>
            <div className="fs-field">
              <label className="fs-field__label">Weight (g)</label>
              <input
                type="number"
                className="input"
                min="0"
                step="1"
                value={weight}
                onChange={(e) => handleWeightChange(e.target.value)}
              />
            </div>
          </div>

          {live && (
            <div className="fs-detail__macros">
              <div className="fs-detail__macro">
                <span className="fs-detail__macro-val">{live.calories}</span>
                <span className="fs-detail__macro-label">kcal</span>
              </div>
              <div className="fs-detail__macro">
                <span className="fs-detail__macro-val">{live.protein}g</span>
                <span className="fs-detail__macro-label">protein</span>
              </div>
              <div className="fs-detail__macro">
                <span className="fs-detail__macro-val">{live.carbs}g</span>
                <span className="fs-detail__macro-label">carbs</span>
              </div>
              <div className="fs-detail__macro">
                <span className="fs-detail__macro-val">{live.fat}g</span>
                <span className="fs-detail__macro-label">fat</span>
              </div>
            </div>
          )}

          <button
            type="button"
            className="fs-submit"
            onClick={handleAdd}
            disabled={adding || !live || Number(weight) <= 0}
          >
            {adding ? 'Adding...' : submitLabel}
          </button>
        </motion.div>
      )}
    </div>
  );
}
