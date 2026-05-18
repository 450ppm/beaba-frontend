import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './RoomEditModal.css';

const PALETTE = [
  '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#06b6d4',
  '#8b5cf6', '#ec4899', '#f97316', '#84cc16', '#64748b',
];

export default function RoomEditModal({ room, onClose, onSaved }) {
  const [name, setName] = useState(room?.name || '');
  const [color, setColor] = useState(room?.color || '#64748b');
  const [tempSensors, setTempSensors] = useState([]);
  const [co2Sensors, setCo2Sensors] = useState([]);
  const [plugs, setPlugs] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [tRes, cRes, pRes, rRes] = await Promise.all([
        api.get('/api/sensors/temp').catch(() => ({ data: [] })),
        api.get('/api/sensors/co2').catch(() => ({ data: [] })),
        api.get('/api/plugs').catch(() => ({ data: [] })),
        api.get('/api/rooms').catch(() => ({ data: [] })),
      ]);
      setTempSensors(tRes.data || []);
      setCo2Sensors(cRes.data || []);
      setPlugs(pRes.data || []);
      setRooms(rRes.data || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveRoom = async () => {
    setSaving(true);
    try {
      await api.put(`/api/rooms/${room.id}`, { name: name.trim() || room.name, color });
      onSaved?.();
    } catch { /* empty */ }
    setSaving(false);
  };

  const assignTemp = async (sensorId, roomId) => {
    await api.put(`/api/sensors/temp/${sensorId}`, { room_id: roomId });
    fetchAll(); onSaved?.();
  };
  const assignCo2 = async (sensorId, roomId) => {
    await api.put(`/api/sensors/co2/${sensorId}`, { room_id: roomId });
    fetchAll(); onSaved?.();
  };
  const assignPlug = async (plugId, roomId) => {
    await api.put(`/api/plugs/${plugId}`, { room_id: roomId });
    fetchAll(); onSaved?.();
  };

  if (!room) return null;

  const RoomSelect = ({ value, onChange }) => (
    <select
      className="rem-select"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— Aucune pièce —</option>
      {rooms.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}{r.id === room.id ? ' (cette pièce)' : ''}
        </option>
      ))}
    </select>
  );

  const inThisRoom = (list) => list.filter((x) => x.room_id === room.id);
  const others = (list) => list.filter((x) => x.room_id !== room.id);

  return (
    <div className="rem-overlay" onClick={(e) => e.target.classList.contains('rem-overlay') && onClose?.()}>
      <div className="rem-modal" role="dialog" aria-modal="true">
        <button className="rem-close" onClick={onClose} aria-label="Fermer">×</button>

        {/* Propriétés pièce */}
        <h3>Éditer la pièce</h3>
        <div className="rem-props">
          <label className="rem-field">
            <span>Nom</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de la pièce"
            />
          </label>
          <div className="rem-field">
            <span>Couleur</span>
            <div className="rem-palette">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`rem-swatch ${color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <button className="rem-btn-primary" onClick={saveRoom} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer la pièce'}
          </button>
        </div>

        {loading ? (
          <p className="rem-loading">Chargement des capteurs et prises…</p>
        ) : (
          <>
            {/* Capteurs T°/HR */}
            <Section title="Capteurs température / humidité">
              {inThisRoom(tempSensors).map((s) => (
                <Row key={s.id} label={s.name} sub="dans cette pièce">
                  <RoomSelect value={s.room_id} onChange={(rid) => assignTemp(s.id, rid)} />
                </Row>
              ))}
              {others(tempSensors).length > 0 && (
                <p className="rem-add-hint">Ajouter un capteur d'une autre pièce :</p>
              )}
              {others(tempSensors).map((s) => (
                <Row key={s.id} label={s.name} sub={s.room_id ? 'autre pièce' : 'non assigné'} muted>
                  <button className="rem-btn-add" onClick={() => assignTemp(s.id, room.id)}>
                    + Ajouter ici
                  </button>
                </Row>
              ))}
              {tempSensors.length === 0 && <p className="rem-empty">Aucun capteur température.</p>}
            </Section>

            {/* Capteurs CO2 */}
            <Section title="Capteurs CO₂">
              {inThisRoom(co2Sensors).map((s) => (
                <Row key={s.id} label={s.name} sub="dans cette pièce">
                  <RoomSelect value={s.room_id} onChange={(rid) => assignCo2(s.id, rid)} />
                </Row>
              ))}
              {others(co2Sensors).map((s) => (
                <Row key={s.id} label={s.name} sub={s.room_id ? 'autre pièce' : 'non assigné'} muted>
                  <button className="rem-btn-add" onClick={() => assignCo2(s.id, room.id)}>
                    + Ajouter ici
                  </button>
                </Row>
              ))}
              {co2Sensors.length === 0 && <p className="rem-empty">Aucun capteur CO₂.</p>}
            </Section>

            {/* Prises */}
            <Section title="Prises">
              {inThisRoom(plugs).map((p) => (
                <Row key={p.id} label={p.appliance_name || 'Prise'} sub={p.is_multiprise ? 'multiprise' : 'dans cette pièce'}>
                  <RoomSelect value={p.room_id} onChange={(rid) => assignPlug(p.id, rid)} />
                </Row>
              ))}
              {others(plugs).length > 0 && (
                <p className="rem-add-hint">Ajouter une prise d'une autre pièce :</p>
              )}
              {others(plugs).map((p) => (
                <Row key={p.id} label={p.appliance_name || 'Prise'} sub={p.room_id ? 'autre pièce' : 'non assignée'} muted>
                  <button className="rem-btn-add" onClick={() => assignPlug(p.id, room.id)}>
                    + Ajouter ici
                  </button>
                </Row>
              ))}
              {plugs.length === 0 && <p className="rem-empty">Aucune prise.</p>}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rem-section">
      <h4>{title}</h4>
      <div className="rem-rows">{children}</div>
    </div>
  );
}

function Row({ label, sub, muted, children }) {
  return (
    <div className={`rem-row ${muted ? 'muted' : ''}`}>
      <div className="rem-row-label">
        <strong>{label}</strong>
        {sub && <span>{sub}</span>}
      </div>
      <div className="rem-row-action">{children}</div>
    </div>
  );
}
