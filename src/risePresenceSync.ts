import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { riseDb, riseAuthReady } from "./riseFirebase";

// Noms alignés sur src/config/presenceSchema.js du tableau de bord RISE Presence
const PRESENCE_COLLECTION = "presence";
const USERS_COLLECTION = "users";
const STATUT_CONNECTE = "Connecté";
const STATUT_DECONNECTE = "Déconnecté";

// Construit un identifiant stable et valide pour Firestore à partir de l'identifiant
// FleetGest de la personne, pour qu'un même utilisateur soit toujours reconnu comme
// la même personne par RISE Presence, même si la connexion technique est anonyme.
function stableUid(identifier: string): string {
  const sanitized = identifier
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire les accents
    .replace(/[^a-z0-9_-]/g, "-")
    .slice(0, 120);
  return `fleetgest-${sanitized || "utilisateur"}`;
}

// À appeler lors d'une connexion réussie (création de compte ou connexion) dans FleetGest.
// N'interrompt jamais le flux de connexion de FleetGest en cas d'échec (erreur journalisée
// uniquement) : le signalement de présence est une fonctionnalité annexe, pas critique.
export async function signalPresenceConnected(identifier: string, email: string, fonction: string) {
  try {
    await riseAuthReady;
    const uid = stableUid(identifier);
    const userRef = doc(riseDb, USERS_COLLECTION, uid);
    const existingUser = await getDoc(userRef);
    await Promise.all([
      setDoc(
        doc(riseDb, PRESENCE_COLLECTION, uid),
        {
          uid,
          displayName: identifier,
          email: email || "",
          role: fonction || "",
          application: "FleetGest",
          statut: STATUT_CONNECTE,
          connexion: serverTimestamp(),
          deconnexion: null,
        },
        { merge: true }
      ),
      setDoc(
        userRef,
        {
          uid,
          displayName: identifier,
          email: email || "",
          role: fonction || "",
          updatedAt: serverTimestamp(),
          ...(existingUser.exists() ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      ),
    ]);
  } catch (err) {
    console.error("[RISE Presence] Échec du signalement de connexion :", err);
  }
}

// À appeler lors de la déconnexion dans FleetGest.
export async function signalPresenceDisconnected(identifier: string) {
  try {
    await riseAuthReady;
    const uid = stableUid(identifier);
    await setDoc(
      doc(riseDb, PRESENCE_COLLECTION, uid),
      { statut: STATUT_DECONNECTE, deconnexion: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.error("[RISE Presence] Échec du signalement de déconnexion :", err);
  }
}
