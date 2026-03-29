"""
prepare_nhanes.py

Downloads raw NHANES 2017-2018 XPT files from the CDC, merges them,
cleans the data, and writes a ready-to-train CSV to:
  data/nhanes/nhanes_cleaned.csv

Run from the backend/ directory:
  python scripts/prepare_nhanes.py
"""

import os
import numpy as np
import pandas as pd
import requests

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR    = os.path.join(BASE_DIR, "data", "nhanes", "raw")
OUTPUT_CSV = os.path.join(BASE_DIR, "data", "nhanes", "nhanes_cleaned.csv")

os.makedirs(RAW_DIR, exist_ok=True)

# ── NHANES 2017-2018 (cycle J) file URLs ─────────────────────────────────────
# CDC restructured their file hosting — correct base path:
#   https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/
NHANES_FILES = {
    "DEMO_J.XPT": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DEMO_J.XPT",
    "BMX_J.XPT":  "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/BMX_J.XPT",
    "DXX_J.XPT":  "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DXX_J.XPT",
}

_XPT_MAGIC = b"HEADER RECORD"
_HEADERS   = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def _is_valid_xpt(path: str) -> bool:
    """Return True if the file starts with the XPT magic header bytes."""
    try:
        with open(path, "rb") as fh:
            return fh.read(13) == _XPT_MAGIC
    except OSError:
        return False


def download_file(name: str, url: str) -> str:
    """
    Download an XPT file to RAW_DIR.
    Skips if a valid XPT is already cached; re-downloads if the cached
    file is corrupt/HTML (e.g. from a previous failed attempt).
    """
    dest = os.path.join(RAW_DIR, name)

    if os.path.exists(dest):
        if _is_valid_xpt(dest):
            size_kb = os.path.getsize(dest) // 1024
            print(f"  [skip] {name} already downloaded ({size_kb} KB)")
            return dest
        else:
            print(f"  [re-download] {name} cached file is not a valid XPT — re-fetching")
            os.remove(dest)

    print(f"  [download] {name} …", end=" ", flush=True)
    try:
        r = requests.get(url, headers=_HEADERS, allow_redirects=True, timeout=120)
        r.raise_for_status()
        data = r.content
        if not data.startswith(_XPT_MAGIC):
            raise ValueError(f"Response is not an XPT file (got {data[:80]!r})")
        with open(dest, "wb") as fh:
            fh.write(data)
        print(f"done ({len(data) // 1024} KB)")
    except Exception as e:
        print(f"FAILED — {e}")
        return None
    return dest


def load_xpt(path: str) -> pd.DataFrame:
    """Load a SAS XPT file into a DataFrame."""
    with open(path, "rb") as fh:
        return pd.read_sas(fh, format="xport", encoding="utf-8")


def main():
    print("=== NHANES 2017-2018 Data Preparation ===\n")

    # ── 1. Download ──────────────────────────────────────────────────────────
    print("Downloading files:")
    paths = {}
    for name, url in NHANES_FILES.items():
        p = download_file(name, url)
        paths[name] = p

    # ── 2. Load ──────────────────────────────────────────────────────────────
    print("\nLoading XPT files:")

    demo = load_xpt(paths["DEMO_J.XPT"])
    print(f"  DEMO_J: {len(demo)} rows, cols: {list(demo.columns[:8])} …")

    bmx = load_xpt(paths["BMX_J.XPT"])
    print(f"  BMX_J:  {len(bmx)} rows, cols: {list(bmx.columns[:8])} …")

    dxx_path = paths.get("DXX_J.XPT")
    dxx = None
    if dxx_path and os.path.exists(dxx_path):
        try:
            dxx = load_xpt(dxx_path)
            print(f"  DXX_J:  {len(dxx)} rows (DXA body composition)")
        except Exception as e:
            print(f"  DXX_J:  could not load — {e}")
            dxx = None
    else:
        print("  DXX_J:  not available — will use BMI-based BF% fallback")

    # ── 3. Merge ─────────────────────────────────────────────────────────────
    print("\nMerging on SEQN …")
    # Note: BMXNECK (neck circumference) was discontinued after NHANES 2013-2014
    # and is not present in the 2017-2018 cycle.
    df = pd.merge(
        demo[["SEQN", "RIAGENDR", "RIDAGEYR"]],
        bmx[["SEQN", "BMXWT", "BMXHT", "BMXWAIST", "BMXHIP"]],
        on="SEQN",
        how="inner",
    )

    # DXA body fat % is the ground-truth target when available
    if dxx is not None:
        # DXDTOPF = total body fat percentage
        dxa_cols = [c for c in dxx.columns if "TOPF" in c or "TOBF" in c]
        if dxa_cols:
            bf_col = dxa_cols[0]
            print(f"  Using DXA column: {bf_col}")
            df = pd.merge(df, dxx[["SEQN", bf_col]], on="SEQN", how="inner")
            df = df.rename(columns={bf_col: "body_fat_pct"})
        else:
            print(f"  DXX loaded but no TOPF/TOBF column found — using fallback")
            dxx = None

    if dxx is None:
        # Fallback: Deurenberg BMI-based body fat % formula
        # BF% = (1.20 × BMI) + (0.23 × age) − (10.8 × sex) − 5.4
        # where sex = 1 for male, 0 for female
        print("  Fallback: Deurenberg BMI-based body fat % formula")
        df["_bmi"] = df["BMXWT"] / ((df["BMXHT"] / 100) ** 2)
        df["_sex_numeric"] = (df["RIAGENDR"] == 1).astype(float)  # 1=male in NHANES
        df["body_fat_pct"] = (
            1.20 * df["_bmi"]
            + 0.23 * df["RIDAGEYR"]
            - 10.8 * df["_sex_numeric"]
            - 5.4
        )
        df = df.drop(columns=["_bmi", "_sex_numeric"])

    # ── 4. Rename columns ────────────────────────────────────────────────────
    # NHANES gender: 1=male, 2=female → encode as 0=male, 1=female
    df = df.rename(
        columns={
            "RIDAGEYR": "age",
            "BMXWT":    "weight_kg",
            "BMXHT":    "height_cm",
            "BMXWAIST": "waist_cm",
            "BMXHIP":   "hip_cm",
        }
    )
    df["gender"] = (df["RIAGENDR"] == 2).astype(int)  # 0=male, 1=female
    df = df.drop(columns=["RIAGENDR", "SEQN"], errors="ignore")

    # ── 5. Clean ─────────────────────────────────────────────────────────────
    print("\nCleaning data …")
    required_cols = ["gender", "age", "weight_kg", "height_cm", "waist_cm",
                     "hip_cm", "body_fat_pct"]
    before = len(df)

    # Drop rows with any nulls in required columns
    df = df.dropna(subset=required_cols)
    print(f"  After null drop:      {len(df)} rows (removed {before - len(df)})")

    # Adults only
    df = df[df["age"] >= 18]
    print(f"  After age >= 18:      {len(df)} rows")

    # Physiologically valid body fat range
    df = df[(df["body_fat_pct"] >= 3) & (df["body_fat_pct"] <= 60)]
    print(f"  After BF% 3–60:       {len(df)} rows")

    # Valid weight range
    df = df[(df["weight_kg"] >= 30) & (df["weight_kg"] <= 250)]
    print(f"  After weight 30–250:  {len(df)} rows")

    # Remove outliers: > 4 SD from mean for numeric columns
    numeric_cols = ["weight_kg", "height_cm", "waist_cm", "hip_cm", "body_fat_pct"]
    mask = pd.Series([True] * len(df), index=df.index)
    for col in numeric_cols:
        mean = df[col].mean()
        std  = df[col].std()
        mask &= (df[col] - mean).abs() <= 4 * std
    before_outlier = len(df)
    df = df[mask]
    print(f"  After 4-SD outliers:  {len(df)} rows (removed {before_outlier - len(df)})")

    # ── 6. Save ──────────────────────────────────────────────────────────────
    final_cols = ["gender", "age", "height_cm", "weight_kg",
                  "waist_cm", "hip_cm", "body_fat_pct"]
    df = df[final_cols].reset_index(drop=True)
    df.to_csv(OUTPUT_CSV, index=False)

    # ── 7. Summary ───────────────────────────────────────────────────────────
    male   = df[df["gender"] == 0]
    female = df[df["gender"] == 1]
    print(f"\n=== Summary ===")
    print(f"Total rows:     {len(df)}")
    print(f"Males   (0):    {len(male)}  — mean BF%: {male['body_fat_pct'].mean():.1f}%")
    print(f"Females (1):    {len(female)}  — mean BF%: {female['body_fat_pct'].mean():.1f}%")
    print(f"Saved to:       {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
