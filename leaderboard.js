// leaderboard.js
import {
  auth, db, onAuthStateChanged, signOut,
  collection, query, where, getDocs
} from "./firebase-config.js";

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function medalEmoji(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function renderRow(rank, user, isCurrentUser) {
  const medal = medalEmoji(rank);
  const highlightClass = isCurrentUser ? "rank-row-self" : "";
  const rankDisplay = medal ? medal : rank;

  return `
    <div class="rank-row ${highlightClass}">
      <span class="rank-number">${rankDisplay}</span>
      <div class="rank-avatar">${initials(user.displayName)}</div>
      <span class="rank-name">${isCurrentUser ? "Tu" : (user.displayName || "Anonim")}</span>
      <span class="rank-points">${user.weeklyScore || 0} pct</span>
    </div>
  `;
}

async function loadLeaderboard(currentUid) {
  const loadingEl = document.getElementById("loading-state");
  const listEl = document.getElementById("rank-list");
  const emptyEl = document.getElementById("empty-state");

  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("weeklyScore", ">", 0));
    const snap = await getDocs(q);

    const users = [];
    snap.forEach(docSnap => {
      users.push({ uid: docSnap.id, ...docSnap.data() });
    });

    users.sort((a, b) => (b.weeklyScore || 0) - (a.weeklyScore || 0));

    loadingEl.style.display = "none";

    if (users.length === 0) {
      emptyEl.style.display = "block";
      return;
    }

    listEl.style.display = "flex";
    listEl.innerHTML = users
      .slice(0, 20)
      .map((user, idx) => renderRow(idx + 1, user, user.uid === currentUid))
      .join("");

  } catch (err) {
    console.error("Eroare la încărcarea clasamentului:", err);
    loadingEl.style.display = "none";
    emptyEl.style.display = "block";
    emptyEl.querySelector("p").textContent = "Nu am putut încărca clasamentul. Încearcă din nou.";
  }
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

  await loadLeaderboard(user.uid);
});
