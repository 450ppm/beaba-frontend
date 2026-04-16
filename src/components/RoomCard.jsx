import './RoomCard.css';

export default function RoomCard({ room }) {
  const totalW = room.total_w ?? 0;

  return (
    <div className="room-card" style={{ borderLeftColor: room.color }}>
      <div className="room-header">
        <h3>{room.name}</h3>
        <span className="room-power">{totalW.toFixed(0)} W</span>
      </div>

      {room.co2 && (
        <div className="room-env">
          <span>{room.co2.temperature_c?.toFixed(1)}°C</span>
          <span>{room.co2.humidity_pct?.toFixed(0)}%</span>
          <span>{room.co2.co2_ppm} ppm</span>
        </div>
      )}

      <div className="plug-list">
        {room.plugs?.map((plug) => (
          <div key={plug.id} className="plug-row">
            <span className={`plug-dot ${plug.power_w > 1 ? 'on' : 'off'}`} />
            <span className="plug-name">{plug.appliance_name}</span>
            <span className="plug-power">{plug.power_w?.toFixed(1)} W</span>
          </div>
        ))}
      </div>
    </div>
  );
}
