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
];

const PERIOD_OPTIONS = [
  { label: '24h', value: '24h' },
  { label: '7j', value: '7j' },
  { label: '30j', value: '30j' },
];

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

function isoFrom(period) {
  const now = new Date();
  if (period === '24h') return new Date(now.getTime() - 86400000).toISOString();
  if (period === '7j') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

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

export default function DashboardCharts() {
  const [mode, setMode] = useState('power');
  const [period, setPeriod] = useState('24h');
  const [powerRealtime, setPowerRealtime] = useState([]);
  const [powerDaily, setPowerDaily] = useState([]);
  const [tempHistory, setTempHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetchData = async () => {
      try {
        if (mode === 'power') {
          if (period === '24h') {
            const res = await api.get('/api/readings/power/realtime', {
              params: { minutes: 1440 },
            });
            if (!cancelled) setPowerRealtime(res.data);
          } else {
            const res = await api.get('/api/readings/power/daily', {
              params: {
                from: isoFrom(period),
                to: new Date().toISOString().slice(0, 10),
              },
            });
            if (!cancelled) setPowerDaily(res.data);
          }
        } else {
          const interval = period === '24h' ? 'hour' : 'day';
          const res = await api.get('/api/readings/temp/history', {
            params: {
              interval,
              from: isoFrom(period),
              to: new Date().toISOString(),
            },
          });
          if (!cancelled) setTempHistory(res.data);
        }
      } catch (err) {
        console.error('Chart data fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const id = setInterval(fetchData, period === '24h' ? 30000 : 120000);
    return () => { cancelled = true; clearInterval(id); };
  }, [mode, period]);

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

    return (
      <div className="dc-chart-card dc-chart-main">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
              unit={'\u00b0C'}
              domain={['auto', 'auto']}
              width={50}
            />
            <Tooltip content={<CustomTooltip unit={'\u00b0C'} />} />
            <Legend
              wrapperStyle={{ color: '#64748b', fontSize: 11, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            <ReferenceArea
              y1={19}
              y2={24}
              fill="#10b981"
              fillOpacity={0.06}
              label={{
                value: 'Zone de confort',
                fill: '#10b981',
                fontSize: 10,
                position: 'insideTopLeft',
                opacity: 0.6,
              }}
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
    );
  };

  return (
    <section className="dc-section">
      <div className="dc-header">
        <h3 className="dc-title">
          {mode === 'power' ? 'Consommation electrique' : 'Confort thermique'}
        </h3>
        <div className="dc-controls">
          <ChartToggle options={MODE_OPTIONS} active={mode} onChange={setMode} />
          <ChartToggle options={PERIOD_OPTIONS} active={period} onChange={setPeriod} />
        </div>
      </div>

      {loading && (
        <div className="dc-loading">
          <div className="dc-spinner" />
          Chargement...
        </div>
      )}

      {mode === 'power' ? renderPowerCharts() : renderComfortCharts()}

      {!loading &&
        ((mode === 'power' && period === '24h' && !realtimeChartData.series.length) ||
         (mode === 'power' && period !== '24h' && !dailyChartData.series.length) ||
         (mode === 'comfort' && !comfortData.series.length)) && (
        <div className="dc-empty">
          Pas encore de donnees pour cette periode.
        </div>
      )}
    </section>
  );
}
