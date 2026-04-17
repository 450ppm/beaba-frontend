import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import './LoginPage.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/auth/login', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'envoi du lien de connexion.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/beaba_banner.png" alt="Beaba" className="login-logo" />
        <h1 className="login-title">Connexion conseiller</h1>

        {sent ? (
          <div className="login-success">
            <p>
              Un lien de connexion a été envoyé à votre adresse email.
              Vérifiez votre boîte de réception.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="email" className="login-label">Adresse email</label>
            <input
              id="email"
              type="email"
              className="login-input"
              placeholder="conseiller@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            {error && <p className="login-error">{error}</p>}
            <button
              type="submit"
              className="login-button"
              disabled={submitting}
            >
              {submitting ? 'Envoi...' : 'Recevoir le lien de connexion'}
            </button>
          </form>
        )}

        <Link to="/" className="login-back">Retour à l'accueil</Link>
      </div>
    </div>
  );
}
