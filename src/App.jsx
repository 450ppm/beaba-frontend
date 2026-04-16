import { CampaignProvider, useCampaign } from './context/CampaignContext';
import Header from './components/Header';
import NewCampaignPage from './pages/NewCampaignPage';
import SetupWizard from './pages/SetupWizard';
import Dashboard from './pages/Dashboard';
import ReportPage from './pages/ReportPage';

function AppContent() {
  const { campaign, loading, noCampaign } = useCampaign();

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

  // Default: active campaign
  return (
    <>
      <Header />
      <Dashboard />
    </>
  );
}

function App() {
  return (
    <CampaignProvider>
      <AppContent />
    </CampaignProvider>
  );
}

export default App;
