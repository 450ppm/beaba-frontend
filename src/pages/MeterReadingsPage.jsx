import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useCampaign } from '../context/CampaignContext';
import './MeterReadingsPage.css';

const METER_CONFIGS = [
  {
    type: 'electricity',
    label: 'Compteur electrique',
    icon: '\u26A1',
    iconClass: 'meter-icon-electricity',
    unit: 'kWh',
    step: 0.01,
  },
  {
    type: 'gas',
    label: 'Compteur gaz',
    icon: '\uD83D\uDD25',
    iconClass: 'meter-icon-gas',
    unit: 'm\u00B3',
    step: 0.01,
  },
  {
    type: 'water',
    label: 'Compteur eau',
    icon: '\uD83D\uDCA7',
    iconClass: 'meter-icon-water',
    unit: 'm\u00B3',
    step: 0.01,
  },
];

export default function MeterReadingsPage({ phase, onComplete, embedded }) {
  const { campaign } = useCampaign();
  const [readings, setReadings] = useState([]);
  const [values, setValues] = useState({});
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState({});
  const [errors, setErrors] = useState({});

  const isStart = phase === 'start';

  const fetchReadings = useCallback(() => {
    api.get('/api/meters')
      .then(res => setReadings(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  const getExisting = (type) => {
    return readings.find(r => r.meter_type === type && r.phase === phase);
  };

  const getOtherPhase = (type) => {
    const other = phase === 'start' ? 'end' : 'start';
    return readings.find(r => r.meter_type === type && r.phase === other);
  };

  const allDone = METER_CONFIGS.every(m => getExisting(m.type));

  const handleSave = async (type, unit) => {
    const val = parseFloat(values[type]);
    if (isNaN(val) || val < 0) {
      setErrors(prev => ({ ...prev, [type]: 'Valeur invalide' }));
      return;
    }

    setSaving(prev => ({ ...prev, [type]: true }));
    setErrors(prev => ({ ...prev, [type]: null }));

    try {
      await api.post('/api/meters', {
        meter_type: type,
        phase,
        value: val,
        unit,
        notes: notes[type] || undefined,
      });
      setValues(prev => ({ ...prev, [type]: '' }));
      setNotes(prev => ({ ...prev, [type]: '' }));
      fetchReadings();
    } catch (err) {
      setErrors(prev => ({ ...prev, [type]: err.response?.data?.error || 'Erreur' }));
    }

    setSaving(prev => ({ ...prev, [type]: false }));
  };

  return (
    <div className={`meter-readings-page ${embedded ? 'meter-embedded' : ''}`}>
      <div className="meter-header">
        <h1>{isStart ? 'Releves de debut de campagne' : 'Releves de fin de campagne'}</h1>
        <p className="meter-description">
          {isStart
            ? 'Relevez les compteurs avant de demarrer la mesure'
            : 'Relevez les compteurs avant de cloturer'}
        </p>
      </div>

      <div className="meter-cards">
        {METER_CONFIGS.map(config => {
          const existing = getExisting(config.type);
          const otherPhase = getOtherPhase(config.type);
          const isDone = !!existing;

          return (
            <div className={`meter-card ${isDone ? 'meter-card-done' : ''}`} key={config.type}>
              <div className="meter-card-header">
                <span className={`meter-icon ${config.iconClass}`}>{config.icon}</span>
                <h3>{config.label}</h3>
                {isDone && <span className="meter-check">{'\u2705'}</span>}
              </div>

              {otherPhase && (
                <div className="meter-other-phase">
                  Releve {otherPhase.phase === 'start' ? 'debut' : 'fin'} : {otherPhase.value} {otherPhase.unit}
                </div>
              )}

              {isDone ? (
                <div className="meter-existing">
                  <div className="meter-existing-value">
                    {existing.value} <span className="meter-unit">{existing.unit}</span>
                  </div>
                  {existing.notes && <div className="meter-existing-notes">{existing.notes}</div>}
                  <div className="meter-existing-date">
                    Enregistre le {new Date(existing.recorded_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              ) : (
                <div className="meter-form">
                  <div className="meter-input-group">
                    <input
                      type="number"
                      step={config.step}
                      min="0"
                      placeholder={`Valeur en ${config.unit}`}
                      value={values[config.type] || ''}
                      onChange={e => setValues(prev => ({ ...prev, [config.type]: e.target.value }))}
                      className="meter-input"
                    />
                    <span className="meter-input-unit">{config.unit}</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Notes (optionnel)"
                    value={notes[config.type] || ''}
                    onChange={e => setNotes(prev => ({ ...prev, [config.type]: e.target.value }))}
                    className="meter-notes-input"
                  />
                  {errors[config.type] && (
                    <div className="meter-error">{errors[config.type]}</div>
                  )}
                  <button
                    className="meter-save-btn"
                    onClick={() => handleSave(config.type, config.unit)}
                    disabled={saving[config.type]}
                  >
                    {saving[config.type] ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="meter-footer">
        <button
          className="meter-continue-btn"
          disabled={!allDone}
          onClick={onComplete}
        >
          Continuer
        </button>
      </div>
    </div>
  );
}
