# main.py
#
# FastAPI backend for the AI Body Analyzer.
# - /analyze-measurements: main endpoint, uses dataset-trained RandomForest
# - /analyze-image: experimental, heuristic-only (no model blending)
# - /: simple health check

from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, List, Optional
import numpy as np
import cv2
from PIL import Image
import io
import joblib
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import stripe
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime
import json
try:
    import anthropic as _anthropic_mod
    _anthropic_available = True
except ImportError:
    _anthropic_mod = None
    _anthropic_available = False
try:
    from posthog import Posthog as _Posthog
    _posthog_available = True
except ImportError:
    _Posthog = None
    _posthog_available = False

load_dotenv()

# PostHog client
_posthog_key = os.environ.get("POSTHOG_KEY", "")
_posthog_host = os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com")
posthog_client = _Posthog(_posthog_key, host=_posthog_host) if (_posthog_available and _posthog_key) else None

# Stripe config
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID_PRO      = os.environ.get("STRIPE_PRICE_ID_PRO", "")
STRIPE_PRICE_ID_PRO_PLUS = os.environ.get("STRIPE_PRICE_ID_PRO_PLUS", "")
FRONTEND_URL             = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# Contact email config (Outlook SMTP)
CONTACT_SMTP_USER     = os.environ.get("CONTACT_SMTP_USER", "")
CONTACT_SMTP_PASSWORD = os.environ.get("CONTACT_SMTP_PASSWORD", "")
CONTACT_RECIPIENT     = "lclampitt44@outlook.com"

# Supabase admin client (service role — never expose this key to the browser)
_supabase_url = os.environ.get("SUPABASE_URL", "")
_supabase_service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase_admin: Client = create_client(_supabase_url, _supabase_service_key) if _supabase_url and _supabase_service_key else None

# Anthropic (Claude) client for AI meal suggestions
_anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
anthropic_client = _anthropic_mod.Anthropic(api_key=_anthropic_key) if _anthropic_available and _anthropic_key else None

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
MODEL_PATH = os.path.join(BASE_DIR, "models", "bodyfat_model.pkl")
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
    bmr: Optional[int] = None
    tdee: Optional[int] = None
    deficit_or_surplus: Optional[int] = None


class ContactRequest(BaseModel):
    name: str
    email: str
    message: str


class MeasurementRequest(BaseModel):
    """
    Measurement-based analysis request.

    Frontend collects imperial units and converts to:
      gender: 0=male, 1=female
      age: years
      height_cm, weight_kg, waist_cm, hip_cm

    neck_cm is accepted but not used by the model — BMXNECK was discontinued
    in NHANES after 2013-2014 so it is absent from the training data.
    """
    gender: int          # 0=male, 1=female
    age: float
    height_cm: float
    weight_kg: float
    waist_cm: float
    hip_cm: float
    neck_cm: Optional[float] = None        # accepted for API compatibility, not used in model
    activity_level: str = "moderate"       # sedentary | light | moderate | active | extra
    goal: str = "maintain"                 # cut | aggressive_cut | maintain | bulk | aggressive_bulk
    user_id: Optional[str] = None          # used for usage tracking


# -------------------------------------------------
# Contact form endpoint
# -------------------------------------------------

@app.post("/contact")
async def contact(req: ContactRequest):
    if not CONTACT_SMTP_USER or not CONTACT_SMTP_PASSWORD:
        raise HTTPException(status_code=503, detail="Email service not configured.")

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Gainlytics Contact: {req.name}"
        msg["From"]    = CONTACT_SMTP_USER
        msg["To"]      = CONTACT_RECIPIENT
        msg["Reply-To"] = req.email

        body = (
            f"Name: {req.name}\n"
            f"Email: {req.email}\n\n"
            f"Message:\n{req.message}"
        )
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP("smtp-mail.outlook.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.login(CONTACT_SMTP_USER, CONTACT_SMTP_PASSWORD)
            server.sendmail(CONTACT_SMTP_USER, CONTACT_RECIPIENT, msg.as_string())

        return {"ok": True}
    except Exception as e:
        print(f"Contact email error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message. Please try again.")


# -------------------------------------------------
# Usage tracking helpers
# -------------------------------------------------

def _current_month() -> str:
    return datetime.utcnow().strftime("%Y-%m")

def _get_plan(user_id: str) -> str:
    """Return 'pro', 'pro_plus', or 'free' for a given user."""
    if not supabase_admin:
        return "free"
    result = supabase_admin.table("profiles").select("subscription_tier").eq("id", user_id).maybe_single().execute()
    return (result.data or {}).get("subscription_tier", "free")

def can_use_ai_suggestions(user_id: str) -> bool:
    """Return True if the user has AI suggestion uses remaining (Pro+ only, 300/month)."""
    if not supabase_admin:
        return True
    try:
        result = supabase_admin.table("profiles") \
            .select("subscription_tier,ai_suggestions_this_month,ai_suggestions_month") \
            .eq("id", user_id).maybe_single().execute()
        profile = result.data or {}
    except Exception:
        # Columns may not exist yet — allow usage
        return True
    if profile.get("subscription_tier") != "pro_plus":
        return False
    month = _current_month()
    if profile.get("ai_suggestions_month", "") != month:
        return True  # New month, counter resets
    return (profile.get("ai_suggestions_this_month") or 0) < 300

def increment_ai_suggestion_use(user_id: str, count: int = 1):
    """Increment the AI suggestion counter for this month."""
    if not supabase_admin:
        return
    try:
        month = _current_month()
        result = supabase_admin.table("profiles") \
            .select("ai_suggestions_this_month,ai_suggestions_month") \
            .eq("id", user_id).maybe_single().execute()
        profile = result.data or {}
        if profile.get("ai_suggestions_month", "") != month:
            supabase_admin.table("profiles").update({
                "ai_suggestions_this_month": count,
                "ai_suggestions_month": month,
            }).eq("id", user_id).execute()
        else:
            current = profile.get("ai_suggestions_this_month") or 0
            supabase_admin.table("profiles").update({
                "ai_suggestions_this_month": current + count,
            }).eq("id", user_id).execute()
    except Exception:
        pass  # Columns may not exist yet — silently skip tracking

def can_use_analyzer(user_id: str) -> bool:
    """Return True if the user is allowed to run an analysis."""
    if not supabase_admin:
        return True
    result = supabase_admin.table("profiles") \
        .select("subscription_tier,analyzer_uses_this_month,analyzer_month") \
        .eq("id", user_id).maybe_single().execute()
    profile = result.data or {}
    if profile.get("subscription_tier") in ("pro", "pro_plus"):
        return True
    month = _current_month()
    # Reset counter if we're in a new month
    if profile.get("analyzer_month", "") != month:
        supabase_admin.table("profiles").update({
            "analyzer_uses_this_month": 0,
            "analyzer_month": month,
        }).eq("id", user_id).execute()
        return True
    return (profile.get("analyzer_uses_this_month") or 0) < 3

def increment_analyzer_use(user_id: str) -> None:
    """Increment the monthly analyzer counter for a user."""
    if not supabase_admin:
        return
    month = _current_month()
    result = supabase_admin.table("profiles") \
        .select("analyzer_uses_this_month,analyzer_month") \
        .eq("id", user_id).maybe_single().execute()
    profile = result.data or {}
    if profile.get("analyzer_month", "") != month:
        new_count = 1
    else:
        new_count = (profile.get("analyzer_uses_this_month") or 0) + 1
    supabase_admin.table("profiles").update({
        "analyzer_uses_this_month": new_count,
        "analyzer_month": month,
    }).eq("id", user_id).execute()

def can_log_workout(user_id: str) -> bool:
    """Return True if the user is under their workout log limit."""
    if not supabase_admin:
        return True
    if _get_plan(user_id) in ("pro", "pro_plus"):
        return True
    result = supabase_admin.table("workouts").select("id").eq("user_id", user_id).execute()
    count = len(result.data) if result.data else 0
    return count < 10

def get_usage_summary(user_id: str) -> dict:
    """Return a full usage summary for the given user."""
    if not supabase_admin:
        return {"analyzerUsed": 0, "analyzerLimit": 3, "workoutCount": 0, "workoutLimit": 10, "aiSuggestionsUsed": 0, "aiSuggestionsLimit": 300, "plan": "free"}
    profile_res = supabase_admin.table("profiles") \
        .select("subscription_tier,analyzer_uses_this_month,analyzer_month,ai_suggestions_this_month,ai_suggestions_month") \
        .eq("id", user_id).maybe_single().execute()
    profile = profile_res.data or {}
    plan = profile.get("subscription_tier", "free")
    is_paid = plan in ("pro", "pro_plus")
    month = _current_month()
    analyzer_used = 0 if profile.get("analyzer_month", "") != month \
        else (profile.get("analyzer_uses_this_month") or 0)
    ai_used = 0 if profile.get("ai_suggestions_month", "") != month \
        else (profile.get("ai_suggestions_this_month") or 0)
    workout_res = supabase_admin.table("workouts").select("id").eq("user_id", user_id).execute()
    workout_count = len(workout_res.data) if workout_res.data else 0
    return {
        "analyzerUsed":       analyzer_used,
        "analyzerLimit":      None if is_paid else 3,
        "workoutCount":       workout_count,
        "workoutLimit":       None if is_paid else 10,
        "aiSuggestionsUsed":  ai_used,
        "aiSuggestionsLimit": 300,
        "plan":               plan,
    }

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
# TDEE calculation (Mifflin-St Jeor)
# -------------------------------------------------
_ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,
    "light":     1.375,
    "moderate":  1.55,
    "active":    1.725,
    "extra":     1.9,
}

_GOAL_ADJUSTMENTS = {
    "cut":            -500,
    "aggressive_cut": -750,
    "maintain":          0,
    "bulk":            300,
    "aggressive_bulk": 500,
}

def calculate_tdee(
    weight_kg: float,
    height_cm: float,
    age: float,
    gender: int,
    activity_level: str,
    goal: str,
) -> tuple[int, int, int, int]:
    """
    Returns (bmr, tdee, suggested_calories, deficit_or_surplus).

    BMR via Mifflin-St Jeor:
      Male   (gender=0): 10w + 6.25h - 5a + 5
      Female (gender=1): 10w + 6.25h - 5a - 161
    """
    gender_offset = 5 if gender == 0 else -161
    bmr  = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + gender_offset
    mult = _ACTIVITY_MULTIPLIERS.get(activity_level, 1.55)
    tdee = bmr * mult
    adj  = _GOAL_ADJUSTMENTS.get(goal, 0)
    suggested = tdee + adj
    return round(bmr), round(tdee), round(suggested), round(adj)


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
            detail="Bodyfat model is not loaded. Run scripts/prepare_nhanes.py then train_bodyfat.py.",
        )

    # Convert the Pydantic object to a 2D numpy array for scikit-learn.
    # Feature order must match training: [gender, age, height_cm, weight_kg,
    #                                      waist_cm, hip_cm]
    features = np.array(
        [
            [
                data.gender,
                data.age,
                data.height_cm,
                data.weight_kg,
                data.waist_cm,
                data.hip_cm,
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

    category, goal_suggestion, _cals_unused, notes = interpretation_and_plan(bodyfat)

    # Replace hardcoded calorie bucket with proper TDEE (Mifflin-St Jeor)
    bmr, tdee, suggested_calories, deficit_or_surplus = calculate_tdee(
        weight_kg=data.weight_kg,
        height_cm=data.height_cm,
        age=data.age,
        gender=data.gender,
        activity_level=data.activity_level,
        goal=data.goal,
    )

    # Track analysis event
    if posthog_client:
        try:
            posthog_client.capture(
                data.user_id or "anonymous",
                "analysis_completed",
                {
                    "method": "measurements",
                    "bodyfat_category": category,
                    "gender": data.gender,
                },
            )
        except Exception:
            pass

    # ============ FUNCTIONAL REQUIREMENT: FR-7 ============
    # System shall return body fat %, category, and calorie guidance to the frontend.
    return AnalysisResponse(
        bodyfat=round(bodyfat, 1),
        category=category,
        goal_suggestion=goal_suggestion,
        suggested_calories=suggested_calories,
        notes=notes,
        bmr=bmr,
        tdee=tdee,
        deficit_or_surplus=deficit_or_surplus,
    )


# -------------------------------------------------
# Image-based analysis (experimental – heuristic only)
# -------------------------------------------------

# ============ FUNCTIONAL REQUIREMENT: FR-8 / FR-9 ============
# System shall process an uploaded image in-memory and not permanently store it.
@app.post("/analyze-image", response_model=AnalysisResponse)
async def analyze_image(file: UploadFile = File(...), user_id: Optional[str] = Form(None)):
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

    # Track analysis event
    if posthog_client:
        try:
            posthog_client.capture(
                user_id or "anonymous",
                "analysis_completed",
                {
                    "method": "image",
                    "bodyfat_category": category,
                },
            )
        except Exception:
            pass

    return AnalysisResponse(
        bodyfat=round(bodyfat, 1),
        category=category,
        goal_suggestion=goal,
        suggested_calories=int(cals),
        notes=notes,
    )


# -------------------------------------------------
# Stripe: create Checkout session (Pro plan)
# -------------------------------------------------
class CheckoutRequest(BaseModel):
    user_id: str
    email: str | None = None

@app.post("/stripe/checkout")
async def create_checkout_session(body: CheckoutRequest):
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured.")
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{"price": STRIPE_PRICE_ID_PRO, "quantity": 1}],
            mode="subscription",
            success_url=f"{FRONTEND_URL}/billing?success=true",
            cancel_url=f"{FRONTEND_URL}/billing?canceled=true",
            client_reference_id=body.user_id,
            customer_email=body.email or None,
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------
# Stripe: create Checkout session (Pro+ plan)
# -------------------------------------------------
class CheckoutProPlusRequest(BaseModel):
    user_id: str
    email: str | None = None

@app.post("/stripe/checkout-pro-plus")
async def create_checkout_pro_plus(body: CheckoutProPlusRequest):
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured.")
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{"price": STRIPE_PRICE_ID_PRO_PLUS, "quantity": 1}],
            mode="subscription",
            success_url=f"{FRONTEND_URL}/billing?success=true",
            cancel_url=f"{FRONTEND_URL}/billing?canceled=true",
            client_reference_id=body.user_id,
            customer_email=body.email or None,
            metadata={"tier": "pro_plus"},
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------
# Stripe: webhook handler
# -------------------------------------------------
@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload   = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except Exception as sig_err:
        raise HTTPException(status_code=400, detail=f"Signature error: {sig_err}")

    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase admin client not configured.")

    # Helper to safely read a field from a Stripe object or dict
    def _get(obj, key, default=None):
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    try:
        event_type = _get(event, "type")
        event_data = _get(event, "data")
        obj = _get(event_data, "object") if event_data else None

        if not obj:
            return {"status": "ok", "note": "no data object"}

        if event_type == "checkout.session.completed":
            user_id         = _get(obj, "client_reference_id")
            customer_id     = _get(obj, "customer")
            subscription_id = _get(obj, "subscription")

            # Determine tier from metadata
            metadata = _get(obj, "metadata") or {}
            tier_val = _get(metadata, "tier") if not isinstance(metadata, dict) else metadata.get("tier")
            tier = "pro_plus" if tier_val == "pro_plus" else "pro"

            if user_id:
                supabase_admin.table("profiles").upsert({
                    "id": user_id,
                    "subscription_tier": tier,
                    "stripe_customer_id": customer_id,
                    "stripe_subscription_id": subscription_id,
                }).execute()
                if posthog_client:
                    try:
                        posthog_client.capture(user_id, "subscription_started", {"plan": tier})
                    except Exception:
                        pass

        elif event_type == "customer.subscription.deleted":
            customer_id = _get(obj, "customer")
            if customer_id:
                supabase_admin.table("profiles").update({
                    "subscription_tier": "free",
                    "stripe_subscription_id": None,
                }).eq("stripe_customer_id", customer_id).execute()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Webhook handler error: {type(e).__name__}: {str(e)}")

    return {"status": "ok"}


# -------------------------------------------------
# Stripe: customer portal session
# -------------------------------------------------
class PortalRequest(BaseModel):
    stripe_customer_id: str

@app.post("/stripe/portal")
async def create_portal_session(body: PortalRequest):
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured.")
    try:
        session = stripe.billing_portal.Session.create(
            customer=body.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/billing",
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------
# Usage summary endpoint
# -------------------------------------------------
@app.get("/usage/{user_id}")
async def usage_summary(user_id: str):
    """Return usage counts and limits for the given user."""
    return get_usage_summary(user_id)


# -------------------------------------------------
# Workout save endpoint (enforces free-tier limit)
# -------------------------------------------------
class WorkoutSaveRequest(BaseModel):
    user_id: str
    workout_date: str
    workout_name: str
    exercises: List[Any]

@app.post("/workouts/save")
async def save_workout(body: WorkoutSaveRequest):
    """
    Save a new workout for a user.
    Returns 403 if a free user has reached the 10-workout limit.
    """
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Database not configured.")

    if not can_log_workout(body.user_id):
        raise HTTPException(
            status_code=403,
            detail={"error": "limit_reached", "feature": "workout_logger"},
        )

    try:
        result = supabase_admin.table("workouts").insert({
            "user_id":       body.user_id,
            "workout_date":  body.workout_date,
            "workout_name":  body.workout_name,
            "exercises":     body.exercises,
        }).execute()
        if posthog_client:
            try:
                posthog_client.capture(
                    body.user_id,
                    "workout_saved",
                    {"exercise_count": len(body.exercises)},
                )
            except Exception:
                pass
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------
# Health check – useful for debugging / uptime checks
# -------------------------------------------------
@app.get("/")
def root():
    """
    Simple health-check endpoint that confirms the backend is running.
    """
    return {"message": "AI Body Analyzer backend is running"}


# -------------------------------------------------
# Meal Planner: AI meal suggestions
# -------------------------------------------------
class MealSuggestRequest(BaseModel):
    user_id: str
    day: str
    meal_type: str  # 'breakfast' | 'lunch' | 'dinner'
    remaining_calories: int = 600
    remaining_protein: float = 40
    remaining_carbs: float = 60
    remaining_fat: float = 20
    goal: str = "maintenance"
    diet_preference: str = "standard"

@app.post("/meal-planner/suggest")
async def suggest_meal(body: MealSuggestRequest):
    """Generate 3 AI meal suggestions using Claude."""
    # Pro+ check
    plan = _get_plan(body.user_id)
    if plan != "pro_plus":
        raise HTTPException(status_code=403, detail="Pro+ subscription required for AI suggestions.")
    if not can_use_ai_suggestions(body.user_id):
        raise HTTPException(status_code=429, detail="Monthly AI suggestion limit reached (300/month).")

    if not anthropic_client:
        raise HTTPException(status_code=500, detail="AI service not configured.")

    try:
        message = anthropic_client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1200,
            system="You are a nutrition expert helping someone hit their daily macro targets. Return ONLY valid JSON, no markdown, no explanation.",
            messages=[{
                "role": "user",
                "content": f"""Suggest 3 realistic {body.meal_type} options for someone on a {body.goal} goal with a {body.diet_preference} diet preference.

Remaining macros for today:
- Calories: {body.remaining_calories} kcal
- Protein: {body.remaining_protein}g
- Carbs: {body.remaining_carbs}g
- Fat: {body.remaining_fat}g

For each meal return:
- meal_name: specific and descriptive
- ingredients: a single string listing all ingredients with quantities, comma-separated (e.g. "150g grilled chicken breast, 100g mixed greens, 50g cherry tomatoes")
- calories: integer
- protein: number (grams)
- carbs: number (grams)
- fat: number (grams)

Make suggestions realistic and specific. Quantities should be precise. Each meal should fit within the remaining macros without going significantly over.

Return a JSON array of 3 objects only."""
            }]
        )

        text = message.content[0].text.strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        meals = json.loads(text)
        # Normalize field names: Claude may return protein_g instead of protein, or ingredients as array
        for m in meals:
            if isinstance(m.get("ingredients"), list):
                m["ingredients"] = ", ".join(m["ingredients"])
            for old_key, new_key in [("protein_g", "protein"), ("carbs_g", "carbs"), ("fat_g", "fat")]:
                if old_key in m and new_key not in m:
                    m[new_key] = m.pop(old_key)
        increment_ai_suggestion_use(body.user_id)
        return {"suggestions": meals}

    except json.JSONDecodeError:
        # Return fallback suggestions if Claude doesn't return valid JSON
        fallbacks = {
            "breakfast": [
                {"meal_name": "Greek Yogurt Parfait", "ingredients": "200g Greek yogurt, 30g granola, 100g mixed berries, 10g honey", "calories": 350, "protein": 25, "carbs": 45, "fat": 8},
                {"meal_name": "Egg White Omelette", "ingredients": "4 egg whites, 30g spinach, 30g feta cheese, 1 slice whole wheat toast", "calories": 280, "protein": 28, "carbs": 20, "fat": 8},
                {"meal_name": "Overnight Oats", "ingredients": "60g rolled oats, 200ml almond milk, 1 scoop protein powder, 1 banana", "calories": 420, "protein": 30, "carbs": 55, "fat": 10},
            ],
            "lunch": [
                {"meal_name": "Grilled Chicken Salad", "ingredients": "150g grilled chicken breast, 100g mixed greens, 50g cherry tomatoes, 30g feta, 15ml olive oil dressing", "calories": 450, "protein": 42, "carbs": 15, "fat": 22},
                {"meal_name": "Turkey Wrap", "ingredients": "120g sliced turkey breast, 1 whole wheat tortilla, 30g hummus, 50g mixed greens, 30g avocado", "calories": 420, "protein": 35, "carbs": 35, "fat": 15},
                {"meal_name": "Tuna Rice Bowl", "ingredients": "150g canned tuna, 150g brown rice, 50g edamame, 30g cucumber, 10ml soy sauce", "calories": 480, "protein": 40, "carbs": 50, "fat": 10},
            ],
            "dinner": [
                {"meal_name": "Salmon with Vegetables", "ingredients": "180g Atlantic salmon fillet, 150g roasted broccoli, 150g sweet potato, 10ml olive oil", "calories": 520, "protein": 40, "carbs": 35, "fat": 22},
                {"meal_name": "Lean Beef Stir Fry", "ingredients": "150g lean beef strips, 100g bell peppers, 80g snap peas, 150g jasmine rice, 15ml teriyaki sauce", "calories": 550, "protein": 38, "carbs": 55, "fat": 15},
                {"meal_name": "Chicken Pasta", "ingredients": "130g grilled chicken breast, 80g whole wheat penne, 100g marinara sauce, 20g parmesan, 50g spinach", "calories": 500, "protein": 42, "carbs": 48, "fat": 12},
            ],
        }
        increment_ai_suggestion_use(body.user_id)
        return {"suggestions": fallbacks.get(body.meal_type, fallbacks["lunch"])}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI suggestion error: {str(e)}")


# -------------------------------------------------
# Meal Planner: AI suggest full week
# -------------------------------------------------
class WeekSuggestRequest(BaseModel):
    user_id: str
    goal: str = "maintenance"
    diet_preference: str = "standard"
    daily_targets: Optional[dict] = None  # {calories, protein, carbs, fat}

@app.post("/meal-planner/suggest-week")
async def suggest_week(body: WeekSuggestRequest):
    """Generate a full Mon-Fri meal plan (15 meals) using Claude."""
    plan = _get_plan(body.user_id)
    if plan != "pro_plus":
        raise HTTPException(status_code=403, detail="Pro+ subscription required for AI suggestions.")
    if not can_use_ai_suggestions(body.user_id):
        raise HTTPException(status_code=429, detail="Monthly AI suggestion limit reached (300/month).")

    if not anthropic_client:
        raise HTTPException(status_code=500, detail="AI service not configured.")

    targets = body.daily_targets or {"calories": 2000, "protein": 150, "carbs": 250, "fat": 65}

    try:
        message = anthropic_client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=4000,
            system="You are a nutrition expert creating weekly meal plans. Return ONLY valid JSON, no markdown, no explanation.",
            messages=[{
                "role": "user",
                "content": f"""Create a 5-day meal plan (Monday through Friday) with breakfast, lunch, and dinner for someone on a {body.goal} goal with a {body.diet_preference} diet preference.

Daily targets:
- Calories: {targets.get('calories', 2000)} kcal
- Protein: {targets.get('protein', 150)}g
- Carbs: {targets.get('carbs', 250)}g
- Fat: {targets.get('fat', 65)}g

Each day's 3 meals should roughly add up to the daily targets.

Return a JSON array of 15 objects, each with:
- day_of_week: 0 for monday, 1 for tuesday, 2 for wednesday, 3 for thursday, 4 for friday
- meal_type: "breakfast", "lunch", or "dinner"
- meal_name: specific and descriptive
- ingredients: a single string listing all ingredients with quantities, comma-separated
- calories: integer
- protein: number (grams)
- carbs: number (grams)
- fat: number (grams)

Vary the meals across days. Make them realistic and easy to prepare. Return the JSON array only."""
            }]
        )

        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        meals = json.loads(text)
        # Normalize: if ingredients came back as a list, join into a string
        for m in meals:
            if isinstance(m.get("ingredients"), list):
                m["ingredients"] = ", ".join(m["ingredients"])
        increment_ai_suggestion_use(body.user_id, count=15)
        return {"entries": meals}

    except json.JSONDecodeError:
        # Fallback: generate a basic week plan
        days = [0, 1, 2, 3, 4]
        fallback = []
        breakfast_opts = [
            {"meal_name": "Greek Yogurt Parfait", "ingredients": "200g Greek yogurt, 30g granola, 100g mixed berries", "calories": 350, "protein": 25, "carbs": 45, "fat": 8},
            {"meal_name": "Egg White Omelette", "ingredients": "4 egg whites, 30g spinach, 30g feta cheese, 1 toast", "calories": 280, "protein": 28, "carbs": 20, "fat": 8},
            {"meal_name": "Overnight Oats", "ingredients": "60g oats, 200ml almond milk, 1 scoop protein powder, 1 banana", "calories": 420, "protein": 30, "carbs": 55, "fat": 10},
            {"meal_name": "Protein Pancakes", "ingredients": "2 eggs, 1 banana, 30g protein powder, 15ml maple syrup", "calories": 380, "protein": 32, "carbs": 40, "fat": 10},
            {"meal_name": "Avocado Toast with Eggs", "ingredients": "2 slices sourdough, 1/2 avocado, 2 eggs, cherry tomatoes", "calories": 420, "protein": 20, "carbs": 35, "fat": 22},
        ]
        lunch_opts = [
            {"meal_name": "Grilled Chicken Salad", "ingredients": "150g chicken breast, 100g mixed greens, 50g tomatoes, 30g feta, 15ml dressing", "calories": 450, "protein": 42, "carbs": 15, "fat": 22},
            {"meal_name": "Turkey Wrap", "ingredients": "120g turkey breast, 1 tortilla, 30g hummus, 50g greens, 30g avocado", "calories": 420, "protein": 35, "carbs": 35, "fat": 15},
            {"meal_name": "Tuna Rice Bowl", "ingredients": "150g tuna, 150g brown rice, 50g edamame, 30g cucumber", "calories": 480, "protein": 40, "carbs": 50, "fat": 10},
            {"meal_name": "Chicken Burrito Bowl", "ingredients": "150g chicken, 100g rice, 50g black beans, 30g salsa, 30g cheese", "calories": 520, "protein": 40, "carbs": 50, "fat": 15},
            {"meal_name": "Salmon Poke Bowl", "ingredients": "130g salmon, 150g sushi rice, 50g cucumber, 30g avocado, 15ml soy sauce", "calories": 490, "protein": 35, "carbs": 48, "fat": 18},
        ]
        dinner_opts = [
            {"meal_name": "Salmon with Vegetables", "ingredients": "180g salmon, 150g broccoli, 150g sweet potato", "calories": 520, "protein": 40, "carbs": 35, "fat": 22},
            {"meal_name": "Lean Beef Stir Fry", "ingredients": "150g beef strips, 100g bell peppers, 80g snap peas, 150g rice", "calories": 550, "protein": 38, "carbs": 55, "fat": 15},
            {"meal_name": "Chicken Pasta", "ingredients": "130g chicken, 80g penne, 100g marinara sauce, 20g parmesan", "calories": 500, "protein": 42, "carbs": 48, "fat": 12},
            {"meal_name": "Turkey Meatballs", "ingredients": "150g ground turkey, 80g spaghetti, 100g tomato sauce, parsley", "calories": 480, "protein": 38, "carbs": 45, "fat": 14},
            {"meal_name": "Shrimp Tacos", "ingredients": "150g shrimp, 3 corn tortillas, 50g cabbage slaw, 30g avocado, lime", "calories": 450, "protein": 35, "carbs": 40, "fat": 15},
        ]
        for i, day in enumerate(days):
            fallback.append({**breakfast_opts[i], "day_of_week": day, "meal_type": "breakfast"})
            fallback.append({**lunch_opts[i], "day_of_week": day, "meal_type": "lunch"})
            fallback.append({**dinner_opts[i], "day_of_week": day, "meal_type": "dinner"})
        increment_ai_suggestion_use(body.user_id, count=15)
        return {"entries": fallback}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI week suggestion error: {str(e)}")
