import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import PlugDetailModal from './PlugDetailModal';
import { categoryIcon } from './applianceCategories';
import './ApplianceList.css';

export default function ApplianceList({ powerData }) {
  const [selectedPlug, setSelectedPlug] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [plugs, setPlugs] = useState([]);
  // Map plug_id -> liste d'appareils (pour afficher l'icone principale)
  const [appliancesByPlug, setAppliancesByPlug] = useState({});

  const fetchSidecar = useCallback(async () => {
    try {
      const [roomRes, plugRes] = await Promise.all([
        api.get('/api/rooms'),
        api.get('/api/plugs'),
      ]);
      setRooms(roomRes.data);
      setPlugs(plugRes.data);

      // Recupere les appareils de chaque prise en parallele
      const entries = await Promise.all(
        plugRes.data.map(async (p) => {
          try {
            const r = await api.get(`/api/plugs/${p.id}/appliances`);
            return [p.id, r.data];
          } catch {
            return [p.id, []];
          }
        })
      );
      setAppliancesByPlug(Object.fromEntries(entries));
    } catch { /* empty */ }
  }, []);

  useEffect(() => {
    fetchSidecar();
  }, [fetchSidecar]);

  if (!powerData || !powerData.length) {
    return (
      <div className="appliance-panel">
        <h3 className="panel-title">Appareils</h3>
        <p className="panel-empty">En attente des donnees...</p>
      </div>
    );
  }

  const sorted = [...powerData].sort((a, b) => (b.power_w || 0) - (a.power_w || 0));
  const maxPower = Math.max(...sorted.map((p) => p.power_w || 0), 1);
  const topId = sorted[0]?.plug_id;

  const openModal = (plugRow) => {
    // Combine la donnee de readings (avec power_w) et la donnee de plugs (avec is_multiprise complet)
    const plug = plugs.find((p) => p.id === plugRow.plug_id) || {
      id: plugRow.plug_id,
      appliance_name: plugRow.appliance_name,
      room_id: plugRow.room_id,
      is_multiprise: plugRow.is_multiprise,
    };
    const room = rooms.find((r) => r.id === plug.room_id);
    setSelectedPlug({ plug, room });
  };

  return (
    <>
      <div className="appliance-panel">
        <h3 className="panel-title">Appareils</h3>
        <div className="appliance-list">
          {sorted.map((row) => {
            const isActive = (row.power_w || 0) > 1;
            const isTop = row.plug_id === topId && isActive;
            const pct = maxPower > 0 ? ((row.power_w || 0) / maxPower) * 100 : 0;
            const apps = appliancesByPlug[row.plug_id] || [];
            const isMulti = row.is_multiprise || apps.length > 1;
            // Icone : multiprise > 1ere categorie > prise generique
            const icon = isMulti ? '🔌' : categoryIcon(apps[0]?.category);

            return (
              <button
                key={row.plug_id}
                type="button"
                className={`appliance-row ${isTop ? 'top-consumer' : ''}`}
                onClick={() => openModal(row)}
                aria-label={`Configurer ${row.appliance_name}`}
              >
                <span className={`appliance-dot ${isActive ? 'on' : 'off'}`} />
                <span className="appliance-icon-cell">{icon}</span>
                <span className="appliance-name">
                  {row.appliance_name}
                  {isMulti && apps.length > 0 && (
                    <small className="appliance-multi-count">
                      {' '}({apps.length} appareil{apps.length > 1 ? 's' : ''})
                    </small>
                  )}
                </span>
                <span className="appliance-power">
                  {(row.power_w || 0).toFixed(1)} <small>W</small>
                </span>
                <div className="appliance-bar-track">
                  <div
                    className="appliance-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: isActive ? '#f59e0b' : '#2a2a3a',
                    }}
                  />
                </div>
                <span className="appliance-chevron">›</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedPlug && (
        <PlugDetailModal
          plug={selectedPlug.plug}
          room={selectedPlug.room}
          onClose={() => setSelectedPlug(null)}
          onUpdated={fetchSidecar}
        />
      )}
    </>
  );
}
