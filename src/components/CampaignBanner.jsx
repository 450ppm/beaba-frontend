import { useCampaign } from '../context/CampaignContext';
import './CampaignBanner.css';

export default function CampaignBanner() {
  const { campaign } = useCampaign();
  if (!campaign) return null;

  const startDate = new Date(campaign.start_date);
  const today = new Date();
  const diffMs = today - startDate;
  const dayNum = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
  const totalDays = campaign.expected_duration_days || 30;
  const progress = Math.min(100, (dayNum / totalDays) * 100);

  return (
    <div className="campaign-banner">
      <div className="banner-info">
        <span className="banner-name">{campaign.household_name}</span>
        <span className="banner-day">
          Jour {dayNum} / {totalDays}
        </span>
      </div>
      <div className="banner-bar-track">
        <div className="banner-bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
