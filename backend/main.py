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
from posthog import Posthog

load_dotenv()

# PostHog client
_posthog_key = os.environ.get("POSTHOG_KEY", "")
_posthog_host = os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com")
posthog_client: Posthog | None = Posthog(_posthog_key, host=_posthog_host) if _posthog_key else None

# Stripe config
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID_PRO   = os.environ.get("STRIPE_PRICE_ID_PRO", "")
FRONTEND_URL          = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# Contact email config (Outlook SMTP)
CONTACT_SMTP_USER     = os.environ.get("CONTACT_SMTP_USER", "")
CONTACT_SMTP_PASSWORD = os.environ.get("CONTACT_SMTP_PASSWORD", "")
CONTACT_RECIPIENT     = "lclampitt44@outlook.com"

# Supabase admin client (service role — never expose this key to the browser)
_supabase_url = os.environ.get("SUPABASE_URL", "")
_supabase_service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase_admin: Client = create_client(_supabase_url, _supabase_service_key) if _supabase_url and _supabase_service_key else None

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


class ContactRequest(BaseModel):
    name: str
    email: str
    message: str


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
    user_id: Optional[str] = None  # Used for usage tracking


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
    """Return 'pro' or 'free' for a given user."""
    if not supabase_admin:
        return "free"
    result = supabase_admin.table("profiles").select("subscription_tier").eq("id", user_id).maybe_single().execute()
    return (result.data or {}).get("subscription_tier", "free")

def can_use_analyzer(user_id: str) -> bool:
    """Return True if the user is allowed to run an analysis."""
    if not supabase_admin:
        return True
    result = supabase_admin.table("profiles") \
        .select("subscription_tier,analyzer_uses_this_month,analyzer_month") \
        .eq("id", user_id).maybe_single().execute()
    profile = result.data or {}
    if profile.get("subscription_tier") == "pro":
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
    if _get_plan(user_id) == "pro":
        return True
    result = supabase_admin.table("workouts").select("id").eq("user_id", user_id).execute()
    count = len(result.data) if result.data else 0
    return count < 10

def get_usage_summary(user_id: str) -> dict:
    """Return a full usage summary for the given user."""
    if not supabase_admin:
        return {"analyzerUsed": 0, "analyzerLimit": 3, "workoutCount": 0, "workoutLimit": 10, "plan": "free"}
    profile_res = supabase_admin.table("profiles") \
        .select("subscription_tier,analyzer_uses_this_month,analyzer_month") \
        .eq("id", user_id).maybe_single().execute()
    profile = profile_res.data or {}
    plan = profile.get("subscription_tier", "free")
    month = _current_month()
    analyzer_used = 0 if profile.get("analyzer_month", "") != month \
        else (profile.get("analyzer_uses_this_month") or 0)
    workout_res = supabase_admin.table("workouts").select("id").eq("user_id", user_id).execute()
    workout_count = len(workout_res.data) if workout_res.data else 0
    return {
        "analyzerUsed":  analyzer_used,
        "analyzerLimit": None if plan == "pro" else 3,
        "workoutCount":  workout_count,
        "workoutLimit":  None if plan == "pro" else 10,
        "plan":          plan,
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
    # Enforce monthly usage limit for free users
    if data.user_id and not can_use_analyzer(data.user_id):
        raise HTTPException(
            status_code=403,
            detail={"error": "limit_reached", "feature": "analyzer"},
        )

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

    # Increment usage counter after a successful analysis
    if data.user_id:
        try:
            increment_analyzer_use(data.user_id)
        except Exception:
            pass  # Never fail the request because of a tracking error

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
async def analyze_image(file: UploadFile = File(...), user_id: Optional[str] = Form(None)):
    """
    Experimental endpoint that:
      - accepts a JPG/PNG upload,
      - extracts simple silhouette metrics,
      - uses a rule-based heuristic to estimate bodyfat.

    This is intentionally separate from the dataset-trained model so we
    can clearly state its limitations in the writeup.
    """
    # Enforce monthly usage limit for free users
    if user_id and not can_use_analyzer(user_id):
        raise HTTPException(
            status_code=403,
            detail={"error": "limit_reached", "feature": "analyzer"},
        )

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

    # Increment usage counter after a successful analysis
    if user_id:
        try:
            increment_analyzer_use(user_id)
        except Exception:
            pass

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
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase admin client not configured.")

    event_type = event["type"]
    obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id         = obj.get("client_reference_id")
        customer_id     = obj.get("customer")
        subscription_id = obj.get("subscription")
        if user_id:
            supabase_admin.table("profiles").upsert({
                "id": user_id,
                "subscription_tier": "pro",
                "stripe_customer_id": customer_id,
                "stripe_subscription_id": subscription_id,
            }).execute()
            if posthog_client:
                try:
                    posthog_client.capture(user_id, "subscription_started", {"plan": "pro"})
                except Exception:
                    pass

    elif event_type == "customer.subscription.deleted":
        customer_id = obj.get("customer")
        if customer_id:
            supabase_admin.table("profiles").update({
                "subscription_tier": "free",
                "stripe_subscription_id": None,
            }).eq("stripe_customer_id", customer_id).execute()

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
