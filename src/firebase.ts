import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getStorage } from "firebase/storage";

// ⚠️ Remplacez les valeurs ci-dessous par celles de VOTRE projet Firebase FleetGest
// (Console Firebase → ⚙️ Paramètres du projet → Vos applications → Config SDK).
// Ces informations ne sont pas secrètes : elles identifient votre projet, pas vos données.
const firebaseConfig = {
  apiKey: "AIzaSyA4Zvh53bU16RgzR2gFjLFK1-Yq2GesWGo",
  authDomain: "g4sfleetgest.firebaseapp.com",
  projectId: "g4sfleetgest",
  storageBucket: "g4sfleetgest.firebasestorage.app",
  messagingSenderId: "654300641308",
  appId: "1:654300641308:web:ae177a6083788628b347d9",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);

// Firebase Storage — photos et documents (carte grise, permis…) : seule l'URL est conservée
// dans Firestore, jamais l'image en base64 (limite de 1 Mo par document).
export const storage = getStorage(firebaseApp);

// Contrairement à AtelierGest, FleetGest a un vrai écran de connexion (voir authService.ts /
// Login.tsx) : pas de connexion anonyme technique ici. `authReady` se résout dès qu'un
// utilisateur réellement connecté est détecté — utile pour firestoreSync.ts, qui n'est de
// toute façon monté qu'une fois l'utilisateur authentifié (voir App.tsx).
export const authReady: Promise<void> = new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      unsubscribe();
      resolve();
    }
  });
});
