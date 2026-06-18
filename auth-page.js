// js/auth-page.js
import { registerUser, loginUser, watchAuthState, mapAuthError } from "./auth.js";

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const showRegisterBtn = document.getElementById("show-register");
const showLoginBtn = document.getElementById("show-login");
const alertBox = document.getElementById("alert-box");

function showAlert(message, type = "error") {
  alertBox.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}
function clearAlert() {
  alertBox.innerHTML = "";
}

showRegisterBtn.addEventListener("click", () => {
  clearAlert();
  loginForm.style.display = "none";
  registerForm.style.display = "block";
});

showLoginBtn.addEventListener("click", () => {
  clearAlert();
  registerForm.style.display = "none";
  loginForm.style.display = "block";
});

function setLoading(button, isLoading, originalText) {
  button.disabled = isLoading;
  button.innerHTML = isLoading ? `<span class="loading-spin"></span>` : originalText;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAlert();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn = document.getElementById("login-btn");

  setLoading(btn, true, "Autentificare");
  try {
    await loginUser(email, password);
    window.location.href = "game.html";
  } catch (err) {
    showAlert(mapAuthError(err));
    setLoading(btn, false, "Autentificare");
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAlert();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const ageConfirmed = document.getElementById("reg-age").checked;
  const btn = document.getElementById("register-btn");

  if (!ageConfirmed) {
    showAlert("Trebuie să confirmi vârsta minimă și să accepți Regulamentul pentru a continua.");
    return;
  }

  setLoading(btn, true, "Creează cont");
  try {
    await registerUser(email, password, name, ageConfirmed);
    window.location.href = "game.html";
  } catch (err) {
    showAlert(mapAuthError(err));
    setLoading(btn, false, "Creează cont");
  }
});

// Dacă utilizatorul e deja autentificat, îl trimitem direct în joc.
watchAuthState((user) => {
  if (user) {
    window.location.href = "game.html";
  }
});
