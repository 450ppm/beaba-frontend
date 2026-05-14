import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceDot,
} from 'recharts';
import api from '../api';
import './ChaudierePage.css';

const KIND_LABEL = {
  boiler_out: 'Chaudiere',
  boiler_return: 'Retour chaudiere',
  dhw_tank: 'Chauffe-eau',
  radiator: 'Radiateur',
};
const KIND_ICON = {
  boiler_out: '🔥',
  boiler_return: '↩',
  dhw_tank: '🚿',
  radiator: '♨',
};

const PERIODS = [
  { id: '24h', label: '24h', hours: 24 },
  { id: '48h', label: '48h', hours: 48 },
  { id: '7j',  label: '7 jours', hours: 24 * 7 },
];

function formatShort(ts) {
  const d = new Date(ts);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function NoSensorState() {
  return (
    <div className="ch-empty">
      <div className="ch-empty-icon">🔥 🚿</div>
      <h3>Aucun capteur configure</h3>
      <p>
        Place une sonde DS18B20 (via Shelly Plus + Add-On) sur le tuyau de
        depart chaudiere et/ou sur la cuve du chauffe-eau, puis enregistre
        chaque capteur :
      </p>
      <pre className="ch-empty-code">
{`# Chaudiere — analyse cycles + correlation pieces
POST /api/pipe/sensors
{ "name": "Depart chaudiere", "kind": "boiler_out",
  "shelly_ip": "192.168.X.A", "shelly_channel": 100, "baseline_c": 30 }

# Chauffe-eau — pertes au repos + soutirages
POST /api/pipe/sensors
{ "name": "Ballon ECS", "kind": "dhw_tank",
  "shelly_ip": "192.168.X.B", "shelly_channel": 100, "baseline_c": 20 }`}
      </pre>
      <p className="ch-empty-hint">
        Fixation : collier + pate thermique + manchon isolant par-dessus.
        Releves toutes les 20 s (SHELLY_PIPE_POLL_S).
      </p>
    </div>
  );
}

export default function ChaudierePage({ onClose }) {
  const [sensors, setSensors] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [period, setPeriod] = useState('24h');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charge la liste des capteurs
  useEffect(() => {
    let alive = true;
    api.get('/api/pipe/sensors')
      .then((res) => {
        if (!alive) return;
        setSensors(res.data || []);
        if (res.data?.length && !selectedId) setSelectedId(res.data[0].id);
      })
      .catch((err) => { if (alive) setError(err.response?.data?.error || err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Analyse pour le capteur selectionne
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    const fetch = () => {
      const hours = PERIODS.find((p) => p.id === period)?.hours || 24;
      const to = new Date();
      const from = new Date(to.getTime() - hours * 3600000);
      api.get(`/api/pipe/analysis/${selectedId}`, {
        params: { from: from.toISOString(), to: to.toISOString() },
      })
        .then((res) => { if (alive) setAnalysis(res.data); })
        .catch((err) => { if (alive) setError(err.response?.data?.error || err.message); });
    };
    fetch();
    const id = setInterval(fetch, 30000);
    return () => { alive = false; clearInterval(id); };
  }, [selectedId, period]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prepare chart data : besoin de re-fetch readings? Non, l'analyse renvoie cycles
  // mais pas la serie brute. On la fetch en parallele.
  const [series, setSeries] = useState([]);
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    const hours = PERIODS.find((p) => p.id === period)?.hours || 24;
    const to = new Date();
    const from = new Date(to.getTime() - hours * 3600000);
    api.get(`/api/pipe/readings/${selectedId}`, {
      params: { from: from.toISOString(), to: to.toISOString() },
    })
      .then((res) => { if (alive) setSeries(res.data || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [selectedId, period]);

  const chartData = useMemo(() => series.map((r) => ({
    ts: new Date(r.ts).getTime(),
    label: formatTime(r.ts),
    t: r.temperature_c,
  })), [series]);

  const xDomain = chartData.length
    ? [chartData[0].ts, chartData[chartData.length - 1].ts]
    : ['auto', 'auto'];

  const sensor = sensors?.find((s) => s.id === selectedId);
  const a = analysis?.analysis;
  const cycles = analysis?.cycles || [];

  if (loading) {
    return (
      <div className="ch-overlay" role="dialog" aria-modal="true">
        <div className="ch-loading">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="ch-overlay" role="dialog" aria-modal="true">
      {/* Header */}
      <div className="ch-header">
        <div className="ch-brand">
          <img src="/beaba_banner.png" alt="Beaba" className="ch-logo" />
          <div className="ch-title">
            <h2>Chaudiere &amp; ECS</h2>
            <p className="ch-subtitle">
              {sensor?.kind === 'dhw_tank'
                ? 'Recharges, soutirages et pertes au repos du chauffe-eau.'
                : 'Detection de cycles, surchauffe et sous-dimensionnement de la chaudiere.'}
            </p>
          </div>
        </div>
        <button className="ch-close" onClick={onClose} aria-label="Fermer">×</button>
      </div>

      <div className="ch-body">
        {error && <div className="ch-error">Erreur : {error}</div>}

        {!sensors?.length ? (
          <NoSensorState />
        ) : (
          <>
            {/* Sensor + period selectors */}
            <div className="ch-controls">
              <div className="ch-sensors">
                {sensors.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`ch-sensor-btn ${selectedId === s.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(s.id)}
                    style={selectedId === s.id ? { borderColor: s.color, color: s.color } : null}
                  >
                    <span className="ch-sensor-kind">{KIND_ICON[s.kind] || '•'}</span>
                    <span className="ch-sensor-dot" style={{ background: s.color }} />
                    <span>{s.name}</span>
                    <span className="ch-sensor-badge">{KIND_LABEL[s.kind] || s.kind}</span>
                  </button>
                ))}
              </div>
              <div className="ch-periods">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`ch-period-btn ${period === p.id ? 'active' : ''}`}
                    onClick={() => setPeriod(p.id)}
                  >{p.label}</button>
                ))}
              </div>
            </div>

            {/* KPIs — adapte selon kind du capteur */}
            {a && sensor?.kind === 'dhw_tank' ? (
              <div className="ch-kpis">
                <Kpi label="Recharges" value={a.recharges_count ?? 0} unit="" />
                <Kpi label="Duree moyenne" value={a.avg_recharge_duration_min ?? '—'} unit="min" />
                <Kpi label="Pic moyen" value={a.avg_recharge_peak_c ?? '—'} unit="°C" />
                <Kpi
                  label="Soutirages"
                  value={a.soutirages_count ?? 0}
                  unit=""
                  accent={a.soutirages_count > 0 ? 'warn' : 'good'}
                />
                <Kpi
                  label="Pertes au repos"
                  value={a.resting_loss_c_per_h != null ? a.resting_loss_c_per_h.toFixed(2) : '—'}
                  unit="°C/h"
                  accent={a.resting_loss_c_per_h == null ? null : a.resting_loss_c_per_h > 1 ? 'bad' : a.resting_loss_c_per_h > 0.4 ? 'warn' : 'good'}
                />
                <Kpi label="Fenetre repos" value={a.resting_window_min ?? 0} unit="min" />
              </div>
            ) : a ? (
              <div className="ch-kpis">
                <Kpi label="Cycles detectes" value={a.cycles_count} unit="" />
                <Kpi label="Duree moyenne" value={a.avg_duration_min ?? '—'} unit="min" />
                <Kpi label="Frequence" value={a.cycles_per_hour ?? '—'} unit="/h" />
                <Kpi label="Pic moyen" value={a.avg_peak_c ?? '—'} unit="°C" />
                <Kpi
                  label="Sous-dimensionnement"
                  value={a.undersizing_score}
                  unit="/100"
                  accent={a.undersizing_score >= 70 ? 'bad' : a.undersizing_score >= 40 ? 'warn' : 'good'}
                />
                <Kpi
                  label="Surchauffes"
                  value={a.overheating_events}
                  unit=""
                  accent={a.overheating_events > 0 ? 'bad' : 'good'}
                />
              </div>
            ) : null}

            {/* Timeline chart */}
            <div className="ch-chart-wrap">
              {chartData.length === 0 ? (
                <div className="ch-chart-empty">
                  Pas encore de releves pour ce capteur sur la periode.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="ts"
                      type="number"
                      domain={xDomain}
                      tickFormatter={(t) => formatTime(t)}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      stroke="transparent"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      stroke="transparent"
                      axisLine={false}
                      tickLine={false}
                      unit="°C"
                      domain={['auto', 'auto']}
                      width={45}
                    />
                    <Tooltip
                      labelFormatter={(t) => formatShort(t)}
                      contentStyle={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
                      formatter={(v) => [v.toFixed(1) + ' °C', 'Depart']}
                    />
                    {cycles.map((c, i) => (
                      <ReferenceArea
                        key={i}
                        x1={new Date(c.start_ts).getTime()}
                        x2={new Date(c.end_ts).getTime()}
                        fill={sensor?.color || '#f59e0b'}
                        fillOpacity={0.12}
                        stroke="none"
                      />
                    ))}
                    {cycles.map((c, i) => (
                      <ReferenceDot
                        key={`p${i}`}
                        x={new Date(c.peak_ts).getTime()}
                        y={c.peak_c}
                        r={3}
                        fill={sensor?.color || '#f59e0b'}
                        stroke="#0d0d1a"
                        strokeWidth={1.5}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey="t"
                      stroke={sensor?.color || '#f59e0b'}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <p className="ch-chart-hint">
                Les bandes colorees representent les cycles detectes, les points marquent le pic de temperature.
              </p>
            </div>

            {/* Diagnosis */}
            {a?.diagnosis?.length > 0 && (
              <div className="ch-diagnosis">
                <h3>Diagnostic</h3>
                <ul>
                  {a.diagnosis.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}

            {/* Cycles list */}
            {cycles.length > 0 && (
              <div className="ch-cycles-list">
                <h3>Derniers cycles ({cycles.length})</h3>
                <div className="ch-cycles-table">
                  <div className="ch-cycle-row ch-cycle-head">
                    <span>Debut</span>
                    <span>Pic</span>
                    <span>ΔT</span>
                    <span>Duree montee</span>
                    <span>Duree totale</span>
                  </div>
                  {cycles.slice().reverse().slice(0, 20).map((c, i) => (
                    <div key={i} className="ch-cycle-row">
                      <span>{formatShort(c.start_ts)}</span>
                      <span>{c.peak_c}°C</span>
                      <span>+{c.delta_c}°C</span>
                      <span>{c.rise_duration_min} min</span>
                      <span>{c.total_duration_min} min</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, unit, accent }) {
  return (
    <div className={`ch-kpi ${accent ? `ch-kpi-${accent}` : ''}`}>
      <span className="ch-kpi-label">{label}</span>
      <div className="ch-kpi-value">
        <strong>{value}</strong>
        {unit && <span>{unit}</span>}
      </div>
    </div>
  );
}
