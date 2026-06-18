// js/auth.js
// Gestionează înregistrarea, autentificarea și structura inițială a unui utilizator nou.

import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "./firebase-config.js";

// Structura inițială a unui utilizator nou în Firestore.
// totalWallet = Portofelul Total (permanent, conform Regulamentului art. 4.3)
// weeklyScore = Scorul Săptămânal (resetat lunea, conform art. 4.3)
function initialUserData(email, displayName, birthConfirmed16) {
  return {
    email,
    displayName: displayName || email.split("@")[0],
    createdAt: serverTimestamp(),
    birthConfirmed16: !!birthConfirmed16,
    totalWallet: 0,
    weeklyScore: 0,
    currentWeekId: null,
    weeklyInteractionsCount: 0,
    hasWonRandomDraw: false,
    vaultOpenedThisWeek: false,
    lastInteractionDate: null,
  };
}

async function registerUser(email, password, displayName, ageConfirmed) {
  if (!ageConfirmed) {
    throw new Error(
      "Trebuie să confirmi că ai cel puțin 16 ani împliniți pentru a te înscrie."
    );
  }
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;
  await setDoc(doc(db, "users", uid), initialUserData(email, displayName, ageConfirmed));
  return credential.user;
}

async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

async function logoutUser() {
  await signOut(auth);
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

function mapAuthError(error) {
  const code = error.code || "";
  const map = {
    "auth/email-already-in-use": "Acest email este deja înregistrat. Încearcă să te autentifici.",
    "auth/invalid-email": "Adresa de email nu este validă.",
    "auth/weak-password": "Parola trebuie să aibă cel puțin 6 caractere.",
    "auth/user-not-found": "Nu există niciun cont cu acest email.",
    "auth/wrong-password": "Parola introdusă este incorectă.",
    "auth/invalid-credential": "Email sau parolă incorectă.",
    "auth/too-many-requests": "Prea multe încercări. Așteaptă puțin și reîncearcă.",
  };
  return map[code] || error.message || "A apărut o eroare. Încearcă din nou.";
}

export { registerUser, loginUser, logoutUser, getUserProfile, watchAuthState, mapAuthError };
