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
import ComfortPage from './ComfortPage';
import { weatherIcon, weatherLabel } from '../lib/weatherCodes';
import './Dashboard.css';

export default function Dashboard({ onRequestEndMeters }) {
  const { campaign } = useCampaign();
  const [showCarto, setShowCarto] = useState(false);
  const [showComfort, setShowComfort] = useState(false);

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

  // Meteo exterieure courante (Open-Meteo, cache 1h cote API).
  const { data: weatherData } = usePolling(
    useCallback(() => api.get('/api/weather/current'), []),
    15 * 60 * 1000
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
      {/* Ambient background — radial glows, decorative only */}
      <div className="db-bg" aria-hidden="true">
        <div className="db-bg-glow db-bg-glow-1" />
        <div className="db-bg-glow db-bg-glow-2" />
      </div>

      {/* ── Hero strip ────────────────────────────────── */}
      <header className="db-hero">
        <div className="db-hero-banner">
          <CampaignBanner onRequestEndMeters={onRequestEndMeters} />
        </div>
        <div className="db-hero-actions">
          <button
            type="button"
            className="db-action-btn db-action-carto"
            onClick={() => setShowCarto(true)}
            aria-label="Voir la carte du logement"
          >
            <span className="db-action-icon">🗺️</span>
            <span className="db-action-label">Carte du logement</span>
          </button>
          <button
            type="button"
            className="db-action-btn db-action-comfort"
            onClick={() => setShowComfort(true)}
            aria-label="Confort et condensation"
          >
            <span className="db-action-icon">🌡️</span>
            <span className="db-action-label">Confort &amp; condensation</span>
          </button>
        </div>
      </header>

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
        <KpiCard
          label="Meteo exterieure"
          value={weatherData?.temperature_c != null ? weatherData.temperature_c.toFixed(1) : '--'}
          unit="°C"
          accent="cyan"
          subtitle={
            weatherData
              ? `${weatherIcon(weatherData.weather_code)} ${weatherLabel(weatherData.weather_code)} · ${weatherData.humidity_pct != null ? weatherData.humidity_pct.toFixed(0) + '%' : '--'} HR · ${weatherData.wind_speed_m_s != null ? weatherData.wind_speed_m_s.toFixed(0) + ' m/s' : '--'}`
              : 'Open-Meteo en cours...'
          }
        />
      </div>

      {/* ── Bento : graph + appareils / pieces + capteurs ── */}
      <div className="db-bento">
        <section className="db-tile db-tile-chart">
          <DashboardCharts />
        </section>
        <section className="db-tile db-tile-appliances">
          <ApplianceList powerData={powerData} />
        </section>
        <section className="db-tile db-tile-rooms">
          <header className="db-tile-head">
            <h3 className="db-tile-title">Pieces</h3>
            <span className="db-tile-sub">{mapData?.length || 0} configurees</span>
          </header>
          {mapData && mapData.length > 0 ? (
            <div className="room-grid">
              {mapData.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          ) : (
            <p className="db-empty">Aucune piece configuree.</p>
          )}
        </section>
        <section className="db-tile db-tile-sensors">
          <SensorList tempData={tempData} co2Data={co2Data} />
        </section>
      </div>

      {/* ── End campaign button ──────────────────────── */}
      {onRequestEndMeters && (
        <div className="db-end-campaign">
          <button className="db-end-btn" onClick={onRequestEndMeters}>
            Terminer la campagne
          </button>
        </div>
      )}

      {/* ── Fullscreen overlays ──────────────────────── */}
      {showCarto && <CartoView onClose={() => setShowCarto(false)} />}
      {showComfort && <ComfortPage onClose={() => setShowComfort(false)} />}
    </div>
  );
}
