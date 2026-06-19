import {
  auth, db, onAuthStateChanged, signOut,
  doc, getDoc, updateDoc, setDoc,
  serverTimestamp, increment
} from "./firebase-config.js";

const POINTS_PER_INTERACTION = 10;
const PAUSE_DAY = 1;

function getDayName(dayNum) {
  const days = { 2: "Quiz", 3: "Mini-joc", 4: "Quiz", 5: "Mini-joc", 6: "Cauta-n restaurant", 0: "Cauta-n restaurant", 1: "Pauza" };
  return days[dayNum] || "Demo";
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
  document.getElementById("total-wallet").textContent = totalWallet + " pct";
  document.getElementById("weekly-score").textContent = weeklyScore + " pct";
}

function updateMemberCode(memberCode) {
  const el = document.getElementById("member-code-display");
  if (el) el.textContent = memberCode ? "Cod membru: " + memberCode : "";
}

// In demo NU bifam zile in streak - nu are relevanta cand jocul e repetabil nelimitat
function renderStreak() {
  ["day-2","day-3","day-4","day-5","day-6","day-0"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  });
}

// DEMO: nu blocheaza niciodata - mereu arata un buton de "Mai joaca o data"
function showDemoDoneState(weeklyScore, onPlayAgain) {
  showChallengeMode("challenge-done");
  document.getElementById("points-earned-msg").textContent =
    "Scor saptamanal demo: " + weeklyScore + " pct";

  let replayBtn = document.getElementById("demo-replay-btn");
  if (!replayBtn) {
    replayBtn = document.createElement("button");
    replayBtn.id = "demo-replay-btn";
    replayBtn.className = "btn btn-primary";
    replayBtn.style.marginTop = "16px";
    replayBtn.style.width = "auto";
    replayBtn.style.padding = "10px 28px";
    document.getElementById("challenge-done").appendChild(replayBtn);
  }
  replayBtn.textContent = "Joaca din nou";
  replayBtn.onclick = onPlayAgain;
}

async function recordInteraction(extraPoints) {
  const user = auth.currentUser;
  if (!user) return null;

  const userRef = doc(db, "users", user.uid);
  const points = extraPoints !== undefined ? extraPoints : POINTS_PER_INTERACTION;

  await updateDoc(userRef, {
    totalWallet: increment(points),
    weeklyScore: increment(points),
  });

  const snap = await getDoc(userRef);
  return snap.data();
}

function renderQuiz(challenge, replay) {
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
        showDemoDoneState(data.weeklyScore, replay);
      }
    });
    container.appendChild(btn);
  });
}

function renderHunt(challenge, replay) {
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
        showDemoDoneState(data.weeklyScore, replay);
      }
    });
    container.appendChild(btn);
  });
}

function renderTapGame(replay) {
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

  function startGame() {
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
          setTimeout(() => showDemoDoneState(data.weeklyScore, replay), 800);
        }
        startBtn.disabled = false;
        startBtn.textContent = "Start";
      }
    }, 1000);
  }

  startBtn.onclick = startGame;
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

  if (type === "quiz") return Object.assign({ type: "quiz" }, quizzes[dayNum] || quizzes[2]);
  if (type === "hunt") return Object.assign({ type: "hunt" }, hunts[dayNum] || hunts[6]);
  return { type: "tapgame" };
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

  async function loadType(dayNum) {
    if (dayNum === PAUSE_DAY) {
      showState("pause-state");
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        updatePointsDisplay(d.totalWallet || 0, d.weeklyScore || 0);
        updateMemberCode(d.memberCode);
      }
      return;
    }

    showState("challenge-state");

    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : null;

    updatePointsDisplay(data ? data.totalWallet || 0 : 0, data ? data.weeklyScore || 0 : 0);
    updateMemberCode(data ? data.memberCode : null);
    renderStreak();

    document.getElementById("challenge-day-label").textContent = getDayName(dayNum);

    const challengeType = getChallengeType(dayNum);
    const challenge = getDefaultChallenge(dayNum, challengeType);
    const replay = () => loadType(dayNum);

    if (challengeType === "quiz") {
      document.getElementById("challenge-title").textContent = challenge.question;
      renderQuiz(challenge, replay);
    } else if (challengeType === "hunt") {
      document.getElementById("challenge-title").textContent = challenge.question;
      renderHunt(challenge, replay);
    } else if (challengeType === "tapgame") {
      document.getElementById("challenge-title").textContent = "Provocarea zilei: Vanatoarea de masline";
      renderTapGame(replay);
    }
  }

  document.querySelectorAll(".test-day-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      loadType(parseInt(btn.dataset.day));
    });
  });

  await loadType(2);
});
