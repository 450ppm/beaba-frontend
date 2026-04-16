import { useCallback, useState } from 'react';
import api from '../api';
import { useCampaign } from '../context/CampaignContext';
import usePolling from '../hooks/usePolling';
import CampaignBanner from '../components/CampaignBanner';
import RoomCard from '../components/RoomCard';
import TempCard from '../components/TempCard';
import './Dashboard.css';

export default function Dashboard() {
  const { campaign, refreshCampaign } = useCampaign();
  const [completing, setCompleting] = useState(false);

  const { data: mapData, loading: mapLoading } = usePolling(
    useCallback(() => api.get('/api/map'), []),
    10000
  );

  const { data: tempData, loading: tempLoading } = usePolling(
    useCallback(() => api.get('/api/readings/temp'), []),
    30000
  );

  const { data: powerData } = usePolling(
    useCallback(() => api.get('/api/readings/power'), []),
    10000
  );

  const totalPower = powerData?.reduce((sum, r) => sum + (r.power_w || 0), 0) ?? 0;

  const completeCampaign = async () => {
    if (!campaign?.id) return;
    setCompleting(true);
    try {
      await api.post(`/api/campaign/${campaign.id}/complete`);
      await refreshCampaign();
    } catch { /* empty */ }
    setCompleting(false);
  };

  if (mapLoading && tempLoading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="dashboard">
      <CampaignBanner />

      <div className="dashboard-actions">
        <button
          className="btn-complete"
          onClick={completeCampaign}
          disabled={completing}
        >
          {completing ? 'Finalisation...' : 'Terminer la campagne'}
        </button>
      </div>

      <div className="dashboard-summary">
        <div className="summary-card total-power">
          <div className="summary-label">Puissance totale</div>
          <div className="summary-value">{totalPower.toFixed(0)} <small>W</small></div>
        </div>
        <div className="summary-card device-count">
          <div className="summary-label">Appareils actifs</div>
          <div className="summary-value">
            {powerData?.filter((r) => r.power_w > 1).length ?? 0}
            <small> / {powerData?.length ?? 0}</small>
          </div>
        </div>
      </div>

      <section>
        <h2>Temperatures</h2>
        <div className="temp-grid">
          {tempData?.map((s) => (
            <TempCard key={s.sensor_id} sensor={s} />
          ))}
          {(!tempData || tempData.length === 0) && (
            <p className="empty">En attente des capteurs...</p>
          )}
        </div>
      </section>

      <section>
        <h2>Pieces</h2>
        <div className="room-grid">
          {mapData?.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
          {(!mapData || mapData.length === 0) && (
            <p className="empty">Aucune piece configuree.</p>
          )}
        </div>
      </section>
    </div>
  );
}
