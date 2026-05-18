import { useMemo } from 'react';
import {
  COMFORT_CONFIG,
  adjustOutdoor,
  wallSurfaceTempC,
  STATUS_COLOR,
} from '../lib/comfort';
import './ComfortChart.css';

/* ── Coordonnees du plan ────────────────────────────────────────────
   X: temperature interieure (degC), Y: humidite relative (%)
   On dessine 5..30°C et 0..100%, plus marges pour les axes.       */

// Deux cadrages : vue complete, ou zoom autour de la zone de confort.
const BOUNDS_FULL = { tMin: 5, tMax: 30, rhMin: 0, rhMax: 100 };
const BOUNDS_ZOOM = { tMin: 14, tMax: 28, rhMin: 15, rhMax: 85 };

const CHART_W = 820;
const CHART_H = 460;
const MARGIN = { top: 24, right: 24, bottom: 44, left: 56 };

const PLOT_W = CHART_W - MARGIN.left - MARGIN.right;
const PLOT_H = CHART_H - MARGIN.top - MARGIN.bottom;

// Echelles construites a partir des bornes courantes.
function makeScales(b) {
  return {
    tempToX: (t) => MARGIN.left + ((t - b.tMin) / (b.tMax - b.tMin)) * PLOT_W,
    rhToY: (rh) => MARGIN.top + ((b.rhMax - rh) / (b.rhMax - b.rhMin)) * PLOT_H,
  };
}

/* RH telle que T_rosee(T, RH) = targetDew. Magnus inverse. */
function rhAtDewPoint(tIntC, targetDewC) {
  const a = 17.27, b = 237.7;
  if (targetDewC <= -b) return 0;
  const targetAlpha = (a * targetDewC) / (b + targetDewC);
  const tAlpha = (a * tIntC) / (b + tIntC);
  const logRH = targetAlpha - tAlpha;
  return Math.min(100, Math.max(0, Math.exp(logRH) * 100));
}

/* Construit les deux courbes de danger pour une T_ext donnee. */
function buildDangerCurves(outdoorTempC, b) {
  if (!Number.isFinite(outdoorTempC)) return null;
  const tExtAdj = adjustOutdoor(outdoorTempC);
  const condensation = [];
  const moldRisk = [];
  const step = (b.tMax - b.tMin) / 60;
  for (let t = b.tMin; t <= b.tMax + 0.001; t += step) {
    const tSi = wallSurfaceTempC(t, tExtAdj);
    condensation.push({ t, rh: rhAtDewPoint(t, tSi) });
    moldRisk.push({ t, rh: rhAtDewPoint(t, tSi - COMFORT_CONFIG.condensation.mold_margin_c) });
  }
  return { condensation, moldRisk, tExtAdj };
}

function polylineD(points, s) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${s.tempToX(p.t).toFixed(1)} ${s.rhToY(p.rh).toFixed(1)}`).join(' ');
}

function zonePath(curve, fillToTop, s, b) {
  // Polyline le long de la courbe, puis ferme vers le haut (RH max) ou bas
  const pts = curve.map((p) => `${s.tempToX(p.t).toFixed(1)},${s.rhToY(p.rh).toFixed(1)}`);
  const edgeRh = fillToTop ? b.rhMax : b.rhMin;
  return `M ${pts.join(' L ')} L ${s.tempToX(b.tMax).toFixed(1)},${s.rhToY(edgeRh).toFixed(1)} L ${s.tempToX(b.tMin).toFixed(1)},${s.rhToY(edgeRh).toFixed(1)} Z`;
}

function clampPoint(t, rh, b) {
  return {
    t: Math.max(b.tMin, Math.min(b.tMax, t)),
    rh: Math.max(b.rhMin, Math.min(b.rhMax, rh)),
  };
}

/**
 * Props :
 *   outdoorTempC : temperature exterieure brute pour calculer les zones de danger
 *   rooms        : [{ name, tIntC, rhPct, status, color }]
 *   simulator    : { tIntC, rhPct } | null — point interactif
 *   onChartClick : (tIntC, rhPct) => void — pour repositionner le simulateur
 */
export default function ComfortChart({ outdoorTempC, rooms = [], simulator, onChartClick, zoom = false }) {
  const b = zoom ? BOUNDS_ZOOM : BOUNDS_FULL;
  const s = useMemo(() => makeScales(b), [b]);
  const { tempToX, rhToY } = s;
  const curves = useMemo(() => buildDangerCurves(outdoorTempC, b), [outdoorTempC, b]);

  // Comfort rectangle: T in [min,max], RH in [min,max]
  const cT = COMFORT_CONFIG.temperature;
  const cH = COMFORT_CONFIG.humidity;
  const comfortRect = {
    x: tempToX(cT.min_c),
    y: rhToY(cH.max_pct),
    w: tempToX(cT.max_c) - tempToX(cT.min_c),
    h: rhToY(cH.min_pct) - rhToY(cH.max_pct),
  };

  // Gridlines — pas adapte au cadrage
  const xStep = zoom ? 2 : 5;
  const rhStep = zoom ? 10 : 20;
  const xTicks = [];
  for (let t = Math.ceil(b.tMin / xStep) * xStep; t <= b.tMax; t += xStep) xTicks.push(t);
  const yTicks = [];
  for (let rh = Math.ceil(b.rhMin / rhStep) * rhStep; rh <= b.rhMax; rh += rhStep) yTicks.push(rh);

  const handleSvgClick = (e) => {
    if (!onChartClick) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(svg.getScreenCTM().inverse());
    if (local.x < MARGIN.left || local.x > MARGIN.left + PLOT_W) return;
    if (local.y < MARGIN.top || local.y > MARGIN.top + PLOT_H) return;
    const t = b.tMin + ((local.x - MARGIN.left) / PLOT_W) * (b.tMax - b.tMin);
    const rh = b.rhMax - ((local.y - MARGIN.top) / PLOT_H) * (b.rhMax - b.rhMin);
    onChartClick(Math.round(t * 2) / 2, Math.round(rh));
  };

  return (
    <div className="cc-wrap">
      <svg
        className="cc-svg"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={onChartClick ? handleSvgClick : undefined}
        role="img"
        aria-label="Diagramme psychrometrique du confort"
      >
        {/* Fond du plan */}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="#0f0f1a"
          stroke="rgba(255,255,255,0.08)"
        />

        {/* Zones de danger (sous la courbe = humidite haute) */}
        {curves && (
          <>
            <path d={zonePath(curves.condensation, true, s, b)} fill={STATUS_COLOR.condensation} fillOpacity="0.18" />
            <path d={zonePath(curves.moldRisk, true, s, b)} fill={STATUS_COLOR.mold_risk} fillOpacity="0.14" />
          </>
        )}

        {/* Zone de confort */}
        <rect
          x={comfortRect.x}
          y={comfortRect.y}
          width={comfortRect.w}
          height={comfortRect.h}
          fill={STATUS_COLOR.ok}
          fillOpacity="0.12"
          stroke={STATUS_COLOR.ok}
          strokeOpacity="0.5"
          strokeDasharray="4 3"
        />
        <text
          x={comfortRect.x + comfortRect.w / 2}
          y={comfortRect.y + comfortRect.h / 2 + 4}
          textAnchor="middle"
          fontSize="13"
          fill={STATUS_COLOR.ok}
          opacity="0.85"
          fontWeight="600"
        >
          Zone de confort
        </text>

        {/* Courbes de danger en trait plein */}
        {curves && (
          <>
            <path d={polylineD(curves.condensation, s)} fill="none" stroke={STATUS_COLOR.condensation} strokeWidth="2" />
            <path d={polylineD(curves.moldRisk, s)} fill="none" stroke={STATUS_COLOR.mold_risk} strokeWidth="2" strokeDasharray="6 3" />
          </>
        )}

        {/* Gridlines + ticks X */}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line
              x1={tempToX(t)}
              x2={tempToX(t)}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_H}
              stroke="rgba(255,255,255,0.04)"
            />
            <text x={tempToX(t)} y={MARGIN.top + PLOT_H + 18} textAnchor="middle" fontSize="11" fill="#64748b">{t}°C</text>
          </g>
        ))}
        {yTicks.map((rh) => (
          <g key={`y${rh}`}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + PLOT_W}
              y1={rhToY(rh)}
              y2={rhToY(rh)}
              stroke="rgba(255,255,255,0.04)"
            />
            <text x={MARGIN.left - 8} y={rhToY(rh) + 4} textAnchor="end" fontSize="11" fill="#64748b">{rh}%</text>
          </g>
        ))}

        {/* Axis labels */}
        <text x={MARGIN.left + PLOT_W / 2} y={CHART_H - 6} textAnchor="middle" fontSize="12" fill="#94a3b8">Temperature interieure (°C)</text>
        <text
          x={-(MARGIN.top + PLOT_H / 2)}
          y={14}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize="12"
          fill="#94a3b8"
        >Humidite relative (%)</text>

        {/* Pieces */}
        {rooms.map((r, i) => {
          if (!Number.isFinite(r.tIntC) || !Number.isFinite(r.rhPct)) return null;
          const p = clampPoint(r.tIntC, r.rhPct, b);
          const dotColor = STATUS_COLOR[r.status] || '#94a3b8';
          return (
            <g key={i}>
              <circle
                cx={tempToX(p.t)}
                cy={rhToY(p.rh)}
                r={9}
                fill={dotColor}
                stroke="#0f0f1a"
                strokeWidth="2"
              />
              <text
                x={tempToX(p.t)}
                y={rhToY(p.rh) - 14}
                textAnchor="middle"
                fontSize="11"
                fill="#f1f5f9"
                fontWeight="600"
                style={{ paintOrder: 'stroke', stroke: '#0d0d1a', strokeWidth: 3 }}
              >
                {r.name}
              </text>
            </g>
          );
        })}

        {/* Simulateur */}
        {simulator && Number.isFinite(simulator.tIntC) && Number.isFinite(simulator.rhPct) && (
          <g>
            <circle
              cx={tempToX(clampPoint(simulator.tIntC, simulator.rhPct, b).t)}
              cy={rhToY(clampPoint(simulator.tIntC, simulator.rhPct, b).rh)}
              r={11}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.5"
            />
            <circle
              cx={tempToX(clampPoint(simulator.tIntC, simulator.rhPct, b).t)}
              cy={rhToY(clampPoint(simulator.tIntC, simulator.rhPct, b).rh)}
              r={4}
              fill="#fbbf24"
            />
          </g>
        )}
      </svg>

      {/* Legende */}
      <div className="cc-legend">
        <span className="cc-legend-item">
          <span className="cc-swatch" style={{ background: STATUS_COLOR.condensation, opacity: 0.55 }} />
          Condensation sur le mur
        </span>
        <span className="cc-legend-item">
          <span className="cc-swatch" style={{ background: STATUS_COLOR.mold_risk, opacity: 0.45 }} />
          Risque moisissure
        </span>
        <span className="cc-legend-item">
          <span className="cc-swatch cc-swatch-stroke" style={{ borderColor: STATUS_COLOR.ok }} />
          Confort optimal
        </span>
        {simulator && (
          <span className="cc-legend-item">
            <span className="cc-swatch cc-swatch-stroke" style={{ borderColor: '#fbbf24' }} />
            Simulateur
          </span>
        )}
      </div>
    </div>
  );
}
