import {
  auth, db, onAuthStateChanged, signOut,
  doc, getDoc, updateDoc, increment, serverTimestamp
} from "./firebase-config.js";

const VAULT_DAY = 1;

const REWARDS = [
  { label: "Discount 5%", emoji: "🏷️", weight: 35, type: "discount", value: 5 },
  { label: "Discount 10%", emoji: "🏷️", weight: 28, type: "discount", value: 10 },
  { label: "1 desert gratuit", emoji: "🍰", weight: 22, type: "product", value: "1 desert" },
  { label: "2 deserturi gratuite", emoji: "🍰", weight: 12, type: "product", value: "2 deserturi" },
  { label: "Discount 50%", emoji: "🎉", weight: 3, type: "discount", value: 50 },
];

function pickReward() {
  const total = REWARDS.reduce((sum, r) => sum + r.weight, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (const reward of REWARDS) {
    acc += reward.weight;
    if (r <= acc) return reward;
  }
  return REWARDS[0];
}

function generateCode() {
  return "MZ-" + Math.random().toString(36).substring(2, 7).toUpperCase();
}

function getTodayId() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function showState(stateId) {
  const states = ["loading-state", "not-monday-state", "not-eligible-state", "already-opened-state", "vault-state"];
  states.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === stateId) ? "block" : "none";
  });
}

async function openVault(user, userData) {
  const btn = document.getElementById("vault-open-btn");
  const lid = document.getElementById("lid-wrap");
  const rewardWrap = document.getElementById("reward-icon");
  const rewardEmoji = document.getElementById("reward-emoji");
  const status = document.getElementById("vault-status-text");

  btn.disabled = true;
  btn.style.opacity = "0.6";
  status.textContent = "Se deschide...";

  const shakeFrames = [0, -3, 3, -2, 2, 0];
  let shakeStep = 0;
  const shakeTimer = setInterval(() => {
    const deg = shakeFrames[shakeStep % shakeFrames.length];
    lid.style.transform = `rotate(${deg}deg) translateY(0px)`;
    shakeStep++;
  }, 180);

  setTimeout(async () => {
    clearInterval(shakeTimer);
    lid.style.transform = "rotate(-95deg) translateY(-40px) translateX(-60px)";
    lid.style.opacity = "0";

    const reward = pickReward();
    const code = generateCode();
    rewardEmoji.textContent = reward.emoji;

    setTimeout(() => {
      rewardWrap.style.opacity = "1";
      rewardWrap.style.transform = "translateY(0px) scale(1)";
      status.innerHTML = `Ai castigat: <strong>${reward.label}</strong><br><span style="font-family:monospace; font-size:13px; color:var(--color-coral);">${code}</span>`;
    }, 350);

    setTimeout(async () => {
      btn.textContent = "Revino luni viitoare";

      try {
        const userRef = doc(db, "users", user.uid);
        const todayId = getTodayId();
        await updateDoc(userRef, {
          [`vaultHistory.${todayId}`]: {
            reward: reward.label,
            code: code,
            claimedAt: serverTimestamp(),
          },
        });
      } catch (err) {
        console.error("Eroare la salvarea recompensei Vault:", err);
      }
    }, 600);

  }, 3000);
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

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    showState("not-eligible-state");
    return;
  }

  const data = snap.data();
  const todayId = getTodayId();

  if (data.vaultHistory && data.vaultHistory[todayId]) {
    const claimed = data.vaultHistory[todayId];
    document.getElementById("already-reward-text").textContent =
      `Ai castigat: ${claimed.reward} (cod: ${claimed.code})`;
    showState("already-opened-state");
    return;
  }

  const wasActive = data.daysPlayed && Object.keys(data.daysPlayed).length > 0;

  if (!wasActive) {
    showState("not-eligible-state");
    return;
  }

  showState("vault-state");

  document.getElementById("vault-open-btn").addEventListener("click", () => {
    openVault(user, data);
  });
});
