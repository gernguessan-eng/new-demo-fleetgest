import React, { createContext, useContext, useCallback } from 'react';
import type { Driver, Mission, PlanningEvent } from '../types';
import { useFirestoreCollection } from '../firestoreSync';

const SK_DRIVERS = 'parc_auto_drivers';
const SK_MISSIONS = 'parc_auto_missions';
const SK_PLANNING = 'parc_auto_planning';

// Note : la lecture directe de localStorage n'est plus utilisée pour les collections
// (elles sont désormais synchronisées avec Firestore via useFirestoreCollection).

const sampleDrivers: Driver[] = [
  { id: 'd1', nom: 'Kone', prenom: 'Amadou', telephone: '+225 07 12 34 56 78', email: 'a.kone@rehuel.ci', numero_permis: 'CI-2020-45678', categorie_permis: 'B', date_expiration_permis: '2027-05-15', date_embauche: '2021-03-01', vehicule_affecte_id: 'v1', statut: 'En mission', photo_url: '', notes: '' },
  { id: 'd2', nom: 'Kouamé', prenom: 'Jean', telephone: '+225 07 23 45 67 89', email: 'j.kouame@rehuel.ci', numero_permis: 'CI-2019-12345', categorie_permis: 'B-C', date_expiration_permis: '2026-11-30', date_embauche: '2020-06-15', vehicule_affecte_id: 'v2', statut: 'Disponible', photo_url: '', notes: '' },
  { id: 'd3', nom: 'Diallo', prenom: 'Fatou', telephone: '+225 07 34 56 78 90', email: 'f.diallo@rehuel.ci', numero_permis: 'CI-2021-78901', categorie_permis: 'B', date_expiration_permis: '2028-02-28', date_embauche: '2022-01-10', vehicule_affecte_id: 'v3', statut: 'Disponible', photo_url: '', notes: '' },
  { id: 'd4', nom: 'Bamba', prenom: 'Marie', telephone: '+225 07 56 78 90 12', email: 'm.bamba@rehuel.ci', numero_permis: 'CI-2022-34567', categorie_permis: 'B', date_expiration_permis: '2029-08-10', date_embauche: '2023-04-01', vehicule_affecte_id: 'v5', statut: 'En congé', photo_url: '', notes: 'Congé maternité' },
  { id: 'd5', nom: 'Traoré', prenom: 'Ibrahim', telephone: '+225 07 67 89 01 23', email: 'i.traore@rehuel.ci', numero_permis: 'CI-2018-56789', categorie_permis: 'B-C-D', date_expiration_permis: '2025-12-31', date_embauche: '2019-09-01', vehicule_affecte_id: 'v6', statut: 'Disponible', photo_url: '', notes: '' },
];

const sampleMissions: Mission[] = [
  { id: 'mi1', driverId: 'd1', vehicleId: 'v1', titre: 'Livraison Yamoussoukro', description: 'Livraison documents Direction', lieu_depart: 'Abidjan, Plateau', lieu_arrivee: 'Yamoussoukro', date_debut: '2025-07-20', date_fin: '2025-07-20', heure_depart: '06:00', heure_retour: '18:00', km_depart: 44800, km_retour: 45200, statut: 'Terminée', cout_mission: 35000, observations: '' },
  { id: 'mi2', driverId: 'd2', vehicleId: 'v2', titre: 'Déplacement commercial Bouaké', description: 'Visite clients région centre', lieu_depart: 'Abidjan, Cocody', lieu_arrivee: 'Bouaké', date_debut: '2025-07-22', date_fin: '2025-07-23', heure_depart: '07:00', heure_retour: '19:00', km_depart: 89000, km_retour: 89600, statut: 'Planifiée', cout_mission: 55000, observations: 'Nuitée prévue' },
  { id: 'mi3', driverId: 'd5', vehicleId: 'v6', titre: 'Transfert personnel San Pedro', description: 'Convoyage équipe projet', lieu_depart: 'Abidjan, Marcory', lieu_arrivee: 'San Pedro', date_debut: '2025-07-25', date_fin: '2025-07-26', heure_depart: '05:30', heure_retour: '20:00', km_depart: 72000, km_retour: 72900, statut: 'Planifiée', cout_mission: 78000, observations: '' },
];

const samplePlanning: PlanningEvent[] = [
  { id: 'pl1', driverId: 'd1', vehicleId: 'v1', titre: 'Mission Yamoussoukro', type: 'Mission', date_debut: '2025-07-20', date_fin: '2025-07-20', couleur: '#10b981', notes: '' },
  { id: 'pl2', driverId: 'd2', vehicleId: 'v2', titre: 'Mission Bouaké', type: 'Mission', date_debut: '2025-07-22', date_fin: '2025-07-23', couleur: '#6366f1', notes: '' },
  { id: 'pl3', driverId: 'd4', vehicleId: '', titre: 'Congé maternité', type: 'Congé', date_debut: '2025-07-01', date_fin: '2025-09-30', couleur: '#f59e0b', notes: '' },
  { id: 'pl4', driverId: 'd5', vehicleId: 'v6', titre: 'Mission San Pedro', type: 'Mission', date_debut: '2025-07-25', date_fin: '2025-07-26', couleur: '#8b5cf6', notes: '' },
  { id: 'pl5', driverId: 'd3', vehicleId: '', titre: 'Formation sécurité routière', type: 'Formation', date_debut: '2025-07-28', date_fin: '2025-07-29', couleur: '#06b6d4', notes: '' },
];

interface DriverContextType {
  drivers: Driver[];
  missions: Mission[];
  planning: PlanningEvent[];
  addDriver: (d: Driver) => void;
  updateDriver: (id: string, u: Partial<Driver>) => void;
  deleteDriver: (id: string) => void;
  importDrivers: (drivers: Driver[]) => void;
  addMission: (m: Mission) => void;
  updateMission: (id: string, u: Partial<Mission>) => void;
  deleteMission: (id: string) => void;
  addPlanningEvent: (e: PlanningEvent) => void;
  updatePlanningEvent: (id: string, u: Partial<PlanningEvent>) => void;
  deletePlanningEvent: (id: string) => void;
}

const DriverContext = createContext<DriverContextType | undefined>(undefined);

function getLinkedPlanningIdFromMissionId(missionId: string) {
  return missionId.startsWith('mi-pl-') ? missionId.slice('mi-pl-'.length) : `pl-mi-${missionId}`;
}

function getLinkedMissionIdFromPlanningId(planningId: string) {
  return planningId.startsWith('pl-mi-') ? planningId.slice('pl-mi-'.length) : `mi-pl-${planningId}`;
}

function buildPlanningFromMission(mission: Mission, planningId: string): PlanningEvent {
  return {
    id: planningId,
    driverId: mission.driverId,
    vehicleId: mission.vehicleId,
    titre: mission.titre,
    type: 'Mission',
    date_debut: mission.date_debut,
    date_fin: mission.date_fin,
    couleur: '#10b981',
    notes: mission.observations || mission.description || '',
  };
}

function buildMissionFromPlanning(event: PlanningEvent, missionId: string): Mission {
  return {
    id: missionId,
    driverId: event.driverId,
    vehicleId: event.vehicleId,
    titre: event.titre,
    description: event.notes || 'Mission créée automatiquement depuis la planification',
    lieu_depart: '',
    lieu_arrivee: '',
    date_debut: event.date_debut,
    date_fin: event.date_fin,
    heure_depart: '',
    heure_retour: '',
    km_depart: 0,
    km_retour: 0,
    statut: 'Planifiée',
    cout_mission: 0,
    observations: event.notes || 'Alimentée automatiquement depuis le sous-onglet Planification',
  };
}

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const [drivers, setDrivers] = useFirestoreCollection<Driver>(SK_DRIVERS, sampleDrivers);
  const [missions, setMissions] = useFirestoreCollection<Mission>(SK_MISSIONS, sampleMissions);
  const [planning, setPlanning] = useFirestoreCollection<PlanningEvent>(SK_PLANNING, samplePlanning);

  const addDriver = useCallback((d: Driver) => setDrivers(p => [...p, d]), []);
  const importDrivers = useCallback((newDrivers: Driver[]) => setDrivers(p => [...p, ...newDrivers]), []);
  const updateDriver = useCallback((id: string, u: Partial<Driver>) => setDrivers(p => p.map(d => d.id === id ? { ...d, ...u } : d)), []);
  const deleteDriver = useCallback((id: string) => {
    if (!confirm('Supprimer ce chauffeur et toutes ses missions/plannings associés ?')) return;
    setDrivers(p => p.filter(d => d.id !== id));
    setMissions(p => p.filter(m => m.driverId !== id));
    setPlanning(p => p.filter(e => e.driverId !== id));
  }, []);

  const addMission = useCallback((mission: Mission) => {
    setMissions(prev => {
      if (prev.some(m => m.id === mission.id)) return prev;
      return [...prev, mission];
    });
    const planningId = getLinkedPlanningIdFromMissionId(mission.id);
    const planningEvent = buildPlanningFromMission(mission, planningId);
    setPlanning(prev => {
      const exists = prev.some(e => e.id === planningId);
      return exists ? prev.map(e => e.id === planningId ? planningEvent : e) : [...prev, planningEvent];
    });
  }, []);

  const updateMission = useCallback((id: string, u: Partial<Mission>) => {
    setMissions(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, ...u } : m);
      const mission = updated.find(m => m.id === id);
      if (mission) {
        const planningId = getLinkedPlanningIdFromMissionId(id);
        const planningEvent = buildPlanningFromMission(mission, planningId);
        setPlanning(prevPlanning => {
          const exists = prevPlanning.some(e => e.id === planningId);
          return exists ? prevPlanning.map(e => e.id === planningId ? planningEvent : e) : [...prevPlanning, planningEvent];
        });
      }
      return updated;
    });
  }, []);

  const deleteMission = useCallback((id: string) => {
    if (!confirm('Supprimer cette mission ?')) return;
    setMissions(prev => prev.filter(m => m.id !== id));
    const planningId = getLinkedPlanningIdFromMissionId(id);
    setPlanning(prev => prev.filter(e => e.id !== planningId));
  }, []);

  const addPlanningEvent = useCallback((event: PlanningEvent) => {
    setPlanning(prev => {
      if (prev.some(e => e.id === event.id)) return prev;
      return [...prev, event];
    });

    if (event.type === 'Mission') {
      const missionId = getLinkedMissionIdFromPlanningId(event.id);
      const mission = buildMissionFromPlanning(event, missionId);
      setMissions(prev => {
        const exists = prev.some(m => m.id === missionId);
        return exists ? prev.map(m => m.id === missionId ? mission : m) : [...prev, mission];
      });
    }
  }, []);

  const updatePlanningEvent = useCallback((id: string, u: Partial<PlanningEvent>) => {
    setPlanning(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...u } : e);
      const event = updated.find(e => e.id === id);
      if (event) {
        const missionId = getLinkedMissionIdFromPlanningId(id);
        if (event.type === 'Mission') {
          const mission = buildMissionFromPlanning(event, missionId);
          setMissions(prevMissions => {
            const exists = prevMissions.some(m => m.id === missionId);
            return exists ? prevMissions.map(m => m.id === missionId ? { ...m, ...mission } : m) : [...prevMissions, mission];
          });
        } else {
          setMissions(prevMissions => prevMissions.filter(m => m.id !== missionId));
        }
      }
      return updated;
    });
  }, []);

  const deletePlanningEvent = useCallback((id: string) => {
    if (!confirm('Supprimer cet événement ?')) return;
    setPlanning(prev => prev.filter(e => e.id !== id));
    const missionId = getLinkedMissionIdFromPlanningId(id);
    setMissions(prev => prev.filter(m => m.id !== missionId));
  }, []);

  return React.createElement(DriverContext.Provider, {
    value: {
      drivers,
      missions,
      planning,
      addDriver,
      updateDriver,
      deleteDriver,
      importDrivers,
      addMission,
      updateMission,
      deleteMission,
      addPlanningEvent,
      updatePlanningEvent,
      deletePlanningEvent,
    },
  }, children);
}

export function useDrivers() {
  const ctx = useContext(DriverContext);
  if (!ctx) throw new Error('useDrivers must be used within DriverProvider');
  return ctx;
}
