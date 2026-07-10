# 🥗 NutriBot — AI-Powered Nutrition Agent
### Built with IBM Watsonx.ai (Granite) + Python Flask

---

## 📋 Table of Contents
1. [Features](#features)
2. [Project Structure](#project-structure)
3. [Quick Start](#quick-start)
4. [IBM Cloud Setup](#ibm-cloud-setup)
5. [Configuration & Agent Customisation](#configuration--agent-customisation)
6. [Running Locally](#running-locally)
7. [API Reference](#api-reference)
8. [Deployment](#deployment)
9. [Customising the Agent](#customising-the-agent)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Chat** | Conversational nutrition assistant powered by IBM Granite |
| 📊 **BMI Dashboard** | Real-time BMI + TDEE calculator with visual gauge & macro targets |
| 📅 **Meal Planner** | AI-generated 1/3/7-day Indian meal plans |
| 👨‍👩‍👧‍👦 **Family Profiles** | Per-member nutrition plans for the whole family |
| 🔥 **Calorie Analyser** | Instant nutritional breakdown for any Indian meal |
| 🌙 **Dark Mode** | Persistent dark/light theme toggle |
| 📱 **Mobile Responsive** | Full Bootstrap 5 responsive design |
| 🇮🇳 **Indian Food Focus** | Deep Indian cuisine, spice, and festival food knowledge |
| 🔐 **Secure Credentials** | API keys loaded from `.env`, never hardcoded |

---

## 📁 Project Structure

```
nutrition-agent/
├── app.py                  # Flask backend — main application
├── agent_instructions.py   # 🎛️ CUSTOMISE AGENT HERE
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── .env                    # Your credentials (git-ignored)
├── templates/
│   └── index.html          # Single-page application HTML
└── static/
    ├── css/
    │   └── style.css       # Custom design system
    └── js/
        └── app.js          # Frontend logic
```

---

## 🚀 Quick Start

### 1. Clone / Download
```bash
git clone <https://github.com/Saikumars15/Edunet-foundation-Nutrition-Agent.git>
cd nutrition-agent
```

### 2. Create virtual environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up credentials
```bash
cp .env.example .env
# Now edit .env with your IBM Cloud API Key and Watsonx Project ID
```

### 5. Run the app
```bash
python app.py
```
Open **http://localhost:5000** in your browser.

---

## 🔑 IBM Cloud Setup

### Step 1 — Create IBM Cloud Account
Go to [cloud.ibm.com](https://cloud.ibm.com) and create a free account.

### Step 2 — Get API Key
1. Click your profile icon → **Manage** → **Access (IAM)**
2. Left panel → **API keys** → **Create an IBM Cloud API key**
3. Copy the key → paste it into `.env` as `IBM_API_KEY`

### Step 3 — Create Watsonx.ai Project
1. Navigate to [dataplatform.cloud.ibm.com](https://dataplatform.cloud.ibm.com)
2. Click **New project** → **Create an empty project**
3. Open the project → **Manage** tab → copy the **Project ID**
4. Paste it into `.env` as `WATSONX_PROJECT_ID`

### Step 4 — Verify Granite model access
1. In your Watsonx project, open the **Prompt Lab**
2. Confirm you can run `ibm/granite-3-8b-instruct`
3. If you want a different model, update `GRANITE_MODEL_ID` in `app.py`

### `.env` file example
```env
IBM_API_KEY=abc123...your_key...xyz
WATSONX_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
WATSONX_URL=https://us-south.ml.cloud.ibm.com
FLASK_SECRET_KEY=my-super-secret-key-change-this
PORT=5000
```

---

## ⚙️ Configuration & Agent Customisation

All agent behaviour is controlled from **`agent_instructions.py`** — no need to touch `app.py`.

### Sections you can edit:

| Section | Variable | What it controls |
|---|---|---|
| Persona & Tone | `AGENT_PERSONA` | Name, communication style, empathy level |
| Diet Specialisations | `DIET_SPECIALISATIONS` | Dietary approaches the agent knows |
| Indian Food Context | `INDIAN_FOOD_CONTEXT` | Regional foods, spices, festivals |
| Safety Rules | `SAFETY_RULES` | Medical disclaimers, calorie limits |
| Response Format | `RESPONSE_FORMAT` | Structure, emojis, word count |
| Family Profile Rules | `FAMILY_PROFILE_RULES` | Per-member calorie logic |
| Calorie Analysis | `CALORIE_ANALYSIS_RULES` | Indian portion sizes, macro output |
| Language | `LANGUAGE_RULES` | English/Hinglish mode |
| Quick Replies | `QUICK_REPLIES` | Chat suggestion chips shown to users |

### Example: Change agent name
```python
# agent_instructions.py
AGENT_PERSONA = """
You are AaharAI, a compassionate nutrition expert specialising in 
Ayurvedic and modern nutritional science...
"""
```

### Example: Add a new quick reply
```python
QUICK_REPLIES = [
    # ... existing chips
    "🌿 Suggest Ayurvedic detox foods",
    "🏋️ Keto diet plan for Indians",
]
```

### Example: Change the Granite model
```python
# app.py — line ~33
GRANITE_MODEL_ID = "ibm/granite-3-2b-instruct"   # lighter model
# or
GRANITE_MODEL_ID = "ibm/granite-13b-instruct-v2"  # heavier model
```

---

## 🌐 API Reference

All endpoints accept/return JSON.

### `POST /api/chat`
```json
{
  "message": "Give me a weight loss plan",
  "history": [ {"role": "user", "content": "..."}, ... ],
  "profile": {
    "name": "Priya", "age": "28", "weight": "65",
    "height": "162", "goal": "weight loss",
    "diet_type": "vegetarian", "activity": "moderate"
  }
}
```
**Response:** `{ "reply": "...", "timestamp": "...", "model": "..." }`

---

### `POST /api/bmi`
```json
{ "weight": 70, "height": 170, "age": 30, "gender": "male", "activity": "moderate" }
```
**Response:** `{ "bmi": 24.2, "category": "Normal Weight", "tdee": 2400, ... }`

---

### `POST /api/meal-plan`
```json
{
  "duration": "7-day",
  "calories": 1800,
  "diet_type": "vegetarian",
  "goal": "weight loss",
  "restrictions": "no dairy"
}
```
**Response:** `{ "meal_plan": "...", "duration": "7-day", "calories": 1800 }`

---

### `POST /api/calorie-analysis`
```json
{ "meal_description": "2 rotis, 1 cup dal, salad" }
```
**Response:** `{ "analysis": "...", "meal": "..." }`

---

### `POST /api/family-plan`
```json
{
  "family_members": [
    { "name": "Dad", "age": 45, "gender": "male", "goal": "heart health" },
    { "name": "Mom", "age": 40, "gender": "female", "goal": "weight loss" },
    { "name": "Arjun", "age": 12, "gender": "male", "goal": "balanced health" }
  ],
  "diet_type": "vegetarian",
  "budget": "moderate"
}
```
**Response:** `{ "family_plan": "...", "member_count": 3 }`

---

## 🚢 Deployment

### Option A — Local development
```bash
python app.py
```

### Option B — Gunicorn (Linux/macOS production)
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option C — Docker
```dockerfile
# Dockerfile (create this file)
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
```
```bash
docker build -t nutribot .
docker run -p 5000:5000 --env-file .env nutribot
```

### Option D — IBM Code Engine (Serverless)
```bash
# Install IBM Cloud CLI + Code Engine plugin
ibmcloud login --apikey $IBM_API_KEY
ibmcloud ce project create --name nutribot-project
ibmcloud ce app create \
  --name nutribot \
  --image us.icr.io/your-namespace/nutribot:latest \
  --port 5000 \
  --env-from-secret nutribot-secrets
```

### Option E — Render.com (Free hosting)
1. Push code to GitHub (add `.env` to `.gitignore`)
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo
4. Build command: `pip install -r requirements.txt`
5. Start command: `gunicorn app:app`
6. Add environment variables in the Render dashboard

---

## 🔒 Security Notes

- **Never commit `.env`** to git — it's already in `.gitignore`
- Use a strong, random `FLASK_SECRET_KEY` in production
- Set `FLASK_DEBUG=False` in production
- Consider rate-limiting the `/api/chat` endpoint in production

---

## 🧩 Tech Stack

| Layer | Technology |
|---|---|
| AI Model | IBM Watsonx.ai — Granite 3 8B Instruct |
| Backend | Python 3.11 + Flask 3.x |
| Auth | IBM Cloud API Key (via `ibm-watsonx-ai` SDK) |
| Frontend | Bootstrap 5.3 + Vanilla JS |
| Icons | Bootstrap Icons 1.11 |
| Env | python-dotenv |
| Production | Gunicorn |

---

## 📞 Support

- IBM Watsonx Documentation: https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/welcome-main.html
- IBM Granite Models: https://www.ibm.com/products/watsonx-ai/foundation-models
- Flask Documentation: https://flask.palletsprojects.com

---

*Made with ❤️ using IBM Watsonx.ai Granite | NutriBot v1.0*
