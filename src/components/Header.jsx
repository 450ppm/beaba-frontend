import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCampaign } from '../context/CampaignContext';
import './Header.css';

export default function Header() {
  const { user, logout } = useAuth();
  const { campaign } = useCampaign();
  const navigate = useNavigate();

  const statusLabels = {
    setup: 'Configuration',
    active: 'En cours',
    completed: 'Terminé',
  };

  const statusClass = campaign?.status || 'active';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-brand">
        <img src="/beaba_banner.png" alt="Beaba" className="header-logo" />
      </div>
      {campaign && (
        <div className="header-info">
          <span className="header-kit">{campaign.household}</span>
          <span className={`header-status status-${statusClass}`}>
            {statusLabels[campaign.status] || 'En ligne'}
          </span>
        </div>
      )}
      <div className="header-user">
        {user && (
          <>
            <span className="header-username">{user.name}</span>
            {user.role === 'admin' && (
              <Link to="/app/admin" className="header-admin-link">Admin</Link>
            )}
            <button className="header-logout" onClick={handleLogout}>
              Déconnexion
            </button>
          </>
        )}
      </div>
    </header>
  );
}
