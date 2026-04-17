import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, CartesianGrid, Legend,
} from 'recharts';
import { useCampaign } from '../context/CampaignContext';
import api from '../api';
import './ReportPage.css';

const TABS = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'electricity', label: 'Electricite' },
  { id: 'comfort', label: 'Confort' },
  { id: 'recommendations', label: 'Recommandations' },
];

export default function ReportPage() {
  const { campaign } = useCampaign();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!campaign?.id) return;
    setLoading(true);
    api.get(`/api/report/${campaign.id}`)
      .then(res => { setReport(res.data); setError(null); })
      .catch(() => setError('Impossible de charger le rapport'))
      .finally(() => setLoading(false));
  }, [campaign?.id]);

  const handleExportCsv = () => {
    if (!campaign?.id) return;
    window.open(`${api.defaults.baseURL}/api/export/${campaign.id}/csv`, '_blank');
  };

  const handleOpenPrint = () => {
    window.open('/app/report/print', '_blank');
  };

  const avgOutsideComfort = useMemo(() => {
    if (!report?.comfort?.length) return 0;
    const vals = report.comfort.map(r => Math.max(r.pct_temp_outside || 0, r.pct_humidity_outside || 0));
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [report]);

  if (loading) return <div className="loading">Chargement du rapport...</div>;
  if (error || !report) {
    return <div className="rp-web"><div className="rp-error">{error || 'Rapport indisponible'}</div></div>;
  }

  const { energy, top_consumers, standby, comfort, recommendations, meters } = report;
  const cam = report.campaign;

  return (
    <div className="rp-web">
      {/* Sticky top bar */}
      <div className="rp-topbar">
        <div className="rp-topbar-inner">
          <div className="rp-topbar-title">
            <div className="rp-topbar-household">{cam.household}</div>
            <div className="rp-topbar-dates">
              {formatDate(cam.start_date)} — {formatDate(cam.end_date)} · {cam.duration_days} jours
            </div>
          </div>
          <div className="rp-topbar-actions">
            <button className="rp-btn rp-btn-ghost" onClick={handleExportCsv}>Exporter CSV</button>
            <button className="rp-btn rp-btn-primary" onClick={handleOpenPrint}>Telecharger PDF</button>
          </div>
        </div>
        <div className="rp-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`rp-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rp-content">
        {tab === 'overview' && (
          <OverviewTab energy={energy} meters={meters} top_consumers={top_consumers} avgOutside={avgOutsideComfort} />
        )}
        {tab === 'electricity' && (
          <ElectricityTab energy={energy} top_consumers={top_consumers} standby={standby} />
        )}
        {tab === 'comfort' && (
          <ComfortTab comfort={comfort} />
        )}
        {tab === 'recommendations' && (
          <RecommendationsTab recommendations={recommendations} />
        )}
      </div>
    </div>
  );
}

/* ─── Tabs ───────────────────────────────────────────────── */

function OverviewTab({ energy, meters, top_consumers, avgOutside }) {
  return (
    <div className="rp-tab-content">
      <div className="rp-kpi-grid">
        <KPI label="kWh total" value={energy.total_kwh} unit="kWh" color="#fbbf24" />
        <KPI label="Cout total" value={energy.estimated_cost.toFixed(0)} unit="EUR" color="#f59e0b" />
        <KPI label="Moyenne" value={energy.daily_avg_kwh} unit="kWh / jour" color="#60a5fa" />
        <KPI label="Hors confort" value={avgOutside} unit="% du temps" color="#a78bfa" />
      </div>

      {energy.daily_series.length > 0 && (
        <div className="rp-card">
          <div className="rp-card-head">
            <h3>Consommation journaliere</h3>
            <span className="rp-card-sub">Evolution sur {energy.daily_series.length} jours</span>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={energy.daily_series} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="ovArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2a2a3a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                <Tooltip contentStyle={darkTooltip} />
                <Area dataKey="kwh" stroke="#fbbf24" fill="url(#ovArea)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {meters?.readings?.length > 0 && (
        <div className="rp-card">
          <div className="rp-card-head">
            <h3>Releves compteurs</h3>
            <span className="rp-card-sub">Total estime : <strong>{meters.total_estimated_cost.toFixed(2)} EUR</strong></span>
          </div>
          <table className="rp-table">
            <thead>
              <tr>
                <th>Compteur</th><th>Debut</th><th>Fin</th><th>Consommation</th><th>Cout</th>
              </tr>
            </thead>
            <tbody>
              {meters.readings.map(m => (
                <tr key={m.meter_type}>
                  <td><span className={`rp-chip rp-chip-${m.meter_type}`}>{meterLabel(m.meter_type)}</span></td>
                  <td>{m.start_value} {m.unit}</td>
                  <td>{m.end_value} {m.unit}</td>
                  <td>{m.consumption} {m.unit}{m.meter_type === 'gas' && m.consumption_kwh != null && ` (${m.consumption_kwh} kWh)`}</td>
                  <td className="rp-num-accent">{m.estimated_cost.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {top_consumers.length > 0 && (
        <div className="rp-card">
          <div className="rp-card-head">
            <h3>Top 3 consommateurs</h3>
          </div>
          <div className="rp-top3">
            {top_consumers.slice(0, 3).map((c, i) => (
              <div key={c.plug_id} className="rp-top3-item">
                <div className="rp-top3-rank">#{i + 1}</div>
                <div className="rp-top3-body">
                  <div className="rp-top3-name">{c.appliance_name}</div>
                  <div className="rp-top3-room">{c.room_name}</div>
                </div>
                <div className="rp-top3-val">
                  <div>{c.total_kwh} <span>kWh</span></div>
                  <div className="rp-top3-pct">{c.percentage.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ElectricityTab({ energy, top_consumers, standby }) {
  const standbyTotal = standby.reduce((s, r) => s + r.estimated_annual_cost, 0);
  return (
    <div className="rp-tab-content">
      {top_consumers.length > 0 && (
        <div className="rp-card">
          <div className="rp-card-head">
            <h3>Top consommateurs</h3>
            <span className="rp-card-sub">Classement par kWh mesures sur la campagne</span>
          </div>
          <div style={{ height: Math.max(240, top_consumers.length * 40) }}>
            <ResponsiveContainer>
              <BarChart data={top_consumers} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 16 }}>
                <CartesianGrid stroke="#2a2a3a" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#888', fontSize: 11 }} unit=" kWh" />
                <YAxis type="category" dataKey="appliance_name" width={140} tick={{ fill: '#ccc', fontSize: 12 }} />
                <Tooltip contentStyle={darkTooltip} formatter={(v) => [`${v} kWh`, 'Consommation']} />
                <Bar dataKey="total_kwh" fill="#fbbf24" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {energy.daily_series.length > 0 && (
        <div className="rp-card">
          <div className="rp-card-head">
            <h3>Consommation journaliere</h3>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={energy.daily_series} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="elArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2a2a3a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fill: '#888', fontSize: 11 }} unit=" kWh" />
                <Tooltip contentStyle={darkTooltip} />
                <Area dataKey="kwh" stroke="#60a5fa" fill="url(#elArea)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rp-card">
        <div className="rp-card-head">
          <h3>Consommation en veille</h3>
          <span className="rp-card-sub">Mesuree entre 0h et 6h</span>
        </div>
        {standby.length === 0 ? (
          <div className="rp-empty-ok">Aucune consommation en veille significative detectee.</div>
        ) : (
          <>
            <table className="rp-table">
              <thead>
                <tr><th>Appareil</th><th>Puissance moyenne</th><th>kWh / an</th><th>Cout annuel</th></tr>
              </thead>
              <tbody>
                {standby.map(s => (
                  <tr key={s.plug_id}>
                    <td>{s.appliance_name}</td>
                    <td>{s.avg_power_w} W</td>
                    <td>{s.estimated_annual_kwh} kWh</td>
                    <td className="rp-num-danger">{s.estimated_annual_cost.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="rp-total-line">
              Total annuel perdu en veille : <strong>{standbyTotal.toFixed(2)} €</strong>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ComfortTab({ comfort }) {
  if (!comfort?.length) {
    return <div className="rp-tab-content"><div className="rp-empty">Pas de donnees de confort.</div></div>;
  }
  return (
    <div className="rp-tab-content">
      <div className="rp-comfort-grid">
        {comfort.map(room => (
          <div
            key={room.room_id}
            className={`rp-card rp-comfort-card rp-status-${room.status}`}
            style={{ '--room-color': room.color || '#60a5fa' }}
          >
            <div className="rp-comfort-head">
              <div>
                <h3>{room.room_name}</h3>
                <div className="rp-comfort-status" data-status={room.status}>
                  {room.status === 'good' ? 'Confort' : room.status === 'warning' ? 'Moyen' : 'A ameliorer'}
                </div>
              </div>
              <div className="rp-comfort-dot" />
            </div>
            <div className="rp-comfort-metrics">
              {room.avg_temp != null && (
                <div className="rp-comfort-metric">
                  <div className="rp-comfort-val">{room.avg_temp}°</div>
                  <div className="rp-comfort-lbl">Temp. moy.</div>
                  <div className="rp-comfort-range">{room.min_temp}° — {room.max_temp}°</div>
                </div>
              )}
              {room.avg_humidity != null && (
                <div className="rp-comfort-metric">
                  <div className="rp-comfort-val">{room.avg_humidity}%</div>
                  <div className="rp-comfort-lbl">Humidite moy.</div>
                </div>
              )}
            </div>
            <div className="rp-comfort-pct">
              {Math.max(room.pct_temp_outside, room.pct_humidity_outside)}% du temps hors zone de confort
            </div>
            {room.daily_temp_series?.length > 1 && (
              <div style={{ height: 140, marginTop: 8 }}>
                <ResponsiveContainer>
                  <LineChart data={room.daily_temp_series} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                    <CartesianGrid stroke="#2a2a3a" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: '#888', fontSize: 10 }} />
                    <Tooltip contentStyle={darkTooltip} formatter={(v) => [`${v} °C`, 'Temp.']} />
                    <Line dataKey="avg_temp" stroke={room.color || '#60a5fa'} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationsTab({ recommendations }) {
  if (!recommendations?.length) {
    return <div className="rp-tab-content"><div className="rp-empty">Aucune recommandation.</div></div>;
  }
  return (
    <div className="rp-tab-content">
      <div className="rp-reco-list">
        {recommendations.map((tip, i) => (
          <div className="rp-reco" key={i}>
            <div className="rp-reco-num">{i + 1}</div>
            <div className="rp-reco-body">
              <div className="rp-reco-icon">💡</div>
              <p>{tip}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────── */

function KPI({ label, value, unit, color }) {
  return (
    <div className="rp-kpi" style={{ '--kpi-color': color }}>
      <div className="rp-kpi-label">{label}</div>
      <div className="rp-kpi-value">{value}</div>
      <div className="rp-kpi-unit">{unit}</div>
    </div>
  );
}

const darkTooltip = {
  background: '#16162a',
  border: '1px solid #2a2a3a',
  borderRadius: 8,
  color: '#eee',
  fontSize: 12,
};

function meterLabel(t) {
  return { electricity: 'Electricite', gas: 'Gaz', water: 'Eau' }[t] || t;
}

function formatDate(s) {
  if (!s) return '...';
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
