import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CampaignProvider, useCampaign } from './context/CampaignContext';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import NewCampaignPage from './pages/NewCampaignPage';
import SetupWizard from './pages/SetupWizard';
import Dashboard from './pages/Dashboard';
import ReportPage from './pages/ReportPage';
import MeterReadingsPage from './pages/MeterReadingsPage';
import api from './api';

function ProtectedRoute({ children }) {
  const { authenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  return children;
}

function AppContent() {
  const { campaign, loading, noCampaign, refreshCampaign } = useCampaign();
  const [meterStatus, setMeterStatus] = useState(null);
  const [meterLoading, setMeterLoading] = useState(false);
  const [showEndMeters, setShowEndMeters] = useState(false);

  const fetchMeterStatus = useCallback(() => {
    if (campaign?.status !== 'active') return;
    setMeterLoading(true);
    api.get('/api/meters/status')
      .then(res => setMeterStatus(res.data))
      .catch(() => setMeterStatus(null))
      .finally(() => setMeterLoading(false));
  }, [campaign?.status]);

  useEffect(() => {
    fetchMeterStatus();
  }, [fetchMeterStatus]);

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (noCampaign) {
    return <NewCampaignPage />;
  }

  if (campaign?.status === 'setup') {
    return (
      <>
        <Header />
        <SetupWizard />
      </>
    );
  }

  if (campaign?.status === 'completed') {
    return (
      <>
        <Header />
        <ReportPage />
      </>
    );
  }

  // Active campaign
  if (meterLoading) {
    return <div className="loading">Chargement...</div>;
  }

  const startComplete = meterStatus &&
    meterStatus.electricity_start &&
    meterStatus.gas_start &&
    meterStatus.water_start;

  if (!startComplete) {
    return (
      <>
        <Header />
        <MeterReadingsPage
          phase="start"
          onComplete={() => fetchMeterStatus()}
        />
      </>
    );
  }

  if (showEndMeters) {
    return (
      <>
        <Header />
        <MeterReadingsPage
          phase="end"
          onComplete={async () => {
            try {
              await api.post(`/api/campaign/${campaign.id}/complete`);
              setShowEndMeters(false);
              await refreshCampaign();
            } catch (err) {
              alert(err.response?.data?.error || 'Erreur lors de la finalisation');
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <Header />
      <Dashboard onRequestEndMeters={() => setShowEndMeters(true)} />
    </>
  );
}

function ProtectedApp() {
  return (
    <CampaignProvider>
      <AppContent />
    </CampaignProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app/admin"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <ProtectedApp />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
