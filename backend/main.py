from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import cv2
from PIL import Image
import io
import joblib
import os

app = FastAPI(title="AI Body Analyzer")

# -------------------------------------------------
# CORS – allow browser clients to call API
# (For a school/portfolio project, it's fine to open this up.
#  If you lock this down later, swap allow_origins=["*"] for a list.)
# -------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # allow all origins (Vercel, localhost, etc.)
    allow_credentials=False,    # must be False when using "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# Load ML model (if present)
# -------------------------------------------------
MODEL_PATH = "bodyfat_model.joblib"
bodyfat_model = None

if os.path.exists(MODEL_PATH):
    try:
        bodyfat_model = joblib.load(MODEL_PATH)
        print("✅ Loaded bodyfat model from", MODEL_PATH)
    except Exception as e:
        print("⚠️ Could not load model:", e)
else:
    print("⚠️ bodyfat_model.joblib not found. Falling back to heuristic.")

# -------------------------------------------------
# Response schema
# -------------------------------------------------
class AnalysisResponse(BaseModel):
    bodyfat: float
    category: str
    goal_suggestion: str
    suggested_calories: int
    notes: list[str]

# -------------------------------------------------
# Helper: extract numeric features + shape metrics
# -------------------------------------------------
def extract_image_features(image_bytes: bytes):
    """
    Returns:
      feature_vec: (1,5) numpy array for the ML model
      metrics: dict with simple shape features for heuristics
    """
    # Load with PIL then convert to OpenCV format
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    pil_img = pil_img.resize((256, 256))
    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Normalize + threshold to get a rough silhouette
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    contours, _ = cv2.findContours(
        thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    img_h, img_w = gray.shape[:2]

    if not contours:
        # fallback vector + neutral metrics
        vec = np.array([170, 75, 85, 38, 95], dtype=float)
        metrics = {
            "aspect_ratio": 1.6,
            "area_ratio": 0.3,
            "width_ratio": 0.35,
        }
        return vec.reshape(1, -1), metrics

    # --------------------------------------------
    # Pick a "person-like" contour rather than
    # blindly taking the largest area.
    # --------------------------------------------
    best = None
    best_score = -1e9

    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        area = cv2.contourArea(c)

        aspect_ratio = h / (w + 1e-6)
        area_ratio = area / (img_h * img_w + 1e-6)
        width_ratio = w / (img_w + 1e-6)

        # Heuristic "human shape" score:
        # - Prefer aspect ratio around ~2 (taller than wide)
        # - Penalize very tiny or full-width silhouettes
        # - Penalize silhouettes that are almost the whole frame
        score = 0.0
        score -= abs(aspect_ratio - 2.0)               # closer to 2 is better
        score -= max(0.0, (width_ratio - 0.6)) * 2.0   # penalize very wide
        score -= max(0.0, (0.18 - width_ratio)) * 2.0  # penalize very narrow
        score -= max(0.0, (area_ratio - 0.7)) * 2.0    # penalize if fills frame
        score -= max(0.0, (0.04 - area_ratio)) * 2.0   # penalize if too tiny

        if score > best_score:
            best_score = score
            best = (x, y, w, h, area_ratio, aspect_ratio, width_ratio)

    if best is None:
        # Fallback: use the largest contour if scoring fails for some reason
        largest = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest)
        area_ratio = cv2.contourArea(largest) / (img_h * img_w + 1e-6)
        aspect_ratio = h / (w + 1e-6)
        width_ratio = w / (img_w + 1e-6)
    else:
        x, y, w, h, area_ratio, aspect_ratio, width_ratio = best

    # pseudo "measurements" for the ML model
    height_cm = 170
    weight_kg = 70 + (area_ratio - 0.25) * 80
    waist_cm = 80 + (1.8 - aspect_ratio) * 15
    neck_cm = 38 - (aspect_ratio - 1.5) * 4
    hip_cm = waist_cm + 5

    vec = np.array([height_cm, weight_kg, waist_cm, neck_cm, hip_cm], dtype=float)
    metrics = {
        "aspect_ratio": float(aspect_ratio),
        "area_ratio": float(area_ratio),
        "width_ratio": float(width_ratio),
    }

    # Uncomment for debugging:
    # print("Metrics:", metrics)

    return vec.reshape(1, -1), metrics

# -------------------------------------------------
# Heuristic bodyfat from shape metrics
# -------------------------------------------------
def heuristic_bodyfat_from_shape(metrics: dict) -> float:
    """
    Use width + area + aspect ratio to estimate a more realistic bodyfat.
    Wider silhouettes tend higher BF, but we downweight extreme cases
    and bump mid-width, mid-area bodies up a bit.
    """
    width_ratio = metrics.get("width_ratio", 0.35)
    area_ratio = metrics.get("area_ratio", 0.30)
    aspect_ratio = metrics.get("aspect_ratio", 1.7)  # height / width

    # ---- Base estimate from width (how much of frame they take horizontally) ----
    if width_ratio < 0.22:
        bf = 11.0          # very lean / skinny
    elif width_ratio < 0.30:
        bf = 17.0          # lean-ish
    elif width_ratio < 0.38:
        bf = 25.0          # average–higher
    elif width_ratio < 0.48:
        bf = 30.0          # higher bodyfat
    else:
        bf = 36.0          # obese-ish range

    # ---- Fine-tune with area (how much of frame the silhouette fills) ----
    if area_ratio < 0.06:
        bf -= 1.0          # tiny silhouette in frame → slightly leaner
    elif area_ratio > 0.40:
        bf += 3.0          # fills a lot of frame → bump up

    # Special case: mid-width, mid-area bodies trend higher BF
    if 0.28 <= width_ratio <= 0.40 and 0.08 <= area_ratio <= 0.18:
        bf += 5.0

    # ---- Fine-tune with aspect ratio (tall vs wide) ----
    if aspect_ratio > 2.2:
        bf -= 1.0          # very tall & narrow → a bit leaner
    elif aspect_ratio > 1.8:
        bf -= 0.5
    elif aspect_ratio < 1.4:
        bf += 2.0          # short / wide → push up slightly

    # Clamp to sane range
    bf = max(5.0, min(45.0, bf))
    return bf

# -------------------------------------------------
# Helper: map bodyfat to category + recommendations
# -------------------------------------------------
def interpretation_and_plan(bodyfat: float) -> tuple[str, str, int, list[str]]:
    bf = float(bodyfat)

    if bf < 12:
        category = "Very lean / athletic"
        goal = "Maintenance or lean bulk"
        cals = 2600
        notes = [
            "You’re already quite lean. Focus on performance and strength.",
            "A small surplus or maintenance calories can help build muscle.",
            "Keep protein high (0.8–1.0 g per lb of body weight).",
        ]
    elif bf < 20:
        category = "Average to fit"
        goal = "Mild cut or recomposition"
        cals = 2300
        notes = [
            "You’re in a good spot. Decide if you want more definition or muscle.",
            "A small deficit with 3–4 days of lifting works well.",
            "Aim for 7–9k steps per day to support fat loss.",
        ]
    elif bf < 28:
        category = "Higher bodyfat"
        goal = "Fat loss (cutting)"
        cals = 2100
        notes = [
            "Focus on a moderate calorie deficit you can stick to.",
            "Combine 3–4 lifting sessions with daily walking (7–10k steps).",
            "Try not to lose more than ~1% of bodyweight per week.",
        ]
    else:
        category = "Obese range (est.)"
        goal = "Gradual fat loss"
        cals = 1900
        notes = [
            "Start with simple, sustainable changes. No crash diets.",
            "Prioritize walking and light activity to build habits.",
            "Talk with a healthcare provider before aggressive dieting or training.",
        ]

    return category, goal, cals, notes

# -------------------------------------------------
# Endpoint: analyze image
# -------------------------------------------------
@app.post("/analyze-image", response_model=AnalysisResponse)
async def analyze_image(file: UploadFile = File(...)):
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg"):
        raise HTTPException(status_code=400, detail="Please upload a JPG or PNG image.")

    image_bytes = await file.read()

    # 1) extract features and shape metrics
    features, metrics = extract_image_features(image_bytes)

    # 2) heuristic estimate from body shape
    heuristic_bf = heuristic_bodyfat_from_shape(metrics)

    # 3) combine with ML prediction if available
    if bodyfat_model is not None:
        try:
            pred = bodyfat_model.predict(features)
            model_bf = float(pred[0])
            # blend them – heuristic dominates so extremes make sense
            bodyfat = 0.7 * heuristic_bf + 0.3 * model_bf
        except Exception as e:
            print("Model prediction error:", e)
            bodyfat = heuristic_bf
    else:
        bodyfat = heuristic_bf

    # final clamp
    bodyfat = max(4.0, min(45.0, bodyfat))

    # 4) interpret + plan
    category, goal, cals, notes = interpretation_and_plan(bodyfat)

    return AnalysisResponse(
        bodyfat=round(bodyfat, 1),
        category=category,
        goal_suggestion=goal,
        suggested_calories=int(cals),
        notes=notes,
    )

@app.get("/")
def root():
    return {"message": "AI Body Analyzer backend is running"}
