import { useCampaign } from '../context/CampaignContext';
import './Header.css';

export default function Header() {
  const { campaign } = useCampaign();

  const statusLabels = {
    setup: 'Configuration',
    active: 'En cours',
    completed: 'Termine',
  };

  const statusClass = campaign?.status || 'active';

  return (
    <header className="header">
      <div className="header-brand">
        <img src="/beaba_banner.png" alt="Beaba" className="header-logo" />
      </div>
      {campaign && (
        <div className="header-info">
          <span className="header-kit">{campaign.household_name}</span>
          <span className={`header-status status-${statusClass}`}>
            {statusLabels[campaign.status] || 'En ligne'}
          </span>
        </div>
      )}
    </header>
  );
}
