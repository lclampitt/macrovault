# main.py
#
# FastAPI backend for the AI Body Analyzer.
# - /analyze-measurements: main endpoint, uses dataset-trained RandomForest
# - /analyze-image: experimental, heuristic-only (no model blending)
# - /: simple health check

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import cv2
from PIL import Image
import io
import joblib
import os

# FastAPI app instance used by uvicorn / deployment
app = FastAPI(title="AI Body Analyzer")

# -------------------------------------------------
# CORS – allow browser clients (React frontend) to call API
# -------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    # For a school/portfolio project it's OK to allow all origins.
    # In production we would restrict this to the deployed frontend URL.
    allow_origins=["*"],  # OK for school/portfolio; tighten for production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# Load ML model (dataset-trained, numeric metrics)
# -------------------------------------------------
# Build an absolute path to the saved RandomForest model
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "bodyfat_model.joblib")
bodyfat_model = None

# Try to load the model at startup so each request can reuse it
if os.path.exists(MODEL_PATH):
    try:
        bodyfat_model = joblib.load(MODEL_PATH)
        print("✅ Loaded bodyfat model from", MODEL_PATH)
    except Exception as e:
        # If the model fails to load, we log and the endpoint will later 500
        print("⚠️ Could not load model:", e)
else:
    # Helpful log if the training step hasn't been run yet
    print("⚠️ bodyfat_model.joblib not found. /analyze-measurements will error until you train it.")


# -------------------------------------------------
# Pydantic schemas – define request/response shapes
# -------------------------------------------------
class AnalysisResponse(BaseModel):
    """
    Unified response format for both measurement-based
    and image-based bodyfat analysis.
    """
    bodyfat: float
    category: str
    goal_suggestion: str
    suggested_calories: int
    notes: list[str]


class MeasurementRequest(BaseModel):
    """
    Measurement-based analysis request.

    Frontend collects imperial units and converts to:
      gender: 0=female, 1=male
      height_cm, weight_kg, waist_cm, hip_cm, neck_cm
    """
    gender: int          # 0=female, 1=male
    height_cm: float
    weight_kg: float
    waist_cm: float
    hip_cm: float
    neck_cm: float

# -------------------------------------------------
# Helper: extract numeric features + shape metrics from image
# (For experimental image-based analysis; not dataset-trained)
# -------------------------------------------------
def extract_image_features(image_bytes: bytes):
    """
    Returns:
      feature_vec: (1,6) numpy array (pseudo measurements)
      metrics: dict with simple shape features for heuristics

    feature_vec is a rough guess of:
      [gender, height_cm, weight_kg, waist_cm, hip_cm, neck_cm]

    This is intentionally approximate – it's here to show an experimental
    computer-vision path, not a production-ready bodyfat estimator.
    """
    # Load image from bytes and normalize to fixed size
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    pil_img = pil_img.resize((256, 256))
    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    # Basic preprocessing: grayscale, blur, Otsu threshold
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Find outer contours – used as candidate "silhouettes"
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    img_h, img_w = gray.shape[:2]

    if not contours:
        # If no contour is found, return a safe default vector + neutral metrics
        vec = np.array([1, 170, 75, 85, 95, 38], dtype=float)  # [gender, h, w, waist, hip, neck]
        metrics = {
            "aspect_ratio": 1.6,
            "area_ratio": 0.3,
            "width_ratio": 0.35,
        }
        return vec.reshape(1, -1), metrics

    # Pick the most "human-like" contour based on simple heuristics
    best = None
    best_score = -1e9

    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        area = cv2.contourArea(c)

        aspect_ratio = h / (w + 1e-6)
        area_ratio = area / (img_h * img_w + 1e-6)
        width_ratio = w / (img_w + 1e-6)

        # Score contours based on expected torso proportions
        score = 0.0
        score -= abs(aspect_ratio - 2.0)
        score -= max(0.0, (width_ratio - 0.6)) * 2.0
        score -= max(0.0, (0.18 - width_ratio)) * 2.0
        score -= max(0.0, (area_ratio - 0.7)) * 2.0
        score -= max(0.0, (0.04 - area_ratio)) * 2.0

        if score > best_score:
            best_score = score
            best = (x, y, w, h, area_ratio, aspect_ratio, width_ratio)

    # Fallback: if scoring fails, use largest contour
    if best is None:
        largest = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest)
        area_ratio = cv2.contourArea(largest) / (img_h * img_w + 1e-6)
        aspect_ratio = h / (w + 1e-6)
        width_ratio = w / (img_w + 1e-6)
    else:
        x, y, w, h, area_ratio, aspect_ratio, width_ratio = best

    # Pseudo-measurements for debugging / optional model use
    # (These are *not* real anthropometric measurements.)
    gender = 1  # assume male by default
    height_cm = 170.0
    weight_kg = 70 + (area_ratio - 0.25) * 80
    waist_cm = 80 + (1.8 - aspect_ratio) * 15
    neck_cm = 38 - (aspect_ratio - 1.5) * 4
    hip_cm = waist_cm + 5

    vec = np.array([gender, height_cm, weight_kg, waist_cm, hip_cm, neck_cm], dtype=float)
    metrics = {
        "aspect_ratio": float(aspect_ratio),
        "area_ratio": float(area_ratio),
        "width_ratio": float(width_ratio),
    }

    return vec.reshape(1, -1), metrics


# -------------------------------------------------
# Heuristic bodyfat from shape metrics (for image-based path)
# -------------------------------------------------
def heuristic_bodyfat_from_shape(metrics: dict) -> float:
    """
    Very rough, rule-based estimator that maps shape metrics
    (contour width/area/aspect ratio) to an approximate bodyfat %.

    This is intentionally simple and transparent for the project demo,
    not a clinically accurate tool.
    """
    width_ratio = metrics.get("width_ratio", 0.35)
    area_ratio = metrics.get("area_ratio", 0.30)
    aspect_ratio = metrics.get("aspect_ratio", 1.7)

    # 1) Base estimate from silhouette width relative to image width
    if width_ratio < 0.22:
        bf = 11.0
    elif width_ratio < 0.30:
        bf = 17.0
    elif width_ratio < 0.38:
        bf = 25.0
    elif width_ratio < 0.48:
        bf = 30.0
    else:
        bf = 36.0

    # 2) Fine-tune based on how much of the frame the body occupies
    if area_ratio < 0.06:
        bf -= 1.0
    elif area_ratio > 0.40:
        bf += 3.0

    # 3) Adjust if someone is wide but not very tall (or vice versa)
    if 0.28 <= width_ratio <= 0.40 and 0.08 <= area_ratio <= 0.18:
        bf += 5.0

    # 4) Aspect ratio tweaks (taller/narrower vs shorter/wider)
    if aspect_ratio > 2.2:
        bf -= 1.0
    elif aspect_ratio > 1.8:
        bf -= 0.5
    elif aspect_ratio < 1.4:
        bf += 2.0

    # Clamp to a reasonable range for human bodyfat %
    bf = max(5.0, min(45.0, bf))
    return bf


# -------------------------------------------------
# Helper: map bodyfat to category + recommendations
# -------------------------------------------------
def interpretation_and_plan(bodyfat: float) -> tuple[str, str, int, list[str]]:
    """
    Turn a numeric bodyfat % into:
      - a category label
      - a recommended goal
      - a default calorie target
      - high-level coaching notes
    """
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
# Measurement-based analysis endpoint (dataset model)
# -------------------------------------------------

# ============ FUNCTIONAL REQUIREMENT: FR-5 / FR-6 ============
# System shall accept measurement inputs and return an ML-based body fat estimate.
@app.post("/analyze-measurements", response_model=AnalysisResponse)
async def analyze_measurements(data: MeasurementRequest):
    """
    Main endpoint used by the frontend.

    1. Validates incoming measurements via Pydantic.
    2. Builds a feature vector.
    3. Calls the RandomForest model for prediction.
    4. Interprets the bodyfat % into a plan.
    """
    if bodyfat_model is None:
        # If the model hasn't been trained / loaded yet, fail fast
        raise HTTPException(
            status_code=500,
            detail="Bodyfat model is not loaded. Train it with train_bodyfat.py.",
        )

    # Convert the Pydantic object to a 2D numpy array for scikit-learn
    features = np.array(
        [
            [
                data.gender,
                data.height_cm,
                data.weight_kg,
                data.waist_cm,
                data.hip_cm,
                data.neck_cm,
            ]
        ],
        dtype=float,
    )

    try:
        pred = bodyfat_model.predict(features)
        bodyfat = float(pred[0])
    except Exception as e:
        # Surface any model issues as a 500 instead of crashing the server
        print("Model prediction error (measurements):", e)
        raise HTTPException(
            status_code=500,
            detail="Could not generate prediction from measurements.",
        )

    # Clamp prediction to a realistic range
    bodyfat = max(4.0, min(45.0, bodyfat))

    category, goal, cals, notes = interpretation_and_plan(bodyfat)

    # The response model standardizes the shape sent back to the React app
    
    # ============ FUNCTIONAL REQUIREMENT: FR-7 ============
    # System shall return body fat %, category, and calorie guidance to the frontend.
    return AnalysisResponse(
        bodyfat=round(bodyfat, 1),
        category=category,
        goal_suggestion=goal,
        suggested_calories=int(cals),
        notes=notes,
    )


# -------------------------------------------------
# Image-based analysis (experimental – heuristic only)
# -------------------------------------------------

# ============ FUNCTIONAL REQUIREMENT: FR-8 / FR-9 ============
# System shall process an uploaded image in-memory and not permanently store it.
@app.post("/analyze-image", response_model=AnalysisResponse)
async def analyze_image(file: UploadFile = File(...)):
    """
    Experimental endpoint that:
      - accepts a JPG/PNG upload,
      - extracts simple silhouette metrics,
      - uses a rule-based heuristic to estimate bodyfat.

    This is intentionally separate from the dataset-trained model so we
    can clearly state its limitations in the writeup.
    """
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg"):
        raise HTTPException(
            status_code=400, detail="Please upload a JPG or PNG image."
        )

    image_bytes = await file.read()

    # 1) Extract silhouette metrics (contour geometry)
    _features, metrics = extract_image_features(image_bytes)

    # 2) Heuristic estimate from shape ONLY (no ML blending here)
    bodyfat = heuristic_bodyfat_from_shape(metrics)

    # 3) Clamp + interpret results into a plan
    bodyfat = max(4.0, min(45.0, bodyfat))
    category, goal, cals, notes = interpretation_and_plan(bodyfat)

    return AnalysisResponse(
        bodyfat=round(bodyfat, 1),
        category=category,
        goal_suggestion=goal,
        suggested_calories=int(cals),
        notes=notes,
    )


# -------------------------------------------------
# Health check – useful for debugging / uptime checks
# -------------------------------------------------
@app.get("/")
def root():
    """
    Simple health-check endpoint that confirms the backend is running.
    """
    return {"message": "AI Body Analyzer backend is running"}
