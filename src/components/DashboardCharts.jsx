import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea,
} from 'recharts';
import api from '../api';
import ChartToggle from './ChartToggle';
import './DashboardCharts.css';

const MODE_OPTIONS = [
  { label: 'Electricite', value: 'power' },
  { label: 'Confort', value: 'comfort' },
  { label: 'Meteo', value: 'weather' },
];

// Mapping de la vue globale (jour/semaine/mois) vers la granularite chart.
function periodFromView(period) {
  if (period === 'day') return '24h';
  if (period === 'week') return '7j';
  return '30j';
}

function isoDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

const APPLIANCE_COLORS = [
  '#f59e0b', '#fb923c', '#f97316', '#fbbf24', '#d97706',
  '#eab308', '#ca8a04', '#fcd34d', '#fdba74', '#fed7aa',
];

const SENSOR_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];

function formatDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function formatHour(d) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatTime(d) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Plus utilise : le composant suit la vue globale du dashboard (date + periode)
// au lieu de toujours partir de "maintenant".

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dc-tooltip">
      <p className="dc-tooltip-label">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="dc-tooltip-entry" style={{ color: entry.color }}>
          <span className="dc-tooltip-dot" style={{ background: entry.color }} />
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}</strong> {unit || ''}
        </p>
      ))}
    </div>
  );
}

const AXIS_STYLE = { fill: '#475569', fontSize: 11, fontFamily: 'inherit' };
const GRID_STROKE = 'rgba(255,255,255,0.04)';

export default function DashboardCharts({ view }) {
  const [mode, setMode] = useState('power');
  const [powerRealtime, setPowerRealtime] = useState([]);
  const [powerDaily, setPowerDaily] = useState([]);
  const [tempHistory, setTempHistory] = useState([]);
  const [co2History, setCo2History] = useState([]);
  const [weatherSeries, setWeatherSeries] = useState(null);
  const [loading, setLoading] = useState(false);

  // Periode mappee depuis la vue globale (Jour=24h, Semaine=7j, Mois=30j).
  const period = periodFromView(view?.period || 'day');

  // Fenetre temporelle de la vue : aujourd'hui = comportement live, sinon
  // borne au jour/semaine/mois selectionne.
  const windowBounds = useMemo(() => {
    const today = startOfDay(new Date());
    const viewDate = view?.date || new Date();
    const p = view?.period || 'day';
    if (p === 'day') {
      const day = startOfDay(viewDate);
      return { from: day, to: endOfDay(day), isToday: isoDay(day) === isoDay(today) };
    }
    if (p === 'week') {
      const d = new Date(viewDate); d.setHours(0,0,0,0);
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      const end = new Date(d); end.setDate(end.getDate() + 6); end.setHours(23,59,59,999);
      return { from: d, to: end, isToday: today >= d && today <= end };
    }
    // month
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: d, to: end, isToday: today >= d && today <= end };
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetchData = async () => {
      try {
        const fromISO = windowBounds.from.toISOString();
        const toISO = windowBounds.to.toISOString();
        const fromDate = isoDay(windowBounds.from);
        const toDate = isoDay(windowBounds.to);

        if (mode === 'power') {
          if (period === '24h') {
            // Power realtime ne supporte que "now minus N minutes". Si la
            // journee est aujourd'hui on peut l'utiliser (1440min = 24h),
            // sinon on bascule sur l'historique par prise. Pour MVP : si
            // pas aujourd'hui on tombe en /power/daily (1 barre).
            if (windowBounds.isToday) {
              const res = await api.get('/api/readings/power/realtime', { params: { minutes: 1440 } });
              if (!cancelled) { setPowerRealtime(res.data); setPowerDaily([]); }
            } else {
              const res = await api.get('/api/readings/power/daily', {
                params: { from: fromDate, to: toDate },
              });
              if (!cancelled) { setPowerDaily(res.data); setPowerRealtime([]); }
            }
          } else {
            const res = await api.get('/api/readings/power/daily', {
              params: { from: fromDate, to: toDate },
            });
            if (!cancelled) setPowerDaily(res.data);
          }
        } else if (mode === 'weather') {
          // Archive Open-Meteo : horaire en 24h, journalier au-dela.
          // ERA5 a ~2 jours de latence : si la fenetre touche ces derniers
          // jours, l'API peut renvoyer des series tronquees.
          const interval = period === '24h' ? 'hourly' : 'daily';
          const res = await api.get('/api/weather/history', {
            params: { from: fromDate, to: toDate, interval },
          });
          if (!cancelled) setWeatherSeries(res.data);
        } else {
          const interval = period === '24h' ? 'hour' : 'day';
          const [tempRes, co2Res] = await Promise.all([
            api.get('/api/readings/temp/history', { params: { interval, from: fromISO, to: toISO } }),
            api.get('/api/readings/co2/history', { params: { interval, from: fromISO, to: toISO } }).catch(() => ({ data: [] })),
          ]);
          if (!cancelled) {
            setTempHistory(tempRes.data);
            setCo2History(co2Res.data);
          }
        }
      } catch (err) {
        console.error('Chart data fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    // Poll live uniquement si la fenetre touche aujourd'hui.
    const refresh = windowBounds.isToday ? (period === '24h' ? 30000 : 120000) : 5 * 60 * 1000;
    const id = setInterval(fetchData, refresh);
    return () => { cancelled = true; clearInterval(id); };
  }, [mode, period, windowBounds]);

  // --- Power: aggregate realtime data into time series ---
  const realtimeChartData = useMemo(() => {
    if (!powerRealtime.length) return { series: [], appliances: [] };

    const appSet = new Map();
    powerRealtime.forEach((r) => appSet.set(r.plug_id, r.appliance_name));
    const appliances = Array.from(appSet.entries()).map(([id, name]) => ({ id, name }));

    const bucketMs = 5 * 60000;
    const buckets = {};
    powerRealtime.forEach((r) => {
      const t = Math.floor(new Date(r.ts).getTime() / bucketMs) * bucketMs;
      const key = t.toString();
      if (!buckets[key]) {
        buckets[key] = { ts: t, time: formatTime(new Date(t)), total: 0 };
        appliances.forEach((a) => { buckets[key][a.name] = 0; buckets[key][`${a.name}_count`] = 0; });
      }
      buckets[key][r.appliance_name] = (buckets[key][r.appliance_name] || 0) + r.power_w;
      buckets[key][`${r.appliance_name}_count`] = (buckets[key][`${r.appliance_name}_count`] || 0) + 1;
    });

    const series = Object.values(buckets)
      .sort((a, b) => a.ts - b.ts)
      .map((b) => {
        let total = 0;
        appliances.forEach((a) => {
          const count = b[`${a.name}_count`] || 1;
          b[a.name] = Math.round((b[a.name] || 0) / count);
          total += b[a.name];
        });
        b.total = total;
        return b;
      });

    return { series, appliances };
  }, [powerRealtime]);

  // --- Power daily chart data ---
  const dailyChartData = useMemo(() => {
    if (!powerDaily.length) return { series: [], appliances: [] };

    const appSet = new Set();
    powerDaily.forEach((d) => d.plugs.forEach((p) => appSet.add(p.appliance_name)));
    const appliances = Array.from(appSet);

    const series = powerDaily.map((d) => {
      const entry = { date: formatDate(d.date), total_kwh: d.total_kwh };
      appliances.forEach((a) => { entry[a] = 0; });
      d.plugs.forEach((p) => { entry[p.appliance_name] = p.kwh; });
      return entry;
    });

    return { series, appliances };
  }, [powerDaily]);

  // --- Comfort: pivot temp data into per-sensor series ---
  const comfortData = useMemo(() => {
    if (!tempHistory.length) return { series: [], sensors: [] };

    const sensorSet = new Map();
    tempHistory.forEach((r) => {
      const label = r.room_name || r.sensor_name || r.sensor_id;
      sensorSet.set(r.sensor_id, label);
    });
    const sensors = Array.from(sensorSet.entries()).map(([id, name]) => ({ id, name }));

    const byTs = {};
    tempHistory.forEach((r) => {
      const label = sensorSet.get(r.sensor_id);
      const timeLabel = period === '24h' ? formatHour(r.ts) : formatDate(r.ts);
      if (!byTs[r.ts]) {
        byTs[r.ts] = { ts: r.ts, time: timeLabel };
      }
      byTs[r.ts][`temp_${label}`] = r.temperature_c;
      byTs[r.ts][`hum_${label}`] = r.humidity_pct;
    });

    const series = Object.values(byTs).sort((a, b) => a.ts.localeCompare(b.ts));
    return { series, sensors };
  }, [tempHistory, period]);

  // --- CO2 series ---
  const co2Data = useMemo(() => {
    if (!co2History.length) return { series: [], sensors: [] };

    const sensorSet = new Map();
    co2History.forEach((r) => {
      const label = r.room_name || r.sensor_name || r.sensor_id;
      sensorSet.set(r.sensor_id, label);
    });
    const sensors = Array.from(sensorSet.entries()).map(([id, name]) => ({ id, name }));

    const byTs = {};
    co2History.forEach((r) => {
      const label = sensorSet.get(r.sensor_id);
      const timeLabel = period === '24h' ? formatHour(r.ts) : formatDate(r.ts);
      if (!byTs[r.ts]) byTs[r.ts] = { ts: r.ts, time: timeLabel };
      byTs[r.ts][label] = r.co2_ppm;
    });

    const series = Object.values(byTs).sort((a, b) => a.ts.localeCompare(b.ts));
    return { series, sensors };
  }, [co2History, period]);

  const renderPowerCharts = () => {
    if (period === '24h') {
      const { series, appliances } = realtimeChartData;
      return (
        <div className="dc-chart-card dc-chart-main">
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPowerMain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                {appliances.map((a, i) => (
                  <linearGradient key={a.id} id={`gradApp${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={APPLIANCE_COLORS[i % APPLIANCE_COLORS.length]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={APPLIANCE_COLORS[i % APPLIANCE_COLORS.length]} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="time"
                tick={AXIS_STYLE}
                stroke="transparent"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={AXIS_STYLE}
                stroke="transparent"
                tickLine={false}
                axisLine={false}
                unit=" W"
                width={60}
              />
              <Tooltip content={<CustomTooltip unit="W" />} />
              <Legend
                wrapperStyle={{ color: '#64748b', fontSize: 11, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#gradPowerMain)"
                animationDuration={600}
                name="Total"
              />
              {appliances.map((a, i) => (
                <Area
                  key={a.id}
                  type="monotone"
                  dataKey={a.name}
                  stroke={APPLIANCE_COLORS[i % APPLIANCE_COLORS.length]}
                  strokeWidth={1.5}
                  fill={`url(#gradApp${i})`}
                  animationDuration={600}
                  name={a.name}
                  stackId="detail"
                  hide
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // 7j / 30j — bar chart with kWh
    const { series, appliances } = dailyChartData;
    return (
      <div className="dc-chart-card dc-chart-main">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradBarTotal2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="date"
              tick={AXIS_STYLE}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={AXIS_STYLE}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              unit=" kWh"
              width={70}
            />
            <Tooltip content={<CustomTooltip unit="kWh" />} />
            {appliances.length > 1 ? (
              <>
                <Legend
                  wrapperStyle={{ color: '#64748b', fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                {appliances.map((name, i) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    stackId="stack"
                    fill={APPLIANCE_COLORS[i % APPLIANCE_COLORS.length]}
                    radius={i === appliances.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    animationDuration={600}
                    name={name}
                  />
                ))}
              </>
            ) : (
              <Bar
                dataKey="total_kwh"
                fill="url(#gradBarTotal2)"
                radius={[6, 6, 0, 0]}
                animationDuration={600}
                name="Total"
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderComfortCharts = () => {
    const { series, sensors } = comfortData;
    const { series: co2Series, sensors: co2Sensors } = co2Data;

    return (
      <>
        <div className="dc-chart-card dc-chart-main">
          <div className="dc-subchart-title">Temperature</div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="time" tick={AXIS_STYLE} stroke="transparent" tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_STYLE} stroke="transparent" tickLine={false} axisLine={false} unit={'\u00b0C'} domain={['auto', 'auto']} width={50} />
              <Tooltip content={<CustomTooltip unit={'\u00b0C'} />} />
              <Legend wrapperStyle={{ color: '#64748b', fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
              <ReferenceArea
                y1={19}
                y2={24}
                fill="#10b981"
                fillOpacity={0.06}
                label={{ value: 'Zone de confort', fill: '#10b981', fontSize: 10, position: 'insideTopLeft', opacity: 0.6 }}
              />
              {sensors.map((s, i) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={`temp_${s.name}`}
                  stroke={SENSOR_COLORS[i % SENSOR_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  animationDuration={600}
                  name={s.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {co2Sensors.length > 0 && (
          <div className="dc-chart-card dc-chart-main">
            <div className="dc-subchart-title">Qualite de l'air (CO2)</div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={co2Series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="time" tick={AXIS_STYLE} stroke="transparent" tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_STYLE} stroke="transparent" tickLine={false} axisLine={false} unit=" ppm" domain={['auto', 'auto']} width={60} />
                <Tooltip content={<CustomTooltip unit="ppm" />} />
                <Legend wrapperStyle={{ color: '#64748b', fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
                <ReferenceArea y1={0} y2={800} fill="#10b981" fillOpacity={0.06} label={{ value: 'Air sain', fill: '#10b981', fontSize: 10, position: 'insideTopLeft', opacity: 0.6 }} />
                <ReferenceArea y1={800} y2={1200} fill="#f59e0b" fillOpacity={0.06} />
                <ReferenceArea y1={1200} y2={5000} fill="#ef4444" fillOpacity={0.05} label={{ value: 'A aerer', fill: '#ef4444', fontSize: 10, position: 'insideTopLeft', opacity: 0.7 }} />
                {co2Sensors.map((s, i) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.name}
                    stroke={SENSOR_COLORS[i % SENSOR_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                    animationDuration={600}
                    name={s.name}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </>
    );
  };

  // ── Meteo : adapte la reponse Open-Meteo archive en serie recharts ──
  const weatherChartData = useMemo(() => {
    if (!weatherSeries || !weatherSeries.series) return { series: [], interval: 'hourly' };
    const s = weatherSeries.series;
    const interval = weatherSeries.interval || 'hourly';
    if (interval === 'hourly') {
      const times = s.time || [];
      const temps = s.temperature_2m || [];
      const hums = s.relative_humidity_2m || [];
      const winds = s.wind_speed_10m || [];
      const precip = s.precipitation || [];
      return {
        interval,
        series: times.map((t, i) => ({
          ts: t,
          time: formatHour(t),
          t: temps[i],
          rh: hums[i],
          wind: winds[i],
          precip: precip[i],
        })),
      };
    }
    const times = s.time || [];
    return {
      interval,
      series: times.map((t, i) => ({
        ts: t,
        time: formatDate(t),
        t_min: s.temperature_2m_min?.[i],
        t_max: s.temperature_2m_max?.[i],
        t_mean: s.temperature_2m_mean?.[i],
        rh: s.relative_humidity_2m_mean?.[i],
        wind: s.wind_speed_10m_max?.[i],
        precip: s.precipitation_sum?.[i],
      })),
    };
  }, [weatherSeries]);

  const renderWeatherCharts = () => {
    const { series, interval } = weatherChartData;
    if (!series.length) return null;
    return (
      <>
        <div className="dc-chart-card dc-chart-main">
          <div className="dc-subchart-title">
            {interval === 'hourly' ? 'Temperature & humidite (heures)' : 'Temperature (jours)'}
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={series} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="time" tick={AXIS_STYLE} stroke="transparent" tickLine={false} axisLine={false} />
              <YAxis yAxisId="t" tick={AXIS_STYLE} stroke="transparent" tickLine={false} axisLine={false} unit={'°C'} width={50} />
              <YAxis yAxisId="rh" orientation="right" tick={AXIS_STYLE} stroke="transparent" tickLine={false} axisLine={false} unit="%" domain={[0, 100]} width={45} />
              <Tooltip />
              <Legend wrapperStyle={{ color: '#64748b', fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
              {interval === 'hourly' ? (
                <>
                  <Line yAxisId="t" type="monotone" dataKey="t" name="Temp ext." stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line yAxisId="rh" type="monotone" dataKey="rh" name="Humidite ext." stroke="#8b5cf6" strokeWidth={1.6} dot={false} />
                </>
              ) : (
                <>
                  <Line yAxisId="t" type="monotone" dataKey="t_min" name="T min" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                  <Line yAxisId="t" type="monotone" dataKey="t_mean" name="T moy" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line yAxisId="t" type="monotone" dataKey="t_max" name="T max" stroke="#f97316" strokeWidth={1.5} dot={false} />
                  <Line yAxisId="rh" type="monotone" dataKey="rh" name="Humidite moy" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="dc-chart-card dc-chart-main">
          <div className="dc-subchart-title">
            {interval === 'hourly' ? 'Vent & precipitations' : 'Vent max & precipitations totales'}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={series} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="time" tick={AXIS_STYLE} stroke="transparent" tickLine={false} axisLine={false} />
              <YAxis yAxisId="wind" tick={AXIS_STYLE} stroke="transparent" tickLine={false} axisLine={false} unit=" m/s" width={55} />
              <YAxis yAxisId="precip" orientation="right" tick={AXIS_STYLE} stroke="transparent" tickLine={false} axisLine={false} unit=" mm" width={55} />
              <Tooltip />
              <Legend wrapperStyle={{ color: '#64748b', fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
              <Line yAxisId="wind" type="monotone" dataKey="wind" name="Vent" stroke="#64748b" strokeWidth={1.6} dot={false} />
              <Line yAxisId="precip" type="monotone" dataKey="precip" name="Precipitations" stroke="#3b82f6" strokeWidth={1.6} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {weatherSeries?.from && weatherSeries?.to && (
          <p className="dc-source">
            Source : Open-Meteo Archive ({weatherSeries.from} → {weatherSeries.to})
            {interval === 'hourly' && period === '24h' && (
              <span> · l'archive ERA5 a 1-2 jours de latence, on affiche la veille</span>
            )}
          </p>
        )}
      </>
    );
  };

  return (
    <section className="dc-section">
      <div className="dc-header">
        <h3 className="dc-title">
          {mode === 'power' ? 'Consommation electrique' : mode === 'weather' ? 'Meteo exterieure' : 'Confort thermique'}
        </h3>
        <div className="dc-controls">
          <ChartToggle options={MODE_OPTIONS} active={mode} onChange={setMode} />
        </div>
      </div>

      {loading && (
        <div className="dc-loading">
          <div className="dc-spinner" />
          Chargement...
        </div>
      )}

      {mode === 'power' ? renderPowerCharts() : mode === 'weather' ? renderWeatherCharts() : renderComfortCharts()}

      {!loading &&
        ((mode === 'power' && period === '24h' && !realtimeChartData.series.length) ||
         (mode === 'power' && period !== '24h' && !dailyChartData.series.length) ||
         (mode === 'weather' && !weatherChartData.series.length) ||
         (mode === 'comfort' && !comfortData.series.length)) && (
        <div className="dc-empty">
          Pas encore de donnees pour cette periode.
        </div>
      )}
    </section>
  );
}
