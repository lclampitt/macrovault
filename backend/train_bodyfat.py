import os
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error
import joblib

MODEL_PATH = "bodyfat_model.joblib"

def generate_synthetic_data(n=800):
    rng = np.random.default_rng(42)
    gender = rng.integers(0, 2, size=n)  # 0=female, 1=male

    height_cm = rng.normal(175, 10, size=n)      # 155–195ish
    weight_kg = rng.normal(80, 15, size=n)      # 50–110ish
    waist_cm  = rng.normal(85, 12, size=n)
    hip_cm    = rng.normal(95, 10, size=n)
    neck_cm   = rng.normal(37, 3, size=n)

    # Simple "true" formula with noise
    # Rough: bf% grows with waist/hip, shrinks with neck, a bit with gender
    bodyfat = (
        0.25 * (waist_cm - neck_cm) +
        0.10 * (hip_cm - 90) +
        0.05 * (weight_kg - 70) +
        5 * (1 - gender)            # females tend to have higher %
    )
    bodyfat = np.clip(bodyfat + rng.normal(0, 2, size=n), 5, 45)

    df = pd.DataFrame({
        "gender": gender,
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "waist_cm": waist_cm,
        "hip_cm": hip_cm,
        "neck_cm": neck_cm,
        "bodyfat_pct": bodyfat,
    })
    return df

def load_or_create_data():
    """
    If you later add a real CSV (e.g. bodyfat_training.csv),
    you can load it here instead of synthetic.
    """
    csv_path = "bodyfat_training.csv"
    if os.path.exists(csv_path):
        print(f"Loading real dataset from {csv_path}")
        df = pd.read_csv(csv_path)
        # Expect columns: gender, height_cm, weight_kg, waist_cm, hip_cm, neck_cm, bodyfat_pct
        return df
    else:
        print("No real CSV found; generating synthetic data instead.")
        return generate_synthetic_data()

def train_and_save():
    df = load_or_create_data()

    feature_cols = ["gender", "height_cm", "weight_kg", "waist_cm", "hip_cm", "neck_cm"]
    target_col = "bodyfat_pct"

    X = df[feature_cols]
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=None,
        random_state=42
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)

    print(f"R^2:  {r2:.3f}")
    print(f"MAE:  {mae:.2f} % body fat")

    joblib.dump(model, MODEL_PATH)
    print(f"✅ Saved model to {MODEL_PATH}")

if __name__ == "__main__":
    train_and_save()
