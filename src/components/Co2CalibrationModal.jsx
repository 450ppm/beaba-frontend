import { useState, useEffect } from 'react';
import api from '../api';
import './Co2CalibrationModal.css';

const COUNTDOWN_SECONDS = 10 * 60;

function formatMS(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Co2CalibrationModal({ sensor, onClose }) {
  const [phase, setPhase] = useState('intro'); // intro | countdown | computing | result | error
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (!sensor) return;
    api.get(`/api/sensors/co2/${sensor.id}/calibration`)
      .then((res) => setCurrent(res.data))
      .catch(() => {});
  }, [sensor]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          compute();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && phase !== 'computing') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  const start = () => {
    setSecondsLeft(COUNTDOWN_SECONDS);
    setPhase('countdown');
  };

  const compute = async () => {
    setPhase('computing');
    setError(null);
    try {
      const res = await api.post(`/api/sensors/co2/${sensor.id}/calibrate`, null, {
        params: { window_min: 10 },
      });
      setResult(res.data);
      setPhase('result');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || err.message);
      setPhase('error');
    }
  };

  const reset = async () => {
    if (!confirm('Reinitialiser la calibration (offset remis a 0) ?')) return;
    try {
      await api.post(`/api/sensors/co2/${sensor.id}/calibration/reset`);
      setCurrent({ ...current, calibration_offset_ppm: 0, calibration_at: null });
    } catch (err) {
      setError(err.message);
    }
  };

  if (!sensor) return null;

  return (
    <div className="co2cal-overlay" onClick={(e) => e.target.classList.contains('co2cal-overlay') && phase !== 'computing' && onClose?.()}>
      <div className="co2cal-modal" role="dialog" aria-modal="true">
        <button className="co2cal-close" onClick={onClose} aria-label="Fermer">×</button>

        <h3>Calibration CO<sub>2</sub></h3>
        <p className="co2cal-sub">{sensor.room_name || sensor.sensor_name || sensor.name}</p>

        {current?.calibration_at && (
          <div className="co2cal-current">
            <span className="co2cal-current-label">Calibration en cours :</span>
            <span className="co2cal-current-value">
              offset <strong>{current.calibration_offset_ppm > 0 ? '+' : ''}{current.calibration_offset_ppm} ppm</strong>
              {current.calibration_raw_ppm != null && current.calibration_ref_ppm != null && (
                <> ({current.calibration_raw_ppm} ppm capteur → {current.calibration_ref_ppm} ppm reference)</>
              )}
            </span>
            <button className="co2cal-link" onClick={reset}>Reinitialiser</button>
          </div>
        )}

        {phase === 'intro' && (
          <>
            <div className="co2cal-steps">
              <div className="co2cal-step">
                <span className="co2cal-step-num">1</span>
                <div>
                  <strong>Placez le capteur a l'exterieur</strong>
                  <p>Loin des sources de combustion (chauffage exterieur, BBQ) et idealement a l'ombre. L'air libre se rapproche de la valeur globale Mauna Loa.</p>
                </div>
              </div>
              <div className="co2cal-step">
                <span className="co2cal-step-num">2</span>
                <div>
                  <strong>Attendre 10 minutes</strong>
                  <p>Le capteur a besoin de plusieurs releves stables pour qu'on prenne une mediane fiable.</p>
                </div>
              </div>
              <div className="co2cal-step">
                <span className="co2cal-step-num">3</span>
                <div>
                  <strong>Calcul automatique de l'offset</strong>
                  <p>On compare la mediane mesuree au CO<sub>2</sub> atmospherique courant (~427 ppm) et on stocke la difference.</p>
                </div>
              </div>
            </div>
            <div className="co2cal-actions">
              <button className="co2cal-btn-secondary" onClick={onClose}>Annuler</button>
              <button className="co2cal-btn-primary" onClick={start}>Demarrer (10 min)</button>
            </div>
          </>
        )}

        {phase === 'countdown' && (
          <div className="co2cal-countdown">
            <div className="co2cal-timer">{formatMS(secondsLeft)}</div>
            <p>Capteur a l'exterieur — on patiente.</p>
            <p className="co2cal-hint">Tu peux fermer la fenetre, la calibration ne s'interrompt pas (les valeurs s'accumulent en base). Mais on calculera l'offset uniquement quand tu reviendras au bout des 10 min.</p>
            <div className="co2cal-actions">
              <button className="co2cal-btn-secondary" onClick={() => setPhase('intro')}>Arreter</button>
              <button className="co2cal-btn-primary" onClick={compute}>Calculer maintenant</button>
            </div>
          </div>
        )}

        {phase === 'computing' && (
          <div className="co2cal-computing">
            <div className="co2cal-spinner" />
            <p>Calcul en cours…</p>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="co2cal-result">
            <div className="co2cal-result-grid">
              <div>
                <span>Mediane capteur</span>
                <strong>{result.raw_median_ppm} ppm</strong>
              </div>
              <div>
                <span>Reference Mauna Loa</span>
                <strong>{result.atmospheric_ppm} ppm</strong>
              </div>
              <div>
                <span>Offset applique</span>
                <strong className={result.offset_ppm >= 0 ? 'pos' : 'neg'}>
                  {result.offset_ppm >= 0 ? '+' : ''}{result.offset_ppm} ppm
                </strong>
              </div>
              <div>
                <span>Echantillons</span>
                <strong>{result.sample_count}</strong>
              </div>
            </div>
            <p className="co2cal-success">
              Calibration enregistree. Toutes les lectures de ce capteur sont
              corrigees automatiquement.
            </p>
            <div className="co2cal-actions">
              <button className="co2cal-btn-primary" onClick={onClose}>Termine</button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="co2cal-error-block">
            <p className="co2cal-error">{error}</p>
            <div className="co2cal-actions">
              <button className="co2cal-btn-secondary" onClick={() => setPhase('intro')}>Recommencer</button>
              <button className="co2cal-btn-primary" onClick={onClose}>Fermer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
