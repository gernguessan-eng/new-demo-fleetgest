import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { signalPresenceConnected, signalPresenceDisconnected } from "./risePresenceSync";

const USERS_COLLECTION = "users";

export type UserRole = "Administrateur" | "Agent" | "Client";

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
}

function normalizeRole(role?: string): UserRole {
  if (role === "Administrateur" || role === "Agent" || role === "Client") return role;
  return "Client";
}

async function readOrCreateProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, USERS_COLLECTION, user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const fallback: UserProfile = {
      uid: user.uid,
      email: user.email || "",
      role: "Administrateur", // premier compte créé = administrateur par défaut
      displayName: user.displayName || user.email || "",
    };
    await setDoc(ref, { ...fallback, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    return fallback;
  }
  const data = snap.data();
  return {
    uid: user.uid,
    email: user.email || String(data?.email || ""),
    role: normalizeRole(data?.role),
    displayName: String(data?.displayName || user.displayName || user.email || ""),
  };
}

export async function registerWithEmail(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const profile = await readOrCreateProfile(cred.user);
  const finalProfile = { ...profile, displayName: displayName || profile.displayName };
  await setDoc(doc(db, USERS_COLLECTION, cred.user.uid), { displayName: finalProfile.displayName }, { merge: true });
  signalPresenceConnected(finalProfile.displayName, finalProfile.email, finalProfile.role);
  return finalProfile;
}

export async function loginWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await readOrCreateProfile(cred.user);
  signalPresenceConnected(profile.displayName, profile.email, profile.role);
  return profile;
}

export function observeAuth(callback: (profile: UserProfile | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    const profile = await readOrCreateProfile(user);
    callback(profile);
    // Re-signale la présence à chaque changement d'état d'authentification, y compris une
    // session restaurée automatiquement au rechargement de page (pas seulement lors d'un
    // clic explicite sur "Se connecter") : sinon RISE Presence peut rester bloqué sur
    // "Déconnecté" alors que l'utilisateur est bel et bien actif dans FleetGest.
    signalPresenceConnected(profile.displayName, profile.email, profile.role);
  });
}

export async function logout(profile: UserProfile | null) {
  if (profile) signalPresenceDisconnected(profile.displayName);
  return signOut(auth);
}
