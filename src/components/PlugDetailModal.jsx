import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import {
  APPLIANCE_CATEGORIES,
  SUGGESTION_TO_CATEGORY,
  categoryIcon,
} from './applianceCategories';
import './PlugDetailModal.css';

const CONTROL_TYPES = [
  { id: 'switch', label: 'Controle par interrupteur' },
  { id: 'autonomous', label: 'Allumage autonome (thermostat, timer)' },
  { id: 'permanent', label: 'Toujours allume' },
];

export default function PlugDetailModal({ plug, room, onClose, onUpdated }) {
  const [appliances, setAppliances] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerForm, setHeaderForm] = useState({
    appliance_name: plug.appliance_name || '',
    is_multiprise: !!plug.is_multiprise,
  });
  const [showStats, setShowStats] = useState(false);
  // Local mirror of plug.is_multiprise — flipped optimistically when the user
  // adds a 2nd appliance to a single-plug, before parent refresh propagates.
  const [isMulti, setIsMulti] = useState(!!plug.is_multiprise);

  const fetchAppliances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/plugs/${plug.id}/appliances`);
      setAppliances(res.data);
    } catch { /* empty */ }
    setLoading(false);
  }, [plug.id]);

  // Re-fetch local appliance list AND notify parent (CartoView / ApplianceList)
  // so their cached appliancesByPlug map reflects the change.
  const refreshAfterMutation = useCallback(async () => {
    await fetchAppliances();
    if (onUpdated) onUpdated();
  }, [fetchAppliances, onUpdated]);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await api.get(`/api/plugs/${plug.id}/profile`);
      setProfile(res.data);
    } catch {
      setProfile(null);
    }
    setProfileLoading(false);
  }, [plug.id]);

  useEffect(() => {
    fetchAppliances();
    fetchProfile();
  }, [fetchAppliances, fetchProfile]);

  const saveHeader = async () => {
    try {
      await api.put(`/api/plugs/${plug.id}`, {
        appliance_name: headerForm.appliance_name.trim() || undefined,
        is_multiprise: headerForm.is_multiprise,
      });
      setEditingHeader(false);
      if (onUpdated) onUpdated();
    } catch { /* empty */ }
  };

  const addAppliance = async () => {
    try {
      // Adding a 2nd+ appliance on a single plug → upgrade it to multiprise
      // server-side so the row stays consistent. Single plug = 1 appliance.
      if (!isMulti && appliances.length >= 1) {
        await api.put(`/api/plugs/${plug.id}`, { is_multiprise: true });
        setIsMulti(true);
      }
      await api.post(`/api/plugs/${plug.id}/appliances`, {
        name: 'Nouvel appareil',
      });
      await refreshAfterMutation();
    } catch { /* empty */ }
  };

  const applySuggestion = async (sugg) => {
    const catId = SUGGESTION_TO_CATEGORY[sugg.category] || null;
    try {
      // Si un appareil existe deja et qu'il est seul, on lui applique
      if (!isMulti && appliances.length === 1) {
        await api.put(
          `/api/plugs/${plug.id}/appliances/${appliances[0].id}`,
          { category: catId || 'other' }
        );
      } else {
        await api.post(`/api/plugs/${plug.id}/appliances`, {
          name: sugg.label,
          category: catId || 'other',
        });
      }
      await refreshAfterMutation();
    } catch { /* empty */ }
  };

  const stats = profile?.stats;
  const topSuggestion = profile?.suggestions?.[0];
  const otherSuggestions = profile?.suggestions?.slice(1) || [];

  return (
    <div className="plug-modal-overlay" onClick={onClose}>
      <div className="plug-modal" onClick={(e) => e.stopPropagation()}>
        <button className="plug-modal-close" onClick={onClose} aria-label="Fermer">
          ×
        </button>

        {/* Header */}
        <div className="plug-modal-header">
          {editingHeader ? (
            <div className="plug-header-edit">
              <input
                type="text"
                value={headerForm.appliance_name}
                onChange={(e) =>
                  setHeaderForm((f) => ({ ...f, appliance_name: e.target.value }))
                }
                placeholder="Nom de la prise"
              />
              <label className="plug-multi-toggle">
                <input
                  type="checkbox"
                  checked={headerForm.is_multiprise}
                  onChange={(e) =>
                    setHeaderForm((f) => ({ ...f, is_multiprise: e.target.checked }))
                  }
                />
                <span>Multiprise (plusieurs appareils)</span>
              </label>
              <div className="plug-header-actions">
                <button className="btn-link" onClick={() => setEditingHeader(false)}>
                  Annuler
                </button>
                <button className="btn-primary-small" onClick={saveHeader}>
                  Enregistrer
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="plug-modal-title">
                <h2>
                  {plug.is_multiprise ? '🔌 ' : ''}
                  {plug.appliance_name}
                </h2>
                <div className="plug-modal-room">
                  {room?.color && (
                    <span
                      className="plug-room-dot"
                      style={{ background: room.color }}
                    />
                  )}
                  <span>{room?.name || 'Sans piece'}</span>
                </div>
              </div>
              <button
                className="btn-link"
                onClick={() => {
                  setHeaderForm({
                    appliance_name: plug.appliance_name || '',
                    is_multiprise: !!plug.is_multiprise,
                  });
                  setEditingHeader(true);
                }}
              >
                Modifier
              </button>
            </>
          )}
        </div>

        {/* Suggestion IA */}
        <div className="plug-suggestion-section">
          <h3 className="plug-section-title">Suggestion automatique</h3>
          {profileLoading ? (
            <div className="plug-suggestion-loading">Analyse en cours...</div>
          ) : !profile || !stats ? (
            <div className="plug-suggestion-empty">
              {profile?.message || 'Aucune donnee disponible pour le moment.'}
            </div>
          ) : (
            <>
              <p className="plug-suggestion-intro">
                Cette prise consomme en moyenne{' '}
                <strong>{stats.avg_w} W</strong>{' '}
                (max <strong>{stats.max_w} W</strong>).
              </p>

              {topSuggestion ? (
                <div className="plug-top-suggestion">
                  <div className="plug-top-line">
                    <span className="plug-top-icon">
                      {categoryIcon(SUGGESTION_TO_CATEGORY[topSuggestion.category]) || '🔍'}
                    </span>
                    <span className="plug-top-label">
                      Probablement : <strong>{topSuggestion.label}</strong>
                    </span>
                    <span className="plug-confidence">
                      {topSuggestion.confidence}%
                    </span>
                  </div>
                  {topSuggestion.hint && (
                    <div className="plug-top-hint">{topSuggestion.hint}</div>
                  )}
                  <button
                    className="btn-secondary-small"
                    onClick={() => applySuggestion(topSuggestion)}
                  >
                    Appliquer cette suggestion
                  </button>
                </div>
              ) : (
                <div className="plug-suggestion-empty">
                  Aucune correspondance claire — affinez la categorie manuellement ci-dessous.
                </div>
              )}

              {otherSuggestions.length > 0 && (
                <div className="plug-other-suggestions">
                  <span className="plug-other-label">Autres pistes :</span>
                  {otherSuggestions.map((s, i) => (
                    <button
                      key={i}
                      className="plug-other-chip"
                      onClick={() => applySuggestion(s)}
                    >
                      {categoryIcon(SUGGESTION_TO_CATEGORY[s.category]) || '🔍'}{' '}
                      {s.label} ({s.confidence}%)
                    </button>
                  ))}
                </div>
              )}

              <button
                className="btn-link plug-stats-toggle"
                onClick={() => setShowStats((s) => !s)}
              >
                {showStats ? 'Masquer' : 'Voir'} les statistiques detaillees
              </button>

              {showStats && (
                <div className="plug-stats">
                  <Stat label="Moyenne" value={`${stats.avg_w} W`} />
                  <Stat label="Min" value={`${stats.min_w} W`} />
                  <Stat label="Max" value={`${stats.max_w} W`} />
                  <Stat label="P10 (base)" value={`${stats.p10_w} W`} />
                  <Stat label="P50 (mediane)" value={`${stats.p50_w} W`} />
                  <Stat label="P90 (haut)" value={`${stats.p90_w} W`} />
                  <Stat label="Ecart-type" value={`${stats.stdev_w} W`} />
                  <Stat label="% actif" value={`${stats.pct_active}%`} />
                  <Stat label="Cycles" value={stats.cycle_freq.toFixed(3)} />
                  <Stat label="Releves" value={stats.sample_count} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Liste appareils */}
        <div className="plug-appliances-section">
          <div className="plug-appliances-header">
            <h3 className="plug-section-title">
              {isMulti ? 'Appareils branches' : 'Appareil'}
            </h3>
            {appliances.length > 0 && (
              <button className="btn-secondary-small" onClick={addAppliance}>
                + Ajouter un appareil
              </button>
            )}
          </div>

          {loading ? (
            <div className="plug-appliances-loading">Chargement...</div>
          ) : appliances.length === 0 ? (
            <div className="plug-appliances-empty">
              <p>Aucun appareil renseigne pour cette prise.</p>
              <button className="btn-secondary-small" onClick={addAppliance}>
                + Ajouter un appareil
              </button>
            </div>
          ) : (
            <div className="plug-appliances-list">
              {appliances.map((app) => (
                <ApplianceCard
                  key={app.id}
                  plugId={plug.id}
                  appliance={app}
                  onChanged={refreshAfterMutation}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="plug-stat-item">
      <div className="plug-stat-label">{label}</div>
      <div className="plug-stat-value">{value}</div>
    </div>
  );
}

function ApplianceCard({ plugId, appliance, onChanged }) {
  const [form, setForm] = useState({
    name: appliance.name || '',
    category: appliance.category || '',
    rated_power_w: appliance.rated_power_w ?? '',
    always_on: !!appliance.always_on,
    control_type: appliance.control_type || '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Synchronise quand la liste est rafraichie depuis l'exterieur
  useEffect(() => {
    setForm({
      name: appliance.name || '',
      category: appliance.category || '',
      rated_power_w: appliance.rated_power_w ?? '',
      always_on: !!appliance.always_on,
      control_type: appliance.control_type || '',
    });
  }, [appliance]);

  const save = async () => {
    setSaving(true);
    try {
      const power = form.rated_power_w === '' ? null : Number(form.rated_power_w);
      await api.put(`/api/plugs/${plugId}/appliances/${appliance.id}`, {
        name: form.name.trim() || appliance.name,
        category: form.category || null,
        rated_power_w: Number.isFinite(power) && power > 0 ? power : null,
        always_on: form.always_on,
        control_type: form.control_type || null,
      });
      if (onChanged) await onChanged();
    } catch { /* empty */ }
    setSaving(false);
  };

  const remove = async () => {
    if (!confirm(`Supprimer "${appliance.name}" ?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/api/plugs/${plugId}/appliances/${appliance.id}`);
      if (onChanged) await onChanged();
    } catch { /* empty */ }
    setDeleting(false);
  };

  return (
    <div className="plug-appliance-card">
      <div className="plug-appliance-head">
        <span className="plug-appliance-icon">{categoryIcon(form.category)}</span>
        <input
          type="text"
          className="plug-appliance-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nom de l'appareil"
        />
      </div>

      <div className="plug-appliance-row">
        <label className="plug-appliance-label">Categorie</label>
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        >
          <option value="">-- Choisir --</option>
          {APPLIANCE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="plug-appliance-row">
        <label className="plug-appliance-label">Puissance nominale</label>
        <div className="plug-appliance-power-input">
          <input
            type="number"
            min="0"
            step="1"
            value={form.rated_power_w}
            onChange={(e) =>
              setForm((f) => ({ ...f, rated_power_w: e.target.value }))
            }
            placeholder="ex: 150"
          />
          <span>W</span>
        </div>
      </div>

      <label className="plug-appliance-toggle">
        <input
          type="checkbox"
          checked={form.always_on}
          onChange={(e) =>
            setForm((f) => ({ ...f, always_on: e.target.checked }))
          }
        />
        <span>Toujours branche</span>
      </label>

      <div className="plug-appliance-row plug-appliance-radios">
        <label className="plug-appliance-label">Mode de controle</label>
        {CONTROL_TYPES.map((ct) => (
          <label key={ct.id} className="plug-radio">
            <input
              type="radio"
              name={`control-${appliance.id}`}
              value={ct.id}
              checked={form.control_type === ct.id}
              onChange={() =>
                setForm((f) => ({ ...f, control_type: ct.id }))
              }
            />
            <span>{ct.label}</span>
          </label>
        ))}
      </div>

      <div className="plug-appliance-actions">
        <button
          className="btn-link plug-appliance-delete"
          onClick={remove}
          disabled={deleting}
        >
          {deleting ? 'Suppression...' : 'Supprimer'}
        </button>
        <button
          className="btn-primary-small"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
