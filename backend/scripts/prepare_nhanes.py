"""
prepare_nhanes.py

Downloads raw NHANES XPT files from the CDC for multiple survey cycles,
merges them, cleans the data, and writes a ready-to-train CSV to:
  data/nhanes/nhanes_cleaned.csv

Cycles included (recommended pre-pandemic):
  2011-2012  (cycle G)
  2013-2014  (cycle H)
  2015-2016  (cycle I)
  2017-2018  (cycle J)

Combined dataset is ~8,000-10,000+ usable rows across all cycles,
which significantly reduces bias compared to any single cycle alone.

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

# ── NHANES cycles to download ───────────────────────────────────────────────
# Each cycle has demographic (DEMO), body measurement (BMX), and DXA (DXX) files.
# URL pattern: https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/{year}/DataFiles/{FILE}.XPT
NHANES_CYCLES = [
    {"label": "2011-2012", "year": 2011, "suffix": "G"},
    {"label": "2013-2014", "year": 2013, "suffix": "H"},
    {"label": "2015-2016", "year": 2015, "suffix": "I"},
    {"label": "2017-2018", "year": 2017, "suffix": "J"},
]

_XPT_MAGIC = b"HEADER RECORD"
_HEADERS   = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def _get_cycle_urls(suffix: str, year: int) -> dict:
    """Build download URLs for a single NHANES cycle."""
    base = f"https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/{year}/DataFiles"
    return {
        f"DEMO_{suffix}.XPT": f"{base}/DEMO_{suffix}.XPT",
        f"BMX_{suffix}.XPT":  f"{base}/BMX_{suffix}.XPT",
        f"DXX_{suffix}.XPT":  f"{base}/DXX_{suffix}.XPT",
    }


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
    Returns the file path or None if download failed.
    """
    dest = os.path.join(RAW_DIR, name)

    if os.path.exists(dest):
        if _is_valid_xpt(dest):
            size_kb = os.path.getsize(dest) // 1024
            print(f"    [skip] {name} already downloaded ({size_kb} KB)")
            return dest
        else:
            print(f"    [re-download] {name} cached file is not a valid XPT — re-fetching")
            os.remove(dest)

    print(f"    [download] {name} …", end=" ", flush=True)
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


def _load_cycle(cycle: dict) -> pd.DataFrame | None:
    """
    Download, load, and merge one NHANES cycle.
    Returns a DataFrame with standardized columns or None if data is unavailable.
    """
    label  = cycle["label"]
    suffix = cycle["suffix"]
    year   = cycle["year"]
    urls   = _get_cycle_urls(suffix, year)

    print(f"\n  Cycle {label} (suffix {suffix}):")

    # Download all files
    paths = {}
    for name, url in urls.items():
        p = download_file(name, url)
        paths[name] = p

    # Load demographics + body measurements (required)
    demo_key = f"DEMO_{suffix}.XPT"
    bmx_key  = f"BMX_{suffix}.XPT"
    dxx_key  = f"DXX_{suffix}.XPT"

    if not paths.get(demo_key) or not paths.get(bmx_key):
        print(f"    [skip cycle] Missing DEMO or BMX files for {label}")
        return None

    demo = load_xpt(paths[demo_key])
    bmx  = load_xpt(paths[bmx_key])

    # Merge demo + body measurements on subject ID (SEQN)
    df = pd.merge(
        demo[["SEQN", "RIAGENDR", "RIDAGEYR"]],
        bmx[["SEQN"] + [c for c in ["BMXWT", "BMXHT", "BMXWAIST", "BMXHIP"] if c in bmx.columns]],
        on="SEQN",
        how="inner",
    )

    # Try to merge DXA body fat data (preferred ground truth)
    dxx = None
    if paths.get(dxx_key) and os.path.exists(paths[dxx_key]):
        try:
            dxx = load_xpt(paths[dxx_key])
            # Search for total body fat % column (DXDTOPF or similar)
            dxa_cols = [c for c in dxx.columns if "TOPF" in c or "TOBF" in c]
            if dxa_cols:
                bf_col = dxa_cols[0]
                print(f"    Using DXA column: {bf_col}")
                df = pd.merge(df, dxx[["SEQN", bf_col]], on="SEQN", how="inner")
                df = df.rename(columns={bf_col: "body_fat_pct"})
            else:
                print(f"    DXX loaded but no TOPF/TOBF column — using fallback")
                dxx = None
        except Exception as e:
            print(f"    DXX could not load — {e}")
            dxx = None

    if dxx is None:
        # Fallback: Deurenberg BMI-based body fat % formula
        # BF% = (1.20 × BMI) + (0.23 × age) − (10.8 × sex) − 5.4
        # where sex = 1 for male, 0 for female
        if "BMXWT" in df.columns and "BMXHT" in df.columns:
            print(f"    Fallback: Deurenberg BMI-based body fat % formula")
            df["_bmi"] = df["BMXWT"] / ((df["BMXHT"] / 100) ** 2)
            df["_sex_numeric"] = (df["RIAGENDR"] == 1).astype(float)  # 1=male in NHANES
            df["body_fat_pct"] = (
                1.20 * df["_bmi"]
                + 0.23 * df["RIDAGEYR"]
                - 10.8 * df["_sex_numeric"]
                - 5.4
            )
            df = df.drop(columns=["_bmi", "_sex_numeric"])
        else:
            print(f"    [skip cycle] Cannot compute body fat — missing columns")
            return None

    # Standardize column names
    df = df.rename(columns={
        "RIDAGEYR": "age",
        "BMXWT":    "weight_kg",
        "BMXHT":    "height_cm",
        "BMXWAIST": "waist_cm",
        "BMXHIP":   "hip_cm",
    })
    df["gender"] = (df["RIAGENDR"] == 2).astype(int)  # 0=male, 1=female
    df["cycle"]  = label
    df = df.drop(columns=["RIAGENDR", "SEQN"], errors="ignore")

    print(f"    Rows after merge: {len(df)}")
    return df


def main():
    print("=== NHANES Multi-Cycle Data Preparation ===")
    print(f"    Cycles: {', '.join(c['label'] for c in NHANES_CYCLES)}\n")

    # ── 1. Download + load each cycle ────────────────────────────────────────
    print("Downloading and loading files:")
    cycle_dfs = []
    for cycle in NHANES_CYCLES:
        df = _load_cycle(cycle)
        if df is not None and len(df) > 0:
            cycle_dfs.append(df)

    if not cycle_dfs:
        print("\n[ERROR] No usable data from any cycle. Check network / CDC URLs.")
        return

    df = pd.concat(cycle_dfs, ignore_index=True)
    print(f"\nCombined raw rows: {len(df)}")

    # ── 2. Clean ─────────────────────────────────────────────────────────────
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

    # Valid weight and height ranges
    df = df[(df["weight_kg"] >= 30) & (df["weight_kg"] <= 250)]
    df = df[df["height_cm"] > 130]
    print(f"  After weight/height:  {len(df)} rows")

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

    # ── 3. Save ──────────────────────────────────────────────────────────────
    final_cols = ["gender", "age", "height_cm", "weight_kg",
                  "waist_cm", "hip_cm", "body_fat_pct", "cycle"]
    df = df[final_cols].reset_index(drop=True)
    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    df.to_csv(OUTPUT_CSV, index=False)

    # ── 4. Summary ───────────────────────────────────────────────────────────
    male   = df[df["gender"] == 0]
    female = df[df["gender"] == 1]
    print(f"\n=== Summary ===")
    print(f"Total rows:     {len(df)}")
    print(f"Males   (0):    {len(male)}  — mean BF%: {male['body_fat_pct'].mean():.1f}%")
    print(f"Females (1):    {len(female)}  — mean BF%: {female['body_fat_pct'].mean():.1f}%")
    print(f"\nRows per cycle:")
    for label, group in df.groupby("cycle"):
        print(f"  {label}: {len(group)} rows")
    print(f"\nAge distribution:")
    bins = [18, 25, 35, 45, 55, 65, 80]
    labels = ["18-24", "25-34", "35-44", "45-54", "55-64", "65-80"]
    df["_age_group"] = pd.cut(df["age"], bins=bins, labels=labels, right=False)
    for grp, count in df["_age_group"].value_counts().sort_index().items():
        print(f"  {grp}: {count}")
    print(f"\nSaved to: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
