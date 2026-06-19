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
  runTransaction,
} from "./firebase-config.js";

async function getNextMemberCode() {
  const counterRef = doc(db, "counters", "members");
  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const current = counterSnap.exists() ? counterSnap.data().count || 0 : 0;
    const next = current + 1;
    transaction.set(counterRef, { count: next });
    return next;
  });
  return "MZ-" + String(nextNumber).padStart(4, "0");
}

function initialUserData(email, displayName, birthConfirmed16, memberCode) {
  return {
    email,
    displayName: displayName || email.split("@")[0],
    memberCode: memberCode,
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
      "Trebuie sa confirmi ca ai cel putin 16 ani impliniti pentru a te inscrie."
    );
  }
  const memberCode = await getNextMemberCode();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;
  await setDoc(doc(db, "users", uid), initialUserData(email, displayName, ageConfirmed, memberCode));
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
    "auth/email-already-in-use": "Acest email este deja inregistrat. Incearca sa te autentifici.",
    "auth/invalid-email": "Adresa de email nu este valida.",
    "auth/weak-password": "Parola trebuie sa aiba cel putin 6 caractere.",
    "auth/user-not-found": "Nu exista niciun cont cu acest email.",
    "auth/wrong-password": "Parola introdusa este incorecta.",
    "auth/invalid-credential": "Email sau parola incorecta.",
    "auth/too-many-requests": "Prea multe incercari. Asteapta putin si reincearca.",
  };
  return map[code] || error.message || "A aparut o eroare. Incearca din nou.";
}

export { registerUser, loginUser, logoutUser, getUserProfile, watchAuthState, mapAuthError };
