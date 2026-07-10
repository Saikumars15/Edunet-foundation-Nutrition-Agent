/* ═══════════════════════════════════════════════════════════════
   NutriBot — app.js
   Full frontend logic: tabs, chat, BMI, meal plan, family, calories
═══════════════════════════════════════════════════════════════ */

"use strict";

/* ── State ─────────────────────────────────────────────────────── */
const STATE = {
  chatHistory:   [],
  familyMembers: [],
  profile:       {},
  theme:         localStorage.getItem("nutribot-theme") || "light",
};

/* ── DOM helpers ────────────────────────────────────────────────── */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function showToast(msg, type = "info") {
  const toast = document.getElementById("appToast");
  const body  = document.getElementById("toastMsg");
  body.textContent = msg;
  toast.className  = `toast align-items-center border-0 text-bg-${type}`;
  bootstrap.Toast.getOrCreateInstance(toast, { delay: 3000 }).show();
}

function showLoading(text = "Thinking…") {
  $("#loadingText").textContent = text;
  $("#loadingOverlay").classList.add("active");
}
function hideLoading() {
  $("#loadingOverlay").classList.remove("active");
}

/* Simple markdown-ish renderer (bold, bullets, headers) */
function renderMarkdown(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^[-•] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/\n\n+/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(?!<[hupol])/, "<p>")
    .replace(/(?<![>])$/, "</p>")
    .replace(/---/g, "<hr>")
    .replace(/🌅|🌞|🍽️|☕|🌙/g, m => `<span class="meal-icon">${m}</span>`);
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ── Tab Navigation ─────────────────────────────────────────────── */
function activateTab(tabName) {
  $$(".tab-pane").forEach(p => p.classList.remove("active"));
  $$(".nav-tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });
  const pane = $(`#tab-${tabName}`);
  if (pane) pane.classList.add("active");
}

document.addEventListener("click", e => {
  const btn = e.target.closest(".nav-tab-btn");
  if (btn && btn.dataset.tab) activateTab(btn.dataset.tab);
});

/* ── Dark / Light Theme ─────────────────────────────────────────── */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  STATE.theme = theme;
  localStorage.setItem("nutribot-theme", theme);
  const icon = document.getElementById("themeIcon");
  icon.className = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
}

document.getElementById("themeToggle").addEventListener("click", () => {
  applyTheme(STATE.theme === "dark" ? "light" : "dark");
});

applyTheme(STATE.theme); // apply stored theme on load

/* ── Profile Management ─────────────────────────────────────────── */
function getProfile() {
  return {
    name:         $("#profileName")?.value.trim()   || "",
    age:          $("#profileAge")?.value.trim()    || "",
    gender:       $("#profileGender")?.value        || "male",
    weight:       $("#profileWeight")?.value.trim() || "",
    height:       $("#profileHeight")?.value.trim() || "",
    goal:         $("#profileGoal")?.value          || "",
    diet_type:    $("#profileDietType")?.value      || "vegetarian",
    activity:     $("#profileActivity")?.value      || "moderate",
    restrictions: $("#profileRestrictions")?.value.trim() || "",
  };
}

function loadProfileFromStorage() {
  const saved = localStorage.getItem("nutribot-profile");
  if (!saved) return;
  const p = JSON.parse(saved);
  const map = {
    profileName: p.name, profileAge: p.age, profileWeight: p.weight,
    profileHeight: p.height, profileRestrictions: p.restrictions,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  });
  ["profileGender","profileGoal","profileDietType","profileActivity"].forEach(id => {
    const el = document.getElementById(id);
    if (el && p[id.replace("profile","").toLowerCase()]) {
      const key = id.replace("profile","").toLowerCase();
      if (p[key]) el.value = p[key];
    }
  });
  if (p.goal) $("#profileGoal").value = p.goal;
  if (p.diet_type) $("#profileDietType").value = p.diet_type;
  if (p.activity) $("#profileActivity").value = p.activity;
  if (p.gender)   $("#profileGender").value = p.gender;
}

$("#saveProfile")?.addEventListener("click", () => {
  const p = getProfile();
  localStorage.setItem("nutribot-profile", JSON.stringify(p));
  STATE.profile = p;
  showToast("Profile saved! ✅", "success");
});

/* ── Chat ──────────────────────────────────────────────────────── */
function appendMessage(role, text, streaming = false) {
  const container = document.getElementById("chatMessages");
  const wrapper   = document.createElement("div");
  wrapper.className = `message ${role}`;

  const avatarEl = document.createElement("div");
  avatarEl.className = "msg-avatar";
  avatarEl.textContent = role === "user" ? "👤" : "🥗";

  const right  = document.createElement("div");
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";

  if (role === "bot") {
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }

  const timeEl = document.createElement("div");
  timeEl.className = "msg-time";
  timeEl.textContent = formatTime();

  right.appendChild(bubble);
  right.appendChild(timeEl);
  wrapper.appendChild(avatarEl);
  wrapper.appendChild(right);
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function showTyping() {
  const container = document.getElementById("chatMessages");
  const wrapper   = document.createElement("div");
  wrapper.className = "message bot";
  wrapper.id        = "typingIndicator";

  const avatarEl = document.createElement("div");
  avatarEl.className = "msg-avatar";
  avatarEl.textContent = "🥗";

  const bubble = document.createElement("div");
  bubble.className = "typing-bubble";
  bubble.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;

  wrapper.appendChild(avatarEl);
  wrapper.appendChild(bubble);
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
}
function hideTyping() {
  document.getElementById("typingIndicator")?.remove();
}

async function sendMessage(text) {
  if (!text.trim()) return;
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  STATE.chatHistory.push({ role: "user", content: text });
  appendMessage("user", text);
  input.value = "";
  autoResizeTextarea(input);
  updateCharCount(input);

  sendBtn.disabled = true;
  showTyping();

  try {
    const res = await fetch("/api/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        message: text,
        history: STATE.chatHistory.slice(-10),
        profile: getProfile(),
      }),
    });

    const data = await res.json();
    hideTyping();

    if (!res.ok || data.error) {
      appendMessage("bot", `⚠️ Error: ${data.error || "Something went wrong. Please try again."}`);
    } else {
      STATE.chatHistory.push({ role: "assistant", content: data.reply });
      appendMessage("bot", data.reply);
    }
  } catch (err) {
    hideTyping();
    appendMessage("bot", "⚠️ Network error. Please check your connection and try again.");
    console.error(err);
  } finally {
    sendBtn.disabled = false;
    input.focus();
    // Hide quick replies after first message
    document.getElementById("quickRepliesBar")?.classList.add("hidden");
  }
}

// Auto-resize textarea
function autoResizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

function updateCharCount(el) {
  const count = document.getElementById("charCount");
  if (!count) return;
  const len = el.value.length;
  count.textContent = `${len} / 2000`;
  count.classList.toggle("over", len > 1900);
}

const chatInput = document.getElementById("chatInput");
chatInput?.addEventListener("input", function() {
  autoResizeTextarea(this);
  updateCharCount(this);
});
chatInput?.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(chatInput.value.trim());
  }
});

document.getElementById("sendBtn")?.addEventListener("click", () => {
  sendMessage(chatInput.value.trim());
});

// Quick reply chips
document.addEventListener("click", e => {
  const chip = e.target.closest(".quick-reply-chip");
  if (chip) {
    sendMessage(chip.dataset.message);
  }
});

// Clear chat
document.getElementById("clearChat")?.addEventListener("click", () => {
  STATE.chatHistory = [];
  const msgs = document.getElementById("chatMessages");
  msgs.innerHTML = "";
  showWelcome();
  document.getElementById("quickRepliesBar")?.classList.remove("hidden");
  showToast("Chat cleared", "secondary");
});

function showWelcome() {
  const msgs = document.getElementById("chatMessages");
  msgs.innerHTML = `
    <div class="welcome-message">
      <span class="welcome-icon">🥗</span>
      <div class="welcome-title">Hello! I'm NutriBot</div>
      <p class="welcome-sub">Your AI-powered Indian Nutrition Expert, powered by IBM Watsonx Granite.<br/>
      Ask me anything about meal planning, calorie counting, healthy recipes, or family nutrition!</p>
      <div class="mt-3 d-flex flex-wrap gap-2 justify-content-center">
        <span class="stat-badge"><i class="bi bi-shield-check me-1"></i>Safe &amp; Evidence-based</span>
        <span class="stat-badge"><i class="bi bi-translate me-1"></i>Hindi &amp; English</span>
        <span class="stat-badge">🇮🇳 Indian cuisine specialist</span>
      </div>
    </div>`;
}

/* ── BMI Calculator ─────────────────────────────────────────────── */
document.getElementById("calcBmi")?.addEventListener("click", async () => {
  const weight   = parseFloat($("#bmiWeight").value);
  const height   = parseFloat($("#bmiHeight").value);
  const age      = parseInt($("#bmiAge").value)     || 30;
  const gender   = $("#bmiGender").value;
  const activity = $("#bmiActivity").value;

  if (!weight || !height || weight < 20 || height < 100) {
    showToast("Please enter valid weight (≥20kg) and height (≥100cm)", "danger");
    return;
  }

  showLoading("Calculating…");
  try {
    const res  = await fetch("/api/bmi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight, height, age, gender, activity }),
    });
    const data = await res.json();
    hideLoading();

    if (data.error) { showToast(data.error, "danger"); return; }

    displayBmiResults(data);
    showToast("Results calculated! 🎯", "success");
  } catch (err) {
    hideLoading();
    showToast("Network error", "danger");
    console.error(err);
  }
});

function displayBmiResults(d) {
  const resultsEl     = document.getElementById("bmiResults");
  const placeholderEl = document.getElementById("bmiPlaceholder");
  placeholderEl.style.display = "none";
  resultsEl.style.display     = "block";

  // Gauge
  const gauge = document.getElementById("bmiGauge");
  document.getElementById("bmiValue").textContent = d.bmi;
  document.getElementById("bmiLabel").textContent = d.category;
  gauge.style.borderColor = d.color;
  document.getElementById("bmiValue").style.color = d.color;

  // Pointer position
  // BMI scale: <18.5 | 18.5-25 | 25-30 | ≥30
  // Map to 0-100% width
  const bmiClamped = Math.min(Math.max(d.bmi, 10), 40);
  const pct = ((bmiClamped - 10) / 30) * 100;
  document.getElementById("bmiPointer").style.left = `${pct}%`;

  // TDEE cards
  const tdeeHtml = [
    { val: d.bmr,          lbl: "BMR (kcal/day)",   icon: "bi-heart-pulse" },
    { val: d.tdee,         lbl: "Maintenance",       icon: "bi-activity" },
    { val: d.weight_loss,  lbl: "Weight Loss (−500)",icon: "bi-arrow-down-circle" },
    { val: d.weight_gain,  lbl: "Weight Gain (+300)",icon: "bi-arrow-up-circle" },
    { val: `${d.ideal_min}–${d.ideal_max}`,lbl: "Ideal Weight (kg)", icon: "bi-bullseye" },
  ].map(c => `
    <div class="col-6 col-md-4">
      <div class="tdee-card">
        <i class="bi ${c.icon} mb-1 d-block text-accent"></i>
        <div class="tdee-val">${c.val}</div>
        <div class="tdee-lbl">${c.lbl}</div>
      </div>
    </div>`).join("");
  document.getElementById("tdeeCards").innerHTML = tdeeHtml;

  // Advice
  document.getElementById("bmiAdvice").innerHTML =
    `<strong>💡 ${d.category}</strong> — ${d.advice}`;

  // Macro targets
  const macroCard = document.getElementById("macroCard");
  const macroTargets = document.getElementById("macroTargets");
  macroCard.style.display = "block";
  const total = d.carbs_g * 4 + d.protein_g * 4 + d.fat_g * 9;
  const macros = [
    { name: "Carbohydrates", val: d.carbs_g,   unit: "g", kcal: d.carbs_g   * 4, cls: "carb-fill",    color: "#3b82f6", pct: Math.round(d.carbs_g   * 4 / d.tdee * 100) },
    { name: "Protein",       val: d.protein_g, unit: "g", kcal: d.protein_g * 4, cls: "protein-fill", color: "#10b981", pct: Math.round(d.protein_g * 4 / d.tdee * 100) },
    { name: "Fat",           val: d.fat_g,     unit: "g", kcal: d.fat_g     * 9, cls: "fat-fill",     color: "#f59e0b", pct: Math.round(d.fat_g     * 9 / d.tdee * 100) },
  ];
  macroTargets.innerHTML = macros.map(m => `
    <div class="col-md-4">
      <div class="tdee-card">
        <div class="macro-label">
          <span style="color:${m.color}">${m.name}</span>
          <span>${m.val}${m.unit} (${m.pct}%)</span>
        </div>
        <div class="macro-bar">
          <div class="macro-bar-fill ${m.cls}" style="width:0%" data-target="${m.pct}%"></div>
        </div>
        <div class="tdee-lbl mt-1">${m.kcal} kcal</div>
      </div>
    </div>`).join("");

  // Animate macro bars after render
  setTimeout(() => {
    $$(".macro-bar-fill").forEach(el => {
      el.style.width = el.dataset.target;
    });
  }, 100);
}

/* ── Meal Planner ───────────────────────────────────────────────── */
document.getElementById("generateMealPlan")?.addEventListener("click", async () => {
  const duration     = $("#mealPlanDuration").value;
  const calories     = parseInt($("#mealPlanCalories").value) || null;
  const diet_type    = $("#mealPlanDietType").value;
  const goal         = $("#mealPlanGoal").value;
  const restrictions = $("#mealPlanRestrictions").value.trim();

  showLoading("Generating your personalised meal plan…");
  const placeholder = document.getElementById("mealPlanPlaceholder");
  const content     = document.getElementById("mealPlanContent");

  try {
    const res  = await fetch("/api/meal-plan", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        duration, calories, diet_type, goal, restrictions,
        profile: getProfile(),
      }),
    });
    const data = await res.json();
    hideLoading();

    if (data.error) {
      showToast(`Error: ${data.error}`, "danger");
      return;
    }

    placeholder.style.display = "none";
    content.style.display     = "block";
    content.innerHTML = renderMarkdown(data.meal_plan);
    showToast("Meal plan ready! 🎉", "success");
  } catch (err) {
    hideLoading();
    showToast("Network error", "danger");
    console.error(err);
  }
});

/* ── Calorie Analyser ───────────────────────────────────────────── */
// Meal example chips
document.addEventListener("click", e => {
  const chip = e.target.closest(".meal-chip");
  if (chip) {
    const ta = document.getElementById("mealDescription");
    if (ta) ta.value = chip.dataset.meal;
  }
});

document.getElementById("analyseCalories")?.addEventListener("click", async () => {
  const meal = (document.getElementById("mealDescription")?.value || "").trim();
  if (!meal) { showToast("Please describe your meal first", "warning"); return; }

  showLoading("Analysing your meal nutrition…");
  const placeholder = document.getElementById("caloriePlaceholder");
  const content     = document.getElementById("calorieContent");

  try {
    const res  = await fetch("/api/calorie-analysis", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ meal_description: meal }),
    });
    const data = await res.json();
    hideLoading();

    if (data.error) {
      showToast(`Error: ${data.error}`, "danger");
      return;
    }

    placeholder.style.display = "none";
    content.style.display     = "block";
    content.innerHTML = renderMarkdown(data.analysis);
    showToast("Analysis complete! 🔥", "success");
  } catch (err) {
    hideLoading();
    showToast("Network error", "danger");
    console.error(err);
  }
});

/* ── Family Planner ─────────────────────────────────────────────── */
function renderFamilyMembers() {
  const container = document.getElementById("familyMembersList");
  if (!container) return;

  if (STATE.familyMembers.length === 0) {
    container.innerHTML = `
      <div class="text-center py-3 muted-text" style="font-size:0.85rem;">
        <i class="bi bi-person-plus-fill fs-3 d-block mb-2"></i>
        No members yet. Add family members below.
      </div>`;
    return;
  }

  container.innerHTML = STATE.familyMembers.map((m, i) => `
    <div class="family-member-card">
      <div class="family-member-header">
        <div class="family-member-name">👤 ${m.name || `Member ${i+1}`}</div>
        <button class="btn-remove-member" data-index="${i}" title="Remove">
          <i class="bi bi-x-circle"></i>
        </button>
      </div>
      <div class="row g-2">
        <div class="col-4">
          <input type="number" class="form-control form-control-sm" placeholder="Age"
                 value="${m.age || ''}" data-index="${i}" data-field="age" />
        </div>
        <div class="col-4">
          <select class="form-select form-select-sm" data-index="${i}" data-field="gender">
            <option value="male"   ${m.gender==="male"   ?"selected":""}>Male</option>
            <option value="female" ${m.gender==="female" ?"selected":""}>Female</option>
          </select>
        </div>
        <div class="col-4">
          <select class="form-select form-select-sm" data-index="${i}" data-field="goal">
            <option value="balanced health"  ${m.goal==="balanced health" ?"selected":""}>Balanced</option>
            <option value="weight loss"      ${m.goal==="weight loss"     ?"selected":""}>Weight Loss</option>
            <option value="muscle building"  ${m.goal==="muscle building" ?"selected":""}>Muscle</option>
            <option value="heart health"     ${m.goal==="heart health"    ?"selected":""}>Heart</option>
            <option value="diabetes management" ${m.goal==="diabetes management"?"selected":""}>Diabetes</option>
          </select>
        </div>
      </div>
    </div>`).join("");

  // Bind live-edit events
  $$("[data-field]", container).forEach(el => {
    el.addEventListener("change", e => {
      const idx   = parseInt(e.target.dataset.index);
      const field = e.target.dataset.field;
      STATE.familyMembers[idx][field] = e.target.value;
    });
    el.addEventListener("input", e => {
      const idx   = parseInt(e.target.dataset.index);
      const field = e.target.dataset.field;
      STATE.familyMembers[idx][field] = e.target.value;
    });
  });

  // Bind remove buttons
  $$(".btn-remove-member", container).forEach(btn => {
    btn.addEventListener("click", e => {
      const idx = parseInt(e.currentTarget.dataset.index);
      STATE.familyMembers.splice(idx, 1);
      renderFamilyMembers();
    });
  });
}

let memberCounter = 1;
document.getElementById("addFamilyMember")?.addEventListener("click", () => {
  const names = ["Dad", "Mom", "Son", "Daughter", "Grandpa", "Grandma", "Uncle", "Aunt"];
  STATE.familyMembers.push({
    name:   names[(memberCounter - 1) % names.length],
    age:    "",
    gender: memberCounter % 2 === 0 ? "female" : "male",
    goal:   "balanced health",
  });
  memberCounter++;
  renderFamilyMembers();
});

document.getElementById("generateFamilyPlan")?.addEventListener("click", async () => {
  if (STATE.familyMembers.length === 0) {
    showToast("Please add at least one family member", "warning");
    return;
  }

  const diet_type = $("#familyDietType").value;
  const budget    = $("#familyBudget").value;

  showLoading("Creating your family nutrition plan…");
  const placeholder = document.getElementById("familyPlanPlaceholder");
  const content     = document.getElementById("familyPlanContent");

  try {
    const res  = await fetch("/api/family-plan", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        family_members: STATE.familyMembers,
        diet_type,
        budget,
      }),
    });
    const data = await res.json();
    hideLoading();

    if (data.error) {
      showToast(`Error: ${data.error}`, "danger");
      return;
    }

    placeholder.style.display = "none";
    content.style.display     = "block";
    content.innerHTML = renderMarkdown(data.family_plan);
    showToast(`Family plan for ${data.member_count} member(s) ready! 👨‍👩‍👧‍👦`, "success");
  } catch (err) {
    hideLoading();
    showToast("Network error", "danger");
    console.error(err);
  }
});

/* ── Init ──────────────────────────────────────────────────────── */
function init() {
  // Load saved profile
  loadProfileFromStorage();
  STATE.profile = getProfile();

  // Render initial family member list
  renderFamilyMembers();

  // Show welcome chat message
  showWelcome();

  // Activate default tab
  activateTab("chat");

  console.log("NutriBot — IBM Watsonx.ai Nutrition Agent ready 🥗");
}

document.addEventListener("DOMContentLoaded", init);
