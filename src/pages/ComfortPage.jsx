import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import {
  COMFORT_CONFIG,
  evaluateRoom,
  adjustOutdoor,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../lib/comfort';
import ComfortChart from '../components/ComfortChart';
import './ComfortPage.css';

const STATUS_ICON = {
  ok: '✓',
  watch: '!',
  mold_risk: '⚠',
  condensation: '💧',
};

function Num({ value, digits = 1, unit = '' }) {
  if (value == null || !Number.isFinite(value)) return <span className="cf-na">—</span>;
  return <span>{value.toFixed(digits)}{unit}</span>;
}

function StatusPill({ status }) {
  return (
    <span className="cf-pill" style={{ background: STATUS_COLOR[status] }}>
      <span className="cf-pill-icon">{STATUS_ICON[status]}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function ComfortPage({ onClose }) {
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Simulateur
  const [simT, setSimT] = useState(20);
  const [simH, setSimH] = useState(55);

  // Details replies par defaut
  const [showDetails, setShowDetails] = useState(false);

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

  const outdoor = current?.outdoor;
  const outdoorTempC = outdoor?.temperature_c ?? null;

  const simEval = useMemo(
    () => Number.isFinite(outdoorTempC)
      ? evaluateRoom({ tIntC: simT, rhPct: simH, tExtRawC: outdoorTempC })
      : null,
    [simT, simH, outdoorTempC]
  );

  // Pieces -> format pour le chart
  const chartRooms = useMemo(() => {
    if (!current?.rooms) return [];
    return current.rooms
      .filter((r) => r.evaluation)
      .map((r) => ({
        name: r.room_name,
        tIntC: r.evaluation.inputs.t_int_c,
        rhPct: r.evaluation.inputs.rh_pct,
        status: r.evaluation.status,
      }));
  }, [current]);

  // Synthese : compte des pieces par statut
  const summary = useMemo(() => {
    if (!current?.rooms) return null;
    const counts = { ok: 0, watch: 0, mold_risk: 0, condensation: 0, unknown: 0 };
    current.rooms.forEach((r) => {
      if (!r.evaluation) counts.unknown += 1;
      else counts[r.evaluation.status] += 1;
    });
    return counts;
  }, [current]);

  return (
    <div className="cf-overlay" role="dialog" aria-modal="true">
      {/* ── Header ─────────────────────────────────── */}
      <div className="cf-header">
        <div className="cf-brand">
          <img src="/beaba_banner.png" alt="Beaba" className="cf-logo" />
          <div className="cf-title">
            <h2>Confort &amp; condensation</h2>
            <p className="cf-subtitle">
              Chaque piece est evaluee selon le risque de condensation sur la
              face interieure d'un mur exterieur (brique 30 cm non isolee).
            </p>
          </div>
        </div>
        <button className="cf-close" onClick={onClose} aria-label="Fermer">&times;</button>
      </div>

      <div className="cf-body">
        {/* ── Bandeau resume ────────────────────────── */}
        <div className="cf-summary-row">
          <div className="cf-stat">
            <span className="cf-stat-label">Dehors</span>
            <strong className="cf-stat-value"><Num value={outdoor?.temperature_c} unit="°C" /></strong>
            <span className="cf-stat-hint">
              ressenti mur : <Num value={outdoor?.temperature_adjusted_c} unit="°C" />
            </span>
          </div>
          {summary && (
            <div className="cf-status-counts">
              {summary.ok > 0 && <StatusCount n={summary.ok} status="ok" />}
              {summary.watch > 0 && <StatusCount n={summary.watch} status="watch" />}
              {summary.mold_risk > 0 && <StatusCount n={summary.mold_risk} status="mold_risk" />}
              {summary.condensation > 0 && <StatusCount n={summary.condensation} status="condensation" />}
              {summary.unknown > 0 && (
                <div className="cf-status-count" style={{ background: '#334155' }}>
                  {summary.unknown} sans mesure
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Chart ─────────────────────────────────── */}
        <section className="cf-chart-section">
          {loading && <p className="cf-loading">Chargement de la meteo et des releves…</p>}
          {error && <p className="cf-error">Erreur : {error}</p>}
          {!loading && !error && (
            <ComfortChart
              outdoorTempC={outdoorTempC}
              rooms={chartRooms}
              simulator={{ tIntC: simT, rhPct: simH }}
              onChartClick={(t, rh) => { setSimT(t); setSimH(rh); }}
            />
          )}
          <p className="cf-chart-hint">
            Cliquez sur le diagramme pour deplacer le point du simulateur,
            ou utilisez les curseurs ci-dessous.
          </p>
        </section>

        {/* ── Simulateur compact ────────────────────── */}
        <section className="cf-card cf-sim-card">
          <div className="cf-sim-row">
            <label className="cf-sim-input">
              <span>Temperature interieure</span>
              <input type="range" min="10" max="30" step="0.5" value={simT}
                onChange={(e) => setSimT(parseFloat(e.target.value))} />
              <strong>{simT.toFixed(1)}°C</strong>
            </label>
            <label className="cf-sim-input">
              <span>Humidite interieure</span>
              <input type="range" min="10" max="95" step="1" value={simH}
                onChange={(e) => setSimH(parseFloat(e.target.value))} />
              <strong>{simH.toFixed(0)}%</strong>
            </label>
          </div>
          {simEval && (
            <div className="cf-sim-result">
              <StatusPill status={simEval.status} />
              <div className="cf-sim-derived">
                <span><label>T paroi</label><Num value={simEval.derived.t_si_c} unit="°C" /></span>
                <span><label>T rosee</label><Num value={simEval.derived.t_dew_c} unit="°C" /></span>
                <span><label>Marge</label><Num value={simEval.derived.mold_margin_c} unit="°C" /></span>
              </div>
            </div>
          )}
        </section>

        {/* ── Pieces ───────────────────────────────── */}
        {current?.rooms && current.rooms.length > 0 && (
          <section className="cf-rooms-section">
            <h3 className="cf-section-title">Detail par piece</h3>
            <div className="cf-rooms">
              {current.rooms.map((r) => <RoomCard key={r.room_id} room={r} />)}
            </div>
          </section>
        )}

        {/* ── Details (replies) ────────────────────── */}
        <section className="cf-card cf-details">
          <button
            type="button"
            className="cf-details-toggle"
            onClick={() => setShowDetails((s) => !s)}
            aria-expanded={showDetails}
          >
            <span>{showDetails ? '▼' : '▶'} Comment c'est calcule</span>
          </button>
          {showDetails && <CalculationDetails outdoor={outdoor} />}
        </section>
      </div>
    </div>
  );
}

/* ── Sub-composants ────────────────────────────────── */

function StatusCount({ n, status }) {
  return (
    <div className="cf-status-count" style={{ background: STATUS_COLOR[status] }}>
      <strong>{n}</strong> {STATUS_LABEL[status].toLowerCase()}
    </div>
  );
}

function RoomCard({ room }) {
  if (!room.evaluation) {
    return (
      <div className="cf-room cf-room-empty">
        <strong>{room.room_name}</strong>
        <span className="cf-na">Pas de mesure recente</span>
      </div>
    );
  }
  const e = room.evaluation;
  const worst = e.reasons.find((r) => r.severity === 'bad')
    || e.reasons.find((r) => r.severity === 'warn');
  return (
    <div className="cf-room" style={{ borderLeftColor: STATUS_COLOR[e.status] }}>
      <div className="cf-room-head">
        <strong>{room.room_name}</strong>
        <StatusPill status={e.status} />
      </div>
      <div className="cf-room-mini">
        <span><label>T</label><Num value={e.inputs.t_int_c} unit="°C" /></span>
        <span><label>RH</label><Num value={e.inputs.rh_pct} digits={0} unit="%" /></span>
        <span><label>Paroi</label><Num value={e.derived.t_si_c} unit="°C" /></span>
        <span><label>Rosee</label><Num value={e.derived.t_dew_c} unit="°C" /></span>
      </div>
      {worst && (
        <p className={`cf-room-msg cf-${worst.severity}`}>{worst.text}</p>
      )}
    </div>
  );
}

function CalculationDetails({ outdoor }) {
  const wall = COMFORT_CONFIG.wall;
  return (
    <div className="cf-details-body">
      <div className="cf-step">
        <h4>1 · Modele du mur</h4>
        <p>{wall.description}.</p>
        <div className="cf-kvgrid">
          <div><label>Epaisseur</label><strong>{wall.thickness_m} m</strong></div>
          <div><label>λ brique</label><strong>{wall.conductivity_w_per_mk} W/m·K</strong></div>
          <div><label>R_mur</label><strong><Num value={wall.r_wall_m2k_per_w} digits={3} unit=" m²K/W" /></strong></div>
          <div><label>Rsi</label><strong>{wall.rsi_m2k_per_w}</strong></div>
          <div><label>Rse</label><strong>{wall.rse_m2k_per_w}</strong></div>
          <div><label>R_total</label><strong><Num value={wall.r_total_m2k_per_w} digits={3} /></strong></div>
          <div><label>f_Rsi</label><strong><Num value={wall.f_rsi} digits={3} /></strong></div>
        </div>
      </div>

      <div className="cf-step">
        <h4>2 · Correction vent</h4>
        <p>On retire {COMFORT_CONFIG.outdoor.wind_safety_c}°C a la temperature exterieure ambiante pour modeliser un refroidissement de paroi par vent.</p>
        <code className="cf-formula">T_ext_adj = T_ext − {COMFORT_CONFIG.outdoor.wind_safety_c}°C</code>
        {outdoor && (
          <p className="cf-step-live">
            Aujourd'hui : <strong><Num value={outdoor.temperature_c} unit="°C" /></strong> ext. →
            <strong> <Num value={outdoor.temperature_adjusted_c} unit="°C" /></strong> de calcul.
          </p>
        )}
      </div>

      <div className="cf-step">
        <h4>3 · Temperature de surface du mur</h4>
        <code className="cf-formula">T_si = T_int − (T_int − T_ext_adj) · f_Rsi</code>
        <p className="cf-hint">
          La face interieure du mur recupere {(wall.f_rsi * 100).toFixed(1)}% de l'ecart entre l'air interieur et l'exterieur de calcul.
        </p>
      </div>

      <div className="cf-step">
        <h4>4 · Point de rosee (Magnus-Tetens)</h4>
        <code className="cf-formula cf-formula-multi">
          α = ln(RH/100) + 17.27 · T / (237.7 + T)<br />
          T_rosee = 237.7 · α / (17.27 − α)
        </code>
        <p className="cf-hint">Temperature en dessous de laquelle l'air interieur se met a deposer de l'eau liquide sur une surface.</p>
      </div>

      <div className="cf-step">
        <h4>5 · Seuils retenus</h4>
        <ul className="cf-thresholds">
          <li><strong style={{ color: STATUS_COLOR.ok }}>OK</strong> : T_si &gt; T_rosee + {COMFORT_CONFIG.condensation.mold_margin_c}°C, T ∈ [{COMFORT_CONFIG.temperature.min_c}, {COMFORT_CONFIG.temperature.max_c}]°C, RH ∈ [{COMFORT_CONFIG.humidity.min_pct}, {COMFORT_CONFIG.humidity.max_pct}]%</li>
          <li><strong style={{ color: STATUS_COLOR.watch }}>A surveiller</strong> : T ou RH hors zone, mais pas de risque mur</li>
          <li><strong style={{ color: STATUS_COLOR.mold_risk }}>Risque moisissure</strong> : T_si − T_rosee ≤ {COMFORT_CONFIG.condensation.mold_margin_c}°C (norme DIN 4108-2)</li>
          <li><strong style={{ color: STATUS_COLOR.condensation }}>Condensation</strong> : T_si ≤ T_rosee, eau liquide sur le mur</li>
        </ul>
      </div>
    </div>
  );
}
