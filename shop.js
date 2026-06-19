import {
  auth, db, onAuthStateChanged, signOut,
  doc, getDoc, updateDoc, increment, serverTimestamp
} from "./firebase-config.js";

const SHOP_ITEMS = [
  { id: "discount10", label: "Reducere 10%", cost: 300, emoji: "🏷️" },
  { id: "dessert", label: "Desert gratuit", cost: 450, emoji: "🍰" },
  { id: "main", label: "Fel principal", cost: 900, emoji: "🍽️" },
  { id: "discount50", label: "Reducere 50%", cost: 2000, emoji: "🎉" },
];

function generateCode() {
  return "MZ-" + Math.random().toString(36).substring(2, 7).toUpperCase();
}

function getTodayId() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function renderShop(wallet) {
  const grid = document.getElementById("shop-grid");
  grid.innerHTML = SHOP_ITEMS.map(item => {
    const canAfford = wallet >= item.cost;
    return `
      <div class="card" style="text-align:center; padding:16px 10px;">
        <div style="font-size:26px; margin-bottom:8px;">${item.emoji}</div>
        <p style="font-size:13px; font-weight:500; margin:0 0 4px;">${item.label}</p>
        <p style="font-size:12px; color:var(--color-ink-soft); margin:0 0 10px;">${item.cost} pct</p>
        <button class="btn ${canAfford ? 'btn-primary' : 'btn-ghost'}" style="font-size:12px; padding:8px;" data-item-id="${item.id}" ${canAfford ? '' : 'disabled'}>
          ${canAfford ? 'Revendică' : 'Insuficient'}
        </button>
      </div>
    `;
  }).join("");

  grid.querySelectorAll("button[data-item-id]").forEach(btn => {
    btn.addEventListener("click", () => redeemItem(btn.dataset.itemId));
  });
}

let currentUser = null;
let currentWallet = 0;

async function redeemItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item || !currentUser) return;

  if (currentWallet < item.cost) return;

  const code = generateCode();
  const todayId = getTodayId();

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      totalWallet: increment(-item.cost),
      [`redemptions.${todayId}_${itemId}`]: {
        item: item.label,
        code: code,
        cost: item.cost,
        redeemedAt: serverTimestamp(),
        validated: false,
      },
    });

    currentWallet -= item.cost;
    document.getElementById("wallet-display").textContent = `${currentWallet} pct`;
    renderShop(currentWallet);

    document.getElementById("modal-title").textContent = item.label;
    document.getElementById("modal-code").textContent = code;
    document.getElementById("redeem-modal").style.display = "flex";

  } catch (err) {
    console.error("Eroare la revendicare:", err);
    alert("A apărut o eroare. Încearcă din nou.");
  }
}

document.getElementById("modal-close").addEventListener("click", () => {
  document.getElementById("redeem-modal").style.display = "none";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });

  const snap = await getDoc(doc(db, "users", user.uid));
  currentWallet = snap.exists() ? (snap.data().totalWallet || 0) : 0;

  document.getElementById("wallet-display").textContent = `${currentWallet} pct`;
  document.getElementById("loading-state").style.display = "none";
  document.getElementById("shop-grid").style.display = "grid";

  renderShop(currentWallet);
});
