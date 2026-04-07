# train_bodyfat.py
#
# Train a RandomForestRegressor on the multi-cycle NHANES dataset and save it
# as models/bodyfat_model.pkl for the FastAPI backend to use.
#
# This version (Fix 2) adds:
#   - Derived features: BMI, waist-to-hip ratio, waist-to-height ratio
#   - Stratified split by BF% bins (better representation across ranges)
#   - Per-gender and per-age-group bias analysis
#   - Validation against known test profiles
#   - Tuned hyperparameters for reduced overestimation
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

# Expanded feature set — includes derived features computed from base measurements.
# Feature order must stay in sync with main.py (main.py reads model_info.json
# to determine which features to build at inference time).
FEATURE_COLS = [
    "gender",       # 0=male, 1=female
    "age",          # years
    "height_cm",
    "weight_kg",
    "waist_cm",
    "hip_cm",
    "bmi",          # derived: weight_kg / (height_m ^ 2)
    "whr",          # derived: waist_cm / hip_cm
    "whtr",         # derived: waist_cm / height_cm
]
TARGET_COL = "body_fat_pct"

# ── Validation test profiles ────────────────────────────────────────────────
# After training, predictions are checked against these expected ranges.
# If any profile is off by > 3%, a warning is printed.
VALIDATION_PROFILES = [
    {
        "label": "Athletic young male (24, 6'0\", 180lbs, 32\" waist, 38\" hip)",
        "gender": 0, "age": 24,
        "height_cm": 182.88, "weight_kg": 81.65,
        "waist_cm": 81.28, "hip_cm": 96.52,
        "expected_min": 12.0, "expected_max": 16.0,
    },
    {
        "label": "Average male cutting (28, 5'11\", 195lbs, 36\" waist, 40\" hip)",
        "gender": 0, "age": 28,
        "height_cm": 180.34, "weight_kg": 88.45,
        "waist_cm": 91.44, "hip_cm": 101.60,
        "expected_min": 18.0, "expected_max": 22.0,
    },
    {
        "label": "Lean male bulking (22, 5'9\", 155lbs, 30\" waist, 36\" hip)",
        "gender": 0, "age": 22,
        "height_cm": 175.26, "weight_kg": 70.31,
        "waist_cm": 76.20, "hip_cm": 91.44,
        "expected_min": 10.0, "expected_max": 14.0,
    },
    {
        "label": "Average female (30, 5'6\", 145lbs, 30\" waist, 40\" hip)",
        "gender": 1, "age": 30,
        "height_cm": 167.64, "weight_kg": 65.77,
        "waist_cm": 76.20, "hip_cm": 101.60,
        "expected_min": 24.0, "expected_max": 28.0,
    },
]


def load_data() -> pd.DataFrame:
    """
    Load the NHANES cleaned CSV produced by scripts/prepare_nhanes.py
    and add derived feature columns.
    """
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"{CSV_PATH} not found.\n"
            "Run `python scripts/prepare_nhanes.py` first to download and "
            "prepare the NHANES dataset."
        )

    df = pd.read_csv(CSV_PATH)

    # Compute derived features
    df["bmi"]  = df["weight_kg"] / ((df["height_cm"] / 100) ** 2)
    df["whr"]  = df["waist_cm"] / df["hip_cm"]
    df["whtr"] = df["waist_cm"] / df["height_cm"]

    # Drop any rows with NaN in features or target
    df = df.dropna(subset=FEATURE_COLS + [TARGET_COL])

    # Sanity check derived features (avoid div-by-zero artifacts)
    df = df[df["bmi"].between(12, 70)]
    df = df[df["whr"].between(0.5, 1.5)]
    df = df[df["whtr"].between(0.2, 0.9)]

    return df


def evaluate(model, X: pd.DataFrame, y: pd.Series, label: str) -> dict:
    """Print and return MAE + R² for a given split/subset."""
    preds = model.predict(X)
    mae = mean_absolute_error(y, preds)
    r2  = r2_score(y, preds)
    print(f"  {label:<20} MAE: {mae:.2f}%  R²: {r2:.3f}  (n={len(y)})")
    return {"mae": round(mae, 3), "r2": round(r2, 3), "n": len(y)}


def analyze_bias(model, X_test: pd.DataFrame, y_test: pd.Series):
    """Print bias analysis by gender and age group."""
    test_df = X_test.copy()
    test_df["actual"]    = y_test.values
    test_df["predicted"] = model.predict(X_test)
    test_df["error"]     = test_df["predicted"] - test_df["actual"]

    print("\n=== Bias Analysis ===")
    print("(positive = overestimation, negative = underestimation)")

    # By gender
    print("\n  By gender:")
    for gender, label in [(0, "Male"), (1, "Female")]:
        subset = test_df[test_df["gender"] == gender]
        if len(subset) > 0:
            mean_err = subset["error"].mean()
            print(f"    {label:<10} mean error: {mean_err:+.2f}%  (n={len(subset)})")

    # By age group
    print("\n  By age group:")
    bins   = [18, 25, 30, 35, 40, 50, 65, 100]
    labels = ["18-24", "25-29", "30-34", "35-39", "40-49", "50-64", "65+"]
    test_df["age_group"] = pd.cut(test_df["age"], bins=bins, labels=labels, right=False)
    for grp in labels:
        subset = test_df[test_df["age_group"] == grp]
        if len(subset) > 0:
            mean_err = subset["error"].mean()
            flag = " ⚠️" if abs(mean_err) > 2.0 else " ✅"
            print(f"    {grp:<10} mean error: {mean_err:+.2f}%  (n={len(subset)}){flag}")

    # By gender + age group (males under 35 — the problem demographic)
    print("\n  Males under 35 (target demographic for fix):")
    young_males = test_df[(test_df["gender"] == 0) & (test_df["age"] < 35)]
    if len(young_males) > 0:
        mean_err = young_males["error"].mean()
        flag = " ⚠️" if abs(mean_err) > 2.0 else " ✅"
        print(f"    mean error: {mean_err:+.2f}%  (n={len(young_males)}){flag}")


def validate_profiles(model):
    """Run the model against known validation test profiles."""
    print("\n=== Validation Test Profiles ===")
    all_pass = True
    for profile in VALIDATION_PROFILES:
        features = {}
        for col in FEATURE_COLS:
            if col in profile:
                features[col] = profile[col]
        # Compute derived
        features["bmi"]  = profile["weight_kg"] / ((profile["height_cm"] / 100) ** 2)
        features["whr"]  = profile["waist_cm"] / profile["hip_cm"]
        features["whtr"] = profile["waist_cm"] / profile["height_cm"]

        X = np.array([[features[f] for f in FEATURE_COLS]], dtype=float)
        pred = float(model.predict(X)[0])
        pred = round(pred, 1)

        in_range = profile["expected_min"] <= pred <= profile["expected_max"]
        status = "✅ PASS" if in_range else "❌ FAIL"
        if not in_range:
            all_pass = False

        print(f"\n  {profile['label']}")
        print(f"    Predicted: {pred}%  Expected: {profile['expected_min']}-{profile['expected_max']}%  {status}")

    if all_pass:
        print("\n  All validation profiles passed!")
    else:
        print("\n  ⚠️  Some profiles failed — consider tuning hyperparameters or rebalancing data.")

    return all_pass


def train_and_save():
    """
    End-to-end training pipeline:

    1. Load + validate cleaned multi-cycle NHANES dataset.
    2. Compute derived features (BMI, WHR, WHTR).
    3. Stratified 80/20 train/test split (by BF% bins).
    4. Train RandomForestRegressor with tuned hyperparameters.
    5. Evaluate combined + per-gender.
    6. Bias analysis by gender and age group.
    7. Validate against known test profiles.
    8. Save model and model_info.json.
    """
    print("=== Bodyfat Model Training (Multi-Cycle NHANES) ===\n")

    df = load_data()
    print(f"Loaded {len(df)} rows")

    male_count   = (df["gender"] == 0).sum()
    female_count = (df["gender"] == 1).sum()
    print(f"  Males   (0): {male_count}")
    print(f"  Females (1): {female_count}")

    # Show cycle distribution if available
    if "cycle" in df.columns:
        print(f"\n  Rows per cycle:")
        for label, count in df["cycle"].value_counts().sort_index().items():
            print(f"    {label}: {count}")

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    # Stratify by BF% bins for better representation across the full range
    # (prevents overrepresentation of average ranges from skewing predictions)
    bf_bins = pd.cut(y, bins=10, labels=False)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,
        stratify=bf_bins,
    )

    print(f"\nTrain: {len(X_train)} rows  |  Test: {len(X_test)} rows\n")

    # ── Model ────────────────────────────────────────────────────────────────
    # Tuned hyperparameters to reduce overfitting and overestimation bias:
    #   - min_samples_split=10: prevents splits on small noisy subsets
    #   - min_samples_leaf=5: ensures leaf nodes have enough samples
    #   - max_features='sqrt': decorrelates trees for better generalization
    #   - n_estimators=200: sufficient ensemble size
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        min_samples_split=10,
        min_samples_leaf=5,
        max_features="sqrt",
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
    target_mae = 3.5  # tighter target with multi-cycle data
    for label, m in [("Males", male_metrics), ("Females", female_metrics)]:
        if m["mae"] > target_mae:
            print(f"  [WARN] {label} MAE {m['mae']:.2f}% exceeds target of {target_mae}%")
        else:
            print(f"  [OK]   {label} MAE {m['mae']:.2f}% meets target (< {target_mae}%)")

    # ── Bias Analysis ────────────────────────────────────────────────────────
    analyze_bias(model, X_test, y_test)

    # ── Validation Profiles ──────────────────────────────────────────────────
    validate_profiles(model)

    # ── Feature importances ──────────────────────────────────────────────────
    print("\n=== Feature Importances ===")
    importances = model.feature_importances_
    for feat, imp in sorted(zip(FEATURE_COLS, importances), key=lambda x: -x[1]):
        bar = "█" * int(imp * 50)
        print(f"  {feat:<12} {imp:.3f}  {bar}")

    # ── Save model ───────────────────────────────────────────────────────────
    print(f"\nSaving model to {MODEL_PATH} …")
    joblib.dump(model, MODEL_PATH)

    # ── Save model_info.json ─────────────────────────────────────────────────
    info = {
        "trained_on":       "NHANES multi-cycle (2011-2018)",
        "n_samples":        int(len(df)),
        "n_male":           int(male_count),
        "n_female":         int(female_count),
        "features":         FEATURE_COLS,
        "gender_encoding":  {"0": "male", "1": "female"},
        "overall_mae":      all_metrics["mae"],
        "overall_r2":       all_metrics["r2"],
        "male_mae":         male_metrics["mae"],
        "male_r2":          male_metrics["r2"],
        "female_mae":       female_metrics["mae"],
        "female_r2":        female_metrics["r2"],
        "target_mae":       target_mae,
        "trained_at":       datetime.now(timezone.utc).isoformat(),
    }
    with open(INFO_PATH, "w") as fh:
        json.dump(info, fh, indent=2)

    print(f"Saved model info to {INFO_PATH}")
    print("\n✅ Training complete.")
    print("\nNote: Once this model is deployed, the apply_bf_correction() in main.py")
    print("will be automatically skipped because model_info.json now includes 'bmi'")
    print("in its features list (_MODEL_HAS_EXPANDED_FEATURES = True).")


if __name__ == "__main__":
    train_and_save()
