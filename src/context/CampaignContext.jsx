import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api';

const CampaignContext = createContext(null);

export function CampaignProvider({ children }) {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noCampaign, setNoCampaign] = useState(false);

  const refreshCampaign = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/campaign');
      setCampaign(res.data);
      setNoCampaign(false);
    } catch (err) {
      if (err.response?.status === 404) {
        setCampaign(null);
        setNoCampaign(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCampaign();
  }, [refreshCampaign]);

  return (
    <CampaignContext.Provider value={{ campaign, loading, noCampaign, refreshCampaign }}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error('useCampaign must be used within CampaignProvider');
  return ctx;
}

export default CampaignContext;
