import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import {
  COMFORT_CONFIG,
  evaluateRoom,
  adjustOutdoor,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../lib/comfort';
import './ComfortPage.css';

function Num({ value, digits = 1, unit = '' }) {
  if (value == null || !Number.isFinite(value)) return <span className="cf-na">—</span>;
  return <span>{value.toFixed(digits)}{unit}</span>;
}

export default function ComfortPage({ onClose }) {
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Simulateur interactif
  const [simT, setSimT] = useState(20);
  const [simH, setSimH] = useState(55);
  const [simExt, setSimExt] = useState(5);

  useEffect(() => {
    let alive = true;
    api.get('/api/comfort/current')
      .then((res) => { if (alive) { setCurrent(res.data); setLoading(false); } })
      .catch((err) => { if (alive) { setError(err.response?.data?.error || err.message); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const simEval = useMemo(
    () => evaluateRoom({ tIntC: simT, rhPct: simH, tExtRawC: simExt }),
    [simT, simH, simExt]
  );

  const wall = COMFORT_CONFIG.wall;
  const outdoor = current?.outdoor;

  return (
    <div className="cf-overlay" role="dialog" aria-modal="true">
      <div className="cf-header">
        <div className="cf-title">
          <h2>Plages de confort &mdash; methode et calcul</h2>
          <p className="cf-subtitle">
            On considere l'inconfort des qu'il y a risque de condensation ou de
            moisissure sur la face interieure d'un mur exterieur, plutot que
            sur des plages fixes arbitraires.
          </p>
        </div>
        <button className="cf-close" onClick={onClose} aria-label="Fermer">&times;</button>
      </div>

      <div className="cf-body">
        {/* ── Modele physique ────────────────────────── */}
        <section className="cf-card">
          <h3>1. Modele du mur</h3>
          <p className="cf-desc">{wall.description}. La paroi laisse passer le froid de l'exterieur ; sa face interieure est donc plus froide que l'air ambiant.</p>
          <div className="cf-grid">
            <div><label>Epaisseur</label><strong>{wall.thickness_m} m</strong></div>
            <div><label>Conductivite &lambda;</label><strong>{wall.conductivity_w_per_mk} W/m&middot;K</strong></div>
            <div><label>R<sub>mur</sub> = e/&lambda;</label><strong><Num value={wall.r_wall_m2k_per_w} digits={3} unit=" m²K/W" /></strong></div>
            <div><label>R<sub>si</sub> (couche int.)</label><strong>{wall.rsi_m2k_per_w} m²K/W</strong></div>
            <div><label>R<sub>se</sub> (couche ext.)</label><strong>{wall.rse_m2k_per_w} m²K/W</strong></div>
            <div><label>R<sub>total</sub></label><strong><Num value={wall.r_total_m2k_per_w} digits={3} unit=" m²K/W" /></strong></div>
            <div className="cf-grid-wide">
              <label>Facteur de surface f<sub>Rsi</sub> = R<sub>si</sub> / R<sub>total</sub></label>
              <strong><Num value={wall.f_rsi} digits={3} /></strong>
              <span className="cf-hint">La face interieure du mur recupere {(wall.f_rsi * 100).toFixed(1)}% de l'ecart de temperature int.&minus;ext.</span>
            </div>
          </div>
        </section>

        {/* ── Correction vent ────────────────────────── */}
        <section className="cf-card">
          <h3>2. Temperature exterieure de calcul</h3>
          <p className="cf-desc">
            On retire {COMFORT_CONFIG.outdoor.wind_safety_c}&deg;C a la temperature
            ambiante exterieure pour modeliser l'effet de refroidissement par
            le vent sur les facades exposees.
          </p>
          <code className="cf-formula">T<sub>ext_adj</sub> = T<sub>ext</sub> &minus; {COMFORT_CONFIG.outdoor.wind_safety_c}&deg;C</code>
          {outdoor && (
            <div className="cf-grid">
              <div><label>Meteo (Open-Meteo)</label><strong><Num value={outdoor.temperature_c} unit="&deg;C" /></strong></div>
              <div><label>Apres correction vent</label><strong><Num value={outdoor.temperature_adjusted_c} unit="&deg;C" /></strong></div>
              <div><label>Humidite ext.</label><strong><Num value={outdoor.humidity_pct} digits={0} unit="%" /></strong></div>
              <div><label>Vent</label><strong><Num value={outdoor.wind_speed_m_s} unit=" m/s" /></strong></div>
            </div>
          )}
        </section>

        {/* ── Formules ──────────────────────────────── */}
        <section className="cf-card">
          <h3>3. Calcul de la surface du mur et du point de rosee</h3>
          <p className="cf-desc">La temperature de la face interieure du mur (T<sub>si</sub>) est :</p>
          <code className="cf-formula">T<sub>si</sub> = T<sub>int</sub> &minus; (T<sub>int</sub> &minus; T<sub>ext_adj</sub>) &times; f<sub>Rsi</sub></code>
          <p className="cf-desc">Le point de rosee de l'air interieur (Magnus-Tetens) :</p>
          <code className="cf-formula cf-formula-multi">
            &alpha; = ln(RH/100) + 17.27 &middot; T / (237.7 + T)<br />
            T<sub>rosee</sub> = 237.7 &middot; &alpha; / (17.27 &minus; &alpha;)
          </code>
        </section>

        {/* ── Seuils ────────────────────────────────── */}
        <section className="cf-card">
          <h3>4. Plages retenues</h3>
          <div className="cf-status-grid">
            <div className="cf-status-row" style={{ borderLeftColor: STATUS_COLOR.ok }}>
              <strong>OK</strong>
              <span>T<sub>si</sub> &gt; T<sub>rosee</sub> + {COMFORT_CONFIG.condensation.mold_margin_c}&deg;C, T &isin; [{COMFORT_CONFIG.temperature.min_c}, {COMFORT_CONFIG.temperature.max_c}]&deg;C, RH &isin; [{COMFORT_CONFIG.humidity.min_pct}, {COMFORT_CONFIG.humidity.max_pct}]%</span>
            </div>
            <div className="cf-status-row" style={{ borderLeftColor: STATUS_COLOR.watch }}>
              <strong>A surveiller</strong>
              <span>Temperature hors {COMFORT_CONFIG.temperature.min_c}&ndash;{COMFORT_CONFIG.temperature.max_c}&deg;C ou humidite hors {COMFORT_CONFIG.humidity.min_pct}&ndash;{COMFORT_CONFIG.humidity.max_pct}%, mais pas de risque mur.</span>
            </div>
            <div className="cf-status-row" style={{ borderLeftColor: STATUS_COLOR.mold_risk }}>
              <strong>Risque moisissure</strong>
              <span>T<sub>si</sub> &minus; T<sub>rosee</sub> &le; {COMFORT_CONFIG.condensation.mold_margin_c}&deg;C (norme DIN 4108-2).</span>
            </div>
            <div className="cf-status-row" style={{ borderLeftColor: STATUS_COLOR.condensation }}>
              <strong>Condensation</strong>
              <span>T<sub>si</sub> &le; T<sub>rosee</sub> &mdash; eau liquide sur le mur.</span>
            </div>
          </div>
          <p className="cf-hint">
            Humidite : &lt;{COMFORT_CONFIG.humidity.min_pct}% irrite les muqueuses (zone physiologique seche). &gt;{COMFORT_CONFIG.humidity.max_pct}% favorise acariens et moisissures, meme sans condensation.
          </p>
        </section>

        {/* ── Simulateur ───────────────────────────── */}
        <section className="cf-card">
          <h3>5. Simulateur</h3>
          <p className="cf-desc">Joue avec les valeurs pour voir comment la marge evolue.</p>
          <div className="cf-sim-inputs">
            <label>
              <span>Temperature interieure</span>
              <input type="range" min="10" max="30" step="0.5" value={simT} onChange={(e) => setSimT(parseFloat(e.target.value))} />
              <strong>{simT.toFixed(1)}&deg;C</strong>
            </label>
            <label>
              <span>Humidite interieure</span>
              <input type="range" min="10" max="95" step="1" value={simH} onChange={(e) => setSimH(parseFloat(e.target.value))} />
              <strong>{simH.toFixed(0)}%</strong>
            </label>
            <label>
              <span>Temperature exterieure</span>
              <input type="range" min="-10" max="35" step="0.5" value={simExt} onChange={(e) => setSimExt(parseFloat(e.target.value))} />
              <strong>{simExt.toFixed(1)}&deg;C</strong>
            </label>
          </div>
          <SimResult evalData={simEval} />
        </section>

        {/* ── Etat actuel par piece ─────────────────── */}
        <section className="cf-card">
          <h3>6. Etat actuel de votre logement</h3>
          {loading && <p className="cf-desc">Chargement&hellip;</p>}
          {error && <p className="cf-error">Erreur : {error}</p>}
          {!loading && !error && current && (
            <div className="cf-rooms">
              {current.rooms.length === 0 && <p className="cf-desc">Aucune piece configuree.</p>}
              {current.rooms.map((r) => (
                <RoomEvaluation key={r.room_id} room={r} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SimResult({ evalData }) {
  const d = evalData.derived;
  return (
    <div className="cf-sim-result">
      <div className="cf-sim-derived">
        <div><label>T<sub>ext_adj</sub></label><strong><Num value={evalData.inputs.t_ext_adj_c} unit="&deg;C" /></strong></div>
        <div><label>T<sub>si</sub> (paroi)</label><strong><Num value={d.t_si_c} unit="&deg;C" /></strong></div>
        <div><label>T<sub>rosee</sub></label><strong><Num value={d.t_dew_c} unit="&deg;C" /></strong></div>
        <div><label>Marge paroi-rosee</label><strong><Num value={d.mold_margin_c} unit="&deg;C" /></strong></div>
      </div>
      <StatusBadge status={evalData.status} />
      <ul className="cf-reasons">
        {evalData.reasons.map((r, i) => (
          <li key={i} className={`cf-reason cf-${r.severity}`}>{r.text}</li>
        ))}
      </ul>
    </div>
  );
}

function RoomEvaluation({ room }) {
  if (!room.evaluation) {
    return (
      <div className="cf-room">
        <div className="cf-room-head">
          <strong>{room.room_name}</strong>
          <span className="cf-na">Pas de mesure recente</span>
        </div>
      </div>
    );
  }
  const e = room.evaluation;
  return (
    <div className="cf-room">
      <div className="cf-room-head">
        <strong>{room.room_name}</strong>
        <StatusBadge status={e.status} />
      </div>
      <div className="cf-room-grid">
        <div><label>T<sub>int</sub></label><strong><Num value={e.inputs.t_int_c} unit="&deg;C" /></strong></div>
        <div><label>RH</label><strong><Num value={e.inputs.rh_pct} digits={0} unit="%" /></strong></div>
        <div><label>T<sub>si</sub></label><strong><Num value={e.derived.t_si_c} unit="&deg;C" /></strong></div>
        <div><label>T<sub>rosee</sub></label><strong><Num value={e.derived.t_dew_c} unit="&deg;C" /></strong></div>
        <div><label>Marge</label><strong><Num value={e.derived.mold_margin_c} unit="&deg;C" /></strong></div>
      </div>
      <ul className="cf-reasons">
        {e.reasons.map((r, i) => (
          <li key={i} className={`cf-reason cf-${r.severity}`}>{r.text}</li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className="cf-badge" style={{ background: STATUS_COLOR[status] }}>
      {STATUS_LABEL[status]}
    </span>
  );
}
