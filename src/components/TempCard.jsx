import './TempCard.css';

export default function TempCard({ sensor }) {
  return (
    <div className="temp-card">
      <div className="temp-name">{sensor.sensor_name}</div>
      <div className="temp-value">{sensor.temperature_c?.toFixed(1)}°C</div>
      <div className="temp-humidity">{sensor.humidity_pct?.toFixed(0)}% HR</div>
      {sensor.battery_pct != null && (
        <div className="temp-battery">
          {sensor.battery_pct}%
        </div>
      )}
    </div>
  );
}
