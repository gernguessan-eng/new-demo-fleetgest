import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MobileTopBar from './components/MobileTopBar';
import Dashboard from './components/Dashboard';
import VehicleList from './components/VehicleList';
import VehicleDetail from './components/VehicleDetail';
import Analytics from './components/Analytics';
import Expenses from './components/Expenses';
import Settings from './components/Settings';
import GeolocTrajets from './components/GeolocTrajets';
import FuelManagement from './components/FuelManagement';
import DriverManagement from './components/DriverManagement';
import VehicleReform from './components/VehicleReform';
import Pneumatique from './components/Pneumatique';
import Sinistres from './components/Sinistres';
import Immobilisations from './components/Immobilisations';
import Import from './components/Import';
import Catalogue from './components/Catalogue';
import AddressBook from './components/AddressBook';
import AccessGate, { DemoBanner } from './components/AccessGate';
import Login from './components/Login';
import { observeAuth, logout, type UserProfile } from './authService';
import { VehicleProvider } from './store/VehicleStore';
import { DriverProvider } from './store/DriverStore';

function AppContent({ profile, onLogout }: { profile: UserProfile; onLogout: () => void }) {
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  // Téléphone : un glissement du doigt depuis le bord gauche de l'écran ouvre le menu
  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      start = window.innerWidth < 1024 && t.clientX <= 22 ? { x: t.clientX, y: t.clientY } : null;
    };
    const up = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      if (t.clientX - start.x > 70 && Math.abs(t.clientX - start.x) > Math.abs(t.clientY - start.y) * 1.5) setNavOpen(true);
      start = null;
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchend', up); };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <DemoBanner />
      <div className="flex items-center justify-end gap-3 bg-slate-900 px-4 py-1.5 text-xs text-slate-300 print:hidden">
        <span>{profile.displayName || profile.email} · {profile.role}</span>
        <button onClick={onLogout} className="rounded bg-slate-700 px-2.5 py-1 font-semibold text-white hover:bg-slate-600">
          Se déconnecter
        </button>
      </div>
      <div className="flex flex-1">
        <Sidebar open={navOpen} onClose={closeNav} />
        <div className="flex min-w-0 flex-1 flex-col lg:ml-64 print:ml-0">
        <MobileTopBar open={navOpen} onMenu={() => setNavOpen(true)} />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 print:p-0">
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/vehicules"    element={<VehicleList />} />
            <Route path="/vehicules/import" element={<Import />} />
            <Route path="/vehicule/:id" element={<VehicleDetail />} />
            <Route path="/chauffeurs"   element={<DriverManagement />} />
            <Route path="/depenses"     element={<Expenses />} />
            <Route path="/carburant"    element={<FuelManagement />} />
            <Route path="/pneumatique"  element={<Pneumatique />} />
            <Route path="/sinistres"    element={<Sinistres />} />
            <Route path="/immobilisations" element={<Immobilisations />} />
            <Route path="/catalogue"     element={<Catalogue />} />
            <Route path="/contacts"      element={<AddressBook />} />
            <Route path="/geoloc"       element={<GeolocTrajets />} />
            <Route path="/graphiques"   element={<Analytics />} />
            <Route path="/reforme"      element={<VehicleReform />} />
            <Route path="/parametres"   element={<Settings />} />
            <Route path="/impression"   element={<Navigate to="/vehicules" replace />} />
            <Route path="/impression/:id" element={<Navigate to="/vehicules" replace />} />
            <Route path="/apercu"       element={<Navigate to="/vehicules" replace />} />
          </Routes>
        </main>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = observeAuth((p) => {
      setProfile(p);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-400">Chargement…</div>;
  }

  if (!profile) {
    return <Login onLogin={setProfile} />;
  }

  return (
    <AccessGate>
      <VehicleProvider>
        <DriverProvider>
          <BrowserRouter>
            <AppContent profile={profile} onLogout={() => logout(profile).then(() => setProfile(null))} />
          </BrowserRouter>
        </DriverProvider>
      </VehicleProvider>
    </AccessGate>
  );
}
