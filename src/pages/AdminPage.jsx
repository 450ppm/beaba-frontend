import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import './AdminPage.css';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/api/users');
      setUsers(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/api/users', { name: formName, email: formEmail });
      setFormName('');
      setFormEmail('');
      setShowForm(false);
      await fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erreur lors de la création.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/api/users/${user.id}`, { active: !user.active });
      await fetchUsers();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Gestion des conseillers</h1>
        <div className="admin-actions">
          <Link to="/app" className="admin-back-link">Retour</Link>
          <button
            className="admin-add-btn"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Annuler' : 'Ajouter un conseiller'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="admin-form">
          <div className="admin-form-row">
            <input
              type="text"
              placeholder="Nom"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              className="admin-input"
            />
            <input
              type="email"
              placeholder="Email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
              className="admin-input"
            />
            <button type="submit" className="admin-submit-btn" disabled={submitting}>
              {submitting ? 'Création...' : 'Créer'}
            </button>
          </div>
          {formError && <p className="admin-form-error">{formError}</p>}
        </form>
      )}

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`admin-role admin-role-${u.role}`}>
                    {u.role === 'admin' ? 'Admin' : 'Conseiller'}
                  </span>
                </td>
                <td>
                  <span className={`admin-badge ${u.active !== false ? 'admin-badge-active' : 'admin-badge-inactive'}`}>
                    {u.active !== false ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td>
                  <button
                    className="admin-action-btn"
                    onClick={() => toggleActive(u)}
                  >
                    {u.active !== false ? 'Désactiver' : 'Réactiver'}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan="5" className="admin-empty">Aucun utilisateur</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
