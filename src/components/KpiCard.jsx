import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import './KpiCard.css';

export default function KpiCard({
  label,
  value,
  unit,
  accent = 'orange',
  sparklineData,
  sparklineKey = 'value',
  trend,
  subtitle,
  children,
}) {
  const accentVar = `var(--accent-${accent})`;

  const sparkData = useMemo(() => {
    if (!sparklineData || !sparklineData.length) return null;
    return sparklineData.slice(-12).map((d, i) => ({
      i,
      v: typeof d === 'number' ? d : d[sparklineKey] ?? 0,
    }));
  }, [sparklineData, sparklineKey]);

  return (
    <div className={`kpi-card kpi-accent-${accent}`}>
      <div className="kpi-border-accent" style={{ background: accentVar }} />
      <div className="kpi-content">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value-row">
          <span className="kpi-number" style={{ color: accentVar }}>{value}</span>
          {unit && <span className="kpi-unit">{unit}</span>}
          {trend != null && (
            <span className={`kpi-trend ${trend >= 0 ? 'up' : 'down'}`}>
              {trend >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        {subtitle && <div className="kpi-subtitle">{subtitle}</div>}
        {children}
      </div>
      {sparkData && (
        <div className="kpi-sparkline">
          <ResponsiveContainer width="100%" height={40}>
            <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={`sparkGrad-${accent}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentVar} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accentVar} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={accentVar}
                strokeWidth={1.5}
                fill={`url(#sparkGrad-${accent})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
