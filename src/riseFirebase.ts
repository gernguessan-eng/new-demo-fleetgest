import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// Connexion à un SECOND projet Firebase, séparé de celui d'AtelierGest, utilisé
// uniquement pour signaler à "RISE Presence" (tableau de bord de suivi des
// connexions) qui est actuellement connecté dans AtelierGest.
//
// Ces informations ne sont pas secrètes : elles identifient le projet, pas vos
// données. Source : Console Firebase → riseappli-prod → Paramètres du projet.
const riseFirebaseConfig = {
  apiKey: "AIzaSyAdjUYlswy-rfk0cwVs2Qly5-iViNrhKqk",
  authDomain: "riseappli-prod.firebaseapp.com",
  projectId: "riseappli-prod",
  storageBucket: "riseappli-prod.firebasestorage.app",
  messagingSenderId: "404378933325",
  appId: "1:404378933325:web:881815792a58b529346404",
};

// Le second argument ("rise") donne un nom distinct à cette instance Firebase,
// pour qu'elle cohabite sans conflit avec celle d'AtelierGest (ateliergest-prod).
const riseApp = initializeApp(riseFirebaseConfig, "rise");
export const riseDb = getFirestore(riseApp);
const riseAuth = getAuth(riseApp);

// Connexion anonyme automatique : sert uniquement à satisfaire la règle de
// sécurité "request.auth != null" du projet riseappli-prod. Elle ne représente
// pas une vraie personne — l'identité réelle (nom, email, fonction) est écrite
// séparément dans le contenu des documents (voir risePresenceSync.ts).
export const riseAuthReady: Promise<void> = new Promise((resolve) => {
  onAuthStateChanged(riseAuth, (user) => {
    if (user) {
      resolve();
    } else {
      signInAnonymously(riseAuth).catch((err) => {
        console.error("[RISE Presence] Échec de la connexion technique :", err);
        resolve();
      });
    }
  });
});
