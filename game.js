// game.js — logica paginii principale Merazu Game

import {
  auth, db, onAuthStateChanged, signOut,
  doc, getDoc, updateDoc, setDoc,
  serverTimestamp, increment
} from "./firebase-config.js";

// ─── Constante ───────────────────────────────────────────────
const POINTS_PER_INTERACTION = 10;

// Zilele săptămânii: 0=Duminică, 1=Luni, 2=Marți...6=Sâmbătă
const PAUSE_DAY = 1; // Luni

// ─── Utilități ───────────────────────────────────────────────
function getWeekId() {
  const now = new Date();
  const day = now.getDay();
  // Ciclul săptămânal: marți(2) → duminică(0)
  // Calculăm numărul săptămânii bazat pe data de marți curentă
  const diff = (day === 0) ? -6 : (2 - day);
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() + diff);
  return `${tuesday.getFullYear()}-${String(tuesday.getMonth()+1).padStart(2,'0')}-${String(tuesday.getDate()).padStart(2,'0')}`;
}

function getTodayId() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function getDayName(dayNum) {
  const days = { 2: "Marți", 3: "Miercuri", 4: "Joi", 5: "Vineri", 6: "Sâmbătă", 0: "Duminică" };
  return days[dayNum] || "Azi";
}

// ─── UI helpers ──────────────────────────────────────────────
function showState(stateId) {
  ["loading-state", "pause-state", "challenge-state"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === stateId) ? "block" : "none";
  });
}

function updatePointsDisplay(totalWallet, weeklyScore) {
  document.getElementById("total-wallet").textContent = `${totalWallet} pct`;
  document.getElementById("weekly-score").textContent = `${weeklyScore} pct`;
}

function renderStreak(daysPlayedThisWeek) {
  const dayIds = { 2: "day-2", 3: "day-3", 4: "day-4", 5: "day-5", 6: "day-6", 0: "day-0" };
  Object.entries(dayIds).forEach(([dayNum, elemId]) => {
    const el = document.getElementById(elemId);
    if (el) {
      el.classList.toggle("active", daysPlayedThisWeek.includes(parseInt(dayNum)));
    }
  });
}

// ─── Logica provocării zilnice ────────────────────────────────
function renderChallenge(challenge, alreadyPlayed, weeklyScore) {
  document.getElementById("challenge-day-label").textContent = getDayName(new Date().getDay());
  document.getElementById("challenge-title").textContent = challenge.question;

  if (alreadyPlayed) {
    showDoneState(weeklyScore);
    return;
  }

  if (challenge.type === "quiz") {
    document.getElementById("challenge-quiz").style.display = "block";
    const container = document.getElementById("quiz-options");
    container.innerHTML = "";
    challenge.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = `${String.fromCharCode(65+i)}. ${opt}`;
      btn.addEventListener("click", () => submitAnswer(i, challenge));
      container.appendChild(btn);
    });
  } else if (challenge.type === "choice") {
    document.getElementById("challenge-choice").style.display = "block";
    const container = document.getElementById("choice-options");
    container.innerHTML = "";
    challenge.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = opt;
      btn.addEventListener("click", () => submitAnswer(i, challenge));
      container.appendChild(btn);
    });
  }
}

function showDoneState(weeklyScore) {
  document.getElementById("challenge-quiz").style.display = "none";
  document.getElementById("challenge-choice").style.display = "none";
  document.getElementById("challenge-done").style.display = "block";
  document.getElementById("points-earned-msg").textContent =
    `Ai ${weeklyScore} puncte în această săptămână. Revino mâine!`;
}

async function submitAnswer(answerIndex, challenge) {
  const user = auth.currentUser;
  if (!user) return;

  const todayId = getTodayId();
  const weekId = getWeekId();
  const userRef = doc(db, "users", user.uid);

  try {
    // Marchează ziua ca jucată și acordă puncte
    await updateDoc(userRef, {
      totalWallet: increment(POINTS_PER_INTERACTION),
      weeklyScore: increment(POINTS_PER_INTERACTION),
      lastInteractionDate: todayId,
      weeklyInteractionsCount: increment(1),
      currentWeekId: weekId,
      [`daysPlayed.${todayId}`]: true,
    });

    // Actualizează UI
    const snap = await getDoc(userRef);
    const data = snap.data();
    updatePointsDisplay(data.totalWallet, data.weeklyScore);
    showDoneState(data.weeklyScore);

  } catch (err) {
    console.error("Eroare la salvarea răspunsului:", err);
  }
}

// ─── Provocare implicită zilnică (fallback) ───────────────────
function getDefaultChallenge() {
  const day = new Date().getDay();
  const challenges = {
    2: { // Marți
      type: "quiz",
      question: "Care dintre aceste ingrediente este specific bucătăriei mediteraneene?",
      options: ["Wasabi", "Tahini", "Chimichurri", "Miso"]
    },
    3: { // Miercuri
      type: "choice",
      question: "Din aceste preparate Merazu, pe care l-ai vrea să-l încerci prima dată?",
      options: ["Risotto de fructe de mare", "Branzino la grătar", "Salată grecească", "Hummus artizanal", "Pasta al nero"]
    },
    4: { // Joi
      type: "quiz",
      question: "Ce înseamnă 'Merazu' în esența numelui?",
      options: ["Foc și piatră", "Mare, azur și Mediterana", "Soare și sare", "Pâine și vin"]
    },
    5: { // Vineri
      type: "choice",
      question: "Ce băutură ai alege pentru o seară la Merazu?",
      options: ["Vin alb sec", "Cocktail cu citrice", "Apă cu lămâie", "Vin roșu"]
    },
    6: { // Sâmbătă
      type: "quiz",
      question: "Care este desertul iconic mediteranean?",
      options: ["Tiramisu", "Baklava", "Crème brûlée", "Cheesecake"]
    },
    0: { // Duminică
      type: "choice",
      question: "Cum preferi să începi o masă la Merazu?",
      options: ["Mezze & sharing plates", "Supă cremă", "Salată proaspătă", "Direct la felul principal"]
    }
  };
  return challenges[day] || challenges[2];
}

// ─── Verificare dacă a jucat azi ──────────────────────────────
async function checkTodayPlayed(uid) {
  const todayId = getTodayId();
  const weekId = getWeekId();
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) return { played: false, data: null };

  const data = snap.data();

  // Reset săptămânal dacă s-a schimbat săptămâna
  if (data.currentWeekId && data.currentWeekId !== weekId) {
    await updateDoc(userRef, {
      weeklyScore: 0,
      weeklyInteractionsCount: 0,
      currentWeekId: weekId,
      daysPlayed: {},
    });
    data.weeklyScore = 0;
    data.weeklyInteractionsCount = 0;
    data.daysPlayed = {};
  }

  const played = data.lastInteractionDate === todayId;
  return { played, data };
}

// ─── Main ─────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // Logout
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });

  const today = new Date().getDay();

  // Luni = pauză
  if (today === PAUSE_DAY) {
    showState("pause-state");

    // Afișăm totuși punctele
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const d = snap.data();
      updatePointsDisplay(d.totalWallet || 0, d.weeklyScore || 0);
    }
    return;
  }

  // Alte zile = provocarea zilei
  showState("challenge-state");

  const { played, data } = await checkTodayPlayed(user.uid);

  updatePointsDisplay(data?.totalWallet || 0, data?.weeklyScore || 0);

  // Streak: calculăm zilele jucate din săptămâna curentă
  const daysPlayed = data?.daysPlayed ? Object.keys(data.daysPlayed).map(dateStr => {
    return new Date(dateStr).getDay();
  }) : [];
  renderStreak(daysPlayed);

  // Încarcă provocarea din Firestore (dacă există) sau folosește fallback
  let challenge = null;
  try {
    const challengeRef = doc(db, "challenges", getTodayId());
    const challengeSnap = await getDoc(challengeRef);
    if (challengeSnap.exists()) {
      challenge = challengeSnap.data();
    }
  } catch (e) {
    // Firestore rules pot bloca - folosim fallback
  }

  if (!challenge) {
    challenge = getDefaultChallenge();
  }

  renderChallenge(challenge, played, data?.weeklyScore || 0);
});
