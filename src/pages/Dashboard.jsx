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
import DateNav, { viewWindow, isLiveView } from '../components/DateNav';
import { weatherIcon, weatherLabel } from '../lib/weatherCodes';
import './Dashboard.css';

function isoDate(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

const PERIOD_LABEL = {
  day: 'du jour',
  week: 'de la semaine',
  month: 'du mois',
};

export default function Dashboard({ onRequestEndMeters }) {
  const { campaign } = useCampaign();
  const [showCarto, setShowCarto] = useState(false);
  const [showComfort, setShowComfort] = useState(false);

  /* ── Vue temporelle (date + periode) ─────────────────── */
  const [view, setView] = useState({ date: new Date(), period: 'day' });
  const window = useMemo(() => viewWindow(view), [view]);
  const isLive = useMemo(() => isLiveView(view), [view]);
  const fromISO = useMemo(() => isoDate(window.from), [window]);
  const toISO = useMemo(() => isoDate(window.to), [window]);

  /* ── API polling LIVE (uniquement quand vue inclut aujourd'hui) ── */
  const { data: mapData, loading: mapLoading } = usePolling(
    useCallback(() => api.get('/api/map'), []),
    isLive ? 10000 : 24 * 3600 * 1000
  );

  const { data: tempData, loading: tempLoading } = usePolling(
    useCallback(() => api.get('/api/readings/temp'), []),
    isLive ? 30000 : 24 * 3600 * 1000
  );

  const { data: co2Data } = usePolling(
    useCallback(() => api.get('/api/readings/co2'), []),
    isLive ? 30000 : 24 * 3600 * 1000
  );

  const { data: powerData } = usePolling(
    useCallback(() => api.get('/api/readings/power'), []),
    isLive ? 10000 : 24 * 3600 * 1000
  );

  // Meteo exterieure courante (live uniquement)
  const { data: weatherData } = usePolling(
    useCallback(() => api.get('/api/weather/current'), []),
    15 * 60 * 1000
  );

  /* ── Donnees historiques : agregat de la fenetre ────── */
  const { data: powerWindow } = usePolling(
    useCallback(
      () => api.get('/api/readings/power/daily', { params: { from: fromISO, to: toISO } }),
      [fromISO, toISO]
    ),
    isLive ? 60000 : 5 * 60 * 1000
  );

  const { data: tempWindow } = usePolling(
    useCallback(
      () => api.get('/api/readings/temp/history', {
        params: { from: fromISO, to: toISO + 'T23:59:59', interval: 'day' },
      }),
      [fromISO, toISO]
    ),
    isLive ? 5 * 60 * 1000 : 10 * 60 * 1000
  );

  const { data: weatherWindow } = usePolling(
    useCallback(() => {
      // Open-Meteo archive a ~2 jours de latence : on tronque `to` a hier max.
      const today = new Date();
      const yesterday = new Date(today.getTime() - 86400000);
      const safeTo = isoDate(window.to) > isoDate(yesterday) ? isoDate(yesterday) : isoDate(window.to);
      const safeFrom = isoDate(window.from) > safeTo ? safeTo : isoDate(window.from);
      return api.get('/api/weather/history', {
        params: { from: safeFrom, to: safeTo, interval: 'daily' },
      });
    }, [window]),
    isLive ? 30 * 60 * 1000 : 60 * 60 * 1000
  );

  /* ── KPI computations ────────────────────────────────── */
  const totalPower = powerData?.reduce((sum, r) => sum + (r.power_w || 0), 0) ?? 0;
  const activeDevices = powerData?.filter((r) => (r.power_w || 0) > 1).length ?? 0;
  const totalDevices = powerData?.length ?? 0;

  // Temperature agregee sur la fenetre — utilise tempWindow (daily) si possible
  const avgTemp = useMemo(() => {
    if (isLive && view.period === 'day') {
      // Vue temps reel du jour : on prend la derniere mesure par capteur
      if (!tempData || !tempData.length) return null;
      const temps = tempData.filter((s) => s.temperature_c != null).map((s) => s.temperature_c);
      if (!temps.length) return null;
      return {
        avg: temps.reduce((a, b) => a + b, 0) / temps.length,
        min: Math.min(...temps),
        max: Math.max(...temps),
      };
    }
    if (!tempWindow || !tempWindow.length) return null;
    const temps = tempWindow.filter((r) => r.temperature_c != null).map((r) => r.temperature_c);
    if (!temps.length) return null;
    return {
      avg: temps.reduce((a, b) => a + b, 0) / temps.length,
      min: Math.min(...temps),
      max: Math.max(...temps),
    };
  }, [isLive, view.period, tempData, tempWindow]);

  // Sparkline (live uniquement)
  const powerHistoryRef = useRef([]);
  useEffect(() => {
    if (isLive && totalPower > 0) {
      powerHistoryRef.current = [...powerHistoryRef.current.slice(-11), totalPower];
    }
  }, [totalPower, isLive]);

  // Consommation de la fenetre : somme des kWh quotidiens
  const windowKwh = useMemo(() => {
    if (!powerWindow || !powerWindow.length) return '0.00';
    const total = powerWindow.reduce((s, d) => s + (d.total_kwh || 0), 0);
    return total.toFixed(2);
  }, [powerWindow]);

  // Meteo agregee de la fenetre (si pas live)
  const windowWeather = useMemo(() => {
    if (!weatherWindow?.series?.time?.length) return null;
    const s = weatherWindow.series;
    const tMean = s.temperature_2m_mean || [];
    const hum = s.relative_humidity_2m_mean || [];
    const wind = s.wind_speed_10m_max || [];
    const valid = tMean.filter((v) => v != null);
    if (!valid.length) return null;
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    const validH = hum.filter((v) => v != null);
    const validW = wind.filter((v) => v != null);
    return {
      avgT: avg,
      avgH: validH.length ? validH.reduce((a, b) => a + b, 0) / validH.length : null,
      maxW: validW.length ? Math.max(...validW) : null,
    };
  }, [weatherWindow]);

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

      {/* ── Date / periode navigator ──────────────────── */}
      <DateNav view={view} onChange={setView} />

      {/* ── KPI row ──────────────────────────────────── */}
      <div className="db-kpi-row">
        <KpiCard
          label={isLive && view.period === 'day' ? 'Puissance instantanee' : 'Puissance — temps reel'}
          value={isLive && view.period === 'day' ? totalPower.toFixed(0) : '—'}
          unit={isLive && view.period === 'day' ? 'W' : ''}
          accent="orange"
          sparklineData={isLive && view.period === 'day' ? powerHistoryRef.current : null}
          subtitle={isLive && view.period === 'day' ? null : 'Disponible uniquement en direct'}
        />
        <KpiCard
          label={`Consommation ${PERIOD_LABEL[view.period]}`}
          value={windowKwh}
          unit="kWh"
          accent="orange"
          subtitle={
            view.period === 'day'
              ? (isLive ? 'Cumul depuis minuit' : `Total du ${new Date(fromISO).toLocaleDateString('fr-FR')}`)
              : `${powerWindow?.length || 0} jour${(powerWindow?.length || 0) > 1 ? 's' : ''} de releves`
          }
        />
        <KpiCard
          label={isLive && view.period === 'day' ? 'Appareils actifs' : 'Appareils suivis'}
          value={isLive && view.period === 'day' ? activeDevices : totalDevices}
          unit={isLive && view.period === 'day' ? `/ ${totalDevices}` : ''}
          accent="green"
          subtitle={isLive && view.period === 'day' ? null : 'Mesure instantanee non historisee'}
        >
          {isLive && view.period === 'day' && activeDevices > 0 && (
            <div className="kpi-active-dots">
              {Array.from({ length: Math.min(activeDevices, 5) }).map((_, i) => (
                <span key={i} className="kpi-active-dot" />
              ))}
            </div>
          )}
        </KpiCard>
        <KpiCard
          label={`Temperature moyenne ${view.period === 'day' ? '' : PERIOD_LABEL[view.period]}`.trim()}
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
          label={isLive && view.period === 'day' ? 'Meteo exterieure' : 'Meteo — moyenne'}
          value={
            isLive && view.period === 'day'
              ? (weatherData?.temperature_c != null ? weatherData.temperature_c.toFixed(1) : '--')
              : (windowWeather ? windowWeather.avgT.toFixed(1) : '--')
          }
          unit="°C"
          accent="cyan"
          subtitle={
            isLive && view.period === 'day'
              ? (weatherData
                  ? `${weatherIcon(weatherData.weather_code)} ${weatherLabel(weatherData.weather_code)} · ${weatherData.humidity_pct?.toFixed(0) ?? '--'}% HR · ${weatherData.wind_speed_m_s?.toFixed(0) ?? '--'} m/s`
                  : 'Open-Meteo en cours...')
              : (windowWeather
                  ? `HR moyenne ${windowWeather.avgH != null ? windowWeather.avgH.toFixed(0) : '--'}% · vent max ${windowWeather.maxW != null ? windowWeather.maxW.toFixed(0) : '--'} m/s`
                  : 'Archive Open-Meteo (latence ~2j)')
          }
        />
      </div>

      {/* ── Bento : graph + appareils / pieces + capteurs ── */}
      <div className="db-bento">
        <section className="db-tile db-tile-chart">
          <DashboardCharts view={view} />
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
