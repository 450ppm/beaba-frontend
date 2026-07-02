import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useCampaign } from '../context/CampaignContext';
import StepIndicator from '../components/StepIndicator';
import ColorPicker from '../components/ColorPicker';
import MeterReadingsPage from './MeterReadingsPage';
import './SetupWizard.css';

export default function SetupWizard({ editMode = false, onExit }) {
  const { campaign, refreshCampaign } = useCampaign();
  // En mode edition (campagne deja active), on saute la preparation et les
  // releves de compteurs : on demarre directement sur les pieces.
  const [step, setStep] = useState(editMode ? 3 : 1);

  return (
    <div className="setup-wizard">
      <div className="setup-header">
        <img src="/beaba_banner.png" alt="Beaba" className="setup-logo" />
        <h1>{campaign?.household || 'Configuration'}</h1>
        {editMode && (
          <p className="setup-edit-hint">
            Ajout / modification des appareils — l'enregistrement continue en arriere-plan.
          </p>
        )}
      </div>
      <StepIndicator current={step} editMode={editMode} />
      <div className="setup-content">
        {step === 1 && <StepPreparation onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepStartMeters onNext={() => setStep(3)} onBack={() => setStep(1)} />
        )}
        {step === 3 && (
          <StepRooms
            onNext={() => setStep(4)}
            onBack={editMode ? onExit : () => setStep(2)}
            backLabel={editMode ? 'Retour au tableau de bord' : undefined}
          />
        )}
        {step === 4 && (
          <StepTempSensors onNext={() => setStep(5)} onBack={() => setStep(3)} />
        )}
        {step === 5 && (
          <StepCo2Sensors onNext={() => setStep(6)} onBack={() => setStep(4)} />
        )}
        {step === 6 && (
          <StepPlugs onNext={() => setStep(7)} onBack={() => setStep(5)} />
        )}
        {step === 7 && (
          <StepSummary
            campaignId={campaign?.id}
            refreshCampaign={refreshCampaign}
            onBack={() => setStep(6)}
            editMode={editMode}
            onExit={onExit}
          />
        )}
      </div>
    </div>
  );
}

/* ── Step Compteurs (debut) ──────────────────────────────── */
function StepStartMeters({ onNext, onBack }) {
  return (
    <div className="step-panel">
      <MeterReadingsPage phase="start" onComplete={onNext} embedded />
      <div className="step-nav">
        <button className="btn-back" onClick={onBack}>Retour</button>
        <span />
      </div>
    </div>
  );
}

/* ── Step 0: Preparation ──────────────────────────────── */
function StepPreparation({ onNext }) {
  return (
    <div className="step-panel">
      <h2>Preparation de l'installation</h2>
      <p className="step-desc">
        Avant de creer les pieces, prenez le temps de parcourir le logement et de reperer les emplacements ideaux pour chaque capteur.
      </p>

      <div className="tips-box tips-box-blue">
        <h4>Capteurs de temperature et humidite (SNZB-02P)</h4>
        <ul>
          <li>Placez le capteur a environ <strong>1,50 m du sol</strong>, a hauteur de respiration</li>
          <li>Evitez le <strong>soleil direct</strong> : les rayons faussent la mesure de temperature</li>
          <li>Eloignez-le des <strong>courants d'air</strong> (fenetre entrouverte, bouche de VMC, porte d'entree)</li>
          <li>Evitez la proximite d'un <strong>mur exterieur non isole</strong> ou d'une fenetre simple vitrage (surface froide)</li>
          <li>Ne le placez pas pres d'une <strong>source de chaleur</strong> (radiateur, four, lampe halogene, ordinateur)</li>
          <li>Privilegiez un <strong>mur interieur</strong>, dans la zone de vie principale de la piece</li>
          <li>Prevoyez <strong>1 capteur par piece</strong> ou le confort thermique est important (chambres, salon, bureau)</li>
          <li>La salle de bain est interessante pour <strong>detecter les problemes d'humidite</strong></li>
        </ul>
      </div>

      <div className="tips-box tips-box-orange">
        <h4>Prises connectees (Innr SP 240)</h4>
        <ul>
          <li>La prise se branche <strong>entre la prise murale et l'appareil</strong> a mesurer</li>
          <li>Ciblez en priorite les <strong>gros consommateurs</strong> : chauffage d'appoint, chauffe-eau, seche-linge, four, lave-vaisselle</li>
          <li>Pensez aux appareils en <strong>veille permanente</strong> : TV, box internet, console de jeux, ecran PC</li>
          <li>Ne depassez pas <strong>3680W (16A)</strong> par prise — verifiez la puissance de l'appareil</li>
          <li>Evitez les <strong>multiprises en cascade</strong> : branchez la prise connectee directement sur la prise murale</li>
          <li>Vous pouvez mesurer une <strong>multiprise entiere</strong> pour estimer la consommation d'un poste (ex: bureau informatique)</li>
          <li>Pensez au <strong>refrigerateur et congelateur</strong> : ce sont souvent les 1ers consommateurs du foyer</li>
          <li>Le <strong>chauffe-eau electrique</strong> est generalement le plus gros poste — mesurez-le si accessible</li>
        </ul>
      </div>

      <div className="tips-box tips-box-green">
        <h4>Organisation des pieces</h4>
        <ul>
          <li>Notez les pieces ou vous allez installer des capteurs et/ou des prises</li>
          <li>Donnez des <strong>noms clairs</strong> aux pieces (ex: "Chambre parents", pas "Chambre 1")</li>
          <li>Les <strong>couleurs</strong> vous aideront a identifier rapidement chaque piece dans le rapport</li>
          <li>Pas besoin de creer une piece pour chaque capteur — regroupez si logique (ex: cuisine ouverte sur salon)</li>
        </ul>
      </div>

      <div className="step-nav">
        <div />
        <button className="btn-primary" onClick={onNext}>
          C'est compris, creer les pieces
        </button>
      </div>
    </div>
  );
}

/* ── Step 1: Rooms ─────────────────────────────────────── */
function StepRooms({ onNext, onBack, backLabel }) {
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
        <button className="btn-back" onClick={onBack}>{backLabel || 'Retour'}</button>
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
        Associez chaque capteur SNZB-02P a une piece. Utilisez le commentaire pour noter l'emplacement exact.
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

/* ── Step CO2 sensors ──────────────────────────────────── */
function StepCo2Sensors({ onNext, onBack }) {
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
        api.get('/api/sensors/co2'),
      ]);
      // Filtre les capteurs CO2 connus (Heiman HS3AQ, Aqara, etc.)
      const devices = devRes.data.filter((d) => {
        const model = (d.model_id || d.definition?.model || '').toUpperCase();
        const exposes = d.definition?.exposes || [];
        const hasCo2 = exposes.some((e) => e.name === 'co2' || e.property === 'co2');
        return hasCo2 || model.includes('HS3AQ') || model.includes('CO2');
      });
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
      await new Promise((r) => setTimeout(r, 3000));
      await fetchAll();
    } catch { /* empty */ }
    setRefreshing(false);
  };

  const assignSensor = async (device) => {
    const roomId = selections[device.ieee_address];
    if (!roomId) return;
    try {
      await api.post('/api/sensors/co2', {
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
      <h2>Capteurs CO2</h2>
      <p className="step-desc">
        Associez chaque capteur CO2 a une piece. Cette etape est facultative — passez a la suivante si vous n'avez pas de capteur CO2.
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
          <h3>Capteurs CO2 assignes</h3>
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
          <h3>Capteurs CO2 disponibles</h3>
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
                placeholder="Commentaire (ex: piece de vie principale)"
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
        <p className="empty-hint">Aucun capteur CO2 detecte. Vous pouvez passer cette etape.</p>
      )}

      <div className="step-nav">
        <button className="btn-back" onClick={onBack}>Retour</button>
        <button className="btn-primary" onClick={onNext}>Suivant</button>
      </div>
    </div>
  );
}

/* ── Step Prises (version legere) ─────────────────────────
   On ne demande ici qu'un label + une piece + multiprise oui/non.
   Le detail des appareils est configure plus tard depuis le dashboard. */
function StepPlugs({ onNext, onBack }) {
  const [zigbeeDevices, setZigbeeDevices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [selections, setSelections] = useState({});
  const [applianceNames, setApplianceNames] = useState({});
  const [multipriseFlags, setMultipriseFlags] = useState({});
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
        is_multiprise: !!multipriseFlags[device.ieee_address],
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
        Donnez un nom court a chaque prise (ex: "TV", "Bureau", "Multiprise salon").
        Le detail des appareils pourra etre complete plus tard depuis le tableau de bord.
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
              <span className="assigned-name">
                {p.is_multiprise ? '🔌 ' : ''}{p.appliance_name}
              </span>
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
                placeholder="Nom de la prise (ex: TV, Bureau)"
                value={applianceNames[d.ieee_address] || ''}
                onChange={(e) =>
                  setApplianceNames((a) => ({ ...a, [d.ieee_address]: e.target.value }))
                }
              />
              <label className="multiprise-toggle">
                <input
                  type="checkbox"
                  checked={!!multipriseFlags[d.ieee_address]}
                  onChange={(e) =>
                    setMultipriseFlags((m) => ({
                      ...m,
                      [d.ieee_address]: e.target.checked,
                    }))
                  }
                />
                <span>Multiprise (plusieurs appareils)</span>
              </label>
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
function StepSummary({ campaignId, refreshCampaign, onBack, editMode = false, onExit }) {
  const [rooms, setRooms] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [co2Sensors, setCo2Sensors] = useState([]);
  const [plugs, setPlugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [roomRes, sensorRes, co2Res, plugRes] = await Promise.all([
          api.get('/api/rooms'),
          api.get('/api/sensors/temp'),
          api.get('/api/sensors/co2'),
          api.get('/api/plugs'),
        ]);
        setRooms(roomRes.data);
        setSensors(sensorRes.data);
        setCo2Sensors(co2Res.data);
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
        {editMode
          ? 'Vos modifications sont deja enregistrees. Revenez au tableau de bord quand vous avez termine.'
          : "Verifiez que tout est correct avant de lancer l'enregistrement."}
      </p>

      <div className="summary-rooms">
        {rooms.map((room) => {
          const roomSensors = sensors.filter((s) => s.room_id === room.id);
          const roomCo2 = co2Sensors.filter((s) => s.room_id === room.id);
          const roomPlugs = plugs.filter((p) => p.room_id === room.id);
          return (
            <div key={room.id} className="summary-room-card">
              <div className="summary-room-header">
                <span className="room-dot" style={{ background: room.color }} />
                <span>{room.name}</span>
              </div>
              {roomSensors.length > 0 && (
                <div className="summary-devices">
                  <span className="summary-device-label">Temp:</span>
                  {roomSensors.map((s) => (
                    <span key={s.id} className="summary-device-tag">
                      {s.friendly_name || s.name}
                      {s.comment ? ` (${s.comment})` : ''}
                    </span>
                  ))}
                </div>
              )}
              {roomCo2.length > 0 && (
                <div className="summary-devices">
                  <span className="summary-device-label">CO2:</span>
                  {roomCo2.map((s) => (
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
              {roomSensors.length === 0 && roomCo2.length === 0 && roomPlugs.length === 0 && (
                <p className="empty-hint">Aucun appareil</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="step-nav">
        <button className="btn-back" onClick={onBack}>Retour</button>
        {editMode ? (
          <button className="btn-primary" onClick={onExit}>
            Retour au tableau de bord
          </button>
        ) : (
          <button className="btn-primary btn-activate" onClick={activate} disabled={activating}>
            {activating ? 'Activation...' : "Demarrer l'enregistrement"}
          </button>
        )}
      </div>
    </div>
  );
}
