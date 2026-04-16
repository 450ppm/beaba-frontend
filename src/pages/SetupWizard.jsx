import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useCampaign } from '../context/CampaignContext';
import StepIndicator from '../components/StepIndicator';
import ColorPicker from '../components/ColorPicker';
import './SetupWizard.css';

export default function SetupWizard() {
  const { campaign, refreshCampaign } = useCampaign();
  const [step, setStep] = useState(1);

  return (
    <div className="setup-wizard">
      <div className="setup-header">
        <img src="/beaba_banner.png" alt="Beaba" className="setup-logo" />
        <h1>{campaign?.household_name || 'Configuration'}</h1>
      </div>
      <StepIndicator current={step} />
      <div className="setup-content">
        {step === 1 && <StepRooms onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepTempSensors onNext={() => setStep(3)} onBack={() => setStep(1)} />
        )}
        {step === 3 && (
          <StepPlugs onNext={() => setStep(4)} onBack={() => setStep(2)} />
        )}
        {step === 4 && (
          <StepSummary
            campaignId={campaign?.id}
            refreshCampaign={refreshCampaign}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}

/* ── Step 1: Rooms ─────────────────────────────────────── */
function StepRooms({ onNext }) {
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4A90D9');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await api.get('/api/rooms');
      setRooms(res.data);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const addRoom = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/api/rooms', { name: name.trim(), color });
      setName('');
      await fetchRooms();
    } catch { /* empty */ }
    setSubmitting(false);
  };

  const deleteRoom = async (id) => {
    try {
      await api.delete(`/api/rooms/${id}`);
      await fetchRooms();
    } catch { /* empty */ }
  };

  if (loading) return <div className="setup-loading">Chargement...</div>;

  return (
    <div className="step-panel">
      <h2>Pieces du logement</h2>
      <p className="step-desc">Ajoutez chaque piece ou vous installerez des capteurs.</p>

      <div className="room-list">
        {rooms.map((r) => (
          <div key={r.id} className="room-item">
            <span className="room-dot" style={{ background: r.color }} />
            <span className="room-item-name">{r.name}</span>
            <button
              type="button"
              className="btn-delete"
              onClick={() => deleteRoom(r.id)}
            >
              Supprimer
            </button>
          </div>
        ))}
        {rooms.length === 0 && (
          <p className="empty-hint">Aucune piece ajoutee.</p>
        )}
      </div>

      <form onSubmit={addRoom} className="add-form">
        <input
          type="text"
          placeholder="Nom de la piece"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <ColorPicker value={color} onChange={setColor} />
        <button type="submit" className="btn-secondary" disabled={submitting || !name.trim()}>
          {submitting ? 'Ajout...' : 'Ajouter la piece'}
        </button>
      </form>

      <div className="step-nav">
        <div />
        <button className="btn-primary" onClick={onNext} disabled={rooms.length === 0}>
          Suivant
        </button>
      </div>
    </div>
  );
}

/* ── Step 2: Temperature sensors ───────────────────────── */
function StepTempSensors({ onNext, onBack }) {
  const [zigbeeDevices, setZigbeeDevices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [selections, setSelections] = useState({});
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [devRes, roomRes, sensorRes] = await Promise.all([
        api.get('/api/zigbee/devices'),
        api.get('/api/rooms'),
        api.get('/api/sensors/temp'),
      ]);
      const devices = devRes.data.filter(
        (d) =>
          d.model_id?.includes('SNZB-02P') ||
          d.definition?.model?.includes('SNZB-02P')
      );
      setZigbeeDevices(devices);
      setRooms(roomRes.data);
      setAssigned(sensorRes.data);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const refreshDevices = async () => {
    setRefreshing(true);
    try {
      await api.post('/api/zigbee/devices/refresh');
      // Wait a moment for discovery
      await new Promise((r) => setTimeout(r, 3000));
      await fetchAll();
    } catch { /* empty */ }
    setRefreshing(false);
  };

  const assignSensor = async (device) => {
    const roomId = selections[device.ieee_address];
    if (!roomId) return;
    try {
      await api.post('/api/sensors/temp', {
        id: device.ieee_address,
        friendly_name: device.friendly_name,
        name: device.friendly_name,
        room_id: roomId,
        comment: comments[device.ieee_address] || '',
      });
      await fetchAll();
    } catch { /* empty */ }
  };

  const assignedIds = new Set(assigned.map((s) => s.id));
  const unassigned = zigbeeDevices.filter((d) => !assignedIds.has(d.ieee_address));

  if (loading) return <div className="setup-loading">Chargement...</div>;

  return (
    <div className="step-panel">
      <h2>Capteurs de temperature</h2>
      <p className="step-desc">
        Associez chaque capteur SNZB-02P a une piece.
      </p>

      <button
        type="button"
        className="btn-secondary btn-refresh"
        onClick={refreshDevices}
        disabled={refreshing}
      >
        {refreshing ? 'Recherche...' : 'Rechercher les appareils'}
      </button>

      {assigned.length > 0 && (
        <div className="assigned-section">
          <h3>Capteurs assignes</h3>
          {assigned.map((s) => (
            <div key={s.id} className="assigned-item">
              <span className="assigned-name">{s.friendly_name || s.name}</span>
              <span className="assigned-room">
                {rooms.find((r) => r.id === s.room_id)?.name || '—'}
              </span>
              {s.comment && <span className="assigned-comment">{s.comment}</span>}
            </div>
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="unassigned-section">
          <h3>Capteurs disponibles</h3>
          {unassigned.map((d) => (
            <div key={d.ieee_address} className="device-assign-card">
              <div className="device-name">{d.friendly_name}</div>
              <select
                value={selections[d.ieee_address] || ''}
                onChange={(e) =>
                  setSelections((s) => ({ ...s, [d.ieee_address]: e.target.value }))
                }
              >
                <option value="">-- Piece --</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Commentaire (ex: pres de la fenetre)"
                value={comments[d.ieee_address] || ''}
                onChange={(e) =>
                  setComments((c) => ({ ...c, [d.ieee_address]: e.target.value }))
                }
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => assignSensor(d)}
                disabled={!selections[d.ieee_address]}
              >
                Assigner
              </button>
            </div>
          ))}
        </div>
      )}

      {unassigned.length === 0 && zigbeeDevices.length === 0 && (
        <p className="empty-hint">Aucun capteur SNZB-02P detecte.</p>
      )}

      <div className="step-nav">
        <button className="btn-back" onClick={onBack}>Retour</button>
        <button className="btn-primary" onClick={onNext}>Suivant</button>
      </div>
    </div>
  );
}

/* ── Step 3: Plugs ─────────────────────────────────────── */
function StepPlugs({ onNext, onBack }) {
  const [zigbeeDevices, setZigbeeDevices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [selections, setSelections] = useState({});
  const [applianceNames, setApplianceNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [devRes, roomRes, plugRes] = await Promise.all([
        api.get('/api/zigbee/devices'),
        api.get('/api/rooms'),
        api.get('/api/plugs'),
      ]);
      const devices = devRes.data.filter(
        (d) =>
          d.model_id?.includes('SP 240') ||
          d.definition?.model?.includes('SP 240')
      );
      setZigbeeDevices(devices);
      setRooms(roomRes.data);
      setAssigned(plugRes.data);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const refreshDevices = async () => {
    setRefreshing(true);
    try {
      await api.post('/api/zigbee/devices/refresh');
      await new Promise((r) => setTimeout(r, 3000));
      await fetchAll();
    } catch { /* empty */ }
    setRefreshing(false);
  };

  const assignPlug = async (device) => {
    const roomId = selections[device.ieee_address];
    const appliance = applianceNames[device.ieee_address];
    if (!roomId || !appliance?.trim()) return;
    try {
      await api.post('/api/plugs', {
        id: device.friendly_name.toLowerCase(),
        source: 'innr',
        zigbee_id: device.friendly_name,
        room_id: roomId,
        appliance_name: appliance.trim(),
      });
      await fetchAll();
    } catch { /* empty */ }
  };

  const assignedZigbeeIds = new Set(assigned.map((p) => p.zigbee_id));
  const unassigned = zigbeeDevices.filter(
    (d) => !assignedZigbeeIds.has(d.friendly_name)
  );

  if (loading) return <div className="setup-loading">Chargement...</div>;

  return (
    <div className="step-panel">
      <h2>Prises connectees</h2>
      <p className="step-desc">
        Associez chaque prise Innr SP 240 a une piece et un appareil.
      </p>

      <button
        type="button"
        className="btn-secondary btn-refresh"
        onClick={refreshDevices}
        disabled={refreshing}
      >
        {refreshing ? 'Recherche...' : 'Rechercher les appareils'}
      </button>

      {assigned.length > 0 && (
        <div className="assigned-section">
          <h3>Prises assignees</h3>
          {assigned.map((p) => (
            <div key={p.id} className="assigned-item">
              <span className="assigned-name">{p.appliance_name}</span>
              <span className="assigned-room">
                {rooms.find((r) => r.id === p.room_id)?.name || '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="unassigned-section">
          <h3>Prises disponibles</h3>
          {unassigned.map((d) => (
            <div key={d.ieee_address} className="device-assign-card">
              <div className="device-name">{d.friendly_name}</div>
              <select
                value={selections[d.ieee_address] || ''}
                onChange={(e) =>
                  setSelections((s) => ({ ...s, [d.ieee_address]: e.target.value }))
                }
              >
                <option value="">-- Piece --</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Nom de l'appareil (ex: TV, Frigo)"
                value={applianceNames[d.ieee_address] || ''}
                onChange={(e) =>
                  setApplianceNames((a) => ({ ...a, [d.ieee_address]: e.target.value }))
                }
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => assignPlug(d)}
                disabled={!selections[d.ieee_address] || !applianceNames[d.ieee_address]?.trim()}
              >
                Assigner
              </button>
            </div>
          ))}
        </div>
      )}

      {unassigned.length === 0 && zigbeeDevices.length === 0 && (
        <p className="empty-hint">Aucune prise Innr SP 240 detectee.</p>
      )}

      <div className="step-nav">
        <button className="btn-back" onClick={onBack}>Retour</button>
        <button className="btn-primary" onClick={onNext}>Suivant</button>
      </div>
    </div>
  );
}

/* ── Step 4: Summary ───────────────────────────────────── */
function StepSummary({ campaignId, refreshCampaign, onBack }) {
  const [rooms, setRooms] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [plugs, setPlugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [roomRes, sensorRes, plugRes] = await Promise.all([
          api.get('/api/rooms'),
          api.get('/api/sensors/temp'),
          api.get('/api/plugs'),
        ]);
        setRooms(roomRes.data);
        setSensors(sensorRes.data);
        setPlugs(plugRes.data);
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, []);

  const activate = async () => {
    setActivating(true);
    try {
      await api.post(`/api/campaign/${campaignId}/activate`);
      await refreshCampaign();
    } catch { /* empty */ }
    setActivating(false);
  };

  if (loading) return <div className="setup-loading">Chargement...</div>;

  return (
    <div className="step-panel">
      <h2>Resume de la configuration</h2>
      <p className="step-desc">
        Verifiez que tout est correct avant de lancer l'enregistrement.
      </p>

      <div className="summary-rooms">
        {rooms.map((room) => {
          const roomSensors = sensors.filter((s) => s.room_id === room.id);
          const roomPlugs = plugs.filter((p) => p.room_id === room.id);
          return (
            <div key={room.id} className="summary-room-card">
              <div className="summary-room-header">
                <span className="room-dot" style={{ background: room.color }} />
                <span>{room.name}</span>
              </div>
              {roomSensors.length > 0 && (
                <div className="summary-devices">
                  <span className="summary-device-label">Capteurs:</span>
                  {roomSensors.map((s) => (
                    <span key={s.id} className="summary-device-tag">
                      {s.friendly_name || s.name}
                      {s.comment ? ` (${s.comment})` : ''}
                    </span>
                  ))}
                </div>
              )}
              {roomPlugs.length > 0 && (
                <div className="summary-devices">
                  <span className="summary-device-label">Prises:</span>
                  {roomPlugs.map((p) => (
                    <span key={p.id} className="summary-device-tag">
                      {p.appliance_name}
                    </span>
                  ))}
                </div>
              )}
              {roomSensors.length === 0 && roomPlugs.length === 0 && (
                <p className="empty-hint">Aucun appareil</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="step-nav">
        <button className="btn-back" onClick={onBack}>Retour</button>
        <button className="btn-primary btn-activate" onClick={activate} disabled={activating}>
          {activating ? 'Activation...' : "Demarrer l'enregistrement"}
        </button>
      </div>
    </div>
  );
}
