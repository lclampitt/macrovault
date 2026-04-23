import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
  Lock, Trash2, Dumbbell, Bookmark, BookmarkCheck, Copy,
  BookmarkPlus, X, Star, Play, Clock, Search, Check, Plus, ChevronRight, ChevronLeft,
  GripVertical, Loader2, MoreVertical, StickyNote, Timer,
} from 'lucide-react';
import posthog from '../../lib/posthog';
import { supabase } from '../../supabaseClient';
import { useUpgrade } from '../../context/UpgradeContext';
import { usePlan } from '../../hooks/usePlan';
import { useTheme } from '../../hooks/useTheme';
import {
  readActiveWorkout,
  saveActiveWorkout,
  clearActiveWorkout,
} from '../../hooks/useActiveWorkout';
import { appToast as toast } from '../../utils/toast';
import exerciseDB from '../../data/exercises.json';
import RestTimerDialog from '../../components/common/RestTimerDialog';
import '../../styles/WorkoutLogger.css';

/* Unique id generator for session exercises. Used to give each row a
   stable identity so drag-to-reorder can remap per-exercise state
   (completedSets) without relying on mutable array indexes. */
let _exUidCounter = 0;
const newExId = () => `ex-${Date.now()}-${++_exUidCounter}`;

/* Stable per-set id — needed so the `items` manifest can reference a
   set by id instead of position, and so rest rows can be interleaved
   without shifting set indexes under the completedSets map. */
let _setUidCounter = 0;
const newSetId = () => `s-${Date.now()}-${++_setUidCounter}`;

/* Stable per-rest-row id. Distinct from setIds so a rest and a set
   never collide in a Reorder.Group key. */
let _restUidCounter = 0;
const newRestId = () => `r-${Date.now()}-${++_restUidCounter}`;

/* Ensure every set has a `_setId` and the exercise has an `items`
   manifest. Back-compat: legacy rows without items get one derived
   from the current sets order. Called at every session-entry point
   (new, template, resume, localStorage restore). */
function hydrateExerciseItems(ex) {
  const sets = Array.isArray(ex.sets) ? ex.sets : [];
  const hydratedSets = sets.map((s) => (s && s._setId ? s : { ...s, _setId: newSetId() }));
  const existingItems = Array.isArray(ex.items) ? ex.items : null;
  const validSetIds = new Set(hydratedSets.map((s) => s._setId));
  let items;
  if (existingItems) {
    // Keep any valid items, drop orphaned set refs, keep rests as-is.
    items = existingItems
      .map((it) => (it && it.kind === 'rest' ? { ...it, id: it.id || newRestId() } : it))
      .filter((it) => it && (it.kind === 'rest' || (it.kind === 'set' && validSetIds.has(it.setId))));
    // Append any hydrated sets missing from items (defensive).
    const seen = new Set(items.filter((i) => i.kind === 'set').map((i) => i.setId));
    hydratedSets.forEach((s) => {
      if (!seen.has(s._setId)) items.push({ kind: 'set', setId: s._setId });
    });
  } else {
    items = hydratedSets.map((s) => ({ kind: 'set', setId: s._setId }));
  }
  return { ...ex, sets: hydratedSets, items };
}

/* Format seconds as "M:SS". Shared by the rest-row countdown. */
const formatRestTime = (secs) => {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/* Resume-card window: if a workout finished less than this long ago
   and is still present in history, the mobile home view shows a
   "Finished too early? Resume workout" card that reopens the row as
   an active session. */
const RESUME_WINDOW_MS = 10 * 60 * 1000;

/* ── Cardio detection + canonical fields ──
   Sets persist in `workouts.exercises` JSONB. Cardio sets carry
   `duration_seconds`, `speed_mph`, and optional `distance_miles` —
   presence of any of those fields is the authoritative signal that a
   set/exercise is cardio. Also matches `isCardio: true` (session flag
   set when adding from the cardio section of the library) or
   `bodyPart === 'cardio'` (historical rows saved before that flag). */
const CARDIO_NAME_SET = new Set([
  'treadmill', 'stationary bike', 'elliptical', 'rowing machine',
  'stair climber', 'jump rope', 'running', 'cycling',
]);
const isCardioSet = (s) =>
  s && (s.duration_seconds != null || s.speed_mph != null ||
        s.distance_miles != null || s.duration != null || s.speed != null);
const isCardioExercise = (ex) => {
  if (!ex) return false;
  if (ex.isCardio) return true;
  if (ex.bodyPart === 'cardio') return true;
  const name = (ex.name || '').toLowerCase().trim();
  if (CARDIO_NAME_SET.has(name)) return true;
  return Array.isArray(ex.sets) && ex.sets.some(isCardioSet);
};
/* km → mi, kmh → mph, min → sec. Kept tiny and pure for reuse. */
const KM_TO_MI = 0.621371;
const toMiles = (v, unit) => {
  const n = parseFloat(v);
  if (!isFinite(n)) return null;
  return unit === 'km' ? +(n * KM_TO_MI).toFixed(2) : +n.toFixed(2);
};
const toMph = (v, unit) => {
  const n = parseFloat(v);
  if (!isFinite(n)) return null;
  return unit === 'kmh' ? +(n * KM_TO_MI).toFixed(2) : +n.toFixed(2);
};
const toSeconds = (v, unit) => {
  const n = parseFloat(v);
  if (!isFinite(n)) return null;
  return unit === 'sec' ? Math.round(n) : Math.round(n * 60);
};
/* Render a cardio set for history/detail views. */
const formatCardioSet = (s) => {
  if (!s) return '—';
  const secs = s.duration_seconds ?? null;
  const mins = secs != null ? Math.round(secs / 60) : null;
  const mph = s.speed_mph != null ? +Number(s.speed_mph).toFixed(1) : null;
  const mi  = s.distance_miles != null ? +Number(s.distance_miles).toFixed(2) : null;
  const parts = [];
  if (mins != null) parts.push(`${mins} min`);
  if (mph != null) parts.push(`@ ${mph} mph`);
  const main = parts.length ? parts.join(' ') : '—';
  return mi ? `${main} · ${mi} mi` : main;
};

/**
 * Auto-scrolls the page while the user drags an exercise block near the
 * top/bottom of the viewport. Called from the drag-handle's pointerdown.
 * Ramps speed with depth into a ~100px edge zone and accounts for the
 * fixed top header + bottom nav + iOS safe-area on mobile.
 */
function useAutoScrollOnDrag() {
  const rafRef = useRef(null);
  const pointerYRef = useRef(0);
  const activeRef = useRef(false);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const start = (initialEvent) => {
    if (activeRef.current) return;
    activeRef.current = true;
    pointerYRef.current = initialEvent?.clientY ?? 0;

    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const THRESHOLD = 100;
    const TOP_OFFSET = isMobile ? 56 : 0;
    // Mobile bottom nav is 56px + safe-area-inset-bottom. Read the actual
    // inset via env() by sampling a probe element so we don't hardcode.
    const safeBottom = (() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;';
      document.body.appendChild(probe);
      const h = probe.offsetHeight || 0;
      document.body.removeChild(probe);
      return h;
    })();
    const BOTTOM_OFFSET = isMobile ? (56 + safeBottom) : 0;

    const onMove = (e) => { pointerYRef.current = e.clientY; };
    const onUp = () => {
      activeRef.current = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const tick = () => {
      if (!activeRef.current) return;
      const y = pointerYRef.current;
      const h = window.innerHeight;
      const topEdge = TOP_OFFSET + THRESHOLD;
      const bottomEdge = h - BOTTOM_OFFSET - THRESHOLD;

      if (y > TOP_OFFSET && y < topEdge) {
        const depth = Math.min(1, (topEdge - y) / THRESHOLD);
        window.scrollBy(0, -(2 + depth * 16));
      } else if (y < (h - BOTTOM_OFFSET) && y > bottomEdge) {
        const depth = Math.min(1, (y - bottomEdge) / THRESHOLD);
        window.scrollBy(0, 2 + depth * 16);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    rafRef.current = requestAnimationFrame(tick);
  };

  return start;
}

/**
 * A single inline rest-row, rendered inside the exercise's items list.
 * Reorder.Item so it can be dragged to a new position via the grip.
 * Countdown is wall-clock derived from `startedAt + durationSec`, so
 * it stays accurate across re-renders and tab-backgrounding.
 */
function RestRowItem({ item, exIdx, onRemove }) {
  const controls = useDragControls();
  const startAutoScroll = useAutoScrollOnDrag();
  const now = Date.now();
  const elapsedSec = item.startedAt ? Math.floor((now - item.startedAt) / 1000) : 0;
  const remainingSec = Math.max(0, item.durationSec - elapsedSec);
  const done = item.startedAt && remainingSec === 0;
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      as="div"
      className={`wlm-rest-row ${done ? 'wlm-rest-row--done' : ''}`}
      initial={{ opacity: 0, scaleY: 0.6 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.6 }}
      transition={{ duration: 0.18 }}
      style={{ originY: 0 }}
    >
      <button
        type="button"
        className="wlm-rest-row__grip"
        aria-label="Drag to reorder rest"
        onPointerDown={(e) => { controls.start(e); startAutoScroll(e); }}
        style={{ touchAction: 'none' }}
      >
        <GripVertical size={14} />
      </button>
      <Timer size={14} className="wlm-rest-row__icon" />
      <span className="wlm-rest-row__label">Rest</span>
      <span className="wlm-rest-row__time">
        {done ? 'Done' : formatRestTime(remainingSec)}
      </span>
      <span className="wlm-rest-row__duration">· {formatRestTime(item.durationSec)}</span>
      <button
        type="button"
        className="wlm-rest-row__delete"
        onClick={() => onRemove(exIdx, item.id)}
        aria-label="Remove rest"
        style={{ touchAction: 'manipulation' }}
      >
        <X size={14} />
      </button>
    </Reorder.Item>
  );
}

/**
 * One exercise card rendered as a Framer Motion Reorder.Item. Drag is
 * gated to the grip handle via `dragListener={false}` + useDragControls
 * so tapping the weight/reps inputs never starts a drag.
 */
function ReorderableExerciseBlock({
  ex,
  exIdx,
  completedSets,
  updateSessionSet,
  toggleSetComplete,
  addSetToSession,
  removeSessionExercise,
  removeSessionSet,
  handleInputFocus,
  handleInputKeyDown,
  handleInputClick,
  onOpenExerciseMenu,
  isEditingNote,
  noteDraft,
  onStartEditNote,
  onChangeNoteDraft,
  onCommitNoteDraft,
  reorderSessionItems,
  removeRestItem,
}) {
  const controls = useDragControls();
  const startAutoScroll = useAutoScrollOnDrag();
  const cardio = isCardioExercise(ex);
  const rawNote = ex.notes && String(ex.notes).trim();
  const hasNote = !!rawNote;
  const displayNote = hasNote && rawNote.length > 60 ? `${rawNote.slice(0, 60)}…` : rawNote;
  const items = Array.isArray(ex.items) ? ex.items : [];

  /* Expanded inline note input: on open, focus and scroll the card into
     view so the iOS keyboard doesn't hide it. Mirrors the pattern used
     for the numeric weight/reps inputs. */
  const noteInputRef = useRef(null);
  useEffect(() => {
    if (isEditingNote && noteInputRef.current) {
      const el = noteInputRef.current;
      try { el.focus(); } catch { /* noop */ }
      setTimeout(() => {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* noop */ }
      }, 150);
    }
  }, [isEditingNote]);
  return (
    <Reorder.Item
      value={ex}
      dragListener={false}
      dragControls={controls}
      as="div"
      className={`wlm-ex-block ${cardio ? 'wlm-ex-block--cardio' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="wlm-ex-block__header">
        <button
          type="button"
          className="wlm-ex-block__drag"
          aria-label="Drag to reorder"
          onPointerDown={(e) => {
            controls.start(e);
            startAutoScroll(e);
          }}
          /* Touch-action none prevents iOS scrolling while the user
             long-presses the handle. */
          style={{ touchAction: 'none' }}
        >
          <GripVertical size={16} />
        </button>
        <span className="wlm-ex-block__name">
          {ex.name}
          {cardio && <span className="wlm-ex-block__cardio-badge">CARDIO</span>}
        </span>
        {/* Mobile: 3-dots menu. Desktop: trash icon (≥768px via CSS). */}
        <button
          type="button"
          className="wlm-ex-block__more"
          onClick={(e) => {
            if (!onOpenExerciseMenu) return;
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenExerciseMenu(exIdx, rect);
          }}
          aria-label="Exercise options"
          style={{ touchAction: 'manipulation' }}
        >
          <MoreVertical size={16} />
        </button>
        <button
          type="button"
          className="wlm-ex-block__remove"
          onClick={() => removeSessionExercise(exIdx)}
          aria-label="Remove exercise"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {isEditingNote ? (
        <div className="wlm-ex-block__note-row wlm-ex-block__note-row--editing">
          <StickyNote size={12} className="wlm-ex-block__note-row-icon" />
          <textarea
            ref={noteInputRef}
            className="wlm-ex-block__note-input"
            value={noteDraft ?? ''}
            onChange={(e) => onChangeNoteDraft(e.target.value)}
            onBlur={onCommitNoteDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder="e.g. felt strong on first set"
            rows={2}
            maxLength={300}
            style={{ touchAction: 'manipulation' }}
          />
        </div>
      ) : hasNote ? (
        <button
          type="button"
          className="wlm-ex-block__note-row wlm-ex-block__note-row--collapsed"
          onClick={() => onStartEditNote && onStartEditNote(exIdx)}
          style={{ touchAction: 'manipulation' }}
          aria-label="Edit note"
        >
          <StickyNote size={12} className="wlm-ex-block__note-row-icon" />
          <span className="wlm-ex-block__note-row-text">Note: {displayNote}</span>
        </button>
      ) : null}
      {cardio ? (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={(newOrder) => reorderSessionItems(exIdx, newOrder)}
          as="div"
          className="wlm-ex-block__cardio-sets"
        >
          {items.map((item) => {
            if (item.kind === 'rest') {
              return (
                <RestRowItem
                  key={item.id}
                  item={item}
                  exIdx={exIdx}
                  onRemove={removeRestItem}
                />
              );
            }
            const setIdx = ex.sets.findIndex((s) => s._setId === item.setId);
            if (setIdx < 0) return null;
            const set = ex.sets[setIdx];
            const isDone = !!completedSets[`${exIdx}-${setIdx}`];
            const durationUnit = set.durationUnit || 'min';
            const speedUnit = set.speedUnit || 'mph';
            const distanceUnit = set.distanceUnit || 'mi';
            const distanceShown = !!set.distanceShown || (set.distance != null && set.distance !== '');
            return (
              <Reorder.Item
                value={item}
                dragListener={false}
                key={item.setId}
                as="div"
                className={`wlm-cardio-row ${isDone ? 'wlm-cardio-row--done' : ''}`}
                style={{ touchAction: 'manipulation' }}
              >
                <div className="wlm-cardio-row__top">
                  <span className="wlm-cardio-row__set-num">Interval {setIdx + 1}</span>
                  <button
                    type="button"
                    className={`wlm-check-btn ${isDone ? 'wlm-check-btn--done' : ''}`}
                    onClick={() => toggleSetComplete(exIdx, setIdx)}
                    aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Check size={16} />
                  </button>
                  {ex.sets.length > 1 && (
                    <button
                      type="button"
                      className="wlm-cardio-row__delete"
                      onClick={() => removeSessionSet(exIdx, setIdx)}
                      aria-label={`Delete interval ${setIdx + 1}`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="wlm-cardio-field">
                  <label className="wlm-cardio-field__label">Time</label>
                  <div className="wlm-cardio-field__input-wrap">
                    <input
                      type="number"
                      inputMode="decimal"
                      className="wlm-cardio-field__input"
                      value={set.duration ?? ''}
                      onChange={(e) => updateSessionSet(exIdx, setIdx, 'duration', e.target.value)}
                      onFocus={handleInputFocus}
                      onClick={handleInputClick}
                      onKeyDown={handleInputKeyDown}
                      placeholder="30"
                    />
                    <div className="wlm-cardio-unit" role="group" aria-label="Duration unit">
                      <button
                        type="button"
                        className={`wlm-cardio-unit__pill ${durationUnit === 'min' ? 'wlm-cardio-unit__pill--active' : ''}`}
                        onClick={() => updateSessionSet(exIdx, setIdx, 'durationUnit', 'min')}
                        style={{ touchAction: 'manipulation' }}
                      >min</button>
                      <button
                        type="button"
                        className={`wlm-cardio-unit__pill ${durationUnit === 'sec' ? 'wlm-cardio-unit__pill--active' : ''}`}
                        onClick={() => updateSessionSet(exIdx, setIdx, 'durationUnit', 'sec')}
                        style={{ touchAction: 'manipulation' }}
                      >sec</button>
                    </div>
                  </div>
                </div>
                <div className="wlm-cardio-field">
                  <label className="wlm-cardio-field__label">Speed</label>
                  <div className="wlm-cardio-field__input-wrap">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      className="wlm-cardio-field__input"
                      value={set.speed ?? ''}
                      onChange={(e) => updateSessionSet(exIdx, setIdx, 'speed', e.target.value)}
                      onFocus={handleInputFocus}
                      onClick={handleInputClick}
                      onKeyDown={handleInputKeyDown}
                      placeholder="6.5"
                    />
                    <div className="wlm-cardio-unit" role="group" aria-label="Speed unit">
                      <button
                        type="button"
                        className={`wlm-cardio-unit__pill ${speedUnit === 'mph' ? 'wlm-cardio-unit__pill--active' : ''}`}
                        onClick={() => updateSessionSet(exIdx, setIdx, 'speedUnit', 'mph')}
                        style={{ touchAction: 'manipulation' }}
                      >mph</button>
                      <button
                        type="button"
                        className={`wlm-cardio-unit__pill ${speedUnit === 'kmh' ? 'wlm-cardio-unit__pill--active' : ''}`}
                        onClick={() => updateSessionSet(exIdx, setIdx, 'speedUnit', 'kmh')}
                        style={{ touchAction: 'manipulation' }}
                      >km/h</button>
                    </div>
                  </div>
                </div>
                {distanceShown ? (
                  <div className="wlm-cardio-field">
                    <label className="wlm-cardio-field__label">Distance</label>
                    <div className="wlm-cardio-field__input-wrap">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        className="wlm-cardio-field__input"
                        value={set.distance ?? ''}
                        onChange={(e) => updateSessionSet(exIdx, setIdx, 'distance', e.target.value)}
                        onFocus={handleInputFocus}
                        onClick={handleInputClick}
                        onKeyDown={handleInputKeyDown}
                        placeholder="3.1"
                      />
                      <div className="wlm-cardio-unit" role="group" aria-label="Distance unit">
                        <button
                          type="button"
                          className={`wlm-cardio-unit__pill ${distanceUnit === 'mi' ? 'wlm-cardio-unit__pill--active' : ''}`}
                          onClick={() => updateSessionSet(exIdx, setIdx, 'distanceUnit', 'mi')}
                          style={{ touchAction: 'manipulation' }}
                        >mi</button>
                        <button
                          type="button"
                          className={`wlm-cardio-unit__pill ${distanceUnit === 'km' ? 'wlm-cardio-unit__pill--active' : ''}`}
                          onClick={() => updateSessionSet(exIdx, setIdx, 'distanceUnit', 'km')}
                          style={{ touchAction: 'manipulation' }}
                        >km</button>
                      </div>
                      <button
                        type="button"
                        className="wlm-cardio-distance-remove"
                        onClick={() => {
                          updateSessionSet(exIdx, setIdx, 'distance', '');
                          updateSessionSet(exIdx, setIdx, 'distanceShown', false);
                        }}
                        aria-label="Remove distance field"
                        style={{ touchAction: 'manipulation' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="wlm-cardio-distance-toggle"
                    onClick={() => updateSessionSet(exIdx, setIdx, 'distanceShown', true)}
                    style={{ touchAction: 'manipulation' }}
                  >
                    + Add distance
                  </button>
                )}
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      ) : (
        <div className="wlm-ex-block__table">
          <div className="wlm-ex-block__thead">
            <span className="wlm-ex-col wlm-ex-col--set">SET</span>
            <span className="wlm-ex-col wlm-ex-col--weight">LBS</span>
            <span className="wlm-ex-col wlm-ex-col--reps">REPS</span>
            <span className="wlm-ex-col wlm-ex-col--check" />
          </div>
          <Reorder.Group
            axis="y"
            values={items}
            onReorder={(newOrder) => reorderSessionItems(exIdx, newOrder)}
            as="div"
            className="wlm-ex-block__tbody"
          >
          {items.map((item) => {
            if (item.kind === 'rest') {
              return (
                <RestRowItem
                  key={item.id}
                  item={item}
                  exIdx={exIdx}
                  onRemove={removeRestItem}
                />
              );
            }
            const setIdx = ex.sets.findIndex((s) => s._setId === item.setId);
            if (setIdx < 0) return null;
            const set = ex.sets[setIdx];
            const isDone = !!completedSets[`${exIdx}-${setIdx}`];
            return (
              <Reorder.Item value={item} dragListener={false} key={item.setId} as="div" className={`wlm-ex-row ${isDone ? 'wlm-ex-row--done' : ''}`}>
                <span className="wlm-ex-col wlm-ex-col--set">{setIdx + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="wlm-ex-input"
                  value={set.weight}
                  onChange={(e) => updateSessionSet(exIdx, setIdx, 'weight', e.target.value)}
                  onFocus={handleInputFocus}
                  onClick={handleInputClick}
                  onKeyDown={handleInputKeyDown}
                  placeholder="—"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  className="wlm-ex-input"
                  value={set.reps}
                  onChange={(e) => updateSessionSet(exIdx, setIdx, 'reps', e.target.value)}
                  onFocus={handleInputFocus}
                  onClick={handleInputClick}
                  onKeyDown={handleInputKeyDown}
                  placeholder="—"
                />
                <button
                  type="button"
                  className={`wlm-check-btn ${isDone ? 'wlm-check-btn--done' : ''}`}
                  onClick={() => toggleSetComplete(exIdx, setIdx)}
                >
                  <Check size={16} />
                </button>
              </Reorder.Item>
            );
          })}
          </Reorder.Group>
        </div>
      )}
      <button
        type="button"
        className="wlm-ex-block__add-set"
        onClick={() => addSetToSession(exIdx)}
      >
        {cardio ? '+ Add Interval' : '+ Add Set'}
      </button>
    </Reorder.Item>
  );
}

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';


/* Format date string: "2025-12-12" → "Dec 12, 2025" */
function formatDate(dateStr = '') {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* Get today's date in LOCAL timezone as YYYY-MM-DD (avoids UTC off-by-one) */
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// eslint-disable-next-line no-unused-vars
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export default function WorkoutLogger() {
  const { triggerUpgrade } = useUpgrade();
  const { plan, isPro } = usePlan();
  const { isSpectrum } = useTheme();

  const MUSCLE_GROUPS = ['Upper Body', 'Lower Body', 'Legs', 'Full Body', 'Core', 'Cardio'];

  // Form state for creating/editing a workout
  const [workoutDate, setWorkoutDate] = useState(getLocalDateString());
  const [workoutName, setWorkoutName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [exercises, setExercises] = useState([]);
  const [newExercise, setNewExercise] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);

  // History and UI state
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [formOpen, setFormOpen] = useState(false);

  // ── Template state ──────────────────────────
  const [templates, setTemplates] = useState([]);
  const [historyTab, setHistoryTab] = useState('history'); // 'history' | 'templates'
  const [saveTemplatePopover, setSaveTemplatePopover] = useState(null); // workout id or null
  const [templateName, setTemplateName] = useState('');
  const [templateNameMap, setTemplateNameMap] = useState({}); // workout_name → template_id
  const [loadedTemplateName, setLoadedTemplateName] = useState(null);
  const [loadedTemplateId, setLoadedTemplateId] = useState(null);
  const [copyPopover, setCopyPopover] = useState(null); // workout id or null
  const [copyDate, setCopyDate] = useState(getLocalDateString());
  const formRef = useRef(null);

  // ── Mobile state ──────────────────────────
  const [mobileView, setMobileView] = useState('home'); // 'home' | 'session'
  const [sessionExercises, setSessionExercises] = useState([]);
  const [sessionName, setSessionName] = useState('');
  const [sessionMuscleGroup, setSessionMuscleGroup] = useState('');
  const [sessionTimer, setSessionTimer] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const SESSION_NOTES_MAX = 500;
  const [exerciseSearchOpen, setExerciseSearchOpen] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [exerciseBodyPartFilter, setExerciseBodyPartFilter] = useState('all');
  const [completedSets, setCompletedSets] = useState({});
  const [templatePreview, setTemplatePreview] = useState(null);
  const [sessionFromTemplateId, setSessionFromTemplateId] = useState(null);
  const [sessionOriginalTemplate, setSessionOriginalTemplate] = useState(null);
  const [templateUpdateSheet, setTemplateUpdateSheet] = useState(null); // { templateId, templateName, changes, exerciseData }
  const [saveNewTplMode, setSaveNewTplMode] = useState(false);
  const [saveNewTplName, setSaveNewTplName] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const finishInFlight = useRef(false);
  const [endWorkoutConfirm, setEndWorkoutConfirm] = useState(false);
  /* Mirror of endWorkoutConfirm for the Discard flow. Kept as a plain
     boolean (not a discriminated union) because the two modals have
     different body copy + action colors — see the AnimatePresence
     block below for the destructive variant. */
  const [discardConfirm, setDiscardConfirm] = useState(false);
  /* When the user resumes a just-finished workout, finishSession
     updates the existing row instead of inserting a new one — so the
     "Resume" flow never leaves duplicates in the history list. */
  const [resumedFromWorkoutId, setResumedFromWorkoutId] = useState(null);
  /* Tracks the most recent finish for the 10-minute Resume card on
     the mobile home view. Seeded from localStorage so it survives
     a refresh and persists the Resume affordance cross-page. */
  const RECENT_FINISH_KEY = 'macrovault_recent_finish';
  const [recentFinish, setRecentFinish] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(RECENT_FINISH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  /* Edit-in-place sheet — loads an existing workout into a compact
     editor. Separate state from `editingWorkoutId` (which drives the
     desktop form flow) so the mobile sheet can edit without taking
     over the whole log form. */
  const [editWorkoutSheet, setEditWorkoutSheet] = useState(null);
  const [saveNewTplError, setSaveNewTplError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [workoutDetailSheet, setWorkoutDetailSheet] = useState(null);

  /* Per-exercise action menu (3-dots popover on mobile exercise block).
     Stored as { idx, anchorRect } so the popover can position itself
     directly under the 3-dots button instead of using a full-width
     bottom sheet (which was clipped by the fixed bottom nav). */
  const [exerciseMenu, setExerciseMenu] = useState(null);
  /* Per-exercise inline note editor. `exIdx` marks which card is in the
     expanded-editing state; `draft` is the in-progress textarea value.
     Committed to the exercise on blur via setSessionExerciseNotes. */
  const [noteSheet, setNoteSheet] = useState(null); // { exIdx, draft }
  /* Rest-timer picker dialog — a centered modal (see RestTimerDialog).
     Stores the exIdx the rest row will be inserted into. */
  const [restPickerExIdx, setRestPickerExIdx] = useState(null);
  /* Shared 1 Hz tick. Only runs while there's at least one active
     (started, not-yet-fired) rest row in the session, so idle
     sessions don't re-render every second. Individual rest rows
     read Date.now() to compute their own `remaining` on render. */
  const [, setNowTick] = useState(0);
  /* Destructive confirmation for Remove Exercise. */
  const [confirmRemoveExercise, setConfirmRemoveExercise] = useState(null); // exIdx

  // Scroll to top when opening the logger
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Get the logged-in user from Supabase
  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setMessage('Please log in to save or view workouts.');
        return;
      }
      setUserId(data.user.id);
    }
    fetchUser();
  }, []);

  // Once we know the user, load their saved workouts
  useEffect(() => {
    if (!userId) return;
    fetchWorkouts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Fetch all workouts for the current user
  const fetchWorkouts = async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('workout_date', { ascending: false });

    if (error) console.error('Fetch error:', error);
    else setWorkoutHistory(data);
  };

  // ── Template CRUD ──────────────────────────
  const fetchTemplates = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('user_id', userId)
      .order('use_count', { ascending: false });

    if (error) { console.error('Template fetch error:', error); return; }
    setTemplates(data || []);
    // Build name → template_id map
    const map = {};
    (data || []).forEach((t) => { map[t.name] = t.id; });
    setTemplateNameMap(map);
  }, [userId]);

  useEffect(() => {
    if (userId) fetchTemplates();
  }, [userId, fetchTemplates]);

  const saveAsTemplate = async (workout) => {
    if (!userId) return;
    const name = templateName.trim() || workout.workout_name;
    const exerciseData = (workout.exercises || []).map((ex) => ({
      name: ex.name,
      sets: (ex.sets || []).map((s, idx) => ({
        set_number: idx + 1,
        weight: s.weight || '',
        reps: s.reps || '',
      })),
    }));

    /* Wrap the Supabase call in try/catch so mobile network blips
       (airplane mode, flaky wifi) surface as a visible error toast
       instead of silently failing — previously only in-band
       Supabase errors were caught, thrown fetch errors were not. */
    try {
      const { error } = await supabase.from('workout_templates').insert({
        user_id: userId,
        name,
        muscle_group: workout.muscle_group || '',
        exercises: exerciseData,
      });

      if (error) {
        toast.error(`Failed to save template: ${error.message}`);
        return;
      }
      toast.success('Template saved successfully');
      setSaveTemplatePopover(null);
      setTemplateName('');
      fetchTemplates();
    } catch (err) {
      console.error('saveAsTemplate failed:', err);
      toast.error(err?.message ? `Failed to save template: ${err.message}` : 'Failed to save template');
    }
  };

  const deleteTemplate = async (templateId) => {
    const { error } = await supabase.from('workout_templates').delete().eq('id', templateId);
    if (error) { toast.error('Failed to delete template'); return; }
    toast.success('Template deleted');
    fetchTemplates();
  };

  const removeTemplateByName = async (workoutName) => {
    const tid = templateNameMap[workoutName];
    if (!tid) return;
    await deleteTemplate(tid);
  };

  const loadTemplate = (template) => {
    setWorkoutName(template.name);
    setMuscleGroup(template.muscle_group || '');
    const exs = (template.exercises || []).map((ex) => ({
      name: ex.name,
      sets: Array.isArray(ex.sets)
        ? ex.sets.map((s) => ({ weight: s.weight || '', reps: s.reps || '', notes: '' }))
        : Array.from({ length: ex.sets || 3 }, () => ({ weight: ex.weight || '', reps: ex.reps || '', notes: '' })),
    }));
    setExercises(exs);
    setLoadedTemplateName(template.name);
    setLoadedTemplateId(template.id);
    setFormOpen(true);
    setHistoryTab('history');
    // Scroll to form
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const incrementTemplateUseCount = async (templateId) => {
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    const currentCount = tpl?.use_count || 0;
    await supabase
      .from('workout_templates')
      .update({ use_count: currentCount + 1, updated_at: new Date().toISOString() })
      .eq('id', templateId);
  };

  const updateTemplateWeights = async (templateId, exerciseList) => {
    if (!templateId) return;
    const exerciseData = exerciseList.map((ex) => ({
      name: ex.name,
      sets: (ex.sets || []).map((s, idx) => ({
        set_number: idx + 1,
        weight: s.weight || '',
        reps: s.reps || '',
      })),
    }));
    await supabase
      .from('workout_templates')
      .update({ exercises: exerciseData, updated_at: new Date().toISOString() })
      .eq('id', templateId);
  };

  // Detect changes between finished workout and original template
  const detectTemplateChanges = (finishedExercises, originalTemplate) => {
    if (!originalTemplate?.exercises) return [];
    const changes = [];
    const templateExs = originalTemplate.exercises;
    const finishedNames = finishedExercises.map((e) => e.name);
    const templateNames = templateExs.map((e) => e.name);

    // Exercises added
    finishedNames.forEach((name) => {
      if (!templateNames.includes(name)) changes.push({ type: 'added', name });
    });
    // Exercises removed
    templateNames.forEach((name) => {
      if (!finishedNames.includes(name)) changes.push({ type: 'removed', name });
    });
    // Weight/rep changes
    finishedExercises.forEach((fEx) => {
      const tEx = templateExs.find((t) => t.name === fEx.name);
      if (!tEx) return;
      const tSets = Array.isArray(tEx.sets) ? tEx.sets : [];
      (fEx.sets || []).forEach((s, si) => {
        const ts = tSets[si];
        if (!ts) return;
        if (String(s.weight || '') !== String(ts.weight || '') || String(s.reps || '') !== String(ts.reps || '')) {
          changes.push({
            type: 'changed',
            name: fEx.name,
            set: si + 1,
            from: { weight: ts.weight || '—', reps: ts.reps || '—' },
            to: { weight: s.weight || '—', reps: s.reps || '—' },
          });
        }
      });
      // Extra sets added
      if ((fEx.sets || []).length > tSets.length) {
        changes.push({ type: 'sets_added', name: fEx.name, count: (fEx.sets || []).length - tSets.length });
      }
    });
    return changes;
  };

  // Copy workout to a new date
  const copyWorkoutToDate = async (workout) => {
    if (!userId) return;
    const workoutData = {
      user_id: userId,
      workout_date: copyDate,
      workout_name: workout.workout_name,
      muscle_group: workout.muscle_group || null,
      exercises: workout.exercises || [],
    };
    try {
      const res = await fetch(`${API_BASE}/workouts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workoutData),
      });
      if (res.status === 403) { triggerUpgrade('workouts'); return; }
      if (!res.ok) throw new Error(await res.text());
      toast.success(`${workout.workout_name} logged for ${formatDate(copyDate)}`);
      setCopyPopover(null);
      fetchWorkouts();
    } catch (err) {
      toast.error(`Failed to copy workout: ${err.message}`);
    }
  };

  // Delete a workout from history
  const deleteWorkout = async (id) => {
    const { error } = await supabase.from('workouts').delete().eq('id', id);
    if (error) console.error('Delete error:', error);
    else setWorkoutHistory((prev) => prev.filter((w) => w.id !== id));
  };

  // Add a new exercise row to the current workout
  const addExercise = () => {
    if (!newExercise.trim()) return;
    const name = newExercise.trim();
    // Match against known cardio names so desktop-form typed entries
    // also get cardio inputs without needing a picker.
    const cardio = CARDIO_NAME_SET.has(name.toLowerCase());
    const blankSet = cardio
      ? { duration: '', durationUnit: 'min', speed: '', speedUnit: 'mph', distance: '', distanceUnit: 'mi', distanceShown: false, notes: '' }
      : { weight: '', reps: '', notes: '' };
    setExercises([
      ...exercises,
      { name, isCardio: cardio || undefined, sets: [blankSet] },
    ]);
    setNewExercise('');
  };

  // Add an additional set to an existing exercise
  const addSet = (i) => {
    const updated = [...exercises];
    const ex = updated[i];
    const cardio = isCardioExercise(ex);
    const lastSet = (ex.sets && ex.sets[ex.sets.length - 1]) || {};
    const blankSet = cardio
      ? {
          duration: '',
          durationUnit: lastSet.durationUnit || 'min',
          speed: '',
          speedUnit: lastSet.speedUnit || 'mph',
          distance: '',
          distanceUnit: lastSet.distanceUnit || 'mi',
          distanceShown: !!lastSet.distanceShown,
          notes: '',
        }
      : { weight: '', reps: '', notes: '' };
    updated[i].sets.push(blankSet);
    setExercises(updated);
  };

  // Update a single field of a single set for an exercise
  const handleSetChange = (exerciseIndex, setIndex, field, value) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets[setIndex][field] = value;
    setExercises(updated);
  };

  // Remove an exercise from the current workout
  const deleteExercise = (i) => {
    const updated = exercises.filter((_, idx) => idx !== i);
    setExercises(updated);
  };

  // Save new workout or update an existing one in Supabase
  const saveWorkout = async () => {
    if (!workoutName.trim() || exercises.length === 0) {
      setMessage('Please enter a workout name and add at least one exercise.');
      return;
    }
    if (!userId) {
      setMessage('Please log in first.');
      return;
    }

    const normalizedExercises = exercises.map((ex) => {
      if (!isCardioExercise(ex)) return ex;
      return {
        ...ex,
        isCardio: true,
        sets: (ex.sets || []).map((s) => ({
          duration_seconds: toSeconds(s.duration, s.durationUnit || 'min'),
          speed_mph: toMph(s.speed, s.speedUnit || 'mph'),
          distance_miles: s.distanceShown ? toMiles(s.distance, s.distanceUnit || 'mi') : null,
          duration: s.duration ?? '',
          durationUnit: s.durationUnit || 'min',
          speed: s.speed ?? '',
          speedUnit: s.speedUnit || 'mph',
          distance: s.distance ?? '',
          distanceUnit: s.distanceUnit || 'mi',
          distanceShown: !!s.distanceShown,
          notes: s.notes || '',
        })),
      };
    });
    const workoutData = {
      user_id: userId,
      workout_date: workoutDate,
      workout_name: workoutName.trim(),
      muscle_group: muscleGroup || null,
      exercises: normalizedExercises,
    };

    let error;

    // If editingWorkoutId exists, update the existing row (no limit check needed for edits)
    if (editingWorkoutId) {
      ({ error } = await supabase
        .from('workouts')
        .update(workoutData)
        .eq('id', editingWorkoutId));
      if (!error) {
        setMessage('Workout updated successfully!');
        setEditingWorkoutId(null);
      }
    } else {
      // New workout — route through backend to enforce free-tier limit
      try {
        const res = await fetch(`${API_BASE}/workouts/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workoutData),
        });
        if (res.status === 403) {
          triggerUpgrade('workouts');
          return;
        }
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt);
        }
        posthog.capture('workout_logged', { exercise_count: exercises.length });
        setMessage('Workout saved successfully!');
      } catch (err) {
        console.error('Save error:', err);
        setMessage(`Error saving workout: ${err.message}`);
        return;
      }
    }

    if (error) {
      console.error('Save error:', error);
      setMessage(`Error saving workout: ${error.message}`);
    } else {
      // If loaded from a template, update use_count and weights
      if (loadedTemplateId) {
        incrementTemplateUseCount(loadedTemplateId);
        updateTemplateWeights(loadedTemplateId, exercises);
        fetchTemplates();
      }
      // Reset form and refresh history
      setWorkoutName('');
      setMuscleGroup('');
      setExercises([]);
      setFormOpen(false);
      setLoadedTemplateName(null);
      setLoadedTemplateId(null);
      fetchWorkouts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ── Session timer ──────────────────────────
  useEffect(() => {
    if (!sessionStartTime) return;
    const interval = setInterval(() => {
      setSessionTimer(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  /* ── Restore active session on mount ──
     If the user navigated away and came back (or refreshed the tab)
     while a workout was in progress, re-hydrate the session state
     from localStorage. Only run once per user-id so we don't clobber
     the user's current work if they switch between tabs. */
  const restoredOnceRef = useRef(false);
  useEffect(() => {
    if (!userId || restoredOnceRef.current) return;
    const snap = readActiveWorkout(userId);
    if (!snap) {
      restoredOnceRef.current = true;
      return;
    }
    restoredOnceRef.current = true;
    // Re-hydrate. start time persists as ISO string; convert back to ms.
    const startMs = snap.session_start_time
      ? new Date(snap.session_start_time).getTime()
      : Date.now();
    setSessionExercises(
      Array.isArray(snap.session_exercises)
        ? snap.session_exercises.map(hydrateExerciseItems)
        : [],
    );
    setSessionName(snap.session_name || '');
    setSessionMuscleGroup(snap.session_muscle_group || '');
    setSessionNotes(snap.session_notes || '');
    setSessionTimer(Math.floor((Date.now() - startMs) / 1000));
    setSessionStartTime(startMs);
    setCompletedSets(snap.completed_sets || {});
    setMobileView('session');
  }, [userId]);

  /* ── Persist active session to localStorage ──
     Save a fresh snapshot whenever any piece of the session changes.
     We also heartbeat every 30s so the `updated_at` timestamp stays
     current and the 4-hour freshness window doesn't expire on a long
     workout where the user is just tapping Check for set completion. */
  useEffect(() => {
    if (!userId) return;
    if (mobileView !== 'session' || !sessionStartTime) return;

    const write = () => {
      saveActiveWorkout({
        user_id: userId,
        session_name: sessionName,
        session_muscle_group: sessionMuscleGroup,
        session_exercises: sessionExercises,
        session_timer: Math.floor((Date.now() - sessionStartTime) / 1000),
        session_start_time: new Date(sessionStartTime).toISOString(),
        session_notes: sessionNotes,
        completed_sets: completedSets,
        mobile_view: mobileView,
      });
    };

    // Immediate write on state change
    write();
    // Heartbeat so long idle stretches don't age out of the recovery window
    const heartbeat = setInterval(write, 30000);
    return () => clearInterval(heartbeat);
  }, [
    userId,
    mobileView,
    sessionStartTime,
    sessionName,
    sessionMuscleGroup,
    sessionExercises,
    sessionNotes,
    completedSets,
  ]);

  // ── iOS keyboard offset (visualViewport API) ──
  useEffect(() => {
    if (!window.visualViewport) return;
    const handleResize = () => {
      const kbHeight = window.innerHeight - window.visualViewport.height;
      document.documentElement.style.setProperty('--keyboard-height', `${kbHeight}px`);
    };
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    return () => {
      window.visualViewport.removeEventListener('resize', handleResize);
      window.visualViewport.removeEventListener('scroll', handleResize);
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    };
  }, []);

  /* Scroll focused input into view above keyboard, and auto-select any
     existing value so the user can type directly over it rather than
     manually positioning the caret. iOS sometimes overrides the initial
     select() with its tap-caret placement, so we re-apply it in a 0ms
     timeout after the native focus event settles. */
  const handleInputFocus = useCallback((e) => {
    const target = e && e.target;
    if (target && typeof target.select === 'function') {
      try { target.select(); } catch { /* noop */ }
      setTimeout(() => {
        try { target.select(); } catch { /* noop */ }
      }, 0);
    }
    setTimeout(() => {
      const el = document.activeElement;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, []);

  // ── Dismiss keyboard on tap outside inputs ──
  const dismissKeyboard = useCallback((e) => {
    if (e.target === e.currentTarget) {
      document.activeElement?.blur();
    }
  }, []);

  /* Lock page scroll while the exercise-search sheet is open so the
     sheet opens at the top (not scrolled to wherever the session was
     scrolled). We also scroll the window to 0 so iOS reveals the
     fresh sheet's search bar instead of the page's prior position. */
  useEffect(() => {
    if (!exerciseSearchOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = prev;
    };
  }, [exerciseSearchOpen]);

  // ── Blur input on Enter (numeric keyboard "Done") ──
  const handleInputKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === 'Done') {
      e.currentTarget.blur();
    }
  }, []);

  /* iOS fallback: the focus-select is sometimes overwritten by the
     native tap-caret placement. Re-selecting on click ensures the
     entire value stays highlighted so the user's next keystroke
     replaces the digits. */
  const handleInputClick = useCallback((e) => {
    const el = e.currentTarget;
    if (el && typeof el.select === 'function') {
      try { el.select(); } catch { /* noop */ }
    }
  }, []);

  // ── Mobile helper functions ───────────────
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const rm = m % 60;
      return `${h}h ${rm}m`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const startBlankSession = () => {
    setSessionExercises([]);
    setSessionName('');
    setSessionMuscleGroup('');
    setSessionNotes('');
    setCompletedSets({});
    setSessionStartTime(Date.now());
    setSessionTimer(0);
    setSessionFromTemplateId(null);
    setMobileView('session');
  };

  const startSessionFromTemplate = (template) => {
    const exs = (template.exercises || []).map((ex) => {
      const cardio = isCardioExercise(ex);
      const hydrateCardioSet = (s) => ({
        _setId: newSetId(),
        duration: s.duration ?? (s.duration_seconds != null ? String(Math.round(s.duration_seconds / 60)) : ''),
        durationUnit: s.durationUnit || 'min',
        speed: s.speed ?? (s.speed_mph != null ? String(s.speed_mph) : ''),
        speedUnit: s.speedUnit || 'mph',
        distance: s.distance ?? (s.distance_miles != null ? String(s.distance_miles) : ''),
        distanceUnit: s.distanceUnit || 'mi',
        distanceShown: !!s.distanceShown || s.distance_miles != null,
        notes: '',
      });
      return hydrateExerciseItems({
        _id: newExId(),
        name: ex.name,
        isCardio: cardio || undefined,
        bodyPart: ex.bodyPart,
        sets: Array.isArray(ex.sets)
          ? ex.sets.map((s) =>
              cardio
                ? hydrateCardioSet(s)
                : { _setId: newSetId(), weight: s.weight || '', reps: s.reps || '', notes: '' },
            )
          : Array.from({ length: ex.sets || 3 }, () =>
              cardio
                ? { _setId: newSetId(), duration: '', durationUnit: 'min', speed: '', speedUnit: 'mph', distance: '', distanceUnit: 'mi', distanceShown: false, notes: '' }
                : { _setId: newSetId(), weight: ex.weight || '', reps: ex.reps || '', notes: '' },
            ),
      });
    });
    setSessionExercises(exs);
    setSessionName(template.name);
    setSessionMuscleGroup(template.muscle_group || '');
    setSessionNotes('');
    setCompletedSets({});
    setSessionStartTime(Date.now());
    setSessionTimer(0);
    setSessionFromTemplateId(template.id);
    setSessionOriginalTemplate(template);
    setTemplatePreview(null);
    setMobileView('session');
  };

  const addExerciseToSession = (exercise) => {
    const cardio =
      exercise?.isCardio === true ||
      exercise?.bodyPart === 'cardio' ||
      CARDIO_NAME_SET.has((exercise?.name || '').toLowerCase().trim());
    const blankSet = cardio
      ? { _setId: newSetId(), duration: '', durationUnit: 'min', speed: '', speedUnit: 'mph', distance: '', distanceUnit: 'mi', distanceShown: false, notes: '' }
      : { _setId: newSetId(), weight: '', reps: '', notes: '' };
    setSessionExercises((prev) => [
      ...prev,
      hydrateExerciseItems({
        _id: newExId(),
        name: exercise.name,
        isCardio: cardio || undefined,
        bodyPart: exercise?.bodyPart,
        sets: [blankSet],
      }),
    ]);
    setExerciseSearchOpen(false);
    setExerciseSearchQuery('');
    if (cardio) setSessionMuscleGroup((prev) => prev || 'Cardio');
  };

  /* Drag-to-reorder handler. Because completedSets is keyed by the
     old exercise index (`${exIdx}-${setIdx}`), we remap those keys to
     the new indexes using each row's stable `_id`. */
  const handleReorderExercises = (newOrder) => {
    const newIndexById = new Map(newOrder.map((ex, i) => [ex._id, i]));
    setCompletedSets((prev) => {
      const remapped = {};
      Object.entries(prev).forEach(([key, val]) => {
        const [ei, si] = key.split('-').map(Number);
        const oldEx = sessionExercises[ei];
        if (!oldEx) return;
        const newEi = newIndexById.get(oldEx._id);
        if (newEi != null) remapped[`${newEi}-${si}`] = val;
      });
      return remapped;
    });
    setSessionExercises(newOrder);
  };

  const addSetToSession = (exIdx) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exIdx];
      const cardio = isCardioExercise(ex);
      // Inherit unit preferences from the last set so the user doesn't
      // have to re-toggle km/h or km for each interval.
      const lastSet = (ex.sets && ex.sets[ex.sets.length - 1]) || {};
      const newId = newSetId();
      const blankSet = cardio
        ? {
            _setId: newId,
            duration: '',
            durationUnit: lastSet.durationUnit || 'min',
            speed: '',
            speedUnit: lastSet.speedUnit || 'mph',
            distance: '',
            distanceUnit: lastSet.distanceUnit || 'mi',
            distanceShown: !!lastSet.distanceShown,
            notes: '',
          }
        : { _setId: newId, weight: '', reps: '', notes: '' };
      updated[exIdx] = {
        ...ex,
        sets: [...ex.sets, blankSet],
        items: [...(ex.items || []), { kind: 'set', setId: newId }],
      };
      return updated;
    });
  };

  const removeSessionSet = (exIdx, setIdx) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exIdx];
      if (!ex) return prev;
      const targetSet = ex.sets[setIdx];
      const nextSets = ex.sets.filter((_, i) => i !== setIdx);
      const nextItems = (ex.items || []).filter(
        (it) => !(it.kind === 'set' && targetSet && it.setId === targetSet._setId),
      );
      updated[exIdx] = { ...ex, sets: nextSets, items: nextItems };
      return updated;
    });
    setCompletedSets((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        const [ei, si] = key.split('-').map(Number);
        if (ei !== exIdx) { next[key] = prev[key]; return; }
        if (si < setIdx) next[key] = prev[key];
        else if (si > setIdx) next[`${ei}-${si - 1}`] = prev[key];
      });
      return next;
    });
  };

  /* Reorder the items manifest (sets + rest rows) within a single
     exercise. Set positions in `ex.sets` don't change — only the
     render order in `items` does. The completedSets map keys by
     set-index into `ex.sets`, which stays stable, so no remap. */
  const reorderSessionItems = (exIdx, newItems) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exIdx];
      if (!ex) return prev;
      updated[exIdx] = { ...ex, items: newItems };
      return updated;
    });
  };

  /* Remove a single rest row from the items manifest. Sets are
     removed via removeSessionSet, not this. */
  const removeRestItem = (exIdx, itemId) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exIdx];
      if (!ex) return prev;
      updated[exIdx] = {
        ...ex,
        items: (ex.items || []).filter((it) => !(it.kind === 'rest' && it.id === itemId)),
      };
      return updated;
    });
  };

  const updateSessionSet = (exIdx, setIdx, field, value) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      updated[exIdx] = { ...updated[exIdx], sets: [...updated[exIdx].sets] };
      updated[exIdx].sets[setIdx] = { ...updated[exIdx].sets[setIdx], [field]: value };
      return updated;
    });
  };

  const toggleSetComplete = (exIdx, setIdx) => {
    const key = `${exIdx}-${setIdx}`;
    setCompletedSets((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  };

  const removeSessionExercise = (exIdx) => {
    setSessionExercises((prev) => prev.filter((_, i) => i !== exIdx));
    setCompletedSets((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        const [ei, si] = key.split('-').map(Number);
        if (ei < exIdx) next[key] = true;
        if (ei > exIdx) next[`${ei - 1}-${si}`] = true;
      });
      return next;
    });
  };

  /* Writes `notes` onto a specific exercise in the active session.
     Stored inline in the `workouts.exercises` JSONB object alongside
     sets, so no schema migration is needed. */
  const setSessionExerciseNotes = (exIdx, notes) => {
    setSessionExercises((prev) => {
      const next = [...prev];
      if (!next[exIdx]) return prev;
      const trimmed = (notes || '').toString();
      next[exIdx] = { ...next[exIdx], notes: trimmed };
      return next;
    });
  };

  /* Shared 1 Hz ticker. Only runs while the session has at least one
     active-but-unfired rest row, so idle sessions don't re-render
     every second. Each rest row computes its own `remaining` from
     wall clock (Date.now() - startedAt) on render, which is
     drift-free and survives tab-backgrounding. */
  const hasActiveRest = useMemo(
    () =>
      sessionExercises.some((ex) =>
        (ex.items || []).some(
          (it) =>
            it.kind === 'rest' &&
            it.startedAt &&
            !it.notified &&
            Date.now() - it.startedAt < it.durationSec * 1000,
        ),
      ),
    [sessionExercises],
  );
  useEffect(() => {
    if (!hasActiveRest) return;
    const id = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [hasActiveRest]);

  /* Fires the haptic + toast side effect once per rest when its
     countdown first crosses 0. The `notified` flag is flipped on the
     rest item so the effect doesn't re-fire on every tick. */
  useEffect(() => {
    let fired = false;
    setSessionExercises((prev) => {
      let changed = false;
      const next = prev.map((ex) => {
        if (!Array.isArray(ex.items)) return ex;
        let exChanged = false;
        const nextItems = ex.items.map((it) => {
          if (it.kind !== 'rest' || !it.startedAt || it.notified) return it;
          const elapsedMs = Date.now() - it.startedAt;
          if (elapsedMs >= it.durationSec * 1000) {
            exChanged = true;
            changed = true;
            if (!fired) {
              fired = true;
              if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                try { navigator.vibrate(200); } catch { /* noop */ }
              }
              try { toast.success('Rest complete'); } catch { /* noop */ }
            }
            return { ...it, notified: true };
          }
          return it;
        });
        return exChanged ? { ...ex, items: nextItems } : ex;
      });
      return changed ? next : prev;
    });
    // Intentionally depends on sessionExercises so a freshly-inserted
    // rest that completes quickly (e.g. a leftover from restore) also
    // gets checked on mount, not only on tick.
  }, [sessionExercises]);

  /* Inserts a fresh rest row into an exercise's items manifest. The
     insert position is right after the last completed set (falls back
     to end of list). Marking `startedAt` immediately means the
     countdown begins the moment the user picks a duration. */
  const startRestTimer = (exIdx, seconds) => {
    const secs = Math.max(5, Math.min(60 * 60, Math.round(seconds)));
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exIdx];
      if (!ex) return prev;
      const items = Array.isArray(ex.items) ? [...ex.items] : [];
      // Find insert position: after the last completed set in this
      // exercise, or end of list if none completed yet.
      let insertAt = items.length;
      const completedIndices = [];
      Object.keys(completedSets).forEach((k) => {
        const [ei, si] = k.split('-').map(Number);
        if (ei === exIdx) completedIndices.push(si);
      });
      if (completedIndices.length) {
        const lastCompletedSetIdx = Math.max(...completedIndices);
        const lastCompletedSet = ex.sets[lastCompletedSetIdx];
        if (lastCompletedSet) {
          const pos = items.findIndex(
            (it) => it.kind === 'set' && it.setId === lastCompletedSet._setId,
          );
          if (pos >= 0) insertAt = pos + 1;
        }
      }
      const restRow = {
        kind: 'rest',
        id: newRestId(),
        durationSec: secs,
        startedAt: Date.now(),
        notified: false,
      };
      items.splice(insertAt, 0, restRow);
      updated[exIdx] = { ...ex, items };
      return updated;
    });
    setRestPickerExIdx(null);
    setExerciseMenu(null);
  };

  const finishSession = async () => {
    /* Ref+state guard: the confirmation sheet routes users through
       an explicit "Finish workout" tap, but we still guard against
       double-submits if the button is pressed twice in quick succession. */
    if (finishInFlight.current) return;
    if (sessionExercises.length === 0) {
      toast.error('Add at least one exercise before finishing.');
      return;
    }
    finishInFlight.current = true;
    setIsFinishing(true);
    // Blur any focused input so iOS dismisses the keyboard predictably
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const name = sessionName.trim() || 'Quick Workout';
    const duration = sessionTimer;
    const trimmedNotes = sessionNotes.trim();
    /* Normalize sets on save — cardio intervals emit canonical
       duration_seconds / speed_mph / distance_miles (unit-converted)
       so downstream consumers (history, progress chart) never have to
       re-read the unit pills. Non-cardio sets pass through unchanged. */
    const normalizedExercises = sessionExercises.map((ex) => {
      if (!isCardioExercise(ex)) return ex;
      return {
        ...ex,
        isCardio: true,
        sets: (ex.sets || []).map((s) => {
          const duration_seconds = toSeconds(s.duration, s.durationUnit || 'min');
          const speed_mph = toMph(s.speed, s.speedUnit || 'mph');
          const distance_miles = s.distanceShown
            ? toMiles(s.distance, s.distanceUnit || 'mi')
            : null;
          return {
            duration_seconds,
            speed_mph,
            distance_miles,
            // Preserve the raw user-entered values and unit selections
            // so editing a saved workout later can restore the pills.
            duration: s.duration ?? '',
            durationUnit: s.durationUnit || 'min',
            speed: s.speed ?? '',
            speedUnit: s.speedUnit || 'mph',
            distance: s.distance ?? '',
            distanceUnit: s.distanceUnit || 'mi',
            distanceShown: !!s.distanceShown,
            notes: s.notes || '',
          };
        }),
      };
    });
    const workoutData = {
      user_id: userId,
      workout_date: getLocalDateString(),
      workout_name: name,
      muscle_group: sessionMuscleGroup || null,
      exercises: normalizedExercises,
      notes: trimmedNotes ? trimmedNotes : null,
    };
    try {
      // ── Main save — this is the only await that gates navigation ──
      let savedWorkoutId = null;
      if (resumedFromWorkoutId) {
        // Resumed workout → overwrite the existing row instead of
        // inserting a new one. Skips the free-tier limit check
        // because the row already exists (not a new log).
        const { error: updErr } = await supabase
          .from('workouts')
          .update({
            workout_date: workoutData.workout_date,
            workout_name: workoutData.workout_name,
            muscle_group: workoutData.muscle_group,
            exercises: workoutData.exercises,
            notes: workoutData.notes,
          })
          .eq('id', resumedFromWorkoutId);
        if (updErr) throw new Error(updErr.message || 'Failed to update workout');
        savedWorkoutId = resumedFromWorkoutId;
      } else {
        const res = await fetch(`${API_BASE}/workouts/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workoutData),
        });
        if (res.status === 403) { triggerUpgrade('workouts'); finishInFlight.current = false; setIsFinishing(false); return; }
        if (!res.ok) throw new Error(await res.text());
        const saved = await res.json().catch(() => null);
        savedWorkoutId = saved?.id || null;
      }

      // Fire analytics in the background — do not gate navigation on it
      posthog.capture('workout_logged', { exercise_count: sessionExercises.length, duration_seconds: duration });

      // Template bookkeeping — all writes fire in parallel in the background.
      // Use Promise.all so we don't pay N sequential round-trips.
      let showUpdateSheet = null;
      let showAutoUpdateToast = false;
      if (sessionFromTemplateId && sessionOriginalTemplate) {
        const templatePref = localStorage.getItem('template_auto_update') || 'ask';
        const changes = detectTemplateChanges(sessionExercises, sessionOriginalTemplate);
        const bgWrites = [incrementTemplateUseCount(sessionFromTemplateId)];

        if (changes.length > 0 && templatePref === 'always') {
          bgWrites.push(updateTemplateWeights(sessionFromTemplateId, sessionExercises));
          showAutoUpdateToast = true;
        } else if (changes.length > 0 && templatePref === 'ask') {
          const exerciseData = sessionExercises.map((ex) => ({
            name: ex.name,
            sets: (ex.sets || []).map((s, idx) => ({
              set_number: idx + 1,
              weight: s.weight || '',
              reps: s.reps || '',
            })),
          }));
          showUpdateSheet = {
            templateId: sessionFromTemplateId,
            templateName: sessionOriginalTemplate.name,
            changes,
            exerciseData,
          };
        }

        // Fire all template writes in parallel, then refresh the list —
        // all detached from the main path so the user navigates instantly.
        Promise.all(bgWrites)
          .then(() => fetchTemplates())
          .catch((err) => console.error('Template bg write failed:', err));
      }

      // ── Navigate immediately — before list refetches complete ──
      toast.success(`${name} saved! ${formatDuration(duration)}`);
      if (showAutoUpdateToast) toast.success('Template updated automatically');
      if (showUpdateSheet) setTemplateUpdateSheet(showUpdateSheet);
      setMobileView('home');
      setSessionStartTime(null);
      setSessionOriginalTemplate(null);
      setSessionNotes('');
      setEndWorkoutConfirm(false);
      setResumedFromWorkoutId(null);
      // Stash a recent-finish marker so the 10-minute Resume card
      // appears on the home view. We only persist the id + time; the
      // actual workout data is re-fetched from supabase on resume so
      // we always hydrate from the source of truth.
      if (savedWorkoutId) {
        const marker = { workout_id: savedWorkoutId, finished_at: Date.now() };
        try {
          window.localStorage.setItem(RECENT_FINISH_KEY, JSON.stringify(marker));
        } catch { /* ignore */ }
        setRecentFinish(marker);
      }
      // Session done — drop the recovery snapshot so the banner/
      // indicator clear immediately on return to the home view.
      clearActiveWorkout();
      // Workout list refresh runs in the background — the home view
      // will update when it returns; we don't block navigation on it.
      fetchWorkouts();
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      finishInFlight.current = false;
      setIsFinishing(false);
    }
  };

  /* Actually clear the in-progress session. Called directly for the
     no-exercises fast-path and from the discard-confirm modal. */
  const performDiscard = () => {
    setMobileView('home');
    setSessionStartTime(null);
    setSessionExercises([]);
    setCompletedSets({});
    setSessionOriginalTemplate(null);
    setSessionNotes('');
    setResumedFromWorkoutId(null);
    clearActiveWorkout();
    setDiscardConfirm(false);
  };

  const discardSession = () => {
    /* No exercises yet = nothing to lose; skip the confirm entirely so
       the user isn't nagged after tapping "New workout" by mistake. */
    if (sessionExercises.length === 0) {
      performDiscard();
      return;
    }
    setDiscardConfirm(true);
  };

  /* Dismiss the 10-minute Resume card without resuming. */
  const clearRecentFinish = useCallback(() => {
    try { window.localStorage.removeItem(RECENT_FINISH_KEY); } catch { /* ignore */ }
    setRecentFinish(null);
  }, []);

  /* Resume a just-finished workout. We hydrate session state from
     the saved row and set `resumedFromWorkoutId` so the next
     finishSession UPDATES that row instead of inserting a new one. */
  const resumeLastWorkout = useCallback(() => {
    if (!recentFinish?.workout_id) return;
    const w = workoutHistory.find((x) => x.id === recentFinish.workout_id);
    if (!w) {
      toast.error("Couldn't find that workout — it may have been deleted.");
      clearRecentFinish();
      return;
    }
    // Attach stable _id so the Reorder.Item keys stay consistent.
    // Rests are not restored into a resumed workout — we rebuild items
    // fresh from sets only (see hydrateExerciseItems).
    const exs = (w.exercises || []).map((ex) => {
      const cardio = isCardioExercise(ex);
      return hydrateExerciseItems({
        _id: newExId(),
        name: ex.name,
        isCardio: cardio || undefined,
        bodyPart: ex.bodyPart,
        items: undefined,
        sets: Array.isArray(ex.sets)
          ? ex.sets.map((s) =>
              cardio
                ? {
                    _setId: newSetId(),
                    duration: s.duration ?? (s.duration_seconds != null ? String(Math.round(s.duration_seconds / 60)) : ''),
                    durationUnit: s.durationUnit || 'min',
                    speed: s.speed ?? (s.speed_mph != null ? String(s.speed_mph) : ''),
                    speedUnit: s.speedUnit || 'mph',
                    distance: s.distance ?? (s.distance_miles != null ? String(s.distance_miles) : ''),
                    distanceUnit: s.distanceUnit || 'mi',
                    distanceShown: !!s.distanceShown || s.distance_miles != null,
                    notes: s.notes || '',
                  }
                : {
                    _setId: newSetId(),
                    weight: s.weight || '',
                    reps: s.reps || '',
                    notes: s.notes || '',
                  },
            )
          : [cardio
              ? { _setId: newSetId(), duration: '', durationUnit: 'min', speed: '', speedUnit: 'mph', distance: '', distanceUnit: 'mi', distanceShown: false, notes: '' }
              : { _setId: newSetId(), weight: '', reps: '', notes: '' }],
      });
    });
    setSessionExercises(exs);
    setSessionName(w.workout_name || '');
    setSessionMuscleGroup(w.muscle_group || '');
    setSessionNotes(w.notes || '');
    setCompletedSets({});
    setSessionStartTime(Date.now());
    setSessionTimer(0);
    setSessionFromTemplateId(null);
    setSessionOriginalTemplate(null);
    setResumedFromWorkoutId(w.id);
    setMobileView('session');
    // Keep the Resume marker until the workout is re-finished —
    // if the user backs out without finishing, they still have the
    // Resume card available.
  }, [recentFinish, workoutHistory, clearRecentFinish]);

  /* True when the most recent finish is < RESUME_WINDOW_MS old AND
     the workout row is still in history (so deleted workouts won't
     leave a phantom Resume card). */
  const showResumeCard = useMemo(() => {
    if (!recentFinish?.finished_at || !recentFinish?.workout_id) return false;
    if (Date.now() - recentFinish.finished_at > RESUME_WINDOW_MS) return false;
    return workoutHistory.some((w) => w.id === recentFinish.workout_id);
  }, [recentFinish, workoutHistory]);

  /* Auto-expire the marker so the card disappears without needing
     the user to dismiss it. We only need one timer ticking because
     the card is either visible or it isn't. */
  useEffect(() => {
    if (!recentFinish?.finished_at) return;
    const remaining = RESUME_WINDOW_MS - (Date.now() - recentFinish.finished_at);
    if (remaining <= 0) {
      clearRecentFinish();
      return;
    }
    const t = setTimeout(clearRecentFinish, remaining);
    return () => clearTimeout(t);
  }, [recentFinish, clearRecentFinish]);

  /* Live countdown for the Resume card subtext ("You can resume your
     workout for the next X minutes"). Ticks every 15s — any finer and
     we re-render the home view unnecessarily. Only runs while the
     card is actually visible. */
  const [resumeMinutesLeft, setResumeMinutesLeft] = useState(() => {
    if (!recentFinish?.finished_at) return 0;
    return Math.max(0, Math.ceil((RESUME_WINDOW_MS - (Date.now() - recentFinish.finished_at)) / 60000));
  });
  useEffect(() => {
    if (!showResumeCard || !recentFinish?.finished_at) return;
    const tick = () => {
      const remMs = RESUME_WINDOW_MS - (Date.now() - recentFinish.finished_at);
      setResumeMinutesLeft(Math.max(0, Math.ceil(remMs / 60000)));
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [showResumeCard, recentFinish]);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'template') {
      await deleteTemplate(confirmDelete.id);
      if (templatePreview?.id === confirmDelete.id) setTemplatePreview(null);
      toast.success(`${confirmDelete.name} deleted`);
    } else {
      await deleteWorkout(confirmDelete.id);
      if (workoutDetailSheet?.id === confirmDelete.id) setWorkoutDetailSheet(null);
      toast.success('Workout deleted');
    }
    setConfirmDelete(null);
  };

  // ── Exercise search data ──────────────────
  const bodyParts = useMemo(() => {
    const parts = new Set(exerciseDB.map((ex) => ex.bodyPart));
    return ['all', ...Array.from(parts).sort()];
  }, []);

  const filteredExercises = useMemo(() => {
    let list = exerciseDB;
    if (exerciseBodyPartFilter !== 'all') {
      list = list.filter((ex) => ex.bodyPart === exerciseBodyPartFilter);
    }
    if (exerciseSearchQuery.trim()) {
      const q = exerciseSearchQuery.toLowerCase().trim();
      list = list.filter((ex) => ex.name.toLowerCase().includes(q));
    }
    return list;
  }, [exerciseSearchQuery, exerciseBodyPartFilter]);

  const groupedExercises = useMemo(() => {
    const groups = {};
    filteredExercises.forEach((ex) => {
      const letter = ex.name[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(ex);
    });
    return groups;
  }, [filteredExercises]);

  // Load a workout from history into the editor
  const editWorkout = (workout) => {
    setWorkoutDate(workout.workout_date);
    setWorkoutName(workout.workout_name);
    setMuscleGroup(workout.muscle_group || '');
    setExercises(workout.exercises || []);
    setEditingWorkoutId(workout.id);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMessage('Editing workout...');
  };

  // Expand/collapse a workout in the history list
  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const WORKOUT_LIMIT = 7;
  const atLimit = !isPro && workoutHistory.length >= WORKOUT_LIMIT;
  const nearLimit = !isPro && workoutHistory.length >= 5 && workoutHistory.length < WORKOUT_LIMIT;

  return (
    <div className="wl">

      {/* ═══════════ DESKTOP ═══════════ */}
      <div className="wl-desktop">

      {/* ── LOG SECTION ── */}
      <motion.div
        className="wl-log-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* Header row: title + expand toggle */}
        <div className="wl-log-header">
          <div>
            <p className="wl-section-title">Log a workout</p>
            {!isPro && workoutHistory.length > 0 && (
              <p style={{
                fontSize: 11,
                color: nearLimit || atLimit ? '#EF9F27' : 'var(--text-muted)',
                margin: '2px 0 0',
              }}>
                {workoutHistory.length} / {WORKOUT_LIMIT} free workout logs used
              </p>
            )}
          </div>
          {!atLimit && (
            <motion.button
              className="btn btn-primary wl-toggle-btn"
              onClick={() => setFormOpen((o) => !o)}
              whileTap={{ scale: 0.97 }}
              style={isSpectrum ? { border: '1px solid #1D9E75', color: '#5DCAA5', background: '#0a1a0f' } : undefined}
            >
              {formOpen ? 'Cancel' : '+ New workout'}
            </motion.button>
          )}
        </div>

        {/* Locked banner when free user hits limit */}
        {atLimit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0 4px' }}>
            <Lock size={16} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                You've reached {WORKOUT_LIMIT} workout logs on the free plan.
              </p>
              <button
                onClick={() => triggerUpgrade('workouts')}
                style={{ fontSize: 12, color: 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4, textDecoration: 'underline' }}
              >
                Upgrade to Pro for unlimited logging
              </button>
            </div>
          </div>
        )}

        {/* Collapsible form */}
        <AnimatePresence initial={false}>
          {formOpen && (
            <motion.div
              key="log-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="wl-form-inner" ref={formRef}>
                {/* ── Template picker row ──────────── */}
                {!editingWorkoutId && (
                  <div className="wl-template-picker">
                    <span className="wl-template-picker__label">Start from template:</span>
                    {templates.length === 0 ? (
                      <span className="wl-template-picker__empty">No templates yet — save a workout from History first</span>
                    ) : (
                      <div className="wl-template-picker__chips">
                        {templates.map((t) => (
                          <motion.button
                            key={t.id}
                            className="wl-template-chip"
                            onClick={() => loadTemplate(t)}
                            whileTap={{ scale: 0.95 }}
                          >
                            {t.name}
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Loaded from template banner */}
                {loadedTemplateName && (
                  <div className="wl-template-banner">
                    <BookmarkCheck size={12} />
                    <span>Loaded from <strong>{loadedTemplateName}</strong> template — edit as needed</span>
                    <button className="wl-template-banner__dismiss" onClick={() => setLoadedTemplateName(null)}>
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Date + Name row */}
                <div className="wl-top-row">
                  <div className="wl-field">
                    <label className="wl-label">Date</label>
                    <input
                      type="date"
                      className="input"
                      value={workoutDate}
                      onChange={(e) => setWorkoutDate(e.target.value)}
                    />
                  </div>
                  <div className="wl-field wl-field--grow">
                    <label className="wl-label">Workout name</label>
                    <input
                      type="text"
                      className="input"
                      value={workoutName}
                      onChange={(e) => setWorkoutName(e.target.value)}
                      placeholder="e.g. Push Day, Lower Body, Full Body"
                    />
                  </div>
                </div>

                {/* Muscle group selector */}
                <div className="wl-field">
                  <label className="wl-label">Muscle group</label>
                  <div className="wl-mg-pills">
                    {MUSCLE_GROUPS.map((g) => (
                      <motion.button
                        key={g}
                        type="button"
                        className={`wl-mg-pill ${muscleGroup === g ? 'wl-mg-pill--active' : ''}`}
                        onClick={() => setMuscleGroup(muscleGroup === g ? '' : g)}
                        whileTap={{ scale: 0.95 }}
                      >
                        {g}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Exercise blocks */}
                {exercises.map((ex, i) => {
                  const cardio = isCardioExercise(ex);
                  return (
                  <motion.div
                    key={i}
                    className={`wl-exercise-block ${cardio ? 'wl-exercise-block--cardio' : ''}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="wl-exercise-header">
                      <span className="wl-exercise-name">
                        {ex.name}
                        {cardio && <span className="wlm-ex-block__cardio-badge" style={{ marginLeft: 8 }}>CARDIO</span>}
                      </span>
                      <motion.button
                        className="btn btn-destructive"
                        onClick={() => deleteExercise(i)}
                        whileTap={{ scale: 0.97 }}
                      >
                        Remove
                      </motion.button>
                    </div>

                    {cardio ? (
                      <div className="wl-cardio-sets">
                        {ex.sets.map((set, j) => {
                          const durationUnit = set.durationUnit || 'min';
                          const speedUnit = set.speedUnit || 'mph';
                          const distanceUnit = set.distanceUnit || 'mi';
                          const distanceShown = !!set.distanceShown || (set.distance != null && set.distance !== '');
                          return (
                            <div key={j} className="wl-cardio-row">
                              <span className="wl-set-num">Interval {j + 1}</span>
                              <div className="wlm-cardio-field wl-cardio-field">
                                <label className="wlm-cardio-field__label">Time</label>
                                <div className="wlm-cardio-field__input-wrap">
                                  <input type="number" inputMode="decimal" className="wlm-cardio-field__input" value={set.duration ?? ''}
                                    onFocus={handleInputFocus} onClick={handleInputClick}
                                    onChange={(e) => handleSetChange(i, j, 'duration', e.target.value)} placeholder="30" />
                                  <div className="wlm-cardio-unit">
                                    <button type="button" className={`wlm-cardio-unit__pill ${durationUnit === 'min' ? 'wlm-cardio-unit__pill--active' : ''}`} onClick={() => handleSetChange(i, j, 'durationUnit', 'min')}>min</button>
                                    <button type="button" className={`wlm-cardio-unit__pill ${durationUnit === 'sec' ? 'wlm-cardio-unit__pill--active' : ''}`} onClick={() => handleSetChange(i, j, 'durationUnit', 'sec')}>sec</button>
                                  </div>
                                </div>
                              </div>
                              <div className="wlm-cardio-field wl-cardio-field">
                                <label className="wlm-cardio-field__label">Speed</label>
                                <div className="wlm-cardio-field__input-wrap">
                                  <input type="number" inputMode="decimal" step="0.1" className="wlm-cardio-field__input" value={set.speed ?? ''}
                                    onFocus={handleInputFocus} onClick={handleInputClick}
                                    onChange={(e) => handleSetChange(i, j, 'speed', e.target.value)} placeholder="6.5" />
                                  <div className="wlm-cardio-unit">
                                    <button type="button" className={`wlm-cardio-unit__pill ${speedUnit === 'mph' ? 'wlm-cardio-unit__pill--active' : ''}`} onClick={() => handleSetChange(i, j, 'speedUnit', 'mph')}>mph</button>
                                    <button type="button" className={`wlm-cardio-unit__pill ${speedUnit === 'kmh' ? 'wlm-cardio-unit__pill--active' : ''}`} onClick={() => handleSetChange(i, j, 'speedUnit', 'kmh')}>km/h</button>
                                  </div>
                                </div>
                              </div>
                              {distanceShown ? (
                                <div className="wlm-cardio-field wl-cardio-field">
                                  <label className="wlm-cardio-field__label">Distance</label>
                                  <div className="wlm-cardio-field__input-wrap">
                                    <input type="number" inputMode="decimal" step="0.01" className="wlm-cardio-field__input" value={set.distance ?? ''}
                                      onFocus={handleInputFocus} onClick={handleInputClick}
                                      onChange={(e) => handleSetChange(i, j, 'distance', e.target.value)} placeholder="3.1" />
                                    <div className="wlm-cardio-unit">
                                      <button type="button" className={`wlm-cardio-unit__pill ${distanceUnit === 'mi' ? 'wlm-cardio-unit__pill--active' : ''}`} onClick={() => handleSetChange(i, j, 'distanceUnit', 'mi')}>mi</button>
                                      <button type="button" className={`wlm-cardio-unit__pill ${distanceUnit === 'km' ? 'wlm-cardio-unit__pill--active' : ''}`} onClick={() => handleSetChange(i, j, 'distanceUnit', 'km')}>km</button>
                                    </div>
                                    <button type="button" className="wlm-cardio-distance-remove" onClick={() => { handleSetChange(i, j, 'distance', ''); handleSetChange(i, j, 'distanceShown', false); }} aria-label="Remove distance">
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" className="wlm-cardio-distance-toggle" onClick={() => handleSetChange(i, j, 'distanceShown', true)}>
                                  + Add distance
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <table className="wl-sets-table">
                        <thead>
                          <tr>
                            <th>Set</th>
                            <th>Weight (lbs)</th>
                            <th>Reps</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ex.sets.map((set, j) => (
                            <tr key={j}>
                              <td className="wl-set-num">{j + 1}</td>
                              <td><input type="number" inputMode="decimal" className="input wl-set-input" value={set.weight} onFocus={handleInputFocus} onClick={handleInputClick} onChange={(e) => handleSetChange(i, j, 'weight', e.target.value)} /></td>
                              <td><input type="number" inputMode="numeric" className="input wl-set-input" value={set.reps}   onFocus={handleInputFocus} onClick={handleInputClick} onChange={(e) => handleSetChange(i, j, 'reps',   e.target.value)} /></td>
                              <td><input type="text"   className="input wl-set-input" value={set.notes}  onChange={(e) => handleSetChange(i, j, 'notes',  e.target.value)} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <motion.button className="btn btn-primary wl-add-set" onClick={() => addSet(i)} whileTap={{ scale: 0.97 }}>
                      {cardio ? '+ Add Interval' : '+ Add Set'}
                    </motion.button>
                  </motion.div>
                  );
                })}

                {/* Add exercise row — placed after exercises so user doesn't scroll back up */}
                <div className="wl-adder">
                  <input
                    type="text"
                    className="input"
                    value={newExercise}
                    onChange={(e) => setNewExercise(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addExercise()}
                    placeholder="Add an exercise…"
                  />
                  <motion.button className="btn btn-primary" onClick={addExercise} whileTap={{ scale: 0.97 }}>
                    Add
                  </motion.button>
                </div>

                {/* Feedback message */}
                {message && <p className="wl-message">{message}</p>}

                {/* Save / Cancel row */}
                <div className="wl-save-row">
                  <motion.button className="btn btn-primary" onClick={saveWorkout} whileTap={{ scale: 0.97 }}>
                    {editingWorkoutId ? 'Update Workout' : 'Save Workout'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── TABS: HISTORY / TEMPLATES ── */}
      <div className="wl-tabs">
        <button
          className={`wl-tabs__tab ${historyTab === 'history' ? 'wl-tabs__tab--active' : ''}`}
          onClick={() => setHistoryTab('history')}
        >
          History
        </button>
        <button
          className={`wl-tabs__tab ${historyTab === 'templates' ? 'wl-tabs__tab--active' : ''}`}
          onClick={() => setHistoryTab('templates')}
        >
          Templates
        </button>
      </div>

      {/* ── HISTORY TAB ── */}
      {historyTab === 'history' && (
        <>
          {workoutHistory.length === 0 && (
            <p className="wl-empty">No workouts logged yet.</p>
          )}

          <div className="wl-history-list">
            {workoutHistory.map((workout, idx) => {
              const isSavedAsTemplate = !!templateNameMap[workout.workout_name];

              return (
                <React.Fragment key={workout.id}>
                  <motion.div
                    className="wl-history-row"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04, ease: 'easeOut' }}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => toggleExpand(workout.id)}
                  >
                    <div className="wl-history-row__left">
                      <div className="wl-history-row__text">
                        <span className="wl-history-name" style={isSpectrum ? { color: '#5DCAA5' } : undefined}>{workout.workout_name}</span>
                        <span className="wl-history-date">{formatDate(workout.workout_date)}</span>
                      </div>
                    </div>
                    <div className="wl-history-row__right">
                      {(workout.exercises || []).length > 0 && (
                        <span className="wl-exercise-count">
                          {`${workout.exercises.length} exercise${workout.exercises.length !== 1 ? 's' : ''}`}
                        </span>
                      )}
                      <motion.button
                        className="btn btn-primary wl-btn-sm"
                        onClick={(e) => { e.stopPropagation(); editWorkout(workout); }}
                        whileTap={{ scale: 0.97 }}
                        style={isSpectrum ? { border: '1px solid #1D9E75', color: '#5DCAA5' } : undefined}
                      >
                        Edit
                      </motion.button>

                      {/* Save / unsave template */}
                      <motion.button
                        className={`wl-btn-sm wl-btn-icon wl-btn-template ${isSavedAsTemplate ? 'wl-btn-template--saved' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSavedAsTemplate) {
                            removeTemplateByName(workout.workout_name);
                          } else {
                            setTemplateName(workout.workout_name);
                            setSaveTemplatePopover(saveTemplatePopover === workout.id ? null : workout.id);
                          }
                        }}
                        whileTap={{ scale: 0.97 }}
                        title={isSavedAsTemplate ? 'Saved as template' : 'Save as template'}
                      >
                        {isSavedAsTemplate ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      </motion.button>

                      {/* Copy to today */}
                      <motion.button
                        className="wl-btn-sm wl-btn-icon wl-btn-copy"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCopyDate(getLocalDateString());
                          setCopyPopover(copyPopover === workout.id ? null : workout.id);
                        }}
                        whileTap={{ scale: 0.97 }}
                        title="Log again today"
                      >
                        <Copy size={14} />
                      </motion.button>

                      <motion.button
                        className="btn btn-destructive wl-btn-sm wl-btn-icon"
                        onClick={(e) => { e.stopPropagation(); deleteWorkout(workout.id); }}
                        whileTap={{ scale: 0.97 }}
                        title="Delete workout"
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </div>
                  </motion.div>

                  {/* Save template popover */}
                  <AnimatePresence>
                    {saveTemplatePopover === workout.id && (
                      <motion.div
                        className="wl-popover"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="wl-popover__inner">
                          <label className="wl-popover__label">Template name</label>
                          <input
                            type="text"
                            className="input wl-popover__input"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder={workout.workout_name}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); saveAsTemplate(workout); } }}
                          />
                          <div className="wl-popover__btns">
                            <button className="wl-popover__btn wl-popover__btn--save" onClick={(e) => { e.stopPropagation(); saveAsTemplate(workout); }}>
                              Save template
                            </button>
                            <button className="wl-popover__btn wl-popover__btn--cancel" onClick={(e) => { e.stopPropagation(); setSaveTemplatePopover(null); }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Copy popover */}
                  <AnimatePresence>
                    {copyPopover === workout.id && (
                      <motion.div
                        className="wl-popover"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="wl-popover__inner">
                          <p className="wl-popover__title">Log <strong>{workout.workout_name}</strong> again?</p>
                          <label className="wl-popover__label">Date</label>
                          <input
                            type="date"
                            className="input wl-popover__input"
                            value={copyDate}
                            onChange={(e) => setCopyDate(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="wl-popover__btns">
                            <button className="wl-popover__btn wl-popover__btn--save" onClick={(e) => { e.stopPropagation(); copyWorkoutToDate(workout); }}>
                              Yes, log it
                            </button>
                            <button className="wl-popover__btn wl-popover__btn--cancel" onClick={(e) => { e.stopPropagation(); setCopyPopover(null); }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expanded exercise detail */}
                  <AnimatePresence>
                    {expanded[workout.id] && (
                      <motion.div
                        className="wl-exercise-detail"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        {workout.notes && workout.notes.trim() && (
                          <p className="wl-history-notes">{workout.notes}</p>
                        )}
                        {workout.exercises?.map((ex, exIdx) => {
                          const cardio = isCardioExercise(ex);
                          return (
                            <div key={exIdx} className="history-exercise">
                              <h4>
                                {ex.name}
                                {cardio && <span className="wlm-ex-block__cardio-badge" style={{ marginLeft: 8 }}>CARDIO</span>}
                              </h4>
                              {cardio ? (
                                <table>
                                  <thead><tr><th>Interval</th><th>Time</th><th>Speed</th><th>Distance</th></tr></thead>
                                  <tbody>
                                    {ex.sets.map((set, j) => {
                                      const mins = set.duration_seconds != null ? Math.round(set.duration_seconds / 60) : null;
                                      const mph = set.speed_mph != null ? +Number(set.speed_mph).toFixed(1) : null;
                                      const mi = set.distance_miles != null ? +Number(set.distance_miles).toFixed(2) : null;
                                      return (
                                        <tr key={j}>
                                          <td>{j + 1}</td>
                                          <td>{mins != null ? `${mins} min` : '—'}</td>
                                          <td>{mph != null ? `${mph} mph` : '—'}</td>
                                          <td>{mi != null ? `${mi} mi` : '—'}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <table>
                                  <thead><tr><th>Set</th><th>Weight</th><th>Reps</th><th>Notes</th></tr></thead>
                                  <tbody>
                                    {ex.sets.map((set, j) => (
                                      <tr key={j}>
                                        <td>{j + 1}</td><td>{set.weight}</td><td>{set.reps}</td><td>{set.notes}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </div>
        </>
      )}

      {/* ── TEMPLATES TAB ── */}
      {historyTab === 'templates' && (
        <>
          {templates.length === 0 ? (
            <div className="wl-templates-empty">
              <BookmarkPlus size={32} style={{ color: 'var(--border-light, #444)' }} />
              <h4 className="wl-templates-empty__title">No templates yet</h4>
              <p className="wl-templates-empty__desc">
                Save any workout from your history as a template to reuse it in one tap.
              </p>
              <p className="wl-templates-empty__hint">
                Click the <Bookmark size={12} style={{ verticalAlign: '-2px' }} /> bookmark icon on any workout in History to save it as a template.
              </p>
            </div>
          ) : (
            <div className="wl-template-list">
              {templates.map((tpl, idx) => (
                <motion.div
                  key={tpl.id}
                  className="wl-tpl-row"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.04 }}
                >
                  <div className="wl-tpl-row__icon">
                    <Dumbbell size={18} />
                  </div>
                  <div className="wl-tpl-row__info">
                    <span className="wl-tpl-row__name">{tpl.name}</span>
                    <span className="wl-tpl-row__meta">
                      {(tpl.exercises || []).length} exercise{(tpl.exercises || []).length !== 1 ? 's' : ''}
                      {tpl.muscle_group ? ` · ${tpl.muscle_group}` : ''}
                      {tpl.use_count > 0 ? ` · Used ${tpl.use_count} time${tpl.use_count !== 1 ? 's' : ''}` : ''}
                    </span>
                    {tpl.use_count > 5 && (
                      <span className="wl-tpl-row__badge"><Star size={10} /> Most used</span>
                    )}
                  </div>
                  <div className="wl-tpl-row__actions">
                    <motion.button
                      className="wl-tpl-row__use-btn"
                      onClick={() => loadTemplate(tpl)}
                      whileTap={{ scale: 0.97 }}
                    >
                      Use template
                    </motion.button>
                    <motion.button
                      className="wl-tpl-row__action-btn"
                      onClick={() => deleteTemplate(tpl.id)}
                      whileTap={{ scale: 0.97 }}
                      title="Delete template"
                    >
                      <Trash2 size={14} />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
      </div>{/* end .wl-desktop */}

      {/* ═══════════ MOBILE ═══════════ */}
      <div className="wl-mobile">

        {/* ── MOBILE HOME ── */}
        {mobileView === 'home' && (
          <div className="wlm-home">
            {/* Resume last workout (only within 10 min of finishing) */}
            {showResumeCard && (
              <motion.div
                className="wlm-resume-card"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <div className="wlm-resume-card__text">
                  <span className="wlm-resume-card__title">Finished too early?</span>
                  <span className="wlm-resume-card__sub">
                    {resumeMinutesLeft > 1
                      ? `You can resume your workout for the next ${resumeMinutesLeft} minutes`
                      : 'You can resume your workout for the next minute'}
                  </span>
                </div>
                <div className="wlm-resume-card__actions">
                  <motion.button
                    className="wlm-resume-card__resume"
                    onClick={resumeLastWorkout}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Play size={14} /> Resume workout
                  </motion.button>
                  <button
                    className="wlm-resume-card__dismiss"
                    onClick={clearRecentFinish}
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Quick Start */}
            {atLimit ? (
              <motion.button
                className="wlm-quick-start wlm-quick-start--locked"
                onClick={() => triggerUpgrade('workouts')}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="wlm-quick-start__icon wlm-quick-start__icon--locked"><Lock size={20} /></div>
                <div className="wlm-quick-start__text">
                  <span className="wlm-quick-start__title">Upgrade to Pro</span>
                  <span className="wlm-quick-start__sub">Unlock unlimited workout logging</span>
                </div>
                <ChevronRight size={18} className="wlm-quick-start__arrow" />
              </motion.button>
            ) : (
              <>
                <motion.button
                  className="wlm-quick-start"
                  onClick={startBlankSession}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="wlm-quick-start__icon"><Play size={20} /></div>
                  <div className="wlm-quick-start__text">
                    <span className="wlm-quick-start__title">Quick Start</span>
                    <span className="wlm-quick-start__sub">Start an empty workout</span>
                  </div>
                  <ChevronRight size={18} className="wlm-quick-start__arrow" />
                </motion.button>
                {/* Cardio shortcut — starts an empty session and opens the
                    picker pre-filtered to cardio so users reach the
                    Time/Speed flow in one tap. */}
                <motion.button
                  className="wlm-quick-start wlm-quick-start--cardio"
                  onClick={() => {
                    startBlankSession();
                    setSessionMuscleGroup('Cardio');
                    setExerciseBodyPartFilter('cardio');
                    setExerciseSearchQuery('');
                    setExerciseSearchOpen(true);
                  }}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.04 }}
                >
                  <div className="wlm-quick-start__icon wlm-quick-start__icon--cardio"><Clock size={20} /></div>
                  <div className="wlm-quick-start__text">
                    <span className="wlm-quick-start__title">Start Cardio</span>
                    <span className="wlm-quick-start__sub">Treadmill, bike, rowing &amp; more</span>
                  </div>
                  <ChevronRight size={18} className="wlm-quick-start__arrow" />
                </motion.button>
              </>
            )}

            {/* Free tier usage counter */}
            {!isPro && workoutHistory.length > 0 && (
              <div className={`wlm-usage-banner${nearLimit ? ' wlm-usage-banner--warn' : ''}${atLimit ? ' wlm-usage-banner--locked' : ''}`}>
                <div className="wlm-usage-banner__top">
                  <span className="wlm-usage-banner__count">
                    {atLimit ? (
                      <><Lock size={12} /> Limit reached</>
                    ) : (
                      <>{workoutHistory.length} / {WORKOUT_LIMIT} free workouts</>
                    )}
                  </span>
                  {(nearLimit || atLimit) && (
                    <button className="wlm-usage-banner__upgrade" onClick={() => triggerUpgrade('workouts')}>
                      Upgrade
                    </button>
                  )}
                </div>
                <div className="wlm-usage-banner__track">
                  <div
                    className={`wlm-usage-banner__fill${nearLimit ? ' wlm-usage-banner__fill--warn' : ''}${atLimit ? ' wlm-usage-banner__fill--locked' : ''}`}
                    style={{ width: `${Math.min((workoutHistory.length / WORKOUT_LIMIT) * 100, 100)}%` }}
                  />
                </div>
                {atLimit && (
                  <p className="wlm-usage-banner__msg">
                    Upgrade to Pro for unlimited workout logging
                  </p>
                )}
              </div>
            )}

            {/* Templates */}
            <motion.div
              className="wlm-section"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
            >
              <h3 className="wlm-section__title">Templates</h3>
              {templates.length === 0 ? (
                <div className="wlm-empty-placeholder">
                  <BookmarkPlus size={20} className="wlm-empty-placeholder__icon" />
                  <span className="wlm-empty-placeholder__text">No templates yet — complete a workout and press Finish to save it as a template</span>
                </div>
              ) : (
                <div className="wlm-template-grid">
                  {templates.map((tpl) => (
                    <motion.button
                      key={tpl.id}
                      className="wlm-template-card"
                      onClick={() => setTemplatePreview(tpl)}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className="wlm-template-card__icon"><Dumbbell size={16} /></div>
                      <span className="wlm-template-card__name">{tpl.name}</span>
                      <span className="wlm-template-card__meta">
                        {(tpl.exercises || []).length} exercise{(tpl.exercises || []).length !== 1 ? 's' : ''}
                        {tpl.muscle_group ? ` · ${tpl.muscle_group}` : ''}
                      </span>
                      {tpl.use_count >= 5 && (
                        <span className="wlm-template-card__badge"><Star size={9} /> Favorite</span>
                      )}
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Recent Workouts */}
            <motion.div
              className="wlm-section"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
            >
              <h3 className="wlm-section__title">Recent Workouts</h3>
              {workoutHistory.length === 0 ? (
                <div className="wlm-empty-state">
                  <Dumbbell size={28} className="wlm-empty-state__icon" />
                  <p className="wlm-empty-state__text">No workouts logged yet</p>
                  <p className="wlm-empty-state__sub">Tap Quick Start to begin</p>
                </div>
              ) : (
                <div className="wlm-recent-list">
                  {workoutHistory.slice(0, 8).map((w, idx) => (
                    <motion.div
                      key={w.id}
                      className="wlm-recent-row"
                      onClick={() => setWorkoutDetailSheet(w)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <div className="wlm-recent-row__left">
                        <span className="wlm-recent-row__name">{w.workout_name}</span>
                        <span className="wlm-recent-row__date">
                          {formatDate(w.workout_date)}
                          {w.muscle_group ? ` · ${w.muscle_group}` : ''}
                        </span>
                      </div>
                      <span className="wlm-recent-row__count">
                        {(w.exercises || []).length} ex
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* ── TEMPLATE PREVIEW SHEET ── */}
        <AnimatePresence>
          {templatePreview && (
            <motion.div
              className="wlm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTemplatePreview(null)}
            >
              <motion.div
                className="wlm-sheet"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="wlm-sheet__handle" />
                <div className="wlm-sheet__header">
                  <div>
                    <h3 className="wlm-sheet__title">{templatePreview.name}</h3>
                    <div className="wlm-sheet__meta">
                      {templatePreview.muscle_group && <span>{templatePreview.muscle_group}</span>}
                      <span>{(templatePreview.exercises || []).length} exercises</span>
                      {templatePreview.use_count > 0 && <span>Used {templatePreview.use_count}x</span>}
                    </div>
                  </div>
                  <button className="wlm-sheet__close" onClick={() => setTemplatePreview(null)}>
                    <X size={20} />
                  </button>
                </div>
                <div className="wlm-sheet__exercises">
                  {(templatePreview.exercises || []).map((ex, i) => (
                    <div key={i} className="wlm-sheet__exercise">
                      <span className="wlm-sheet__exercise-name">{ex.name}</span>
                      <span className="wlm-sheet__exercise-detail">
                        {Array.isArray(ex.sets) ? `${ex.sets.length} sets` : `${ex.sets || 3} sets`}
                        {Array.isArray(ex.sets) && ex.sets[0]?.reps ? ` × ${ex.sets[0].reps}` : (ex.reps ? ` × ${ex.reps}` : '')}
                        {Array.isArray(ex.sets) && ex.sets[0]?.weight ? ` @ ${ex.sets[0].weight} lbs` : (ex.weight ? ` @ ${ex.weight} lbs` : '')}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="wlm-sheet__footer wlm-sheet__footer--multi">
                  <motion.button
                    className="wlm-sheet__start-btn"
                    onClick={() => startSessionFromTemplate(templatePreview)}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Play size={16} /> Start Workout
                  </motion.button>
                  <motion.button
                    className="wlm-sheet__delete-btn"
                    onClick={() => setConfirmDelete({ type: 'template', id: templatePreview.id, name: templatePreview.name })}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Trash2 size={16} /> Delete template
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── WORKOUT DETAIL SHEET ── */}
        <AnimatePresence>
          {workoutDetailSheet && (
            <motion.div
              className="wlm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setWorkoutDetailSheet(null)}
            >
              <motion.div
                className="wlm-sheet"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="wlm-sheet__handle" />
                <div className="wlm-sheet__header">
                  <div>
                    <h3 className="wlm-sheet__title">{workoutDetailSheet.workout_name}</h3>
                    <div className="wlm-sheet__meta">
                      <span>{formatDate(workoutDetailSheet.workout_date)}</span>
                      {workoutDetailSheet.muscle_group && <span>{workoutDetailSheet.muscle_group}</span>}
                      <span>{(workoutDetailSheet.exercises || []).length} exercises</span>
                    </div>
                  </div>
                  <button className="wlm-sheet__close" onClick={() => setWorkoutDetailSheet(null)}>
                    <X size={20} />
                  </button>
                </div>
                {workoutDetailSheet.notes && workoutDetailSheet.notes.trim() && (
                  <div className="wlm-sheet__notes">
                    <span className="wlm-sheet__notes-label">Session notes</span>
                    <p className="wlm-sheet__notes-body">{workoutDetailSheet.notes}</p>
                  </div>
                )}
                <div className="wlm-sheet__exercises">
                  {(workoutDetailSheet.exercises || []).map((ex, i) => {
                    const cardio = isCardioExercise(ex);
                    return (
                      <div key={i} className="wlm-sheet__exercise-block">
                        <span className="wlm-sheet__exercise-name">
                          {ex.name}
                          {cardio && <span className="wlm-ex-block__cardio-badge">CARDIO</span>}
                        </span>
                        <div className="wlm-sheet__sets-list">
                          {(ex.sets || []).map((s, si) => (
                            <div key={si} className="wlm-sheet__set-row">
                              <span className="wlm-sheet__set-num">
                                {cardio ? `Interval ${si + 1}` : `Set ${si + 1}`}
                              </span>
                              <span className="wlm-sheet__set-data">
                                {cardio
                                  ? formatCardioSet(s)
                                  : (<>
                                      {s.weight ? `${s.weight} lbs` : '—'}
                                      {' × '}
                                      {s.reps || '—'}
                                    </>)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="wlm-sheet__footer wlm-sheet__footer--multi">
                  <motion.button
                    className="wlm-sheet__action-btn wlm-sheet__action-btn--edit"
                    onClick={() => {
                      const w = workoutDetailSheet;
                      setWorkoutDetailSheet(null);
                      // Deep-clone so edits don't mutate the history state
                      // until the user presses Save.
                      setEditWorkoutSheet({
                        id: w.id,
                        workout_name: w.workout_name || '',
                        muscle_group: w.muscle_group || '',
                        notes: w.notes || '',
                        exercises: (w.exercises || []).map((ex) => ({
                          name: ex.name,
                          sets: (ex.sets || []).map((s) => ({
                            weight: s.weight || '',
                            reps: s.reps || '',
                            notes: s.notes || '',
                          })),
                        })),
                      });
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Edit workout
                  </motion.button>
                  <motion.button
                    className="wlm-sheet__action-btn wlm-sheet__action-btn--save"
                    onClick={() => {
                      const w = workoutDetailSheet;
                      setWorkoutDetailSheet(null);
                      setSaveTemplatePopover(w.id);
                      setTemplateName(w.workout_name);
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <BookmarkPlus size={16} /> Save as Template
                  </motion.button>
                  <motion.button
                    className="wlm-sheet__delete-btn"
                    onClick={() => setConfirmDelete({
                      type: 'workout',
                      id: workoutDetailSheet.id,
                      name: workoutDetailSheet.workout_name,
                      date: workoutDetailSheet.workout_date,
                    })}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Trash2 size={16} /> Delete workout log
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ACTIVE SESSION ── */}
        {mobileView === 'session' && (
          <div className="wlm-session">
            {/* Session header bar */}
            <div className="wlm-session__header">
              <div className="wlm-session__timer">
                <Clock size={14} />
                <span>{formatDuration(sessionTimer)}</span>
              </div>
              <input
                className="wlm-session__name-input"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onFocus={handleInputFocus}
                onKeyDown={handleInputKeyDown}
                placeholder="Workout name…"
              />
              <motion.button
                type="button"
                className="wlm-session__finish-btn"
                onClick={() => setEndWorkoutConfirm(true)}
                disabled={isFinishing}
                whileTap={{ scale: 0.97 }}
              >
                {isFinishing ? (
                  <>
                    <Loader2 size={14} className="wlm-spin" /> Saving…
                  </>
                ) : (
                  'Finish'
                )}
              </motion.button>
            </div>

            {/* Muscle group pills */}
            <div className="wlm-session__mg-row">
              {MUSCLE_GROUPS.map((g) => (
                <button
                  key={g}
                  className={`wlm-mg-pill ${sessionMuscleGroup === g ? 'wlm-mg-pill--active' : ''}`}
                  onClick={() => setSessionMuscleGroup(sessionMuscleGroup === g ? '' : g)}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Exercise blocks */}
            <div className="wlm-session__body" onClick={dismissKeyboard}>
              {sessionExercises.length === 0 && (
                <div className="wlm-session__empty">
                  <Dumbbell size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <p>Tap "Add Exercise" to get started</p>
                </div>
              )}
              <Reorder.Group
                axis="y"
                values={sessionExercises}
                onReorder={handleReorderExercises}
                as="div"
                className="wlm-session__ex-list"
              >
                {sessionExercises.map((ex, exIdx) => (
                  <ReorderableExerciseBlock
                    key={ex._id}
                    ex={ex}
                    exIdx={exIdx}
                    completedSets={completedSets}
                    updateSessionSet={updateSessionSet}
                    toggleSetComplete={toggleSetComplete}
                    addSetToSession={addSetToSession}
                    removeSessionExercise={removeSessionExercise}
                    removeSessionSet={removeSessionSet}
                    handleInputFocus={handleInputFocus}
                    handleInputKeyDown={handleInputKeyDown}
                    handleInputClick={handleInputClick}
                    onOpenExerciseMenu={(idx, anchorRect) => setExerciseMenu({ idx, anchorRect })}
                    isEditingNote={noteSheet?.exIdx === exIdx}
                    noteDraft={noteSheet?.exIdx === exIdx ? noteSheet.draft : ''}
                    onStartEditNote={(idx) => setNoteSheet({ exIdx: idx, draft: sessionExercises[idx]?.notes || '' })}
                    onChangeNoteDraft={(v) =>
                      setNoteSheet((prev) => (prev ? { ...prev, draft: v } : prev))
                    }
                    onCommitNoteDraft={() => {
                      if (!noteSheet) return;
                      setSessionExerciseNotes(noteSheet.exIdx, noteSheet.draft);
                      setNoteSheet(null);
                    }}
                    reorderSessionItems={reorderSessionItems}
                    removeRestItem={removeRestItem}
                  />
                ))}
              </Reorder.Group>

              {/* Add Exercise button */}
              <motion.button
                className="wlm-add-exercise-btn"
                onClick={() => { setExerciseSearchOpen(true); setExerciseSearchQuery(''); setExerciseBodyPartFilter('all'); }}
                whileTap={{ scale: 0.97 }}
              >
                <Plus size={18} /> Add Exercise
              </motion.button>

              {/* ── Session notes ──
                  Free-text field saved with the workout. Kept at
                  session level (distinct from per-set notes already
                  stored inside exercises JSON). scrollIntoView on
                  focus so the iOS keyboard does not obscure the
                  textarea on mobile. */}
              {sessionExercises.length > 0 && (
                <div className="wlm-session-notes">
                  <label htmlFor="wlm-session-notes-ta" className="wlm-session-notes__label">
                    Session notes
                  </label>
                  <textarea
                    id="wlm-session-notes-ta"
                    className="wlm-session-notes__input"
                    value={sessionNotes}
                    onChange={(e) => {
                      const next = e.target.value.slice(0, SESSION_NOTES_MAX);
                      setSessionNotes(next);
                    }}
                    onFocus={(e) => {
                      handleInputFocus();
                      // Extra insurance on mobile: explicitly scroll the
                      // textarea into view so iOS reveals it above the
                      // keyboard even when it's at the bottom of a flex
                      // column that the default scrollIntoView misses.
                      const el = e.currentTarget;
                      setTimeout(() => {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 350);
                    }}
                    placeholder="How did this session feel? Note energy levels, form, anything…"
                    rows={3}
                    maxLength={SESSION_NOTES_MAX}
                  />
                  {/* Counter only appears once the user has written a substantial
                      amount (200+ chars) so we don't nag for short notes. */}
                  {sessionNotes.length >= 200 && (
                    <div className="wlm-session-notes__counter">
                      {sessionNotes.length}/{SESSION_NOTES_MAX}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Finish button — routes through an explicit
                  confirmation sheet to avoid accidental ending from
                  scroll-gesture touchend events. finishSession itself
                  is still idempotent via the finishInFlight ref guard. */}
              <motion.button
                type="button"
                className="wlm-finish-btn-bottom"
                onClick={() => setEndWorkoutConfirm(true)}
                disabled={isFinishing}
                whileTap={{ scale: 0.97 }}
              >
                {isFinishing ? (
                  <>
                    <Loader2 size={16} className="wlm-spin" /> Saving…
                  </>
                ) : (
                  'Finish Workout'
                )}
              </motion.button>

              {/* Discard button */}
              <button className="wlm-discard-btn" onClick={discardSession}>
                Discard Workout
              </button>
            </div>

          </div>
        )}

        {/* ── EXERCISE SEARCH SHEET ──
            Portaled to document.body so the fixed-position overlay
            escapes the app shell's transform/containing-block and
            actually covers the mobile topbar. Same pattern used for
            the meal planner slot panel. */}
        {createPortal(
        <AnimatePresence>
          {exerciseSearchOpen && (
            <motion.div
              className="wlm-overlay wlm-overlay--search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="wlm-search"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              >
                <div className="wlm-search__header">
                  <button
                    type="button"
                    className="wlm-search__back"
                    onClick={() => setExerciseSearchOpen(false)}
                    aria-label="Back"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <h3>Add Exercise</h3>
                  <button className="wlm-search__close" onClick={() => setExerciseSearchOpen(false)}><X size={20} /></button>
                </div>
                <div className="wlm-search__input-row">
                  <Search size={16} />
                  <input
                    type="text"
                    value={exerciseSearchQuery}
                    onChange={(e) => setExerciseSearchQuery(e.target.value)}
                    onFocus={handleInputFocus}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Search exercises…"
                    autoFocus
                  />
                </div>
                <div className="wlm-search__filters">
                  {bodyParts.map((bp) => (
                    <button
                      key={bp}
                      className={`wlm-bp-pill ${exerciseBodyPartFilter === bp ? 'wlm-bp-pill--active' : ''}`}
                      onClick={() => setExerciseBodyPartFilter(bp)}
                    >
                      {bp === 'all' ? 'All' : bp.charAt(0).toUpperCase() + bp.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="wlm-search__list">
                  {Object.keys(groupedExercises).sort().map((letter) => (
                    <div key={letter} className="wlm-letter-group">
                      <div className="wlm-letter-group__label">{letter}</div>
                      {groupedExercises[letter].map((ex) => (
                        <button
                          key={ex.id}
                          className="wlm-exercise-item"
                          onClick={() => addExerciseToSession(ex)}
                        >
                          <div className="wlm-exercise-item__info">
                            <span className="wlm-exercise-item__name">{ex.name}</span>
                            <span className="wlm-exercise-item__meta">{ex.targetMuscle} · {ex.equipment}</span>
                          </div>
                          <Plus size={16} className="wlm-exercise-item__add" />
                        </button>
                      ))}
                    </div>
                  ))}
                  {filteredExercises.length === 0 && (
                    <p className="wlm-search__empty-msg">No exercises found</p>
                  )}
                </div>
                {/* Custom exercise fallback */}
                {exerciseSearchQuery.trim() && (
                  <div className="wlm-search__custom">
                    <button
                      className="wlm-search__custom-btn"
                      onClick={() => addExerciseToSession({ name: exerciseSearchQuery.trim() })}
                    >
                      <Plus size={14} /> Add "{exerciseSearchQuery.trim()}" as custom exercise
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body)}

        {/* ── TEMPLATE UPDATE SHEET ── */}
        <AnimatePresence>
          {templateUpdateSheet && (
            <motion.div
              className="wlm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTemplateUpdateSheet(null)}
            >
              <motion.div
                className="wlm-tpl-update-sheet"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="wlm-sheet__handle" />
                <div className="wlm-tpl-update__header">
                  <BookmarkCheck size={24} className="wlm-tpl-update__icon" />
                  <h3 className="wlm-tpl-update__title">Update template?</h3>
                  <p className="wlm-tpl-update__subtitle">
                    Your workout differed from the "{templateUpdateSheet.templateName}" template. Save the new values?
                  </p>
                </div>

                {/* Changes list */}
                <div className="wlm-tpl-update__changes">
                  {templateUpdateSheet.changes.slice(0, 4).map((c, i) => (
                    <div key={i} className="wlm-tpl-update__change">
                      {c.type === 'added' && (
                        <span className="wlm-tpl-update__change--add">+ {c.name} added</span>
                      )}
                      {c.type === 'removed' && (
                        <span className="wlm-tpl-update__change--remove">- {c.name} removed</span>
                      )}
                      {c.type === 'changed' && (
                        <span className="wlm-tpl-update__change--edit">
                          {c.name} set {c.set}: {c.from.weight}lbs×{c.from.reps} → {c.to.weight}lbs×{c.to.reps}
                        </span>
                      )}
                      {c.type === 'sets_added' && (
                        <span className="wlm-tpl-update__change--add">+ {c.count} set{c.count > 1 ? 's' : ''} added to {c.name}</span>
                      )}
                    </div>
                  ))}
                  {templateUpdateSheet.changes.length > 4 && (
                    <span className="wlm-tpl-update__more">and {templateUpdateSheet.changes.length - 4} more changes...</span>
                  )}
                </div>

                {/* Buttons */}
                <motion.button
                  className="wlm-tpl-update__btn-primary"
                  onClick={async () => {
                    await supabase
                      .from('workout_templates')
                      .update({ exercises: templateUpdateSheet.exerciseData, updated_at: new Date().toISOString() })
                      .eq('id', templateUpdateSheet.templateId);
                    toast.success('Template updated');
                    fetchTemplates();
                    setTemplateUpdateSheet(null);
                    setSaveNewTplMode(false);
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  Update template
                </motion.button>

                {/* Save as new template */}
                <AnimatePresence mode="wait">
                  {!saveNewTplMode ? (
                    <motion.button
                      key="save-new-btn"
                      className="wlm-tpl-update__btn-new"
                      onClick={() => {
                        setSaveNewTplName(templateUpdateSheet.templateName || '');
                        setSaveNewTplError('');
                        setSaveNewTplMode(true);
                      }}
                      whileTap={{ scale: 0.97 }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <BookmarkPlus size={16} /> Save as new template
                    </motion.button>
                  ) : (
                    <motion.div
                      key="save-new-input"
                      className="wlm-tpl-update__new-row"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="wlm-tpl-update__new-input-row">
                        <input
                          type="text"
                          className="wlm-tpl-update__new-input"
                          value={saveNewTplName}
                          onChange={(e) => setSaveNewTplName(e.target.value)}
                          placeholder="Template name..."
                          autoFocus
                        />
                        <motion.button
                          className="wlm-tpl-update__new-save"
                          onClick={async () => {
                            const name = saveNewTplName.trim();
                            if (!name) { setSaveNewTplError('Name cannot be empty'); return; }
                            setSaveNewTplError('');
                            const { error } = await supabase.from('workout_templates').insert({
                              user_id: userId,
                              name,
                              muscle_group: sessionMuscleGroup || '',
                              exercises: templateUpdateSheet.exerciseData,
                            });
                            if (error) { setSaveNewTplError("Couldn't save template, please try again"); return; }
                            toast.success(`${name} saved as new template`);
                            fetchTemplates();
                            setTemplateUpdateSheet(null);
                            setSaveNewTplMode(false);
                          }}
                          whileTap={{ scale: 0.97 }}
                        >
                          Save
                        </motion.button>
                      </div>
                      {saveNewTplError && (
                        <span className="wlm-tpl-update__new-error">{saveNewTplError}</span>
                      )}
                      <button
                        className="wlm-tpl-update__new-cancel"
                        onClick={() => { setSaveNewTplMode(false); setSaveNewTplError(''); }}
                      >
                        Cancel
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  className="wlm-tpl-update__btn-secondary"
                  onClick={() => { setTemplateUpdateSheet(null); setSaveNewTplMode(false); }}
                  whileTap={{ scale: 0.97 }}
                >
                  Keep original
                </motion.button>
                <button
                  className="wlm-tpl-update__dont-ask"
                  onClick={() => {
                    localStorage.setItem('template_auto_update', 'never');
                    setTemplateUpdateSheet(null);
                    setSaveNewTplMode(false);
                  }}
                >
                  Don't ask again
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── END WORKOUT CONFIRMATION ──
            Required user-confirmation before finishing a session.
            Prevents accidental endings from scroll-gesture touchend
            events that used to fire on the finish button.

            Rendered as a slide-up bottom sheet on mobile (<768px)
            and a centered fade-scale modal on desktop — the two
            presentations share the same DOM and share state; only
            CSS (and the Framer Motion variants below) differ. */}
        <AnimatePresence>
          {endWorkoutConfirm && (() => {
            /* Centered-modal animation — used on both mobile and
               desktop now that the confirm dialog no longer slides
               up from the bottom (it was getting clipped by the
               fixed bottom nav on mobile). */
            const sheetInitial = { opacity: 0, scale: 0.92 };
            const sheetAnimate = { opacity: 1, scale: 1 };
            const sheetExit = { opacity: 0, scale: 0.92 };
            /* Cardio roll-up — shown only when the session has at
               least one cardio exercise. Avg speed is duration-weighted
               so a long slow run dominates a short fast sprint. */
            const cardioStats = (() => {
              let totalSeconds = 0;
              let weightedSpeedSum = 0;
              let totalMiles = 0;
              let hasDistance = false;
              let count = 0;
              sessionExercises.forEach((ex) => {
                if (!isCardioExercise(ex)) return;
                (ex.sets || []).forEach((s) => {
                  const secs = Number(toSeconds(s.duration, s.durationUnit || 'min')) || 0;
                  const mph = Number(toMph(s.speed, s.speedUnit || 'mph')) || 0;
                  const mi = s.distanceShown
                    ? Number(toMiles(s.distance, s.distanceUnit || 'mi')) || 0
                    : 0;
                  if (secs > 0 || mph > 0 || mi > 0) count += 1;
                  totalSeconds += secs;
                  if (secs > 0 && mph > 0) weightedSpeedSum += mph * secs;
                  if (mi > 0) { totalMiles += mi; hasDistance = true; }
                });
              });
              if (count === 0) return null;
              const totalMin = Math.round(totalSeconds / 60);
              const avgMph = totalSeconds > 0 ? +(weightedSpeedSum / totalSeconds).toFixed(1) : 0;
              return {
                totalMin,
                avgMph,
                totalMiles: +totalMiles.toFixed(2),
                hasDistance,
              };
            })();
            return (
            <motion.div
              key="end-workout-confirm"
              className="wlm-overlay wlm-overlay--confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => { if (!isFinishing) setEndWorkoutConfirm(false); }}
            >
              <motion.div
                className="wlm-confirm wlm-confirm--end-workout"
                initial={sheetInitial}
                animate={sheetAnimate}
                exit={sheetExit}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className="wlm-confirm__title">End workout?</h4>
                <p className="wlm-confirm__message">
                  Are you sure you want to finish? Your progress will be saved.
                </p>
                {cardioStats && (
                  <div className="wlm-confirm__cardio-summary">
                    <p className="wlm-confirm__cardio-title">Cardio summary</p>
                    <div className="wlm-confirm__cardio-grid">
                      <div className="wlm-confirm__cardio-stat">
                        <span className="wlm-confirm__cardio-label">Total time</span>
                        <span className="wlm-confirm__cardio-value">{cardioStats.totalMin} min</span>
                      </div>
                      <div className="wlm-confirm__cardio-stat">
                        <span className="wlm-confirm__cardio-label">Avg speed</span>
                        <span className="wlm-confirm__cardio-value">{cardioStats.avgMph} mph</span>
                      </div>
                      {cardioStats.hasDistance && (
                        <div className="wlm-confirm__cardio-stat">
                          <span className="wlm-confirm__cardio-label">Total distance</span>
                          <span className="wlm-confirm__cardio-value">{cardioStats.totalMiles} mi</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="wlm-confirm__actions">
                  <motion.button
                    type="button"
                    className="wlm-confirm__primary"
                    onClick={finishSession}
                    disabled={isFinishing}
                    whileTap={{ scale: 0.97 }}
                  >
                    {isFinishing ? (
                      <>
                        <Loader2 size={16} className="wlm-spin" /> Saving…
                      </>
                    ) : (
                      'Finish workout'
                    )}
                  </motion.button>
                  <motion.button
                    type="button"
                    className="wlm-confirm__cancel wlm-confirm__btn--keep-going"
                    onClick={() => setEndWorkoutConfirm(false)}
                    disabled={isFinishing}
                    whileTap={{ scale: 0.97 }}
                  >
                    Keep going
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* ── DISCARD WORKOUT CONFIRM ──
            Same layout as end-workout (stacked buttons on mobile,
            centered modal on both viewports) but with a destructive
            red primary since discard is irreversible. */}
        <AnimatePresence>
          {discardConfirm && (
            <motion.div
              key="discard-confirm"
              className="wlm-overlay wlm-overlay--confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setDiscardConfirm(false)}
            >
              <motion.div
                className="wlm-confirm wlm-confirm--discard-workout"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className="wlm-confirm__title">Discard this workout?</h4>
                <p className="wlm-confirm__message">
                  This will clear all sets you&apos;ve logged in this session. This can&apos;t be undone.
                </p>
                <div className="wlm-confirm__actions">
                  <motion.button
                    type="button"
                    className="wlm-confirm__primary wlm-confirm__primary--destructive"
                    onClick={performDiscard}
                    whileTap={{ scale: 0.97 }}
                  >
                    Discard
                  </motion.button>
                  <motion.button
                    type="button"
                    className="wlm-confirm__cancel wlm-confirm__btn--keep-going"
                    onClick={() => setDiscardConfirm(false)}
                    whileTap={{ scale: 0.97 }}
                  >
                    Keep editing
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── PER-EXERCISE 3-DOTS MENU (mobile) ──
            Popover-style dropdown anchored under the 3-dots button
            that opened it. A transparent overlay above captures outside
            taps to dismiss. The popover flips to appear ABOVE the
            button when there isn't enough room below. */}
        <AnimatePresence>
          {exerciseMenu && sessionExercises[exerciseMenu.idx] && (() => {
            const MENU_WIDTH = 200;
            const MENU_HEIGHT_APPROX = 172;
            const MARGIN = 8;
            const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
            const vh = typeof window !== 'undefined' ? window.innerHeight : 812;
            const rect = exerciseMenu.anchorRect || { top: 0, bottom: 0, right: vw, left: vw };
            const spaceBelow = vh - rect.bottom;
            const flipUp = spaceBelow < (MENU_HEIGHT_APPROX + MARGIN) && rect.top > (MENU_HEIGHT_APPROX + MARGIN);
            const top = flipUp
              ? Math.max(MARGIN, rect.top - MENU_HEIGHT_APPROX - 6)
              : Math.min(vh - MENU_HEIGHT_APPROX - MARGIN, rect.bottom + 6);
            // Right-align the menu with the button's right edge, clamp to viewport.
            const right = Math.max(MARGIN, vw - rect.right);
            return (
              <motion.div
                key="wlm-ex-menu-overlay"
                className="wlm-ex-menu-popover-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                onClick={() => setExerciseMenu(null)}
              >
                <motion.div
                  className="wlm-ex-menu wlm-ex-menu--popover"
                  initial={{ opacity: 0, y: flipUp ? 4 : -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: flipUp ? 4 : -4, scale: 0.97 }}
                  transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    position: 'fixed',
                    top,
                    right,
                    width: MENU_WIDTH,
                    zIndex: 10001,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  role="menu"
                  aria-label={`${sessionExercises[exerciseMenu.idx]?.name} options`}
                >
                  <button
                    type="button"
                    className="wlm-ex-menu__item wlm-ex-menu__item--primary"
                    onClick={() => {
                      const idx = exerciseMenu.idx;
                      setExerciseMenu(null);
                      setNoteSheet({ exIdx: idx, draft: sessionExercises[idx]?.notes || '' });
                    }}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <StickyNote size={16} />
                    <span>{sessionExercises[exerciseMenu.idx]?.notes ? 'Edit Note' : 'Add Note'}</span>
                  </button>
                  <button
                    type="button"
                    className="wlm-ex-menu__item"
                    onClick={() => {
                      const idx = exerciseMenu.idx;
                      setExerciseMenu(null);
                      setRestPickerExIdx(idx);
                    }}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Timer size={16} />
                    <span>Rest Timer</span>
                  </button>
                  <button
                    type="button"
                    className="wlm-ex-menu__item wlm-ex-menu__item--danger"
                    onClick={() => {
                      const idx = exerciseMenu.idx;
                      setExerciseMenu(null);
                      setConfirmRemoveExercise(idx);
                    }}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Trash2 size={16} />
                    <span>Remove Exercise</span>
                  </button>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* ── REST TIMER PICKER ── centered themed dialog, same shell
            as ConfirmDialog. Opened from the per-exercise 3-dots menu. */}
        <RestTimerDialog
          open={restPickerExIdx != null && !!sessionExercises[restPickerExIdx]}
          exerciseName={restPickerExIdx != null ? sessionExercises[restPickerExIdx]?.name : ''}
          onStart={(secs) => startRestTimer(restPickerExIdx, secs)}
          onCancel={() => setRestPickerExIdx(null)}
        />

        {/* ── CONFIRM REMOVE EXERCISE (mobile) ── */}
        <AnimatePresence>
          {confirmRemoveExercise != null && sessionExercises[confirmRemoveExercise] && (
            <motion.div
              key="wlm-remove-ex-overlay"
              className="wlm-overlay wlm-overlay--confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setConfirmRemoveExercise(null)}
            >
              <motion.div
                className="wlm-confirm"
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="wlm-confirm__handle" aria-hidden="true" />
                <h4 className="wlm-confirm__title">Remove this exercise?</h4>
                <p className="wlm-confirm__message">
                  All sets for {sessionExercises[confirmRemoveExercise]?.name} will be removed.
                </p>
                <div className="wlm-confirm__actions">
                  <motion.button
                    type="button"
                    className="wlm-confirm__primary wlm-confirm__primary--destructive"
                    onClick={() => {
                      removeSessionExercise(confirmRemoveExercise);
                      setConfirmRemoveExercise(null);
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Remove
                  </motion.button>
                  <motion.button
                    type="button"
                    className="wlm-confirm__cancel"
                    onClick={() => setConfirmRemoveExercise(null)}
                    whileTap={{ scale: 0.97 }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SAVE AS TEMPLATE BOTTOM SHEET (mobile) ──
            The desktop flow renders the popover inline in the history
            list, but .wl-desktop is display:none on mobile — so on
            mobile we render a dedicated bottom sheet keyed off the
            same saveTemplatePopover state. */}
        <AnimatePresence>
          {saveTemplatePopover && (() => {
            const w = workoutHistory.find((x) => x.id === saveTemplatePopover);
            if (!w) return null;
            return (
              <motion.div
                key="save-template-sheet"
                className="wlm-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setSaveTemplatePopover(null); setTemplateName(''); }}
              >
                <motion.div
                  className="wlm-sheet wlm-sheet--compact"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="wlm-sheet__handle" />
                  <div className="wlm-sheet__header">
                    <div>
                      <h3 className="wlm-sheet__title">Save as template</h3>
                      <div className="wlm-sheet__meta">
                        <span>{w.workout_name}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="wlm-sheet__close"
                      onClick={() => { setSaveTemplatePopover(null); setTemplateName(''); }}
                      aria-label="Close"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="wlm-save-template-sheet__body">
                    <label className="wl-popover__label" htmlFor="wlm-save-template-name">Template name</label>
                    <input
                      id="wlm-save-template-name"
                      type="text"
                      className="input wl-popover__input"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder={w.workout_name}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') saveAsTemplate(w); }}
                    />
                  </div>
                  <div className="wlm-sheet__footer wlm-sheet__footer--multi">
                    <motion.button
                      type="button"
                      className="wlm-sheet__action-btn wlm-sheet__action-btn--save"
                      onClick={() => saveAsTemplate(w)}
                      whileTap={{ scale: 0.97 }}
                    >
                      Save template
                    </motion.button>
                    <motion.button
                      type="button"
                      className="wlm-confirm__cancel wlm-confirm__btn--keep-going"
                      onClick={() => { setSaveTemplatePopover(null); setTemplateName(''); }}
                      whileTap={{ scale: 0.97 }}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* ── EDIT WORKOUT BOTTOM SHEET ──
            Lets users tweak reps, weights, notes, or delete a set
            on an already-saved workout without going through the
            active-session flow. Saves by UPDATING the existing row
            so there are no duplicate entries in history. */}
        <AnimatePresence>
          {editWorkoutSheet && (
            <motion.div
              key="edit-workout-sheet"
              className="wlm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditWorkoutSheet(null)}
            >
              <motion.div
                className="wlm-sheet wlm-sheet--edit"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="wlm-sheet__handle" />
                <div className="wlm-sheet__header">
                  <div>
                    <h3 className="wlm-sheet__title">Edit workout</h3>
                    <div className="wlm-sheet__meta">
                      <span>{editWorkoutSheet.workout_name || 'Untitled'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="wlm-sheet__close"
                    onClick={() => setEditWorkoutSheet(null)}
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="wlm-edit-sheet__body">
                  {/* Workout name */}
                  <label className="wlm-edit-sheet__field-label" htmlFor="wlm-edit-name">
                    Workout name
                  </label>
                  <input
                    id="wlm-edit-name"
                    type="text"
                    className="wlm-edit-sheet__input"
                    value={editWorkoutSheet.workout_name}
                    onChange={(e) => setEditWorkoutSheet((prev) =>
                      prev ? { ...prev, workout_name: e.target.value } : prev
                    )}
                    onFocus={handleInputFocus}
                    placeholder="Workout name…"
                  />

                  {/* Notes */}
                  <label className="wlm-edit-sheet__field-label" htmlFor="wlm-edit-notes">
                    Notes
                  </label>
                  <textarea
                    id="wlm-edit-notes"
                    className="wlm-edit-sheet__input wlm-edit-sheet__textarea"
                    value={editWorkoutSheet.notes}
                    onChange={(e) => setEditWorkoutSheet((prev) =>
                      prev
                        ? { ...prev, notes: e.target.value.slice(0, SESSION_NOTES_MAX) }
                        : prev
                    )}
                    onFocus={(e) => {
                      handleInputFocus();
                      const el = e.currentTarget;
                      setTimeout(() => {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 350);
                    }}
                    rows={3}
                    maxLength={SESSION_NOTES_MAX}
                    placeholder="How did this workout feel?"
                  />

                  {/* Exercises */}
                  <div className="wlm-edit-sheet__exercises">
                    {editWorkoutSheet.exercises.map((ex, exIdx) => (
                      <div key={exIdx} className="wlm-edit-sheet__exercise">
                        <div className="wlm-edit-sheet__exercise-header">
                          <span className="wlm-edit-sheet__exercise-name">{ex.name}</span>
                        </div>
                        <div className="wlm-edit-sheet__set-rows">
                          {ex.sets.map((set, sIdx) => (
                            <div key={sIdx} className="wlm-edit-sheet__set-row">
                              <span className="wlm-edit-sheet__set-label">Set {sIdx + 1}</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                className="wlm-edit-sheet__set-input"
                                value={set.weight}
                                onFocus={handleInputFocus}
                                onClick={handleInputClick}
                                onKeyDown={handleInputKeyDown}
                                onChange={(e) => setEditWorkoutSheet((prev) => {
                                  if (!prev) return prev;
                                  const next = { ...prev, exercises: prev.exercises.map((_ex, i) => {
                                    if (i !== exIdx) return _ex;
                                    return {
                                      ..._ex,
                                      sets: _ex.sets.map((_s, j) =>
                                        j === sIdx ? { ..._s, weight: e.target.value } : _s,
                                      ),
                                    };
                                  }) };
                                  return next;
                                })}
                                placeholder="lbs"
                              />
                              <span className="wlm-edit-sheet__set-x">×</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                className="wlm-edit-sheet__set-input"
                                value={set.reps}
                                onFocus={handleInputFocus}
                                onClick={handleInputClick}
                                onKeyDown={handleInputKeyDown}
                                onChange={(e) => setEditWorkoutSheet((prev) => {
                                  if (!prev) return prev;
                                  return { ...prev, exercises: prev.exercises.map((_ex, i) => {
                                    if (i !== exIdx) return _ex;
                                    return {
                                      ..._ex,
                                      sets: _ex.sets.map((_s, j) =>
                                        j === sIdx ? { ..._s, reps: e.target.value } : _s,
                                      ),
                                    };
                                  }) };
                                })}
                                placeholder="reps"
                              />
                              <button
                                type="button"
                                className="wlm-edit-sheet__set-delete"
                                aria-label={`Delete set ${sIdx + 1}`}
                                onClick={() => setEditWorkoutSheet((prev) => {
                                  if (!prev) return prev;
                                  return { ...prev, exercises: prev.exercises.map((_ex, i) => {
                                    if (i !== exIdx) return _ex;
                                    return { ..._ex, sets: _ex.sets.filter((_, j) => j !== sIdx) };
                                  }) };
                                })}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="wlm-sheet__footer wlm-sheet__footer--multi">
                  <motion.button
                    className="wlm-sheet__action-btn wlm-sheet__action-btn--save"
                    onClick={async () => {
                      if (!editWorkoutSheet) return;
                      const trimmedName = editWorkoutSheet.workout_name.trim();
                      if (!trimmedName) {
                        toast.error('Workout name cannot be empty.');
                        return;
                      }
                      const payload = {
                        workout_name: trimmedName,
                        muscle_group: editWorkoutSheet.muscle_group || null,
                        exercises: editWorkoutSheet.exercises.filter(
                          (ex) => (ex.sets || []).length > 0,
                        ),
                        notes: editWorkoutSheet.notes.trim()
                          ? editWorkoutSheet.notes.trim()
                          : null,
                      };
                      const { error } = await supabase
                        .from('workouts')
                        .update(payload)
                        .eq('id', editWorkoutSheet.id);
                      if (error) {
                        toast.error(`Couldn't save changes: ${error.message}`);
                        return;
                      }
                      toast.success('Workout updated');
                      setEditWorkoutSheet(null);
                      fetchWorkouts();
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Save changes
                  </motion.button>
                  <motion.button
                    className="wlm-confirm__cancel wlm-confirm__btn--keep-going"
                    onClick={() => setEditWorkoutSheet(null)}
                    whileTap={{ scale: 0.97 }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CONFIRM DELETE DIALOG ── */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              className="wlm-overlay wlm-overlay--confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
            >
              <motion.div
                className="wlm-confirm"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className="wlm-confirm__title">
                  Delete {confirmDelete.type === 'template' ? 'template' : 'workout'}?
                </h4>
                <p className="wlm-confirm__message">
                  {confirmDelete.type === 'template'
                    ? (<>Delete &ldquo;{confirmDelete.name}&rdquo;? This cannot be undone.</>)
                    : (<>{confirmDelete.name} on {formatDate(confirmDelete.date)} will be permanently removed.</>)
                  }
                </p>
                <div className="wlm-confirm__actions">
                  <motion.button
                    className="wlm-confirm__cancel"
                    onClick={() => setConfirmDelete(null)}
                    whileTap={{ scale: 0.97 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    className="wlm-confirm__delete"
                    onClick={handleConfirmDelete}
                    whileTap={{ scale: 0.97 }}
                  >
                    Delete
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>{/* end .wl-mobile */}

    </div>
  );
}
