# train_bodyfat.py
#
# Train a RandomForestRegressor on the NHANES 2017-2018 dataset and save it
# as models/bodyfat_model.pkl for the FastAPI backend to use.
#
# Prerequisites:
#   Run `python scripts/prepare_nhanes.py` first to generate the cleaned CSV.
#
# Usage (from backend/ directory):
#   python train_bodyfat.py

import os
import json
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error
import joblib

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
CSV_PATH   = os.path.join(BASE_DIR, "data", "nhanes", "nhanes_cleaned.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "bodyfat_model.pkl")
INFO_PATH  = os.path.join(MODELS_DIR, "model_info.json")

os.makedirs(MODELS_DIR, exist_ok=True)

# Feature order must stay in sync with main.py
# Note: neck_cm is not available in NHANES 2017-2018 (discontinued after 2013-2014)
FEATURE_COLS = ["gender", "age", "height_cm", "weight_kg", "waist_cm", "hip_cm"]
TARGET_COL   = "body_fat_pct"


def load_data() -> pd.DataFrame:
    """
    Load the NHANES cleaned CSV produced by scripts/prepare_nhanes.py.

    Expected columns:
      gender       0=male, 1=female
      age          years (18+)
      height_cm
      weight_kg
      waist_cm
      hip_cm
      neck_cm
      body_fat_pct  (target — DXA or BMI-based fallback)
    """
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"{CSV_PATH} not found.\n"
            "Run `python scripts/prepare_nhanes.py` first to download and "
            "prepare the NHANES dataset."
        )

    df = pd.read_csv(CSV_PATH)
    df = df.dropna(subset=FEATURE_COLS + [TARGET_COL])
    return df


def evaluate(model, X: pd.DataFrame, y: pd.Series, label: str) -> dict:
    """Print and return MAE + R² for a given split/subset."""
    preds = model.predict(X)
    mae = mean_absolute_error(y, preds)
    r2  = r2_score(y, preds)
    print(f"  {label:<20} MAE: {mae:.2f}%  R²: {r2:.3f}  (n={len(y)})")
    return {"mae": round(mae, 3), "r2": round(r2, 3), "n": len(y)}


def train_and_save():
    """
    End-to-end training pipeline:

    1. Load + validate cleaned NHANES dataset.
    2. Gender-stratified 80/20 train/test split.
    3. Train RandomForestRegressor.
    4. Evaluate combined + per-gender.
    5. Save model and model_info.json.
    """
    print("=== Bodyfat Model Training (NHANES 2017-2018) ===\n")

    df = load_data()
    print(f"Loaded {len(df)} rows")

    male_count   = (df["gender"] == 0).sum()
    female_count = (df["gender"] == 1).sum()
    print(f"  Males   (0): {male_count}")
    print(f"  Females (1): {female_count}\n")

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    # Stratify by gender so both sexes are represented proportionally
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,
        stratify=df["gender"],
    )

    print(f"Train: {len(X_train)} rows  |  Test: {len(X_test)} rows\n")

    # ── Model ────────────────────────────────────────────────────────────────
    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=12,          # cap depth to reduce overfitting
        min_samples_leaf=4,
        random_state=42,
        n_jobs=-1,
    )
    print("Training RandomForestRegressor …")
    model.fit(X_train, y_train)
    print("Done.\n")

    # ── Evaluation ───────────────────────────────────────────────────────────
    print("=== Evaluation ===")
    all_metrics    = evaluate(model, X_test, y_test, "All users")

    male_mask   = X_test["gender"] == 0
    female_mask = X_test["gender"] == 1
    male_metrics   = evaluate(model, X_test[male_mask],   y_test[male_mask],   "Males only")
    female_metrics = evaluate(model, X_test[female_mask], y_test[female_mask], "Females only")

    # Warn if either gender misses the target accuracy threshold
    target_mae = 4.0
    for label, m in [("Males", male_metrics), ("Females", female_metrics)]:
        if m["mae"] > target_mae:
            print(f"  [WARN] {label} MAE {m['mae']:.2f}% exceeds target of {target_mae}%")
        else:
            print(f"  [OK]   {label} MAE {m['mae']:.2f}% meets target (< {target_mae}%)")

    # ── Save model ───────────────────────────────────────────────────────────
    print(f"\nSaving model to {MODEL_PATH} …")
    joblib.dump(model, MODEL_PATH)

    # ── Save model_info.json ─────────────────────────────────────────────────
    info = {
        "trained_on":   "NHANES 2017-2018",
        "n_samples":    int(len(df)),
        "n_male":       int(male_count),
        "n_female":     int(female_count),
        "features":     FEATURE_COLS,
        "gender_encoding": {"0": "male", "1": "female"},
        "overall_mae":  all_metrics["mae"],
        "overall_r2":   all_metrics["r2"],
        "male_mae":     male_metrics["mae"],
        "male_r2":      male_metrics["r2"],
        "female_mae":   female_metrics["mae"],
        "female_r2":    female_metrics["r2"],
        "trained_at":   datetime.now(timezone.utc).isoformat(),
    }
    with open(INFO_PATH, "w") as fh:
        json.dump(info, fh, indent=2)

    print(f"Saved model info to {INFO_PATH}")
    print("\nTraining complete.")


if __name__ == "__main__":
    train_and_save()
