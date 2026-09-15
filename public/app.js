const authView = document.querySelector("#auth-view");
const trainingView = document.querySelector("#training-view");
const authForm = document.querySelector("#auth-form");
const authTitle = document.querySelector("#auth-title");
const authCopy = document.querySelector("#auth-copy");
const authSubmit = document.querySelector("#auth-submit");
const authError = document.querySelector("#auth-error");
const toggleAuthMode = document.querySelector("#toggle-auth-mode");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const signedInUser = document.querySelector("#signed-in-user");
const categoryGrid = document.querySelector("#category-grid");
const categoryScreen = document.querySelector("#category-screen");
const videoScreen = document.querySelector("#video-screen");
const videoList = document.querySelector("#video-list");
const categoryTitle = document.querySelector("#category-title");
const categorySummary = document.querySelector("#category-summary");
const screenTitle = document.querySelector("#screen-title");
const backButton = document.querySelector("#back-button");
const logoutButton = document.querySelector("#logout-button");

let mode = "login";
let categories = [];
let currentUser = null;

function setAuthMode(nextMode) {
  mode = nextMode;
  const isSignup = mode === "signup";
  authTitle.textContent = isSignup ? "Create your account" : "Welcome back";
  authCopy.textContent = isSignup
    ? "Create your login before starting the parking team training."
    : "Sign in to continue your parking team training.";
  authSubmit.textContent = isSignup ? "Create account" : "Sign in";
  toggleAuthMode.textContent = isSignup ? "I already have an account" : "Create a new account";
  passwordInput.autocomplete = isSignup ? "new-password" : "current-password";
  authError.textContent = "";
}

function showAuth() {
  trainingView.hidden = true;
  authView.hidden = false;
  emailInput.focus();
}

async function showTraining(user) {
  currentUser = user;
  signedInUser.textContent = user ? `Signed in as ${user.email}` : "";
  authView.hidden = true;
  trainingView.hidden = false;
  await loadCategories();
  showCategories();
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Something went wrong.");
  }

  return payload;
}

async function loadCategories() {
  const payload = await apiFetch("/api/categories");
  categories = payload.categories || [];
  categoryGrid.innerHTML = categories
    .map(
      (category) => `
        <button class="category-card" type="button" data-category="${category.id}">
          <strong>${escapeHtml(category.title)}</strong>
          <span>${escapeHtml(category.summary)}</span>
          <small>${category.videos.length} ${category.videos.length === 1 ? "video" : "videos"}</small>
        </button>
      `
    )
    .join("");
}

function showCategories() {
  screenTitle.textContent = "Parking Team Training";
  backButton.hidden = true;
  videoScreen.hidden = true;
  categoryScreen.hidden = false;
}

function showCategory(categoryId) {
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return;

  screenTitle.textContent = category.title;
  categoryTitle.textContent = category.title;
  categorySummary.textContent = category.summary;
  backButton.hidden = false;
  categoryScreen.hidden = true;
  videoScreen.hidden = false;

  videoList.innerHTML = category.videos.map(renderVideo).join("");
}

function renderVideo(video) {
  const embedUrl = getEmbedUrl(video.url);
  const media = embedUrl
    ? `<iframe class="video-frame" src="${embedUrl}" title="${escapeHtml(video.title)}" allowfullscreen></iframe>`
    : `<div class="video-placeholder">Video link coming soon</div>`;
  const action = video.url
    ? `<a class="video-action" href="${escapeAttribute(video.url)}" target="_blank" rel="noreferrer">Open video</a>`
    : "";

  return `
    <article class="video-card">
      ${media}
      <div class="video-details">
        <span class="video-meta">${escapeHtml(video.duration || "Training video")}</span>
        <h3>${escapeHtml(video.title)}</h3>
        <p>${escapeHtml(video.description)}</p>
        ${action}
      </div>
    </article>
  `;
}

function getEmbedUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    if (parsed.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }
    return url;
  } catch (error) {
    return "";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  authSubmit.disabled = true;

  try {
    const payload = await apiFetch(mode === "signup" ? "/api/signup" : "/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: emailInput.value,
        password: passwordInput.value
      })
    });
    await showTraining(payload.user);
  } catch (error) {
    authError.textContent = error.message;
  } finally {
    authSubmit.disabled = false;
  }
});

toggleAuthMode.addEventListener("click", () => {
  setAuthMode(mode === "signup" ? "login" : "signup");
});

categoryGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (button) showCategory(button.dataset.category);
});

backButton.addEventListener("click", showCategories);

logoutButton.addEventListener("click", async () => {
  await apiFetch("/api/logout", { method: "POST", body: "{}" });
  currentUser = null;
  showAuth();
});

async function boot() {
  setAuthMode("login");

  try {
    const session = await apiFetch("/api/session");
    if (session.authenticated) {
      await showTraining(session.user);
      return;
    }
  } catch (error) {
    authError.textContent = "";
  }

  showAuth();
}

boot();
