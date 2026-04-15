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
  const n = p.nutriments || {};
  const servingGrams = parseServingGrams(p.serving_size) || 100;

  let cal100 =
    Number(n['energy-kcal_100g']) ||
    Number(n['energy-kcal']) ||
    0;
  if (!cal100) {
    const kj =
      Number(n['energy-kj_100g']) ||
      Number(n['energy-kj']) ||
      Number(n.energy_100g) ||
      Number(n.energy) ||
      0;
    if (kj) cal100 = kj / 4.184;
  }
  if (!cal100) {
    const calServ =
      Number(n['energy-kcal_serving']) ||
      (Number(n['energy-kj_serving']) ? Number(n['energy-kj_serving']) / 4.184 : 0);
    if (calServ && servingGrams) cal100 = (calServ * 100) / servingGrams;
  }

  const protein100 =
    Number(n.proteins_100g) ||
    (Number(n.proteins_serving) && servingGrams
      ? (Number(n.proteins_serving) * 100) / servingGrams
      : 0);
  const carbs100 =
    Number(n.carbohydrates_100g) ||
    (Number(n.carbohydrates_serving) && servingGrams
      ? (Number(n.carbohydrates_serving) * 100) / servingGrams
      : 0);
  const fat100 =
    Number(n.fat_100g) ||
    (Number(n.fat_serving) && servingGrams
      ? (Number(n.fat_serving) * 100) / servingGrams
      : 0);

  return {
    id: p.code || `${p.product_name}-${Math.random()}`,
    name: (p.product_name || '').trim() || 'Unknown product',
    brand: ((p.brands || '').split(',')[0] || '').trim(),
    servingGrams,
    servingLabel: p.serving_size || `${servingGrams}g`,
    per100: {
      calories: cal100 || 0,
      protein: protein100 || 0,
      carbs: carbs100 || 0,
      fat: fat100 || 0,
    },
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
        const fields =
          'code,product_name,brands,serving_size,nutriments,countries_tags,lang';
        // Scope to US products + English locale so results match what the
        // user actually sees on shelves in the US.
        const v2 = `https://us.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(q)}&countries_tags_en=United%20States&lc=en&page_size=30&fields=${fields}`;
        let data;
        try {
          const res = await fetch(v2);
          data = await res.json();
        } catch {
          const legacy = `https://us.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&tagtype_0=countries&tag_contains_0=contains&tag_0=united-states&lc=en&json=true&page_size=30`;
          const res2 = await fetch(legacy);
          data = await res2.json();
        }
        if (cancelled) return;
        const products = (data.products || [])
          .filter((p) => {
            if (!p.product_name || !p.nutriments) return false;
            const tags = Array.isArray(p.countries_tags) ? p.countries_tags : [];
            const inUS = tags.length === 0 || tags.includes('en:united-states');
            const lang = (p.lang || '').toLowerCase();
            const englishOrBlank = !lang || lang === 'en';
            return inUS && englishOrBlank;
          })
          .map(formatOffProduct)
          .filter((p) => p.per100.calories > 0)
          .slice(0, 15);
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
