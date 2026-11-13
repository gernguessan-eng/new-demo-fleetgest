import { useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db, authReady } from "./firebase";

/**
 * Synchronise un tableau d'état React avec une collection Firestore.
 *
 * - Au montage : charge les documents existants depuis Firestore.
 *   Si la collection est vide (premier lancement), elle est initialisée
 *   avec les données de démonstration fournies en `initialData`.
 * - À chaque appel du setter renvoyé : met à jour l'état local ET
 *   répercute la différence (ajouts/modifications/suppressions) vers Firestore.
 *
 * Utilisation : remplace `useState<Client[]>(initialClients)` par
 * `useFirestoreCollection<Client>("clients", initialClients)` — le setter
 * renvoyé a exactement la même signature que celui de `useState`, donc
 * tout le code existant (`setClients((p) => [...])`) continue de fonctionner
 * sans modification.
 */
export function useFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  initialData: T[]
): [T[], (updater: T[] | ((prev: T[]) => T[])) => void, boolean] {
  // On démarre avec un tableau vide (et non les données de démo) : celles-ci ne doivent servir
  // qu'à amorcer Firestore si la collection est vraiment vide, jamais s'afficher à l'écran comme
  // si elles étaient réelles pendant le bref instant où le chargement Firestore est en cours.
  const [items, setItemsState] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Copie de référence utilisée pour calculer les différences à synchroniser vers Firestore
  const lastSyncedRef = useRef<T[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await authReady;
        if (cancelled) return;
        const snap = await getDocs(collection(db, collectionName));
        if (cancelled) return;
        if (snap.empty) {
          // Première utilisation : on amorce Firestore avec les données de démonstration
          await Promise.all(initialData.map((item) => setDoc(doc(db, collectionName, item.id), item as any)));
          lastSyncedRef.current = initialData;
          setItemsState(initialData);
        } else {
          const loadedItems = snap.docs.map((d) => d.data() as T);
          lastSyncedRef.current = loadedItems;
          setItemsState(loadedItems);
        }
      } catch (err) {
        console.error(`[Firestore] Échec du chargement de "${collectionName}" — utilisation des données locales.`, err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  const setItems = (updater: T[] | ((prev: T[]) => T[])) => {
    setItemsState((prev) => {
      const next = typeof updater === "function" ? (updater as (prev: T[]) => T[])(prev) : updater;
      syncToFirestore(collectionName, lastSyncedRef.current, next);
      lastSyncedRef.current = next;
      return next;
    });
  };

  return [items, setItems, loaded];
}

// Calcule la différence entre deux états d'une collection et répercute uniquement
// les documents ajoutés/modifiés (écriture) ou disparus (suppression) vers Firestore.
async function syncToFirestore<T extends { id: string }>(collectionName: string, prev: T[], next: T[]) {
  const prevById = new Map(prev.map((item) => [item.id, item]));
  const nextIds = new Set(next.map((item) => item.id));

  const toDelete = prev.filter((item) => !nextIds.has(item.id));
  const toWrite = next.filter((item) => {
    const old = prevById.get(item.id);
    return !old || JSON.stringify(old) !== JSON.stringify(item);
  });

  if (toDelete.length === 0 && toWrite.length === 0) return;

  try {
    await authReady;
    await Promise.all([
      ...toDelete.map((item) => deleteDoc(doc(db, collectionName, item.id))),
      ...toWrite.map((item) => setDoc(doc(db, collectionName, item.id), item as any)),
    ]);
  } catch (err) {
    console.error(`[Firestore] Échec de la synchronisation de "${collectionName}".`, err);
  }
}
