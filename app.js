const TAGS = ["Poor sleep", "Stress", "Dairy", "Cycle", "Alcohol", "Travel", "Exercise", "Medication"];

const today = new Date();
const dateKey = (date = today) => date.toISOString().slice(0, 10);
const formatDate = (key, options = { month: "short", day: "numeric" }) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(undefined, options);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

// --- Supabase setup -------------------------------------------------------
const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let currentUser = null;
let cachedEntries = [];

const entries = () => cachedEntries;

async function refreshEntries() {
  if (!currentUser) { cachedEntries = []; return; }
  const { data, error } = await supabaseClient
    .from("entries")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("date", { ascending: false });
  if (error) { console.error(error); return; }
  cachedEntries = data.map(row => ({
    date: row.date,
    severity: row.severity,
    tags: row.tags || [],
    sleep: row.sleep,
    activity: row.activity,
    notes: row.notes || ""
  }));
}

// --- Insight math -----------------------------------------------------
function correlation(a, b) {
  if (a.length < 3) return null;
  const meanA = a.reduce((sum, x) => sum + x, 0) / a.length;
  const meanB = b.reduce((sum, x) => sum + x, 0) / b.length;
  const numerator = a.reduce((sum, x, i) => sum + (x - meanA) * (b[i] - meanB), 0);
  const denominator = Math.sqrt(a.reduce((sum, x) => sum + (x - meanA) ** 2, 0) * b.reduce((sum, x) => sum + (x - meanB) ** 2, 0));
  return denominator ? numerator / denominator : 0;
}

function renderTags() {
  document.querySelector("#tag-grid").innerHTML = TAGS.map(tag => `
    <label class="tag-option"><input type="checkbox" name="tags" value="${tag}"><span>${tag}</span></label>
  `).join("");
}

function renderToday() {
  const todayEntry = entries().find(entry => entry.date === dateKey());
  const card = document.querySelector("#today-card");
  card.innerHTML = todayEntry ? `
    <div class="severity-bubble">${todayEntry.severity}</div>
    <div class="today-text"><strong>${todayEntry.severity <= 2 ? "A gentler day" : todayEntry.severity >= 4 ? "A harder day" : "A mixed day"}</strong>
    <span>Logged ${todayEntry.sleep ? `${todayEntry.sleep}h sleep` : "without sleep data"}${todayEntry.activity ? ` · ${todayEntry.activity} min movement` : ""}</span></div>
    <div class="tag-pills">${todayEntry.tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("") || "<span class=\"tag-pill\">No tags added</span>"}</div>
  ` : `<div class="severity-bubble">+</div><div class="today-text"><strong>Your check-in is waiting</strong><span>Take 30 seconds to capture how today feels.</span></div><a class="text-link" href="#check-in">Begin <span>→</span></a>`;
}

function buildInsights() {
  const all = entries();
  const grid = document.querySelector("#insights-grid");
  if (all.length < 3) {
    grid.innerHTML = `<article class="insight-card"><div class="insight-icon">✦</div><h3>Your first pattern is close</h3><p>Log ${3 - all.length} more day${all.length === 2 ? "" : "s"} to unlock your first comparison.</p></article>`;
    return;
  }
  const cards = [];
  const withSleep = all.filter(item => item.sleep !== null && item.sleep !== undefined);
  if (withSleep.length >= 3) {
    const r = correlation(withSleep.map(item => item.sleep), withSleep.map(item => item.severity));
    if (r < -0.25) cards.push(`<article class="insight-card"><div class="insight-icon">☾</div><h3>Sleep may be helping</h3><p>Your symptom scores tend to be lower after more sleep. Correlation: ${Math.round(Math.abs(r) * 100)}%.</p></article>`);
    else if (r > 0.25) cards.push(`<article class="insight-card"><div class="insight-icon">☾</div><h3>Sleep is worth watching</h3><p>Your symptom scores tend to be higher after more sleep. Keep logging to confirm this pattern.</p></article>`);
  }
  TAGS.forEach(tag => {
    const tagged = all.filter(item => item.tags.includes(tag));
    const untagged = all.filter(item => !item.tags.includes(tag));
    if (tagged.length >= 2 && untagged.length >= 1) {
      const taggedAvg = tagged.reduce((sum, item) => sum + item.severity, 0) / tagged.length;
      const otherAvg = untagged.reduce((sum, item) => sum + item.severity, 0) / untagged.length;
      if (taggedAvg - otherAvg >= 0.7) cards.push(`<article class="insight-card"><div class="insight-icon">◌</div><h3>${escapeHtml(tag)} days stand out</h3><p>Average severity is ${taggedAvg.toFixed(1)} with this tag vs ${otherAvg.toFixed(1)} without it.</p></article>`);
    }
  });
  grid.innerHTML = (cards.length ? cards : [`<article class="insight-card"><div class="insight-icon">✦</div><h3>Keep noticing</h3><p>Your data is still taking shape. Consistent check-ins make patterns easier to see.</p></article>`]).slice(0, 3).join("");
}

function renderChart() {
  const svg = document.querySelector("#symptom-chart");
  const recent = entries().slice(0, 7).reverse();
  const width = 600, height = 180, padX = 25, padTop = 15, chartHeight = 122;
  let markup = [1, 3, 5].map(value => `<line class="chart-gridline" x1="${padX}" x2="${width - padX}" y1="${padTop + (5 - value) * chartHeight / 4}" y2="${padTop + (5 - value) * chartHeight / 4}"/>`).join("");
  if (!recent.length) {
    svg.innerHTML = `${markup}<text class="chart-label" x="300" y="85" text-anchor="middle">Your symptom rhythm will appear here</text>`;
    return;
  }
  const gap = (width - padX * 2) / Math.max(recent.length - 1, 1);
  const points = recent.map((entry, index) => `${padX + index * gap},${padTop + (5 - entry.severity) * chartHeight / 4}`).join(" ");
  markup += `<polyline class="chart-line" points="${points}"/>`;
  recent.forEach((entry, index) => {
    const x = padX + index * gap, y = padTop + (5 - entry.severity) * chartHeight / 4;
    markup += `<circle class="chart-point" cx="${x}" cy="${y}" r="5"/><text class="chart-label" x="${x}" y="166" text-anchor="middle">${formatDate(entry.date, { weekday: "short" }).slice(0, 3)}</text>`;
  });
  svg.innerHTML = markup;
}

function renderHistory() {
  const all = entries();
  const average = all.length ? (all.reduce((sum, item) => sum + item.severity, 0) / all.length).toFixed(1) : "—";
  document.querySelector("#history-summary").innerHTML = `<div class="stat"><strong>${all.length}</strong><span>check-ins</span></div><div class="stat"><strong>${average}</strong><span>average severity</span></div><div class="stat"><strong>${new Set(all.flatMap(item => item.tags)).size}</strong><span>factors noticed</span></div>`;
  document.querySelector("#history-list").innerHTML = all.length ? all.map(item => `
    <article class="history-item"><div class="history-date">${formatDate(item.date)}</div><div class="history-score">${item.severity}</div><div class="history-details"><strong>${item.tags.length ? item.tags.map(escapeHtml).join(" · ") : "No factors tagged"}</strong><span>${item.sleep ? `${item.sleep}h sleep` : "No sleep data"}${item.activity ? ` · ${item.activity} min movement` : ""}${item.notes ? ` · ${escapeHtml(item.notes)}` : ""}</span></div></article>
  `).join("") : `<div class="empty-state">No entries yet. Your first check-in takes about 30 seconds.</div>`;
}

function render() { renderToday(); buildInsights(); renderChart(); renderHistory(); }

function setView() {
  const view = location.hash.replace("#", "") || "dashboard";
  document.querySelectorAll(".view").forEach(element => element.classList.toggle("hidden", element.id !== `${view}-view`));
  document.querySelectorAll("[data-view-link]").forEach(link => link.classList.toggle("active", link.dataset.viewLink === view));
  if (view === "check-in") {
    document.querySelector("#checkin-date-label").textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const existing = entries().find(entry => entry.date === dateKey());
    if (existing) {
      document.querySelector("#severity").value = existing.severity;
      document.querySelector("#severity-output").textContent = existing.severity;
      document.querySelector("#sleep").value = existing.sleep ?? "";
      document.querySelector("#activity").value = existing.activity ?? "";
      document.querySelector("#notes").value = existing.notes ?? "";
      document.querySelectorAll("[name=tags]").forEach(input => input.checked = existing.tags.includes(input.value));
    } else {
      document.querySelector("#checkin-form").reset();
      document.querySelector("#severity-output").textContent = "3";
    }
  }
}

// --- Auth UI ---------------------------------------------------------
function showApp(show) {
  document.querySelector("#auth-view").classList.toggle("hidden", show);
  document.querySelector(".nav-tabs").classList.toggle("hidden", !show);
  document.querySelector("#export-button").classList.toggle("hidden", !show);
  document.querySelector("#signout-button").classList.toggle("hidden", !show);
  document.querySelectorAll("#dashboard-view, #check-in-view, #history-view").forEach(el => {
    if (!show) el.classList.add("hidden");
  });
}

async function handleAuthed() {
  showApp(true);
  await refreshEntries();
  render();
  setView();
}

let authMode = "signin";
function setAuthMode(mode) {
  authMode = mode;
  document.querySelector("#auth-submit").textContent = mode === "signin" ? "Sign in" : "Create account";
  document.querySelector("#auth-toggle").textContent = mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in";
  document.querySelector("#auth-message").textContent = "";
}

document.querySelector("#auth-toggle").addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));

document.querySelector("#auth-form").addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.querySelector("#auth-email").value.trim();
  const password = document.querySelector("#auth-password").value;
  const message = document.querySelector("#auth-message");
  message.textContent = "One moment...";
  const { error } = authMode === "signin"
    ? await supabaseClient.auth.signInWithPassword({ email, password })
    : await supabaseClient.auth.signUp({ email, password });
  if (error) {
    message.textContent = error.message;
    return;
  }
  message.textContent = authMode === "signup" ? "Check your email to confirm your account, then sign in." : "";
});

document.querySelector("#signout-button").addEventListener("click", () => supabaseClient.auth.signOut());

supabaseClient.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) handleAuthed();
  else showApp(false);
});

// --- App interactions --------------------------------------------------
document.querySelector("#severity").addEventListener("input", event => document.querySelector("#severity-output").textContent = event.target.value);

document.querySelector("#checkin-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return;
  const data = new FormData(event.target);
  const row = {
    user_id: currentUser.id,
    date: dateKey(),
    severity: Number(data.get("severity")),
    tags: data.getAll("tags"),
    sleep: data.get("sleep") ? Number(data.get("sleep")) : null,
    activity: data.get("activity") ? Number(data.get("activity")) : null,
    notes: data.get("notes").trim()
  };
  const message = document.querySelector("#form-message");
  message.textContent = "Saving...";
  const { error } = await supabaseClient.from("entries").upsert(row, { onConflict: "user_id,date" });
  if (error) { message.textContent = "Couldn't save — check your connection and try again."; console.error(error); return; }
  await refreshEntries();
  message.textContent = "Saved and synced to your account.";
  render();
  setTimeout(() => location.hash = "dashboard", 550);
});

document.querySelector("#export-button").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(entries(), null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `kindly-check-ins-${dateKey()}.json`; link.click(); URL.revokeObjectURL(link.href);
});

window.addEventListener("hashchange", setView);
document.querySelector("#today-label").textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

// --- Init ---------------------------------------------------------------
renderTags();
setAuthMode("signin");
showApp(false);
supabaseClient.auth.getSession().then(({ data: { session } }) => {
  currentUser = session?.user ?? null;
  if (currentUser) handleAuthed();
});
