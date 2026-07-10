# -*- coding: utf-8 -*-
"""
app.py — IBM Watsonx.ai Nutrition Agent
Flask backend with full chat, BMI, calorie analysis, meal planning,
and family profile support.
"""

import os
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams
from agent_instructions import build_system_prompt, QUICK_REPLIES

# ── Load environment variables ────────────────────────────────────────────────
# override=True ensures .env values win even if the variable is already set
_env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=_env_path, override=True)

# ── Flask app setup ───────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")
CORS(app)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Watsonx.ai configuration ──────────────────────────────────────────────────
IBM_API_KEY       = os.getenv("IBM_API_KEY")
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID")
WATSONX_URL       = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")

# Model — using meta-llama instruct (supported in au-syd region)
# To use Granite instead, set WATSONX_URL=https://us-south.ml.cloud.ibm.com
GRANITE_MODEL_ID  = "meta-llama/llama-3-3-70b-instruct"

# Generation parameters — tune as needed
GENERATION_PARAMS = {
    GenParams.MAX_NEW_TOKENS: 1024,
    GenParams.MIN_NEW_TOKENS: 50,
    GenParams.TEMPERATURE:    0.7,
    GenParams.TOP_P:          0.9,
    GenParams.TOP_K:          50,
    GenParams.REPETITION_PENALTY: 1.1,
    GenParams.STOP_SEQUENCES: ["<|eot_id|>", "<|end_of_text|>"],
}


def get_watsonx_model() -> ModelInference:
    """Initialise and return the Watsonx ModelInference client (SDK v1.1.x)."""
    credentials = Credentials(
        url=WATSONX_URL,
        api_key=IBM_API_KEY,
    )
    return ModelInference(
        model_id=GRANITE_MODEL_ID,
        credentials=credentials,
        params=GENERATION_PARAMS,
        project_id=WATSONX_PROJECT_ID,
    )


def build_conversation_prompt(system_prompt: str, history: list, user_message: str) -> str:
    """
    Build a conversation prompt in Llama-3 instruct format.
    meta-llama/llama-3-x uses <|begin_of_text|>, <|start_header_id|> tags.
    """
    prompt = (
        "<|begin_of_text|>"
        "<|start_header_id|>system<|end_header_id|>\n\n"
        f"{system_prompt}"
        "<|eot_id|>"
    )

    # Include last 6 turns of history to stay within token limits
    for turn in history[-6:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        prompt += (
            f"<|start_header_id|>{role}<|end_header_id|>\n\n"
            f"{content}<|eot_id|>"
        )

    prompt += (
        "<|start_header_id|>user<|end_header_id|>\n\n"
        f"{user_message}<|eot_id|>"
        "<|start_header_id|>assistant<|end_header_id|>\n\n"
    )
    return prompt


# ── BMI helpers ───────────────────────────────────────────────────────────────
def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    if height_cm <= 0 or weight_kg <= 0:
        return {"error": "Invalid input values"}
    height_m = height_cm / 100
    bmi = round(weight_kg / (height_m ** 2), 1)

    if bmi < 18.5:
        category, color, advice = "Underweight", "#f59e0b", "Focus on calorie-dense, nutritious foods."
    elif bmi < 25.0:
        category, color, advice = "Normal Weight", "#10b981", "Great! Maintain your balanced diet."
    elif bmi < 30.0:
        category, color, advice = "Overweight", "#f97316", "Moderate calorie reduction & regular exercise."
    else:
        category, color, advice = "Obese", "#ef4444", "Consult a healthcare provider for a personalised plan."

    # Ideal weight range (BMI 18.5–24.9)
    h2 = height_m ** 2
    ideal_min = round(18.5 * h2, 1)
    ideal_max = round(24.9 * h2, 1)

    return {
        "bmi": bmi,
        "category": category,
        "color": color,
        "advice": advice,
        "ideal_min": ideal_min,
        "ideal_max": ideal_max,
    }


def calculate_tdee(weight_kg: float, height_cm: float, age: int,
                   gender: str, activity_level: str) -> dict:
    """Harris-Benedict BMR + activity multiplier."""
    if gender.lower() in ("male", "m"):
        bmr = 88.362 + 13.397 * weight_kg + 4.799 * height_cm - 5.677 * age
    else:
        bmr = 447.593 + 9.247 * weight_kg + 3.098 * height_cm - 4.330 * age

    multipliers = {
        "sedentary":   1.2,
        "light":       1.375,
        "moderate":    1.55,
        "active":      1.725,
        "very_active": 1.9,
    }
    multiplier = multipliers.get(activity_level, 1.55)
    tdee = round(bmr * multiplier)
    bmr  = round(bmr)

    return {
        "bmr":             bmr,
        "tdee":            tdee,
        "weight_loss":     tdee - 500,
        "weight_gain":     tdee + 300,
        "protein_g":       round(weight_kg * 1.6),
        "carbs_g":         round((tdee * 0.45) / 4),
        "fat_g":           round((tdee * 0.30) / 9),
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main SPA."""
    return render_template("index.html", quick_replies=QUICK_REPLIES)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()})


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Main chat endpoint.
    Body JSON:
      {
        "message": "user text",
        "history": [ {role, content}, ... ],
        "profile": { name, age, weight, height, goal, diet_type, restrictions, activity }
      }
    """
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    history      = data.get("history", [])
    profile      = data.get("profile", {})

    if not user_message:
        return jsonify({"error": "Message cannot be empty"}), 400

    if not IBM_API_KEY or not WATSONX_PROJECT_ID:
        return jsonify({"error": (
            "IBM credentials not configured. "
            "Please set IBM_API_KEY and WATSONX_PROJECT_ID in your .env file."
        )}), 503

    # Build context dict from user profile for dynamic system prompt
    context = {
        "User Name":           profile.get("name"),
        "Age":                 profile.get("age"),
        "Weight":              f"{profile.get('weight')} kg" if profile.get("weight") else None,
        "Height":              f"{profile.get('height')} cm" if profile.get("height") else None,
        "Health Goal":         profile.get("goal"),
        "Diet Type":           profile.get("diet_type"),
        "Dietary Restrictions": profile.get("restrictions"),
        "Activity Level":      profile.get("activity"),
    }

    system_prompt = build_system_prompt(context)
    prompt = build_conversation_prompt(system_prompt, history, user_message)

    try:
        model = get_watsonx_model()
        response = model.generate_text(prompt=prompt)
        reply = response.strip() if isinstance(response, str) else str(response)

        logger.info("Chat OK | user_len=%d reply_len=%d", len(user_message), len(reply))
        return jsonify({
            "reply":     reply,
            "timestamp": datetime.utcnow().isoformat(),
            "model":     GRANITE_MODEL_ID,
        })

    except Exception as exc:
        logger.error("Watsonx error: %s", exc)
        return jsonify({"error": f"AI service error: {str(exc)}"}), 500


@app.route("/api/bmi", methods=["POST"])
def bmi():
    """Calculate BMI + TDEE."""
    data = request.get_json(silent=True) or {}
    try:
        weight   = float(data["weight"])
        height   = float(data["height"])
        age      = int(data.get("age", 30))
        gender   = str(data.get("gender", "male"))
        activity = str(data.get("activity", "moderate"))
    except (KeyError, ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid input: {e}"}), 400

    bmi_result  = calculate_bmi(weight, height)
    tdee_result = calculate_tdee(weight, height, age, gender, activity)
    return jsonify({**bmi_result, **tdee_result})


@app.route("/api/meal-plan", methods=["POST"])
def meal_plan():
    """
    Generate a structured AI meal plan.
    Body JSON:
      {
        "duration": "7-day" | "1-day",
        "calories": 1800,
        "diet_type": "vegetarian",
        "goal": "weight loss",
        "restrictions": "no dairy",
        "profile": { ... }
      }
    """
    data = request.get_json(silent=True) or {}

    if not IBM_API_KEY or not WATSONX_PROJECT_ID:
        return jsonify({"error": "IBM credentials not configured"}), 503

    duration     = data.get("duration", "7-day")
    calories     = data.get("calories", 1800)
    diet_type    = data.get("diet_type", "vegetarian")
    goal         = data.get("goal", "balanced nutrition")
    restrictions = data.get("restrictions", "none")
    profile      = data.get("profile", {})

    prompt_text = f"""Create a detailed {duration} Indian meal plan with the following specifications:
- Daily calorie target: {calories} kcal
- Diet type: {diet_type}
- Health goal: {goal}
- Dietary restrictions: {restrictions}
- Include: Breakfast, Mid-Morning Snack, Lunch, Evening Snack, Dinner
- For each meal provide: meal name, ingredients, approximate calories, and key nutrients
- Use authentic Indian recipes and ingredients
- Include macro summary per day (Protein, Carbs, Fat)
- Add weekly grocery list at the end
- Make it practical and easy to prepare for an Indian household"""

    context = {
        "User Name":  profile.get("name"),
        "Age":        profile.get("age"),
        "Health Goal": goal,
        "Diet Type":  diet_type,
    }
    system_prompt = build_system_prompt(context)
    full_prompt   = build_conversation_prompt(system_prompt, [], prompt_text)

    try:
        model  = get_watsonx_model()
        result = model.generate_text(prompt=full_prompt)
        return jsonify({
            "meal_plan": result.strip() if isinstance(result, str) else str(result),
            "duration":  duration,
            "calories":  calories,
        })
    except Exception as exc:
        logger.error("Meal plan error: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/calorie-analysis", methods=["POST"])
def calorie_analysis():
    """
    Analyse calories and macros for a described meal.
    Body JSON: { "meal_description": "2 rotis, 1 cup dal, salad" }
    """
    data = request.get_json(silent=True) or {}
    meal = (data.get("meal_description") or "").strip()

    if not meal:
        return jsonify({"error": "Meal description is required"}), 400

    if not IBM_API_KEY or not WATSONX_PROJECT_ID:
        return jsonify({"error": "IBM credentials not configured"}), 503

    prompt_text = f"""Analyse the nutritional content of the following Indian meal:

Meal: {meal}

Provide a detailed breakdown:
1. Total calories (kcal)
2. Macronutrients: Protein (g), Carbohydrates (g), Fat (g), Fibre (g)
3. Key micronutrients present
4. Nutritional strengths of this meal
5. Nutritional gaps or improvements suggested
6. Healthier Indian alternatives if needed

Use standard Indian portion sizes for your estimates."""

    system_prompt = build_system_prompt()
    full_prompt   = build_conversation_prompt(system_prompt, [], prompt_text)

    try:
        model  = get_watsonx_model()
        result = model.generate_text(prompt=full_prompt)
        return jsonify({
            "analysis": result.strip() if isinstance(result, str) else str(result),
            "meal":     meal,
        })
    except Exception as exc:
        logger.error("Calorie analysis error: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/family-plan", methods=["POST"])
def family_plan():
    """
    Generate a family nutrition plan.
    Body JSON:
      {
        "family_members": [
          { "name": "Dad", "age": 45, "gender": "male", "goal": "heart health" },
          ...
        ],
        "diet_type": "vegetarian",
        "budget": "moderate"
      }
    """
    data           = request.get_json(silent=True) or {}
    family_members = data.get("family_members", [])
    diet_type      = data.get("diet_type", "vegetarian")
    budget         = data.get("budget", "moderate")

    if not family_members:
        return jsonify({"error": "Please provide family member details"}), 400

    if not IBM_API_KEY or not WATSONX_PROJECT_ID:
        return jsonify({"error": "IBM credentials not configured"}), 503

    members_text = "\n".join([
        f"  - {m.get('name', 'Member')}: Age {m.get('age', 'N/A')}, "
        f"Gender {m.get('gender', 'N/A')}, Goal: {m.get('goal', 'balanced health')}"
        for m in family_members
    ])

    prompt_text = f"""Create a comprehensive weekly family nutrition plan for an Indian household.

Family Members:
{members_text}

Requirements:
- Diet type: {diet_type}
- Budget: {budget}
- Create ONE common meal base with individual modifications per member
- Address each member's specific nutritional needs and health goals
- Include caloric targets per member
- Suggest batch-cooking strategies for efficiency
- Include a unified weekly grocery list
- Use authentic Indian recipes
- Flag any food allergies or interactions to watch for"""

    system_prompt = build_system_prompt()
    full_prompt   = build_conversation_prompt(system_prompt, [], prompt_text)

    try:
        model  = get_watsonx_model()
        result = model.generate_text(prompt=full_prompt)
        return jsonify({
            "family_plan":    result.strip() if isinstance(result, str) else str(result),
            "member_count":   len(family_members),
        })
    except Exception as exc:
        logger.error("Family plan error: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/quick-replies")
def quick_replies():
    return jsonify({"quick_replies": QUICK_REPLIES})


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    logger.info("Starting Nutrition Agent on port %d (debug=%s)", port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)
