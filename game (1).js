import {
  auth, db, onAuthStateChanged, signOut,
  doc, getDoc, updateDoc, setDoc,
  serverTimestamp, increment
} from "./firebase-config.js";

const POINTS_PER_INTERACTION = 10;
const PAUSE_DAY = 1;

function getWeekId() {
  const now = new Date();
  const day = now.getDay();
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
  const days = { 2: "Marti", 3: "Miercuri", 4: "Joi", 5: "Vineri", 6: "Sambata", 0: "Duminica" };
  return days[dayNum] || "Azi";
}

function getChallengeType(dayNum) {
  if (dayNum === 2 || dayNum === 4) return "quiz";
  if (dayNum === 3 || dayNum === 5) return "tapgame";
  if (dayNum === 6 || dayNum === 0) return "hunt";
  return "quiz";
}

function showState(stateId) {
  ["loading-state", "pause-state", "challenge-state"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === stateId) ? "block" : "none";
  });
}

function showChallengeMode(modeId) {
  ["challenge-quiz", "challenge-choice", "challenge-hunt", "challenge-tapgame", "challenge-done"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === modeId) ? "block" : "none";
  });
}

function updatePointsDisplay(totalWallet, weeklyScore) {
  document.getElementById("total-wallet").textContent = `${totalWallet} pct`;
  document.getElementById("weekly-score").textContent = `${weeklyScore} pct`;
}

function updateMemberCode(memberCode) {
  const el = document.getElementById("member-code-display");
  if (el) el.textContent = memberCode ? "Cod membru: " + memberCode : "";
}

function renderStreak(daysPlayedThisWeek) {
  const dayIds = { 2: "day-2", 3: "day-3", 4: "day-4", 5: "day-5", 6: "day-6", 0: "day-0" };
  Object.entries(dayIds).forEach(([dayNum, elemId]) => {
    const el = document.getElementById(elemId);
    if (el) el.classList.toggle("active", daysPlayedThisWeek.includes(parseInt(dayNum)));
  });
}

function showDoneState(weeklyScore) {
  showChallengeMode("challenge-done");
  document.getElementById("points-earned-msg").textContent =
    "Ai " + weeklyScore + " puncte in aceasta saptamana. Revino maine!";
}

async function recordInteraction(extraPoints) {
  const user = auth.currentUser;
  if (!user) return null;

  const todayId = getTodayId();
  const weekId = getWeekId();
  const userRef = doc(db, "users", user.uid);
  const points = extraPoints !== undefined ? extraPoints : POINTS_PER_INTERACTION;

  await updateDoc(userRef, {
    totalWallet: increment(points),
    weeklyScore: increment(points),
    lastInteractionDate: todayId,
    weeklyInteractionsCount: increment(1),
    currentWeekId: weekId,
    ["daysPlayed." + todayId]: true,
  });

  const snap = await getDoc(userRef);
  return snap.data();
}

function renderQuiz(challenge) {
  showChallengeMode("challenge-quiz");
  const container = document.getElementById("quiz-options");
  container.innerHTML = "";
  challenge.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = String.fromCharCode(65+i) + ". " + opt;
    btn.addEventListener("click", async () => {
      const data = await recordInteraction();
      if (data) {
        updatePointsDisplay(data.totalWallet, data.weeklyScore);
        showDoneState(data.weeklyScore);
      }
    });
    container.appendChild(btn);
  });
}

function renderHunt(challenge) {
  showChallengeMode("challenge-hunt");
  const container = document.getElementById("hunt-options");
  container.innerHTML = "";
  challenge.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.addEventListener("click", async () => {
      const data = await recordInteraction();
      if (data) {
        updatePointsDisplay(data.totalWallet, data.weeklyScore);
        showDoneState(data.weeklyScore);
      }
    });
    container.appendChild(btn);
  });
}

function renderTapGame() {
  showChallengeMode("challenge-tapgame");
  const startBtn = document.getElementById("tap-start-btn");
  const arena = document.getElementById("tap-arena");
  const scoreDisplay = document.getElementById("tap-score-display");
  const timerDisplay = document.getElementById("tap-timer-display");

  let score = 0;
  let timeLeft = 15;
  let gameInterval = null;
  let spawnInterval = null;
  let gameActive = false;

  function spawnOlive() {
    if (!gameActive) return;
    const olive = document.createElement("div");
    olive.textContent = "\u{1FAD2}";
    olive.style.position = "absolute";
    olive.style.fontSize = "28px";
    olive.style.cursor = "pointer";
    olive.style.userSelect = "none";
    olive.style.left = (Math.random() * 85) + "%";
    olive.style.top = (Math.random() * 80) + "%";
    olive.style.transition = "transform 0.15s ease";
    olive.style.zIndex = "5";

    let tapped = false;
    const tapHandler = (e) => {
      e.preventDefault();
      if (tapped) return;
      tapped = true;
      score++;
      scoreDisplay.textContent = score;
      olive.style.transform = "scale(1.5)";
      olive.style.opacity = "0";
      setTimeout(() => olive.remove(), 150);
    };
    olive.addEventListener("touchstart", tapHandler, { passive: false });
    olive.addEventListener("click", tapHandler);

    arena.appendChild(olive);
    setTimeout(() => { if (olive.parentNode) olive.remove(); }, 1400);
  }

  startBtn.addEventListener("click", async () => {
    if (gameActive) return;
    gameActive = true;
    score = 0;
    timeLeft = 15;
    scoreDisplay.textContent = "0";
    timerDisplay.textContent = "15s";
    startBtn.disabled = true;
    startBtn.textContent = "Joaca!";
    arena.innerHTML = "";

    spawnInterval = setInterval(spawnOlive, 500);
    gameInterval = setInterval(async () => {
      timeLeft--;
      timerDisplay.textContent = timeLeft + "s";
      if (timeLeft <= 0) {
        clearInterval(gameInterval);
        clearInterval(spawnInterval);
        gameActive = false;
        arena.innerHTML = "<div style='display:flex; align-items:center; justify-content:center; height:100%; font-size:14px; color:var(--color-ink-soft);'>Joc terminat!</div>";

        const bonusPoints = POINTS_PER_INTERACTION + Math.min(score, 10);
        const data = await recordInteraction(bonusPoints);
        if (data) {
          updatePointsDisplay(data.totalWallet, data.weeklyScore);
          setTimeout(() => showDoneState(data.weeklyScore), 800);
        }
      }
    }, 1000);
  });
}

function getDefaultChallenge(dayNum, type) {
  const quizzes = {
    2: {
      question: "Care dintre aceste ingrediente este specific bucatariei mediteraneene?",
      options: ["Wasabi", "Tahini", "Chimichurri", "Miso"]
    },
    4: {
      question: "Ce inseamna 'Merazu' in esenta numelui?",
      options: ["Foc si piatra", "Mare, azur si Mediterana", "Soare si sare", "Paine si vin"]
    },
  };
  const hunts = {
    6: {
      question: "Cauta in restaurant: ce simbol apare pe logo-ul Merazu, alaturi de furculita?",
      options: ["O lira (instrument muzical)", "Un soare", "O ancora", "O ramura de maslin"]
    },
    0: {
      question: "Cauta in restaurant: ce material domina peretii si texturile interioare?",
      options: ["Piatra calda si tencuiala", "Metal industrial", "Sticla oglinda", "Plastic colorat"]
    },
  };

  if (type === "quiz") return Object.assign({ type: "quiz" }, quizzes[dayNum]);
  if (type === "hunt") return Object.assign({ type: "hunt" }, hunts[dayNum]);
  return { type: "tapgame" };
}

async function checkTodayPlayed(uid) {
  const todayId = getTodayId();
  const weekId = getWeekId();
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) return { played: false, data: null };

  const data = snap.data();

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

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });

  let overrideDay = null;

  async function loadDay(dayNum) {
    if (dayNum === PAUSE_DAY) {
      showState("pause-state");
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        updatePointsDisplay(d.totalWallet || 0, d.weeklyScore || 0);
      }
      return;
    }

    showState("challenge-state");

    const result = await checkTodayPlayed(user.uid);
    const played = overrideDay !== null ? false : result.played;
    const data = result.data;

    updatePointsDisplay(data ? data.totalWallet || 0 : 0, data ? data.weeklyScore || 0 : 0);
    updateMemberCode(data ? data.memberCode : null);

    const daysPlayed = (data && data.daysPlayed) ? Object.keys(data.daysPlayed).map(dateStr => new Date(dateStr).getDay()) : [];
    renderStreak(daysPlayed);

    document.getElementById("challenge-day-label").textContent = getDayName(dayNum);

    if (played) {
      document.getElementById("challenge-title").textContent = "";
      showDoneState(data ? data.weeklyScore || 0 : 0);
      return;
    }

    const challengeType = getChallengeType(dayNum);
    const challenge = getDefaultChallenge(dayNum, challengeType);

    if (challengeType === "quiz") {
      document.getElementById("challenge-title").textContent = challenge.question;
      renderQuiz(challenge);
    } else if (challengeType === "hunt") {
      document.getElementById("challenge-title").textContent = challenge.question;
      renderHunt(challenge);
    } else if (challengeType === "tapgame") {
      document.getElementById("challenge-title").textContent = "Provocarea zilei: Vanatoarea de masline";
      renderTapGame();
    }
  }

  document.querySelectorAll(".test-day-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      overrideDay = parseInt(btn.dataset.day);
      loadDay(overrideDay);
    });
  });

  const today = new Date().getDay();
  await loadDay(today);
});
