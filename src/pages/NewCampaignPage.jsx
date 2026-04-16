import { useState } from 'react';
import api from '../api';
import { useCampaign } from '../context/CampaignContext';
import './NewCampaignPage.css';

export default function NewCampaignPage() {
  const { refreshCampaign } = useCampaign();
  const [householdName, setHouseholdName] = useState('');
  const [address, setAddress] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!householdName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/campaign', {
        household: householdName.trim(),
        address: address.trim() || undefined,
        start_date: startDate,
        expected_days: Number(duration),
      });
      await refreshCampaign();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la creation');
      setSubmitting(false);
    }
  };

  return (
    <div className="new-campaign-page">
      <div className="new-campaign-card">
        <img src="/beaba_banner.png" alt="Beaba" className="new-campaign-logo" />
        <h1>Nouvelle campagne</h1>
        <p className="new-campaign-subtitle">
          Configurez les informations du foyer avant de commencer la mesure.
        </p>

        <form onSubmit={handleSubmit} className="new-campaign-form">
          <label>
            <span>Nom du foyer *</span>
            <input
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="Ex: Famille Dupont"
              required
            />
          </label>

          <label>
            <span>Adresse</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex: 12 rue de la Paix, Paris"
            />
          </label>

          <label>
            <span>Date de debut</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <label>
            <span>Duree prevue (jours)</span>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              max="365"
            />
          </label>

          {error && <div className="new-campaign-error">{error}</div>}

          <button type="submit" disabled={submitting || !householdName.trim()}>
            {submitting ? 'Creation...' : 'Demarrer la campagne'}
          </button>
        </form>
      </div>
    </div>
  );
}
