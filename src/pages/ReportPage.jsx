import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, CartesianGrid,
} from 'recharts';
import { useCampaign } from '../context/CampaignContext';
import api from '../api';
import './ReportPage.css';

export default function ReportPage() {
  const { campaign } = useCampaign();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    const url = `${api.defaults.baseURL}/api/export/${campaign.id}/csv`;
    window.open(url, '_blank');
  };

  const handlePrint = () => window.print();

  if (loading) {
    return <div className="loading">Chargement du rapport...</div>;
  }

  if (error || !report) {
    return (
      <div className="report-page">
        <div className="report-error">{error || 'Rapport indisponible'}</div>
      </div>
    );
  }

  const { energy, top_consumers, standby, comfort, recommendations } = report;
  const cam = report.campaign;

  // Top 3 percentage
  const top3Pct = top_consumers.slice(0, 3).reduce((s, c) => s + c.percentage, 0);

  return (
    <div className="report-page">

      {/* Actions */}
      <div className="report-actions no-print">
        <button className="btn-export" onClick={handleExportCsv}>
          Exporter les donnees (CSV)
        </button>
        <button className="btn-print" onClick={handlePrint}>
          Imprimer le rapport
        </button>
      </div>

      {/* Section 1 — Resume */}
      <section className="report-section">
        <h2>Resume de la campagne</h2>
        <div className="report-summary-grid">
          <div className="report-card summary-info">
            <p className="summary-household">{cam.household}</p>
            {cam.address && <p className="summary-address">{cam.address}</p>}
            <p className="summary-dates">
              Du {formatDate(cam.start_date)} au {formatDate(cam.end_date)}
            </p>
            <p className="summary-duration">{cam.duration_days} jours de mesure</p>
          </div>
          <div className="report-card summary-energy">
            <div className="summary-stat">
              <span className="stat-value">{energy.total_kwh}</span>
              <span className="stat-unit">kWh</span>
              <span className="stat-label">consommes au total</span>
            </div>
            <div className="summary-stat">
              <span className="stat-value">{energy.estimated_cost.toFixed(2)}</span>
              <span className="stat-unit">EUR</span>
              <span className="stat-label">cout estime</span>
            </div>
            <div className="summary-stat">
              <span className="stat-value">{energy.daily_avg_kwh}</span>
              <span className="stat-unit">kWh/jour</span>
              <span className="stat-label">moyenne quotidienne</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 — Top consommateurs */}
      {top_consumers.length > 0 && (
        <section className="report-section">
          <h2>Top consommateurs</h2>
          <div className="report-card">
            <div className="chart-container" style={{ height: Math.max(200, top_consumers.length * 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top_consumers} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tick={{ fill: '#888' }} unit=" kWh" />
                  <YAxis type="category" dataKey="appliance_name" width={120} tick={{ fill: '#ccc', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e1e2e', border: '1px solid #333', color: '#ccc' }}
                    formatter={(val) => [`${val} kWh`, 'Consommation']}
                  />
                  <Bar dataKey="total_kwh" fill="#f5a623" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {top_consumers.length >= 3 && (
              <p className="chart-note">
                Les 3 premiers appareils representent {top3Pct.toFixed(1)}% de la consommation totale.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Section 3 — Veille */}
      <section className="report-section">
        <h2>Consommation en veille</h2>
        <div className="report-card">
          {standby.length === 0 ? (
            <p className="standby-none">Aucune consommation en veille significative detectee !</p>
          ) : (
            <>
              <table className="standby-table">
                <thead>
                  <tr>
                    <th>Appareil</th>
                    <th>Puissance moyenne (W)</th>
                    <th>Cout annuel estime (EUR)</th>
                  </tr>
                </thead>
                <tbody>
                  {standby.map(s => (
                    <tr key={s.plug_id}>
                      <td>{s.appliance_name}</td>
                      <td>{s.avg_power_w}</td>
                      <td>{s.estimated_annual_cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td></td>
                    <td>{standby.reduce((s, r) => s + r.estimated_annual_cost, 0).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      </section>

      {/* Section 4 — Confort */}
      {comfort.length > 0 && (
        <section className="report-section">
          <h2>Confort par piece</h2>
          <div className="comfort-grid">
            {comfort.map(room => (
              <div className="report-card comfort-card" key={room.room_id}>
                <div className="comfort-header">
                  <span
                    className="comfort-dot"
                    style={{ background: room.status === 'good' ? '#4caf50' : room.status === 'warning' ? '#ff9800' : '#f44336' }}
                  />
                  <h3>{room.room_name}</h3>
                </div>
                <div className="comfort-stats">
                  {room.avg_temp != null && (
                    <div className="comfort-stat">
                      <span className="comfort-value">{room.avg_temp}</span>
                      <span className="comfort-unit">degC moy.</span>
                    </div>
                  )}
                  {room.avg_humidity != null && (
                    <div className="comfort-stat">
                      <span className="comfort-value">{room.avg_humidity}</span>
                      <span className="comfort-unit">% HR moy.</span>
                    </div>
                  )}
                </div>
                <p className="comfort-pct">
                  {Math.max(room.pct_temp_outside, room.pct_humidity_outside)}% du temps hors zone de confort
                </p>
                {room.daily_temp_series.length > 1 && (
                  <div className="comfort-chart">
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={room.daily_temp_series} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: '#666', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: '#1e1e2e', border: '1px solid #333', color: '#ccc' }}
                          formatter={(val) => [`${val} degC`, 'Temperature']}
                        />
                        <Line type="monotone" dataKey="avg_temp" stroke={room.color || '#64b5f6'} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 5 — Courbes de consommation */}
      {energy.daily_series.length > 0 && (
        <section className="report-section">
          <h2>Courbes de consommation</h2>
          <div className="report-card">
            <div className="chart-container" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={energy.daily_series} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fill: '#888' }} unit=" kWh" />
                  <Tooltip
                    contentStyle={{ background: '#1e1e2e', border: '1px solid #333', color: '#ccc' }}
                    formatter={(val) => [`${val} kWh`, 'Consommation']}
                  />
                  <Area type="monotone" dataKey="kwh" stroke="#f5a623" fill="rgba(245, 166, 35, 0.2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* Section 6 — Recommandations */}
      {recommendations.length > 0 && (
        <section className="report-section">
          <h2>Recommandations</h2>
          <div className="recommendations-list">
            {recommendations.map((tip, i) => (
              <div className="report-card recommendation-card" key={i}>
                <span className="recommendation-icon">💡</span>
                <p>{tip}</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '...';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}
