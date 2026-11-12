import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Importe une image (photo véhicule ou document administratif) dans Firebase Storage et
 * renvoie son URL de téléchargement — c'est cette URL (une simple chaîne courte) qui est
 * ensuite stockée sur le véhicule dans Firestore, jamais l'image elle-même en base64.
 *
 * @param vehicleId identifiant du véhicule (utilisé comme dossier de rangement)
 * @param docKey    clé du document, ex: "carte_grise", "patente", "photo"…
 */
export async function uploadVehicleImage(vehicleId: string, docKey: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `vehicles/${vehicleId}/${docKey}_${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * Importe un document chauffeur (permis de conduire recto/verso, photo…) dans Firebase
 * Storage et renvoie son URL de téléchargement, sur le même principe que uploadVehicleImage.
 *
 * @param driverId identifiant du chauffeur (utilisé comme dossier de rangement)
 * @param docKey   clé du document, ex: "permis_recto_url", "permis_verso_url", "photo"…
 */
export async function uploadDriverImage(driverId: string, docKey: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `drivers/${driverId}/${docKey}_${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

// Accepte les images ainsi que le PDF (courant pour un permis, une carte grise ou une
// patente scannée). Le nom "validateImageFile" est conservé pour ne pas casser les appels
// existants ailleurs dans le code.
export function validateImageFile(file: File): string | null {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isImage && !isPdf) return 'Veuillez sélectionner une image (JPG, PNG, WEBP…) ou un PDF.';
  if (file.size > MAX_IMAGE_SIZE_BYTES) return 'Le fichier ne doit pas dépasser 10 Mo.';
  return null;
}
