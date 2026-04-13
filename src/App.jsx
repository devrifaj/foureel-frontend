import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import Dashboard from './pages/Dashboard';
import HomeView from './pages/dashboard/HomeView';
import AgendaView from './pages/dashboard/AgendaView';
import KlantenView from './pages/dashboard/KlantenView';
import TakenView from './pages/dashboard/TakenView';
import ArchiefView from './pages/dashboard/ArchiefView';
import WorkspaceView from './pages/dashboard/WorkspaceView';
import PulseView from './pages/dashboard/PulseView';
import Portal from './pages/Portal';
import './styles/global.css';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div style={{ fontFamily:'Montserrat', fontSize:'24px', fontWeight:'600', color:'var(--accent)' }}>4REEL</div>
    </div>
  );
  const role = user?.role;
  if (!user) {
    return (
      <Routes>
        <Route path="/portaal/*" element={<Portal />} />
        <Route path="/*" element={<Navigate to="/portaal" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/portaal/*" element={<Portal />} />
      <Route
        path="/"
        element={role === 'client' ? <Navigate to="/portaal" replace /> : <Dashboard />}
      >
        <Route index element={<HomeView />} />
        <Route path="agenda" element={<AgendaView />} />
        <Route path="klanten" element={<KlantenView />} />
        <Route path="taken" element={<TakenView />} />
        <Route path="archief" element={<ArchiefView />} />
        <Route path="workspace" element={<WorkspaceView />} />
        <Route path="pulse" element={<PulseView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <LangProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </LangProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
