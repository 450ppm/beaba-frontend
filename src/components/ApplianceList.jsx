import './ApplianceList.css';

export default function ApplianceList({ powerData }) {
  if (!powerData || !powerData.length) {
    return (
      <div className="appliance-panel">
        <h3 className="panel-title">Appareils</h3>
        <p className="panel-empty">En attente des donnees...</p>
      </div>
    );
  }

  const sorted = [...powerData].sort((a, b) => (b.power_w || 0) - (a.power_w || 0));
  const maxPower = Math.max(...sorted.map((p) => p.power_w || 0), 1);
  const topId = sorted[0]?.plug_id;

  return (
    <div className="appliance-panel">
      <h3 className="panel-title">Appareils</h3>
      <div className="appliance-list">
        {sorted.map((plug) => {
          const isActive = (plug.power_w || 0) > 1;
          const isTop = plug.plug_id === topId && isActive;
          const pct = maxPower > 0 ? ((plug.power_w || 0) / maxPower) * 100 : 0;

          return (
            <div
              key={plug.plug_id}
              className={`appliance-row ${isTop ? 'top-consumer' : ''}`}
            >
              <span className={`appliance-dot ${isActive ? 'on' : 'off'}`} />
              <span className="appliance-name">{plug.appliance_name}</span>
              <span className="appliance-power">
                {(plug.power_w || 0).toFixed(1)} <small>W</small>
              </span>
              <div className="appliance-bar-track">
                <div
                  className="appliance-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: isActive ? '#f59e0b' : '#2a2a3a',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
