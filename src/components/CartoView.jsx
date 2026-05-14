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

export default function CartoView({ onClose }) {
  const { campaign } = useCampaign();
  const [mapData, setMapData] = useState(null);
  const [appliancesByPlug, setAppliancesByPlug] = useState({});
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedPlug, setSelectedPlug] = useState(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  const containerRef = useRef(null);
  const fgRef = useRef(null);

  /* ── Fetch /api/map + per-plug appliances ──────────────── */
  const fetchData = useCallback(async () => {
    try {
      const mapRes = await api.get('/api/map');
      const rooms = mapRes.data || [];
      setMapData(rooms);

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

  /* ── Build the graph ───────────────────────────────────── */
  const graphData = useMemo(() => {
    if (!mapData) return { nodes: [], links: [] };

    const householdName = campaign?.household || 'Foyer';
    const totalW = mapData.reduce((s, r) => s + (r.total_w || 0), 0);

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

    mapData.forEach((room) => {
      const roomColor = room.color || '#475569';
      nodes.push({
        id: `room-${room.id}`,
        type: 'room',
        label: room.name,
        color: roomColor,
        size: 20,
        room,
        power_w: room.total_w || 0,
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
  }, [mapData, appliancesByPlug, campaign]);

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

    return { title, subtitle, power_w: hoveredNode.power_w, pct };
  }, [hoveredNode, totalPower]);

  /* ── Custom node rendering ─────────────────────────────── */
  const nodeCanvasObject = useCallback(
    (node, ctx, globalScale) => {
      const fontSize = Math.max(10, 12 / globalScale);
      const isHovered = hoveredNode && hoveredNode.id === node.id;

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

      // Label below
      const label = node.label || '';
      if (label && globalScale > 0.5) {
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
        if (
          (node.type === 'plug' || node.type === 'room') &&
          node.power_w > 0
        ) {
          ctx.fillStyle = ACCENT;
          ctx.fillText(
            `${node.power_w.toFixed(0)} W`,
            node.x,
            y + h + 1
          );
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
          <span className="carto-title-icon">🗺️</span>
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
          <span className="carto-dot" style={{ background: '#22c55e' }} />
          Pieces
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
            cooldownTicks={120}
            warmupTicks={50}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            nodeRelSize={4}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkCanvasObject={linkCanvasObject}
            linkCanvasObjectMode={() => 'replace'}
            onNodeClick={handleNodeClick}
            onNodeHover={(n) => setHoveredNode(n || null)}
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
