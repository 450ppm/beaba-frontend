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

  const { energy, top_consumers, standby, comfort, recommendations, meters } = report;
  const cam = report.campaign;
  const top3Pct = top_consumers.slice(0, 3).reduce((s, c) => s + c.percentage, 0);

  return (
    <div className="report-page">

      {/* Actions */}
      <div className="report-actions no-print">
        <button className="btn-export" onClick={handleExportCsv}>
          Exporter les donnees (CSV)
        </button>
        <button className="btn-print" onClick={handlePrint}>
          Imprimer / PDF
        </button>
      </div>

      {/* ── Cover page ──────────────────────────────────── */}
      <section className="report-cover">
        <div className="cover-header">
          <img src="/beaba_banner.png" alt="Beaba" className="cover-logo" />
        </div>
        <div className="cover-title-block">
          <div className="cover-label">Rapport de campagne</div>
          <h1 className="cover-household">{cam.household}</h1>
          {cam.address && <p className="cover-address">{cam.address}</p>}
        </div>
        <div className="cover-dates">
          <div className="cover-date-item">
            <span className="cover-date-label">Debut</span>
            <span className="cover-date-value">{formatDate(cam.start_date)}</span>
          </div>
          <div className="cover-date-arrow">→</div>
          <div className="cover-date-item">
            <span className="cover-date-label">Fin</span>
            <span className="cover-date-value">{formatDate(cam.end_date)}</span>
          </div>
          <div className="cover-date-item cover-duration">
            <span className="cover-date-label">Duree</span>
            <span className="cover-date-value">{cam.duration_days} jours</span>
          </div>
        </div>
        <div className="cover-hero-stats">
          <div className="cover-stat">
            <div className="cover-stat-value">{energy.total_kwh}</div>
            <div className="cover-stat-unit">kWh mesures</div>
          </div>
          <div className="cover-stat cover-stat-accent">
            <div className="cover-stat-value">{energy.estimated_cost.toFixed(0)}</div>
            <div className="cover-stat-unit">EUR estimes</div>
          </div>
          <div className="cover-stat">
            <div className="cover-stat-value">{energy.daily_avg_kwh}</div>
            <div className="cover-stat-unit">kWh / jour</div>
          </div>
        </div>
      </section>

      {/* ── Section compteurs ──────────────────────────── */}
      {meters && meters.readings && meters.readings.length > 0 && (
        <section className="report-section">
          <div className="section-head">
            <span className="section-icon section-icon-meter">📊</span>
            <h2>Consommation globale du foyer</h2>
          </div>
          <p className="section-subtitle">
            Releves des compteurs en debut et en fin de campagne
          </p>
          <div className="report-card">
            <table className="meters-table">
              <thead>
                <tr>
                  <th>Compteur</th>
                  <th>Debut</th>
                  <th>Fin</th>
                  <th>Consommation</th>
                  <th>Cout estime</th>
                </tr>
              </thead>
              <tbody>
                {meters.readings.map(m => (
                  <tr key={m.meter_type}>
                    <td className="meter-row-label">
                      <span className={`meter-tag meter-tag-${m.meter_type}`}>
                        {meterEmoji(m.meter_type)} {meterLabel(m.meter_type)}
                      </span>
                    </td>
                    <td>{m.start_value} {m.unit}</td>
                    <td>{m.end_value} {m.unit}</td>
                    <td className="meter-consumption">
                      <strong>{m.consumption} {m.unit}</strong>
                      {m.meter_type === 'gas' && m.consumption_kwh != null && (
                        <span className="meters-kwh"> ({m.consumption_kwh} kWh)</span>
                      )}
                    </td>
                    <td className="meter-cost">{m.estimated_cost.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4">Total estime</td>
                  <td className="meter-cost-total">{meters.total_estimated_cost.toFixed(2)} €</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* ── Top consommateurs ─────────────────────────── */}
      {top_consumers.length > 0 && (
        <section className="report-section">
          <div className="section-head">
            <span className="section-icon section-icon-power">⚡</span>
            <h2>Top consommateurs</h2>
          </div>
          <p className="section-subtitle">
            Appareils classes par consommation totale sur la campagne
          </p>
          <div className="report-card">
            <div className="chart-container" style={{ height: Math.max(220, top_consumers.length * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top_consumers} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" tick={{ fill: '#888' }} unit=" kWh" />
                  <YAxis type="category" dataKey="appliance_name" width={140} tick={{ fill: '#333', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val) => [`${val} kWh`, 'Consommation']}
                  />
                  <Bar dataKey="total_kwh" fill="url(#barGradient)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {top_consumers.length >= 3 && (
              <div className="highlight-box highlight-box-orange">
                <strong>À retenir :</strong> les 3 premiers appareils representent {top3Pct.toFixed(1)}% de la consommation totale.
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Veille ─────────────────────────────────────── */}
      <section className="report-section">
        <div className="section-head">
          <span className="section-icon section-icon-standby">🔌</span>
          <h2>Consommation en veille</h2>
        </div>
        <p className="section-subtitle">
          Appareils qui consomment meme lorsque personne ne les utilise (mesure entre 0h et 6h)
        </p>
        <div className="report-card">
          {standby.length === 0 ? (
            <div className="highlight-box highlight-box-green">
              Aucune consommation en veille significative detectee.
            </div>
          ) : (
            <>
              <table className="standby-table">
                <thead>
                  <tr>
                    <th>Appareil</th>
                    <th>Puissance moyenne</th>
                    <th>Cout annuel estime</th>
                  </tr>
                </thead>
                <tbody>
                  {standby.map(s => (
                    <tr key={s.plug_id}>
                      <td>{s.appliance_name}</td>
                      <td>{s.avg_power_w} W</td>
                      <td className="standby-cost">{s.estimated_annual_cost.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total annuel</td>
                    <td></td>
                    <td>{standby.reduce((s, r) => s + r.estimated_annual_cost, 0).toFixed(2)} €</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      </section>

      {/* ── Confort ────────────────────────────────────── */}
      {comfort.length > 0 && (
        <section className="report-section">
          <div className="section-head">
            <span className="section-icon section-icon-comfort">🌡️</span>
            <h2>Confort par piece</h2>
          </div>
          <p className="section-subtitle">
            Zone de confort : 19-24°C et 40-60% d'humidite relative
          </p>
          <div className="comfort-grid">
            {comfort.map(room => (
              <div className={`report-card comfort-card comfort-status-${room.status}`} key={room.room_id}>
                <div className="comfort-header">
                  <div className="comfort-status-badge" data-status={room.status}>
                    {room.status === 'good' ? 'Confort' : room.status === 'warning' ? 'Moyen' : 'A ameliorer'}
                  </div>
                  <h3>{room.room_name}</h3>
                </div>
                <div className="comfort-stats">
                  {room.avg_temp != null && (
                    <div className="comfort-stat">
                      <span className="comfort-value">{room.avg_temp}°</span>
                      <span className="comfort-unit">Temperature moy.</span>
                    </div>
                  )}
                  {room.avg_humidity != null && (
                    <div className="comfort-stat">
                      <span className="comfort-value">{room.avg_humidity}%</span>
                      <span className="comfort-unit">Humidite moy.</span>
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: '#666', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(val) => [`${val} °C`, 'Temperature']}
                        />
                        <Line type="monotone" dataKey="avg_temp" stroke={room.color || '#3b82f6'} strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Courbes de consommation ────────────────────── */}
      {energy.daily_series.length > 0 && (
        <section className="report-section">
          <div className="section-head">
            <span className="section-icon section-icon-chart">📈</span>
            <h2>Consommation journaliere</h2>
          </div>
          <p className="section-subtitle">
            Evolution de la consommation electrique jour apres jour
          </p>
          <div className="report-card">
            <div className="chart-container" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={energy.daily_series} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fill: '#666' }} unit=" kWh" />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val) => [`${val} kWh`, 'Consommation']}
                  />
                  <Area type="monotone" dataKey="kwh" stroke="#f59e0b" fill="url(#areaGradient)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* ── Recommandations ────────────────────────────── */}
      {recommendations.length > 0 && (
        <section className="report-section">
          <div className="section-head">
            <span className="section-icon section-icon-tips">💡</span>
            <h2>Recommandations</h2>
          </div>
          <p className="section-subtitle">
            Conseils personnalises pour reduire votre consommation et ameliorer votre confort
          </p>
          <div className="recommendations-list">
            {recommendations.map((tip, i) => (
              <div className="recommendation-card" key={i}>
                <div className="recommendation-number">{i + 1}</div>
                <p>{tip}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Footer partenaires ─────────────────────────── */}
      <section className="report-footer">
        <div className="footer-divider" />
        <p className="footer-project">
          Ce rapport a ete genere par <strong>Beaba</strong>, un outil open source
          developpe par l'atelier d'architecture <strong>450ppm</strong> en partenariat
          avec la <strong>Maison de quartier Bonnevie</strong>.
        </p>
        <p className="footer-support">
          Avec le soutien de Bruxelles Environnement, de la Commune de Molenbeek et de urban.brussels.
        </p>
        <div className="footer-partners">
          <img src="/partners-banner.png" alt="Partenaires" />
        </div>
        <p className="footer-meta">
          Rapport genere le {formatDate(new Date().toISOString())} — 450ppm.be
        </p>
      </section>

    </div>
  );
}

const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  color: '#111',
};

function meterLabel(type) {
  switch (type) {
    case 'electricity': return 'Electricite';
    case 'gas': return 'Gaz';
    case 'water': return 'Eau';
    default: return type;
  }
}

function meterEmoji(type) {
  switch (type) {
    case 'electricity': return '⚡';
    case 'gas': return '🔥';
    case 'water': return '💧';
    default: return '';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '...';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}
