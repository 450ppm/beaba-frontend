import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import api from '../api';
import { useCampaign } from '../context/CampaignContext';
import usePolling from '../hooks/usePolling';
import CampaignBanner from '../components/CampaignBanner';
import DashboardCharts from '../components/DashboardCharts';
import KpiCard from '../components/KpiCard';
import ApplianceList from '../components/ApplianceList';
import SensorList from '../components/SensorList';
import RoomCard from '../components/RoomCard';
import CartoView from '../components/CartoView';
import './Dashboard.css';

export default function Dashboard({ onRequestEndMeters }) {
  const { campaign } = useCampaign();
  const [showCarto, setShowCarto] = useState(false);

  /* ── API polling ─────────────────────────────────────── */
  const { data: mapData, loading: mapLoading } = usePolling(
    useCallback(() => api.get('/api/map'), []),
    10000
  );

  const { data: tempData, loading: tempLoading } = usePolling(
    useCallback(() => api.get('/api/readings/temp'), []),
    30000
  );

  const { data: co2Data } = usePolling(
    useCallback(() => api.get('/api/readings/co2'), []),
    30000
  );

  const { data: powerData } = usePolling(
    useCallback(() => api.get('/api/readings/power'), []),
    10000
  );

  // Vraie consommation du jour : somme integree sur la plage 00:00 -> maintenant
  // calculee cote API a partir des deltas energy_kwh (fallback integration des
  // power_w), pas une extrapolation de la puissance instantanee.
  const { data: dailyPowerData } = usePolling(
    useCallback(() => {
      const today = new Date().toISOString().slice(0, 10);
      return api.get('/api/readings/power/daily', { params: { from: today, to: today } });
    }, []),
    60000
  );

  /* ── KPI computations ────────────────────────────────── */
  const totalPower = powerData?.reduce((sum, r) => sum + (r.power_w || 0), 0) ?? 0;
  const activeDevices = powerData?.filter((r) => (r.power_w || 0) > 1).length ?? 0;
  const totalDevices = powerData?.length ?? 0;

  const avgTemp = useMemo(() => {
    if (!tempData || !tempData.length) return null;
    const temps = tempData.filter((s) => s.temperature_c != null).map((s) => s.temperature_c);
    if (!temps.length) return null;
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    return { avg, min, max };
  }, [tempData]);

  // Track last 12 total-power readings for sparkline
  const powerHistoryRef = useRef([]);
  useEffect(() => {
    if (totalPower > 0) {
      powerHistoryRef.current = [...powerHistoryRef.current.slice(-11), totalPower];
    }
  }, [totalPower]);

  /* ── Consommation du jour : cumul reel depuis 00:00 ── */
  const dailyKwh = useMemo(() => {
    if (!dailyPowerData || !dailyPowerData.length) return '0.00';
    // L'API renvoie 0 ou 1 entree pour aujourd'hui (filtre from=to=today).
    const today = new Date().toISOString().slice(0, 10);
    const entry = dailyPowerData.find((d) => d.date === today) || dailyPowerData[0];
    return (entry?.total_kwh ?? 0).toFixed(2);
  }, [dailyPowerData]);

  /* ── Loading state ───────────────────────────────────── */
  if (mapLoading && tempLoading) {
    return (
      <div className="db-loading">
        <div className="db-loading-spinner" />
        <span>Chargement du tableau de bord...</span>
      </div>
    );
  }

  return (
    <div className="db">
      {/* ── Top strip ────────────────────────────────── */}
      <div className="db-top-row">
        <div className="db-top-banner">
          <CampaignBanner onRequestEndMeters={onRequestEndMeters} />
        </div>
        <button
          type="button"
          className="db-carto-btn"
          onClick={() => setShowCarto(true)}
          aria-label="Voir la carte du logement"
          title="Voir la carte du logement"
        >
          <span className="db-carto-icon">🗺️</span>
          <span className="db-carto-label">Carte du logement</span>
        </button>
      </div>

      {/* ── KPI row ──────────────────────────────────── */}
      <div className="db-kpi-row">
        <KpiCard
          label="Puissance instantanee"
          value={totalPower.toFixed(0)}
          unit="W"
          accent="orange"
          sparklineData={powerHistoryRef.current}
        />
        <KpiCard
          label="Consommation du jour"
          value={dailyKwh}
          unit="kWh"
          accent="orange"
          subtitle="Cumul depuis minuit"
        />
        <KpiCard
          label="Appareils actifs"
          value={activeDevices}
          unit={`/ ${totalDevices}`}
          accent="green"
        >
          {activeDevices > 0 && (
            <div className="kpi-active-dots">
              {Array.from({ length: Math.min(activeDevices, 5) }).map((_, i) => (
                <span key={i} className="kpi-active-dot" />
              ))}
            </div>
          )}
        </KpiCard>
        <KpiCard
          label="Temperature moyenne"
          value={avgTemp ? avgTemp.avg.toFixed(1) : '--'}
          unit="°C"
          accent="blue"
          subtitle={
            avgTemp
              ? `Min ${avgTemp.min.toFixed(1)}° / Max ${avgTemp.max.toFixed(1)}°`
              : 'En attente des capteurs'
          }
        />
      </div>

      {/* ── Main content: chart + panels ──────────────── */}
      <div className="db-main">
        <div className="db-main-left">
          <DashboardCharts />
        </div>
        <div className="db-main-right">
          <ApplianceList powerData={powerData} />
          <SensorList tempData={tempData} co2Data={co2Data} />
        </div>
      </div>

      {/* ── Bottom strip: room overview ───────────────── */}
      <div className="db-bottom">
        <h3 className="db-section-title">Pieces</h3>
        {mapData && mapData.length > 0 ? (
          <div className="room-scroll">
            {mapData.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        ) : (
          <p className="db-empty">Aucune piece configuree.</p>
        )}
      </div>

      {/* ── End campaign button ──────────────────────── */}
      {onRequestEndMeters && (
        <div className="db-end-campaign">
          <button className="db-end-btn" onClick={onRequestEndMeters}>
            Terminer la campagne
          </button>
        </div>
      )}

      {/* ── Fullscreen carto overlay ─────────────────── */}
      {showCarto && <CartoView onClose={() => setShowCarto(false)} />}
    </div>
  );
}
