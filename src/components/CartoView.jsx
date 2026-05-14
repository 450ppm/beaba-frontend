import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import api from '../api';
import { useCampaign } from '../context/CampaignContext';
import { categoryIcon } from './applianceCategories';
import PlugDetailModal from './PlugDetailModal';
import './CartoView.css';

const ACCENT = '#f59e0b';
const HOUSEHOLD_COLOR = '#f59e0b';
const PLUG_COLOR = '#64748b';
const PLUG_ACTIVE_COLOR = '#3b82f6';
const APPLIANCE_COLOR = '#475569';
const BG_COLOR = '#0d0d1a';

function plugSizeFromPower(w) {
  // small if 0, larger if 1000+
  const safe = Math.max(0, w || 0);
  return Math.max(10, Math.min(22, 10 + Math.log10(1 + safe) * 4));
}

function roomIconFromName(name) {
  if (!name) return '🏠';
  const n = name.toLowerCase();
  if (/salon|s[eé]jour|living/.test(n)) return '🛋️';
  if (/cuisine|kitchen/.test(n)) return '🍳';
  if (/salle.{0,3}(à|a).{0,3}manger|dining/.test(n)) return '🍽️';
  if (/chambre|bedroom/.test(n)) return '🛏️';
  if (/salle.{0,3}de.{0,3}bain|sdb|douche|bath/.test(n)) return '🛁';
  if (/wc|toilette/.test(n)) return '🚽';
  if (/bureau|office/.test(n)) return '💼';
  if (/buanderie|laundry|lingerie/.test(n)) return '🧺';
  if (/entr[eé]e|hall|couloir/.test(n)) return '🚪';
  if (/garage|parking/.test(n)) return '🚗';
  if (/cave|cellar/.test(n)) return '🪜';
  if (/grenier|attic/.test(n)) return '📦';
  if (/terrasse|balcon|jardin|garden/.test(n)) return '🌳';
  if (/enfant|kid/.test(n)) return '🧸';
  return '🏠';
}

export default function CartoView({ onClose }) {
  const { campaign } = useCampaign();
  const [mapData, setMapData] = useState(null);
  const [appliancesByPlug, setAppliancesByPlug] = useState({});
  const [tempData, setTempData] = useState([]);
  const [dailyPower, setDailyPower] = useState([]);
  const [mode, setMode] = useState('instant'); // 'instant' | 'avg'
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedPlug, setSelectedPlug] = useState(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  const containerRef = useRef(null);
  const fgRef = useRef(null);

  /* ── Fetch /api/map + per-plug appliances + temp + power daily ── */
  const fetchData = useCallback(async () => {
    try {
      const [mapRes, tempRes, dailyRes] = await Promise.all([
        api.get('/api/map'),
        api.get('/api/readings/temp').catch(() => ({ data: [] })),
        api.get('/api/readings/power/daily').catch(() => ({ data: [] })),
      ]);
      const rooms = mapRes.data || [];
      setMapData(rooms);
      setTempData(tempRes.data || []);
      setDailyPower(dailyRes.data || []);

      const allPlugs = rooms.flatMap((r) => r.plugs || []);
      const entries = await Promise.all(
        allPlugs.map(async (p) => {
          try {
            const r = await api.get(`/api/plugs/${p.id}/appliances`);
            return [p.id, r.data];
          } catch {
            return [p.id, []];
          }
        })
      );
      setAppliancesByPlug(Object.fromEntries(entries));
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── ResizeObserver for the graph container ────────────── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(320, Math.floor(rect.height)),
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── ESC to close ──────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !selectedPlug) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, selectedPlug]);

  /* ── Aggregations per room ─────────────────────────────── */
  const roomTempMap = useMemo(() => {
    const map = {};
    (tempData || []).forEach((s) => {
      if (!s.room_id) return;
      if (!map[s.room_id]) map[s.room_id] = { temps: [], hums: [] };
      if (s.temperature_c != null) map[s.room_id].temps.push(s.temperature_c);
      if (s.humidity_pct != null) map[s.room_id].hums.push(s.humidity_pct);
    });
    const result = {};
    Object.entries(map).forEach(([roomId, v]) => {
      const avgT = v.temps.length ? v.temps.reduce((a, b) => a + b, 0) / v.temps.length : null;
      const avgH = v.hums.length ? v.hums.reduce((a, b) => a + b, 0) / v.hums.length : null;
      result[roomId] = { temp: avgT, hum: avgH };
    });
    return result;
  }, [tempData]);

  // Average daily kWh per plug → per room. dailyPower = [{date, plugs: [{plug_id, kwh, ...}], total_kwh}]
  const avgWByRoom = useMemo(() => {
    if (!mapData || !dailyPower.length) return {};
    // Sum kWh per plug across all days, count days
    const plugKwh = {};
    const dayCount = dailyPower.length || 1;
    dailyPower.forEach((d) => {
      (d.plugs || []).forEach((p) => {
        plugKwh[p.plug_id] = (plugKwh[p.plug_id] || 0) + (p.kwh || 0);
      });
    });
    // Avg W = (total kWh / days) * 1000 / 24
    const avgWPerPlug = {};
    Object.entries(plugKwh).forEach(([pid, kwh]) => {
      avgWPerPlug[pid] = (kwh / dayCount) * 1000 / 24;
    });
    // Sum per room
    const result = {};
    mapData.forEach((room) => {
      const sum = (room.plugs || []).reduce((s, p) => s + (avgWPerPlug[p.id] || 0), 0);
      result[room.id] = { totalW: sum, perPlug: avgWPerPlug };
    });
    return result;
  }, [dailyPower, mapData]);

  function isComfort(temp) {
    if (temp == null) return null;
    return temp >= 19 && temp <= 24;
  }

  /* ── Build the graph ───────────────────────────────────── */
  const graphData = useMemo(() => {
    if (!mapData) return { nodes: [], links: [] };

    const householdName = campaign?.household || 'Foyer';
    const totalW = mode === 'avg'
      ? mapData.reduce((s, r) => s + (avgWByRoom[r.id]?.totalW || 0), 0)
      : mapData.reduce((s, r) => s + (r.total_w || 0), 0);

    const nodes = [];
    const links = [];

    nodes.push({
      id: 'household',
      type: 'household',
      label: householdName,
      icon: '🏠',
      color: HOUSEHOLD_COLOR,
      size: 30,
      power_w: totalW,
    });

    // Compute room sizes proportional to power
    const roomPowers = mapData.map((r) =>
      mode === 'avg' ? (avgWByRoom[r.id]?.totalW || 0) : (r.total_w || 0)
    );
    const maxRoomW = Math.max(1, ...roomPowers);

    mapData.forEach((room, idx) => {
      const roomColor = room.color || '#475569';
      const roomW = roomPowers[idx];
      // Size varies from 18 (no power) to 42 (max consumer)
      const roomSize = 18 + (roomW / maxRoomW) * 24;

      const tempInfo = roomTempMap[room.id] || {};
      const co2_ppm = room.co2?.co2_ppm;

      // Build comfort reasoning
      const reasons = [];
      let comfortOk = true;
      let comfortUnknown = true;

      if (tempInfo.temp != null) {
        comfortUnknown = false;
        if (tempInfo.temp < 19) {
          reasons.push({ icon: '🥶', status: 'bad', text: `Trop froid : ${tempInfo.temp.toFixed(1)}°C (confort 19-24°C)` });
          comfortOk = false;
        } else if (tempInfo.temp > 24) {
          reasons.push({ icon: '🥵', status: 'bad', text: `Trop chaud : ${tempInfo.temp.toFixed(1)}°C (confort 19-24°C)` });
          comfortOk = false;
        } else {
          reasons.push({ icon: '🌡️', status: 'good', text: `Température : ${tempInfo.temp.toFixed(1)}°C` });
        }
      }

      if (tempInfo.hum != null) {
        comfortUnknown = false;
        if (tempInfo.hum < 40) {
          reasons.push({ icon: '🏜️', status: 'warn', text: `Air sec : ${tempInfo.hum.toFixed(0)}% HR (confort 40-60%)` });
          comfortOk = false;
        } else if (tempInfo.hum > 60) {
          reasons.push({ icon: '💧', status: 'warn', text: `Air humide : ${tempInfo.hum.toFixed(0)}% HR (confort 40-60%)` });
          comfortOk = false;
        } else {
          reasons.push({ icon: '💧', status: 'good', text: `Humidité : ${tempInfo.hum.toFixed(0)}% HR` });
        }
      }

      if (co2_ppm != null) {
        comfortUnknown = false;
        if (co2_ppm > 1200) {
          reasons.push({ icon: '🌬️', status: 'bad', text: `CO2 élevé : ${co2_ppm} ppm — aérer la pièce` });
          comfortOk = false;
        } else if (co2_ppm > 800) {
          reasons.push({ icon: '🌬️', status: 'warn', text: `CO2 moyen : ${co2_ppm} ppm` });
        } else {
          reasons.push({ icon: '🌬️', status: 'good', text: `Air sain : ${co2_ppm} ppm CO2` });
        }
      }

      let ringColor = null;
      if (!comfortUnknown) {
        ringColor = comfortOk ? '#10b981' : '#ef4444';
      }

      nodes.push({
        id: `room-${room.id}`,
        type: 'room',
        label: room.name,
        icon: roomIconFromName(room.name),
        color: roomColor,
        size: roomSize,
        ringColor,
        temp: tempInfo.temp,
        hum: tempInfo.hum,
        co2: co2_ppm,
        reasons,
        comfortOk,
        comfortUnknown,
        room,
        power_w: roomW,
      });

      links.push({
        source: 'household',
        target: `room-${room.id}`,
        color: 'rgba(255,255,255,0.15)',
        width: 1,
      });

      (room.plugs || []).forEach((p) => {
        const powerW = p.power_w || 0;
        const isActive = powerW > 1;
        nodes.push({
          id: `plug-${p.id}`,
          type: 'plug',
          label: p.appliance_name || 'Prise',
          color: isActive ? PLUG_ACTIVE_COLOR : PLUG_COLOR,
          size: plugSizeFromPower(powerW),
          icon: p.is_multiprise ? '🔌' : null,
          plug: p,
          room,
          power_w: powerW,
        });

        links.push({
          source: `room-${room.id}`,
          target: `plug-${p.id}`,
          color: isActive
            ? hexToRgba(roomColor, 0.75)
            : hexToRgba(roomColor, 0.35),
          width: isActive ? 2.2 : 1,
        });

        const apps = appliancesByPlug[p.id] || [];
        apps.forEach((a) => {
          nodes.push({
            id: `appliance-${a.id}`,
            type: 'appliance',
            label: a.name || 'Appareil',
            color: APPLIANCE_COLOR,
            size: 12,
            icon: categoryIcon(a.category),
            plug: p,
            room,
            appliance: a,
            power_w: a.rated_power_w || 0,
          });

          links.push({
            source: `plug-${p.id}`,
            target: `appliance-${a.id}`,
            color: 'rgba(255,255,255,0.18)',
            width: 1,
            dashed: true,
          });
        });
      });
    });

    return { nodes, links, totalW };
  }, [mapData, appliancesByPlug, campaign, mode, avgWByRoom, roomTempMap]);

  // Tune force-graph layout for better spacing
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || loading) return;
    try {
      fg.d3Force('charge')?.strength(-600).distanceMax(800);
      fg.d3Force('link')?.distance((link) => {
        const s = typeof link.source === 'object' ? link.source : null;
        const t = typeof link.target === 'object' ? link.target : null;
        const sType = s?.type;
        const tType = t?.type;
        if (sType === 'household' || tType === 'household') return 200;
        if (sType === 'room' || tType === 'room') return 130;
        return 70;
      });
      fg.d3Force('center')?.strength(0.04);
      fg.d3ReheatSimulation?.();
    } catch { /* ignore */ }
  }, [loading, graphData.nodes.length]);

  const totalPower = graphData.totalW || 0;

  /* ── Node click → open PlugDetailModal ─────────────────── */
  const handleNodeClick = (node) => {
    if (node.type === 'plug' || node.type === 'appliance') {
      setSelectedPlug({ plug: node.plug, room: node.room });
    }
  };

  /* ── Tooltip ───────────────────────────────────────────── */
  const tooltip = useMemo(() => {
    if (!hoveredNode) return null;
    const pct =
      totalPower > 0 && hoveredNode.power_w
        ? ((hoveredNode.power_w / totalPower) * 100).toFixed(1)
        : null;

    let title = hoveredNode.label;
    let subtitle = null;
    if (hoveredNode.type === 'household') {
      subtitle = 'Foyer';
    } else if (hoveredNode.type === 'room') {
      subtitle = 'Piece';
    } else if (hoveredNode.type === 'plug') {
      subtitle = `Prise${hoveredNode.plug?.is_multiprise ? ' (multiprise)' : ''}`;
    } else if (hoveredNode.type === 'appliance') {
      subtitle = `Appareil — ${hoveredNode.room?.name || ''}`;
    }

    return {
      title,
      subtitle,
      power_w: hoveredNode.power_w,
      pct,
      reasons: hoveredNode.type === 'room' ? hoveredNode.reasons : null,
      comfortOk: hoveredNode.type === 'room' ? hoveredNode.comfortOk : null,
      comfortUnknown: hoveredNode.type === 'room' ? hoveredNode.comfortUnknown : null,
    };
  }, [hoveredNode, totalPower]);

  /* ── Custom node rendering ─────────────────────────────── */
  const nodeCanvasObject = useCallback(
    (node, ctx, globalScale) => {
      const fontSize = Math.max(10, 12 / globalScale);
      const isHovered = hoveredNode && hoveredNode.id === node.id;

      // Skip render if coords or size not yet computed by force engine
      if (
        !Number.isFinite(node.x) ||
        !Number.isFinite(node.y) ||
        !Number.isFinite(node.size) ||
        node.size <= 0
      ) {
        return;
      }

      // Glow ring for active plug
      if (node.type === 'plug' && node.power_w > 1) {
        const grad = ctx.createRadialGradient(
          node.x,
          node.y,
          node.size,
          node.x,
          node.y,
          node.size * 2.2
        );
        grad.addColorStop(0, hexToRgba(node.color, 0.35));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size * 2.2, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Comfort ring for rooms (drawn behind main circle)
      if (node.type === 'room' && node.ringColor) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size + 5, 0, 2 * Math.PI);
        ctx.lineWidth = 3;
        ctx.strokeStyle = node.ringColor;
        ctx.stroke();
      }

      // Main circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Border
      ctx.lineWidth = isHovered ? 2.5 : 1;
      ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255,255,255,0.25)';
      ctx.stroke();

      // Inner icon / emoji
      if (node.icon) {
        ctx.font = `${node.size * 1.1}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.icon, node.x, node.y);
      }

      // Label below — hide if zoom too low except for key nodes
      const label = node.label || '';
      const showLabel =
        label && (
          isHovered ||
          node.type === 'household' ||
          node.type === 'room' ||
          (node.type === 'plug' && (globalScale > 0.85 || node.power_w > 1)) ||
          (node.type === 'appliance' && globalScale > 1.1)
        );
      if (showLabel) {
        ctx.font = `${fontSize}px Inter, Sans-Serif`;
        ctx.fillStyle = '#e5e7eb';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const y = node.y + node.size + 4;

        // background pill for readability
        const padX = 4;
        const w = ctx.measureText(label).width + padX * 2;
        const h = fontSize + 4;
        ctx.fillStyle = 'rgba(13,13,26,0.7)';
        roundRect(ctx, node.x - w / 2, y - 2, w, h, 4);
        ctx.fill();

        ctx.fillStyle = '#e5e7eb';
        ctx.fillText(label, node.x, y);

        // Watt line for plugs and rooms
        let extraY = y + h + 1;
        if (
          (node.type === 'plug' || node.type === 'room') &&
          node.power_w > 0
        ) {
          ctx.fillStyle = ACCENT;
          ctx.fillText(`${node.power_w.toFixed(0)} W`, node.x, extraY);
          extraY += h - 2;
        }

        // Temp / humidity line for rooms
        if (node.type === 'room' && (node.temp != null || node.hum != null)) {
          const parts = [];
          if (node.temp != null) parts.push(`${node.temp.toFixed(1)}°`);
          if (node.hum != null) parts.push(`${node.hum.toFixed(0)}%`);
          const txt = parts.join('  ');
          ctx.fillStyle = node.ringColor || '#94a3b8';
          ctx.fillText(txt, node.x, extraY);
          extraY += h - 2;
        }

        // CO2 line for rooms — colored by air quality
        if (node.type === 'room' && node.co2 != null) {
          let co2Color = '#10b981'; // green
          if (node.co2 > 1200) co2Color = '#ef4444';
          else if (node.co2 > 800) co2Color = '#f59e0b';
          ctx.fillStyle = co2Color;
          ctx.fillText(`${node.co2} ppm CO2`, node.x, extraY);
        }
      }
    },
    [hoveredNode]
  );

  const nodePointerAreaPaint = useCallback((node, color, ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.size + 6, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  const linkCanvasObject = useCallback((link, ctx) => {
    const s = link.source;
    const t = link.target;
    if (!s || !t || typeof s !== 'object' || typeof t !== 'object') return;

    ctx.beginPath();
    if (link.dashed) {
      ctx.setLineDash([4, 3]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = link.color || 'rgba(255,255,255,0.1)';
    ctx.lineWidth = link.width || 1;
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  return (
    <div className="carto-overlay" role="dialog" aria-modal="true">
      <div className="carto-header">
        <div className="carto-title">
          <img src="/beaba_banner.png" alt="Beaba" className="carto-logo" />
          <div>
            <h2>Carte du logement</h2>
            <p className="carto-subtitle">
              {campaign?.household || 'Foyer'} —{' '}
              <span className="carto-subtitle-accent">
                {totalPower.toFixed(0)} W au total
              </span>
            </p>
          </div>
        </div>
        <div className="carto-header-actions">
          <div className="carto-mode-toggle">
            <button
              type="button"
              className={`carto-mode-btn ${mode === 'instant' ? 'active' : ''}`}
              onClick={() => setMode('instant')}
            >
              Instantané
            </button>
            <button
              type="button"
              className={`carto-mode-btn ${mode === 'avg' ? 'active' : ''}`}
              onClick={() => setMode('avg')}
            >
              Moyenne
            </button>
          </div>
          <button
            type="button"
            className="carto-btn-ghost"
            onClick={() => fgRef.current?.zoomToFit(400, 50)}
          >
            Centrer
          </button>
          <button
            type="button"
            className="carto-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
      </div>

      <div className="carto-legend">
        <span className="carto-legend-item">
          <span className="carto-dot" style={{ background: HOUSEHOLD_COLOR }} />
          Foyer
        </span>
        <span className="carto-legend-item">
          <span className="carto-ring carto-ring-green" />
          Confort OK
        </span>
        <span className="carto-legend-item">
          <span className="carto-ring carto-ring-red" />
          Hors confort
        </span>
        <span className="carto-legend-item">
          <span className="carto-dot" style={{ background: PLUG_ACTIVE_COLOR }} />
          Prises actives
        </span>
        <span className="carto-legend-item">
          <span className="carto-dot" style={{ background: PLUG_COLOR }} />
          Prises au repos
        </span>
        <span className="carto-legend-item">
          <span className="carto-dot" style={{ background: APPLIANCE_COLOR }} />
          Appareils
        </span>
      </div>

      <div className="carto-canvas-wrap" ref={containerRef}>
        {loading ? (
          <div className="carto-loading">
            <div className="carto-spinner" />
            <span>Chargement de la cartographie...</span>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={{ nodes: graphData.nodes, links: graphData.links }}
            width={size.width}
            height={size.height}
            backgroundColor={BG_COLOR}
            cooldownTicks={250}
            warmupTicks={100}
            d3AlphaDecay={0.012}
            d3VelocityDecay={0.45}
            nodeRelSize={4}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkCanvasObject={linkCanvasObject}
            linkCanvasObjectMode={() => 'replace'}
            onNodeClick={handleNodeClick}
            onNodeHover={(n) => setHoveredNode(n || null)}
            onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        )}

        {tooltip && (
          <div className="carto-tooltip">
            <div className="carto-tooltip-title">{tooltip.title}</div>
            {tooltip.subtitle && (
              <div className="carto-tooltip-sub">{tooltip.subtitle}</div>
            )}
            {tooltip.power_w > 0 && (
              <div className="carto-tooltip-power">
                <strong>{tooltip.power_w.toFixed(0)} W</strong>
                {tooltip.pct && (
                  <span className="carto-tooltip-pct">
                    {' '}— {tooltip.pct}% du foyer
                  </span>
                )}
              </div>
            )}
            {tooltip.reasons && tooltip.reasons.length > 0 && (
              <div className="carto-tooltip-reasons">
                <div className={`carto-tooltip-comfort-badge ${tooltip.comfortOk ? 'good' : 'bad'}`}>
                  {tooltip.comfortOk ? '✓ Confort OK' : '⚠ Hors zone de confort'}
                </div>
                <ul>
                  {tooltip.reasons.map((r, i) => (
                    <li key={i} className={`reason-${r.status}`}>
                      <span className="reason-icon">{r.icon}</span>
                      <span>{r.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tooltip.comfortUnknown && tooltip.subtitle === 'Piece' && (
              <div className="carto-tooltip-reasons">
                <div className="carto-tooltip-comfort-badge neutral">
                  Pas encore de mesure
                </div>
              </div>
            )}
          </div>
        )}

        <div className="carto-hint">
          Glisser pour deplacer · Molette pour zoomer · Clic sur une prise ou un appareil pour l'editer
        </div>
      </div>

      {selectedPlug && (
        <PlugDetailModal
          plug={selectedPlug.plug}
          room={selectedPlug.room}
          onClose={() => setSelectedPlug(null)}
          onUpdated={fetchData}
        />
      )}
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────── */

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(100,116,139,${alpha})`;
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
