import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { useCampaign } from '../context/CampaignContext';
import api from '../api';
import './ReportPrintPage.css';

export default function ReportPrintPage() {
  const { campaign } = useCampaign();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!campaign?.id) return;
    api.get(`/api/report/${campaign.id}`)
      .then(res => { setReport(res.data); setError(null); })
      .catch(() => setError('Impossible de charger le rapport'))
      .finally(() => setLoading(false));
  }, [campaign?.id]);

  // Auto-trigger print once data is rendered
  useEffect(() => {
    if (!loading && report) {
      const t = setTimeout(() => window.print(), 800);
      return () => clearTimeout(t);
    }
  }, [loading, report]);

  if (loading) return <div className="pr-loading">Preparation du rapport...</div>;
  if (error || !report) return <div className="pr-loading">{error || 'Rapport indisponible'}</div>;

  const { energy, top_consumers, standby, comfort, recommendations, meters } = report;
  const cam = report.campaign;
  const today = formatDate(new Date().toISOString());
  const standbyTotal = standby.reduce((s, r) => s + r.estimated_annual_cost, 0);

  return (
    <div className="pr-root">
      {/* Print controls (hidden on print) */}
      <div className="pr-chrome no-print">
        <div className="pr-chrome-inner">
          <div className="pr-chrome-title">Apercu rapport PDF — {cam.household}</div>
          <button className="pr-chrome-btn" onClick={() => window.print()}>Imprimer le rapport</button>
        </div>
      </div>

      {/* ── Page 1 — Couverture ── */}
      <section className="pr-page pr-cover">
        <div className="pr-cover-top">
          <img src="/beaba_banner.png" alt="Beaba" className="pr-cover-logo" />
        </div>

        <div className="pr-cover-center">
          <div className="pr-cover-eyebrow">Rapport de campagne</div>
          <h1 className="pr-cover-household">{cam.household}</h1>
          {cam.address && <div className="pr-cover-address">{cam.address}</div>}

          <div className="pr-cover-dates">
            <div><span className="pr-lbl">Du</span> {formatDate(cam.start_date)}</div>
            <div><span className="pr-lbl">Au</span> {formatDate(cam.end_date)}</div>
            <div><span className="pr-lbl">Duree</span> {cam.duration_days} jours</div>
          </div>
        </div>

        <div className="pr-cover-bottom">
          <div className="pr-signatures">
            <div className="pr-sig">
              <div className="pr-sig-line" />
              <div className="pr-sig-label">Conseiller en renovation</div>
            </div>
            <div className="pr-sig">
              <div className="pr-sig-line" />
              <div className="pr-sig-label">Habitant</div>
            </div>
          </div>
          <div className="pr-cover-meta">
            Rapport genere le {today} avec Beaba
          </div>
        </div>
      </section>

      {/* ── Page 2 — Synthese ── */}
      <section className="pr-page">
        <PrintHeader household={cam.household} pageNum={2} />

        <h2 className="pr-h1">Synthese de la campagne</h2>

        <div className="pr-summary-box">
          <div className="pr-summary-grid">
            <div>
              <div className="pr-summary-lbl">Electricite mesuree</div>
              <div className="pr-summary-val">{energy.total_kwh} <span>kWh</span></div>
            </div>
            <div>
              <div className="pr-summary-lbl">Cout electrique estime</div>
              <div className="pr-summary-val accent">{energy.estimated_cost.toFixed(2)} <span>€</span></div>
            </div>
            <div>
              <div className="pr-summary-lbl">Moyenne journaliere</div>
              <div className="pr-summary-val">{energy.daily_avg_kwh} <span>kWh/j</span></div>
            </div>
            <div>
              <div className="pr-summary-lbl">Duree</div>
              <div className="pr-summary-val">{cam.duration_days} <span>jours</span></div>
            </div>
          </div>
        </div>

        {meters?.readings?.length > 0 && (
          <>
            <h3 className="pr-h2">Releves des compteurs</h3>
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Compteur</th>
                  <th>Debut</th>
                  <th>Fin</th>
                  <th>Consommation</th>
                  <th className="ar">Cout estime</th>
                </tr>
              </thead>
              <tbody>
                {meters.readings.map(m => (
                  <tr key={m.meter_type}>
                    <td>{meterLabel(m.meter_type)}</td>
                    <td>{m.start_value} {m.unit}</td>
                    <td>{m.end_value} {m.unit}</td>
                    <td>
                      {m.consumption} {m.unit}
                      {m.meter_type === 'gas' && m.consumption_kwh != null && ` (${m.consumption_kwh} kWh)`}
                    </td>
                    <td className="ar">{m.estimated_cost.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total estime</td>
                  <td className="ar accent">{meters.total_estimated_cost.toFixed(2)} €</td>
                </tr>
              </tfoot>
            </table>
          </>
        )}

        {top_consumers.length > 0 && (
          <>
            <h3 className="pr-h2">Top 3 consommateurs electriques</h3>
            <ol className="pr-top3-list">
              {top_consumers.slice(0, 3).map(c => (
                <li key={c.plug_id}>
                  <span className="pr-top3-name">{c.appliance_name}</span>
                  <span className="pr-top3-room">{c.room_name}</span>
                  <span className="pr-top3-val">{c.total_kwh} kWh ({c.percentage.toFixed(1)}%)</span>
                </li>
              ))}
            </ol>
          </>
        )}

        <PrintFooter today={today} />
      </section>

      {/* ── Page 3 — Analyse electrique ── */}
      <section className="pr-page">
        <PrintHeader household={cam.household} pageNum={3} />

        <h2 className="pr-h1">Consommation electrique</h2>

        {top_consumers.length > 0 && (
          <>
            <h3 className="pr-h2">Appareils mesures</h3>
            <div className="pr-chart" style={{ height: Math.min(260, Math.max(160, top_consumers.length * 28)) }}>
              <ResponsiveContainer>
                <BarChart data={top_consumers} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }}>
                  <XAxis type="number" tick={{ fill: '#333', fontSize: 10 }} unit=" kWh" stroke="#999" />
                  <YAxis type="category" dataKey="appliance_name" width={130} tick={{ fill: '#333', fontSize: 10 }} stroke="#999" />
                  <Bar dataKey="total_kwh" fill="#f59e0b">
                    <LabelList dataKey="total_kwh" position="right" formatter={(v) => `${v} kWh`} style={{ fontSize: 10, fill: '#333' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <table className="pr-table">
              <thead>
                <tr>
                  <th>Appareil</th>
                  <th>Piece</th>
                  <th className="ar">Consommation</th>
                  <th className="ar">Part du total</th>
                </tr>
              </thead>
              <tbody>
                {top_consumers.map(c => (
                  <tr key={c.plug_id}>
                    <td>{c.appliance_name}</td>
                    <td>{c.room_name}</td>
                    <td className="ar">{c.total_kwh} kWh</td>
                    <td className="ar">{c.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h3 className="pr-h2">Consommation en veille</h3>
        {standby.length === 0 ? (
          <p className="pr-note">Aucune consommation en veille significative n'a ete detectee (mesure entre 0h et 6h).</p>
        ) : (
          <>
            <p className="pr-note">Mesure realisee la nuit (0h-6h). Extrapolation sur 365 jours.</p>
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Appareil</th>
                  <th className="ar">Puissance moyenne</th>
                  <th className="ar">kWh / an</th>
                  <th className="ar">Cout annuel</th>
                </tr>
              </thead>
              <tbody>
                {standby.map(s => (
                  <tr key={s.plug_id}>
                    <td>{s.appliance_name}</td>
                    <td className="ar">{s.avg_power_w} W</td>
                    <td className="ar">{s.estimated_annual_kwh} kWh</td>
                    <td className="ar">{s.estimated_annual_cost.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total annuel perdu en veille</td>
                  <td className="ar accent">{standbyTotal.toFixed(2)} €</td>
                </tr>
              </tfoot>
            </table>
          </>
        )}

        {energy.daily_series.length > 0 && (
          <>
            <h3 className="pr-h2">Consommation journaliere</h3>
            <div className="pr-chart" style={{ height: 180 }}>
              <ResponsiveContainer>
                <LineChart data={energy.daily_series} margin={{ top: 4, right: 16, bottom: 4, left: -12 }}>
                  <CartesianGrid stroke="#e5e5e5" strokeDasharray="2 2" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#333', fontSize: 9 }} tickFormatter={d => d.slice(5)} stroke="#999" />
                  <YAxis tick={{ fill: '#333', fontSize: 9 }} stroke="#999" unit=" kWh" />
                  <Line type="monotone" dataKey="kwh" stroke="#000" strokeWidth={1.4} dot={{ r: 2, fill: '#000' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        <PrintFooter today={today} />
      </section>

      {/* ── Page 4 — Confort ── */}
      {comfort.length > 0 && (
        <section className="pr-page">
          <PrintHeader household={cam.household} pageNum={4} />
          <h2 className="pr-h1">Confort thermique</h2>
          <p className="pr-note">
            Zone de confort : 19-24°C, 40-60% d'humidite relative.
          </p>

          <table className="pr-table">
            <thead>
              <tr>
                <th>Piece</th>
                <th className="ar">Temp. moy.</th>
                <th className="ar">Min / Max</th>
                <th className="ar">Humidite moy.</th>
                <th className="ar">% hors confort</th>
                <th>Evaluation</th>
              </tr>
            </thead>
            <tbody>
              {comfort.map(r => (
                <tr key={r.room_id}>
                  <td>{r.room_name}</td>
                  <td className="ar">{r.avg_temp != null ? `${r.avg_temp}°C` : '—'}</td>
                  <td className="ar">{r.min_temp != null ? `${r.min_temp}° / ${r.max_temp}°` : '—'}</td>
                  <td className="ar">{r.avg_humidity != null ? `${r.avg_humidity}%` : '—'}</td>
                  <td className="ar">{Math.max(r.pct_temp_outside, r.pct_humidity_outside)}%</td>
                  <td>{statusLabel(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="pr-h2">Evolution de la temperature par piece</h3>
          <div className="pr-comfort-charts">
            {comfort.filter(r => r.daily_temp_series?.length > 1).map(r => (
              <div className="pr-comfort-chart" key={r.room_id}>
                <div className="pr-comfort-chart-title">{r.room_name}</div>
                <div style={{ height: 90 }}>
                  <ResponsiveContainer>
                    <LineChart data={r.daily_temp_series} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                      <CartesianGrid stroke="#e5e5e5" strokeDasharray="2 2" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 8 }} tickFormatter={d => d.slice(5)} stroke="#bbb" />
                      <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: '#555', fontSize: 8 }} stroke="#bbb" />
                      <Line dataKey="avg_temp" stroke="#000" strokeWidth={1.2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          <PrintFooter today={today} />
        </section>
      )}

      {/* ── Page 5 — Recommandations + pieds de page ── */}
      <section className="pr-page pr-last-page">
        <PrintHeader household={cam.household} pageNum={comfort.length > 0 ? 5 : 4} />

        <h2 className="pr-h1">Recommandations</h2>
        {recommendations.length === 0 ? (
          <p className="pr-note">Aucune recommandation specifique.</p>
        ) : (
          <ol className="pr-reco">
            {recommendations.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ol>
        )}

        <div className="pr-partners">
          <p className="pr-partners-text">
            Beaba est developpe par l'atelier d'architecture <strong>450ppm</strong> en partenariat
            avec la <strong>Maison de quartier Bonnevie</strong>, avec le soutien de Bruxelles Environnement,
            de la Commune de Molenbeek et d'urban.brussels.
          </p>
          <img src="/partners-banner.png" alt="Partenaires" className="pr-partners-img" />
          <div className="pr-copy">
            © 450ppm · Rapport genere le {today}
          </div>
        </div>
      </section>
    </div>
  );
}

function PrintHeader({ household, pageNum }) {
  return (
    <div className="pr-page-header">
      <div className="pr-ph-left">{household}</div>
      <div className="pr-ph-right">Page {pageNum}</div>
    </div>
  );
}

function PrintFooter({ today }) {
  return (
    <div className="pr-page-footer">
      <div>Beaba · audit energetique</div>
      <div>Genere le {today}</div>
    </div>
  );
}

function meterLabel(t) {
  return { electricity: 'Electricite', gas: 'Gaz', water: 'Eau' }[t] || t;
}

function statusLabel(s) {
  return { good: 'Confort', warning: 'Moyen', bad: 'A ameliorer' }[s] || s;
}

function formatDate(s) {
  if (!s) return '...';
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
