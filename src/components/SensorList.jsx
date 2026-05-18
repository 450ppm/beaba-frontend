import { useState } from 'react';
import { COMFORT_CONFIG } from '../lib/comfort';
import Co2CalibrationModal from './Co2CalibrationModal';
import './SensorList.css';

function getComfortClass(temp) {
  if (temp == null) return 'neutral';
  if (temp < COMFORT_CONFIG.temperature.min_c) return 'cold';
  if (temp > COMFORT_CONFIG.temperature.max_c) return 'hot';
  return 'comfort';
}

function BatteryIcon({ pct }) {
  if (pct == null) return null;
  const isLow = pct < 20;
  return (
    <span className={`sensor-battery ${isLow ? 'low' : ''}`} title={`Batterie: ${pct}%`}>
      <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
        <rect x="0.5" y="0.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />
        <rect x="14" y="3" width="2" height="4" rx="0.5" fill="currentColor" opacity="0.5" />
        <rect x="2" y="2" width={Math.max(0, (pct / 100) * 10)} height="6" rx="0.5" fill="currentColor" />
      </svg>
      {isLow && <span className="battery-warn">!</span>}
    </span>
  );
}

function getCo2Class(ppm) {
  if (ppm == null) return 'neutral';
  if (ppm < 800) return 'comfort';
  if (ppm < 1200) return 'warning';
  return 'bad';
}

export default function SensorList({ tempData, co2Data }) {
  const hasTemp = tempData && tempData.length > 0;
  const hasCo2 = co2Data && co2Data.length > 0;
  const [calibratingSensor, setCalibratingSensor] = useState(null);

  if (!hasTemp && !hasCo2) {
    return (
      <div className="sensor-panel">
        <h3 className="panel-title">Capteurs</h3>
        <p className="panel-empty">En attente des capteurs...</p>
      </div>
    );
  }

  return (
    <div className="sensor-panel">
      <h3 className="panel-title">Capteurs</h3>
      <div className="sensor-list">
        {tempData?.map((sensor) => {
          const comfortClass = getComfortClass(sensor.temperature_c);
          return (
            <div key={`t_${sensor.sensor_id}`} className={`sensor-row sensor-${comfortClass}`}>
              <div className="sensor-info">
                <span className="sensor-name">
                  {sensor.room_name || sensor.sensor_name}
                  {sensor.room_name && sensor.sensor_name && (
                    <span className="sensor-subname">{sensor.sensor_name}</span>
                  )}
                </span>
                <BatteryIcon pct={sensor.battery_pct} />
              </div>
              <div className="sensor-values">
                <span className={`sensor-temp sensor-temp-${comfortClass}`}>
                  {sensor.temperature_c?.toFixed(1)}°
                </span>
                <span className="sensor-humidity">
                  {sensor.humidity_pct?.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}

        {co2Data?.map((sensor) => {
          const co2Class = getCo2Class(sensor.co2_ppm);
          const calibrated = sensor.calibration_offset_ppm && Math.abs(sensor.calibration_offset_ppm) > 0.5;
          return (
            <div key={`c_${sensor.sensor_id}`} className={`sensor-row sensor-co2 sensor-${co2Class}`}>
              <div className="sensor-info">
                <span className="sensor-name">
                  <span className="sensor-co2-label">CO2</span>
                  {sensor.room_name || sensor.sensor_name}
                  {sensor.room_name && sensor.sensor_name && (
                    <span className="sensor-subname">{sensor.sensor_name}</span>
                  )}
                </span>
                {calibrated && (
                  <span className="sensor-co2-cal-badge" title={`Calibre : offset ${sensor.calibration_offset_ppm > 0 ? '+' : ''}${sensor.calibration_offset_ppm} ppm`}>
                    cal
                  </span>
                )}
              </div>
              <div className="sensor-values">
                <span className={`sensor-temp sensor-co2-value sensor-co2-${co2Class}`}>
                  {sensor.co2_ppm} <small>ppm</small>
                </span>
                <button
                  type="button"
                  className="sensor-co2-cal-btn"
                  onClick={() => setCalibratingSensor(sensor)}
                  title="Calibrer ce capteur sur le CO2 atmospherique"
                  aria-label="Calibrer"
                >⚙</button>
              </div>
            </div>
          );
        })}
      </div>
      {calibratingSensor && (
        <Co2CalibrationModal
          sensor={calibratingSensor}
          onClose={() => setCalibratingSensor(null)}
        />
      )}
    </div>
  );
}
