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

const T_MIN = 5;
const T_MAX = 30;
const RH_MIN = 0;
const RH_MAX = 100;

const CHART_W = 820;
const CHART_H = 460;
const MARGIN = { top: 24, right: 24, bottom: 44, left: 56 };

const PLOT_W = CHART_W - MARGIN.left - MARGIN.right;
const PLOT_H = CHART_H - MARGIN.top - MARGIN.bottom;

const tempToX = (t) => MARGIN.left + ((t - T_MIN) / (T_MAX - T_MIN)) * PLOT_W;
const rhToY = (rh) => MARGIN.top + ((RH_MAX - rh) / (RH_MAX - RH_MIN)) * PLOT_H;

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
function buildDangerCurves(outdoorTempC) {
  if (!Number.isFinite(outdoorTempC)) return null;
  const tExtAdj = adjustOutdoor(outdoorTempC);
  const condensation = [];
  const moldRisk = [];
  for (let t = T_MIN; t <= T_MAX + 0.001; t += 0.5) {
    const tSi = wallSurfaceTempC(t, tExtAdj);
    condensation.push({ t, rh: rhAtDewPoint(t, tSi) });
    moldRisk.push({ t, rh: rhAtDewPoint(t, tSi - COMFORT_CONFIG.condensation.mold_margin_c) });
  }
  return { condensation, moldRisk, tExtAdj };
}

function polylineD(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${tempToX(p.t).toFixed(1)} ${rhToY(p.rh).toFixed(1)}`).join(' ');
}

function zonePath(curve, fillToTop) {
  // Polyline le long de la courbe, puis ferme vers le haut (RH=100) ou bas
  const pts = curve.map((p) => `${tempToX(p.t).toFixed(1)},${rhToY(p.rh).toFixed(1)}`);
  if (fillToTop) {
    return `M ${pts.join(' L ')} L ${tempToX(T_MAX).toFixed(1)},${rhToY(RH_MAX).toFixed(1)} L ${tempToX(T_MIN).toFixed(1)},${rhToY(RH_MAX).toFixed(1)} Z`;
  }
  return `M ${pts.join(' L ')} L ${tempToX(T_MAX).toFixed(1)},${rhToY(RH_MIN).toFixed(1)} L ${tempToX(T_MIN).toFixed(1)},${rhToY(RH_MIN).toFixed(1)} Z`;
}

function clampPoint(t, rh) {
  return {
    t: Math.max(T_MIN, Math.min(T_MAX, t)),
    rh: Math.max(RH_MIN, Math.min(RH_MAX, rh)),
  };
}

/**
 * Props :
 *   outdoorTempC : temperature exterieure brute pour calculer les zones de danger
 *   rooms        : [{ name, tIntC, rhPct, status, color }]
 *   simulator    : { tIntC, rhPct } | null — point interactif
 *   onChartClick : (tIntC, rhPct) => void — pour repositionner le simulateur
 */
export default function ComfortChart({ outdoorTempC, rooms = [], simulator, onChartClick }) {
  const curves = useMemo(() => buildDangerCurves(outdoorTempC), [outdoorTempC]);

  // Comfort rectangle: T in [min,max], RH in [min,max]
  const cT = COMFORT_CONFIG.temperature;
  const cH = COMFORT_CONFIG.humidity;
  const comfortRect = {
    x: tempToX(cT.min_c),
    y: rhToY(cH.max_pct),
    w: tempToX(cT.max_c) - tempToX(cT.min_c),
    h: rhToY(cH.min_pct) - rhToY(cH.max_pct),
  };

  // Gridlines
  const xTicks = [];
  for (let t = T_MIN; t <= T_MAX; t += 5) xTicks.push(t);
  const yTicks = [];
  for (let rh = 0; rh <= 100; rh += 20) yTicks.push(rh);

  const handleSvgClick = (e) => {
    if (!onChartClick) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(svg.getScreenCTM().inverse());
    if (local.x < MARGIN.left || local.x > MARGIN.left + PLOT_W) return;
    if (local.y < MARGIN.top || local.y > MARGIN.top + PLOT_H) return;
    const t = T_MIN + ((local.x - MARGIN.left) / PLOT_W) * (T_MAX - T_MIN);
    const rh = RH_MAX - ((local.y - MARGIN.top) / PLOT_H) * (RH_MAX - RH_MIN);
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
            <path d={zonePath(curves.condensation, true)} fill={STATUS_COLOR.condensation} fillOpacity="0.18" />
            <path d={zonePath(curves.moldRisk, true)} fill={STATUS_COLOR.mold_risk} fillOpacity="0.14" />
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
            <path d={polylineD(curves.condensation)} fill="none" stroke={STATUS_COLOR.condensation} strokeWidth="2" />
            <path d={polylineD(curves.moldRisk)} fill="none" stroke={STATUS_COLOR.mold_risk} strokeWidth="2" strokeDasharray="6 3" />
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
          const p = clampPoint(r.tIntC, r.rhPct);
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
              cx={tempToX(clampPoint(simulator.tIntC, simulator.rhPct).t)}
              cy={rhToY(clampPoint(simulator.tIntC, simulator.rhPct).rh)}
              r={11}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.5"
            />
            <circle
              cx={tempToX(clampPoint(simulator.tIntC, simulator.rhPct).t)}
              cy={rhToY(clampPoint(simulator.tIntC, simulator.rhPct).rh)}
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
